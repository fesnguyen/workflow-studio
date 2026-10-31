import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/app'
import { startAutosave } from '@/stores/autosave'
import { useProjectStore } from '@/stores/project-store'
import './index.css'

startAutosave(useProjectStore)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
