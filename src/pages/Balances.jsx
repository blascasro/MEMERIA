import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Bar, Legend,
} from 'recharts'
import {
  useSheetData, findColKey, fmt, fmtPct,
  getMonths, filterByMonth,
} from '../hooks/useSheetData'

const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'var(--text)',
  boxShadow: 'var(--shadow-md)',
}

function Loading() {
  return (
    <div className="state-box">
      <div className="spinner" />
      <span>Cargando datos…</span>
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div className="state-box" style={{ color: 'var(--red)' }}>
      Error al cargar: {msg}
    </div>
  )
}

function prevMonthKey(mk) {
  if (!mk) return null
  const [y, m] = mk.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function yearAgoKey(mk) {
  if (!mk) return null
  const [y, m] = mk.split('-').map(Number)
  return `${y - 1}-${String(m).padStart(2, '0')}`
}

function lastValue(rows, key) {
  if (!key || !rows.length) return null
  const v = rows[rows.length - 1][key]
  return v != null ? Number(v) : null
}

export default function Balances() {
  const [tab, setTab] = useState('anual')
  const [selectedMonth, setSelectedMonth] = useState('')

  const stock   = useSheetData('Stock copia')
  const ipg     = useSheetData('IPG copia')
  const aportes = useSheetData('APORTES')

  // ── Column detection ──────────────────────────────
  const stockDateKey  = findColKey(stock.cols,   'fecha', 'date', 'mes', 'periodo', 'año', 'month')
  const stockValueKey = findColKey(stock.cols,   'stock', 'cantidad', 'valor', 'total', 'saldo', 'reserva')

  const ipgDateKey  = findColKey(ipg.cols, 'fecha', 'date', 'mes', 'tanda', 'periodo', 'month')
  const ipgTandaKey = findColKey(ipg.cols, 'tanda', 'n°', 'num', 'nro', 'batch', 'ronda')
  const ipgLikesKey = findColKey(ipg.cols, 'likes', 'like', 'reactions', 'total', 'ipg', 'valor')

  const aporteMesKey  = findColKey(aportes.cols, 'mes', 'fecha', 'month', 'periodo', 'date')
  const aporteNomKey  = findColKey(aportes.cols, 'nombre', 'socio', 'name', 'member', 'usuario')
  const aporteCantKey = findColKey(aportes.cols, 'memes', 'aporte', 'cantidad', 'total', 'cant', 'contribucion')

  const loading = stock.loading || ipg.loading || aportes.loading
  const error   = stock.error   || ipg.error   || aportes.error

  // ── Annual chart data ─────────────────────────────
  const stockChartData = useMemo(() =>
    stock.data
      .filter(r => r[stockDateKey] && r[stockValueKey] != null)
      .map(r => {
        const d = r[stockDateKey] instanceof Date ? r[stockDateKey] : new Date(r[stockDateKey])
        return {
          label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
          date: d,
          stock: Number(r[stockValueKey]) || 0,
        }
      })
      .sort((a, b) => a.date - b.date),
    [stock.data, stockDateKey, stockValueKey]
  )

  const ipgGlobalAvg = useMemo(() => {
    if (!ipg.data.length || !ipgLikesKey) return 0
    const total = ipg.data.reduce((s, r) => s + (Number(r[ipgLikesKey]) || 0), 0)
    return total / ipg.data.length
  }, [ipg.data, ipgLikesKey])

  const ipgChartData = useMemo(() =>
    ipg.data
      .filter(r => ipgLikesKey && r[ipgLikesKey] != null)
      .map((r, i) => {
        const labelKey = ipgTandaKey || ipgDateKey
        let label = labelKey ? r[labelKey] : `T${i + 1}`
        if (label instanceof Date) {
          label = label.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
        }
        return {
          label: String(label ?? `T${i + 1}`),
          likes: Number(r[ipgLikesKey]) || 0,
          promedio: Math.round(ipgGlobalAvg),
        }
      }),
    [ipg.data, ipgLikesKey, ipgTandaKey, ipgDateKey, ipgGlobalAvg]
  )

  // ── Month selector ────────────────────────────────
  const allMonths = useMemo(() => {
    const sm = getMonths(stock.data, stockDateKey)
    return sm.length ? sm : getMonths(aportes.data, aporteMesKey)
  }, [stock.data, stockDateKey, aportes.data, aporteMesKey])

  const currentKey = selectedMonth || (allMonths.length ? allMonths[allMonths.length - 1].key : '')

  // ── Monthly metrics — Stock ───────────────────────
  const curStockRows  = filterByMonth(stock.data, stockDateKey, currentKey)
  const prevStockRows = filterByMonth(stock.data, stockDateKey, prevMonthKey(currentKey))
  const yoyStockRows  = filterByMonth(stock.data, stockDateKey, yearAgoKey(currentKey))

  const currentStock = lastValue(curStockRows,  stockValueKey)
  const prevStock    = lastValue(prevStockRows, stockValueKey)
  const yoyStock     = lastValue(yoyStockRows,  stockValueKey)

  const diffMes  = currentStock != null && prevStock != null ? currentStock - prevStock : null
  const diffAnio = currentStock != null && yoyStock  != null ? currentStock - yoyStock  : null

  const [cy, cm] = currentKey ? currentKey.split('-').map(Number) : [0, 0]
  const daysInMonth = cm ? new Date(cy, cm, 0).getDate() : 30
  const dailyRate   = ipgGlobalAvg > 0 ? ipgGlobalAvg / 30 : null
  const diasAsegurados = currentStock != null && dailyRate
    ? Math.floor(currentStock / dailyRate)
    : null
  const superavit = currentStock != null && dailyRate != null
    ? currentStock - daysInMonth * dailyRate
    : null

  // ── Monthly metrics — IPG ─────────────────────────
  const curIPGRows = ipgDateKey
    ? filterByMonth(ipg.data, ipgDateKey, currentKey)
    : ipg.data

  const totalLikes  = curIPGRows.reduce((s, r) => s + (Number(r[ipgLikesKey]) || 0), 0)
  const avgPorTanda = curIPGRows.length ? totalLikes / curIPGRows.length : 0
  const maxLikes    = curIPGRows.length
    ? Math.max(...curIPGRows.map(r => Number(r[ipgLikesKey]) || 0))
    : 0

  // ── Monthly metrics — Presupuestario ─────────────
  const curAportes   = aporteMesKey ? filterByMonth(aportes.data, aporteMesKey, currentKey) : aportes.data
  const socios       = curAportes.filter(r => aporteNomKey && r[aporteNomKey])
  const numSocios    = socios.length
  const totalAport   = socios.reduce((s, r) => s + (Number(r[aporteCantKey]) || 0), 0)
  const aporteSoc    = numSocios ? Math.round(totalAport / numSocios) : 0
  const incumplidores = socios.filter(r => (Number(r[aporteCantKey]) || 0) === 0).length
  const evadido      = incumplidores * aporteSoc
  const pctEvasion   = numSocios ? (incumplidores / numSocios) * 100 : 0

  const sortedAp = [...socios].sort((a, b) => (Number(b[aporteCantKey]) || 0) - (Number(a[aporteCantKey]) || 0))
  const top5     = sortedAp.slice(0, 5).reduce((s, r) => s + (Number(r[aporteCantKey]) || 0), 0)
  const c5       = totalAport ? (top5 / totalAport) * 100 : 0
  const estructura = c5 >= 60 ? 'Oligopólica' : c5 >= 40 ? 'Concentrada' : 'Competitiva'

  if (loading) return <div className="container"><Loading /></div>
  if (error)   return <div className="container"><ErrorBox msg={error} /></div>

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
            <div className="section-header">
              <span className="section-title">Stock histórico</span>
            </div>
            {stockChartData.length > 0 ? (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stockChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={50} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Line
                      type="monotone"
                      dataKey="stock"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--accent)' }}
                      name="Stock"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="state-box" style={{ padding: '40px 0' }}>Sin datos de stock histórico</div>
            )}
          </div>

          {/* IPG histórico */}
          <div className="card">
            <div className="section-header">
              <span className="section-title">IPG histórico — Likes por tanda</span>
            </div>
            {ipgChartData.length > 0 ? (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ipgChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={50} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
                    <Bar
                      dataKey="likes"
                      fill="var(--accent)"
                      opacity={0.72}
                      name="Likes"
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="promedio"
                      stroke="var(--orange)"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="5 3"
                      name="Promedio"
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
              value={currentKey}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              {allMonths.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="report-grid">
            {/* Informe Stock */}
            <div className="report-card">
              <div className="report-header">Informe Stock</div>
              <div className="report-body">
                <div className="report-row">
                  <span className="report-row-label">Stock actual</span>
                  <span className="report-row-value accent">
                    {currentStock != null ? fmt(currentStock) : '—'}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Diff. vs mes anterior</span>
                  <span className={`report-row-value ${diffMes == null ? '' : diffMes >= 0 ? 'green' : 'red'}`}>
                    {diffMes != null ? `${diffMes >= 0 ? '+' : ''}${fmt(diffMes)}` : '—'}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Diff. interanual</span>
                  <span className={`report-row-value ${diffAnio == null ? '' : diffAnio >= 0 ? 'green' : 'red'}`}>
                    {diffAnio != null ? `${diffAnio >= 0 ? '+' : ''}${fmt(diffAnio)}` : '—'}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Superávit / Déficit diario</span>
                  <span className={`report-row-value ${superavit == null ? '' : superavit >= 0 ? 'green' : 'red'}`}>
                    {superavit != null ? `${superavit >= 0 ? '+' : ''}${fmt(superavit, 0)}` : '—'}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Días asegurados</span>
                  <span className="report-row-value">
                    {diasAsegurados != null ? `${fmt(diasAsegurados)} días` : '—'}
                  </span>
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
                  <span className="report-row-value">{fmt(avgPorTanda, 1)}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Máximo mensual</span>
                  <span className="report-row-value green">{fmt(maxLikes)}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Tandas registradas</span>
                  <span className="report-row-value">{curIPGRows.length}</span>
                </div>
              </div>
            </div>

            {/* Informe Presupuestario */}
            <div className="report-card">
              <div className="report-header">Informe Presupuestario</div>
              <div className="report-body">
                <div className="report-row">
                  <span className="report-row-label">Aporte societario</span>
                  <span className="report-row-value">{fmt(aporteSoc)} memes</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">C5 (concentración top 5)</span>
                  <span className="report-row-value">{fmtPct(c5)}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Estructura de mercado</span>
                  <span className="report-row-value">{estructura}</span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Incumplidores</span>
                  <span className={`report-row-value ${incumplidores > 0 ? 'red' : 'green'}`}>
                    {incumplidores} / {numSocios}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">Evasión fiscal</span>
                  <span className={`report-row-value ${evadido > 0 ? 'red' : 'green'}`}>
                    {fmt(evadido)} memes
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-row-label">% Evasión</span>
                  <span className={`report-row-value ${pctEvasion > 0 ? 'red' : 'green'}`}>
                    {fmtPct(pctEvasion)}
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
