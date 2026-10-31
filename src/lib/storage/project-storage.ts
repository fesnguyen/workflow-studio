import { projectFileSchema, PROJECT_VERSION } from '@/lib/schemas/project'
import type { ProjectFile } from '@/lib/schemas/project'

export const STORAGE_KEY = 'workflow-studio:project'

export type ParseResult = { ok: true; project: ProjectFile } | { ok: false; error: string }

export function serializeProject(project: ProjectFile): string {
  return JSON.stringify(project, null, 2)
}

/** Parses and validates a project document. Never throws. */
export function parseProject(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
  const version = (data as { version?: unknown } | null)?.version
  if (typeof version === 'number' && version > PROJECT_VERSION) {
    return {
      ok: false,
      error: `This project uses format version ${version}, but this app supports version ${PROJECT_VERSION}.`,
    }
  }
  const result = projectFileSchema.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue && issue.path.length > 0 ? ` (at ${issue.path.join('.')})` : ''
    return {
      ok: false,
      error: `Not a valid Workflow Studio project: ${issue?.message ?? 'unknown error'}${where}.`,
    }
  }
  return { ok: true, project: result.data }
}

export type SaveResult = { ok: true } | { ok: false; error: string }

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

export function saveProject(project: ProjectFile): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, serializeProject(project))
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: isQuotaError(error)
        ? 'Browser storage is full. Export your project to avoid losing changes.'
        : 'Autosave is unavailable in this browser. Export your project to keep your changes.',
    }
  }
}

export function loadStoredProject(): ProjectFile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const result = parseProject(raw)
    return result.ok ? result.project : null
  } catch {
    return null
  }
}

export function downloadProject(project: ProjectFile): void {
  const blob = new Blob([serializeProject(project)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const slug = project.project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  link.href = url
  link.download = `${slug || 'workflow-project'}.json`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
