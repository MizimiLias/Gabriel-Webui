import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PersonaManager } from '../src/components/PersonaManager'
import { AppSettingsProvider } from '../src/contexts/AppSettingsContext'
import {
  ApiError,
  createPersona,
  deletePersona,
  getPersona,
  listPersonas,
  updatePersona,
} from '../src/lib/api'
import type { PersonaDetail, PersonaSummary } from '../src/lib/types'

vi.mock('../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api')>()
  return {
    ...actual,
    listPersonas: vi.fn(),
    getPersona: vi.fn(),
    createPersona: vi.fn(),
    updatePersona: vi.fn(),
    deletePersona: vi.fn(),
  }
})

const mockList = vi.mocked(listPersonas)
const mockGet = vi.mocked(getPersona)
const mockCreate = vi.mocked(createPersona)
const mockUpdate = vi.mocked(updatePersona)
const mockDelete = vi.mocked(deletePersona)

const summary: PersonaSummary = {
  persona_id: 'persona-one',
  name: 'Ada',
  description: 'engineering assistant',
  message_count: 1,
  created_at: '2026-10-27T20:00:00+08:00',
  updated_at: '2026-10-27T20:00:00+08:00',
}

const detail: PersonaDetail = {
  persona_id: 'persona-one',
  name: 'Ada',
  description: 'engineering assistant',
  system_prompt: 'You are Ada.',
  messages: [
    {
      id: 'message-one',
      position: 0,
      role: 'user',
      content: 'Who are you?',
    },
    {
      id: 'message-two',
      position: 1,
      role: 'assistant',
      content: 'I am Ada.',
    },
  ],
  created_at: summary.created_at,
  updated_at: summary.updated_at,
}

function renderManager() {
  localStorage.setItem('gabriel.language', 'zh')
  localStorage.setItem('gabriel.theme', 'light')
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/personas']}>
        <AppSettingsProvider>
          <PersonaManager sidebarCollapsed={false} onOpenSidebar={vi.fn()} />
        </AppSettingsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PersonaManager', () => {
  beforeEach(() => {
    mockList.mockReset().mockResolvedValue({ items: [summary] })
    mockGet.mockReset().mockResolvedValue(detail)
    mockCreate.mockReset()
    mockUpdate.mockReset()
    mockDelete.mockReset()
  })

  it('creates a persona with preset dialogue', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({ ...detail, name: 'Grace' })
    renderManager()

    await user.click((await screen.findAllByRole('button', { name: '新建人格' }))[0])
    await user.type(screen.getByPlaceholderText('例如：Ada'), 'Grace')
    await user.type(screen.getByPlaceholderText('描述人格、语气、约束和能力范围…'), 'helper')
    await user.click(screen.getByRole('button', { name: '添加对话组' }))
    await user.type(screen.getByPlaceholderText('输入示例中的用户消息…'), 'Hello')
    await user.type(screen.getByPlaceholderText('输入示例中的助手回复…'), 'Hi there')
    await user.click(screen.getByRole('button', { name: '保存人格' }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'Grace',
        description: null,
        system_prompt: 'helper',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      })
    })
  })

  it('updates existing messages by id and appends new messages without an id', async () => {
    const user = userEvent.setup()
    mockUpdate.mockResolvedValue({
      ...detail,
      messages: [
        { ...detail.messages[0], content: 'Who are you, really?' },
        { ...detail.messages[1], content: 'I am still Ada.' },
        {
          id: 'message-three',
          position: 2,
          role: 'user',
          content: 'Be concise.',
        },
        {
          id: 'message-four',
          position: 3,
          role: 'assistant',
          content: 'Understood.',
        },
      ],
      updated_at: '2026-10-27T20:05:00+08:00',
    })
    renderManager()

    await user.click(await screen.findByRole('button', { name: /Ada/ }))
    const existingUserMessage = await screen.findByPlaceholderText('输入示例中的用户消息…')
    await user.clear(existingUserMessage)
    await user.type(existingUserMessage, 'Who are you, really?')
    const existingAssistantMessage = screen.getByPlaceholderText('输入示例中的助手回复…')
    await user.clear(existingAssistantMessage)
    await user.type(existingAssistantMessage, 'I am still Ada.')
    await user.click(screen.getByRole('button', { name: '添加对话组' }))
    const userMessages = screen.getAllByPlaceholderText('输入示例中的用户消息…')
    const assistantMessages = screen.getAllByPlaceholderText('输入示例中的助手回复…')
    await user.type(userMessages[1], 'Be concise.')
    await user.type(assistantMessages[1], 'Understood.')
    await user.click(screen.getByRole('button', { name: '保存人格' }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        'persona-one',
        expect.objectContaining({
          messages: [
            {
              id: 'message-one',
              role: 'user',
              content: 'Who are you, really?',
            },
            {
              id: 'message-two',
              role: 'assistant',
              content: 'I am still Ada.',
            },
            { role: 'user', content: 'Be concise.' },
            { role: 'assistant', content: 'Understood.' },
          ],
        }),
      )
    })
  })

  it('adds and removes complete dialogue pairs', async () => {
    const user = userEvent.setup()
    renderManager()

    await user.click(await screen.findByRole('button', { name: /Ada/ }))
    await user.click(screen.getByRole('button', { name: '添加对话组' }))
    expect(screen.getAllByPlaceholderText('输入示例中的用户消息…')).toHaveLength(2)
    expect(screen.getAllByPlaceholderText('输入示例中的助手回复…')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: '删除最后一组对话' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '删除最后一组对话' }))
    expect(screen.getAllByPlaceholderText('输入示例中的用户消息…')).toHaveLength(1)
    expect(screen.getAllByPlaceholderText('输入示例中的助手回复…')).toHaveLength(1)
  })

  it('blocks saving until both sides of a new pair are filled', async () => {
    const user = userEvent.setup()
    renderManager()

    await user.click(await screen.findByRole('button', { name: /Ada/ }))
    await user.click(screen.getByRole('button', { name: '添加对话组' }))
    const userMessages = screen.getAllByPlaceholderText('输入示例中的用户消息…')
    await user.type(userMessages[1], 'One side only')

    expect(screen.getByRole('button', { name: '保存人格' })).toBeDisabled()
    expect(screen.getByText('每组对话都必须同时包含用户消息和助手回复。')).toBeInTheDocument()
  })

  it('allows saving with no preset dialogue', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({ ...detail, messages: [] })
    renderManager()

    await user.click((await screen.findAllByRole('button', { name: '新建人格' }))[0])
    await user.type(screen.getByPlaceholderText('例如：Ada'), 'Grace')
    await user.type(screen.getByPlaceholderText('描述人格、语气、约束和能力范围…'), 'helper')
    await user.click(screen.getByRole('button', { name: '保存人格' }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [] }),
      )
    })
  })

  it('deletes a persona after confirmation', async () => {
    const user = userEvent.setup()
    mockDelete.mockResolvedValue()
    renderManager()

    await user.click(await screen.findByRole('button', { name: /Ada/ }))
    await user.click(screen.getByRole('button', { name: '删除' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('persona-one')
    })
  })

  it('shows a localized conflict error and preserves the form', async () => {
    const user = userEvent.setup()
    mockUpdate.mockRejectedValue(new ApiError('duplicate', { status: 409 }))
    renderManager()

    await user.click(await screen.findByRole('button', { name: /Ada/ }))
    const nameInput = await screen.findByPlaceholderText('例如：Ada')
    await user.clear(nameInput)
    await user.type(nameInput, 'Grace')
    await user.click(screen.getByRole('button', { name: '保存人格' }))

    expect(await screen.findByText('已存在同名人格。')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('例如：Ada')).toHaveValue('Grace')
  })
})
