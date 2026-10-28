export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  created_at: string
  /** Ephemeral thinking trace, only present for the in-progress turn. */
  reasoning?: string
}

export interface ChatSessionSummary {
  session_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
  last_message_preview: string
  persona_id: string | null
  persona_name: string | null
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

export interface StreamReasoningEvent {
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

export type PersonaRole = 'user' | 'assistant'

export interface PersonaMessage {
  id: string
  position: number
  role: PersonaRole
  content: string
}

export interface PersonaMessageDraft {
  /** Present for persisted messages; omitted for new preset dialogue. */
  id?: string
  role: PersonaRole
  content: string
}

export interface PersonaSummary {
  persona_id: string
  name: string
  description: string | null
  message_count: number
  created_at: string
  updated_at: string
}

export interface PersonaDetail {
  persona_id: string
  name: string
  description: string | null
  system_prompt: string
  messages: PersonaMessage[]
  created_at: string
  updated_at: string
}

export interface PersonaListResponse {
  items: PersonaSummary[]
}

export interface PersonaCreateInput {
  name: string
  description: string | null
  system_prompt: string
  messages: PersonaMessageDraft[]
}

export interface PersonaUpdateInput extends PersonaCreateInput {}
