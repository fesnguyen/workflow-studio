import { useReactFlow } from '@xyflow/react'
import {
  ChevronDown,
  Maximize,
  PanelLeftOpen,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  SkipForward,
  Undo2,
  Wand2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NODE_META, NODE_TYPES } from '@/components/nodes/node-meta'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/fields'
import { computeLayout } from '@/lib/layout/auto-layout'
import type { NodeType, Workflow } from '@/lib/schemas/project'
import { isFinished } from '@/lib/workflow-engine/simulation'
import { selectActiveUseCase, selectActiveWorkflow, useProjectStore } from '@/stores/project-store'
import { NO_USE_CASE, SPEEDS, useSimulationStore, type SpeedKey } from '@/stores/simulation-store'
import { useUiStore } from '@/stores/ui-store'

const bar =
  'absolute top-3 z-10 flex items-center gap-1 rounded-xl border bg-card/95 p-1 shadow-soft backdrop-blur'

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
}

interface EditToolbarProps {
  locked: boolean
  workflow: Workflow
  getAddPosition: () => { x: number; y: number }
}

export function EditToolbar({ locked, workflow, getAddPosition }: EditToolbarProps) {
  const rf = useReactFlow()
  const leftOpen = useUiStore((s) => s.leftOpen)
  const setLeftOpen = useUiStore((s) => s.setLeftOpen)
  const canUndo = useProjectStore((s) => s.past.length > 0)
  const canRedo = useProjectStore((s) => s.future.length > 0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [layingOut, setLayingOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menuOpen])

  const add = (type: NodeType) => {
    useProjectStore.getState().addNode(type, getAddPosition())
    setMenuOpen(false)
  }

  const autoLayout = async () => {
    setLayingOut(true)
    try {
      useProjectStore.getState().applyLayout(await computeLayout(workflow))
    } finally {
      setLayingOut(false)
    }
  }

  return (
    <div className={`${bar} left-3`} role="toolbar" aria-label="Editing tools">
      {!leftOpen && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLeftOpen(true)}
            title="Show navigation"
            aria-label="Show navigation"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
          <Divider />
        </>
      )}
      <div ref={menuRef} className="relative">
        <Button
          variant="secondary"
          onClick={() => setMenuOpen((o) => !o)}
          disabled={locked}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <Plus className="size-4" /> Add node <ChevronDown className="size-3.5 opacity-60" />
        </Button>
        {menuOpen && (
          <div role="menu" className="absolute left-0 top-10 w-56 rounded-xl border bg-card p-1 shadow-soft">
            {NODE_TYPES.map((type) => {
              const meta = NODE_META[type]
              return (
                <button
                  key={type}
                  role="menuitem"
                  onClick={() => add(type)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                >
                  <span
                    className={`flex size-7 items-center justify-center rounded-md ${meta.bg} ${meta.text}`}
                  >
                    <meta.icon className="size-3.5" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium leading-tight">{meta.label}</span>
                    <span className="block text-xs text-muted-foreground">{meta.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void autoLayout()}
        disabled={locked || layingOut}
        title="Auto layout (L)"
        aria-label="Auto layout"
      >
        <Wand2 className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void rf.fitView({ padding: 0.08, maxZoom: 1, duration: 250 })}
        title="Fit to view"
        aria-label="Fit to view"
      >
        <Maximize className="size-4" />
      </Button>
      <Divider />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => useProjectStore.getState().undo()}
        disabled={locked || !canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => useProjectStore.getState().redo()}
        disabled={locked || !canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <Redo2 className="size-4" />
      </Button>
    </div>
  )
}

export function SimulationToolbar() {
  const workflow = useProjectStore(selectActiveWorkflow)
  const useCase = useProjectStore(selectActiveUseCase) ?? NO_USE_CASE
  const rightOpen = useUiStore((s) => s.rightOpen)
  const setRightOpen = useUiStore((s) => s.setRightOpen)
  const { sim, playing, speed, setSpeed } = useSimulationStore()
  const finished = isFinished(sim)

  if (!workflow) return null
  const { run, pause, step, reset } = useSimulationStore.getState()

  return (
    <div className={`${bar} right-3`} role="toolbar" aria-label="Simulation controls">
      <span
        className={`mx-1 hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium xl:flex ${
          sim ? 'bg-accent-soft text-accent' : 'text-muted-foreground'
        }`}
        data-testid="mode-badge"
      >
        <span className={`size-1.5 rounded-full ${sim ? 'bg-accent' : 'bg-muted-foreground/50'}`} />
        {sim ? 'Simulating' : 'Editing'} · {useCase.name}
      </span>
      {playing ? (
        <Button onClick={pause} title="Pause (R)" aria-label="Pause">
          <Pause className="size-4" /> Pause
        </Button>
      ) : (
        <Button
          onClick={() => run(workflow, useCase)}
          title="Run (R)"
          aria-label={sim && !finished ? 'Resume' : 'Run'}
        >
          <Play className="size-4" /> {sim && !finished ? 'Resume' : finished ? 'Run again' : 'Run'}
        </Button>
      )}
      <Button
        variant="secondary"
        size="icon"
        onClick={() => step(workflow, useCase)}
        disabled={playing}
        title="Step forward (S)"
        aria-label="Step"
      >
        <SkipForward className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={reset}
        disabled={!sim}
        title="Reset simulation (Esc)"
        aria-label="Reset"
      >
        <RotateCcw className="size-4" />
      </Button>
      <Select
        value={speed}
        onChange={(e) => setSpeed(e.target.value as SpeedKey)}
        className="h-8 w-[84px]"
        aria-label="Simulation speed"
        title="Simulation speed"
      >
        {(Object.keys(SPEEDS) as SpeedKey[]).map((key) => (
          <option key={key} value={key}>
            {key[0]?.toUpperCase() + key.slice(1)}
          </option>
        ))}
      </Select>
      {!rightOpen && (
        <>
          <Divider />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRightOpen(true)}
            title="Show properties"
            aria-label="Show properties"
          >
            <PanelRightOpen className="size-4" />
          </Button>
        </>
      )}
    </div>
  )
}
