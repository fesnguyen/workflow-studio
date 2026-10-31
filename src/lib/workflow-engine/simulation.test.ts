import { describe, expect, it } from 'vitest'
import { createDemoProject } from '@/lib/demo-project'
import type { Workflow } from '@/lib/schemas/project'
import { canConnect, hasCycle } from './graph'
import { nodeVisualState, runSimulation, startSimulation, stepSimulation } from './simulation'
import { validateWorkflow } from './validate'

const demo = createDemoProject()
const scheduler = demo.workflows[0] as Workflow
const auth = demo.workflows[1] as Workflow
const useCase = (wf: Workflow, id: string) => wf.useCases.find((u) => u.id === id)!
const visited = (sim: ReturnType<typeof runSimulation>) => sim.completedNodeIds

describe('demo workflows', () => {
  it('are structurally valid and acyclic', () => {
    for (const wf of demo.workflows) {
      expect(validateWorkflow(wf).filter((i) => i.level === 'error')).toEqual([])
      expect(hasCycle(wf)).toBe(false)
    }
  })

  it('Event Scheduler follows each use case route', () => {
    const play = runSimulation(scheduler, useCase(scheduler, 'audio-available'))
    expect(play.status).toBe('completed')
    expect(visited(play)).toEqual(['trigger', 'c-enabled', 'c-audio', 'play', 'end'])

    const notify = runSimulation(scheduler, useCase(scheduler, 'audio-unavailable'))
    expect(visited(notify)).toEqual(['trigger', 'c-enabled', 'c-audio', 'notify', 'end'])

    const skipped = runSimulation(scheduler, useCase(scheduler, 'event-disabled'))
    expect(visited(skipped)).toEqual(['trigger', 'c-enabled', 'skip', 'end'])
  })

  it('Authentication follows each use case route', () => {
    expect(visited(runSimulation(auth, useCase(auth, 'success')))).toEqual([
      'trigger',
      'validate',
      'c-valid',
      'c-active',
      'allow',
      'end-ok',
    ])
    expect(visited(runSimulation(auth, useCase(auth, 'invalid')))).toEqual([
      'trigger',
      'validate',
      'c-valid',
      'reject-credentials',
      'end-rejected',
    ])
    expect(visited(runSimulation(auth, useCase(auth, 'disabled')))).toEqual([
      'trigger',
      'validate',
      'c-valid',
      'c-active',
      'reject-disabled',
      'end-rejected',
    ])
  })

  it('branches merge without executing unrelated branches', () => {
    const sim = runSimulation(scheduler, useCase(scheduler, 'audio-available'))
    expect(sim.completedNodeIds).not.toContain('notify')
    expect(sim.completedNodeIds).not.toContain('skip')
    expect(nodeVisualState(sim, 'notify')).toBe('skipped')
    expect(nodeVisualState(sim, 'end')).toBe('completed')
    expect(nodeVisualState(null, 'end')).toBe('idle')
  })
})

describe('step-by-step execution', () => {
  it('moves one node per step and makes the End node active before completing', () => {
    const uc = useCase(scheduler, 'event-disabled')
    let sim = startSimulation(scheduler, uc)
    expect(sim.currentNodeId).toBe('trigger')
    sim = stepSimulation(scheduler, uc, sim)
    expect(sim.currentNodeId).toBe('c-enabled')
    expect(sim.activeEdgeId).toBe('e1')
    sim = stepSimulation(scheduler, uc, sim)
    expect(sim.currentNodeId).toBe('skip')
    expect(sim.log.at(-1)?.details?.join(' ')).toContain('fallback')
    sim = stepSimulation(scheduler, uc, sim)
    expect(sim.currentNodeId).toBe('end')
    expect(sim.status).toBe('active')
    sim = stepSimulation(scheduler, uc, sim)
    expect(sim.status).toBe('completed')
    expect(stepSimulation(scheduler, uc, sim)).toBe(sim)
  })

  it('explains why a route was selected', () => {
    const sim = runSimulation(scheduler, useCase(scheduler, 'audio-available'))
    const details = sim.log.flatMap((l) => l.details ?? []).join('\n')
    expect(details).toContain('eventEnabled is true → matched')
  })
})

describe('errors', () => {
  it('reports missing inputs as readable errors', () => {
    const sim = runSimulation(scheduler, { ...useCase(scheduler, 'audio-available'), inputs: {} })
    expect(sim.status).toBe('error')
    expect(sim.errorNodeId).toBe('c-enabled')
    expect(sim.log.at(-1)?.message).toContain('Missing input "eventEnabled"')
  })

  it('reports unmatched conditions without a fallback', () => {
    const wf: Workflow = {
      ...scheduler,
      edges: scheduler.edges.filter((e) => e.id !== 'e3'),
    }
    const sim = runSimulation(wf, useCase(scheduler, 'event-disabled'))
    expect(sim.status).toBe('error')
    expect(sim.log.at(-1)?.message).toContain('no fallback')
  })

  it('first matching route wins by priority', () => {
    const wf: Workflow = {
      ...scheduler,
      edges: scheduler.edges.map((e) =>
        e.id === 'e3'
          ? {
              ...e,
              fallback: false,
              priority: 0,
              condition: { variable: 'eventEnabled', operator: 'isTrue' as const },
            }
          : e.id === 'e2'
            ? { ...e, priority: 1 }
            : e,
      ),
    }
    const sim = runSimulation(wf, useCase(scheduler, 'audio-available'))
    expect(sim.completedNodeIds).toContain('skip')
    expect(sim.completedNodeIds).not.toContain('c-audio')
  })

  it('rejects cycles with a clear message and refuses to run', () => {
    const cyclic: Workflow = {
      ...scheduler,
      edges: [
        ...scheduler.edges,
        { id: 'loop', source: 'play', target: 'c-enabled', fallback: false, priority: 1 },
      ],
    }
    expect(hasCycle(cyclic)).toBe(true)
    const sim = runSimulation(cyclic, useCase(scheduler, 'audio-available'))
    expect(sim.status).toBe('error')
    expect(sim.log.map((l) => l.message).join(' ')).toContain('cycle')
  })

  it('detects missing connections and triggers', () => {
    const wf: Workflow = { ...scheduler, edges: scheduler.edges.filter((e) => e.id !== 'e6') }
    expect(validateWorkflow(wf).some((i) => i.level === 'error' && i.nodeId === 'play')).toBe(true)
    const noTrigger: Workflow = { ...scheduler, nodes: scheduler.nodes.filter((n) => n.type !== 'trigger') }
    expect(validateWorkflow(noTrigger).some((i) => i.message.includes('Trigger'))).toBe(true)
  })
})

describe('canConnect', () => {
  it('blocks invalid connections', () => {
    expect(canConnect(scheduler, 'end', 'play').ok).toBe(false)
    expect(canConnect(scheduler, 'play', 'trigger').ok).toBe(false)
    expect(canConnect(scheduler, 'play', 'play').ok).toBe(false)
    expect(canConnect(scheduler, 'play', 'skip').ok).toBe(false) // actions have one outgoing route
    expect(canConnect(scheduler, 'c-audio', 'play').ok).toBe(false) // duplicate
    expect(canConnect(scheduler, 'c-audio', 'trigger').ok).toBe(false)
  })

  it('prevents cycles and allows extra condition routes', () => {
    const open: Workflow = { ...scheduler, edges: scheduler.edges.filter((e) => e.id !== 'e8') }
    expect(canConnect(open, 'skip', 'c-enabled')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('cycle'),
    })
    expect(canConnect(scheduler, 'c-audio', 'skip').ok).toBe(true)
  })
})
