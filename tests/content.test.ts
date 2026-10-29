import { describe, expect, it } from 'vitest'
import {
  appendTextDelta,
  imageParts,
  textFromParts,
  visibleParts,
} from '../src/lib/content'
import type { ContentPart } from '../src/lib/types'

const reminder: ContentPart = {
  type: 'text',
  text: '<system_reminder>Current datetime: 2026-10-29</system_reminder>',
}

describe('content helpers', () => {
  it('hides system reminders from visible text', () => {
    const parts: ContentPart[] = [
      { type: 'text', text: 'hello' },
      reminder,
      { type: 'image_url', image_url: { url: 'https://example.com/a.png' } },
    ]

    expect(visibleParts(parts)).toEqual([parts[0], parts[2]])
    expect(textFromParts(parts)).toBe('hello')
    expect(imageParts(parts)).toEqual([parts[2]])
  })

  it('appends streamed text to the trailing text part', () => {
    expect(appendTextDelta([{ type: 'text', text: 'hel' }], 'lo')).toEqual([
      { type: 'text', text: 'hello' },
    ])
    expect(appendTextDelta([], 'hello')).toEqual([{ type: 'text', text: 'hello' }])
  })
})
