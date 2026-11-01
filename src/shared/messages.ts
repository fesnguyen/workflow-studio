import type { ProjectFile, SourceFileReference, SourceSymbolReference } from '@/lib/schemas/project'

export type HostMessage =
  | { type: 'ready' }
  | { type: 'projectChanged'; project: ProjectFile }
  | { type: 'openWorkflow' }
  | { type: 'saveWorkflow' }
  | { type: 'saveWorkflowAs' }
  | { type: 'importWorkflow' }
  | { type: 'exportWorkflow' }
  | { type: 'navigate'; reference: SourceFileReference | SourceSymbolReference }

export type WebviewMessage =
  | { type: 'projectLoaded'; project: ProjectFile; fileName: string | null }
  | { type: 'fileState'; fileName: string | null; dirty: boolean }
  | { type: 'navigationWarning'; message: string }
