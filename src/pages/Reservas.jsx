import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { useSheetData, num, fmt, fmtPct } from '../hooks/useSheetData'

// ── RESERVAS matrix row indices ────────────────────────────────────────────────
// row 0  = header  → col 0: label, col 1+: month names
// row 1  = RESERVAS BRUTAS
// row 2  = Star Wars
// row 3  = PIPS
// row 4  = Cumple admin
// row 5  = RESERVAS NETAS
// row 6  = Instagram
// row 7  = Descargas
// row 8  = Screenshots
// Col 0 is always the row label; data starts at col 1.
// Last populated column = latest month.

const R_HDR  = 0
const R_BRUT = 1
const R_NET  = 5
const R_INST = 6
const R_DESC = 7
const R_SS   = 8

const COLORS = ['#7F77DD', '#C47830', '#3DA06A']

const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'var(--text)',
}

function Loading() {
  return <div className="state-box"><div className="spinner" /><span>Cargando reservas…</span></div>
}

// Find the last column index that has a non-null value in a given row
function lastFilledCol(row) {
  for (let j = row.length - 1; j >= 1; j--) {
    if (row[j] != null) return j
  }
  return 1
}

export default function Reservas() {
  const { matrix, loading, error } = useSheetData('RESERVAS')

  if (loading) return <div className="container"><Loading /></div>
  if (error)   return <div className="container"><div className="state-box" style={{ color: 'var(--red)' }}>Error: {error}</div></div>

  // Month labels from header row (row 0), cols 1+
  const headerRow   = matrix[R_HDR] ?? []
  const monthLabels = headerRow.slice(1).map(v => (v != null ? String(v) : null)).filter(Boolean)

  // Latest column = last col with data in the brutas row
  const brutasRow = matrix[R_BRUT] ?? []
  const latestCol = lastFilledCol(brutasRow)

  const bruto     = num(brutasRow[latestCol])
  const neto      = num((matrix[R_NET]  ?? [])[latestCol])
  const instagram = num((matrix[R_INST] ?? [])[latestCol])
  const descargas = num((matrix[R_DESC] ?? [])[latestCol])
  const screenshots = num((matrix[R_SS] ?? [])[latestCol])

  const totalComp = (instagram ?? 0) + (descargas ?? 0) + (screenshots ?? 0)

  const donutData = [
    { name: 'Instagram',   value: instagram   ?? 0 },
    { name: 'Descargas',   value: descargas   ?? 0 },
    { name: 'Screenshots', value: screenshots ?? 0 },
  ].filter(d => d.value > 0)

  // Historical bar: one entry per month
  const barData = useMemo(() =>
    monthLabels.map((label, i) => ({
      label,
      bruto: num(brutasRow[i + 1]) ?? 0,
      neto:  num((matrix[R_NET] ?? [])[i + 1]) ?? 0,
    })),
    [matrix, monthLabels, brutasRow]
  )

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Reservas</h1>
        <p className="page-subtitle">Stock de memes disponibles en la comunidad</p>
      </div>

      {/* Metrics */}
      <div className="metric-grid mb-24">
        <div className="metric-card">
          <div className="metric-label">Stock Bruto</div>
          <div className="metric-value accent">{bruto != null ? fmt(bruto) : '—'}</div>
          <div className="metric-label mt-16">memes totales</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Stock Neto</div>
          <div className="metric-value">{neto != null ? fmt(neto) : '—'}</div>
          <div className="metric-label mt-16">memes disponibles</div>
        </div>
        {totalComp > 0 && (
          <>
            <div className="metric-card">
              <div className="metric-label">Instagram</div>
              <div className="metric-value" style={{ color: COLORS[0] }}>{fmt(instagram ?? 0)}</div>
              <div className="metric-label mt-16">{fmtPct((instagram ?? 0) / totalComp * 100)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Descargas</div>
              <div className="metric-value" style={{ color: COLORS[1] }}>{fmt(descargas ?? 0)}</div>
              <div className="metric-label mt-16">{fmtPct((descargas ?? 0) / totalComp * 100)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Screenshots</div>
              <div className="metric-value" style={{ color: COLORS[2] }}>{fmt(screenshots ?? 0)}</div>
              <div className="metric-label mt-16">{fmtPct((screenshots ?? 0) / totalComp * 100)}</div>
            </div>
          </>
        )}
      </div>

      <div className="grid-2">
        {/* Donut chart */}
        {donutData.length > 0 && (
          <div className="card">
            <div className="section-header">
              <span className="section-title">Composición por tipo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ width: 170, height: 170, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData} cx="50%" cy="50%"
                      innerRadius={52} outerRadius={74}
                      dataKey="value" paddingAngle={2}
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="legend-list" style={{ flex: 1 }}>
                {donutData.map((d, i) => (
                  <li key={d.name} className="legend-item">
                    <span className="legend-dot" style={{ background: COLORS[i] }} />
                    <span className="legend-label">{d.name}</span>
                    <span className="legend-value">{fmt(d.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Historical bar */}
        {barData.length > 0 && (
          <div className="card">
            <div className="section-header">
              <span className="section-title">Evolución histórica</span>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} width={44} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
                  <Bar dataKey="bruto" fill="var(--accent)" opacity={0.70} name="Bruto" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="neto"  fill="var(--green)"  opacity={0.70} name="Neto"  radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
