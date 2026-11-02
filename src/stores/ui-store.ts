import { create } from 'zustand'

const THEME_KEY = 'workflow-studio:theme'
export type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // storage unavailable: fall back to the system preference
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface UiStore {
  theme: Theme
  leftOpen: boolean
  rightOpen: boolean
  logOpen: boolean
  notice: { kind: 'error' | 'info'; message: string } | null
  extensionActive: boolean
  fileName: string | null
  fileDirty: boolean
  toggleTheme: () => void
  setLeftOpen: (open: boolean) => void
  setRightOpen: (open: boolean) => void
  setLogOpen: (open: boolean) => void
  setNotice: (notice: UiStore['notice']) => void
  setFileState: (fileName: string | null, fileDirty: boolean) => void
}

export const useUiStore = create<UiStore>()((set, get) => ({
  theme: initialTheme(),
  leftOpen: true,
  rightOpen: true,
  logOpen: true,
  notice: null,
  extensionActive: false,
  fileName: null,
  fileDirty: false,
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // preference simply isn't remembered
    }
    set({ theme })
  },
  setLeftOpen: (leftOpen) => set({ leftOpen }),
  setRightOpen: (rightOpen) => set({ rightOpen }),
  setLogOpen: (logOpen) => set({ logOpen }),
  setNotice: (notice) => set({ notice }),
  setFileState: (fileName, fileDirty) => set({ extensionActive: true, fileName, fileDirty }),
}))
