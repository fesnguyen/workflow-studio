import { z } from 'zod'
import { projectFileSchema } from '@/lib/schemas/project'

export function createAiInstruction(): string {
  const schema = z.toJSONSchema(projectFileSchema)
  return `Inspect the current repository and document its actual business and execution workflows as one Workflow Studio JSON project.

Trace relevant entry points, services, handlers, and function calls. Model real control flow, branches, and outcomes; include useful scenarios and conditions. Do not invent behavior or use AI/API assumptions not present in the code.

Include source metadata on relevant nodes using workspace-relative file paths and qualified symbols. Include class constructor parameters, base classes and implemented interfaces; function/method parameters with types and descriptions, return types where known, concise descriptions, and called functions with navigable source references. Only report facts supported by the repository.

Return only one valid JSON document compatible with the following current Workflow Studio schema. Do not wrap it in Markdown or add commentary.

${JSON.stringify(schema, null, 2)}
`
}
