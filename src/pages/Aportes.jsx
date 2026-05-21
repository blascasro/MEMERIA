import { useState, useMemo } from 'react'
import { useSheetData, num, fmt, fmtPct, fmtPctAuto } from '../hooks/useSheetData'

// ── APORTES matrix layout ─────────────────────────────────────────────────────
// col 0        = nombre socio
// col 1..n     = memes aportados por mes
// last 9 rows  = totales (SOCIOS, TOTAL, Incumplidores, Evasion fiscal,
//                Evasion fiscal%, IHH, Estructura, C3, C5)
//
// RESERVAS row 0 (col 1+) = month labels (shared time axis)

const N_TOTALS = 9  // number of totals rows at the end

function Loading() {
  return <div className="state-box"><div className="spinner" /><span>Cargando aportes…</span></div>
}

function safeRow(matrix, fromEnd) {
  const idx = matrix.length + fromEnd
  return idx >= 0 ? (matrix[idx] ?? []) : []
}

export default function Aportes() {
  const { matrix: aMatrix, loading: aLoading, error: aError } = useSheetData('APORTES')
  const { matrix: rMatrix, loading: rLoading, error: rError } = useSheetData('RESERVAS')

  const [selectedLabel, setSelectedLabel] = useState(null)

  const loading = aLoading || rLoading
  const error   = aError   || rError

  // Month labels from RESERVAS row 0 (col 1+)
  const monthLabels = useMemo(
    () => (rMatrix[0] ?? []).slice(1).map(v => (v != null ? String(v) : null)).filter(Boolean),
    [rMatrix]
  )

  const currentLabel = selectedLabel ?? monthLabels[monthLabels.length - 1] ?? null
  const monthIdx     = currentLabel ? monthLabels.indexOf(currentLabel) : monthLabels.length - 1
  const colIdx       = monthIdx + 1   // +1 because col 0 is the name column

  // Member rows = all except last N_TOTALS
  const memberRows = useMemo(
    () => aMatrix.slice(0, Math.max(0, aMatrix.length - N_TOTALS))
      .filter(row => row[0] != null && String(row[0]).trim() !== ''),
    [aMatrix]
  )

  // Sort members for selected month, descending
  const sorted = useMemo(
    () => [...memberRows].sort((a, b) => (num(b[colIdx]) ?? 0) - (num(a[colIdx]) ?? 0)),
    [memberRows, colIdx]
  )

  const maxCant = num(sorted[0]?.[colIdx]) ?? 1

  // Pre-computed totals from sheet (last 9 rows, by position from end)
  const totTotal   = num(safeRow(aMatrix, -8)[colIdx])   // TOTAL
  const totSocios  = num(safeRow(aMatrix, -9)[colIdx])   // SOCIOS
  const totIncump  = num(safeRow(aMatrix, -7)[colIdx])   // Incumplidores
  const totEvFis   = num(safeRow(aMatrix, -6)[colIdx])   // Evasion fiscal (memes)
  const totEvPct   = num(safeRow(aMatrix, -5)[colIdx])   // Evasion fiscal%
  const totEstr    = safeRow(aMatrix, -3)[colIdx]         // Estructura (string)
  const totC3      = num(safeRow(aMatrix, -2)[colIdx])   // C3
  const totC5      = num(safeRow(aMatrix, -1)[colIdx])   // C5
  const aporteSoc  = totSocios && totTotal ? Math.round(totTotal / totSocios) : null

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
          <div className="metric-label mt-16">C5: {totC5 != null ? fmtPctAuto(totC5) : '—'}</div>
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
              const pct  = totTotal ? (cant / totTotal) * 100 : 0
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
