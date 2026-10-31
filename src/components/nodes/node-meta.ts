import { Flag, GitBranch, Play, Zap, type LucideIcon } from 'lucide-react'
import type { NodeType } from '@/lib/schemas/project'

export const NODE_META: Record<
  NodeType,
  { label: string; icon: LucideIcon; text: string; bg: string; border: string; hint: string }
> = {
  trigger: {
    label: 'Trigger',
    icon: Zap,
    text: 'text-trigger',
    bg: 'bg-trigger/12',
    border: 'border-trigger/40',
    hint: 'Where the workflow starts',
  },
  action: {
    label: 'Action',
    icon: Play,
    text: 'text-action',
    bg: 'bg-action/12',
    border: 'border-action/40',
    hint: 'An operation or process',
  },
  condition: {
    label: 'Condition',
    icon: GitBranch,
    text: 'text-condition',
    bg: 'bg-condition/15',
    border: 'border-condition/45',
    hint: 'Branches based on an input',
  },
  end: {
    label: 'End',
    icon: Flag,
    text: 'text-end',
    bg: 'bg-end/12',
    border: 'border-end/40',
    hint: 'Where the workflow completes',
  },
}

export const NODE_TYPES: NodeType[] = ['trigger', 'action', 'condition', 'end']
