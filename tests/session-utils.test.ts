import { describe, expect, it } from 'vitest'
import {
  formatRelativeTime,
  groupSessions,
  matchesSession,
} from '../src/lib/session-utils'
import type { ChatSessionSummary } from '../src/lib/types'

function session(
  id: string,
  title: string,
  updatedAt: string,
  preview = '',
): ChatSessionSummary {
  return {
    session_id: id,
    title,
    created_at: updatedAt,
    updated_at: updatedAt,
    message_count: 2,
    last_message_preview: preview,
  }
}

describe('session utilities', () => {
  const now = new Date('2026-10-22T12:00:00+08:00')
  const sessions = [
    session('today', 'Today plan', '2026-10-22T10:00:00+08:00'),
    session('week', 'Earlier idea', '2026-10-19T10:00:00+08:00'),
    session('old', 'Old notes', '2026-10-01T10:00:00+08:00'),
  ]

  it('groups sessions by local recency', () => {
    const groups = groupSessions(sessions, now)
    expect(groups.map((group) => [group.key, group.sessions.length])).toEqual([
      ['today', 1],
      ['previous7Days', 1],
      ['older', 1],
    ])
  })

  it('searches titles and message previews case-insensitively', () => {
    expect(matchesSession(sessions[0], 'PLAN')).toBe(true)
    expect(
      matchesSession(session('x', 'Title', new Date().toISOString(), 'Unique preview'), 'unique'),
    ).toBe(true)
    expect(matchesSession(sessions[0], 'missing')).toBe(false)
  })

  it('formats compact relative times', () => {
    expect(formatRelativeTime('2026-10-22T11:59:30+08:00', 'zh', now)).toBe('刚刚')
    expect(formatRelativeTime('2026-10-22T11:30:00+08:00', 'zh', now)).toBe('30分钟前')
  })
})
