import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamChat, updatePersona } from '../src/lib/api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('persona API client', () => {
  it('serializes the optional persona id into the first chat request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          'event: start',
          'data: {"session_id":"session-one","message_id":"message-one"}',
          '',
          'event: done',
          'data: {"session_id":"session-one","message_id":"message-one","title":"Chat","created_at":"2026-10-27T20:00:00+08:00"}',
          '',
        ].join('\n'),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await streamChat({
      sessionId: 'session-one',
      message: 'Hello',
      personaId: 'persona-one',
      signal: new AbortController().signal,
      handlers: {
        onStart: vi.fn(),
        onToken: vi.fn(),
        onDone: vi.fn(),
      },
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      session_id: 'session-one',
      message: 'Hello',
      persona_id: 'persona-one',
    })
  })

  it('omits persona_id when no persona is selected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          'event: start',
          'data: {"session_id":"session-one","message_id":"message-one"}',
          '',
          'event: done',
          'data: {"session_id":"session-one","message_id":"message-one","title":"Chat","created_at":"2026-10-27T20:00:00+08:00"}',
          '',
        ].join('\n'),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await streamChat({
      sessionId: 'session-one',
      message: 'Hello',
      personaId: null,
      signal: new AbortController().signal,
      handlers: {
        onStart: vi.fn(),
        onToken: vi.fn(),
        onDone: vi.fn(),
      },
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({
      session_id: 'session-one',
      message: 'Hello',
    })
  })

  it('uses PUT and preserves existing message ids for full updates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          persona_id: 'persona-one',
          name: 'Ada',
          description: null,
          system_prompt: 'You are Ada.',
          messages: [
            { id: 'message-one', position: 0, role: 'user', content: 'Hi' },
          ],
          created_at: '2026-10-27T20:00:00+08:00',
          updated_at: '2026-10-27T20:01:00+08:00',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await updatePersona('persona-one', {
      name: 'Ada',
      description: null,
      system_prompt: 'You are Ada.',
      messages: [
        { id: 'message-one', role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ],
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/personas/persona-one')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string).messages).toEqual([
      { id: 'message-one', role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ])
  })
})
