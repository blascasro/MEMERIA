import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/balances',    label: 'Balances' },
  { to: '/reservas',   label: 'Reservas' },
  { to: '/aportes',    label: 'Aportes' },
  { to: '/escrutinios', label: 'Escrutinios' },
]

export default function Navbar({ dark, onToggle }) {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/balances" className="nav-brand">
          <span className="nav-brand-name">Memeria</span>
          <span className="nav-brand-sub">Panel de la comunidad</span>
        </NavLink>

        <div className="nav-links">
          {LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div className="nav-actions">
          <button
            className="theme-toggle"
            onClick={onToggle}
            title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={dark ? 'Modo claro' : 'Modo oscuro'}
          >
            {dark ? '☀' : '☾'}
          </button>
        </div>
      </div>
    </nav>
  )
}
