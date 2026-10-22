import type {
  ChatHistoryResponse,
  ChatSessionListResponse,
  ChatSessionSummary,
  ProblemDetail,
  StreamDoneEvent,
  StreamErrorEvent,
  StreamStartEvent,
} from './types'
import { extractSseEvents, flushSseEvents } from './sse'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly requestId?: string
  readonly code?: string

  constructor(
    message: string,
    options: { status?: number; requestId?: string; code?: string } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.requestId = options.requestId
    this.code = options.code
  }
}

async function responseError(response: Response): Promise<ApiError> {
  let problem: Partial<ProblemDetail> | undefined
  try {
    problem = (await response.json()) as Partial<ProblemDetail>
  } catch {
    // A reverse proxy may return a non-JSON error page.
  }
  return new ApiError(
    problem?.detail || problem?.title || `Request failed (${response.status})`,
    {
      status: response.status,
      requestId: problem?.request_id,
    },
  )
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    throw await responseError(response)
  }
  return (await response.json()) as T
}

export async function getSessions(): Promise<ChatSessionListResponse> {
  return requestJson<ChatSessionListResponse>('/chat/sessions')
}

export async function getHistory(sessionId: string): Promise<ChatHistoryResponse> {
  return requestJson<ChatHistoryResponse>(`/chat/sessions/${sessionId}/messages?limit=200`)
}

export async function renameSession(
  sessionId: string,
  title: string,
): Promise<ChatSessionSummary> {
  return requestJson<ChatSessionSummary>(`/chat/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw await responseError(response)
  }
}

interface StreamHandlers {
  onStart: (event: StreamStartEvent) => void
  onToken: (delta: string) => void
  onDone: (event: StreamDoneEvent) => void
}

interface StreamChatOptions {
  sessionId: string
  message: string
  signal: AbortSignal
  handlers: StreamHandlers
}

export async function streamChat({
  sessionId,
  message,
  signal,
  handlers,
}: StreamChatOptions): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: sessionId, message }),
    signal,
  })

  if (!response.ok) {
    throw await responseError(response)
  }
  if (!response.body) {
    throw new ApiError('The response stream could not be opened.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let receivedDone = false

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })

    const extracted = extractSseEvents(buffer)
    buffer = extracted.remainder
    const events = done
      ? [...extracted.events, ...flushSseEvents(extracted.remainder)]
      : extracted.events

    for (const event of events) {
      if (!event.data) {
        continue
      }
      if (event.event === 'start') {
        handlers.onStart(JSON.parse(event.data) as StreamStartEvent)
      } else if (event.event === 'token') {
        handlers.onToken((JSON.parse(event.data) as { delta: string }).delta)
      } else if (event.event === 'done') {
        receivedDone = true
        handlers.onDone(JSON.parse(event.data) as StreamDoneEvent)
      } else if (event.event === 'error') {
        const streamError = JSON.parse(event.data) as StreamErrorEvent
        throw new ApiError(streamError.message, {
          requestId: streamError.request_id,
          code: streamError.code,
        })
      }
    }

    if (done) {
      break
    }
  }

  if (!receivedDone) {
    throw new ApiError('The response stream ended before completion.')
  }
}
