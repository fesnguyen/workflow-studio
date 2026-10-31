import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoProject } from '@/lib/demo-project'
import { createInitialState, selectActiveUseCase, useProjectStore } from '@/stores/project-store'
import { Sidebar } from './sidebar'

beforeEach(() => {
  useProjectStore.setState(createInitialState(createDemoProject()), false)
})

describe('Sidebar', () => {
  it('switches workflows and use cases with one click', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: 'Authentication' }))
    expect(useProjectStore.getState().activeWorkflowId).toBe(
      useProjectStore.getState().project.workflows[1]!.id,
    )
    await user.click(screen.getByRole('button', { name: 'Disabled account' }))
    expect(selectActiveUseCase(useProjectStore.getState())!.name).toBe('Disabled account')
  })

  it('adds a workflow', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: 'New workflow' }))
    expect(useProjectStore.getState().project.workflows).toHaveLength(3)
  })

  it('asks for confirmation before deleting a workflow', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: 'Delete Authentication' }))
    const dialog = screen.getByRole('alertdialog')
    expect(useProjectStore.getState().project.workflows).toHaveLength(2)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(useProjectStore.getState().project.workflows).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Delete Authentication' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /delete/i }))
    expect(useProjectStore.getState().project.workflows).toHaveLength(1)
  })
})
