import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import BottomNav from './components/BottomNav'
import CellarPage from './pages/CellarPage'
import AddWinePage from './pages/AddWinePage'
import DetailPage from './pages/DetailPage'
import SommelierPage from './pages/SommelierPage'
import AuthPage from './pages/AuthPage'
import './styles/global.css'

function AppShell() {
  const { loading } = useAuth()
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div className="spinner spinner-lg" />
        <p className="serif" style={{ fontSize: 16, color: 'var(--gold)', fontStyle: 'italic' }}>Opening your cellar…</p>
      </div>
    </div>
  )
  return (
    <div className="app">
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<CellarPage />} />
        <Route path="/add" element={<AddWinePage />} />
        <Route path="/wine/:id" element={<DetailPage />} />
        <Route path="/sommelier" element={<SommelierPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
        <Toaster position="top-center" toastOptions={{
          style: { background: '#1E3045', color: '#F0E8D5', border: '1px solid rgba(201,168,76,0.25)', fontFamily: "'DM Sans', sans-serif", fontSize: 13 },
          success: { iconTheme: { primary: '#C9A84C', secondary: '#0D1B2A' } },
          error: { iconTheme: { primary: '#E07070', secondary: '#0D1B2A' } },
        }} />
      </BrowserRouter>
    </AuthProvider>
  )
}