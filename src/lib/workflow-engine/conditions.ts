import type { Condition, InputValue } from '@/lib/schemas/project'

export const OPERATOR_LABELS: Record<Condition['operator'], string> = {
  equals: 'equals',
  notEquals: 'does not equal',
  greaterThan: 'is greater than',
  lessThan: 'is less than',
  isTrue: 'is true',
  isFalse: 'is false',
}

const SYMBOLS: Record<Condition['operator'], string> = {
  equals: '=',
  notEquals: '≠',
  greaterThan: '>',
  lessThan: '<',
  isTrue: 'is true',
  isFalse: 'is false',
}

/** Converts user-typed text to a typed value: true/false, numbers, otherwise text. */
export function parseValue(text: string): InputValue {
  const trimmed = text.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed)
  return text
}

export function formatValue(value: InputValue | undefined): string {
  return value === undefined ? '' : String(value)
}

export function needsValue(operator: Condition['operator']): boolean {
  return operator !== 'isTrue' && operator !== 'isFalse'
}

export function describeCondition(condition: Condition): string {
  const variable = condition.variable || '?'
  if (!needsValue(condition.operator)) return `${variable} ${SYMBOLS[condition.operator]}`
  return `${variable} ${SYMBOLS[condition.operator]} ${formatValue(condition.value)}`
}

export type EvaluationResult =
  { ok: true; matched: boolean; actual: InputValue } | { ok: false; error: string }

/** Pure, safe condition evaluation. No code is ever executed. */
export function evaluateCondition(
  condition: Condition,
  inputs: Record<string, InputValue>,
): EvaluationResult {
  if (!condition.variable.trim()) return { ok: false, error: 'A condition has no variable set' }
  if (!Object.hasOwn(inputs, condition.variable)) {
    return { ok: false, error: `Missing input "${condition.variable}" in this use case` }
  }
  const actual = inputs[condition.variable] as InputValue
  const expected = condition.value ?? ''

  switch (condition.operator) {
    case 'isTrue':
      return { ok: true, matched: actual === true, actual }
    case 'isFalse':
      return { ok: true, matched: actual === false, actual }
    case 'equals':
      return { ok: true, matched: String(actual) === String(expected), actual }
    case 'notEquals':
      return { ok: true, matched: String(actual) !== String(expected), actual }
    case 'greaterThan':
    case 'lessThan': {
      const a = typeof actual === 'number' ? actual : Number(actual)
      const b = typeof expected === 'number' ? expected : Number(expected)
      if (Number.isNaN(a) || Number.isNaN(b) || actual === '' || expected === '') {
        return { ok: false, error: `"${condition.variable}" must be compared with numbers` }
      }
      return { ok: true, matched: condition.operator === 'greaterThan' ? a > b : a < b, actual }
    }
  }
}
