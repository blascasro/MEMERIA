import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { useSheetData, findColKey, fmt, fmtPct } from '../hooks/useSheetData'

const COLORS    = ['#7F77DD', '#C47830', '#3DA06A']
const TYPE_KEYS = [
  { patterns: ['instagram', 'insta', 'ig', 'redes'],     label: 'Instagram'   },
  { patterns: ['descarga', 'download', 'dwl'],            label: 'Descargas'   },
  { patterns: ['screenshot', 'captura', 'ss', 'pantalla'], label: 'Screenshots' },
]

const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'var(--text)',
}

function Loading() {
  return (
    <div className="state-box">
      <div className="spinner" />
      <span>Cargando reservas…</span>
    </div>
  )
}

export default function Reservas() {
  const { data, cols, loading, error } = useSheetData('RESERVAS')

  const fechaKey = findColKey(cols, 'fecha', 'date', 'mes', 'periodo', 'month')
  const brutoKey = findColKey(cols, 'bruto', 'gross', 'total')
  const netoKey  = findColKey(cols, 'neto', 'net')

  const typeKeys = useMemo(
    () => TYPE_KEYS.map(t => ({ ...t, key: findColKey(cols, ...t.patterns) })),
    [cols]
  )

  if (loading) return <div className="container"><Loading /></div>
  if (error)   return <div className="container"><div className="state-box" style={{ color: 'var(--red)' }}>Error: {error}</div></div>

  const latest = data[data.length - 1]
  const bruto  = latest && brutoKey ? Number(latest[brutoKey]) || 0 : null
  const neto   = latest && netoKey  ? Number(latest[netoKey])  || 0 : null

  const typeValues = typeKeys.map(t => ({
    ...t,
    value: latest && t.key ? Number(latest[t.key]) || 0 : 0,
  }))
  const totalComp  = typeValues.reduce((s, t) => s + t.value, 0)
  const donutData  = typeValues.filter(t => t.value > 0)

  // Historical bar chart
  const barData = useMemo(() =>
    data
      .filter(r => brutoKey && r[brutoKey] != null)
      .map((r, i) => {
        const raw = r[fechaKey]
        let label = `#${i + 1}`
        if (raw instanceof Date) {
          label = raw.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
        } else if (raw) {
          label = String(raw)
        }
        return {
          label,
          bruto: brutoKey ? Number(r[brutoKey]) || 0 : 0,
          neto:  netoKey  ? Number(r[netoKey])  || 0 : 0,
        }
      }),
    [data, fechaKey, brutoKey, netoKey]
  )

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Reservas</h1>
        <p className="page-subtitle">Stock de memes disponibles en la comunidad</p>
      </div>

      {/* Metrics */}
      <div className="metric-grid mb-24">
        {bruto != null && (
          <div className="metric-card">
            <div className="metric-label">Stock Bruto</div>
            <div className="metric-value accent">{fmt(bruto)}</div>
            <div className="metric-label mt-16">memes totales</div>
          </div>
        )}
        {neto != null && (
          <div className="metric-card">
            <div className="metric-label">Stock Neto</div>
            <div className="metric-value">{fmt(neto)}</div>
            <div className="metric-label mt-16">memes disponibles</div>
          </div>
        )}
        {totalComp > 0 && typeValues.map((t, i) => t.value > 0 && (
          <div className="metric-card" key={t.label}>
            <div className="metric-label">{t.label}</div>
            <div className="metric-value" style={{ color: COLORS[i] }}>{fmt(t.value)}</div>
            <div className="metric-label mt-16">{fmtPct((t.value / totalComp) * 100)}</div>
          </div>
        ))}
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
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={74}
                      dataKey="value"
                      paddingAngle={2}
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
                  <li key={d.label} className="legend-item">
                    <span className="legend-dot" style={{ background: COLORS[i] }} />
                    <span className="legend-label">{d.label}</span>
                    <span className="legend-value">{fmt(d.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Bar chart */}
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
                  {brutoKey && (
                    <Bar dataKey="bruto" fill="var(--accent)" opacity={0.70} name="Bruto" radius={[2, 2, 0, 0]} />
                  )}
                  {netoKey && (
                    <Bar dataKey="neto" fill="var(--green)" opacity={0.70} name="Neto" radius={[2, 2, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
