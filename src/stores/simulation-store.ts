import { create } from 'zustand'
import type { UseCase, Workflow } from '@/lib/schemas/project'
import {
  isFinished,
  startSimulation,
  stepSimulation,
  type SimulationState,
} from '@/lib/workflow-engine/simulation'

export const SPEEDS = { slow: 1400, normal: 800, fast: 350 } as const
export type SpeedKey = keyof typeof SPEEDS

interface Context {
  workflow: Workflow
  useCase: UseCase
}

interface SimulationStore {
  /** null means "not simulating" (editing mode). */
  sim: SimulationState | null
  playing: boolean
  speed: SpeedKey
  context: Context | null
  run: (workflow: Workflow, useCase: UseCase) => void
  pause: () => void
  step: (workflow: Workflow, useCase: UseCase) => void
  reset: () => void
  setSpeed: (speed: SpeedKey) => void
}

// Execution state lives outside the project document and is never persisted.
export const NO_USE_CASE: UseCase = { id: '', name: 'No use case', description: '', notes: '', inputs: {} }

let timer: ReturnType<typeof setTimeout> | undefined
const clearTimer = () => {
  if (timer) clearTimeout(timer)
  timer = undefined
}

export const useSimulationStore = create<SimulationStore>()((set, get) => {
  const tick = () => {
    const { sim, context, playing, speed } = get()
    if (!playing || !sim || !context) return
    const next = stepSimulation(context.workflow, context.useCase, sim)
    const done = isFinished(next)
    set({ sim: next, playing: !done })
    if (!done) timer = setTimeout(tick, SPEEDS[speed])
  }

  const begin = (workflow: Workflow, useCase: UseCase) => {
    const sim = startSimulation(workflow, useCase)
    set({ sim, context: { workflow, useCase } })
    return sim
  }

  return {
    sim: null,
    playing: false,
    speed: 'normal',
    context: null,

    run: (workflow, useCase) => {
      clearTimer()
      let sim = get().sim
      if (!sim || isFinished(sim)) sim = begin(workflow, useCase)
      if (isFinished(sim)) return set({ playing: false })
      set({ playing: true })
      timer = setTimeout(tick, SPEEDS[get().speed])
    },

    pause: () => {
      clearTimer()
      set({ playing: false })
    },

    step: (workflow, useCase) => {
      clearTimer()
      const current = get().sim
      if (!current || isFinished(current)) {
        begin(workflow, useCase)
        set({ playing: false })
        return
      }
      const context = get().context ?? { workflow, useCase }
      set({ sim: stepSimulation(context.workflow, context.useCase, current), playing: false })
    },

    reset: () => {
      clearTimer()
      set({ sim: null, playing: false, context: null })
    },

    setSpeed: (speed) => set({ speed }),
  }
})
