import type { InputValue, UseCase, Workflow, WorkflowEdge } from '@/lib/schemas/project'
import { describeCondition, evaluateCondition } from './conditions'
import { findNode, outgoingEdges } from './graph'
import { validateWorkflow } from './validate'

export interface LogEntry {
  level: 'info' | 'success' | 'error'
  message: string
  details?: string[]
  nodeId?: string
  edgeId?: string
}

export interface SimulationState {
  status: 'active' | 'completed' | 'error'
  currentNodeId: string | null
  errorNodeId: string | null
  completedNodeIds: string[]
  traversedEdgeIds: string[]
  /** The connection the simulation just travelled along to reach the current node. */
  activeEdgeId: string | null
  log: LogEntry[]
}

export type NodeVisualState = 'idle' | 'active' | 'completed' | 'skipped' | 'error'
export type EdgeVisualState = 'idle' | 'active' | 'completed' | 'skipped'

export const isFinished = (sim: SimulationState | null) => sim !== null && sim.status !== 'active'

type RouteResult =
  { ok: true; edge: WorkflowEdge; details: string[] } | { ok: false; error: string; details: string[] }

function selectRoute(workflow: Workflow, nodeId: string, inputs: Record<string, InputValue>): RouteResult {
  const node = findNode(workflow, nodeId)
  const routes = outgoingEdges(workflow, nodeId)
  const details: string[] = []
  if (!node) return { ok: false, error: 'Node not found', details }
  if (routes.length === 0) return { ok: false, error: `"${node.title}" has no outgoing connection`, details }
  if (node.type !== 'condition') return { ok: true, edge: routes[0] as WorkflowEdge, details }

  for (const route of routes.filter((r) => !r.fallback)) {
    if (!route.condition) return { ok: false, error: 'A route has no condition', details }
    const result = evaluateCondition(route.condition, inputs)
    if (!result.ok) return { ok: false, error: result.error, details }
    const text = describeCondition(route.condition)
    details.push(`${text} → ${result.matched ? 'matched' : 'no match'} (value: ${String(result.actual)})`)
    if (result.matched) return { ok: true, edge: route, details }
  }
  const fallback = routes.find((r) => r.fallback)
  if (fallback) {
    details.push('No condition matched → using fallback route')
    return { ok: true, edge: fallback, details }
  }
  return { ok: false, error: `No route matched at "${node.title}" and it has no fallback`, details }
}

export function startSimulation(workflow: Workflow, useCase: UseCase): SimulationState {
  const issues = validateWorkflow(workflow).filter((i) => i.level === 'error')
  if (issues.length > 0) {
    return {
      status: 'error',
      currentNodeId: null,
      errorNodeId: issues.find((i) => i.nodeId)?.nodeId ?? null,
      completedNodeIds: [],
      traversedEdgeIds: [],
      activeEdgeId: null,
      log: issues.map((i) => ({ level: 'error', message: i.message, nodeId: i.nodeId })),
    }
  }
  const trigger = workflow.nodes.find((n) => n.type === 'trigger')!
  return {
    status: 'active',
    currentNodeId: trigger.id,
    errorNodeId: null,
    completedNodeIds: [],
    traversedEdgeIds: [],
    activeEdgeId: null,
    log: [
      {
        level: 'info',
        message: `Started "${useCase.name}" at "${trigger.title}"`,
        nodeId: trigger.id,
      },
    ],
  }
}

/** Advances the simulation by exactly one node. Pure: returns a new state. */
export function stepSimulation(workflow: Workflow, useCase: UseCase, sim: SimulationState): SimulationState {
  if (sim.status !== 'active' || sim.currentNodeId === null) return sim
  const node = findNode(workflow, sim.currentNodeId)
  if (!node) {
    return fail(sim, sim.currentNodeId, 'The current node no longer exists')
  }

  if (node.type === 'end') {
    return {
      ...sim,
      status: 'completed',
      currentNodeId: null,
      activeEdgeId: null,
      completedNodeIds: [...sim.completedNodeIds, node.id],
      log: [...sim.log, { level: 'success', message: `Completed at "${node.title}"`, nodeId: node.id }],
    }
  }

  // Defensive guard: validation rejects cycles, so this can only trip on corrupted state.
  if (sim.completedNodeIds.length > workflow.nodes.length) {
    return fail(sim, node.id, 'Execution exceeded the number of nodes; stopping')
  }

  const route = selectRoute(workflow, node.id, useCase.inputs)
  if (!route.ok) return fail(sim, node.id, route.error, route.details)

  const next = findNode(workflow, route.edge.target)
  return {
    ...sim,
    currentNodeId: route.edge.target,
    activeEdgeId: route.edge.id,
    completedNodeIds: [...sim.completedNodeIds, node.id],
    traversedEdgeIds: [...sim.traversedEdgeIds, route.edge.id],
    log: [
      ...sim.log,
      {
        level: 'info',
        message: `"${node.title}" → "${next?.title ?? '?'}"`,
        details: route.details,
        nodeId: node.id,
        edgeId: route.edge.id,
      },
    ],
  }
}

function fail(sim: SimulationState, nodeId: string, message: string, details?: string[]): SimulationState {
  return {
    ...sim,
    status: 'error',
    currentNodeId: null,
    activeEdgeId: null,
    errorNodeId: nodeId,
    log: [...sim.log, { level: 'error', message, details, nodeId }],
  }
}

/** Runs a simulation to completion (used by tests and non-visual callers). */
export function runSimulation(workflow: Workflow, useCase: UseCase): SimulationState {
  let sim = startSimulation(workflow, useCase)
  for (let i = 0; i < workflow.nodes.length + 2 && sim.status === 'active'; i++) {
    sim = stepSimulation(workflow, useCase, sim)
  }
  return sim
}

export function nodeVisualState(sim: SimulationState | null, nodeId: string): NodeVisualState {
  if (!sim) return 'idle'
  if (sim.errorNodeId === nodeId) return 'error'
  if (sim.currentNodeId === nodeId) return 'active'
  if (sim.completedNodeIds.includes(nodeId)) return 'completed'
  return 'skipped'
}

export function edgeVisualState(sim: SimulationState | null, edgeId: string): EdgeVisualState {
  if (!sim) return 'idle'
  if (sim.activeEdgeId === edgeId) return 'active'
  if (sim.traversedEdgeIds.includes(edgeId)) return 'completed'
  return 'skipped'
}
