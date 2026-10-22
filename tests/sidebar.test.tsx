import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '../src/components/Sidebar'
import { AppSettingsProvider } from '../src/contexts/AppSettingsContext'
import { deleteSession, renameSession } from '../src/lib/api'
import type { ChatSessionListResponse, ChatSessionSummary } from '../src/lib/types'

vi.mock('../src/lib/api', () => ({
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
}))

const mockRename = vi.mocked(renameSession)
const mockDelete = vi.mocked(deleteSession)

const session: ChatSessionSummary = {
  session_id: 'session-one',
  title: 'A first conversation',
  created_at: '2026-10-22T10:00:00+08:00',
  updated_at: '2026-10-22T10:00:00+08:00',
  message_count: 2,
  last_message_preview: 'A useful answer',
}

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

function SidebarHost({
  initialData,
  activeSessionId,
  onSessionDeleted,
}: {
  initialData: ChatSessionListResponse
  activeSessionId?: string
  onSessionDeleted: (sessionId: string) => void
}) {
  const { data } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => initialData,
    initialData,
  })
  return (
    <Sidebar
      sessions={data.items}
      activeSessionId={activeSessionId}
      isLoading={false}
      isError={false}
      collapsed={false}
      mobileOpen
      onToggleCollapsed={vi.fn()}
      onCloseMobile={vi.fn()}
      onNewChat={vi.fn()}
      onSessionDeleted={onSessionDeleted}
    />
  )
}

function renderSidebar(
  overrides: {
    sessions?: ChatSessionSummary[]
    activeSessionId?: string
    onSessionDeleted?: (sessionId: string) => void
  } = {},
) {
  localStorage.setItem('gabriel.language', 'zh')
  localStorage.setItem('gabriel.theme', 'light')
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const data: ChatSessionListResponse = {
    items: overrides.sessions ?? [session],
  }
  queryClient.setQueryData(['sessions'], data)
  const onSessionDeleted = overrides.onSessionDeleted ?? vi.fn()

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <AppSettingsProvider>
          <SidebarHost
            initialData={data}
            activeSessionId={overrides.activeSessionId}
            onSessionDeleted={onSessionDeleted}
          />
          <LocationProbe />
        </AppSettingsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onSessionDeleted }
}

describe('Sidebar', () => {
  beforeEach(() => {
    mockRename.mockReset()
    mockDelete.mockReset()
  })

  it('navigates to a selected conversation', async () => {
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole('button', { name: /A first conversation/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/chat/session-one')
  })

  it('renames a conversation through the action menu', async () => {
    const user = userEvent.setup()
    mockRename.mockResolvedValue({
      ...session,
      title: 'Renamed conversation',
      updated_at: '2026-10-22T10:05:00+08:00',
    })
    renderSidebar()

    await user.click(screen.getByRole('button', { name: '会话操作' }))
    await user.click(screen.getByRole('menuitem', { name: '重命名' }))
    const input = screen.getByRole('textbox', { name: '重命名' })
    await user.clear(input)
    await user.type(input, 'Renamed conversation')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockRename).toHaveBeenCalledWith('session-one', 'Renamed conversation')
    })
    expect(await screen.findByText('Renamed conversation')).toBeInTheDocument()
  })

  it('confirms deletion and notifies the workspace', async () => {
    const user = userEvent.setup()
    mockDelete.mockResolvedValue()
    const { onSessionDeleted } = renderSidebar()

    await user.click(screen.getByRole('button', { name: '会话操作' }))
    await user.click(screen.getByRole('menuitem', { name: '删除' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('session-one')
      expect(onSessionDeleted).toHaveBeenCalledWith('session-one')
    })
  })

  it('filters the loaded conversation list locally', async () => {
    const user = userEvent.setup()
    renderSidebar()
    await user.type(screen.getByRole('textbox', { name: '搜索会话' }), 'absent')
    expect(await screen.findByText('没有匹配的会话')).toBeInTheDocument()
  })
})
