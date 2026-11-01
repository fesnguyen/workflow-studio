# Workflow Studio

A VS Code extension for documenting and simulating business workflows. **One project, multiple workflows. One workflow, multiple use cases.**

## Use in VS Code

1. Build and package the extension with `pnpm install`, `pnpm build`, and `pnpm package`.
2. Install the generated `workflow-studio-*.vsix` with **Extensions: Install from VSIX...** in VS Code.
3. Run **Workflow Studio: Open Editor** from the Command Palette.
4. Use **Open**, **Save**, and **Save as** to work with Workflow Studio JSON files. **Import** and **Export** remain available as separate actions.

The editor panel can be reopened through the Command Palette. Changes are held by the extension host while the panel is open and are written to disk only when saved. Source paths are workspace-relative. When a file has moved, the extension searches for a unique matching basename; if there are multiple matches, it asks you to choose.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm package
```

The React/Vite webview and VS Code extension host have separate TypeScript/build checks. `pnpm package` creates an installable VSIX; no Marketplace publishing is performed.

Design workflows with draggable nodes, document every step, define use cases with input variables, and watch the simulator walk the exact path each use case takes. In VS Code, the extension host manages project files and source navigation while the React editor runs in a secured Webview.

## Quick start

For browser-based UI development, run `pnpm dev`. The extension host is not active in browser development mode.

The app opens with a **Workflow Examples** project (Event Scheduler and Authentication, three use cases each).

| Script                | Purpose                                                             |
| --------------------- | ------------------------------------------------------------------- |
| `pnpm dev`            | Start the webview dev server for browser-based development          |
| `pnpm build`          | Type-check and build the webview and extension host                 |
| `pnpm test`           | Unit and component tests (Vitest, React Testing Library)            |
| `pnpm test:extension` | Launch Extension Development Host and run VS Code integration tests |
| `pnpm package`        | Package the extension as a VSIX                                     |
| `pnpm test:e2e`       | Browser end-to-end tests (Playwright; install Chromium once)        |

## Features

- **Workflows**: create, rename, duplicate, delete and switch with one click.
- **Use cases**: scenarios with input variables that share one diagram; switch with one click.
- **Nodes**: Trigger, Action, Condition (ordered routes plus one optional `else` fallback) and End, each with description, notes and links.
- **Auto Layout**: ELK.js, left to right with vertical branching. It only runs when requested; manual positions are kept.
- **Simulation**: Run, Pause/Resume, Step, Reset and speed. Active, completed, skipped and error states, plus an execution log that explains each routing decision.
- **Validation**: missing triggers/ends, dangling nodes, missing condition inputs, ambiguous routes and cycles are reported (cycles are also blocked while connecting).
- **Persistence**: in VS Code, open/save workflow JSON through the host's file dialogs and filesystem API; browser development uses debounced localStorage autosave. Import/export are validated with Zod.
- **Undo/redo**, light/dark theme, collapsible side panels.

## Keyboard shortcuts

| Key                                      | Action                      |
| ---------------------------------------- | --------------------------- |
| `Ctrl/Cmd + Z`                           | Undo                        |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo                        |
| `R`                                      | Run / Pause                 |
| `S`                                      | Step                        |
| `Esc`                                    | Reset simulation / deselect |
| `L`                                      | Auto layout                 |
| `Delete` / `Backspace`                   | Delete selection            |

## Architecture

```text
src/
  app/            App shell and keyboard shortcuts
  components/     layout (sidebar), canvas, nodes, panels, simulation, ui
  lib/
    schemas/          Zod schemas and types (JSON format, version 1)
    workflow-engine/  Pure, React-free: conditions, graph, validation, simulation
    storage/          localStorage and JSON import/export
    layout/           ELK auto layout (loaded lazily)
    demo-project.ts   Example project
  stores/         Zustand: project (with undo/redo), simulation, ui, autosave
  extension/      VS Code command, webview, workspace file operations and navigation
  shared/         Typed host/webview messages
```

- The **engine** executes by following edges, never coordinates, and never uses `eval`.
- **Simulation state** lives in its own store and is never saved in the project.
- Conditions support `equals`, `not equals`, `greater than`, `less than`, `is true` and `is false`.
- UI components follow the shadcn/ui approach (Tailwind + class-variance-authority) and are written directly in `src/components/ui`.
