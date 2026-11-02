import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/fields'
import type {
  NodeSource,
  SourceFileReference,
  SourceParameter,
  SourceSymbolReference,
  WorkflowNode,
} from '@/lib/schemas/project'
import { postHostMessage } from '@/lib/vscode/bridge'
import { useProjectStore } from '@/stores/project-store'

function ReferenceButton({
  reference,
  children,
}: {
  reference: SourceFileReference | SourceSymbolReference
  children: React.ReactNode
}) {
  return (
    <button
      className="inline-flex max-w-full items-center gap-1 text-left text-xs text-accent underline-offset-2 hover:underline"
      onClick={() => postHostMessage({ type: 'navigate', reference })}
      title={'path' in reference ? reference.description : reference.qualifiedName}
    >
      <ExternalLink className="size-3 shrink-0" />
      <span className="truncate">{children}</span>
    </button>
  )
}

function Parameters({ title, parameters }: { title: string; parameters?: SourceParameter[] }) {
  if (!parameters?.length) return null
  return (
    <div>
      <h4 className="mb-1 text-[11px] font-medium text-muted-foreground">{title}</h4>
      <ul className="space-y-1">
        {parameters.map((parameter, index) => (
          <li key={`${parameter.name}-${index}`} className="text-xs">
            <code>
              {parameter.name}
              {parameter.type ? `: ${parameter.type}` : ''}
            </code>
            {parameter.description && (
              <span className="text-muted-foreground"> — {parameter.description}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SourceDetails({ node }: { node: WorkflowNode }) {
  const updateNode = useProjectStore((state) => state.updateNode)
  const source = node.source ?? {}
  const patch = (next: NodeSource) => updateNode(node.id, { source: next })
  const filePath = source.file?.path ?? source.function?.filePath ?? source.class?.filePath ?? ''

  const setPath = (path: string) => {
    patch({
      ...source,
      file: { ...source.file, path },
      ...(source.class ? { class: { ...source.class, filePath: path } } : {}),
      ...(source.function ? { function: { ...source.function, filePath: path } } : {}),
    })
  }

  const addClass = () =>
    patch({
      ...source,
      class: {
        filePath,
        name: '',
        qualifiedName: '',
        constructorParameters: [],
        baseClasses: [],
        interfaces: [],
      },
    })
  const addFunction = () =>
    patch({
      ...source,
      function: {
        filePath,
        name: '',
        qualifiedName: '',
        parameters: [],
        calls: [],
      },
    })

  return (
    <section className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">Source code</h3>
        <div className="flex gap-1">
          {!source.class && (
            <Button variant="ghost" size="sm" onClick={addClass}>
              Class
            </Button>
          )}
          {!source.function && (
            <Button variant="ghost" size="sm" onClick={addFunction}>
              Function
            </Button>
          )}
        </div>
      </div>
      <Field label="Workspace-relative file">
        <Input
          aria-label="Source file path"
          placeholder="src/feature/example.ts"
          value={filePath}
          onChange={(event) => setPath(event.target.value)}
        />
      </Field>
      {source.file && (
        <div className="space-y-1">
          <ReferenceButton reference={source.file}>{source.file.path || 'Open source file'}</ReferenceButton>
          {source.file.description && (
            <p className="text-xs text-muted-foreground">{source.file.description}</p>
          )}
        </div>
      )}
      {source.class && (
        <div className="space-y-2 rounded-lg bg-muted/50 p-2">
          <Field label="Class qualified name">
            <Input
              aria-label="Class qualified name"
              placeholder="Namespace.ClassName"
              value={source.class.qualifiedName ?? source.class.name}
              onChange={(event) =>
                patch({
                  ...source,
                  class: {
                    ...source.class!,
                    name: event.target.value.split('.').at(-1) ?? '',
                    qualifiedName: event.target.value,
                  },
                })
              }
            />
          </Field>
          <ReferenceButton
            reference={{
              filePath: source.class.filePath,
              name: source.class.name,
              qualifiedName: source.class.qualifiedName,
            }}
          >
            {source.class.qualifiedName ?? source.class.name}
          </ReferenceButton>
          <Parameters title="Constructor parameters" parameters={source.class.constructorParameters} />
          {source.class.baseClasses?.map((reference, index) => (
            <div key={`base-${index}`}>
              <span className="mr-1 text-xs text-muted-foreground">Base:</span>
              <ReferenceButton reference={reference}>
                {reference.qualifiedName ?? reference.name}
              </ReferenceButton>
            </div>
          ))}
          {source.class.interfaces?.map((reference, index) => (
            <div key={`interface-${index}`}>
              <span className="mr-1 text-xs text-muted-foreground">Implements:</span>
              <ReferenceButton reference={reference}>
                {reference.qualifiedName ?? reference.name}
              </ReferenceButton>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => patch({ ...source, class: undefined })}>
            Remove class reference
          </Button>
        </div>
      )}
      {source.function && (
        <div className="space-y-2 rounded-lg bg-muted/50 p-2">
          <Field label="Function / method qualified name">
            <Input
              aria-label="Function qualified name"
              placeholder="Namespace.ClassName.method"
              value={source.function.qualifiedName ?? source.function.name}
              onChange={(event) =>
                patch({
                  ...source,
                  function: {
                    ...source.function!,
                    name: event.target.value.split('.').at(-1) ?? '',
                    qualifiedName: event.target.value,
                  },
                })
              }
            />
          </Field>
          <ReferenceButton reference={source.function}>
            {source.function.qualifiedName ?? source.function.name}
          </ReferenceButton>
          {source.function.description && (
            <p className="text-xs text-muted-foreground">{source.function.description}</p>
          )}
          <Parameters title="Parameters" parameters={source.function.parameters} />
          {source.function.returnType && (
            <p className="text-xs">
              Returns: <code>{source.function.returnType}</code>
            </p>
          )}
          {source.function.calls?.map((reference, index) => (
            <div key={`call-${index}`}>
              <span className="mr-1 text-xs text-muted-foreground">Calls:</span>
              <ReferenceButton reference={reference}>
                {reference.qualifiedName ?? reference.name}
              </ReferenceButton>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => patch({ ...source, function: undefined })}>
            Remove function reference
          </Button>
        </div>
      )}
    </section>
  )
}
