import { useEffect, useRef, type KeyboardEvent } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppSettings } from '../contexts/app-settings'

interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
}

const MAX_LENGTH = 32_000

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
}: ComposerProps) {
  const { t } = useAppSettings()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canSend = value.trim().length > 0 && value.length <= MAX_LENGTH

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`
  }, [value])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      if (canSend && !isStreaming) {
        onSend()
      }
    }
  }

  return (
    <div className="relative z-[5] shrink-0 bg-gradient-to-b from-transparent via-[var(--canvas)]/95 to-[var(--canvas)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 md:px-6 md:pb-5 md:pt-3">
      <div
        className={clsx(
          'mx-auto w-full max-w-[812px] rounded-2xl border border-[var(--liquid-border)] bg-[var(--surface)] px-3.5 pb-2.5 pt-3 shadow-[var(--composer-shadow)] transition-[border-color,box-shadow] focus-within:border-[var(--blue-strong)]/55 focus-within:shadow-[var(--composer-shadow),0_0_0_3px_color-mix(in_srgb,var(--blue-strong)_9%,transparent)]',
          isStreaming && 'border-[var(--gold)]/45',
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('composerPlaceholder')}
          maxLength={MAX_LENGTH}
          rows={1}
          autoFocus
          className="block min-h-7 max-h-[220px] w-full resize-none border-0 bg-transparent text-sm leading-6 text-[var(--ink)] outline-none placeholder:text-[var(--muted-soft)]"
          aria-label={t('composerPlaceholder')}
        />
        <div className="flex min-h-8 items-end justify-between gap-3 pt-1">
          <div className="flex min-w-0 gap-2.5 pb-1.5 text-xs text-[var(--muted-soft)]">
            <span className="hidden sm:inline">{t('enterHint')}</span>
            {value.length > 30_000 && (
              <span className="text-[var(--danger)]">
                {value.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
              </span>
            )}
          </div>
          {isStreaming ? (
            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--liquid-border)] bg-[var(--surface-soft)] text-[var(--ink)] transition-colors hover:bg-[var(--surface-strong)]"
              onClick={onStop}
              aria-label={t('stop')}
              title={t('stop')}
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--gold)] text-slate-900 shadow-[0_5px_14px_rgba(144,108,44,0.17)] transition-[background-color,color,transform] hover:-translate-y-px hover:bg-[var(--gold-hover)] disabled:translate-y-0 disabled:bg-[var(--surface-strong)] disabled:text-[var(--muted-soft)] disabled:shadow-none"
              onClick={onSend}
              disabled={!canSend}
              aria-label={t('send')}
              title={t('send')}
            >
              <ArrowUp size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
