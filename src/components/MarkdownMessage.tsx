import {
  Children,
  isValidElement,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppSettings } from '../contexts/app-settings'

function textFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(textFromNode).join('')
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textFromNode(node.props.children)
  }
  return ''
}

function CodeBlock({ children }: ComponentPropsWithoutRef<'pre'>) {
  const { t } = useAppSettings()
  const [copied, setCopied] = useState(false)
  const code = textFromNode(children).replace(/\n$/, '')
  const child = Children.toArray(children)[0]
  const language =
    isValidElement<{ className?: string }>(child) && child.props.className
      ? child.props.className.replace('language-', '')
      : ''

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1_800)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Clipboard access can be denied; the code remains selectable.
    }
  }

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--surface-soft)]">
      <div className="flex min-h-9 items-center justify-between border-b border-[var(--hairline)] px-3 text-xs uppercase tracking-wider text-[var(--muted-soft)]">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={copyCode}
          aria-label={t('copy')}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs normal-case tracking-normal text-[var(--muted)] transition-colors hover:bg-[var(--surface-strong)] hover:text-[var(--ink)]"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? t('copied') : t('copy')}</span>
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-4 font-mono text-sm leading-6 text-[var(--ink-soft)]">
        {children}
      </pre>
    </div>
  )
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-sm leading-7 text-[var(--ink-soft)] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: CodeBlock,
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          h1: ({ children }) => (
            <h1 className="mb-2 mt-6 font-serif text-2xl font-medium tracking-tight text-[var(--ink)]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-5 font-serif text-xl font-medium tracking-tight text-[var(--ink)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 font-serif text-lg font-medium text-[var(--ink)]">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-4 text-base font-semibold text-[var(--ink)]">
              {children}
            </h4>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-[var(--gold)] pl-4 text-[var(--muted)]">
              {children}
            </blockquote>
          ),
          a: ({ children, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--blue-strong)] underline decoration-[var(--blue-strong)]/35 underline-offset-4"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--ink)]">{children}</strong>
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[var(--hairline)] bg-[var(--surface-soft)] px-2.5 py-2 text-left font-semibold text-[var(--ink)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[var(--hairline)] px-2.5 py-2 text-left">
              {children}
            </td>
          ),
          hr: () => <hr className="my-5 border-[var(--hairline)]" />,
          code: ({ children, className, ...props }) => (
            <code
              {...props}
              className={
                className
                  ? `font-mono ${className}`
                  : 'rounded border border-[var(--liquid-border)] bg-[var(--surface-soft)] px-1.5 py-0.5 font-mono text-xs text-[var(--ink)]'
              }
            >
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
