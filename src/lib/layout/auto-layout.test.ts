import { describe, expect, it } from 'vitest'
import { createDemoProject } from '@/lib/demo-project'
import { computeLayout } from './auto-layout'

describe('computeLayout', () => {
  it('flows left to right and fans branches out vertically', async () => {
    const wf = createDemoProject().workflows[0]!
    const pos = await computeLayout(wf)
    for (const edge of wf.edges) {
      expect(pos[edge.target]!.x).toBeGreaterThan(pos[edge.source]!.x)
    }
    const ys = new Set([pos.play!.y, pos.notify!.y, pos.skip!.y])
    expect(ys.size).toBe(3)
  })
})
