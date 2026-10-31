import { useState } from 'react'
import { Input } from '@/components/ui/fields'
import type { InputValue } from '@/lib/schemas/project'
import { formatValue, parseValue } from '@/lib/workflow-engine/conditions'

/** Text input that stores typed values (true/false/numbers) without fighting partial input like "1.". */
export function ValueInput({
  value,
  onChange,
  ...props
}: {
  value: InputValue | undefined
  onChange: (value: InputValue) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(formatValue(value))
  const shown = parseValue(text) === value ? text : formatValue(value)
  return (
    <Input
      {...props}
      value={shown}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseValue(e.target.value))
      }}
    />
  )
}
