export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  created_at: string
}

export interface ChatSessionSummary {
  session_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
  last_message_preview: string
}

export interface ChatSessionListResponse {
  items: ChatSessionSummary[]
}

export interface ChatHistoryResponse {
  session_id: string
  title: string
  messages: ChatMessage[]
}

export interface StreamStartEvent {
  session_id: string
  message_id: string
}

export interface StreamTokenEvent {
  delta: string
}

export interface StreamDoneEvent {
  session_id: string
  message_id: string
  title: string
  created_at: string
}

export interface StreamErrorEvent {
  code: string
  message: string
  request_id: string
}

export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  request_id: string
  errors?: Array<Record<string, unknown>>
}
