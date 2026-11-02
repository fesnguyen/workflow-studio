import { describe, expect, it } from 'vitest'
import { createAiInstruction } from './ai-instruction'

describe('AI instruction', () => {
  it('includes the current workflow schema and source metadata', () => {
    const instruction = createAiInstruction()
    expect(instruction).toContain('"version"')
    expect(instruction).toContain('"source"')
    expect(instruction).toContain('"constructorParameters"')
    expect(instruction).toContain('"calls"')
  })
})
