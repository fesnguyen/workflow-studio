import { AlertTriangle, Info, X } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { Canvas } from '@/components/canvas/canvas'
import { Sidebar } from '@/components/layout/sidebar'
import { PropertiesPanel } from '@/components/panels/properties-panel'
import { Button } from '@/components/ui/button'
import { computeLayout } from '@/lib/layout/auto-layout'
import { selectActiveUseCase, selectActiveWorkflow, useProjectStore } from '@/stores/project-store'
import { useSimulationStore } from '@/stores/simulation-store'
import { useUiStore } from '@/stores/ui-store'
import { useKeyboardShortcuts } from './use-keyboard-shortcuts'

export default function App() {
  const workflowId = useProjectStore((s) => selectActiveWorkflow(s)?.id)
  const useCaseId = useProjectStore((s) => selectActiveUseCase(s)?.id)
  const storageError = useProjectStore((s) => s.storageError)
  const { leftOpen, rightOpen, notice, setNotice } = useUiStore()

  // A simulation belongs to one workflow + use case; switching either returns to editing.
  useEffect(() => {
    useSimulationStore.getState().reset()
  }, [workflowId, useCaseId])

  useEffect(() => {
    if (!notice || notice.kind === 'error') return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice, setNotice])

  const autoLayout = useCallback(() => {
    const workflow = selectActiveWorkflow(useProjectStore.getState())
    if (workflow) void computeLayout(workflow).then((p) => useProjectStore.getState().applyLayout(p))
  }, [])
  useKeyboardShortcuts(autoLayout)

  return (
    <div className="flex h-full w-full bg-background text-foreground">
      {leftOpen && <Sidebar />}
      <main className="relative flex min-w-0 flex-1 flex-col bg-canvas">
        {storageError && (
          <div role="alert" className="flex items-center gap-2 border-b bg-warning/15 px-4 py-2 text-xs">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            {storageError}
          </div>
        )}
        <div className="relative min-h-0 flex-1">
          <Canvas />
        </div>
        {notice && (
          <div
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className="absolute bottom-16 right-4 z-30 flex max-w-sm items-start gap-2 rounded-xl border bg-card p-3 text-sm shadow-soft"
          >
            {notice.kind === 'error' ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-accent" />
            )}
            <span className="min-w-0 flex-1">{notice.message}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </main>
      {rightOpen && <PropertiesPanel />}
    </div>
  )
}
