import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Bar, Legend,
} from 'recharts'
import { useSheetData, num, fmt, fmtPct, fmtPctAuto } from '../hooks/useSheetData'

// ── Sheet structures (all col/row indices are 0-based) ─────────────────────────
//
// RESERVAS — row 0: [label, mes1, mes2, …]   (month header)
//            rows 1+: data rows
//
// Stock copia — col 0: metric label, col 1..N: monthly values (non-alternating)
//   row 0  Stock
//   row 1  Superavit/deficit
//   row 2  Interanual
//   row 3  S/D diario
//   row 4  Fin
//   row 5  Dias asegurados
//
// IPG copia — col 0: metric label, col 1..N: monthly values (non-alternating)
//   row 0  TOTAL DE LIKES
//   row 1  PROMEDIO DE TANDA
//   row 2  dias registrados
//   row 3  Maximo
//   row 4  Minimo
//
// APORTES — col 0: nombre socio, cols 1..N alternating memes / %
//   For month n (0-based): memesCol = 2n+1, pctCol = 2n+2
//   Last 9 rows = totals: SOCIOS, TOTAL, Incumplidores, Evasion fiscal,
//                          Evasion fiscal%, IHH, Estructura, C3, C5

const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'var(--text)',
  boxShadow: 'var(--shadow-md)',
}

// Safe getter for APORTES last-N rows (fromEnd is negative, e.g. -1 = last row)
function totRow(matrix, fromEnd) {
  const idx = matrix.length + fromEnd
  return idx >= 0 ? (matrix[idx] ?? []) : []
}

function Loading() {
  return <div className="state-box"><div className="spinner" /><span>Cargando datos…</span></div>
}

export default function Balances() {
  // ── All hooks first ───────────────────────────────────────────────────────
  const [tab, setTab]                   = useState('anual')
  const [selectedLabel, setSelectedLabel] = useState(null)

  const reservas = useSheetData('RESERVAS')
  const stock    = useSheetData('Stock copia')
  const ipg      = useSheetData('IPG copia')
  const aportes  = useSheetData('APORTES')

  // Month labels from RESERVAS row 0, cols 1+
  const monthLabels = useMemo(
    () => (reservas.matrix[0] ?? []).slice(1).map(v => (v != null ? String(v) : null)).filter(Boolean),
    [reservas.matrix]
  )

  const currentLabel = selectedLabel ?? monthLabels[monthLabels.length - 1] ?? null
  const monthIdx     = currentLabel ? monthLabels.indexOf(currentLabel) : monthLabels.length - 1

  // Column selectors
  const colIdx   = monthIdx + 1        // Stock copia & IPG copia (non-alternating)
  const memesCol = 2 * monthIdx + 1    // APORTES memes column for month n

  // Annual chart data
  const stockRow      = stock.matrix[0] ?? []
  const totalLikesRow = ipg.matrix[0]   ?? []
  const promTandaRow  = ipg.matrix[1]   ?? []

  const stockChartData = useMemo(
    () => monthLabels.map((label, i) => ({
      label,
      stock: num(stockRow[i + 1]) ?? 0,
    })),
    [monthLabels, stock.matrix]  // depend on stock.matrix, not the derived stockRow
  )

  const ipgChartData = useMemo(
    () => monthLabels.map((label, i) => ({
      label,
      likes:    num(totalLikesRow[i + 1]) ?? 0,
      promedio: num(promTandaRow[i + 1])  ?? 0,
    })),
    [monthLabels, ipg.matrix]
  )

  const loading = reservas.loading || stock.loading || ipg.loading || aportes.loading
  const error   = reservas.error   || stock.error   || ipg.error   || aportes.error

  // ── Early returns after all hooks ────────────────────────────────────────
  if (loading) return <div className="container"><Loading /></div>
  if (error)   return <div className="container"><div className="state-box" style={{ color: 'var(--red)' }}>Error: {error}</div></div>

  // ── Monthly — Informe Stock ───────────────────────────────────────────────
  const curStock   = num(stockRow[colIdx])
  const prevStock  = num(stockRow[colIdx - 1])
  const diffMes    = curStock != null && prevStock != null ? curStock - prevStock : null
  const interanual = num((stock.matrix[2] ?? [])[colIdx])    // row 2 = Interanual
  const sdDiario   = num((stock.matrix[3] ?? [])[colIdx])    // row 3 = S/D diario
  const diasAseg   = num((stock.matrix[5] ?? [])[colIdx])    // row 5 = Dias asegurados

  // ── Monthly — Informe IPG ─────────────────────────────────────────────────
  const totalLikes = num(totalLikesRow[colIdx])
  const promTanda  = num(promTandaRow[colIdx])
  const maxLikes   = num((ipg.matrix[3] ?? [])[colIdx])      // row 3 = Maximo
  const diasIPG    = num((ipg.matrix[2] ?? [])[colIdx])      // row 2 = dias registrados

  // ── Monthly — Informe Presupuestario (from APORTES, alternating cols) ─────
  const m         = aportes.matrix
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
                  <ComposedChart data={ipgChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={52} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
                    <Bar dataKey="likes" fill="var(--accent)" opacity={0.72} name="Total likes" radius={[2, 2, 0, 0]} />
                    <Line
                      type="monotone" dataKey="promedio" stroke="var(--orange)"
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
            <div className="state-box">No se encontraron meses en RESERVAS fila 0.</div>
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
