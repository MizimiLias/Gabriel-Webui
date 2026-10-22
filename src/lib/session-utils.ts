import type { ChatSessionSummary } from './types'

export type SessionGroupKey = 'today' | 'previous7Days' | 'older'

export interface SessionGroup {
  key: SessionGroupKey
  sessions: ChatSessionSummary[]
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function groupSessions(
  sessions: ChatSessionSummary[],
  now = new Date(),
): SessionGroup[] {
  const todayStart = startOfLocalDay(now)
  const sevenDayStart = new Date(todayStart)
  sevenDayStart.setDate(sevenDayStart.getDate() - 6)

  const groups: Record<SessionGroupKey, ChatSessionSummary[]> = {
    today: [],
    previous7Days: [],
    older: [],
  }

  for (const session of sessions) {
    const updated = new Date(session.updated_at)
    if (updated >= todayStart) {
      groups.today.push(session)
    } else if (updated >= sevenDayStart) {
      groups.previous7Days.push(session)
    } else {
      groups.older.push(session)
    }
  }

  return (['today', 'previous7Days', 'older'] as const)
    .map((key) => ({ key, sessions: groups[key] }))
    .filter((group) => group.sessions.length > 0)
}

export function matchesSession(
  session: ChatSessionSummary,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) {
    return true
  }
  return `${session.title} ${session.last_message_preview}`
    .toLocaleLowerCase()
    .includes(needle)
}

export function formatRelativeTime(
  value: string,
  language: 'zh' | 'en',
  now = new Date(),
): string {
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const absoluteSeconds = Math.abs(seconds)
  const locale = language === 'zh' ? 'zh-CN' : 'en'
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (absoluteSeconds < 60) {
    return language === 'zh' ? '刚刚' : 'just now'
  }
  if (absoluteSeconds < 3_600) {
    return formatter.format(Math.round(seconds / 60), 'minute')
  }
  if (absoluteSeconds < 86_400) {
    return formatter.format(Math.round(seconds / 3_600), 'hour')
  }
  if (absoluteSeconds < 604_800) {
    return formatter.format(Math.round(seconds / 86_400), 'day')
  }
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(date)
}
