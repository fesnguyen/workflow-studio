import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoProject } from '@/lib/demo-project'
import { isFinished } from '@/lib/workflow-engine/simulation'
import { SPEEDS, useSimulationStore } from './simulation-store'

const wf = createDemoProject().workflows[0]!
const useCase = wf.useCases[0]!
const sim = () => useSimulationStore.getState()

beforeEach(() => {
  vi.useFakeTimers()
  sim().reset()
})
afterEach(() => {
  sim().reset()
  vi.useRealTimers()
})

describe('simulation store', () => {
  it('steps one node at a time', () => {
    sim().step(wf, useCase)
    expect(sim().sim).not.toBeNull()
    const before = sim().sim!.log.length
    sim().step(wf, useCase)
    expect(sim().sim!.log.length).toBeGreaterThan(before)
    expect(sim().playing).toBe(false)
  })

  it('runs automatically, can pause, resume and finish', () => {
    sim().run(wf, useCase)
    expect(sim().playing).toBe(true)
    vi.advanceTimersByTime(SPEEDS.normal * 2)
    sim().pause()
    const paused = sim().sim!.log.length
    vi.advanceTimersByTime(SPEEDS.normal * 5)
    expect(sim().sim!.log.length).toBe(paused)

    sim().run(wf, useCase)
    vi.advanceTimersByTime(SPEEDS.normal * 20)
    expect(isFinished(sim().sim!)).toBe(true)
    expect(sim().playing).toBe(false)
  })

  it('resets back to editing mode', () => {
    sim().run(wf, useCase)
    sim().reset()
    expect(sim().sim).toBeNull()
    expect(sim().playing).toBe(false)
  })
})
