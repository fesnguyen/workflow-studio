import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createDemoProject } from '@/lib/demo-project'
import { ImportFromTextDialog } from './import-from-text-dialog'

describe('ImportFromTextDialog', () => {
  it('validates fenced JSON, previews it, and requires confirmation', () => {
    const project = createDemoProject()
    const onImport = vi.fn()
    render(<ImportFromTextDialog onClose={vi.fn()} onImport={onImport} />)

    fireEvent.change(screen.getByLabelText('Workflow JSON text'), {
      target: { value: `\`\`\`json\n${JSON.stringify(project)}\n\`\`\`` },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Validate JSON' }))

    expect(screen.getByText(`Preview: ${project.project.name}`)).toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Replace project' }))
    expect(onImport).toHaveBeenCalledWith(project)
  })

  it('shows validation errors and does not apply invalid input', () => {
    const onImport = vi.fn()
    render(<ImportFromTextDialog onClose={vi.fn()} onImport={onImport} />)

    fireEvent.change(screen.getByLabelText('Workflow JSON text'), {
      target: { value: '{invalid json}' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Validate JSON' }))

    expect(screen.getByRole('alert')).toHaveTextContent('not valid JSON')
    expect(onImport).not.toHaveBeenCalled()
  })
})
