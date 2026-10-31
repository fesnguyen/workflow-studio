import type { StoreApi } from 'zustand'
import { saveProject } from '@/lib/storage/project-storage'
import type { ProjectStore } from './project-store'

/**
 * Persists the project to localStorage whenever it changes (debounced).
 * Returns a cleanup function. Pending changes are flushed on page hide.
 */
export function startAutosave(store: StoreApi<ProjectStore>, delay = 500): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending = false

  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    if (!pending) return
    pending = false
    const result = saveProject(store.getState().project)
    store.getState().setSaveStatus(result.ok ? 'saved' : 'error', result.ok ? null : result.error)
  }

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.project === previous.project) return
    pending = true
    if (state.saveStatus !== 'saving') state.setSaveStatus('saving', state.storageError)
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, delay)
  })

  const onHide = () => flush()
  window.addEventListener('pagehide', onHide)

  return () => {
    unsubscribe()
    window.removeEventListener('pagehide', onHide)
    if (timer) clearTimeout(timer)
  }
}
