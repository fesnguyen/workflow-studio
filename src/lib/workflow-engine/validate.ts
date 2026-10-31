import type { Workflow } from '@/lib/schemas/project'
import { hasCycle, incomingEdges, outgoingEdges } from './graph'

export interface ValidationIssue {
  level: 'error' | 'warning'
  message: string
  nodeId?: string
  edgeId?: string
}

/** Structural validation of a workflow. Errors block simulation. */
export function validateWorkflow(workflow: Workflow): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const error = (message: string, nodeId?: string, edgeId?: string) =>
    issues.push({ level: 'error', message, nodeId, edgeId })
  const warn = (message: string, nodeId?: string) => issues.push({ level: 'warning', message, nodeId })

  const triggers = workflow.nodes.filter((n) => n.type === 'trigger')
  if (triggers.length === 0) error('Add a Trigger node to start the workflow')
  if (triggers.length > 1) error('A workflow must have exactly one Trigger')
  if (!workflow.nodes.some((n) => n.type === 'end')) error('Add an End node to complete the workflow')
  if (hasCycle(workflow)) error('The workflow contains a cycle, which is not supported yet')

  for (const node of workflow.nodes) {
    const outgoing = outgoingEdges(workflow, node.id)
    const incoming = incomingEdges(workflow, node.id)
    if (node.type !== 'trigger' && incoming.length === 0) {
      warn(`"${node.title}" has no incoming connection`, node.id)
    }
    if (node.type !== 'end' && outgoing.length === 0) {
      error(`"${node.title}" has no outgoing connection`, node.id)
    }
    if (node.type !== 'condition' && outgoing.length > 1) {
      error(`"${node.title}" has several outgoing routes; only conditions can branch`, node.id)
    }
    if (node.type === 'condition') {
      const fallbacks = outgoing.filter((e) => e.fallback)
      if (fallbacks.length > 1) error(`"${node.title}" has more than one fallback route`, node.id)
      for (const edge of outgoing) {
        if (!edge.fallback && !edge.condition?.variable.trim()) {
          error(`A route from "${node.title}" has no condition`, node.id, edge.id)
        }
      }
    }
  }
  return issues
}
