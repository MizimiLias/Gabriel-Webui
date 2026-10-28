import { useQuery } from '@tanstack/react-query'
import { ChevronDown, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppSettings } from '../contexts/app-settings'
import { listPersonas } from '../lib/api'

interface PersonaSelectorProps {
  value: string | null
  onChange: (personaId: string | null) => void
}

export function PersonaSelector({ value, onChange }: PersonaSelectorProps) {
  const { t } = useAppSettings()
  const navigate = useNavigate()
  const personasQuery = useQuery({
    queryKey: ['personas'],
    queryFn: listPersonas,
    staleTime: 30_000,
  })
  const personas = personasQuery.data?.items ?? []
  const selected = personas.find((persona) => persona.persona_id === value)

  return (
    <div className="mt-5 w-full max-w-sm text-left">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <label
          htmlFor="new-chat-persona"
          className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--muted-soft)]"
        >
          {t('personaForChat')}
        </label>
        <button
          type="button"
          className="text-xs text-[var(--blue-strong)] underline-offset-4 hover:underline"
          onClick={() => navigate('/personas')}
        >
          {t('managePersonas')}
        </button>
      </div>
      <div className="relative">
        <UserRound
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-soft)]"
        />
        <select
          id="new-chat-persona"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
          disabled={personasQuery.isLoading || personasQuery.isError}
          className="min-h-10 w-full appearance-none rounded-xl border border-[var(--liquid-border)] bg-[var(--surface)]/75 py-2 pl-9 pr-9 text-sm text-[var(--ink)] shadow-sm outline-none transition-colors focus:border-[var(--blue-strong)]/55 disabled:text-[var(--muted-soft)]"
        >
          <option value="">{t('noPersona')}</option>
          {personas.map((persona) => (
            <option key={persona.persona_id} value={persona.persona_id}>
              {persona.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-soft)]"
        />
      </div>
      <p className="mt-2 min-h-5 px-1 text-xs leading-5 text-[var(--muted-soft)]">
        {personasQuery.isError
          ? t('personaLoadFailed')
          : selected
            ? selected.description || t('personaSelectedHint')
            : t('noPersonaHint')}
      </p>
    </div>
  )
}
