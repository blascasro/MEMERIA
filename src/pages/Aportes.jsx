import { useState, useMemo } from 'react'
import { useSheetData, num, fmt, fmtPct, fmtPctAuto, monthLabel } from '../hooks/useSheetData'

// ── APORTES matrix layout ─────────────────────────────────────────────────────
// row 0           = month header: col 0 = "", odd cols (1,3,5,…) = month labels,
//                  even cols (2,4,6,…) = empty (mirror of alternating memes/% structure)
// rows 1..N-9     = member data: col 0 = nombre, odd cols = memes, even cols = %
//                  For month n (0-based): memesCol = 2n+1, pctCol = 2n+2
// last 9 rows     = totals (position from end):
//   -9  SOCIOS          -6  Evasion fiscal
//   -8  TOTAL           -5  Evasion fiscal%
//   -7  Incumplidores   -4  IHH
//                       -3  Estructura
//                       -2  C3
//                       -1  C5

const N_TOTALS = 9

function Loading() {
  return <div className="state-box"><div className="spinner" /><span>Cargando aportes…</span></div>
}

function safeRow(matrix, fromEnd) {
  const idx = matrix.length + fromEnd
  return idx >= 0 ? (matrix[idx] ?? []) : []
}

export default function Aportes() {
  // ── All hooks first ───────────────────────────────────────────────────────
  const { matrix: aMatrix, loading, error } = useSheetData('APORTES')

  const [selectedLabel, setSelectedLabel] = useState(null)

  // Month labels from APORTES row 0: cols 1, 3, 5, … (odd cols = memes header)
  // monthLabel() handles both plain strings and Excel serial date numbers.
  const monthLabels = useMemo(
    () => (aMatrix[0] ?? [])
      .slice(1)
      .filter((_, i) => i % 2 === 0)   // indices 0,2,4,… of the sliced array = cols 1,3,5,… of the row
      .map(monthLabel)
      .filter(Boolean),
    [aMatrix]
  )

  const currentLabel = selectedLabel ?? monthLabels[monthLabels.length - 1] ?? null
  const monthIdx     = currentLabel ? monthLabels.indexOf(currentLabel) : monthLabels.length - 1

  // APORTES alternating column selectors for month n (0-based)
  const memesCol = 2 * monthIdx + 1    // memes count
  const pctCol   = 2 * monthIdx + 2    // pre-computed % of total

  // Member rows = rows 1..length-N_TOTALS (skip row 0 = month header)
  const memberRows = useMemo(
    () => aMatrix
      .slice(1, Math.max(1, aMatrix.length - N_TOTALS))
      .filter(row => row[0] != null && String(row[0]).trim() !== ''),
    [aMatrix]
  )

  // Sort members for selected month, highest memes first
  const sorted = useMemo(
    () => [...memberRows].sort((a, b) => (num(b[memesCol]) ?? 0) - (num(a[memesCol]) ?? 0)),
    [memberRows, memesCol]
  )

  const maxCant = num(sorted[0]?.[memesCol]) ?? 1

  // Pre-computed totals from sheet (last 9 rows)
  const totTotal  = num(safeRow(aMatrix, -8)[memesCol])   // TOTAL memes
  const totSocios = num(safeRow(aMatrix, -9)[memesCol])   // SOCIOS count
  const totIncump = num(safeRow(aMatrix, -7)[memesCol])   // Incumplidores
  const totEvFis  = num(safeRow(aMatrix, -6)[memesCol])   // Evasion fiscal (memes)
  const totEvPct  = num(safeRow(aMatrix, -5)[memesCol])   // Evasion fiscal%
  const totEstr   =     safeRow(aMatrix, -3)[memesCol]    // Estructura (string)
  const totC5     = num(safeRow(aMatrix, -1)[memesCol])   // C5
  const aporteSoc = totSocios && totTotal ? Math.round(totTotal / totSocios) : null

  // ── Early returns after all hooks ────────────────────────────────────────
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
          <div className="metric-label mt-16">de {totSocios != null ? fmt(totSocios) : '?'} socios</div>
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
              const cant   = num(row[memesCol]) ?? 0
              // Use pre-computed % from sheet if available, otherwise derive from total
              const pctRaw = num(row[pctCol])
              const pct    = pctRaw != null
                ? (Math.abs(pctRaw) <= 1 ? pctRaw * 100 : pctRaw)
                : (totTotal ? (cant / totTotal) * 100 : 0)

              return (
                <tr key={i}>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{String(row[0])}</td>
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
