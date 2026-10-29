import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, Menu, MessageSquare, PanelLeftOpen, RotateCcw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAppSettings } from '../contexts/app-settings'
import { ApiError, getHistory, streamChat } from '../lib/api'
import { appendTextDelta, imageParts, textFromParts } from '../lib/content'
import type {
  ContentPart,
  ChatHistoryResponse,
  ChatMessage,
  ChatSessionSummary,
  StreamDoneEvent,
} from '../lib/types'
import { Composer } from './Composer'
import { GabrielAvatar } from './GabrielAvatar'
import { MarkdownMessage } from './MarkdownMessage'
import { PersonaSelector } from './PersonaSelector'
import { ThinkingBlock } from './ThinkingBlock'

interface ChatViewProps {
  sessionId?: string
  sessions: ChatSessionSummary[]
  sidebarCollapsed: boolean
  onOpenSidebar: () => void
}

function temporaryId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

const iconButtonClass =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface)]/60 hover:text-[var(--ink)]'
const primaryButtonClass =
  'inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--gold)] bg-[var(--gold)] px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-[var(--gold-hover)]'
const statePageClass =
  'flex min-h-[calc(100dvh-190px)] flex-col items-center justify-center text-center'
const stateIconClass =
  'inline-flex size-12 items-center justify-center rounded-xl border border-[var(--liquid-border)] bg-[var(--surface-soft)] text-[var(--muted)]'

function UserPartsContent({ parts }: { parts: ContentPart[] }) {
  const text = textFromParts(parts)
  const images = imageParts(parts)
  return (
    <div className="space-y-2">
      {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
      {images.map((part) => (
        <img
          key={part.image_url.url}
          src={part.image_url.url}
          alt=""
          className="max-h-80 w-auto max-w-full rounded-xl border border-[var(--blue)]/20 object-contain"
          loading="lazy"
        />
      ))}
    </div>
  )
}

function AssistantPartsContent({ parts }: { parts: ContentPart[] }) {
  const text = textFromParts(parts)
  return text ? <MarkdownMessage content={text} /> : null
}

export function ChatView({
  sessionId: routeSessionId,
  sessions,
  sidebarCollapsed,
  onOpenSidebar,
}: ChatViewProps) {
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId ?? routeSessionId
  const { t } = useAppSettings()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [localMessages, setMessages] = useState<ChatMessage[] | null>(null)
  const [draft, setDraft] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [retryParts, setRetryParts] = useState<ContentPart[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [generatedTitle, setGeneratedTitle] = useState<string | null>(null)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const requestRef = useRef<AbortController | null>(null)
  const stopRequestedRef = useRef(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const historyQuery = useQuery({
    queryKey: ['history', sessionId],
    queryFn: () => {
      if (!sessionId) {
        throw new Error('A session ID is required.')
      }
      return getHistory(sessionId)
    },
    enabled: Boolean(sessionId),
    retry: false,
  })

  const messages = useMemo(
    () => localMessages ?? historyQuery.data?.messages ?? [],
    [localMessages, historyQuery.data?.messages],
  )
  const lastAssistantIndex = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'assistant') {
        return index
      }
    }
    return -1
  }, [messages])
  const activeSummary = sessions.find((session) => session.session_id === sessionId)
  const title =
    activeSummary?.title ??
    historyQuery.data?.title ??
    generatedTitle ??
    t('newChat')
  const notFound =
    historyQuery.error instanceof ApiError && historyQuery.error.status === 404
  const historyFailed = historyQuery.isError && !notFound

  useEffect(
    () => () => {
      requestRef.current?.abort()
    },
    [],
  )

  const scrollToBottom = useCallback((smooth = false) => {
    const area = scrollAreaRef.current
    if (!area) {
      return
    }
    area.scrollTo({
      top: area.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
    setIsNearBottom(true)
  }, [])

  useEffect(() => {
    if (!isNearBottom) {
      return
    }
    const frame = window.requestAnimationFrame(() => scrollToBottom(false))
    return () => window.cancelAnimationFrame(frame)
  }, [isNearBottom, messages, scrollToBottom])

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const distance = target.scrollHeight - target.scrollTop - target.clientHeight
    setIsNearBottom(distance < 90)
  }

  const sendPrompt = async (
    parts: ContentPart[],
    baseMessages: ChatMessage[],
    existingSessionId?: string,
  ) => {
    if (isStreaming || parts.length === 0) {
      return
    }

    const prompt = textFromParts(parts)
    const targetSessionId = existingSessionId ?? crypto.randomUUID()
    const now = new Date().toISOString()
    const userMessage: ChatMessage = {
      id: temporaryId('user'),
      role: 'user',
      parts,
      created_at: now,
    }
    const assistantMessage: ChatMessage = {
      id: temporaryId('assistant'),
      role: 'assistant',
      parts: [],
      created_at: now,
      reasoning: '',
    }
    let assistantId = assistantMessage.id
    let assistantContent = ''
    let reasoningContent = ''
    let doneEvent: StreamDoneEvent | undefined
    const controller = new AbortController()

    requestRef.current = controller
    stopRequestedRef.current = false
    setMessages([...baseMessages, userMessage, assistantMessage])
    setDraft('')
    setImageUrls([])
    setStreamError(null)
    setRetryParts(null)
    setNotice(null)
    setGeneratedTitle(null)
    setIsNearBottom(true)
    setIsStreaming(true)

    try {
      await streamChat({
        sessionId: targetSessionId,
        parts,
        personaId: existingSessionId ? undefined : selectedPersonaId,
        signal: controller.signal,
        handlers: {
          onStart: (event) => {
            assistantId = event.message_id
            setMessages((current) =>
              (current ?? []).map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, id: event.message_id }
                  : message,
              ),
            )
          },
          onToken: (delta) => {
            assistantContent += delta
            setMessages((current) =>
              (current ?? []).map((message) =>
                message.id === assistantId
                  ? { ...message, parts: appendTextDelta(message.parts, delta) }
                  : message,
              ),
            )
          },
          onReasoning: (delta) => {
            reasoningContent += delta
            setMessages((current) =>
              (current ?? []).map((message) =>
                message.id === assistantId
                  ? { ...message, reasoning: (message.reasoning ?? '') + delta }
                  : message,
              ),
            )
          },
          onDone: (event) => {
            doneEvent = event
            setMessages((current) =>
              (current ?? []).map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      id: event.message_id,
                      created_at: event.created_at,
                    }
                  : message,
              ),
            )
          },
        },
      })

      if (stopRequestedRef.current || !doneEvent) {
        return
      }

      const finalAssistant: ChatMessage = {
        id: doneEvent.message_id,
        role: 'assistant',
        parts: [{ type: 'text', text: assistantContent }],
        created_at: doneEvent.created_at,
        ...(reasoningContent ? { reasoning: reasoningContent } : {}),
      }
      const finalMessages = [...baseMessages, userMessage, finalAssistant]
      const finalTitle = doneEvent.title

      queryClient.setQueryData<ChatHistoryResponse>(['history', targetSessionId], {
        session_id: targetSessionId,
        title: finalTitle,
        messages: finalMessages,
      })
      setGeneratedTitle(finalTitle)
      setIsStreaming(false)
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      if (!existingSessionId) {
        navigate(`/chat/${targetSessionId}`, { replace: true })
      } else {
        void queryClient.invalidateQueries({ queryKey: ['history', targetSessionId] })
      }
    } catch (error) {
      if (
        stopRequestedRef.current ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        setMessages(baseMessages)
        setDraft(prompt)
        setImageUrls(imageParts(parts).map((part) => part.image_url.url))
        setNotice(t('stopped'))
      } else {
        setStreamError(
          error instanceof ApiError && error.message
            ? error.message
            : t('responseError'),
        )
        setRetryParts(parts)
      }
      setIsStreaming(false)
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
      }
    }
  }

  const submitDraft = () => {
    const prompt = draft.trim()
    if ((!prompt && imageUrls.length === 0) || isStreaming) {
      return
    }
    const parts: ContentPart[] = []
    if (prompt) {
      parts.push({ type: 'text', text: prompt })
    }
    parts.push(
      ...imageUrls.map(
        (url): ContentPart => ({ type: 'image_url', image_url: { url } }),
      ),
    )
    void sendPrompt(parts, messages, sessionId)
  }

  const stopGeneration = () => {
    if (!requestRef.current) {
      return
    }
    stopRequestedRef.current = true
    requestRef.current.abort()
  }

  const retry = () => {
    if (!retryParts || isStreaming) {
      return
    }
    const baseMessages = messages.slice(0, -2)
    setMessages(baseMessages)
    setStreamError(null)
    setRetryParts(null)
    void sendPrompt(retryParts, baseMessages, sessionId)
  }

  const showLoading =
    Boolean(sessionId) && historyQuery.isLoading && messages.length === 0
  const showGreeting = !sessionId && messages.length === 0

  return (
    <div className="relative flex h-dvh min-w-0 flex-1 flex-col bg-[var(--canvas)]">
      <header className="flex min-h-16 items-center gap-2.5 border-b border-[var(--hairline)]/70 bg-[var(--canvas)]/90 px-4 backdrop-blur-md md:px-6">
        <button
          type="button"
          className={clsx(
            iconButtonClass,
            sidebarCollapsed ? 'inline-flex' : 'lg:hidden',
          )}
          onClick={onOpenSidebar}
          aria-label={t('openNavigation')}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <Menu size={19} />}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium tracking-tight text-[var(--ink)]">
            {title}
          </h1>
          <p className="mt-0.5 text-xs uppercase tracking-wider text-[var(--muted-soft)]">
            Gabriel Agent
          </p>
        </div>
        <div className="hidden items-center gap-2 text-xs text-[var(--muted-soft)] sm:flex">
          <span className="h-px w-5 bg-[var(--gold-line)]" aria-hidden="true" />
          <span>{t('historySaved')}</span>
        </div>
      </header>

      <div
        ref={scrollAreaRef}
        className="chat-scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={onScroll}
        aria-live={isStreaming ? 'polite' : undefined}
      >
        <div className="mx-auto flex min-h-full w-full max-w-[880px] flex-col px-4 pt-7 md:px-8 md:pt-10">
          {showGreeting && (
            <section className="flex min-h-[calc(100dvh-260px)] animate-[rise-in_350ms_ease_both] flex-col items-center justify-center pb-[7vh] text-center">
              <GabrielAvatar size="lg" />
              <h2 className="mt-6 font-serif text-3xl font-normal tracking-tight text-[var(--ink)] md:text-4xl">
                {t('greeting')}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-[var(--muted)]">
                {t('greetingHint')}
              </p>
              <PersonaSelector value={selectedPersonaId} onChange={setSelectedPersonaId} />
            </section>
          )}

          {showLoading && (
            <div className="mx-auto flex max-w-2xl flex-col gap-7 px-5 py-12" aria-label={t('loading')}>
              <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-[var(--surface-strong)]" />
              <div className="space-y-3">
                <div className="h-4 w-11/12 animate-pulse rounded bg-[var(--surface-strong)]" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--surface-strong)]" />
                <div className="h-4 w-7/12 animate-pulse rounded bg-[var(--surface-strong)]" />
              </div>
            </div>
          )}

          {historyFailed && (
            <section className={statePageClass}>
              <span className={stateIconClass}>
                <RotateCcw size={21} />
              </span>
              <h2 className="mt-5 font-serif text-2xl font-normal tracking-tight text-[var(--ink)]">
                {t('historyLoadFailed')}
              </h2>
              <p className="mt-2.5 max-w-md text-sm leading-6 text-[var(--muted)]">
                {t('historyLoadFailedHint')}
              </p>
              <button
                type="button"
                className={`${primaryButtonClass} mt-6`}
                onClick={() => void historyQuery.refetch()}
              >
                {t('retry')}
              </button>
            </section>
          )}

          {notFound && (
            <section className={statePageClass}>
              <span className={stateIconClass}>
                <MessageSquare size={22} />
              </span>
              <h2 className="mt-5 font-serif text-2xl font-normal tracking-tight text-[var(--ink)]">
                {t('notFoundTitle')}
              </h2>
              <p className="mt-2.5 max-w-md text-sm leading-6 text-[var(--muted)]">
                {t('notFoundDescription')}
              </p>
              <button
                type="button"
                className={`${primaryButtonClass} mt-6`}
                onClick={() => navigate('/')}
              >
                {t('startNewChat')}
              </button>
            </section>
          )}

          {!notFound &&
            !historyFailed &&
            messages.map((message, index) =>
              message.role === 'user' ? (
                <article
                  key={message.id}
                  className="mb-9 flex animate-[rise-in_220ms_ease_both] justify-end"
                >
                  <h2 className="sr-only">{t('you')}</h2>
                  <div className="max-w-[78%] rounded-[18px_18px_5px_18px] border border-[var(--blue)]/30 bg-[var(--blue-soft)] px-4 py-3 text-sm leading-6 text-[var(--ink-soft)] shadow-[0_5px_18px_rgba(70,111,126,0.055)]">
                    <UserPartsContent parts={message.parts} />
                  </div>
                </article>
              ) : (
                <article
                  key={message.id}
                  className="mb-9 flex animate-[rise-in_260ms_ease_both] items-start gap-3"
                >
                  <GabrielAvatar size="sm" className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <h2 className="mb-2 mt-px text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {t('assistantLabel')}
                    </h2>
                    {message.reasoning ? (
                      <ThinkingBlock
                        reasoning={message.reasoning}
                        isStreaming={isStreaming && index === lastAssistantIndex}
                      />
                    ) : null}
                    {textFromParts(message.parts) ? (
                      <AssistantPartsContent parts={message.parts} />
                    ) : (
                      <div className="typing-dots" aria-label={t('generating')}>
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                    {isStreaming &&
                      index === lastAssistantIndex &&
                      textFromParts(message.parts) && (
                        <span className="stream-caret" aria-hidden="true" />
                      )}
                  </div>
                </article>
              ),
            )}

          {notice && (
            <div className="mx-auto mb-6 rounded-full border border-[var(--liquid-border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--muted)]" role="status">
              {notice}
            </div>
          )}

          {streamError && (
            <div
              className="mb-7 ml-10 flex flex-col items-start justify-between gap-4 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3 text-xs text-[var(--danger)] sm:flex-row sm:items-center sm:gap-5"
              role="alert"
            >
              <div>
                <p className="font-medium">{t('responseError')}</p>
                <p className="mt-1 text-xs opacity-80">{streamError}</p>
              </div>
              <button
                type="button"
                onClick={retry}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--danger)]/30 px-2.5 py-1.5 text-xs font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/5"
              >
                <RotateCcw size={14} />
                {t('retry')}
              </button>
            </div>
          )}

          {!notFound && !historyFailed && !showLoading && (
            <div className="h-8" aria-hidden="true" />
          )}
        </div>
      </div>

      {!isNearBottom && messages.length > 0 && (
        <button
          type="button"
          className="absolute bottom-32 left-1/2 z-[8] inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--liquid-border)] bg-[var(--surface)] text-[var(--muted)] shadow-[var(--shadow-soft)] transition-colors hover:text-[var(--ink)]"
          onClick={() => scrollToBottom(true)}
          aria-label={t('backToBottom')}
        >
          <ArrowDown size={16} />
        </button>
      )}

      {!notFound && !historyFailed && (
        <Composer
          value={draft}
          onChange={setDraft}
          imageUrls={imageUrls}
          onAddImageUrl={(url) => setImageUrls((current) => [...current, url])}
          onRemoveImageUrl={(url) =>
            setImageUrls((current) => current.filter((item) => item !== url))
          }
          onSend={submitDraft}
          onStop={stopGeneration}
          isStreaming={isStreaming}
        />
      )}
    </div>
  )
}
