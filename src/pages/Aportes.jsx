import { useState, useMemo } from 'react'
import {
  useSheetData, findColKey, fmt, fmtPct,
  getMonths, filterByMonth,
} from '../hooks/useSheetData'

function Loading() {
  return (
    <div className="state-box">
      <div className="spinner" />
      <span>Cargando aportes…</span>
    </div>
  )
}

export default function Aportes() {
  const { data, cols, loading, error } = useSheetData('APORTES')
  const [selectedMonth, setSelectedMonth] = useState('')

  const mesKey    = findColKey(cols, 'mes', 'fecha', 'month', 'periodo', 'date')
  const nombreKey = findColKey(cols, 'nombre', 'socio', 'name', 'member', 'usuario')
  const memesKey  = findColKey(cols, 'memes', 'aporte', 'cantidad', 'total', 'cant', 'contribucion')

  const months     = useMemo(() => getMonths(data, mesKey), [data, mesKey])
  const currentKey = selectedMonth || (months.length ? months[months.length - 1].key : '')

  const filtered = useMemo(
    () => filterByMonth(data, mesKey, currentKey),
    [data, mesKey, currentKey]
  )

  const sorted = useMemo(
    () =>
      [...filtered]
        .filter(r => nombreKey && r[nombreKey])
        .sort((a, b) => (Number(b[memesKey]) || 0) - (Number(a[memesKey]) || 0)),
    [filtered, nombreKey, memesKey]
  )

  const totalIngresado = sorted.reduce((s, r) => s + (Number(r[memesKey]) || 0), 0)
  const numSocios      = sorted.length
  const aporteSoc      = numSocios ? Math.round(totalIngresado / numSocios) : 0
  const incumplidores  = sorted.filter(r => (Number(r[memesKey]) || 0) === 0).length
  const evadido        = incumplidores * aporteSoc
  const pctEvasion     = numSocios ? (incumplidores / numSocios) * 100 : 0

  const top5    = sorted.slice(0, 5).reduce((s, r) => s + (Number(r[memesKey]) || 0), 0)
  const c5      = totalIngresado ? (top5 / totalIngresado) * 100 : 0
  const estr    = c5 >= 60 ? 'Oligopólica' : c5 >= 40 ? 'Concentrada' : 'Competitiva'
  const maxCant = sorted[0] ? Number(sorted[0][memesKey]) || 0 : 1

  if (loading) return <div className="container"><Loading /></div>
  if (error)   return <div className="container"><div className="state-box" style={{ color: 'var(--red)' }}>Error: {error}</div></div>

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Aportes</h1>
        <p className="page-subtitle">Contribuciones mensuales de los socios</p>
      </div>

      {/* Month selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>Mes:</label>
        <select
          className="select"
          value={currentKey}
          onChange={e => setSelectedMonth(e.target.value)}
        >
          {months.map(m => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Metrics */}
      <div className="metric-grid mb-24">
        <div className="metric-card">
          <div className="metric-label">Total ingresado</div>
          <div className="metric-value accent">{fmt(totalIngresado)}</div>
          <div className="metric-label mt-16">memes</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Aporte societario</div>
          <div className="metric-value">{fmt(aporteSoc)}</div>
          <div className="metric-label mt-16">por socio</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Incumplidores</div>
          <div className={`metric-value ${incumplidores > 0 ? 'red' : 'green'}`}>{incumplidores}</div>
          <div className="metric-label mt-16">de {numSocios} socios</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Evasión fiscal</div>
          <div className={`metric-value ${evadido > 0 ? 'red' : 'green'}`}>{fmt(evadido)}</div>
          <div className="metric-label mt-16">{fmtPct(pctEvasion)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Estr. de mercado</div>
          <div className="metric-value" style={{ fontSize: 15 }}>{estr}</div>
          <div className="metric-label mt-16">C5: {fmtPct(c5)}</div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              <th>Socio</th>
              <th className="right">Memes</th>
              <th className="right">%</th>
              <th style={{ minWidth: 130 }}>Participación</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                  Sin datos para este mes
                </td>
              </tr>
            )}
            {sorted.map((row, i) => {
              const cant = Number(row[memesKey]) || 0
              const pct  = totalIngresado ? (cant / totalIngresado) * 100 : 0
              return (
                <tr key={i}>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{row[nombreKey]}</td>
                  <td className="mono right">{fmt(cant)}</td>
                  <td className="mono right" style={{ color: 'var(--text-dim)' }}>{fmtPct(pct)}</td>
                  <td>
                    <div className="bar-wrap">
                      <div
                        className="bar-fill"
                        style={{ width: `${(cant / Math.max(maxCant, 1)) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
