import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoProject } from '@/lib/demo-project'
import {
  createInitialState,
  selectActiveUseCase,
  selectActiveWorkflow,
  useProjectStore,
} from './project-store'

const store = () => useProjectStore.getState()
const workflow = () => selectActiveWorkflow(store())!

beforeEach(() => {
  useProjectStore.setState(createInitialState(createDemoProject()), false)
})

describe('workflows', () => {
  it('creates, renames and selects a new workflow', () => {
    const before = store().project.workflows.length
    const id = store().addWorkflow()
    expect(store().project.workflows).toHaveLength(before + 1)
    expect(store().activeWorkflowId).toBe(id)
    store().updateWorkflow(id, { name: 'Billing' })
    expect(workflow().name).toBe('Billing')
  })

  it('duplicates a workflow with fresh ids and consistent edges', () => {
    const original = workflow()
    store().duplicateWorkflow(original.id)
    const copy = workflow()
    expect(copy.id).not.toBe(original.id)
    expect(copy.nodes).toHaveLength(original.nodes.length)
    const ids = new Set(copy.nodes.map((n) => n.id))
    expect(original.nodes.some((n) => ids.has(n.id))).toBe(false)
    expect(copy.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true)
  })

  it('deletes a workflow and falls back to another one', () => {
    const [first, second] = store().project.workflows
    store().selectWorkflow(first!.id)
    store().deleteWorkflow(first!.id)
    expect(store().project.workflows.some((w) => w.id === first!.id)).toBe(false)
    expect(store().activeWorkflowId).toBe(second!.id)
  })

  it('keeps data and the active use case when switching workflows', () => {
    const [first, second] = store().project.workflows
    store().selectWorkflow(first!.id)
    store().selectUseCase(first!.useCases[1]!.id)
    const snapshot = JSON.stringify(store().project)
    store().selectWorkflow(second!.id)
    store().selectWorkflow(first!.id)
    expect(JSON.stringify(store().project)).toBe(snapshot)
    expect(selectActiveUseCase(store())!.id).toBe(first!.useCases[1]!.id)
  })
})

describe('use cases', () => {
  it('adds, edits, duplicates and deletes use cases without touching the diagram', () => {
    const nodes = workflow().nodes
    const edges = workflow().edges
    const id = store().addUseCase()!
    store().updateUseCase(id, { name: 'Edge case', inputs: { eventEnabled: false } })
    expect(workflow().useCases.find((u) => u.id === id)?.inputs).toEqual({ eventEnabled: false })
    store().duplicateUseCase(id)
    expect(workflow().useCases.filter((u) => u.name.startsWith('Edge case'))).toHaveLength(2)
    store().deleteUseCase(id)
    expect(workflow().useCases.some((u) => u.id === id)).toBe(false)
    expect(workflow().nodes).toBe(nodes)
    expect(workflow().edges).toBe(edges)
  })
})

describe('nodes and connections', () => {
  it('rejects connections that create a cycle or are duplicates', () => {
    const before = workflow().edges.length
    expect(store().connect('end', 'trigger')).toBeNull()
    expect(workflow().edges).toHaveLength(before)
  })

  it('adds a node and connects it from an action', () => {
    const id = store().addNode('action', { x: 0, y: 0 })!
    expect(workflow().nodes.some((n) => n.id === id)).toBe(true)
    expect(store().connect('play', id)).toBeNull()
  })

  it('deleting a node removes its edges', () => {
    store().deleteElements(['play'], [])
    expect(workflow().nodes.some((n) => n.id === 'play')).toBe(false)
    expect(workflow().edges.some((e) => e.source === 'play' || e.target === 'play')).toBe(false)
  })
})

describe('undo / redo', () => {
  it('undoes and redoes an edit', () => {
    const name = workflow().name
    store().updateWorkflow(workflow().id, { name: 'Changed' })
    store().undo()
    expect(workflow().name).toBe(name)
    store().redo()
    expect(workflow().name).toBe('Changed')
  })
})
