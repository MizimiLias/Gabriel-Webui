import type { ContentPart, ImageURLPart, TextPart } from './types'

const SYSTEM_REMINDER_RE = /^<system_reminder>[\s\S]*<\/system_reminder>$/

export function isSystemReminderPart(part: ContentPart): boolean {
  return part.type === 'text' && SYSTEM_REMINDER_RE.test(part.text.trim())
}

export function visibleParts(parts: ContentPart[]): ContentPart[] {
  return parts.filter((part) => !isSystemReminderPart(part))
}

export function textFromParts(parts: ContentPart[]): string {
  return visibleParts(parts)
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
}

export function imageParts(parts: ContentPart[]): ImageURLPart[] {
  return visibleParts(parts).filter(
    (part): part is ImageURLPart => part.type === 'image_url',
  )
}

export function appendTextDelta(parts: ContentPart[], delta: string): ContentPart[] {
  if (!delta) {
    return parts
  }
  const last = parts.at(-1)
  if (last?.type === 'text') {
    return [...parts.slice(0, -1), { ...last, text: last.text + delta }]
  }
  return [...parts, { type: 'text', text: delta }]
}
