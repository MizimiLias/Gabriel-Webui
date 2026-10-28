import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Sun,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAppSettings, type ThemeMode } from '../contexts/app-settings'
import { deleteSession, renameSession } from '../lib/api'
import {
  formatRelativeTime,
  groupSessions,
  matchesSession,
} from '../lib/session-utils'
import type { ChatSessionListResponse, ChatSessionSummary } from '../lib/types'
import { GabrielAvatar } from './GabrielAvatar'
import { ConfirmDialog } from './ConfirmDialog'

interface SidebarProps {
  sessions: ChatSessionSummary[]
  activeSessionId?: string
  isLoading: boolean
  isError: boolean
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapsed: () => void
  onCloseMobile: () => void
  onNewChat: () => void
  onSessionDeleted: (sessionId: string) => void
}

const themes: Array<{
  value: ThemeMode
  icon: typeof Sun
  labelKey: 'themeLight' | 'themeDark' | 'themeSystem'
}> = [
  { value: 'light', icon: Sun, labelKey: 'themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'themeDark' },
  { value: 'system', icon: Monitor, labelKey: 'themeSystem' },
]

export function Sidebar({
  sessions,
  activeSessionId,
  isLoading,
  isError,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
  onNewChat,
  onSessionDeleted,
}: SidebarProps) {
  const { t, language, setLanguage, themeMode, setThemeMode } = useAppSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<ChatSessionSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = sessions.filter((session) => matchesSession(session, search))
  const groups = groupSessions(filtered)

  const openSession = (sessionId: string) => {
    navigate(`/chat/${sessionId}`)
    onCloseMobile()
    setOpenMenuId(null)
  }

  const beginRename = (session: ChatSessionSummary) => {
    setEditingId(session.session_id)
    setEditingTitle(session.title)
    setOpenMenuId(null)
    setActionError(null)
  }

  const submitRename = async (event: FormEvent, sessionId: string) => {
    event.preventDefault()
    const title = editingTitle.trim()
    if (!title) {
      setActionError(t('titleRequired'))
      return
    }
    setRenaming(true)
    setActionError(null)
    try {
      const updated = await renameSession(sessionId, title)
      queryClient.setQueryData<ChatSessionListResponse>(['sessions'], (current) => {
        if (!current) {
          return current
        }
        return {
          items: current.items
            .map((item) => (item.session_id === sessionId ? updated : item))
            .sort(
              (left, right) =>
                new Date(right.updated_at).getTime() -
                new Date(left.updated_at).getTime(),
            ),
        }
      })
      setEditingId(null)
      void queryClient.invalidateQueries({ queryKey: ['history', sessionId] })
    } catch {
      setActionError(t('renameFailed'))
    } finally {
      setRenaming(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteCandidate) {
      return
    }
    const sessionId = deleteCandidate.session_id
    setDeleting(true)
    setActionError(null)
    try {
      await deleteSession(sessionId)
      queryClient.setQueryData<ChatSessionListResponse>(['sessions'], (current) =>
        current
          ? {
              items: current.items.filter(
                (session) => session.session_id !== sessionId,
              ),
            }
          : current,
      )
      queryClient.removeQueries({ queryKey: ['history', sessionId] })
      setDeleteCandidate(null)
      onSessionDeleted(sessionId)
    } catch {
      setActionError(t('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div
        className={clsx(
          'fixed inset-0 z-50 lg:static lg:z-auto lg:pointer-events-auto',
          collapsed ? 'lg:hidden' : 'lg:block',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <button
          type="button"
          className={clsx(
            'absolute inset-0 bg-[#0b1218]/45 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={onCloseMobile}
          aria-label={t('closeNavigation')}
          tabIndex={mobileOpen ? 0 : -1}
        />
        <aside
          id="conversation-sidebar"
          className={clsx(
            'flex h-dvh w-[282px] shrink-0 flex-col border-r border-[var(--hairline)] bg-[var(--sidebar)] shadow-[12px_0_38px_rgba(46,70,77,0.045)] transition-transform duration-200 lg:relative lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex min-h-[76px] items-center gap-3 px-4 pb-3 pt-4">
            <div className="flex min-w-0 items-center gap-3">
              <GabrielAvatar size="md" />
              <div className="min-w-0">
                <div className="font-serif text-lg leading-none tracking-tight text-[var(--ink)]">
                  Gabriel
                </div>
                <div className="mt-1 text-xs tracking-wide text-[var(--muted)]">
                  {t('brandTagline')}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="ml-auto inline-flex size-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface)]/60 hover:text-[var(--ink)] lg:hidden"
              onClick={onCloseMobile}
              aria-label={t('closeNavigation')}
            >
              <X size={18} />
            </button>
            <button
              type="button"
              className="ml-auto hidden size-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface)]/60 hover:text-[var(--ink)] lg:inline-flex"
              onClick={onToggleCollapsed}
              aria-label={t('collapseSidebar')}
              title={t('collapseSidebar')}
            >
              <PanelLeftClose size={17} />
            </button>
          </div>

          <div className="px-3">
            <button
              type="button"
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/65 bg-[var(--gold)] px-3 text-[0.8125rem] font-semibold text-slate-900 shadow-[0_6px_18px_rgba(145,110,47,0.15)] transition-colors hover:bg-[var(--gold-hover)] active:translate-y-px"
              onClick={() => {
                onNewChat()
                onCloseMobile()
              }}
              aria-label={t('newChat')}
              title={t('newChat')}
            >
              <Plus size={17} strokeWidth={2.2} />
              <span>{t('newChat')}</span>
            </button>
          </div>

          <div className="mx-3 mb-2 mt-3.5 flex min-h-10 items-center gap-2 rounded-lg border border-transparent bg-[var(--surface)]/45 px-3 transition-colors focus-within:border-[var(--liquid-border)] focus-within:bg-[var(--surface)]/70">
            <Search size={15} className="shrink-0 text-[var(--muted-soft)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-[var(--ink)] outline-none placeholder:text-[var(--muted-soft)]"
              aria-label={t('searchPlaceholder')}
            />
            {search && (
              <button
                type="button"
                className="rounded-full p-1 text-[var(--muted)] hover:text-[var(--ink)]"
                onClick={() => setSearch('')}
                aria-label={t('searchClear')}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-4 pb-2 pt-3 text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-soft)]">
            <span>{t('conversationHistory')}</span>
            <span className="tabular-nums">{sessions.length || ''}</span>
          </div>

          <nav
            className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
            aria-label={t('conversationHistory')}
          >
            {isLoading && (
              <div className="space-y-2 px-1">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-[66px] animate-pulse rounded-xl bg-[var(--surface-strong)]/60"
                  />
                ))}
              </div>
            )}

            {isError && !isLoading && (
              <div className="mx-2 my-2.5 rounded-xl px-3 py-7 text-center text-xs leading-5 text-[var(--muted-soft)]">
                <p>{t('sessionsLoadFailed')}</p>
                <button
                  type="button"
                  className="mt-2 text-xs text-[var(--blue-strong)] underline-offset-4 hover:underline"
                  onClick={() => void queryClient.invalidateQueries({ queryKey: ['sessions'] })}
                >
                  {t('retry')}
                </button>
              </div>
            )}

            {!isLoading && !isError && filtered.length === 0 && (
              <div className="mx-2 my-2.5 rounded-xl px-3 py-7 text-center text-xs leading-5 text-[var(--muted-soft)]">
                <MessageSquare size={20} className="mx-auto mb-3 opacity-55" />
                <p>{search ? t('noSearchResults') : t('noSessions')}</p>
                {!search && <p className="mt-1.5 text-xs">{t('noSessionsHint')}</p>}
              </div>
            )}

            {!isLoading &&
              !isError &&
              groups.map((group) => (
                <section key={group.key} className="mb-3">
                  <h2 className="px-2.5 pb-1.5 pt-2 text-[0.6875rem] font-medium text-[var(--muted-soft)]">
                    {t(group.key)}
                  </h2>
                  <div className="space-y-0.5">
                    {group.sessions.map((session) => {
                      const isActive = session.session_id === activeSessionId
                      const isEditing = editingId === session.session_id

                      return (
                        <div
                          key={session.session_id}
                          className={clsx(
                            'group relative flex min-h-[62px] items-center rounded-xl transition-colors duration-150',
                            isActive
                              ? 'bg-[var(--sidebar-active)] text-[var(--ink)]'
                              : 'text-[var(--muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--ink)]',
                          )}
                          onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                              setOpenMenuId(null)
                            }
                          }}
                        >
                          {isActive && (
                            <span className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-[var(--gold)]" />
                          )}

                          {isEditing ? (
                            <form
                              className="flex w-full items-center gap-2 px-3"
                              onSubmit={(event) => void submitRename(event, session.session_id)}
                            >
                              <input
                                autoFocus
                                value={editingTitle}
                                onChange={(event) => setEditingTitle(event.target.value)}
                                maxLength={80}
                                className="min-w-0 flex-1 rounded-lg border border-[var(--liquid-border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.8125rem] text-[var(--ink)] outline-none focus:border-[var(--blue-strong)]"
                                aria-label={t('rename')}
                                disabled={renaming}
                                onKeyDown={(event) => {
                                  if (event.key === 'Escape') {
                                    setEditingId(null)
                                    setActionError(null)
                                  }
                                }}
                              />
                              <button
                                type="submit"
                                className="rounded-md px-2 py-1 text-xs font-medium text-[var(--blue-strong)] disabled:opacity-50"
                                disabled={renaming}
                              >
                                {renaming ? '…' : 'OK'}
                              </button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
                              onClick={() => openSession(session.session_id)}
                              aria-current={isActive ? 'page' : undefined}
                              title={session.title}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium leading-5">
                                    {session.title || t('newChat')}
                                  </span>
                                  <span className="shrink-0 text-[0.6875rem] font-normal text-[var(--muted-soft)]">
                                    {formatRelativeTime(session.updated_at, language)}
                                  </span>
                                </span>
                                <span className="mt-0.5 block truncate text-[0.6875rem] leading-4 text-[var(--muted-soft)]">
                                  {session.last_message_preview || '—'}
                                </span>
                              </span>
                            </button>
                          )}

                          {!isEditing && (
                            <div
                              className="relative mr-1.5 shrink-0"
                            >
                              <button
                                type="button"
                                className={clsx(
                                  'inline-flex size-7 items-center justify-center rounded-md text-[var(--muted)] transition-[background-color,opacity,color] hover:bg-[var(--surface)]/70 hover:text-[var(--ink)]',
                                  isActive
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                                )}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setOpenMenuId((current) =>
                                    current === session.session_id ? null : session.session_id,
                                  )
                                }}
                                aria-label={t('moreActions')}
                                aria-expanded={openMenuId === session.session_id}
                              >
                                <MoreHorizontal size={16} />
                              </button>
                              {openMenuId === session.session_id && (
                                <div className="absolute right-0 top-8 z-20 min-w-36 overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-float)]" role="menu">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-soft)]"
                                    onClick={() => beginRename(session)}
                                  >
                                    <Pencil size={14} />
                                    {t('rename')}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]"
                                    onClick={() => {
                                      setDeleteCandidate(session)
                                      setOpenMenuId(null)
                                    }}
                                  >
                                    <Trash2 size={14} />
                                    {t('delete')}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}

            {actionError && (
              <div
                role="alert"
                className="mx-2 mt-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]"
              >
                {actionError}
              </div>
            )}
          </nav>

          <div className="border-t border-[var(--hairline)]/70 px-3 py-3">
            <button
              type="button"
              className={clsx(
                'mb-2 flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[0.8125rem] font-medium transition-colors',
                location.pathname === '/personas'
                  ? 'bg-[var(--sidebar-active)] text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface)]/60 hover:text-[var(--ink)]',
              )}
              onClick={() => {
                navigate('/personas')
                onCloseMobile()
                setOpenMenuId(null)
              }}
              aria-current={location.pathname === '/personas' ? 'page' : undefined}
            >
              <UserRound size={15} />
              {t('personas')}
            </button>
            <div className="flex min-h-8 items-center justify-between gap-3">
              <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-soft)]">{t('theme')}</span>
              <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--liquid-border)]/70 bg-[var(--surface)]/50 p-0.5">
                {themes.map((theme) => {
                  const Icon = theme.icon
                  return (
                    <button
                      key={theme.value}
                      type="button"
                      className={clsx(
                        'inline-flex size-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:text-[var(--ink)]',
                        themeMode === theme.value && 'bg-[var(--surface)] text-[var(--ink)] shadow-sm',
                      )}
                      onClick={() => setThemeMode(theme.value)}
                      aria-label={`${t('theme')}: ${t(theme.labelKey)}`}
                      aria-pressed={themeMode === theme.value}
                      title={t(theme.labelKey)}
                    >
                      <Icon size={14} />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex min-h-8 items-center justify-between gap-3">
              <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-soft)]">{t('language')}</span>
              <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--liquid-border)]/70 bg-[var(--surface)]/50 p-0.5">
                <button
                  type="button"
                  className={clsx(
                    'inline-flex h-7 min-w-12 items-center justify-center rounded-md px-2.5 text-[0.6875rem] font-medium leading-none transition-colors hover:text-[var(--ink)]',
                    language === 'zh' && 'bg-[var(--surface)] text-[var(--ink)] shadow-sm',
                  )}
                  onClick={() => setLanguage('zh')}
                  aria-pressed={language === 'zh'}
                >
                  {t('chinese')}
                </button>
                <button
                  type="button"
                  className={clsx(
                    'inline-flex h-7 min-w-12 items-center justify-center rounded-md px-2.5 text-[0.6875rem] font-medium leading-none transition-colors hover:text-[var(--ink)]',
                    language === 'en' && 'bg-[var(--surface)] text-[var(--ink)] shadow-sm',
                  )}
                  onClick={() => setLanguage('en')}
                  aria-pressed={language === 'en'}
                >
                  {t('english')}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        title={t('deleteConversation')}
        description={
          <div>
            <p>{t('deleteWarning')}</p>
            {deleteCandidate && (
              <p className="mt-2 font-medium text-[var(--ink)]">{deleteCandidate.title}</p>
            )}
          </div>
        }
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (!deleting) {
            setDeleteCandidate(null)
          }
        }}
      />
    </>
  )
}
