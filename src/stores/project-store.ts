import { create } from 'zustand'
import { createDemoProject } from '@/lib/demo-project'
import type {
  Condition,
  NodeType,
  ProjectFile,
  UseCase,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from '@/lib/schemas/project'
import { loadStoredProject } from '@/lib/storage/project-storage'
import { canConnect, outgoingEdges } from '@/lib/workflow-engine/graph'

export type Selection =
  | { kind: 'workflow' }
  | { kind: 'useCase'; id: string }
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null

export type SaveStatus = 'saved' | 'saving' | 'error'

const HISTORY_LIMIT = 100
const COALESCE_MS = 1000

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

export const NODE_DEFAULTS: Record<NodeType, string> = {
  trigger: 'Trigger',
  action: 'New action',
  condition: 'New condition',
  end: 'End',
}

interface ProjectState {
  project: ProjectFile
  activeWorkflowId: string | null
  activeUseCaseIds: Record<string, string>
  selection: Selection
  past: ProjectFile[]
  future: ProjectFile[]
  lastCommit: { key: string; time: number } | null
  saveStatus: SaveStatus
  storageError: string | null
  /** Hint for the canvas to fit the view (after switching workflow, import, layout). */
  viewVersion: number
}

interface ProjectActions {
  replaceProject: (project: ProjectFile) => void
  updateProjectMeta: (patch: Partial<ProjectFile['project']>) => void

  addWorkflow: () => string
  updateWorkflow: (id: string, patch: Partial<Pick<Workflow, 'name' | 'description'>>) => void
  duplicateWorkflow: (id: string) => void
  deleteWorkflow: (id: string) => void
  selectWorkflow: (id: string) => void

  addUseCase: () => string | null
  updateUseCase: (id: string, patch: Partial<Omit<UseCase, 'id'>>) => void
  duplicateUseCase: (id: string) => void
  deleteUseCase: (id: string) => void
  selectUseCase: (id: string) => void

  addNode: (type: NodeType, position: { x: number; y: number }) => string | null
  updateNode: (id: string, patch: Partial<Omit<WorkflowNode, 'id' | 'type'>>) => void
  moveNodes: (positions: Record<string, { x: number; y: number }>) => void
  applyLayout: (positions: Record<string, { x: number; y: number }>) => void
  checkpoint: (key: string) => void
  deleteElements: (nodeIds: string[], edgeIds: string[]) => void

  connect: (source: string, target: string) => string | null
  updateEdge: (id: string, patch: Partial<Omit<WorkflowEdge, 'id' | 'source' | 'target'>>) => void
  moveRoute: (edgeId: string, direction: -1 | 1) => void

  select: (selection: Selection) => void
  undo: () => void
  redo: () => void
  setSaveStatus: (status: SaveStatus, error?: string | null) => void
}

export type ProjectStore = ProjectState & ProjectActions

const withWorkflow = (project: ProjectFile, id: string, fn: (wf: Workflow) => Workflow): ProjectFile => {
  let changed = false
  const workflows = project.workflows.map((wf) => {
    if (wf.id !== id) return wf
    const next = fn(wf)
    if (next !== wf) changed = true
    return next
  })
  return changed ? { ...project, workflows } : project
}

/** Keeps active ids and selection pointing at things that still exist. */
function normalize(state: ProjectState): ProjectState {
  const { project } = state
  const workflow = project.workflows.find((w) => w.id === state.activeWorkflowId) ?? project.workflows[0]
  const activeUseCaseIds = { ...state.activeUseCaseIds }
  for (const wf of project.workflows) {
    if (!wf.useCases.some((u) => u.id === activeUseCaseIds[wf.id])) {
      const first = wf.useCases[0]
      if (first) activeUseCaseIds[wf.id] = first.id
      else delete activeUseCaseIds[wf.id]
    }
  }
  const sel = state.selection
  const valid =
    !sel ||
    sel.kind === 'workflow' ||
    (sel.kind === 'node' && workflow?.nodes.some((n) => n.id === sel.id)) ||
    (sel.kind === 'edge' && workflow?.edges.some((e) => e.id === sel.id)) ||
    (sel.kind === 'useCase' && workflow?.useCases.some((u) => u.id === sel.id))
  return {
    ...state,
    activeWorkflowId: workflow?.id ?? null,
    activeUseCaseIds,
    selection: valid && (workflow || !sel) ? sel : null,
  }
}

export function createInitialState(project: ProjectFile): ProjectState {
  return normalize({
    project,
    activeWorkflowId: null,
    activeUseCaseIds: {},
    selection: null,
    past: [],
    future: [],
    lastCommit: null,
    saveStatus: 'saved',
    storageError: null,
    viewVersion: 0,
  })
}

function duplicateWorkflowData(wf: Workflow): Workflow {
  const nodeIds = new Map(wf.nodes.map((n) => [n.id, newId('node')]))
  return {
    ...wf,
    id: newId('workflow'),
    name: `${wf.name} copy`,
    nodes: wf.nodes.map((n) => ({
      ...n,
      id: nodeIds.get(n.id) as string,
      links: n.links.map((l) => ({ ...l })),
    })),
    edges: wf.edges.map((e) => ({
      ...e,
      id: newId('edge'),
      source: nodeIds.get(e.source) as string,
      target: nodeIds.get(e.target) as string,
    })),
    useCases: wf.useCases.map((u) => ({ ...u, id: newId('usecase'), inputs: { ...u.inputs } })),
  }
}

export const useProjectStore = create<ProjectStore>()((set, get) => {
  /** Applies an undoable change. Changes sharing a key within a second form one history step. */
  const commit = (key: string | null, fn: (project: ProjectFile) => ProjectFile) =>
    set((s) => {
      const next = fn(s.project)
      if (next === s.project) return s
      const now = Date.now()
      const coalesce = key !== null && s.lastCommit?.key === key && now - s.lastCommit.time < COALESCE_MS
      return normalize({
        ...s,
        project: next,
        past: coalesce ? s.past : [...s.past, s.project].slice(-HISTORY_LIMIT),
        future: [],
        lastCommit: key ? { key, time: now } : null,
      })
    })

  const activeWorkflow = () => {
    const s = get()
    return s.project.workflows.find((w) => w.id === s.activeWorkflowId)
  }
  const editActive = (key: string | null, fn: (wf: Workflow) => Workflow) => {
    const wf = activeWorkflow()
    if (wf) commit(key, (p) => withWorkflow(p, wf.id, fn))
  }

  return {
    ...createInitialState(loadStoredProject() ?? createDemoProject()),

    replaceProject: (project) =>
      set((s) => ({
        ...createInitialState(project),
        saveStatus: s.saveStatus,
        storageError: s.storageError,
        viewVersion: s.viewVersion + 1,
      })),

    updateProjectMeta: (patch) =>
      commit('project-meta', (p) => ({ ...p, project: { ...p.project, ...patch } })),

    addWorkflow: () => {
      const id = newId('workflow')
      const wf: Workflow = {
        id,
        name: 'Untitled workflow',
        description: '',
        nodes: [
          {
            id: newId('node'),
            type: 'trigger',
            title: 'Start',
            description: '',
            notes: '',
            links: [],
            position: { x: 0, y: 0 },
          },
          {
            id: newId('node'),
            type: 'end',
            title: 'End',
            description: '',
            notes: '',
            links: [],
            position: { x: 320, y: 0 },
          },
        ],
        edges: [],
        useCases: [{ id: newId('usecase'), name: 'Default', description: '', notes: '', inputs: {} }],
      }
      commit(null, (p) => ({ ...p, workflows: [...p.workflows, wf] }))
      get().selectWorkflow(id)
      return id
    },

    updateWorkflow: (id, patch) =>
      commit(`workflow-${id}`, (p) => withWorkflow(p, id, (wf) => ({ ...wf, ...patch }))),

    duplicateWorkflow: (id) => {
      const source = get().project.workflows.find((w) => w.id === id)
      if (!source) return
      const copy = duplicateWorkflowData(source)
      commit(null, (p) => {
        const index = p.workflows.findIndex((w) => w.id === id)
        const workflows = [...p.workflows]
        workflows.splice(index + 1, 0, copy)
        return { ...p, workflows }
      })
      get().selectWorkflow(copy.id)
    },

    deleteWorkflow: (id) =>
      commit(null, (p) => ({ ...p, workflows: p.workflows.filter((w) => w.id !== id) })),

    selectWorkflow: (id) =>
      set((s) =>
        s.project.workflows.some((w) => w.id === id)
          ? normalize({
              ...s,
              activeWorkflowId: id,
              selection: { kind: 'workflow' },
              viewVersion: s.viewVersion + (s.activeWorkflowId === id ? 0 : 1),
            })
          : s,
      ),

    addUseCase: () => {
      const wf = activeWorkflow()
      if (!wf) return null
      const id = newId('usecase')
      const inputs = { ...(wf.useCases[0]?.inputs ?? {}) }
      editActive(null, (w) => ({
        ...w,
        useCases: [
          ...w.useCases,
          { id, name: `Use case ${w.useCases.length + 1}`, description: '', notes: '', inputs },
        ],
      }))
      get().selectUseCase(id)
      return id
    },

    updateUseCase: (id, patch) =>
      editActive(`usecase-${id}`, (wf) => ({
        ...wf,
        useCases: wf.useCases.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      })),

    duplicateUseCase: (id) => {
      const wf = activeWorkflow()
      const source = wf?.useCases.find((u) => u.id === id)
      if (!wf || !source) return
      const copy: UseCase = {
        ...source,
        id: newId('usecase'),
        name: `${source.name} copy`,
        inputs: { ...source.inputs },
      }
      editActive(null, (w) => {
        const index = w.useCases.findIndex((u) => u.id === id)
        const useCases = [...w.useCases]
        useCases.splice(index + 1, 0, copy)
        return { ...w, useCases }
      })
      get().selectUseCase(copy.id)
    },

    deleteUseCase: (id) =>
      editActive(null, (wf) => ({ ...wf, useCases: wf.useCases.filter((u) => u.id !== id) })),

    selectUseCase: (id) =>
      set((s) => {
        const wf = s.project.workflows.find((w) => w.id === s.activeWorkflowId)
        if (!wf || !wf.useCases.some((u) => u.id === id)) return s
        return {
          ...s,
          activeUseCaseIds: { ...s.activeUseCaseIds, [wf.id]: id },
          selection: { kind: 'useCase', id },
        }
      }),

    addNode: (type, position) => {
      if (!activeWorkflow()) return null
      const id = newId('node')
      editActive(null, (wf) => ({
        ...wf,
        nodes: [
          ...wf.nodes,
          { id, type, title: NODE_DEFAULTS[type], description: '', notes: '', links: [], position },
        ],
      }))
      set({ selection: { kind: 'node', id } })
      return id
    },

    updateNode: (id, patch) =>
      editActive(`node-${id}`, (wf) => ({
        ...wf,
        nodes: wf.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      })),

    // Drag moves are applied live; checkpoint() records one undo step at drag start.
    moveNodes: (positions) =>
      set((s) => {
        const wf = s.project.workflows.find((w) => w.id === s.activeWorkflowId)
        if (!wf) return s
        return {
          ...s,
          project: withWorkflow(s.project, wf.id, (w) => ({
            ...w,
            nodes: w.nodes.map((n) =>
              positions[n.id] ? { ...n, position: positions[n.id] as WorkflowNode['position'] } : n,
            ),
          })),
        }
      }),

    applyLayout: (positions) => {
      editActive(null, (wf) => ({
        ...wf,
        nodes: wf.nodes.map((n) =>
          positions[n.id] ? { ...n, position: positions[n.id] as WorkflowNode['position'] } : n,
        ),
      }))
      set((s) => ({ viewVersion: s.viewVersion + 1 }))
    },

    checkpoint: (key) =>
      set((s) => ({
        past: [...s.past, s.project].slice(-HISTORY_LIMIT),
        future: [],
        lastCommit: { key, time: 0 },
      })),

    deleteElements: (nodeIds, edgeIds) =>
      editActive(null, (wf) => {
        const nodes = wf.nodes.filter((n) => !nodeIds.includes(n.id))
        const edges = wf.edges.filter(
          (e) => !edgeIds.includes(e.id) && !nodeIds.includes(e.source) && !nodeIds.includes(e.target),
        )
        return nodes.length === wf.nodes.length && edges.length === wf.edges.length
          ? wf
          : { ...wf, nodes, edges }
      }),

    connect: (source, target) => {
      const wf = activeWorkflow()
      if (!wf || !canConnect(wf, source, target).ok) return null
      const sourceNode = wf.nodes.find((n) => n.id === source)
      const siblings = outgoingEdges(wf, source)
      const id = newId('edge')
      const isCondition = sourceNode?.type === 'condition'
      const condition: Condition | undefined = isCondition
        ? { variable: '', operator: 'equals', value: true }
        : undefined
      const edge: WorkflowEdge = {
        id,
        source,
        target,
        fallback: false,
        priority: siblings.reduce((max, e) => Math.max(max, e.priority + 1), 0),
        ...(condition ? { condition } : {}),
      }
      editActive(null, (w) => ({ ...w, edges: [...w.edges, edge] }))
      set({ selection: { kind: 'edge', id } })
      return id
    },

    updateEdge: (id, patch) =>
      editActive(`edge-${id}`, (wf) => ({
        ...wf,
        edges: wf.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),

    moveRoute: (edgeId, direction) =>
      editActive(null, (wf) => {
        const edge = wf.edges.find((e) => e.id === edgeId)
        if (!edge) return wf
        const routes = outgoingEdges(wf, edge.source)
        const from = routes.findIndex((e) => e.id === edgeId)
        const to = from + direction
        if (to < 0 || to >= routes.length) return wf
        const reordered = [...routes]
        reordered.splice(to, 0, ...reordered.splice(from, 1))
        const priorities = new Map(reordered.map((e, i) => [e.id, i]))
        return {
          ...wf,
          edges: wf.edges.map((e) =>
            priorities.has(e.id) ? { ...e, priority: priorities.get(e.id) as number } : e,
          ),
        }
      }),

    select: (selection) => set({ selection }),

    undo: () =>
      set((s) => {
        const previous = s.past[s.past.length - 1]
        if (!previous) return s
        return normalize({
          ...s,
          project: previous,
          past: s.past.slice(0, -1),
          future: [s.project, ...s.future],
          lastCommit: null,
        })
      }),

    redo: () =>
      set((s) => {
        const next = s.future[0]
        if (!next) return s
        return normalize({
          ...s,
          project: next,
          past: [...s.past, s.project],
          future: s.future.slice(1),
          lastCommit: null,
        })
      }),

    setSaveStatus: (saveStatus, storageError = null) => set({ saveStatus, storageError }),
  }
})

export const selectActiveWorkflow = (s: ProjectStore): Workflow | undefined =>
  s.project.workflows.find((w) => w.id === s.activeWorkflowId)

export const selectActiveUseCase = (s: ProjectStore): UseCase | undefined => {
  const wf = selectActiveWorkflow(s)
  return wf?.useCases.find((u) => u.id === s.activeUseCaseIds[wf.id])
}
