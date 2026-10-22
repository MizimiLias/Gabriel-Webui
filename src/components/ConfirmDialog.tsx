import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useAppSettings } from '../contexts/app-settings'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useAppSettings()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const previous = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    return () => previous?.focus()
  }, [open])

  if (!open) {
    return null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !busy) {
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) {
      return
    }
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) {
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex animate-[fade-in_160ms_ease_both] items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-[430px] animate-[rise-in_190ms_ease_both] rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6 shadow-[var(--shadow-float)] sm:p-7"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        onKeyDown={onKeyDown}
      >
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
          onClick={onClose}
          disabled={busy}
          aria-label={t('dismiss')}
        >
          <X size={17} />
        </button>
        <h2 id="dialog-title" className="font-serif text-2xl text-[var(--ink)]">
          {title}
        </h2>
        <div id="dialog-description" className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {description}
        </div>
        <div className="mt-7 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--liquid-border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-soft)]"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--danger)]/60 bg-[var(--danger)] px-4 text-sm font-semibold text-white transition-[filter] hover:brightness-95"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
