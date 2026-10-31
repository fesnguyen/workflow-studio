import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDemoProject } from '@/lib/demo-project'
import {
  loadStoredProject,
  parseProject,
  saveProject,
  serializeProject,
  STORAGE_KEY,
} from './project-storage'

afterEach(() => vi.restoreAllMocks())

describe('project JSON', () => {
  it('round-trips the whole project', () => {
    const project = createDemoProject()
    const result = parseProject(serializeProject(project))
    expect(result).toEqual({ ok: true, project })
  })

  it('reports invalid JSON', () => {
    const result = parseProject('{nope')
    expect(result.ok).toBe(false)
  })

  it('rejects documents that do not match the schema', () => {
    expect(parseProject('{"version":1,"project":{}}').ok).toBe(false)
    expect(parseProject('[]').ok).toBe(false)
  })

  it('rejects edges pointing at missing nodes', () => {
    const project = createDemoProject()
    project.workflows[0]!.edges[0]!.target = 'ghost'
    expect(parseProject(JSON.stringify(project)).ok).toBe(false)
  })

  it('rejects newer format versions with a clear message', () => {
    const result = parseProject(JSON.stringify({ ...createDemoProject(), version: 99 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/version 99/)
  })
})

describe('browser persistence', () => {
  it('saves and restores the project from localStorage', () => {
    const project = createDemoProject()
    expect(saveProject(project)).toEqual({ ok: true })
    expect(loadStoredProject()).toEqual(project)
  })

  it('ignores corrupted stored data', () => {
    localStorage.setItem(STORAGE_KEY, 'garbage')
    expect(loadStoredProject()).toBeNull()
  })

  it('reports a full storage quota', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const result = saveProject(createDemoProject())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/full/)
  })
})
