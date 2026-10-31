import { describe, expect, it } from 'vitest'
import { describeCondition, evaluateCondition, parseValue } from './conditions'

describe('parseValue', () => {
  it('parses booleans, numbers and text', () => {
    expect(parseValue('true')).toBe(true)
    expect(parseValue('false')).toBe(false)
    expect(parseValue('42')).toBe(42)
    expect(parseValue('hello')).toBe('hello')
    expect(parseValue('')).toBe('')
  })
})

describe('evaluateCondition', () => {
  const inputs = { enabled: true, count: 5, name: 'ada' }

  it('evaluates boolean operators', () => {
    expect(evaluateCondition({ variable: 'enabled', operator: 'isTrue' }, inputs)).toMatchObject({
      ok: true,
      matched: true,
    })
    expect(evaluateCondition({ variable: 'enabled', operator: 'isFalse' }, inputs)).toMatchObject({
      ok: true,
      matched: false,
    })
  })

  it('evaluates equality and inequality', () => {
    expect(evaluateCondition({ variable: 'name', operator: 'equals', value: 'ada' }, inputs)).toMatchObject({
      matched: true,
    })
    expect(
      evaluateCondition({ variable: 'name', operator: 'notEquals', value: 'ada' }, inputs),
    ).toMatchObject({ matched: false })
    expect(evaluateCondition({ variable: 'count', operator: 'equals', value: 5 }, inputs)).toMatchObject({
      matched: true,
    })
  })

  it('compares numbers', () => {
    expect(evaluateCondition({ variable: 'count', operator: 'greaterThan', value: 3 }, inputs)).toMatchObject(
      { matched: true },
    )
    expect(evaluateCondition({ variable: 'count', operator: 'lessThan', value: 3 }, inputs)).toMatchObject({
      matched: false,
    })
  })

  it('reports missing inputs and non-numeric comparisons', () => {
    expect(evaluateCondition({ variable: 'nope', operator: 'isTrue' }, inputs)).toEqual({
      ok: false,
      error: 'Missing input "nope" in this use case',
    })
    expect(evaluateCondition({ variable: 'name', operator: 'greaterThan', value: 1 }, inputs).ok).toBe(false)
    expect(evaluateCondition({ variable: '', operator: 'isTrue' }, inputs).ok).toBe(false)
  })

  it('never evaluates code', () => {
    const result = evaluateCondition(
      { variable: 'name', operator: 'equals', value: 'process.exit(1)' },
      inputs,
    )
    expect(result).toMatchObject({ ok: true, matched: false })
  })

  it('describes conditions readably', () => {
    expect(describeCondition({ variable: 'a', operator: 'isTrue' })).toBe('a is true')
    expect(describeCondition({ variable: 'n', operator: 'greaterThan', value: 3 })).toBe('n > 3')
  })
})
