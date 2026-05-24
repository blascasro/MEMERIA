import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Bar, Legend,
} from 'recharts'
import { useSheetData, num, fmt, fmtPct, fmtPctAuto, monthLabel } from '../hooks/useSheetData'

// ── Sheet structures (all col/row indices are 0-based) ─────────────────────────
//
// Stock copia — row 0: [label, mes1, mes2, …]   (month header, non-alternating)
//   row 1  Stock          row 4  S/D diario
//   row 2  Superavit      row 5  Fin
//   row 3  Interanual     row 6  Dias asegurados
//   col 0 = row label; data at col 1..N; colIdx = monthIdx + 1
//
// IPG copia — row 0: [label, mes1, mes2, …]   (month header, non-alternating)
//   row 1  TOTAL DE LIKES     row 4  Maximo
//   row 2  PROMEDIO DE TANDA  row 5  Minimo
//   row 3  dias registrados
//   col 0 = row label; data at col 1..N; colIdx = monthIdx + 1
//
// Presupuestacion copia — alternating memes/% columns
//   row 0: month labels at odd cols (1, 3, 5, …)
//   Last 9 rows = totals (from end):
//     -9 SOCIOS  -8 TOTAL  -7 Incumplidores  -6 Evasion fiscal
//     -5 Evasion%  -4 IHH  -3 Estructura  -2 C3  -1 C5
//   memesCol = 2*monthIdx + 1

const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'var(--text)',
  boxShadow: 'var(--shadow-md)',
}

// Safe getter for last-N rows (fromEnd is negative, e.g. -1 = last row)
function totRow(matrix, fromEnd) {
  const idx = matrix.length + fromEnd
  return idx >= 0 ? (matrix[idx] ?? []) : []
}

function Loading() {
  return <div className="state-box"><div className="spinner" /><span>Cargando datos…</span></div>
}

export default function Balances() {
  // ── All hooks first ───────────────────────────────────────────────────────
  const [tab, setTab]                    = useState('anual')
  const [selectedLabel, setSelectedLabel] = useState(null)

  const stock  = useSheetData('Stock copia')
  const ipg    = useSheetData('IPG copia')
  const presup = useSheetData('Presupuestacion copia')

  // Month labels from Stock copia row 0, cols 1+
  // monthLabel() handles both plain strings and Excel serial date numbers.
  const monthLabels = useMemo(
    () => (stock.matrix[0] ?? []).slice(1).map(monthLabel).filter(Boolean),
    [stock.matrix]
  )

  const currentLabel = selectedLabel ?? monthLabels[monthLabels.length - 1] ?? null
  const monthIdx     = currentLabel ? monthLabels.indexOf(currentLabel) : monthLabels.length - 1

  // Column selectors
  const colIdx   = monthIdx + 1         // Stock copia & IPG copia (non-alternating; row 0 is header)
  const memesCol = 2 * monthIdx + 1     // Presupuestacion copia (alternating)

  // Annual chart data — data rows start at index 1 (row 0 is the month header)
  const stockChartData = useMemo(
    () => monthLabels.map((label, i) => ({
      label,
      stock: num((stock.matrix[1] ?? [])[i + 1]) ?? 0,
    })),
    [monthLabels, stock.matrix]
  )

  const ipgChartData = useMemo(
    () => monthLabels.map((label, i) => ({
      label,
      likes:    num((ipg.matrix[1] ?? [])[i + 1]) ?? 0,
      promedio: num((ipg.matrix[2] ?? [])[i + 1]) ?? 0,
    })),
    [monthLabels, ipg.matrix]
  )

  const loading = stock.loading || ipg.loading || presup.loading
  const error   = stock.error   || ipg.error   || presup.error

  // ── Early returns after all hooks ────────────────────────────────────────
  if (loading) return <div className="container"><Loading /></div>
  if (error)   return <div className="container"><div className="state-box" style={{ color: 'var(--red)' }}>Error: {error}</div></div>

  // ── Monthly — Informe Stock ───────────────────────────────────────────────
  const stockRow   = stock.matrix[1] ?? []                         // row 1 = Stock values
  const curStock   = num(stockRow[colIdx])
  const prevStock  = num(stockRow[colIdx - 1])
  const diffMes    = curStock != null && prevStock != null ? curStock - prevStock : null
  const interanual = num((stock.matrix[3] ?? [])[colIdx])           // row 3 = Interanual
  const sdDiario   = num((stock.matrix[4] ?? [])[colIdx])           // row 4 = S/D diario
  const diasAseg   = num((stock.matrix[6] ?? [])[colIdx])           // row 6 = Dias asegurados

  // ── Monthly — Informe IPG ─────────────────────────────────────────────────
  const totalLikes = num((ipg.matrix[1] ?? [])[colIdx])             // row 1 = TOTAL DE LIKES
  const promTanda  = num((ipg.matrix[2] ?? [])[colIdx])             // row 2 = PROMEDIO DE TANDA
  const maxLikes   = num((ipg.matrix[4] ?? [])[colIdx])             // row 4 = Maximo
  const diasIPG    = num((ipg.matrix[3] ?? [])[colIdx])             // row 3 = dias registrados

  // ── Monthly — Informe Presupuestario (from Presupuestacion copia) ─────────
  const m         = presup.matrix
  const totSocios = num(totRow(m, -9)[memesCol])   // SOCIOS
  const totTotal  = num(totRow(m, -8)[memesCol])   // TOTAL memes
  const totIncump = num(totRow(m, -7)[memesCol])   // Incumplidores
  const totEvFis  = num(totRow(m, -6)[memesCol])   // Evasion fiscal (memes)
  const totEvPct  = num(totRow(m, -5)[memesCol])   // Evasion fiscal%
  const totEstr   =     totRow(m, -3)[memesCol]    // Estructura (string)
  const totC3     = num(totRow(m, -2)[memesCol])   // C3
  const totC5     = num(totRow(m, -1)[memesCol])   // C5
  const aporteSoc = totSocios && totTotal ? Math.round(totTotal / totSocios) : null

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Balances</h1>
        <p className="page-subtitle">Seguimiento financiero de la comunidad</p>
      </div>

      <div className="tabs">
        <button className={`tab-btn${tab === 'anual'   ? ' active' : ''}`} onClick={() => setTab('anual')}>
          Vista anual
        </button>
        <button className={`tab-btn${tab === 'mensual' ? ' active' : ''}`} onClick={() => setTab('mensual')}>
          Vista mensual
        </button>
      </div>

      {/* ── ANNUAL VIEW ──────────────────────────────────────────────────── */}
      {tab === 'anual' && (
        <div>
          <div className="card mb-24">
            <div className="section-header"><span className="section-title">Stock histórico</span></div>
            {stockChartData.some(d => d.stock > 0) ? (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stockChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={52} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Line
                      type="monotone" dataKey="stock" stroke="var(--accent)"
                      strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Stock"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="state-box" style={{ padding: '40px 0' }}>Sin datos de stock</div>
            )}
          </div>

          <div className="card">
            <div className="section-header"><span className="section-title">IPG histórico — Likes por mes</span></div>
            {ipgChartData.some(d => d.likes > 0) ? (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ipgChartData} margin={{ top: 4, right: 52, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis yAxisId="left"  orientation="left"  tick={{ fontSize: 11, fill: 'var(--muted)' }} width={52} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted)' }} width={44} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
                    <Bar    yAxisId="left"  dataKey="likes"    fill="var(--accent)" opacity={0.72} name="Total likes" radius={[2, 2, 0, 0]} />
                    <Line   yAxisId="right" dataKey="promedio" type="monotone" stroke="var(--orange)"
                      strokeWidth={2} dot={false} strokeDasharray="5 3" name="Prom. tanda"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="state-box" style={{ padding: '40px 0' }}>Sin datos de IPG</div>
            )}
          </div>
        </div>
      )}

      {/* ── MONTHLY VIEW ─────────────────────────────────────────────────── */}
      {tab === 'mensual' && (
        <div>
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

          {monthLabels.length === 0 && (
            <div className="state-box">No se encontraron meses en Stock copia fila 0.</div>
          )}

          <div className="report-grid">
            {/* Informe Stock */}
            <div className="report-card">
              <div className="report-header">Informe Stock</div>
              <div className="report-body">
                <div className="report-row">
                  <span className="report-row-label">Stock actual</span>
                  <span className="report-row-value accent">{curStock != null ? fmt(curStock) : '—'}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Diff. vs mes anterior</span>
                  <span className={`report-row-value ${diffMes == null ? '' : diffMes >= 0 ? 'green' : 'red'}`}>
                    {diffMes != null ? `${diffMes >= 0 ? '+' : ''}${fmt(diffMes)}` : '—'}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Diff. interanual</span>
                  <span className={`report-row-value ${interanual == null ? '' : interanual >= 0 ? 'green' : 'red'}`}>
                    {interanual != null ? `${interanual >= 0 ? '+' : ''}${fmt(interanual)}` : '—'}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">S/D diario</span>
                  <span className={`report-row-value ${sdDiario == null ? '' : sdDiario >= 0 ? 'green' : 'red'}`}>
                    {sdDiario != null ? `${sdDiario >= 0 ? '+' : ''}${fmt(sdDiario, 1)}` : '—'}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Días asegurados</span>
                  <span className="report-row-value">{diasAseg != null ? `${fmt(diasAseg)} días` : '—'}</span>
                </div>
              </div>
            </div>

            {/* Informe IPG */}
            <div className="report-card">
              <div className="report-header">Informe IPG</div>
              <div className="report-body">
                <div className="report-row">
                  <span className="report-row-label">Total likes</span>
                  <span className="report-row-value accent">{fmt(totalLikes)}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Promedio por tanda</span>
                  <span className="report-row-value">{fmt(promTanda, 1)}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Máximo mensual</span>
                  <span className="report-row-value green">{fmt(maxLikes)}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Días registrados</span>
                  <span className="report-row-value">{diasIPG != null ? fmt(diasIPG) : '—'}</span>
                </div>
              </div>
            </div>

            {/* Informe Presupuestario */}
            <div className="report-card">
              <div className="report-header">Informe Presupuestario</div>
              <div className="report-body">
                <div className="report-row">
                  <span className="report-row-label">Aporte societario</span>
                  <span className="report-row-value">{aporteSoc != null ? `${fmt(aporteSoc)} memes` : '—'}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">C5</span>
                  <span className="report-row-value">{fmtPctAuto(totC5)}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">C3</span>
                  <span className="report-row-value">{fmtPctAuto(totC3)}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Estructura de mercado</span>
                  <span className="report-row-value">{totEstr != null ? String(totEstr) : '—'}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Incumplidores</span>
                  <span className={`report-row-value ${(totIncump ?? 0) > 0 ? 'red' : 'green'}`}>
                    {totIncump != null ? fmt(totIncump) : '—'}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Evasión fiscal</span>
                  <span className={`report-row-value ${(totEvFis ?? 0) > 0 ? 'red' : 'green'}`}>
                    {totEvFis != null ? `${fmt(totEvFis)} memes` : '—'}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">% Evasión</span>
                  <span className={`report-row-value ${(totEvPct ?? 0) > 0 ? 'red' : 'green'}`}>
                    {fmtPctAuto(totEvPct)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
