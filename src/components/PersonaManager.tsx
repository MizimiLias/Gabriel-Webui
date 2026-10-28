import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Menu,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAppSettings } from '../contexts/app-settings'
import {
  createPersona,
  deletePersona,
  getPersona,
  listPersonas,
  updatePersona,
} from '../lib/api'
import type {
  PersonaCreateInput,
  PersonaDetail,
  PersonaListResponse,
  PersonaSummary,
} from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'
import { PersonaEditor } from './PersonaEditor'

interface PersonaManagerProps {
  sidebarCollapsed: boolean
  onOpenSidebar: () => void
}

const iconButtonClass =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface)]/60 hover:text-[var(--ink)]'

export function PersonaManager({ sidebarCollapsed, onOpenSidebar }: PersonaManagerProps) {
  const { t, locale } = useAppSettings()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false)
  const [editorVersion, setEditorVersion] = useState(0)
  const [deleteCandidate, setDeleteCandidate] = useState<PersonaSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const personasQuery = useQuery({
    queryKey: ['personas'],
    queryFn: listPersonas,
    staleTime: 30_000,
  })
  const detailQuery = useQuery({
    queryKey: ['persona', selectedId],
    queryFn: () => getPersona(selectedId!),
    enabled: Boolean(selectedId) && !creating,
    retry: false,
  })
  const personas = personasQuery.data?.items ?? []
  const showEditor = creating || Boolean(selectedId)

  const selectPersona = (personaId: string) => {
    setCreating(false)
    setSelectedId(personaId)
    setMobileEditorOpen(true)
    setActionError(null)
  }

  const beginCreate = () => {
    setCreating(true)
    setSelectedId(null)
    setMobileEditorOpen(true)
    setActionError(null)
  }

  const closeEditor = () => {
    setCreating(false)
    setSelectedId(null)
    setMobileEditorOpen(false)
    setActionError(null)
  }

  const savePersona = async (input: PersonaCreateInput): Promise<void> => {
    const saved: PersonaDetail = creating
      ? await createPersona(input)
      : await updatePersona(selectedId!, input)
    queryClient.setQueryData(['persona', saved.persona_id], saved)
    queryClient.setQueryData<PersonaListResponse>(['personas'], (current) => {
      if (!current) {
        return current
      }
      const summary: PersonaSummary = {
        persona_id: saved.persona_id,
        name: saved.name,
        description: saved.description,
        message_count: saved.messages.length,
        created_at: saved.created_at,
        updated_at: saved.updated_at,
      }
      const exists = current.items.some((item) => item.persona_id === saved.persona_id)
      return {
        items: (exists
          ? current.items.map((item) =>
              item.persona_id === saved.persona_id ? summary : item,
            )
          : [...current.items, summary]
        ).sort((left, right) => left.name.localeCompare(right.name)),
      }
    })
    setCreating(false)
    setSelectedId(saved.persona_id)
    setEditorVersion((version) => version + 1)
    void queryClient.invalidateQueries({ queryKey: ['personas'] })
    void queryClient.invalidateQueries({ queryKey: ['sessions'] })
  }

  const confirmDelete = async () => {
    if (!deleteCandidate) {
      return
    }
    setDeleting(true)
    setActionError(null)
    try {
      await deletePersona(deleteCandidate.persona_id)
      queryClient.removeQueries({ queryKey: ['persona', deleteCandidate.persona_id] })
      queryClient.setQueryData<PersonaListResponse>(['personas'], (current) =>
        current
          ? {
              items: current.items.filter(
                (persona) => persona.persona_id !== deleteCandidate.persona_id,
              ),
            }
          : current,
      )
      if (selectedId === deleteCandidate.persona_id || creating) {
        closeEditor()
      }
      setDeleteCandidate(null)
      void queryClient.invalidateQueries({ queryKey: ['personas'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    } catch {
      setActionError(t('personaDeleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  const formatUpdated = (value: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
      new Date(value),
    )

  return (
    <div className="flex h-dvh min-w-0 flex-1 flex-col bg-[var(--canvas)]">
      <header className="flex min-h-16 items-center gap-2.5 border-b border-[var(--hairline)]/70 bg-[var(--canvas)]/90 px-4 backdrop-blur-md md:px-6">
        <button
          type="button"
          className={clsx(iconButtonClass, sidebarCollapsed ? 'inline-flex' : 'lg:hidden')}
          onClick={onOpenSidebar}
          aria-label={t('openNavigation')}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <Menu size={19} />}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium tracking-tight text-[var(--ink)]">
            {t('personaManagement')}
          </h1>
          <p className="mt-0.5 text-xs uppercase tracking-wider text-[var(--muted-soft)]">
            Personas
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--gold)] bg-[var(--gold)] px-3 text-xs font-semibold text-slate-900 transition-colors hover:bg-[var(--gold-hover)]"
          onClick={beginCreate}
        >
          <Plus size={15} />
          {t('newPersona')}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[310px_minmax(0,1fr)]">
        <section
          className={clsx(
            'min-h-0 flex-col border-[var(--hairline)]/70 lg:flex lg:border-r',
            mobileEditorOpen ? 'hidden' : 'flex',
          )}
          aria-label={t('personaManagement')}
        >
          <div className="flex min-h-12 items-center justify-between px-4 text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-soft)]">
            <span>{t('allPersonas')}</span>
            <span className="tabular-nums">{personas.length || ''}</span>
          </div>
          <div className="chat-scroll-area min-h-0 flex-1 overflow-y-auto px-3 pb-5">
            {personasQuery.isLoading && (
              <div className="space-y-2">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-[88px] animate-pulse rounded-xl bg-[var(--surface-strong)]/60"
                  />
                ))}
              </div>
            )}

            {personasQuery.isError && !personasQuery.isLoading && (
              <div className="mx-1 mt-3 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-5 text-center text-xs text-[var(--danger)]">
                <p>{t('personaLoadFailed')}</p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1.5 underline underline-offset-4"
                  onClick={() => void personasQuery.refetch()}
                >
                  <RotateCcw size={13} />
                  {t('retry')}
                </button>
              </div>
            )}

            {!personasQuery.isLoading && !personasQuery.isError && personas.length === 0 && (
              <div className="mx-2 mt-7 rounded-2xl border border-dashed border-[var(--liquid-border)] px-5 py-8 text-center">
                <UsersRound size={24} className="mx-auto text-[var(--muted-soft)]" />
                <p className="mt-3 text-sm font-medium text-[var(--ink)]">{t('noPersonas')}</p>
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted-soft)]">
                  {t('noPersonasHint')}
                </p>
                <button
                  type="button"
                  className="mt-4 text-xs font-medium text-[var(--blue-strong)] underline-offset-4 hover:underline"
                  onClick={beginCreate}
                >
                  {t('createFirstPersona')}
                </button>
              </div>
            )}

            <div className="space-y-2">
              {personas.map((persona) => (
                <button
                  key={persona.persona_id}
                  type="button"
                  className={clsx(
                    'group w-full rounded-xl border px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow]',
                    selectedId === persona.persona_id && !creating
                      ? 'border-[var(--blue)]/40 bg-[var(--sidebar-active)] shadow-sm'
                      : 'border-transparent hover:border-[var(--liquid-border)]/60 hover:bg-[var(--surface)]/65',
                  )}
                  onClick={() => selectPersona(persona.persona_id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--gold-line)]/45 bg-[var(--gold-soft)] text-[var(--gold-hover)]">
                      <UserRound size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                        {persona.name}
                      </span>
                      <span className="mt-1 block line-clamp-2 min-h-8 text-xs leading-4 text-[var(--muted)]">
                        {persona.description || t('noPersonaDescription')}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2 text-[0.6875rem] text-[var(--muted-soft)]">
                        <span>
                          {persona.message_count} {t('presetMessages')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatUpdated(persona.updated_at)}</span>
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {actionError && !showEditor && (
              <div
                role="alert"
                className="mx-1 mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]"
              >
                {actionError}
              </div>
            )}
          </div>
        </section>

        <section
          className={clsx(
            'min-h-0 flex-col lg:flex',
            mobileEditorOpen ? 'flex' : 'hidden lg:flex',
          )}
        >
          {creating ? (
            <PersonaEditor
              key={`create-${editorVersion}`}
              mode="create"
              onSave={savePersona}
              onDelete={() => undefined}
              onBack={closeEditor}
            />
          ) : selectedId ? (
            detailQuery.isLoading ? (
              <div className="flex flex-1 flex-col">
                <div className="flex min-h-14 items-center border-b border-[var(--hairline)]/70 px-4 lg:hidden">
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--muted)]"
                    onClick={closeEditor}
                    aria-label={t('backToPersonas')}
                  >
                    <ArrowLeft size={18} />
                  </button>
                </div>
                <div className="flex flex-1 items-center justify-center">
                  <div
                    className="size-7 animate-spin rounded-full border-2 border-[var(--surface-strong)] border-t-[var(--gold)]"
                    aria-label={t('loading')}
                  />
                </div>
              </div>
            ) : detailQuery.isError || !detailQuery.data ? (
              <div className="flex flex-1 flex-col">
                <div className="flex min-h-14 items-center border-b border-[var(--hairline)]/70 px-4 lg:hidden">
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--muted)]"
                    onClick={closeEditor}
                    aria-label={t('backToPersonas')}
                  >
                    <ArrowLeft size={18} />
                  </button>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  <RotateCcw size={24} className="text-[var(--muted-soft)]" />
                  <h2 className="mt-4 font-serif text-2xl text-[var(--ink)]">
                    {t('personaDetailLoadFailed')}
                  </h2>
                  <button
                    type="button"
                    className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--gold)] bg-[var(--gold)] px-4 text-sm font-semibold text-slate-900"
                    onClick={() => void detailQuery.refetch()}
                  >
                    <RotateCcw size={15} />
                    {t('retry')}
                  </button>
                </div>
              </div>
            ) : (
              <PersonaEditor
                key={`${detailQuery.data.persona_id}-${editorVersion}`}
                mode="edit"
                initial={detailQuery.data}
                onSave={savePersona}
                onDelete={() => {
                  const summary = personas.find(
                    (persona) => persona.persona_id === detailQuery.data.persona_id,
                  )
                  if (summary) {
                    setActionError(null)
                    setDeleteCandidate(summary)
                  }
                }}
                onBack={closeEditor}
              />
            )
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <span className="inline-flex size-14 items-center justify-center rounded-2xl border border-[var(--liquid-border)] bg-[var(--surface-soft)] text-[var(--muted)]">
                <UsersRound size={24} />
              </span>
              <h2 className="mt-5 font-serif text-2xl text-[var(--ink)]">
                {t('personaManagementHint')}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                {t('personaManagementDescription')}
              </p>
              <button
                type="button"
                className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--gold)] bg-[var(--gold)] px-4 text-sm font-semibold text-slate-900"
                onClick={beginCreate}
              >
                <Plus size={15} />
                {t('newPersona')}
              </button>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        title={t('deletePersona')}
        description={
          <div>
            <p>{t('deletePersonaWarning')}</p>
            {deleteCandidate && (
              <p className="mt-2 font-medium text-[var(--ink)]">{deleteCandidate.name}</p>
            )}
            {actionError && (
              <p className="mt-2 text-[var(--danger)]" role="alert">
                {actionError}
              </p>
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
            setActionError(null)
          }
        }}
      />
    </div>
  )
}
