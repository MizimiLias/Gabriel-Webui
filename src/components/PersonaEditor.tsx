import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { useAppSettings } from '../contexts/app-settings'
import { ApiError } from '../lib/api'
import {
  MAX_PERSONA_DESCRIPTION_LENGTH,
  MAX_PERSONA_MESSAGE_LENGTH,
  MAX_PERSONA_MESSAGES,
  MAX_PERSONA_NAME_LENGTH,
  MAX_PERSONA_PRESET_TOTAL_LENGTH,
  MAX_PERSONA_SYSTEM_PROMPT_LENGTH,
} from '../lib/persona-limits'
import type { PersonaCreateInput, PersonaDetail } from '../lib/types'

interface PersonaEditorProps {
  mode: 'create' | 'edit'
  initial?: PersonaDetail
  onSave: (input: PersonaCreateInput) => Promise<void>
  onDelete: () => void
  onBack: () => void
}

interface EditableMessage {
  key: string
  id?: string
  content: string
}

interface EditablePair {
  key: string
  user: EditableMessage
  assistant: EditableMessage
}

function blankMessage(): EditableMessage {
  return {
    key: crypto.randomUUID(),
    content: '',
  }
}

function blankPair(): EditablePair {
  return {
    key: crypto.randomUUID(),
    user: blankMessage(),
    assistant: blankMessage(),
  }
}

function initialPairs(persona?: PersonaDetail): EditablePair[] {
  if (!persona) {
    return []
  }

  const pairs: EditablePair[] = []
  for (let index = 0; index < persona.messages.length; index += 2) {
    const userMessage = persona.messages[index]
    const assistantMessage = persona.messages[index + 1]
    pairs.push({
      key: userMessage?.id ?? crypto.randomUUID(),
      user: {
        key: userMessage?.id ?? crypto.randomUUID(),
        id: userMessage?.id,
        content: userMessage?.content ?? '',
      },
      assistant: {
        key: assistantMessage?.id ?? crypto.randomUUID(),
        id: assistantMessage?.id,
        content: assistantMessage?.content ?? '',
      },
    })
  }
  return pairs
}

const inputClass =
  'w-full rounded-xl border border-[var(--liquid-border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--muted-soft)] focus:border-[var(--blue-strong)]/60 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--blue-strong)_8%,transparent)]'
const labelClass =
  'text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-soft)]'

export function PersonaEditor({
  mode,
  initial,
  onSave,
  onDelete,
  onBack,
}: PersonaEditorProps) {
  const { t } = useAppSettings()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? '')
  const [pairs, setPairs] = useState<EditablePair[]>(() => initialPairs(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalMessageLength = useMemo(
    () =>
      pairs.reduce(
        (total, pair) => total + pair.user.content.length + pair.assistant.content.length,
        0,
      ),
    [pairs],
  )
  const validation = useMemo(() => {
    const nameLength = name.trim().length
    const promptLength = systemPrompt.trim().length
    const emptyMessage = pairs.some(
      (pair) => !pair.user.content.trim() || !pair.assistant.content.trim(),
    )
    const oversizedMessage = pairs.some(
      (pair) =>
        pair.user.content.length > MAX_PERSONA_MESSAGE_LENGTH ||
        pair.assistant.content.length > MAX_PERSONA_MESSAGE_LENGTH,
    )
    return {
      name: nameLength === 0 || name.length > MAX_PERSONA_NAME_LENGTH,
      description: description.length > MAX_PERSONA_DESCRIPTION_LENGTH,
      systemPrompt:
        promptLength === 0 || systemPrompt.length > MAX_PERSONA_SYSTEM_PROMPT_LENGTH,
      messages:
        pairs.length * 2 > MAX_PERSONA_MESSAGES ||
        emptyMessage ||
        oversizedMessage ||
        totalMessageLength > MAX_PERSONA_PRESET_TOTAL_LENGTH,
    }
  }, [description.length, name, pairs, systemPrompt, totalMessageLength])
  const canSave = !Object.values(validation).some(Boolean) && !saving

  const updatePair = (
    pairKey: string,
    role: 'user' | 'assistant',
    content: string,
  ) => {
    setPairs((current) =>
      current.map((pair) =>
        pair.key === pairKey
          ? { ...pair, [role]: { ...pair[role], content } }
          : pair,
      ),
    )
    setError(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        system_prompt: systemPrompt.trim(),
        messages: pairs.flatMap((pair) => [
          {
            ...(pair.user.id ? { id: pair.user.id } : {}),
            role: 'user' as const,
            content: pair.user.content.trim(),
          },
          {
            ...(pair.assistant.id ? { id: pair.assistant.id } : {}),
            role: 'assistant' as const,
            content: pair.assistant.content.trim(),
          },
        ]),
      })
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 409) {
          setError(t('personaNameConflict'))
        } else if (caught.status === 422) {
          setError(t('personaValidationFailed'))
        } else {
          setError(caught.message || t('personaSaveFailed'))
        }
      } else {
        setError(t('personaSaveFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="flex min-h-14 items-center gap-3 border-b border-[var(--hairline)]/70 px-4 md:px-6">
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] lg:hidden"
          onClick={onBack}
          aria-label={t('backToPersonas')}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-serif text-xl text-[var(--ink)]">
            {mode === 'create' ? t('newPersona') : t('editPersona')}
          </h2>
          {initial && (
            <p className="mt-0.5 truncate text-xs text-[var(--muted-soft)]">{initial.name}</p>
          )}
        </div>
        {mode === 'edit' && (
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--danger)]/25 px-3 text-xs font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]"
            onClick={onDelete}
          >
            <Trash2 size={14} />
            {t('delete')}
          </button>
        )}
      </div>

      <div className="chat-scroll-area min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-7 md:py-7">
        <div className="mx-auto max-w-[760px] space-y-6">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--danger)]"
            >
              {error}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className={labelClass}>{t('personaName')}</span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
                maxLength={MAX_PERSONA_NAME_LENGTH}
                placeholder={t('personaNamePlaceholder')}
                className={`${inputClass} mt-2 ${validation.name ? 'border-[var(--danger)]/50' : ''}`}
                aria-invalid={validation.name}
              />
              <span className="mt-1.5 block text-right text-[0.6875rem] tabular-nums text-[var(--muted-soft)]">
                {name.length} / {MAX_PERSONA_NAME_LENGTH}
              </span>
            </label>

            <label className="block">
              <span className={labelClass}>{t('personaDescription')}</span>
              <textarea
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                  setError(null)
                }}
                maxLength={MAX_PERSONA_DESCRIPTION_LENGTH}
                rows={2}
                placeholder={t('personaDescriptionPlaceholder')}
                className={`${inputClass} mt-2 min-h-[76px] resize-none ${validation.description ? 'border-[var(--danger)]/50' : ''}`}
                aria-invalid={validation.description}
              />
              <span className="mt-1.5 block text-right text-[0.6875rem] tabular-nums text-[var(--muted-soft)]">
                {description.length} / {MAX_PERSONA_DESCRIPTION_LENGTH}
              </span>
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>{t('personaSystemPrompt')}</span>
            <textarea
              value={systemPrompt}
              onChange={(event) => {
                setSystemPrompt(event.target.value)
                setError(null)
              }}
              maxLength={MAX_PERSONA_SYSTEM_PROMPT_LENGTH}
              rows={6}
              placeholder={t('personaSystemPromptPlaceholder')}
              className={`${inputClass} mt-2 min-h-36 resize-y leading-6 ${validation.systemPrompt ? 'border-[var(--danger)]/50' : ''}`}
              aria-invalid={validation.systemPrompt}
            />
            <span className="mt-1.5 flex items-center justify-between gap-3 text-[0.6875rem] text-[var(--muted-soft)]">
              <span>{t('personaSystemPromptHint')}</span>
              <span className="shrink-0 tabular-nums">
                {systemPrompt.length.toLocaleString()} /{' '}
                {MAX_PERSONA_SYSTEM_PROMPT_LENGTH.toLocaleString()}
              </span>
            </span>
          </label>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className={labelClass}>{t('personaPresetMessages')}</h3>
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted-soft)]">
                  {t('personaMessagesHint')}
                </p>
              </div>
              <span className="text-[0.6875rem] tabular-nums text-[var(--muted-soft)]">
                {pairs.length * 2} / {MAX_PERSONA_MESSAGES} ·{' '}
                {totalMessageLength.toLocaleString()} /{' '}
                {MAX_PERSONA_PRESET_TOTAL_LENGTH.toLocaleString()}
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {pairs.map((pair, index) => (
                <article
                  key={pair.key}
                  className="rounded-xl border border-[var(--liquid-border)] bg-[var(--surface)]/65 p-3.5"
                >
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="text-[0.6875rem] font-medium tabular-nums text-[var(--muted-soft)]">
                      {t('personaDialoguePair')} #{index + 1}
                    </span>
                    {!pair.user.content.trim() || !pair.assistant.content.trim() ? (
                      <span className="rounded-full bg-[var(--danger-soft)] px-2 py-0.5 text-[0.6875rem] text-[var(--danger)]">
                        {t('personaPairIncomplete')}
                      </span>
                    ) : null}
                    {index === pairs.length - 1 && (
                      <button
                        type="button"
                        className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        onClick={() => {
                          setPairs((current) => current.slice(0, -1))
                          setError(null)
                        }}
                        aria-label={t('removeLastPersonaPair')}
                        title={t('removeLastPersonaPair')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-[var(--muted)]">
                        {t('personaUserMessage')}
                        <span className="text-[0.6875rem] font-normal tabular-nums text-[var(--muted-soft)]">
                          {pair.user.content.length.toLocaleString()} /{' '}
                          {MAX_PERSONA_MESSAGE_LENGTH.toLocaleString()}
                        </span>
                      </span>
                      <textarea
                        value={pair.user.content}
                        onChange={(event) =>
                          updatePair(pair.key, 'user', event.target.value)
                        }
                        maxLength={MAX_PERSONA_MESSAGE_LENGTH}
                        rows={3}
                        placeholder={t('personaUserMessagePlaceholder')}
                        aria-label={`${t('personaUserMessage')} ${index + 1}`}
                        aria-invalid={!pair.user.content.trim()}
                        className="w-full resize-y rounded-lg border border-[var(--liquid-border)]/75 bg-[var(--surface)] px-3 py-2 text-sm leading-6 text-[var(--ink)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--blue-strong)]/55 aria-invalid:border-[var(--danger)]/45"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-[var(--muted)]">
                        {t('personaAssistantMessage')}
                        <span className="text-[0.6875rem] font-normal tabular-nums text-[var(--muted-soft)]">
                          {pair.assistant.content.length.toLocaleString()} /{' '}
                          {MAX_PERSONA_MESSAGE_LENGTH.toLocaleString()}
                        </span>
                      </span>
                      <textarea
                        value={pair.assistant.content}
                        onChange={(event) =>
                          updatePair(pair.key, 'assistant', event.target.value)
                        }
                        maxLength={MAX_PERSONA_MESSAGE_LENGTH}
                        rows={3}
                        placeholder={t('personaAssistantMessagePlaceholder')}
                        aria-label={`${t('personaAssistantMessage')} ${index + 1}`}
                        aria-invalid={!pair.assistant.content.trim()}
                        className="w-full resize-y rounded-lg border border-[var(--liquid-border)]/75 bg-[var(--surface)] px-3 py-2 text-sm leading-6 text-[var(--ink)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--blue-strong)]/55 aria-invalid:border-[var(--danger)]/45"
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>

            {validation.messages && pairs.length > 0 && (
              <p className="mt-2 text-xs leading-5 text-[var(--danger)]" role="alert">
                {t('personaPairValidation')}
              </p>
            )}

            <button
              type="button"
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-[var(--liquid-border)] px-3 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--gold-line)] hover:bg-[var(--gold-soft)] hover:text-[var(--ink)] disabled:opacity-45"
              onClick={() => {
                setPairs((current) => [...current, blankPair()])
                setError(null)
              }}
              disabled={pairs.length * 2 >= MAX_PERSONA_MESSAGES}
            >
              <Plus size={14} />
              {t('addPersonaPair')}
            </button>
          </section>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-[var(--hairline)]/70 bg-[var(--canvas)]/95 px-4 py-3 md:px-6">
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--liquid-border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-soft)]"
          onClick={onBack}
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--gold)] bg-[var(--gold)] px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-[var(--gold-hover)] disabled:border-[var(--surface-strong)] disabled:bg-[var(--surface-strong)] disabled:text-[var(--muted-soft)]"
          disabled={!canSave}
        >
          <Save size={15} />
          {saving ? t('savingPersona') : t('savePersona')}
        </button>
      </div>
    </form>
  )
}
