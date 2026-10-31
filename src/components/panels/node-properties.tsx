import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { NODE_META } from '@/components/nodes/node-meta'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/fields'
import type { Condition, Operator, Workflow, WorkflowEdge, WorkflowNode } from '@/lib/schemas/project'
import { cn, isSafeUrl } from '@/lib/utils'
import { describeCondition, needsValue, OPERATOR_LABELS } from '@/lib/workflow-engine/conditions'
import { outgoingEdges } from '@/lib/workflow-engine/graph'
import { useProjectStore } from '@/stores/project-store'
import { ValueInput } from './value-input'

function TypeBadge({ node }: { node: WorkflowNode }) {
  const meta = NODE_META[node.type]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        meta.bg,
        meta.text,
      )}
    >
      <meta.icon className="size-3.5" /> {meta.label}
    </span>
  )
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" className="w-full text-danger hover:text-danger" onClick={onClick}>
      <Trash2 className="size-4" /> {label}
    </Button>
  )
}

export function NodeProperties({ node, workflow }: { node: WorkflowNode; workflow: Workflow }) {
  const update = useProjectStore((s) => s.updateNode)
  const select = useProjectStore((s) => s.select)
  const patch = (p: Partial<WorkflowNode>) => update(node.id, p)
  const routes = node.type === 'condition' ? outgoingEdges(workflow, node.id) : []
  const titleOf = (id: string) => workflow.nodes.find((n) => n.id === id)?.title ?? '?'

  return (
    <div className="space-y-4">
      <TypeBadge node={node} />
      <Field label="Title" htmlFor="node-title">
        <Input id="node-title" value={node.title} onChange={(e) => patch({ title: e.target.value })} />
      </Field>
      <Field label="Description" htmlFor="node-desc">
        <Textarea
          id="node-desc"
          value={node.description}
          placeholder="Short summary shown on the canvas"
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>
      <Field label="Notes" htmlFor="node-notes">
        <Textarea
          id="node-notes"
          value={node.notes}
          className="min-h-24"
          placeholder="Details, edge cases, decisions…"
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </Field>

      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-xs font-medium text-muted-foreground">Reference links</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => patch({ links: [...node.links, { label: '', url: '' }] })}
          >
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
        <ul className="space-y-1.5">
          {node.links.map((link, i) => (
            <li key={i} className="space-y-1 rounded-lg border p-1.5">
              <div className="flex items-center gap-1">
                <Input
                  aria-label={`Link ${i + 1} label`}
                  placeholder="Label"
                  value={link.label}
                  onChange={(e) =>
                    patch({
                      links: node.links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove link ${i + 1}`}
                  onClick={() => patch({ links: node.links.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  aria-label={`Link ${i + 1} URL`}
                  placeholder="https://…"
                  value={link.url}
                  onChange={(e) =>
                    patch({ links: node.links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)) })
                  }
                />
                {isSafeUrl(link.url) && (
                  <a
                    href={link.url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${link.label || 'link'}`}
                    className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
              {link.url.trim() !== '' && !isSafeUrl(link.url) && (
                <p className="px-1 text-[11px] text-warning">
                  Links must start with http://, https:// or mailto:
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {node.type === 'condition' && (
        <section>
          <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Routes, in priority order</h3>
          {routes.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Drag from this node’s right handle to another node to create a route.
            </p>
          ) : (
            <ol className="space-y-1">
              {routes.map((edge, i) => (
                <li key={edge.id} className="flex items-center gap-1 rounded-lg border px-1.5 py-1">
                  <button
                    className="min-w-0 flex-1 cursor-pointer text-left text-xs"
                    onClick={() => select({ kind: 'edge', id: edge.id })}
                  >
                    <span className="font-medium">
                      {edge.fallback
                        ? 'else'
                        : edge.condition?.variable
                          ? describeCondition(edge.condition)
                          : 'set condition'}
                    </span>
                    <span className="text-muted-foreground"> → {titleOf(edge.target)}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    aria-label="Move route up"
                    onClick={() => useProjectStore.getState().moveRoute(edge.id, -1)}
                  >
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === routes.length - 1}
                    aria-label="Move route down"
                    onClick={() => useProjectStore.getState().moveRoute(edge.id, 1)}
                  >
                    <ArrowDown className="size-3" />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <DeleteButton
        label="Delete node"
        onClick={() => useProjectStore.getState().deleteElements([node.id], [])}
      />
    </div>
  )
}

export function EdgeProperties({ edge, workflow }: { edge: WorkflowEdge; workflow: Workflow }) {
  const update = useProjectStore((s) => s.updateEdge)
  const source = workflow.nodes.find((n) => n.id === edge.source)
  const target = workflow.nodes.find((n) => n.id === edge.target)
  const isRoute = source?.type === 'condition'
  const condition: Condition = edge.condition ?? { variable: '', operator: 'equals', value: true }
  const variables = [...new Set(workflow.useCases.flatMap((u) => Object.keys(u.inputs)))]
  const setCondition = (p: Partial<Condition>) => update(edge.id, { condition: { ...condition, ...p } })

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-muted px-2.5 py-2 text-xs">
        <span className="font-medium">{source?.title}</span> <span className="text-muted-foreground">→</span>{' '}
        <span className="font-medium">{target?.title}</span>
      </p>

      {isRoute && (
        <>
          <Field label="Route type" htmlFor="edge-kind">
            <Select
              id="edge-kind"
              value={edge.fallback ? 'fallback' : 'condition'}
              onChange={(e) =>
                e.target.value === 'fallback'
                  ? update(edge.id, { fallback: true, condition: undefined })
                  : update(edge.id, { fallback: false, condition: condition })
              }
            >
              <option value="condition">When a condition matches</option>
              <option value="fallback">Fallback (else)</option>
            </Select>
          </Field>
          {!edge.fallback && (
            <div className="space-y-2.5 rounded-lg border p-2.5">
              <Field label="Variable" htmlFor="edge-var">
                <Input
                  id="edge-var"
                  list="known-variables"
                  placeholder="e.g. audioAvailable"
                  className="font-mono text-xs"
                  value={condition.variable}
                  onChange={(e) => setCondition({ variable: e.target.value })}
                />
                <datalist id="known-variables">
                  {variables.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </Field>
              <Field label="Operator" htmlFor="edge-op">
                <Select
                  id="edge-op"
                  value={condition.operator}
                  onChange={(e) => setCondition({ operator: e.target.value as Operator })}
                >
                  {(Object.keys(OPERATOR_LABELS) as Operator[]).map((op) => (
                    <option key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </option>
                  ))}
                </Select>
              </Field>
              {needsValue(condition.operator) && (
                <Field label="Value" htmlFor="edge-value">
                  <ValueInput
                    id="edge-value"
                    className="font-mono text-xs"
                    value={condition.value}
                    onChange={(value) => setCondition({ value })}
                  />
                </Field>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Routes are checked in priority order; the first match wins. Reorder them from the condition node.
          </p>
        </>
      )}

      <Field label="Label override" htmlFor="edge-label">
        <Input
          id="edge-label"
          placeholder={isRoute ? 'Defaults to the condition' : 'Optional'}
          value={edge.label ?? ''}
          onChange={(e) => update(edge.id, { label: e.target.value || undefined })}
        />
      </Field>

      <DeleteButton
        label="Delete connection"
        onClick={() => useProjectStore.getState().deleteElements([], [edge.id])}
      />
    </div>
  )
}
