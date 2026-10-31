import type { Workflow, WorkflowEdge, WorkflowNode } from '@/lib/schemas/project'

/** Outgoing routes of a node in explicit priority order (ties keep creation order). */
export function outgoingEdges(workflow: Workflow, nodeId: string): WorkflowEdge[] {
  return workflow.edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => edge.source === nodeId)
    .sort((a, b) => a.edge.priority - b.edge.priority || a.index - b.index)
    .map(({ edge }) => edge)
}

export function incomingEdges(workflow: Workflow, nodeId: string): WorkflowEdge[] {
  return workflow.edges.filter((edge) => edge.target === nodeId)
}

export function findNode(workflow: Workflow, nodeId: string): WorkflowNode | undefined {
  return workflow.nodes.find((node) => node.id === nodeId)
}

/** True when the directed graph contains a cycle (Kahn's algorithm). */
export function hasCycle(workflow: Workflow): boolean {
  const indegree = new Map(workflow.nodes.map((n) => [n.id, 0]))
  for (const e of workflow.edges) indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1)
  const queue = [...indegree].filter(([, d]) => d === 0).map(([id]) => id)
  let visited = 0
  while (queue.length) {
    const id = queue.pop() as string
    visited++
    for (const e of workflow.edges) {
      if (e.source !== id) continue
      const d = (indegree.get(e.target) ?? 0) - 1
      indegree.set(e.target, d)
      if (d === 0) queue.push(e.target)
    }
  }
  return visited !== workflow.nodes.length
}

function reaches(workflow: Workflow, from: string, to: string): boolean {
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length) {
    const id = stack.pop() as string
    if (id === to) return true
    if (seen.has(id)) continue
    seen.add(id)
    for (const e of workflow.edges) if (e.source === id) stack.push(e.target)
  }
  return false
}

export type ConnectionCheck = { ok: true } | { ok: false; reason: string }

export function canConnect(workflow: Workflow, sourceId: string, targetId: string): ConnectionCheck {
  const source = findNode(workflow, sourceId)
  const target = findNode(workflow, targetId)
  if (!source || !target) return { ok: false, reason: 'Unknown node' }
  if (sourceId === targetId) return { ok: false, reason: 'A node cannot connect to itself' }
  if (source.type === 'end') return { ok: false, reason: 'End nodes have no outgoing connections' }
  if (target.type === 'trigger') return { ok: false, reason: 'Triggers have no incoming connections' }
  if (workflow.edges.some((e) => e.source === sourceId && e.target === targetId)) {
    return { ok: false, reason: 'These nodes are already connected' }
  }
  if (source.type !== 'condition' && workflow.edges.some((e) => e.source === sourceId)) {
    return { ok: false, reason: 'Only conditions can have several outgoing routes' }
  }
  if (reaches(workflow, targetId, sourceId)) {
    return { ok: false, reason: 'This connection would create a cycle' }
  }
  return { ok: true }
}
