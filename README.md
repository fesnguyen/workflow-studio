# Workflow Studio

A lightweight, browser-only visual workflow editor and simulator. **One project, multiple workflows. One workflow, multiple use cases.**

Design workflows with draggable nodes, document every step, define use cases with input variables, and watch the simulator walk the exact path each use case takes. Everything runs in the browser; the whole project is a single JSON document.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

The app opens with a **Workflow Examples** project (Event Scheduler and Authentication, three use cases each).

| Script          | Purpose                                                                         |
| --------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`      | Start the dev server                                                            |
| `pnpm build`    | Type-check and build for production                                             |
| `pnpm preview`  | Serve the production build                                                      |
| `pnpm test`     | Unit and component tests (Vitest, React Testing Library)                        |
| `pnpm test:e2e` | End-to-end tests (Playwright; run `pnpm exec playwright install chromium` once) |
| `pnpm check`    | Typecheck, lint, format check, tests and build                                  |

## Features

- **Workflows**: create, rename, duplicate, delete and switch with one click.
- **Use cases**: scenarios with input variables that share one diagram; switch with one click.
- **Nodes**: Trigger, Action, Condition (ordered routes plus one optional `else` fallback) and End, each with description, notes and links.
- **Auto Layout**: ELK.js, left to right with vertical branching. It only runs when requested; manual positions are kept.
- **Simulation**: Run, Pause/Resume, Step, Reset and speed. Active, completed, skipped and error states, plus an execution log that explains each routing decision.
- **Validation**: missing triggers/ends, dangling nodes, missing condition inputs, ambiguous routes and cycles are reported (cycles are also blocked while connecting).
- **Persistence**: debounced autosave to localStorage with storage-full warnings; export/import the whole project as JSON validated with Zod.
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
```

- The **engine** executes by following edges, never coordinates, and never uses `eval`.
- **Simulation state** lives in its own store and is never saved in the project.
- Conditions support `equals`, `not equals`, `greater than`, `less than`, `is true` and `is false`.
- UI components follow the shadcn/ui approach (Tailwind + class-variance-authority) and are written directly in `src/components/ui`.
