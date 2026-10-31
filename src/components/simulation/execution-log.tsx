import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { ValidationIssue } from '@/lib/workflow-engine/validate'
import { selectActiveUseCase, useProjectStore } from '@/stores/project-store'
import { useSimulationStore } from '@/stores/simulation-store'
import { useUiStore } from '@/stores/ui-store'

const LEVEL_ICON = { info: Info, success: CheckCircle2, error: XCircle } as const
const LEVEL_COLOR = { info: 'text-accent', success: 'text-success', error: 'text-danger' } as const

export function ExecutionLog({ issues }: { issues: ValidationIssue[] }) {
  const sim = useSimulationStore((s) => s.sim)
  const playing = useSimulationStore((s) => s.playing)
  const useCase = useProjectStore(selectActiveUseCase)
  const open = useUiStore((s) => s.logOpen)
  const setOpen = useUiStore((s) => s.setLogOpen)
  const endRef = useRef<HTMLDivElement>(null)
  const errors = issues.filter((i) => i.level === 'error').length
  const expanded = open && (sim !== null || issues.length > 0)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [sim?.log.length])

  const status = !sim
    ? errors > 0
      ? { text: `${errors} issue${errors > 1 ? 's' : ''} to fix before running`, tone: 'text-warning' }
      : { text: `Ready — run "${useCase?.name ?? 'workflow'}" to simulate`, tone: 'text-muted-foreground' }
    : sim.status === 'completed'
      ? { text: 'Completed', tone: 'text-success' }
      : sim.status === 'error'
        ? { text: 'Stopped with an error', tone: 'text-danger' }
        : { text: playing ? 'Running…' : 'Paused', tone: 'text-accent' }

  return (
    <section
      aria-label="Execution log"
      className="absolute bottom-3 left-1/2 z-10 w-[min(560px,calc(100%-7rem))] -translate-x-1/2 overflow-hidden rounded-xl border bg-card/95 shadow-soft backdrop-blur"
    >
      <button
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs"
        onClick={() => setOpen(!open)}
        aria-expanded={expanded}
      >
        <span className="font-semibold">Execution log</span>
        <span className={cn('truncate', status.tone)} data-testid="sim-status">
          {status.text}
        </span>
        {(sim !== null || issues.length > 0) &&
          (open ? <ChevronDown className="ml-auto size-3.5" /> : <ChevronUp className="ml-auto size-3.5" />)}
      </button>
      {expanded && (
        <div className="max-h-44 space-y-1.5 overflow-y-auto border-t px-3 py-2" data-testid="log-entries">
          {sim
            ? sim.log.map((entry, i) => {
                const Icon = LEVEL_ICON[entry.level]
                return (
                  <div key={i} className="flex gap-2 text-xs">
                    <Icon className={cn('mt-0.5 size-3.5 shrink-0', LEVEL_COLOR[entry.level])} />
                    <div className="min-w-0">
                      <div className="font-medium">{entry.message}</div>
                      {entry.details?.map((d, j) => (
                        <div key={j} className="font-mono text-[11px] text-muted-foreground">
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            : issues.map((issue, i) => (
                <button
                  key={i}
                  className="flex w-full cursor-pointer items-start gap-2 text-left text-xs hover:opacity-80"
                  onClick={() =>
                    issue.nodeId && useProjectStore.getState().select({ kind: 'node', id: issue.nodeId })
                  }
                >
                  <AlertTriangle
                    className={cn(
                      'mt-0.5 size-3.5 shrink-0',
                      issue.level === 'error' ? 'text-danger' : 'text-warning',
                    )}
                  />
                  <span>{issue.message}</span>
                </button>
              ))}
          <div ref={endRef} />
        </div>
      )}
    </section>
  )
}
