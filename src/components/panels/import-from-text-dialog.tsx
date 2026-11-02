import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/fields'
import { parseProject } from '@/lib/storage/project-storage'
import type { ProjectFile } from '@/lib/schemas/project'

function extractJson(text: string): string {
  const match = text.match(/^\s*```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i)
  return match?.[1] ?? text
}

export function ImportFromTextDialog({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (project: ProjectFile) => void
}) {
  const [text, setText] = useState('')
  const [project, setProject] = useState<ProjectFile | null>(null)
  const [error, setError] = useState('')

  const validate = () => {
    const result = parseProject(extractJson(text))
    if (!result.ok) {
      setProject(null)
      setError(result.error)
      return
    }
    setProject(result.project)
    setError('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="text-import-title"
        className="w-full max-w-2xl rounded-xl border bg-card p-5 shadow-soft"
      >
        <h2 id="text-import-title" className="text-sm font-semibold">
          Import from Text
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste a Workflow Studio project as JSON, or paste JSON inside a Markdown code fence.
        </p>
        <Textarea
          aria-label="Workflow JSON text"
          className="mt-3 min-h-56 font-mono text-xs"
          placeholder={'{"version":1,"project":...,"workflows":[]}'}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setProject(null)
            setError('')
          }}
        />
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
        {project && (
          <div className="mt-3 rounded-lg border bg-muted/40 p-3" role="status">
            <p className="text-sm font-medium">Preview: {project.project.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {project.workflows.length} workflow{project.workflows.length === 1 ? '' : 's'} ·{' '}
              {project.workflows.reduce((total, workflow) => total + workflow.nodes.length, 0)} nodes
            </p>
            <ul className="mt-2 flex flex-wrap gap-1">
              {project.workflows.map((workflow) => (
                <li key={workflow.id} className="rounded bg-card px-2 py-1 text-xs">
                  {workflow.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-warning">Applying this import replaces the current project.</p>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!project ? (
            <Button onClick={validate} disabled={!text.trim()}>
              Validate JSON
            </Button>
          ) : (
            <Button variant="danger" onClick={() => onImport(project)}>
              Replace project
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
