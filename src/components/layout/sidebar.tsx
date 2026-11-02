import {
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  Moon,
  PanelLeftClose,
  Pencil,
  Plus,
  Sun,
  Trash2,
  Upload,
  FilePlus2,
  FolderOpen,
  Save,
  Workflow as WorkflowIcon,
} from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, type ConfirmRequest } from '@/components/ui/confirm-dialog'
import { downloadProject, parseProject } from '@/lib/storage/project-storage'
import { createAiInstruction } from '@/lib/storage/ai-instruction'
import { ImportFromTextDialog } from '@/components/panels/import-from-text-dialog'
import { cn } from '@/lib/utils'
import { isVsCodeWebview, postHostMessage } from '@/lib/vscode/bridge'
import { useProjectStore } from '@/stores/project-store'
import { useUiStore } from '@/stores/ui-store'

function FooterButton({
  icon: Icon,
  label,
  title,
  onClick,
}: {
  icon: typeof Save
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <Button variant="ghost" size="sm" className="justify-start" onClick={onClick} title={title}>
      <Icon className="size-3.5 shrink-0" /> <span className="truncate">{label}</span>
    </Button>
  )
}

function copyAiInstruction() {
  const { setNotice } = useUiStore.getState()
  void navigator.clipboard.writeText(createAiInstruction()).then(
    () => setNotice({ kind: 'info', message: 'AI instruction copied to the clipboard.' }),
    () => setNotice({ kind: 'error', message: 'Could not copy the AI instruction to the clipboard.' }),
  )
}

function InlineName({
  value,
  onCommit,
  onCancel,
  label,
}: {
  value: string
  onCommit: (v: string) => void
  onCancel: () => void
  label: string
}) {
  const [text, setText] = useState(value)
  const done = useRef(false)
  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    if (save && text.trim()) onCommit(text.trim())
    else onCancel()
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') finish(true)
    if (event.key === 'Escape') finish(false)
  }
  return (
    <input
      autoFocus
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={onKey}
      onBlur={() => finish(true)}
      onFocus={(e) => e.currentTarget.select()}
      className="h-6 min-w-0 flex-1 rounded border border-accent bg-card px-1.5 text-sm outline-none ring-2 ring-accent/25"
    />
  )
}

interface RowProps {
  label: string
  active: boolean
  editing: boolean
  nested?: boolean
  onSelect: () => void
  onStartRename: () => void
  onRename: (name: string) => void
  onCancelRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  leading?: React.ReactNode
  onToggle?: () => void
}

function Row({
  label,
  active,
  editing,
  nested,
  onSelect,
  onStartRename,
  onRename,
  onCancelRename,
  onDuplicate,
  onDelete,
  leading,
  onToggle,
}: RowProps) {
  return (
    <div
      className={cn(
        'group flex h-8 items-center gap-1 rounded-lg pr-1 transition-colors',
        nested ? 'pl-2' : 'pl-1.5',
        active
          ? 'bg-accent-soft text-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {onToggle ? (
        <button
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-black/5"
          onClick={onToggle}
          aria-label={`Toggle ${label}`}
          aria-expanded={active}
        >
          {leading}
        </button>
      ) : (
        leading
      )}
      {editing ? (
        <InlineName value={label} onCommit={onRename} onCancel={onCancelRename} label={`Rename ${label}`} />
      ) : (
        <button
          className={cn(
            'min-w-0 flex-1 cursor-pointer truncate text-left text-sm',
            active && 'font-medium text-foreground',
          )}
          onClick={onSelect}
          onDoubleClick={onStartRename}
          aria-current={active ? 'true' : undefined}
          title={label}
        >
          {label}
        </button>
      )}
      {!editing && (
        <span className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onStartRename}
            aria-label={`Rename ${label}`}
            title="Rename"
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDuplicate}
            aria-label={`Duplicate ${label}`}
            title="Duplicate"
          >
            <Copy className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={`Delete ${label}`}
            title="Delete"
          >
            <Trash2 className="size-3" />
          </Button>
        </span>
      )}
    </div>
  )
}

export function Sidebar() {
  const store = useProjectStore()
  const { theme, toggleTheme, setLeftOpen, setNotice } = useUiStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [renamingProject, setRenamingProject] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [textImportOpen, setTextImportOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { project, activeWorkflowId, activeUseCaseIds, saveStatus } = store
  const { extensionActive, fileName, fileDirty } = useUiStore()

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    if (isVsCodeWebview) {
      postHostMessage({ type: 'importWorkflow' })
      return
    }
    const result = parseProject(await file.text())
    if (!result.ok) {
      setNotice({ kind: 'error', message: `Import failed. ${result.error}` })
      return
    }
    setConfirm({
      title: 'Replace current project?',
      message: `Importing "${result.project.project.name}" replaces the whole project in this browser. Export first if you want to keep the current one.`,
      confirmLabel: 'Replace project',
      onConfirm: () => {
        store.replaceProject(result.project)
        setNotice({ kind: 'info', message: `Imported "${result.project.project.name}".` })
      },
    })
  }

  const askDelete = (kind: 'workflow' | 'use case', name: string, onConfirm: () => void) =>
    setConfirm({
      title: `Delete ${kind}?`,
      message: `"${name}" will be permanently removed${kind === 'workflow' ? ' with its nodes, connections and use cases' : ''}. You can undo this while editing.`,
      confirmLabel: 'Delete',
      onConfirm,
    })

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card" aria-label="Navigation">
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <WorkflowIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          {renamingProject ? (
            <InlineName
              value={project.project.name}
              label="Project name"
              onCommit={(name) => {
                store.updateProjectMeta({ name })
                setRenamingProject(false)
              }}
              onCancel={() => setRenamingProject(false)}
            />
          ) : (
            <button
              className="block w-full cursor-text truncate text-left text-sm font-semibold"
              onClick={() => setRenamingProject(true)}
              title="Rename project"
            >
              {project.project.name}
            </button>
          )}
          <div className="text-[11px] text-muted-foreground">Workflow Studio</div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setLeftOpen(false)}
          aria-label="Collapse navigation"
          title="Collapse"
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-1 flex items-center justify-between px-1.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workflows
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => store.addWorkflow()}
            aria-label="New workflow"
            title="New workflow"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        {project.workflows.length === 0 && (
          <p className="px-1.5 py-3 text-xs text-muted-foreground">
            No workflows yet. Create one with the + button.
          </p>
        )}
        <ul className="space-y-0.5">
          {project.workflows.map((wf) => {
            const active = wf.id === activeWorkflowId
            const activeUseCaseId = activeUseCaseIds[wf.id]
            return (
              <li key={wf.id}>
                <Row
                  label={wf.name}
                  active={active}
                  editing={editing === wf.id}
                  leading={
                    active ? (
                      <ChevronDown className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0 opacity-50" />
                    )
                  }
                  onSelect={() => store.selectWorkflow(wf.id)}
                  onToggle={() => store.selectWorkflow(wf.id)}
                  onStartRename={() => setEditing(wf.id)}
                  onRename={(name) => {
                    store.updateWorkflow(wf.id, { name })
                    setEditing(null)
                  }}
                  onCancelRename={() => setEditing(null)}
                  onDuplicate={() => store.duplicateWorkflow(wf.id)}
                  onDelete={() => askDelete('workflow', wf.name, () => store.deleteWorkflow(wf.id))}
                />
                {active && (
                  <div className="ml-3 mt-0.5 border-l pl-1.5">
                    <div className="flex items-center justify-between py-1 pl-2 pr-1">
                      <h3 className="text-[11px] font-medium text-muted-foreground">Use cases</h3>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => store.addUseCase()}
                        aria-label="New use case"
                        title="New use case"
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    {wf.useCases.length === 0 && (
                      <p className="px-2 pb-2 text-xs text-muted-foreground">
                        No use cases. Add one to simulate.
                      </p>
                    )}
                    <ul className="space-y-0.5">
                      {wf.useCases.map((uc) => (
                        <li key={uc.id}>
                          <Row
                            nested
                            label={uc.name}
                            active={uc.id === activeUseCaseId}
                            editing={editing === uc.id}
                            leading={
                              <span
                                className={cn(
                                  'mr-1 size-1.5 shrink-0 rounded-full',
                                  uc.id === activeUseCaseId ? 'bg-accent' : 'bg-muted-foreground/30',
                                )}
                              />
                            }
                            onSelect={() => store.selectUseCase(uc.id)}
                            onStartRename={() => setEditing(uc.id)}
                            onRename={(name) => {
                              store.updateUseCase(uc.id, { name })
                              setEditing(null)
                            }}
                            onCancelRename={() => setEditing(null)}
                            onDuplicate={() => store.duplicateUseCase(uc.id)}
                            onDelete={() => askDelete('use case', uc.name, () => store.deleteUseCase(uc.id))}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t px-2 py-2">
        <div className="grid grid-cols-2 gap-1">
          {extensionActive ? (
            <>
              <FooterButton
                icon={FolderOpen}
                label="Open"
                title="Open workflow JSON"
                onClick={() => postHostMessage({ type: 'openWorkflow' })}
              />
              <FooterButton
                icon={Save}
                label="Save"
                title="Save current workflow JSON"
                onClick={() => postHostMessage({ type: 'saveWorkflow' })}
              />
              <FooterButton
                icon={FilePlus2}
                label="Save as"
                title="Save as a new workflow JSON file"
                onClick={() => postHostMessage({ type: 'saveWorkflowAs' })}
              />
              <FooterButton
                icon={Download}
                label="Export"
                title="Export project as JSON"
                onClick={() => postHostMessage({ type: 'exportWorkflow' })}
              />
            </>
          ) : (
            <>
              <FooterButton
                icon={Download}
                label="Export"
                title="Export project as JSON"
                onClick={() => downloadProject(project)}
              />
              <FooterButton
                icon={Upload}
                label="Import"
                title="Import project from JSON"
                onClick={() => fileRef.current?.click()}
              />
            </>
          )}
          <FooterButton
            icon={Clipboard}
            label="From text"
            title="Import project JSON from text"
            onClick={() => setTextImportOpen(true)}
          />
          <FooterButton
            icon={Copy}
            label="AI Instruction"
            title="Copy an instruction for an external AI coding agent"
            onClick={copyAiInstruction}
          />
        </div>
        <div className="flex items-center gap-1 pt-1">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import project file"
            data-testid="import-input"
            onChange={(e) => {
              void onImportFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <span
            className={cn(
              'mr-1 min-w-0 flex-1 truncate text-[11px]',
              saveStatus === 'error' || fileDirty ? 'text-warning' : 'text-muted-foreground',
            )}
            role="status"
            data-testid="save-status"
            title={
              extensionActive
                ? `${fileName ?? 'No file open'}${fileDirty ? ' — unsaved changes' : ''}`
                : undefined
            }
          >
            {extensionActive
              ? `${fileName ?? 'No file'}${fileDirty ? ' •' : ''}`
              : saveStatus === 'saving'
                ? 'Saving…'
                : saveStatus === 'error'
                  ? 'Not saved'
                  : 'Saved'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      {textImportOpen && (
        <ImportFromTextDialog
          onClose={() => setTextImportOpen(false)}
          onImport={(incoming) => {
            store.replaceProject(incoming)
            setTextImportOpen(false)
            setNotice({ kind: 'info', message: `Imported "${incoming.project.name}".` })
          }}
        />
      )}
    </aside>
  )
}
