import { z } from 'zod'

export const PROJECT_VERSION = 1

const id = z.string().min(1)

export const inputValueSchema = z.union([z.string(), z.number(), z.boolean()])
export const nodeTypeSchema = z.enum(['trigger', 'action', 'condition', 'end'])
export const operatorSchema = z.enum(['equals', 'notEquals', 'greaterThan', 'lessThan', 'isTrue', 'isFalse'])

export const conditionSchema = z.object({
  variable: z.string(),
  operator: operatorSchema,
  value: inputValueSchema.optional(),
})

export const nodeSchema = z.object({
  id,
  type: nodeTypeSchema,
  title: z.string(),
  description: z.string().default(''),
  notes: z.string().default(''),
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  position: z.object({ x: z.number(), y: z.number() }),
})

export const edgeSchema = z.object({
  id,
  source: id,
  target: id,
  label: z.string().optional(),
  condition: conditionSchema.optional(),
  fallback: z.boolean().default(false),
  priority: z.number().default(0),
})

export const useCaseSchema = z.object({
  id,
  name: z.string(),
  description: z.string().default(''),
  notes: z.string().default(''),
  inputs: z.record(z.string(), inputValueSchema).default({}),
})

export const workflowSchema = z
  .object({
    id,
    name: z.string(),
    description: z.string().default(''),
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
    useCases: z.array(useCaseSchema).default([]),
  })
  .superRefine((wf, ctx) => {
    const nodeIds = new Set(wf.nodes.map((n) => n.id))
    const report = (message: string) => ctx.addIssue({ code: 'custom', message })
    if (nodeIds.size !== wf.nodes.length) report(`Workflow "${wf.name}" has duplicate node ids`)
    if (new Set(wf.edges.map((e) => e.id)).size !== wf.edges.length) {
      report(`Workflow "${wf.name}" has duplicate connection ids`)
    }
    if (new Set(wf.useCases.map((u) => u.id)).size !== wf.useCases.length) {
      report(`Workflow "${wf.name}" has duplicate use case ids`)
    }
    for (const e of wf.edges) {
      if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
        report(`Workflow "${wf.name}" has a connection to a missing node`)
        break
      }
    }
  })

export const projectFileSchema = z
  .object({
    version: z.literal(PROJECT_VERSION),
    project: z.object({
      id,
      name: z.string(),
      description: z.string().default(''),
    }),
    workflows: z.array(workflowSchema),
  })
  .superRefine((file, ctx) => {
    if (new Set(file.workflows.map((w) => w.id)).size !== file.workflows.length) {
      ctx.addIssue({ code: 'custom', message: 'Project has duplicate workflow ids' })
    }
  })

export type InputValue = z.infer<typeof inputValueSchema>
export type NodeType = z.infer<typeof nodeTypeSchema>
export type Operator = z.infer<typeof operatorSchema>
export type Condition = z.infer<typeof conditionSchema>
export type WorkflowNode = z.infer<typeof nodeSchema>
export type WorkflowEdge = z.infer<typeof edgeSchema>
export type UseCase = z.infer<typeof useCaseSchema>
export type Workflow = z.infer<typeof workflowSchema>
export type ProjectFile = z.infer<typeof projectFileSchema>
