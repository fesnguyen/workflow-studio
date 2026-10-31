import { MousePointerClick, PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { selectActiveWorkflow, useProjectStore } from '@/stores/project-store'
import { useSimulationStore } from '@/stores/simulation-store'
import { useUiStore } from '@/stores/ui-store'
import { EdgeProperties, NodeProperties } from './node-properties'
import { UseCaseProperties, WorkflowProperties } from './workflow-properties'

const TITLES = { workflow: 'Workflow', useCase: 'Use case', node: 'Node', edge: 'Connection' } as const

export function PropertiesPanel() {
  const workflow = useProjectStore(selectActiveWorkflow)
  const selection = useProjectStore((s) => s.selection)
  const locked = useSimulationStore((s) => s.sim !== null)
  const setRightOpen = useUiStore((s) => s.setRightOpen)

  const node = selection?.kind === 'node' ? workflow?.nodes.find((n) => n.id === selection.id) : undefined
  const edge = selection?.kind === 'edge' ? workflow?.edges.find((e) => e.id === selection.id) : undefined
  const useCase =
    selection?.kind === 'useCase' ? workflow?.useCases.find((u) => u.id === selection.id) : undefined

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l bg-card" aria-label="Properties">
      <div className="flex h-[53px] items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">
          {selection ? TITLES[selection.kind] : 'Properties'}{' '}
          {selection && <span className="font-normal text-muted-foreground">properties</span>}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setRightOpen(false)}
          aria-label="Collapse properties"
          title="Collapse"
        >
          <PanelRightClose className="size-4" />
        </Button>
      </div>
      {locked && (
        <p className="border-b bg-accent-soft px-4 py-2 text-xs text-accent">
          Simulation mode — reset to edit.
        </p>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
          {workflow && selection?.kind === 'workflow' && <WorkflowProperties workflow={workflow} />}
          {workflow && useCase && <UseCaseProperties useCase={useCase} />}
          {workflow && node && <NodeProperties node={node} workflow={workflow} />}
          {workflow && edge && <EdgeProperties edge={edge} workflow={workflow} />}
        </fieldset>
        {!(workflow && (selection?.kind === 'workflow' || node || edge || useCase)) && (
          <div className="flex h-full min-h-60 flex-col items-center justify-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <MousePointerClick className="size-5" />
            </div>
            <p className="text-sm font-medium">Nothing selected</p>
            <p className="max-w-[210px] text-xs text-muted-foreground">
              Select a node or connection on the canvas, or a workflow or use case in the sidebar, to edit it
              here.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
