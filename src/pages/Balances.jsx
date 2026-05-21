import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Bar, Legend,
} from 'recharts'
import { useSheetData, num, fmt, fmtPct, fmtPctAuto } from '../hooks/useSheetData'

// ── Sheet row indices ──────────────────────────────────────────────────────────
//
// RESERVAS  — row 0 is the header: col 0 = label, col 1+ = month names
// Stock copia rows (col 0 = label, col 1+ = monthly values):
//   0 Stock | 1 Superavit/deficit | 2 Interanual | 3 S/D diario | 4 Fin | 5 Dias asegurados
// IPG copia rows (col 0 = label, col 1+ = monthly values):
//   0 TOTAL DE LIKES | 1 PROMEDIO DE TANDA | 2 dias registrados | 3 Maximo | 4 Minimo
// APORTES — col 0 = name, col 1+ = memes by month
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

function Loading() {
  return <div className="state-box"><div className="spinner" /><span>Cargando datos…</span></div>
}

// Safe getter for APORTES last-N rows
function totalsRow(matrix, fromEnd) {
  const idx = matrix.length + fromEnd   // fromEnd is negative
  return idx >= 0 ? (matrix[idx] ?? []) : []
}

export default function Balances() {
  const [tab, setTab] = useState('anual')
  const [selectedLabel, setSelectedLabel] = useState(null)

  const reservas = useSheetData('RESERVAS')
  const stock    = useSheetData('Stock copia')
  const ipg      = useSheetData('IPG copia')
  const aportes  = useSheetData('APORTES')

  const loading = reservas.loading || stock.loading || ipg.loading || aportes.loading
  const error   = reservas.error   || stock.error   || ipg.error   || aportes.error

  // ── Month labels from RESERVAS row 0, cols 1+ ─────────────────────────────
  const monthLabels = useMemo(
    () => (reservas.matrix[0] ?? []).slice(1).map(v => (v != null ? String(v) : null)).filter(Boolean),
    [reservas.matrix]
  )

  const currentLabel = selectedLabel ?? monthLabels[monthLabels.length - 1] ?? null
  const monthIdx     = currentLabel ? monthLabels.indexOf(currentLabel) : monthLabels.length - 1
  // col index in every sheet: +1 because col 0 is the row-label column
  const colIdx = monthIdx + 1

  // ── Annual chart data ──────────────────────────────────────────────────────
  const stockRow      = stock.matrix[0] ?? []   // row 0 = Stock
  const totalLikesRow = ipg.matrix[0]   ?? []   // row 0 = TOTAL DE LIKES
  const promTandaRow  = ipg.matrix[1]   ?? []   // row 1 = PROMEDIO DE TANDA

  const stockChartData = useMemo(
    () => monthLabels.map((label, i) => ({ label, stock: num(stockRow[i + 1]) ?? 0 })),
    [monthLabels, stockRow]
  )

  const ipgChartData = useMemo(
    () => monthLabels.map((label, i) => ({
      label,
      likes:    num(totalLikesRow[i + 1]) ?? 0,
      promedio: num(promTandaRow[i + 1])  ?? 0,
    })),
    [monthLabels, totalLikesRow, promTandaRow]
  )

  // ── Monthly — Informe Stock ────────────────────────────────────────────────
  const curStock  = num(stockRow[colIdx])
  const prevStock = num(stockRow[colIdx - 1])
  const diffMes   = curStock != null && prevStock != null ? curStock - prevStock : null
  const interanual = num((stock.matrix[2] ?? [])[colIdx])   // row 2 = Interanual
  const sdDiario   = num((stock.matrix[3] ?? [])[colIdx])   // row 3 = S/D diario
  const diasAseg   = num((stock.matrix[5] ?? [])[colIdx])   // row 5 = Dias asegurados

  // ── Monthly — Informe IPG ──────────────────────────────────────────────────
  const totalLikes = num(totalLikesRow[colIdx])
  const promTanda  = num(promTandaRow[colIdx])
  const maxLikes   = num((ipg.matrix[3] ?? [])[colIdx])     // row 3 = Maximo
  const diasIPG    = num((ipg.matrix[2] ?? [])[colIdx])     // row 2 = dias registrados

  // ── Monthly — Informe Presupuestario ──────────────────────────────────────
  // Last 9 rows of APORTES (by position from end, negative index notation)
  const m         = aportes.matrix
  const totSocios = num(totalsRow(m, -9)[colIdx])   // SOCIOS
  const totTotal  = num(totalsRow(m, -8)[colIdx])   // TOTAL
  const totIncump = num(totalsRow(m, -7)[colIdx])   // Incumplidores
  const totEvFis  = num(totalsRow(m, -6)[colIdx])   // Evasion fiscal (memes)
  const totEvPct  = num(totalsRow(m, -5)[colIdx])   // Evasion fiscal%
  const totEstr   = totalsRow(m, -3)[colIdx]         // Estructura (string)
  const totC3     = num(totalsRow(m, -2)[colIdx])   // C3
  const totC5     = num(totalsRow(m, -1)[colIdx])   // C5
  const aporteSoc = totSocios && totTotal ? Math.round(totTotal / totSocios) : null

  if (loading) return <div className="container"><Loading /></div>
  if (error)   return <div className="container"><div className="state-box" style={{ color: 'var(--red)' }}>Error: {error}</div></div>

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

      {tab === 'anual' && (
        <div>
          {/* Stock histórico */}
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

          {/* IPG histórico */}
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
            <div className="state-box">No se encontraron meses en la hoja RESERVAS.</div>
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
                  <span className="report-row-value">{totC5 != null ? fmtPctAuto(totC5) : '—'}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">C3</span>
                  <span className="report-row-value">{totC3 != null ? fmtPctAuto(totC3) : '—'}</span>
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
