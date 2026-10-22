import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ChatView } from './components/ChatView'
import { Sidebar } from './components/Sidebar'
import { getSessions } from './lib/api'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
    staleTime: 30_000,
  })

  const activeSessionId = location.pathname.startsWith('/chat/')
    ? decodeURIComponent(location.pathname.slice('/chat/'.length))
    : undefined
  const sessions = sessionsQuery.data?.items ?? []

  const openSidebar = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed(false)
    } else {
      setMobileOpen(true)
    }
  }

  return (
    <div className="app-frame">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isLoading={sessionsQuery.isLoading}
        isError={sessionsQuery.isError}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        onNewChat={() => navigate('/')}
        onSessionDeleted={(sessionId) => {
          if (sessionId === activeSessionId) {
            navigate('/', { replace: true })
          }
          void queryClient.invalidateQueries({ queryKey: ['sessions'] })
        }}
      />
      <main className="min-w-0 flex-1">
        <Routes>
          <Route
            path="/"
            element={
              <ChatView
                key={location.pathname}
                sessions={sessions}
                sidebarCollapsed={collapsed}
                onOpenSidebar={openSidebar}
              />
            }
          />
          <Route
            path="/chat/:sessionId"
            element={
              <ChatView
                key={location.pathname}
                sessions={sessions}
                sidebarCollapsed={collapsed}
                onOpenSidebar={openSidebar}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
