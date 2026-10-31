import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { AlertTriangle, Check, FileText, Link2 } from 'lucide-react'
import type { WorkflowNode } from '@/lib/schemas/project'
import type { NodeVisualState } from '@/lib/workflow-engine/simulation'
import { cn } from '@/lib/utils'
import { NODE_META } from './node-meta'

export interface FlowNodeData extends Record<string, unknown> {
  node: WorkflowNode
  state: NodeVisualState
  hasIssue: boolean
}
export type FlowNodeType = Node<FlowNodeData, 'flow'>

const STATE_STYLES: Record<NodeVisualState, string> = {
  idle: 'border-border',
  active: 'node-active border-accent ring-2 ring-accent/50 bg-accent-soft',
  completed: 'border-success/60',
  skipped: 'opacity-40',
  error: 'border-danger ring-2 ring-danger/40',
}

export function FlowNode({ data, selected }: NodeProps<FlowNodeType>) {
  const { node, state, hasIssue } = data
  const meta = NODE_META[node.type]
  const Icon = meta.icon

  return (
    <div
      data-testid={`node-${node.id}`}
      data-state={state}
      className={cn(
        'relative h-[84px] w-[220px] overflow-hidden rounded-xl border bg-card px-3 py-2.5 shadow-soft transition-[opacity,box-shadow,border-color] duration-300',
        STATE_STYLES[state],
        selected && state === 'idle' && 'border-accent ring-2 ring-accent/30',
      )}
    >
      {node.type !== 'trigger' && <Handle type="target" position={Position.Left} />}
      <div className="flex items-center gap-1.5">
        <span className={cn('flex size-5 items-center justify-center rounded-md', meta.bg, meta.text)}>
          <Icon className="size-3" strokeWidth={2.5} />
        </span>
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', meta.text)}>
          {meta.label}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
          {node.notes && <FileText className="size-3" aria-label="Has notes" />}
          {node.links.length > 0 && <Link2 className="size-3" aria-label="Has links" />}
          {hasIssue && state === 'idle' && (
            <AlertTriangle className="size-3.5 text-warning" aria-label="Has issues" />
          )}
          {state === 'completed' && <Check className="size-3.5 text-success" aria-label="Completed" />}
          {state === 'error' && <AlertTriangle className="size-3.5 text-danger" aria-label="Error" />}
        </span>
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold leading-tight">{node.title || 'Untitled'}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{node.description || meta.hint}</div>
      {node.type !== 'end' && <Handle type="source" position={Position.Right} />}
    </div>
  )
}
