import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Balances from './pages/Balances.jsx'
import Reservas from './pages/Reservas.jsx'
import Aportes from './pages/Aportes.jsx'
import Escrutinios from './pages/Escrutinios.jsx'

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('memeria-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('memeria-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="app-root">
      <Navbar dark={dark} onToggle={() => setDark(d => !d)} />
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Navigate to="/balances" replace />} />
          <Route path="/balances" element={<Balances />} />
          <Route path="/reservas" element={<Reservas />} />
          <Route path="/aportes" element={<Aportes />} />
          <Route path="/escrutinios" element={<Escrutinios />} />
        </Routes>
      </main>
    </div>
  )
}
