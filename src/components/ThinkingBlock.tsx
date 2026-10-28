import { useState } from 'react'
import { ChevronDown, Brain } from 'lucide-react'
import { clsx } from 'clsx'
import { useAppSettings } from '../contexts/app-settings'

interface ThinkingBlockProps {
  reasoning: string
  isStreaming: boolean
}

function lastLine(reasoning: string): string {
  const lines = reasoning.split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.length > 0 ? lines[lines.length - 1] : ''
}

export function ThinkingBlock({ reasoning, isStreaming }: ThinkingBlockProps) {
  const { t } = useAppSettings()
  const [expanded, setExpanded] = useState(false)

  if (!reasoning) {
    return null
  }

  const preview = lastLine(reasoning)
  const label = isStreaming ? t('thinkingInProgress') : t('thinkingDone')

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-[var(--liquid-border)] bg-[var(--surface-soft)]/70">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label={expanded ? t('collapseThinking') : t('expandThinking')}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
      >
        <Brain size={14} className={clsx('shrink-0', isStreaming && 'animate-pulse')} />
        <span className="shrink-0 font-medium">{label}</span>
        {preview && !expanded && (
          <span className="min-w-0 flex-1 truncate opacity-80">{preview}</span>
        )}
        <ChevronDown
          size={14}
          className={clsx(
            'ml-auto shrink-0 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && (
        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words border-t border-[var(--hairline)] px-3 py-2 font-sans text-xs leading-5 text-[var(--muted)]">
          {reasoning}
          {isStreaming && <span className="stream-caret" aria-hidden="true" />}
        </pre>
      )}
    </div>
  )
}
