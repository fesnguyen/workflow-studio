import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoProject } from '@/lib/demo-project'
import { STORAGE_KEY } from '@/lib/storage/project-storage'
import { startAutosave } from './autosave'
import { createInitialState, useProjectStore } from './project-store'

beforeEach(() => {
  vi.useFakeTimers()
  useProjectStore.setState(createInitialState(createDemoProject()), false)
})
afterEach(() => vi.useRealTimers())

describe('autosave', () => {
  it('debounces writes and reports status', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const stop = startAutosave(useProjectStore, 500)
    const { updateProjectMeta } = useProjectStore.getState()
    updateProjectMeta({ name: 'A' })
    updateProjectMeta({ name: 'AB' })
    expect(setItem).not.toHaveBeenCalled()
    expect(useProjectStore.getState().saveStatus).toBe('saving')
    vi.advanceTimersByTime(500)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(useProjectStore.getState().saveStatus).toBe('saved')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).project.name).toBe('AB')
    stop()
    setItem.mockRestore()
  })

  it('surfaces storage failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const stop = startAutosave(useProjectStore, 100)
    useProjectStore.getState().updateProjectMeta({ name: 'X' })
    vi.advanceTimersByTime(100)
    expect(useProjectStore.getState().saveStatus).toBe('error')
    expect(useProjectStore.getState().storageError).toMatch(/full/)
    stop()
    vi.restoreAllMocks()
  })
})
