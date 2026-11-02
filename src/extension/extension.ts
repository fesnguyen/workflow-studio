import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve, sep } from 'node:path'
import * as vscode from 'vscode'
import { createDemoProject } from '../lib/demo-project'
import { parseProject, serializeProject } from '../lib/storage/project-storage'
import type { ProjectFile, SourceFileReference, SourceSymbolReference } from '../lib/schemas/project'
import type { WebviewMessage } from '../shared/messages'

type SourceReference = SourceFileReference | SourceSymbolReference
type IncomingMessage = Record<string, unknown> & { type?: string }

let panel: vscode.WebviewPanel | undefined
let currentProject: ProjectFile = createDemoProject()
let currentFile: vscode.Uri | null = null
let dirty = false
let extensionContext: vscode.ExtensionContext

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context
  context.subscriptions.push(
    vscode.commands.registerCommand('workflowStudio.openEditor', () => openEditor()),
    vscode.commands.registerCommand('workflowStudio.navigateToSource', (reference: unknown) => {
      if (isSourceReference(reference)) return navigateToSource(reference)
      return vscode.window.showWarningMessage('Workflow Studio received an invalid source reference.')
    }),
  )
}

export function deactivate(): void {
  panel?.dispose()
  panel = undefined
}

async function openEditor(): Promise<void> {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Active)
    return
  }

  panel = vscode.window.createWebviewPanel(
    'workflowStudio.editor',
    'Workflow Studio',
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionContext.extensionUri, 'dist', 'webview')],
      retainContextWhenHidden: true,
    },
  )
  panel.onDidDispose(
    () => {
      panel = undefined
    },
    null,
    extensionContext.subscriptions,
  )
  panel.webview.onDidReceiveMessage(
    (message: IncomingMessage) => {
      void handleMessage(message)
    },
    null,
    extensionContext.subscriptions,
  )

  panel.webview.html = await getWebviewHtml(panel.webview)
}

async function getWebviewHtml(webview: vscode.Webview): Promise<string> {
  const root = vscode.Uri.joinPath(extensionContext.extensionUri, 'dist', 'webview')
  let html = await readFile(vscode.Uri.joinPath(root, 'index.html').fsPath, 'utf8')
  html = html.replace(/(src|href)="\.\/([^"]+)"/g, (_match: string, attribute: string, asset: string) => {
    const uri = webview.asWebviewUri(vscode.Uri.joinPath(root, asset))
    return `${attribute}="${uri}"`
  })
  const nonce = randomBytes(16).toString('base64')
  html = html.replace(/<script\b(?![^>]*\bnonce=)([^>]*)>/g, `<script nonce="${nonce}"$1>`)
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ')
  return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`)
}

async function handleMessage(message: IncomingMessage): Promise<void> {
  if (!panel || !message || typeof message.type !== 'string') return
  switch (message.type) {
    case 'ready':
      post({
        type: 'projectLoaded',
        project: currentProject,
        fileName: currentFile ? vscode.workspace.asRelativePath(currentFile) : null,
      })
      postFileState()
      break
    case 'projectChanged': {
      const parsed = parseProject(JSON.stringify(message.project))
      if (!parsed.ok) {
        void vscode.window.showWarningMessage(
          `Workflow Studio rejected an invalid project update: ${parsed.error}`,
        )
        return
      }
      currentProject = parsed.project
      dirty = true
      postFileState()
      break
    }
    case 'openWorkflow':
      await openWorkflowFile()
      break
    case 'saveWorkflow':
      await saveWorkflow(false)
      break
    case 'saveWorkflowAs':
      await saveWorkflow(true)
      break
    case 'exportWorkflow':
      await exportWorkflow()
      break
    case 'importWorkflow':
      await importWorkflowFile()
      break
    case 'navigate':
      if (isSourceReference(message.reference)) await navigateToSource(message.reference)
      break
  }
}

function isSourceReference(value: unknown): value is SourceReference {
  if (!value || typeof value !== 'object') return false
  const reference = value as Record<string, unknown>
  return (
    typeof reference.path === 'string' ||
    (typeof reference.filePath === 'string' && typeof reference.name === 'string')
  )
}

function post(message: WebviewMessage): void {
  void panel?.webview.postMessage(message)
}

function postFileState(): void {
  post({
    type: 'fileState',
    fileName: currentFile ? vscode.workspace.asRelativePath(currentFile) : null,
    dirty,
  })
}

async function confirmDiscardChanges(): Promise<boolean> {
  if (!dirty) return true
  const choice = await vscode.window.showWarningMessage(
    'Workflow Studio has unsaved changes.',
    { modal: true },
    'Save',
    'Discard',
  )
  if (choice === 'Save') return saveWorkflow(false)
  return choice === 'Discard'
}

async function openWorkflowFile(): Promise<void> {
  if (!(await confirmDiscardChanges())) return
  const files = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Open Workflow Studio project',
    filters: { 'Workflow Studio project': ['json'] },
  })
  const uri = files?.[0]
  if (!uri) return
  await loadWorkflowFile(uri)
}

async function loadWorkflowFile(uri: vscode.Uri): Promise<void> {
  try {
    const contents = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8')
    const parsed = parseProject(contents)
    if (!parsed.ok) {
      void vscode.window.showErrorMessage(`Could not open workflow project. ${parsed.error}`)
      return
    }
    currentProject = parsed.project
    currentFile = uri
    dirty = false
    post({ type: 'projectLoaded', project: currentProject, fileName: vscode.workspace.asRelativePath(uri) })
    postFileState()
  } catch (error) {
    void vscode.window.showErrorMessage(`Could not read "${uri.fsPath}": ${errorMessage(error)}`)
  }
}

async function importWorkflowFile(): Promise<void> {
  const files = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Import project',
    filters: { 'Workflow Studio project': ['json'] },
  })
  const uri = files?.[0]
  if (!uri) return
  try {
    const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8')
    const parsed = parseProject(text)
    if (!parsed.ok) {
      void vscode.window.showErrorMessage(`Import failed. ${parsed.error}`)
      return
    }
    const confirm = await vscode.window.showWarningMessage(
      `Importing "${parsed.project.project.name}" replaces the current project.`,
      { modal: true },
      'Replace project',
    )
    if (confirm !== 'Replace project') return
    currentProject = parsed.project
    currentFile = null
    dirty = true
    post({ type: 'projectLoaded', project: currentProject, fileName: null })
    postFileState()
  } catch (error) {
    void vscode.window.showErrorMessage(`Import failed: ${errorMessage(error)}`)
  }
}

async function saveWorkflow(saveAs: boolean): Promise<boolean> {
  if (!panel) return false
  const uri =
    saveAs || !currentFile
      ? await vscode.window.showSaveDialog({
          saveLabel: 'Save Workflow Studio project',
          filters: { 'Workflow Studio project': ['json'] },
          defaultUri: currentFile ?? undefined,
        })
      : currentFile
  if (!uri) return false
  try {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(serializeProject(currentProject), 'utf8'))
    currentFile = uri
    dirty = false
    postFileState()
    void vscode.window.setStatusBarMessage(`Saved ${basename(uri.fsPath)}`, 3000)
    return true
  } catch (error) {
    void vscode.window.showErrorMessage(`Could not save "${uri.fsPath}": ${errorMessage(error)}`)
    return false
  }
}

async function exportWorkflow(): Promise<void> {
  const slug =
    currentProject.project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'workflow-project'
  const uri = await vscode.window.showSaveDialog({
    saveLabel: 'Export Workflow Studio project',
    filters: { 'Workflow Studio project': ['json'] },
    defaultUri: vscode.Uri.file(`${slug}.json`),
  })
  if (!uri) return
  try {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(serializeProject(currentProject), 'utf8'))
    void vscode.window.setStatusBarMessage(`Exported ${basename(uri.fsPath)}`, 3000)
  } catch (error) {
    void vscode.window.showErrorMessage(`Could not export "${uri.fsPath}": ${errorMessage(error)}`)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function navigateToSource(reference: SourceReference): Promise<void> {
  const path = 'path' in reference ? reference.path : reference.filePath
  const target = await resolveWorkspaceFile(path)
  if (!target) {
    post({
      type: 'navigationWarning',
      message: `Could not resolve workspace file "${path}". Choose a workspace folder and check the source path.`,
    })
    return
  }

  try {
    const document = await vscode.workspace.openTextDocument(target)
    const editor = await vscode.window.showTextDocument(document, { preview: true })
    if ('path' in reference) return

    const location = await findSymbolLocation(document, reference)
    if (location) {
      editor.selection = new vscode.Selection(location, location)
      editor.revealRange(new vscode.Range(location, location), vscode.TextEditorRevealType.InCenter)
      return
    }
    const fallback = findTextDeclaration(document, reference)
    if (fallback) {
      editor.selection = new vscode.Selection(fallback, fallback)
      editor.revealRange(new vscode.Range(fallback, fallback), vscode.TextEditorRevealType.InCenter)
      return
    }
    post({
      type: 'navigationWarning',
      message: `Opened ${basename(target.fsPath)}, but could not resolve "${reference.qualifiedName ?? reference.name}".`,
    })
  } catch (error) {
    post({ type: 'navigationWarning', message: `Could not open "${path}": ${errorMessage(error)}` })
  }
}

async function resolveWorkspaceFile(path: string): Promise<vscode.Uri | null> {
  if (!path || isAbsolute(path) || path.includes('\0')) return null
  const normalized = path.replace(/[\\/]+/g, sep)
  if (normalized.split(sep).some((part) => part === '..')) return null
  const folders = vscode.workspace.workspaceFolders ?? []
  const exactMatches: vscode.Uri[] = []
  for (const folder of folders) {
    const candidatePath = resolve(folder.uri.fsPath, normalized)
    const relativePath = relative(folder.uri.fsPath, candidatePath)
    if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) continue
    const candidate = vscode.Uri.file(candidatePath)
    try {
      await vscode.workspace.fs.stat(candidate)
      exactMatches.push(candidate)
    } catch {
      // Try other workspace roots and a basename-based moved-file fallback.
    }
  }
  const exactUnique = [...new Map(exactMatches.map((uri) => [uri.toString(), uri])).values()]
  if (exactUnique.length === 1) return exactUnique[0] ?? null
  if (exactUnique.length > 1) return chooseWorkspaceFile(exactUnique)

  const fileName = basename(normalized)
  if (!fileName || fileName === '.' || fileName === '..') return null
  const matches: vscode.Uri[] = []
  for (const folder of folders) {
    const found = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, `**/${fileName}`),
      '**/{node_modules,.git}/**',
      20,
    )
    matches.push(...found)
  }
  const unique = [...new Map(matches.map((uri) => [uri.toString(), uri])).values()]
  if (unique.length === 1) return unique[0] ?? null
  if (unique.length > 1) return chooseWorkspaceFile(unique)
  return null
}

function chooseWorkspaceFile(uris: vscode.Uri[]): Thenable<vscode.Uri | null> {
  return vscode.window
    .showQuickPick(
      uris.map((uri) => ({ label: vscode.workspace.asRelativePath(uri), uri })),
      { placeHolder: 'Choose a workspace file' },
    )
    .then((item) => item?.uri ?? null)
}

type SymbolEntry = {
  name: string
  containerName?: string
  range: vscode.Range
  selectionRange: vscode.Range
  parents: string[]
}

async function findSymbolLocation(
  document: vscode.TextDocument,
  reference: SourceSymbolReference,
): Promise<vscode.Position | null> {
  let symbols: Array<vscode.DocumentSymbol | vscode.SymbolInformation>
  try {
    symbols =
      (await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri)) ?? []
  } catch {
    symbols = []
  }

  const entries = flattenSymbols(symbols)
  const qualified = (reference.qualifiedName ?? reference.name).replace(/::/g, '.')
  let candidates = entries.filter((entry) => entry.name === reference.name)
  const exactQualified = candidates.filter((entry) => {
    const fullName = [...entry.parents, entry.name].join('.')
    return fullName === qualified || fullName.endsWith(`.${qualified}`)
  })
  if (exactQualified.length) candidates = exactQualified
  else if (reference.containingClass) {
    candidates = candidates.filter((entry) => entry.parents.includes(reference.containingClass!))
  }
  if (reference.parameters?.length) {
    const withSignature = candidates.filter((entry) => {
      const text = document.getText(entry.range)
      return reference.parameters!.every((parameter) => {
        const parameterPattern = parameter.type
          ? `\\b${escapeRegExp(parameter.name)}\\s*:\\s*${escapeRegExp(parameter.type)}\\b`
          : `\\b${escapeRegExp(parameter.name)}\\b`
        return new RegExp(parameterPattern).test(text)
      })
    })
    if (withSignature.length) candidates = withSignature
  }
  if (candidates.length !== 1) return null
  return candidates[0]?.selectionRange.start ?? null
}

function flattenSymbols(
  symbols: Array<vscode.DocumentSymbol | vscode.SymbolInformation>,
  parents: string[] = [],
): SymbolEntry[] {
  const entries: SymbolEntry[] = []
  for (const symbol of symbols) {
    if ('selectionRange' in symbol) {
      entries.push({
        name: symbol.name,
        range: symbol.range,
        selectionRange: symbol.selectionRange,
        parents,
      })
      entries.push(...flattenSymbols(symbol.children, [...parents, symbol.name]))
    } else {
      entries.push({
        name: symbol.name,
        containerName: symbol.containerName,
        range: symbol.location.range,
        selectionRange: symbol.location.range,
        parents: symbol.containerName ? [symbol.containerName] : parents,
      })
    }
  }
  return entries
}

function findTextDeclaration(
  document: vscode.TextDocument,
  reference: SourceSymbolReference,
): vscode.Position | null {
  const name = escapeRegExp(reference.name)
  const declaration = new RegExp(
    `\\b(?:class|interface|enum|function|type|def|func)\\s+${name}\\b|\\b${name}\\s*\\([^;{}]*\\)\\s*(?::\\s*[^={]+)?\\s*(?:=>|\\{|$)`,
  )
  const matches: vscode.Position[] = []
  for (let line = 0; line < document.lineCount; line++) {
    const text = document.lineAt(line).text
    const match = declaration.exec(text)
    if (match) matches.push(new vscode.Position(line, match.index))
  }
  const qualified = (reference.qualifiedName ?? '').replace(/::/g, '.').split('.').filter(Boolean)
  const containingClass = reference.containingClass ?? (qualified.length > 1 ? qualified.at(-2) : undefined)
  if (containingClass) {
    const scopes = findClassScopes(document, containingClass)
    const scoped = matches.filter((position) =>
      scopes.some((scope) => scope.start <= position.line && scope.end >= position.line),
    )
    if (scoped.length === 1) return scoped[0] ?? null
    if (scoped.length > 1) return null
  }
  return matches.length === 1 ? (matches[0] ?? null) : null
}

function findClassScopes(
  document: vscode.TextDocument,
  className: string,
): Array<{ start: number; end: number }> {
  const pattern = new RegExp(`\\b(?:class|interface|enum)\\s+${escapeRegExp(className)}\\b`)
  const scopes: Array<{ start: number; end: number }> = []
  for (let line = 0; line < document.lineCount; line++) {
    let depth = 0
    let started = false
    for (let cursor = line; cursor < document.lineCount; cursor++) {
      const text = document.lineAt(cursor).text
      if (cursor === line && !pattern.test(text)) break
      for (const character of text) {
        if (character === '{') {
          depth++
          started = true
        } else if (character === '}') {
          depth--
          if (started && depth === 0) {
            scopes.push({ start: line, end: cursor })
            cursor = document.lineCount
            break
          }
        }
      }
    }
  }
  return scopes
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
