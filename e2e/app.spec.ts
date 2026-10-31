import { expect, test, type Page } from '@playwright/test'

const state = (page: Page, id: string) => page.getByTestId(`node-${id}`).getAttribute('data-state')

async function runToEnd(page: Page) {
  await page.getByRole('combobox', { name: 'Simulation speed' }).selectOption('fast')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 15_000 })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('node-play')).toBeVisible()
})

test('shows the demo project', async ({ page }) => {
  await expect(page.getByText('Workflow Examples').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Authentication', exact: true })).toBeVisible()
})

for (const [useCase, taken, skipped] of [
  ['Audio available', 'play', ['notify', 'skip']],
  ['Audio unavailable', 'notify', ['play', 'skip']],
  ['Event disabled', 'skip', ['play', 'notify']],
] as const) {
  test(`simulation follows the "${useCase}" route`, async ({ page }) => {
    await page.getByRole('button', { name: useCase, exact: true }).click()
    await runToEnd(page)
    expect(await state(page, taken)).toBe('completed')
    for (const id of skipped) expect(await state(page, id)).toBe('skipped')
    expect(await state(page, 'end')).toBe('completed')
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    expect(await state(page, taken)).toBe('idle')
  })
}

test('switches workflows without losing data', async ({ page }) => {
  await page.getByRole('button', { name: 'Authentication', exact: true }).click()
  await expect(page.getByTestId('node-allow')).toBeVisible()
  await page.getByRole('button', { name: 'Disabled account', exact: true }).click()
  await runToEnd(page)
  expect(await state(page, 'reject-disabled')).toBe('completed')
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.getByRole('button', { name: 'Event Scheduler', exact: true }).click()
  await expect(page.getByTestId('node-play')).toBeVisible()
})

test('exports the project and imports it back', async ({ page }) => {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export/ }).click()
  const file = await (await download).path()

  await page.getByRole('button', { name: 'New workflow' }).click()
  await page.getByLabel('Import project file').setInputFiles(file)
  await page.getByRole('button', { name: 'Replace project' }).click()
  await expect(page.getByTestId('node-play')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Untitled workflow', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Authentication', exact: true })).toBeVisible()
})

test('rejects an invalid import without losing the project', async ({ page }) => {
  await page.getByLabel('Import project file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ not json'),
  })
  await expect(page.getByText(/not valid JSON/i)).toBeVisible()
  await expect(page.getByTestId('node-play')).toBeVisible()
})

test('autosaves to localStorage and restores after reload', async ({ page }) => {
  await page.getByRole('button', { name: 'New workflow' }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await page.reload()
  const names = await page.evaluate(
    () => JSON.parse(localStorage.getItem('workflow-studio:project')!).workflows.length,
  )
  expect(names).toBe(3)
})

test('toggles the theme', async ({ page }) => {
  await page.getByRole('button', { name: /Switch to dark theme/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('has no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.reload()
  await expect(page.getByTestId('node-play')).toBeVisible()
  expect(errors).toEqual([])
})
