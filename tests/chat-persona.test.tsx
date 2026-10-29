import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatView } from '../src/components/ChatView'
import { AppSettingsProvider } from '../src/contexts/AppSettingsContext'
import { getHistory, listPersonas, streamChat } from '../src/lib/api'

vi.mock('../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api')>()
  return {
    ...actual,
    getHistory: vi.fn(),
    listPersonas: vi.fn(),
    streamChat: vi.fn(),
  }
})

const mockHistory = vi.mocked(getHistory)
const mockList = vi.mocked(listPersonas)
const mockStream = vi.mocked(streamChat)

function renderChat() {
  localStorage.setItem('gabriel.language', 'zh')
  localStorage.setItem('gabriel.theme', 'light')
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <AppSettingsProvider>
          <ChatView sessions={[]} sidebarCollapsed={false} onOpenSidebar={vi.fn()} />
        </AppSettingsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('new chat persona selection', () => {
  beforeEach(() => {
    mockHistory.mockReset()
    mockList.mockReset().mockResolvedValue({
      items: [
        {
          persona_id: 'persona-one',
          name: 'Ada',
          description: 'engineering assistant',
          message_count: 1,
          created_at: '2026-10-27T20:00:00+08:00',
          updated_at: '2026-10-27T20:00:00+08:00',
        },
      ],
    })
    mockStream.mockReset().mockImplementation(async ({ handlers }) => {
      handlers.onStart({ session_id: 'session-one', message_id: 'assistant-one' })
      handlers.onToken('Hello')
      handlers.onDone({
        session_id: 'session-one',
        message_id: 'assistant-one',
        title: 'A chat',
        created_at: '2026-10-27T20:00:00+08:00',
      })
    })
  })

  it('passes the selected persona only to the first message request', async () => {
    const user = userEvent.setup()
    renderChat()

    const personaSelect = await screen.findByLabelText('本次对话使用人格')
    await waitFor(() => expect(personaSelect).toBeEnabled())
    await user.selectOptions(personaSelect, 'persona-one')
    await user.type(screen.getByPlaceholderText('给 Gabriel 发消息…'), 'Hello')
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    await waitFor(() => {
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          parts: [{ type: 'text', text: 'Hello' }],
          personaId: 'persona-one',
        }),
      )
    })
  })

  it('sends text and image URL content parts', async () => {
    const user = userEvent.setup()
    renderChat()

    await user.type(screen.getByPlaceholderText('给 Gabriel 发消息…'), 'Describe this')
    await user.type(
      screen.getByLabelText('https://example.com/image.png'),
      'https://example.com/image.png',
    )
    await user.click(screen.getByRole('button', { name: '添加图片 URL' }))
    await user.click(screen.getByRole('button', { name: '发送消息' }))

    await waitFor(() => {
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          parts: [
            { type: 'text', text: 'Describe this' },
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/image.png' },
            },
          ],
        }),
      )
    })
  })
})
