import type { Workflow } from '@/lib/schemas/project'
import { outgoingEdges } from '@/lib/workflow-engine/graph'

export const NODE_WIDTH = 220
export const NODE_HEIGHT = 84

// ELK is large, so it is loaded on first use only.
const loadElk = () => import('elkjs/lib/elk.bundled.js').then(({ default: ELK }) => new ELK())

/**
 * Computes left-to-right layered positions. Branches of a condition are spread
 * vertically, in route-priority order. Pure with respect to the workflow.
 */
export async function computeLayout(workflow: Workflow): Promise<Record<string, { x: number; y: number }>> {
  const edges = workflow.nodes.flatMap((n) => outgoingEdges(workflow, n.id))
  const graph = await (
    await loadElk()
  ).layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    },
    children: workflow.nodes.map((n) => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  })
  const positions: Record<string, { x: number; y: number }> = {}
  for (const child of graph.children ?? []) {
    positions[child.id] = { x: Math.round(child.x ?? 0), y: Math.round(child.y ?? 0) }
  }
  return positions
}
