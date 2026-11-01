import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/app'
import { isVsCodeWebview, startWebviewBridge } from '@/lib/vscode/bridge'
import { startAutosave } from '@/stores/autosave'
import { useProjectStore } from '@/stores/project-store'
import './index.css'

if (!isVsCodeWebview) startAutosave(useProjectStore)
startWebviewBridge(useProjectStore)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
