import { useState, useMemo } from 'react'
import { useSheetData, num, fmt, fmtPct, fmtPctAuto, monthLabel } from '../hooks/useSheetData'

// ── "Presupuestacion copia" layout ────────────────────────────────────────────
// row 0:     col 0 = "" · cols 1..N = month labels (one column per month)
// rows 1..M: member rows — col 0 = name · cols 1..N = memes for that month
// footer rows identified by col 0 value (exact string):
//   SOCIOS · TOTAL · Aporte ideal · Incumplidores · Evasion fiscal
//   Evasion fiscal% · IHH · Estructura · C5 · C3
//
// Member row filter — exclude if col 0:
//   • contains "(baneado)"
//   • exactly matches any name in NON_MEMBER_NAMES

const NON_MEMBER_NAMES = new Set([
  'A termino', 'Incompletos', 'SOCIOS', 'TOTAL', 'Aporte ideal',
  'Incumplidores', 'Evasion fiscal', 'Evasion fiscal%', 'IHH', 'Estructura',
  'C5', 'C3',
])

function isMember(row) {
  const name = String(row[0] ?? '').trim()
  return name && !name.includes('(baneado)') && !NON_MEMBER_NAMES.has(name)
}

function Loading() {
  return <div className="state-box"><div className="spinner" /><span>Cargando aportes…</span></div>
}

// Find the first row whose col-0 value exactly matches `key` (trimmed).
// Returns [] when not found so callers can safely index into it.
function findRow(matrix, key) {
  return matrix.find(row => String(row[0] ?? '').trim() === key) ?? []
}

export default function Aportes() {
  // ── All hooks first ───────────────────────────────────────────────────────
  const { matrix, loading, error } = useSheetData('Presupuestacion copia')
  const [selectedLabel, setSelectedLabel] = useState(null)

  // Month labels from row 0, cols 1..N
  const monthLabels = useMemo(
    () => (matrix[0] ?? []).slice(1).map(monthLabel).filter(Boolean),
    [matrix]
  )

  // Valid member rows only
  const memberRows = useMemo(
    () => matrix.slice(1).filter(isMember),
    [matrix]
  )

  // All footer/total rows indexed by name — one memo for all lookups
  const totals = useMemo(() => ({
    socios:     findRow(matrix, 'SOCIOS'),
    total:      findRow(matrix, 'TOTAL'),
    aporteIdeal:findRow(matrix, 'Aporte ideal'),
    incump:     findRow(matrix, 'Incumplidores'),
    evFis:      findRow(matrix, 'Evasion fiscal'),
    evPct:      findRow(matrix, 'Evasion fiscal%'),
    estr:       findRow(matrix, 'Estructura'),
    c5:         findRow(matrix, 'C5'),
    c3:         findRow(matrix, 'C3'),
  }), [matrix])

  // Selected month → column index
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

  // ── Derived values ────────────────────────────────────────────────────────
  const totSocios      = num(totals.socios[colIdx])
  const totTotal       = num(totals.total[colIdx])
  const aporteNecesario= num(totals.aporteIdeal[colIdx])   // "Aporte ideal" row
  const totIncump      = num(totals.incump[colIdx])
  const totEvFis       = num(totals.evFis[colIdx])
  const totEvPct       = num(totals.evPct[colIdx])
  const totEstr        = totals.estr[colIdx]               // text value
  const totC5          = num(totals.c5[colIdx])

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
          <div className="metric-label">Aporte necesario</div>
          <div className="metric-value">{aporteNecesario != null ? fmt(aporteNecesario) : '—'}</div>
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
          <div className="metric-label">Estr. de aportes</div>
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
              <th className="right">Faltante</th>
              <th className="right">%</th>
              <th style={{ minWidth: 130 }}>Participación</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                  Sin datos para este mes
                </td>
              </tr>
            )}
            {sorted.map((row, i) => {
              const cant     = num(row[colIdx]) ?? 0
              // % real sobre el total del mes (base = SOCIOS row)
              const pct      = totSocios != null && totSocios > 0
                ? (cant / totSocios) * 100
                : null
              // Faltante = max(0, aporte necesario - memes aportados)
              const faltante = aporteNecesario != null
                ? Math.max(0, aporteNecesario - cant)
                : null

              // Row colour: red = 0 memes · yellow = faltante > 0 · none = OK
              const trClass = cant === 0
                ? 'row-red'
                : (faltante != null && faltante > 0 ? 'row-yellow' : '')

              return (
                <tr key={i} className={trClass}>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{String(row[0])}</td>
                  <td className="mono right">{fmt(cant)}</td>
                  <td className="mono right" style={{
                    color: faltante != null && faltante > 0 ? 'var(--yellow)' : 'var(--muted)',
                  }}>
                    {faltante != null ? fmt(faltante) : '—'}
                  </td>
                  <td className="mono right" style={{ color: 'var(--text-dim)' }}>
                    {pct != null ? fmtPct(pct) : '—'}
                  </td>
                  <td>
                    {/* Bar width = actual % of monthly total (not relative to max) */}
                    <div className="bar-wrap">
                      <div
                        className="bar-fill"
                        style={{ width: pct != null ? `${Math.min(pct, 100)}%` : '0%' }}
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
