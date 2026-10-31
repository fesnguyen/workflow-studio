import type {
  Condition,
  NodeType,
  ProjectFile,
  UseCase,
  WorkflowEdge,
  WorkflowNode,
} from '@/lib/schemas/project'
import { PROJECT_VERSION } from '@/lib/schemas/project'

const node = (
  id: string,
  type: NodeType,
  title: string,
  x: number,
  y: number,
  extra: Partial<WorkflowNode> = {},
): WorkflowNode => ({ id, type, title, description: '', notes: '', links: [], position: { x, y }, ...extra })

const route = (
  id: string,
  source: string,
  target: string,
  priority: number,
  condition?: Condition,
  label?: string,
): WorkflowEdge => ({
  id,
  source,
  target,
  priority,
  fallback: !condition && source.startsWith('c'),
  ...(condition ? { condition } : {}),
  ...(label ? { label } : {}),
})

const makeUseCase = (id: string, name: string, description: string, inputs: UseCase['inputs']): UseCase => ({
  id,
  name,
  description,
  notes: '',
  inputs,
})

const isTrue = (variable: string): Condition => ({ variable, operator: 'isTrue' })

export function createDemoProject(): ProjectFile {
  return {
    version: PROJECT_VERSION,
    project: {
      id: 'workflow-examples',
      name: 'Workflow Examples',
      description: 'Sample workflows to explore, edit and simulate.',
    },
    workflows: [
      {
        id: 'event-scheduler',
        name: 'Event Scheduler',
        description: 'Decides how a scheduled event is delivered.',
        nodes: [
          node('trigger', 'trigger', 'Event triggered', 0, 140, {
            description: 'A scheduled event reaches its start time.',
          }),
          node('c-enabled', 'condition', 'Event enabled?', 300, 140, {
            description: 'Disabled events are skipped entirely.',
            notes: 'The enabled flag is edited by the user in the event settings.',
          }),
          node('c-audio', 'condition', 'Audio available?', 600, 40, {
            description: 'Checks whether speech audio was prepared in advance.',
          }),
          node('play', 'action', 'Play audio', 900, -40, {
            description: 'Plays the prepared audio through the speaker.',
          }),
          node('notify', 'action', 'Send notification', 900, 120, {
            description: 'Falls back to a text notification.',
          }),
          node('skip', 'action', 'Skip event', 900, 280, {
            description: 'Nothing is delivered for disabled events.',
          }),
          node('end', 'end', 'Complete', 1200, 140, { description: 'The event has been handled.' }),
        ],
        edges: [
          route('e1', 'trigger', 'c-enabled', 0),
          route('e2', 'c-enabled', 'c-audio', 0, isTrue('eventEnabled')),
          route('e3', 'c-enabled', 'skip', 1),
          route('e4', 'c-audio', 'play', 0, isTrue('audioAvailable')),
          route('e5', 'c-audio', 'notify', 1),
          route('e6', 'play', 'end', 0),
          route('e7', 'notify', 'end', 0),
          route('e8', 'skip', 'end', 0),
        ],
        useCases: [
          makeUseCase('audio-available', 'Audio available', 'Enabled event with prepared audio.', {
            eventEnabled: true,
            audioAvailable: true,
          }),
          makeUseCase('audio-unavailable', 'Audio unavailable', 'Enabled event without audio.', {
            eventEnabled: true,
            audioAvailable: false,
          }),
          makeUseCase('event-disabled', 'Event disabled', 'The user turned the event off.', {
            eventEnabled: false,
            audioAvailable: true,
          }),
        ],
      },
      {
        id: 'authentication',
        name: 'Authentication',
        description: 'Validates a login request and decides whether to allow it.',
        nodes: [
          node('trigger', 'trigger', 'Login request received', 0, 140, {
            description: 'A user submits their email and password.',
          }),
          node('validate', 'action', 'Validate credentials', 280, 140, {
            description: 'Compares the password hash with the stored one.',
          }),
          node('c-valid', 'condition', 'Credentials valid?', 560, 140),
          node('c-active', 'condition', 'Account active?', 840, 40, {
            description: 'Disabled accounts cannot sign in.',
          }),
          node('allow', 'action', 'Allow login', 1120, 40, {
            description: 'Creates a session for the user.',
          }),
          node('reject-credentials', 'action', 'Reject: invalid credentials', 1120, 240),
          node('reject-disabled', 'action', 'Reject: account disabled', 1120, 140),
          node('end-ok', 'end', 'Login successful', 1400, 40),
          node('end-rejected', 'end', 'Login rejected', 1400, 200),
        ],
        edges: [
          route('e1', 'trigger', 'validate', 0),
          route('e2', 'validate', 'c-valid', 0),
          route('e3', 'c-valid', 'c-active', 0, isTrue('credentialsValid')),
          route('e4', 'c-valid', 'reject-credentials', 1),
          route('e5', 'c-active', 'allow', 0, isTrue('accountActive')),
          route('e6', 'c-active', 'reject-disabled', 1),
          route('e7', 'allow', 'end-ok', 0),
          route('e8', 'reject-credentials', 'end-rejected', 0),
          route('e9', 'reject-disabled', 'end-rejected', 0),
        ],
        useCases: [
          makeUseCase('success', 'Successful login', 'Valid credentials, active account.', {
            credentialsValid: true,
            accountActive: true,
          }),
          makeUseCase('invalid', 'Invalid credentials', 'Wrong password.', {
            credentialsValid: false,
            accountActive: true,
          }),
          makeUseCase('disabled', 'Disabled account', 'Correct password, but the account is disabled.', {
            credentialsValid: true,
            accountActive: false,
          }),
        ],
      },
    ],
  }
}
