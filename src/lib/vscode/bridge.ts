import { parseProject } from '@/lib/storage/project-storage'
import type { HostMessage, WebviewMessage } from '@/shared/messages'
import type { ProjectStore } from '@/stores/project-store'
import { useUiStore } from '@/stores/ui-store'
import type { StoreApi } from 'zustand'

interface VsCodeApi {
  postMessage(message: HostMessage): void
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi
  }
}

const vscode = typeof window.acquireVsCodeApi === 'function' ? window.acquireVsCodeApi() : null

export const isVsCodeWebview = vscode !== null

export function postHostMessage(message: HostMessage): void {
  vscode?.postMessage(message)
}

export function startWebviewBridge(store: StoreApi<ProjectStore>): () => void {
  if (!vscode) return () => {}

  let replacingProject = false
  let loaded = false
  const unsubscribe = store.subscribe((state, previous) => {
    if (!loaded || replacingProject || state.project === previous.project) return
    postHostMessage({ type: 'projectChanged', project: state.project })
  })

  const onMessage = (event: MessageEvent<WebviewMessage>) => {
    const message = event.data
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') return
    if (message.type === 'projectLoaded') {
      const parsed = parseProject(JSON.stringify(message.project))
      if (!parsed.ok) {
        useUiStore.getState().setNotice({ kind: 'error', message: parsed.error })
        return
      }
      replacingProject = true
      store.getState().replaceProject(parsed.project)
      replacingProject = false
      loaded = true
      useUiStore.getState().setFileState(message.fileName, false)
      return
    }
    if (message.type === 'fileState') {
      useUiStore.getState().setFileState(message.fileName, message.dirty)
    } else if (message.type === 'navigationWarning') {
      useUiStore.getState().setNotice({ kind: 'info', message: message.message })
    }
  }

  window.addEventListener('message', onMessage)
  postHostMessage({ type: 'ready' })
  return () => {
    unsubscribe()
    window.removeEventListener('message', onMessage)
  }
}
