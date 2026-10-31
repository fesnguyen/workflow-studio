import { useEffect } from 'react'
import { useProjectStore } from '@/stores/project-store'
import { useSimulationStore } from '@/stores/simulation-store'
import { selectActiveUseCase, selectActiveWorkflow } from '@/stores/project-store'
import { NO_USE_CASE } from '@/stores/simulation-store'

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/** Global shortcuts: undo/redo, run/pause (R), step (S), reset (Esc), auto layout is handled by the toolbar. */
export function useKeyboardShortcuts(onAutoLayout: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const project = useProjectStore.getState()
      const simulation = useSimulationStore.getState()
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (mod && (key === 'z' || key === 'y') && !isTyping(event.target)) {
        event.preventDefault()
        if (simulation.sim) return
        if (key === 'y' || event.shiftKey) project.redo()
        else project.undo()
        return
      }
      if (mod || event.altKey || isTyping(event.target)) return

      const workflow = selectActiveWorkflow(project)
      const useCase = selectActiveUseCase(project) ?? NO_USE_CASE
      if (key === 'escape') {
        if (simulation.sim) simulation.reset()
        else project.select(null)
      } else if (!workflow) {
        return
      } else if (key === 'r') {
        if (simulation.playing) simulation.pause()
        else simulation.run(workflow, useCase)
      } else if (key === 's') {
        simulation.step(workflow, useCase)
      } else if (key === 'l' && !simulation.sim) {
        onAutoLayout()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onAutoLayout])
}
