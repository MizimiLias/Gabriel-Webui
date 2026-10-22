export interface ParsedSseEvent {
  event: string
  data: string
}

interface ExtractionResult {
  events: ParsedSseEvent[]
  remainder: string
}

const EVENT_BOUNDARY = /\r?\n\r?\n/

export function extractSseEvents(buffer: string): ExtractionResult {
  const events: ParsedSseEvent[] = []
  let remainder = buffer

  while (true) {
    const match = EVENT_BOUNDARY.exec(remainder)
    if (!match || match.index === undefined) {
      break
    }

    const block = remainder.slice(0, match.index)
    remainder = remainder.slice(match.index + match[0].length)
    const parsed = parseSseBlock(block)
    if (parsed) {
      events.push(parsed)
    }
  }

  return { events, remainder }
}

export function parseSseBlock(block: string): ParsedSseEvent | null {
  let event = 'message'
  const dataLines: string[] = []

  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) {
      continue
    }
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) {
      value = value.slice(1)
    }

    if (field === 'event') {
      event = value
    } else if (field === 'data') {
      dataLines.push(value)
    }
  }

  if (dataLines.length === 0) {
    return null
  }
  return { event, data: dataLines.join('\n') }
}

export function flushSseEvents(buffer: string): ParsedSseEvent[] {
  const parsed = parseSseBlock(buffer)
  return parsed ? [parsed] : []
}
