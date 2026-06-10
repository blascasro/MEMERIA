import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { useSheetData, num, fmt, fmtPct } from '../hooks/useSheetData'

// ── RESERVAS matrix layout ────────────────────────────────────────────────────
// row 0  = header  → col 0: row-label, col 1+: month names
// row 1  = RESERVAS BRUTAS
// row 2  = Star Wars
// row 3  = PIPS
// row 4  = Cumple admin
// row 5  = RESERVAS NETAS
// row 6  = Instagram
// row 7  = Descargas
// row 8  = Screenshots
// col 0 is the row label in every data row; data starts at col 1.

const R_HDR  = 0
const R_BRUT = 1
const R_NET  = 5
const R_INST = 6
const R_DESC = 7
const R_SS   = 8

// ── Mini-tabla intermensual ────────────────────────────────────────────────────
// header: fila donde col 0 === "#" → col 1 = mes anterior · col 2 = mes actual
// header+1 = RESERVAS BRUTAS · header+2 = RESERVAS NETAS
// header+3 = Instagram · header+4 = Descargas · header+5 = Screenshots

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

// Last column index that has a non-null value in a row (data starts at col 1)
function lastFilledCol(row) {
  for (let j = (row?.length ?? 0) - 1; j >= 1; j--) {
    if (row[j] != null) return j
  }
  return 1
}

export default function Reservas() {
  // ── All hooks FIRST — before any conditional return ───────────────────────
  const { matrix, loading, error } = useSheetData('RESERVAS')

  // barData must be a useMemo at the top level — never after an early return
  const barData = useMemo(() => {
    const labels    = (matrix[R_HDR]  ?? []).slice(1).filter(Boolean).map(String)
    const brutasRow = matrix[R_BRUT] ?? []
    return labels.map((label, i) => ({
      label,
      bruto: num(brutasRow[i + 1])              ?? 0,
      neto:  num((matrix[R_NET] ?? [])[i + 1])  ?? 0,
    }))
  }, [matrix])

  // Comparativo intermensual (header = fila con col 0 === "#")
  const compareData = useMemo(() => {
    const compareHeader = matrix.find(row => row[0] === '#')
    const compareStart  = matrix.findIndex(row => row[0] === '#')
    const mesAnterior = compareHeader?.[1] || ''
    const mesActual   = compareHeader?.[2] || ''
    if (compareStart === -1) return { months: [mesAnterior, mesActual], rows: [] }
    const rows = [
      { label: 'RESERVAS BRUTAS', cls: 'compare-row-orange', data: matrix[compareStart + 1] ?? [] },
      { label: 'RESERVAS NETAS',  cls: 'compare-row-green',  data: matrix[compareStart + 2] ?? [] },
      { label: 'Instagram',       cls: '',                   data: matrix[compareStart + 3] ?? [] },
      { label: 'Descargas',       cls: '',                   data: matrix[compareStart + 4] ?? [] },
      { label: 'Screenshots',     cls: '',                   data: matrix[compareStart + 5] ?? [] },
    ]
    return { months: [mesAnterior, mesActual], rows }
  }, [matrix])

  // ── Early returns only after all hooks ────────────────────────────────────
  if (loading) return <div className="container"><div className="state-box"><div className="spinner" /><span>Cargando reservas…</span></div></div>
  if (error)   return <div className="container"><div className="state-box" style={{ color: 'var(--red)' }}>Error: {error}</div></div>

  // ── Derived values (not hooks — computed only when data is ready) ─────────
  const headerRow   = matrix[R_HDR] ?? []
  const monthLabels = headerRow.slice(1).filter(Boolean).map(String)
  const brutasRow   = matrix[R_BRUT] ?? []
  const latestCol   = lastFilledCol(brutasRow)

  const bruto       = num(brutasRow[latestCol])
  const neto        = num((matrix[R_NET]  ?? [])[latestCol])
  const instagram   = num((matrix[R_INST] ?? [])[latestCol])
  const descargas   = num((matrix[R_DESC] ?? [])[latestCol])
  const screenshots = num((matrix[R_SS]   ?? [])[latestCol])

  const totalComp = (instagram ?? 0) + (descargas ?? 0) + (screenshots ?? 0)

  const donutData = [
    { name: 'Instagram',   value: instagram   ?? 0 },
    { name: 'Descargas',   value: descargas   ?? 0 },
    { name: 'Screenshots', value: screenshots ?? 0 },
  ].filter(d => d.value > 0)

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Reservas</h1>
        <p className="page-subtitle">Stock de memes disponibles en la comunidad</p>
      </div>

      {/* Summary metrics */}
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

      <div className="grid-2 mb-24">
        {/* Donut composition */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Composición por tipo</span>
          </div>
          {donutData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData} cx="50%" cy="50%"
                      innerRadius={48} outerRadius={70}
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
          ) : (
            <div className="state-box" style={{ padding: 24 }}>Sin datos</div>
          )}
        </div>

        {/* Comparativo intermensual */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">Comparativo intermensual</span>
          </div>
          <table className="compare-table">
            <thead>
              <tr>
                <th></th>
                <th className="right">{compareData.months[0] || '—'}</th>
                <th className="right">{compareData.months[1] || '—'}</th>
              </tr>
            </thead>
            <tbody>
              {compareData.rows.map(row => (
                <tr key={row.label} className={row.cls}>
                  <td>{row.label}</td>
                  <td className="mono right">{fmt(num(row.data[1]) ?? 0)}</td>
                  <td className="mono right">{fmt(num(row.data[2]) ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
  )
}
