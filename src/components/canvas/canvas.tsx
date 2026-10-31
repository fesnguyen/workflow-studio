import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeChange,
} from '@xyflow/react'
import { Plus, Workflow as WorkflowIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { FlowNode, type FlowNodeType } from '@/components/nodes/flow-node'
import { ExecutionLog } from '@/components/simulation/execution-log'
import { NODE_HEIGHT, NODE_WIDTH } from '@/lib/layout/auto-layout'
import { cn } from '@/lib/utils'
import { describeCondition } from '@/lib/workflow-engine/conditions'
import { canConnect } from '@/lib/workflow-engine/graph'
import { edgeVisualState, nodeVisualState } from '@/lib/workflow-engine/simulation'
import { validateWorkflow } from '@/lib/workflow-engine/validate'
import { selectActiveWorkflow, useProjectStore } from '@/stores/project-store'
import { useSimulationStore } from '@/stores/simulation-store'
import { useUiStore } from '@/stores/ui-store'
import { EditToolbar, SimulationToolbar } from './toolbars'

const nodeTypes = { flow: FlowNode }

const PALETTE = {
  light: { idle: '#9aa1b0', active: '#5b5bd6', done: '#22a06b', selected: '#5b5bd6' },
  dark: { idle: '#6b7280', active: '#9a9bf2', done: '#4ade80', selected: '#9a9bf2' },
}

function CanvasInner() {
  const workflow = useProjectStore(selectActiveWorkflow)
  const selection = useProjectStore((s) => s.selection)
  const viewVersion = useProjectStore((s) => s.viewVersion)
  const { moveNodes, checkpoint, connect, select, deleteElements, addWorkflow } = useProjectStore.getState()
  const sim = useSimulationStore((s) => s.sim)
  const theme = useUiStore((s) => s.theme)
  const rf = useReactFlow()
  const containerRef = useRef<HTMLDivElement>(null)
  const locked = sim !== null

  useEffect(() => {
    const timer = setTimeout(() => void rf.fitView({ padding: 0.08, maxZoom: 1, duration: 250 }), 60)
    return () => clearTimeout(timer)
  }, [rf, viewVersion, workflow?.id])

  const issues = useMemo(() => (workflow ? validateWorkflow(workflow) : []), [workflow])

  const nodes = useMemo<FlowNodeType[]>(
    () =>
      (workflow?.nodes ?? []).map((node) => ({
        id: node.id,
        type: 'flow',
        position: node.position,
        data: {
          node,
          state: nodeVisualState(sim, node.id),
          hasIssue: issues.some((i) => i.nodeId === node.id),
        },
        selected: selection?.kind === 'node' && selection.id === node.id,
        draggable: !locked,
        connectable: !locked,
        deletable: !locked,
      })),
    [workflow?.nodes, sim, issues, selection, locked],
  )

  const edges = useMemo<Edge[]>(() => {
    const colors = PALETTE[theme]
    return (workflow?.edges ?? []).map((edge) => {
      const state = edgeVisualState(sim, edge.id)
      const isSelected = selection?.kind === 'edge' && selection.id === edge.id
      const color =
        state === 'active'
          ? colors.active
          : state === 'completed'
            ? colors.done
            : isSelected
              ? colors.selected
              : colors.idle
      const label =
        edge.label ??
        (edge.fallback
          ? 'else'
          : edge.condition
            ? edge.condition.variable
              ? describeCondition(edge.condition)
              : 'set condition'
            : undefined)
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        label,
        animated: state === 'active',
        selected: isSelected,
        deletable: !locked,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
        style: {
          stroke: color,
          strokeWidth: state === 'active' || isSelected ? 2.5 : 1.75,
          opacity: state === 'skipped' ? 0.25 : 1,
        },
        labelStyle: { opacity: state === 'skipped' ? 0.4 : 1 },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 6,
      } satisfies Edge
    })
  }, [workflow?.edges, sim, selection, theme, locked])

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNodeType>[]) => {
      const positions: Record<string, { x: number; y: number }> = {}
      for (const change of changes) {
        if (change.type === 'position' && change.position) positions[change.id] = change.position
      }
      if (Object.keys(positions).length > 0) moveNodes(positions)
    },
    [moveNodes],
  )

  if (!workflow) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <WorkflowIcon className="size-6" />
        </div>
        <h2 className="text-base font-semibold">No workflows yet</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Create a workflow to start designing and simulating.
        </p>
        <Button onClick={() => addWorkflow()}>
          <Plus className="size-4" /> New workflow
        </Button>
      </div>
    )
  }

  const addNodePosition = () => {
    const rect = containerRef.current?.getBoundingClientRect()
    const center = rf.screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
    })
    const jitter = (workflow.nodes.length % 5) * 24
    return {
      x: Math.round(center.x - NODE_WIDTH / 2 + jitter),
      y: Math.round(center.y - NODE_HEIGHT / 2 + jitter),
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full', locked && 'ring-2 ring-inset ring-accent/40')}
      data-mode={locked ? 'simulation' : 'editing'}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={theme}
        onNodesChange={onNodesChange}
        onNodeDragStart={() => checkpoint('drag')}
        onConnect={(c) => connect(c.source, c.target)}
        isValidConnection={(c) => canConnect(workflow, c.source, c.target).ok}
        onNodeClick={(_, node) => select({ kind: 'node', id: node.id })}
        onEdgeClick={(_, edge) => select({ kind: 'edge', id: edge.id })}
        onPaneClick={() => select(null)}
        onDelete={({ nodes: n, edges: e }) =>
          deleteElements(
            n.map((x) => x.id),
            e.map((x) => x.id),
          )
        }
        nodesConnectable={!locked}
        elementsSelectable
        minZoom={0.2}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} color="var(--canvas-dot)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>

      {workflow.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg border border-dashed bg-card/80 px-4 py-3 text-sm text-muted-foreground">
            Empty workflow — use <b>Add node</b> to place your first node.
          </p>
        </div>
      )}

      <EditToolbar locked={locked} workflow={workflow} getAddPosition={addNodePosition} />
      <SimulationToolbar />
      <ExecutionLog issues={issues} />
    </div>
  )
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
