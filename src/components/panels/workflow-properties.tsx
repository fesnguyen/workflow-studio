import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/fields'
import type { UseCase, Workflow } from '@/lib/schemas/project'
import { useProjectStore } from '@/stores/project-store'
import { ValueInput } from './value-input'

export function WorkflowProperties({ workflow }: { workflow: Workflow }) {
  const update = useProjectStore((s) => s.updateWorkflow)
  return (
    <div className="space-y-4">
      <Field label="Name" htmlFor="wf-name">
        <Input
          id="wf-name"
          value={workflow.name}
          onChange={(e) => update(workflow.id, { name: e.target.value })}
        />
      </Field>
      <Field label="Description" htmlFor="wf-desc">
        <Textarea
          id="wf-desc"
          value={workflow.description}
          placeholder="What does this workflow do?"
          onChange={(e) => update(workflow.id, { description: e.target.value })}
        />
      </Field>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Nodes', workflow.nodes.length],
          ['Connections', workflow.edges.length],
          ['Use cases', workflow.useCases.length],
        ].map(([label, count]) => (
          <div key={label} className="rounded-lg bg-muted px-2 py-2">
            <dd className="text-base font-semibold">{count}</dd>
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function UseCaseProperties({ useCase }: { useCase: UseCase }) {
  const update = useProjectStore((s) => s.updateUseCase)
  const entries = Object.entries(useCase.inputs)

  const setInputs = (next: [string, UseCase['inputs'][string]][]) =>
    update(useCase.id, { inputs: Object.fromEntries(next) })

  return (
    <div className="space-y-4">
      <Field label="Name" htmlFor="uc-name">
        <Input
          id="uc-name"
          value={useCase.name}
          onChange={(e) => update(useCase.id, { name: e.target.value })}
        />
      </Field>
      <Field label="Description" htmlFor="uc-desc">
        <Textarea
          id="uc-desc"
          value={useCase.description}
          placeholder="Which scenario does this represent?"
          onChange={(e) => update(useCase.id, { description: e.target.value })}
        />
      </Field>
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-xs font-medium text-muted-foreground">Input variables</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              let n = entries.length + 1
              while (Object.hasOwn(useCase.inputs, `variable${n}`)) n++
              setInputs([...entries, [`variable${n}`, true]])
            }}
          >
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
        {entries.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Conditions read their values from these inputs. Add a variable such as <code>audioAvailable</code>{' '}
            = true.
          </p>
        )}
        <ul className="space-y-1.5">
          {entries.map(([name, value], index) => (
            <li key={index} className="flex items-center gap-1.5">
              <Input
                aria-label={`Variable ${index + 1} name`}
                value={name}
                className="font-mono text-xs"
                onChange={(e) => {
                  const next = e.target.value
                  if (next !== name && Object.hasOwn(useCase.inputs, next)) return
                  setInputs(entries.map((entry, i) => (i === index ? [next, value] : entry)))
                }}
              />
              <ValueInput
                aria-label={`Variable ${index + 1} value`}
                value={value}
                className="font-mono text-xs"
                onChange={(v) => setInputs(entries.map((entry, i) => (i === index ? [name, v] : entry)))}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove variable ${name}`}
                onClick={() => setInputs(entries.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Values: true, false, a number, or text.</p>
      </section>
      <Field label="Notes" htmlFor="uc-notes">
        <Textarea
          id="uc-notes"
          value={useCase.notes}
          onChange={(e) => update(useCase.id, { notes: e.target.value })}
        />
      </Field>
    </div>
  )
}
