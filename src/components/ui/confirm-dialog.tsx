import { useEffect } from 'react'
import { Button } from './button'

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  useEffect(() => {
    if (!request) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request, onClose])

  if (!request) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-soft"
      >
        <h2 id="confirm-title" className="text-sm font-semibold">
          {request.title}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{request.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              request.onConfirm()
              onClose()
            }}
          >
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
