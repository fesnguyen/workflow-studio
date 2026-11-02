# Development Guide

Workflow Studio is a VS Code extension. A React app (the **webview**) renders the workflow editor and simulator; a small Node-side **extension host** owns files, the VS Code APIs and source navigation.

## Architecture

```text
┌────────────── VS Code ──────────────┐
│ Extension host (src/extension)      │   postMessage    ┌──────── Webview (React) ────────┐
│  - command, panel, CSP/nonce        │ <──────────────> │  Canvas, sidebar, properties    │
│  - open/save/import/export files    │  typed messages  │  Zustand stores, simulation     │
│  - source navigation (symbols)      │ (src/shared)     │  Import-from-text, AI instruction│
└─────────────────────────────────────┘                  └─────────────────────────────────┘
```

- **Host** holds the current project, current file and dirty flag. It is the only side touching the filesystem or `vscode` APIs.
- **Webview** edits the project in memory (Zustand + undo/redo) and sends the whole project to the host on every change (`projectChanged`). It never reads files or calls VS Code directly.
- **Single source of truth for the format**: the Zod schema in `src/lib/schemas/project.ts`. Parsing, validation, the host, the webview and the AI instruction all use it.

## Directory map

| Path                                                               | Purpose                                                                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/extension/extension.ts`                                       | Activation, `Workflow Studio: Open Editor`, webview HTML (CSP + nonce), file operations, source navigation                               |
| `src/shared/messages.ts`                                           | Typed messages: `HostMessage` (webview → host), `WebviewMessage` (host → webview)                                                        |
| `src/lib/vscode/bridge.ts`                                         | Webview side of the bridge: `acquireVsCodeApi`, `postHostMessage`, applies `projectLoaded` / `fileState` / warnings                      |
| `src/lib/schemas/project.ts`                                       | Zod schemas and types (project, workflow, node, edge, use case, **optional `source` metadata**)                                          |
| `src/lib/storage/project-storage.ts`                               | `parseProject` / `serializeProject`, localStorage (browser dev only), download helper                                                    |
| `src/lib/storage/ai-instruction.ts`                                | Builds the "Copy AI Instruction" text from the JSON Schema of the project (stays in sync automatically)                                  |
| `src/lib/workflow-engine/`                                         | Pure, React-free: conditions, graph rules, validation, simulation                                                                        |
| `src/lib/layout/`                                                  | ELK auto layout (lazy loaded)                                                                                                            |
| `src/stores/`                                                      | `project-store` (project, selection, undo/redo), `simulation-store`, `ui-store` (panels, notices, file state), `autosave` (browser only) |
| `src/components/`                                                  | `canvas`, `nodes`, `layout` (sidebar), `panels` (properties, source details, import dialog), `simulation`, `ui`                          |
| `src/main.tsx`                                                     | Entry: starts bridge (VS Code) or autosave (browser)                                                                                     |
| `test/extension/`, `test/fixture/`, `test/run-extension-tests.mjs` | VS Code integration tests and the fixture workspace they open                                                                            |
| `e2e/`                                                             | Playwright tests for the browser build                                                                                                   |
| `tsconfig.app.json`                                                | Webview (DOM) config; excludes `src/extension`                                                                                           |
| `tsconfig.extension.json` / `tsconfig.extension.test.json`         | Type-check the host and the integration tests                                                                                            |
| `vite.config.ts`                                                   | Webview build to `dist/webview` with relative asset paths (required by the webview)                                                      |

Generated and ignored: `dist/`, `out/`, `*.vsix`.

## Key flows

**Open the editor** – `workflowStudio.openEditor` creates one `WebviewPanel` (a second call reveals it). The host reads `dist/webview/index.html`, rewrites asset URLs with `asWebviewUri`, adds a nonce to scripts and a CSP (`default-src 'none'`, scripts only by nonce). `localResourceRoots` is limited to `dist/webview`.

**Startup handshake** – webview sends `ready` → host replies `projectLoaded` + `fileState`. Edits send `projectChanged`; the host re-validates with `parseProject` and marks the file dirty.

**Files** – Open / Save / Save as / Export / Import use `showOpenDialog`, `showSaveDialog` and `workspace.fs`. Open and Import ask before discarding or replacing. Errors (bad JSON, schema failures, write errors) show VS Code messages. The sidebar shows the file name and a `•` when dirty.

**Source metadata** – `node.source` is optional: `file`, `class` (constructor params, base classes, interfaces) and `function` (params, return type, `calls`). Existing JSON without it stays valid. The node's properties panel (`source-details.tsx`) shows it; every reference is a button that posts `navigate`.

**Source navigation** (`navigateToSource`):

1. Reject absolute paths, `..` segments and NUL; resolve against each workspace folder (multi-root aware). If the path is missing, search for a unique file with the same name (moved files); several matches open a Quick Pick.
2. Open the document, run `vscode.executeDocumentSymbolProvider`, flatten the symbols and match by name, qualified name (container chain), containing class and parameter names/types. Navigate only when exactly one candidate remains (duplicates and overloads are not guessed).
3. Fallback: constrained regex lookup inside the same file (scoped to the containing class when known). Still ambiguous or not found → the file is opened and a non-blocking warning is shown in the webview.

No AI is used at click time and fixed line numbers are not stored.

**AI exchange** – _Copy AI Instruction_ copies prompt text plus the JSON Schema generated from `projectFileSchema`. _Import from Text_ accepts plain JSON or a Markdown code fence, validates, previews and requires explicit confirmation before replacing the project. File Import/Export are separate actions.

## Setup

Requirements: Node 20+ and pnpm 10.

```bash
pnpm install
```

## Run

**In VS Code (the real product)**

1. Open this folder in VS Code and run `pnpm build`.
2. Press `F5` ("Run Extension") or use **Run → Start Debugging** to open an Extension Development Host. If there is no launch configuration, create `.vscode/launch.json` with an `extensionHost` configuration whose `args` is `["--extensionDevelopmentPath=${workspaceFolder}"]`.
3. In the new window open a workspace folder and run **Workflow Studio: Open Editor** from the Command Palette.

After changing host code or webview code, re-run `pnpm build` and reload the Extension Development Host (`Ctrl/Cmd+R`).

**In a browser (UI-only iteration)**

```bash
pnpm dev   # http://localhost:5173
```

The extension host is absent here: there is no Open/Save, source navigation or dirty state; localStorage autosave and download/upload import/export are used instead. Use it for canvas, simulation and styling work.

**Install a VSIX**

```bash
pnpm package        # builds, then creates workflow-studio-<version>.vsix
code --install-extension workflow-studio-1.0.0.vsix
```

or **Extensions: Install from VSIX...** in VS Code.

## Scripts

| Script                | What it does                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm dev`            | Vite dev server (browser mode)                                                                          |
| `pnpm build`          | `tsc -b`, host + test type-checks, Vite webview build, esbuild bundle of the host (`out/extension.cjs`) |
| `pnpm typecheck`      | Webview type-check only                                                                                 |
| `pnpm lint`           | ESLint                                                                                                  |
| `pnpm format[:check]` | Prettier write / check                                                                                  |
| `pnpm test`           | Vitest unit and component tests (jsdom)                                                                 |
| `pnpm test:extension` | Build, then launch a real Extension Development Host with the fixture and run the integration tests     |
| `pnpm test:e2e`       | Playwright browser tests (`pnpm exec playwright install chromium` once)                                 |
| `pnpm package`        | Create the VSIX (`vsce package --no-dependencies`; everything is bundled)                               |
| `pnpm check`          | typecheck + lint + format check + unit tests + build                                                    |

## Testing and verification

1. **Fast loop**: `pnpm typecheck && pnpm lint && pnpm test`.
2. **Before pushing**: `pnpm check`, then `pnpm package` to make sure packaging works.
3. **Integration tests**: `pnpm test:extension`.
   - Needs network access the first time (downloads a VS Code build) and a display; on headless Linux use `xvfb-run -a pnpm test:extension`.
   - Opens `test/fixture` as the workspace and checks activation, the command, and navigation to a class and to a method when two classes define the same method name. Add new fixture cases to `test/fixture/` and assertions to `test/extension/runner.ts`.
   - Tests run with `--disable-extensions`, so symbol lookup uses VS Code's built-in TypeScript support. Other languages need their language extension installed; without one the text fallback is used.
4. **Manual checklist** in the Extension Development Host:
   - Command appears and opens one panel; running it again reveals the same panel.
   - Webview renders with no CSP or missing-asset errors (**Developer: Open Webview Developer Tools**).
   - Edit, connect, simulate; Open/Save/Save as/Export/Import; unsaved-changes marker.
   - _Copy AI Instruction_ and _Import from Text_ (plain JSON and fenced JSON, invalid JSON).
   - Click file, class, function and called-function references; try a missing file and a missing symbol.

## Debugging

- **Host**: breakpoints in `src/extension/extension.ts` work in the Extension Development Host (source maps are not emitted by default; add `--sourcemap` to the esbuild command in `package.json` when stepping through code).
- **Webview**: run **Developer: Open Webview Developer Tools** to inspect console, network and CSP violations.
- **Messages**: log in `handleMessage` (host) or `onMessage` in `bridge.ts` (webview).
- **Blank panel**: usually a missing `pnpm build` (`dist/webview` absent) or an asset URL not starting with `./` in `index.html` (keep `base: './'` in `vite.config.ts`).

## Common changes

- **New field in the file format**: edit `src/lib/schemas/project.ts` (make it optional), update UI, add a test in `project-storage.test.ts`. The AI instruction updates itself.
- **New host ↔ webview action**: add a variant to `src/shared/messages.ts`, handle it in `handleMessage` (host) or `bridge.ts` (webview). Validate everything received from the webview.
- **Webview code must not import** `vscode` or Node modules; the host must not import React.

## Conventions

- TypeScript strict; ESLint + Prettier (`pnpm format`); keep the engine in `src/lib/workflow-engine` free of React.
- Keep business logic in one place; do not duplicate it between host and webview.
- Do not commit `dist/`, `out/` or `.vsix` files.
- Not in scope: automatic call-graph generation, AI API calls, a backend, Marketplace publishing.

## Known limitations

- Navigation relies on document symbols from the language extension; ambiguous overloads or duplicates open the file with a warning instead of guessing.
- The VSIX has no LICENSE file yet (`vsce` warns).
- The webview bundle is large (ELK layout engine, about 1.4 MB, loaded lazily by the app).
