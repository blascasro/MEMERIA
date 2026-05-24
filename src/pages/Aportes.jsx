import { useState, useMemo } from 'react'
import { useSheetData, num, fmt, fmtPct, fmtPctAuto, monthLabel } from '../hooks/useSheetData'

// ── "Presupuestacion copia" layout ────────────────────────────────────────────
// row 0:     col 0 = "" · cols 1..N = month labels (one column per month, non-alternating)
// rows 1..M: member rows — col 0 = name · cols 1..N = memes for that month
// footer rows identified by col 0 value (exact string):
//   SOCIOS · TOTAL · Incumplidores · Evasion fiscal · Evasion fiscal%
//   Estructura · C5 · C3
//
// Skipped rows (col 0 value):
//   "Cartel Los analistas de Lirilí Larilá" · "A termino" · "Incompletos"
//   "Aporte ideal" · "IHH" · "Laucha"
//
// % per member = member_memes / SOCIOS_row[colIdx] * 100

const IGNORED = new Set([
  'Cartel Los analistas de Lirilí Larilá',
  'A termino', 'Incompletos', 'Aporte ideal', 'IHH', 'Laucha',
])

const TOTAL_KEYS = new Set([
  'SOCIOS', 'TOTAL', 'Incumplidores',
  'Evasion fiscal', 'Evasion fiscal%', 'Estructura', 'C5', 'C3',
])

function Loading() {
  return <div className="state-box"><div className="spinner" /><span>Cargando aportes…</span></div>
}

// Find the first row whose col-0 value exactly matches `key` (trimmed).
// Returns [] when not found so callers can safely do row[colIdx].
function findRow(matrix, key) {
  return matrix.find(row => String(row[0] ?? '').trim() === key) ?? []
}

export default function Aportes() {
  // ── All hooks first ───────────────────────────────────────────────────────
  const { matrix, loading, error } = useSheetData('Presupuestacion copia')
  const [selectedLabel, setSelectedLabel] = useState(null)

  // Month labels from row 0, cols 1..N (handles serial-date numbers and plain text)
  const monthLabels = useMemo(
    () => (matrix[0] ?? []).slice(1).map(monthLabel).filter(Boolean),
    [matrix]
  )

  // Member rows: skip header (row 0), ignored names, and total/footer names
  const memberRows = useMemo(
    () => matrix.slice(1).filter(row => {
      const name = String(row[0] ?? '').trim()
      return name && !IGNORED.has(name) && !TOTAL_KEYS.has(name)
    }),
    [matrix]
  )

  // All footer rows in one memo — looked up by exact col-0 name
  const totals = useMemo(() => ({
    socios: findRow(matrix, 'SOCIOS'),
    total:  findRow(matrix, 'TOTAL'),
    incump: findRow(matrix, 'Incumplidores'),
    evFis:  findRow(matrix, 'Evasion fiscal'),
    evPct:  findRow(matrix, 'Evasion fiscal%'),
    estr:   findRow(matrix, 'Estructura'),
    c5:     findRow(matrix, 'C5'),
    c3:     findRow(matrix, 'C3'),
  }), [matrix])

  // Selected month → column index (colIdx = -1 when no month available)
  const currentLabel = selectedLabel ?? monthLabels[monthLabels.length - 1] ?? null
  const monthIdx     = currentLabel ? monthLabels.indexOf(currentLabel) : monthLabels.length - 1
  const colIdx       = monthIdx >= 0 ? monthIdx + 1 : -1

  // Sort members descending by memes for the selected month
  const sorted = useMemo(
    () => [...memberRows].sort((a, b) => (num(b[colIdx]) ?? 0) - (num(a[colIdx]) ?? 0)),
    [memberRows, colIdx]
  )

  // ── Early returns after all hooks ────────────────────────────────────────
  if (loading) return <div className="container"><Loading /></div>
  if (error)   return <div className="container"><div className="state-box" style={{ color: 'var(--red)' }}>Error: {error}</div></div>

  // ── Derived values (not hooks) ────────────────────────────────────────────
  const maxCant   = num(sorted[0]?.[colIdx]) ?? 1
  const totSocios = num(totals.socios[colIdx])   // societary memes total (base for % calculation)
  const totTotal  = num(totals.total[colIdx])
  const totIncump = num(totals.incump[colIdx])
  const totEvFis  = num(totals.evFis[colIdx])
  const totEvPct  = num(totals.evPct[colIdx])
  const totEstr   = totals.estr[colIdx]
  const totC5     = num(totals.c5[colIdx])
  const totC3     = num(totals.c3[colIdx])
  // Average contribution: total memes ÷ active member count
  const aporteSoc = totTotal != null && memberRows.length > 0
    ? Math.round(totTotal / memberRows.length)
    : null

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
          value={currentLabel ?? ''}
          onChange={e => setSelectedLabel(e.target.value)}
        >
          {monthLabels.map(label => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
      </div>

      {/* Metrics */}
      <div className="metric-grid mb-24">
        <div className="metric-card">
          <div className="metric-label">Total ingresado</div>
          <div className="metric-value accent">{totTotal != null ? fmt(totTotal) : '—'}</div>
          <div className="metric-label mt-16">memes</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Aporte societario</div>
          <div className="metric-value">{aporteSoc != null ? fmt(aporteSoc) : '—'}</div>
          <div className="metric-label mt-16">por socio</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Incumplidores</div>
          <div className={`metric-value ${(totIncump ?? 0) > 0 ? 'red' : 'green'}`}>
            {totIncump != null ? fmt(totIncump) : '—'}
          </div>
          <div className="metric-label mt-16">de {memberRows.length} socios</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Evasión fiscal</div>
          <div className={`metric-value ${(totEvFis ?? 0) > 0 ? 'red' : 'green'}`}>
            {totEvFis != null ? fmt(totEvFis) : '—'}
          </div>
          <div className="metric-label mt-16">{fmtPctAuto(totEvPct)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Estr. de mercado</div>
          <div className="metric-value" style={{ fontSize: 15 }}>
            {totEstr != null ? String(totEstr) : '—'}
          </div>
          <div className="metric-label mt-16">C5: {fmtPctAuto(totC5)}</div>
        </div>
      </div>

      {/* Member table */}
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
              const cant = num(row[colIdx]) ?? 0
              // % = memes del socio / SOCIOS base * 100
              const pct  = totSocios != null && totSocios > 0
                ? (cant / totSocios) * 100
                : null

              return (
                <tr key={i}>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{String(row[0])}</td>
                  <td className="mono right">{fmt(cant)}</td>
                  <td className="mono right" style={{ color: 'var(--text-dim)' }}>
                    {pct != null ? fmtPct(pct) : '—'}
                  </td>
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
