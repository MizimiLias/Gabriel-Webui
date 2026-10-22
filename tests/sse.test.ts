import { describe, expect, it } from 'vitest'
import {
  extractSseEvents,
  flushSseEvents,
  parseSseBlock,
} from '../src/lib/sse'

describe('SSE parsing', () => {
  it('parses event names and multi-line data', () => {
    expect(
      parseSseBlock('event: token\ndata: {"delta":"line one"}\ndata: line two'),
    ).toEqual({
      event: 'token',
      data: '{"delta":"line one"}\nline two',
    })
  })

  it('ignores heartbeat comments', () => {
    const result = extractSseEvents(': ping\n\n')
    expect(result.events).toEqual([])
    expect(result.remainder).toBe('')
  })

  it('preserves incomplete events across chunks', () => {
    const first = extractSseEvents(
      'event: start\ndata: {"session_id":"one","message_id":"two"}\n\nevent: token\ndata: {"del',
    )
    expect(first.events).toHaveLength(1)
    expect(first.events[0].event).toBe('start')

    const second = extractSseEvents(`${first.remainder}ta":"hello"}\n\n`)
    expect(second.events).toEqual([
      { event: 'token', data: '{"delta":"hello"}' },
    ])
    expect(second.remainder).toBe('')
  })

  it('supports CRLF boundaries and flushes the final block', () => {
    const result = extractSseEvents(
      'event: done\r\ndata: {"title":"A title"}\r\n\r\nevent: token\r\ndata: {"delta":"tail"}',
    )
    expect(result.events).toEqual([
      { event: 'done', data: '{"title":"A title"}' },
    ])
    expect(flushSseEvents(result.remainder)).toEqual([
      { event: 'token', data: '{"delta":"tail"}' },
    ])
  })
})
