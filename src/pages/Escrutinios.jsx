import { useMemo } from 'react'
import { useSheetData, findColKey, fmt, fmtPct, median } from '../hooks/useSheetData'

function Loading() {
  return (
    <div className="state-box">
      <div className="spinner" />
      <span>Cargando escrutinios…</span>
    </div>
  )
}

export default function Escrutinios() {
  const { data, cols, loading, error } = useSheetData('ESCRUTINIOS')

  const socioKey = findColKey(cols, 'socio', 'nombre', 'name', 'member', 'usuario')
  const stockKey = findColKey(cols, 'stock', 'reserva', 'memes')
  const likesKey = findColKey(cols, 'likes', 'like', 'reactions', 'ipg', 'valor')

  const rows = useMemo(
    () =>
      data
        .filter(r => socioKey && r[socioKey])
        .map(r => ({
          socio: r[socioKey],
          stock: stockKey != null ? Number(r[stockKey]) || 0 : null,
          likes: likesKey != null ? Number(r[likesKey]) || 0 : null,
        })),
    [data, socioKey, stockKey, likesKey]
  )

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0)),
    [rows]
  )

  const stockValues  = rows.map(r => r.stock).filter(v => v != null)
  const likesValues  = rows.map(r => r.likes).filter(v => v != null)

  const medianStock  = median(stockValues)
  const medianLikes  = median(likesValues)
  const avgStock     = stockValues.length ? stockValues.reduce((s, v) => s + v, 0) / stockValues.length : 0
  const avgLikes     = likesValues.length ? likesValues.reduce((s, v) => s + v, 0) / likesValues.length : 0

  function classify(r) {
    const hiStock = r.stock != null && r.stock > medianStock * 2
    const loStock = r.stock != null && r.stock < medianStock * 0.4 && r.stock < medianStock
    const hiLikes = r.likes != null && r.likes > medianLikes * 2
    const loLikes = r.likes != null && r.likes < medianLikes * 0.4 && r.likes < medianLikes
    if (hiStock || hiLikes) return 'high'
    if (loStock || loLikes) return 'low'
    return 'normal'
  }

  if (loading) return <div className="container"><Loading /></div>
  if (error)   return <div className="container"><div className="state-box" style={{ color: 'var(--red)' }}>Error: {error}</div></div>

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Escrutinios</h1>
        <p className="page-subtitle">Declaraciones de stock y likes de los socios</p>
      </div>

      {/* Metrics */}
      <div className="metric-grid mb-24">
        <div className="metric-card">
          <div className="metric-label">Mediana stock</div>
          <div className="metric-value accent">{fmt(medianStock)}</div>
          <div className="metric-label mt-16">métrica central</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Mediana likes</div>
          <div className="metric-value accent">{fmt(medianLikes)}</div>
          <div className="metric-label mt-16">métrica central</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Promedio stock</div>
          <div className="metric-value">{fmt(avgStock, 0)}</div>
          <div className="metric-label mt-16">incluye outliers</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Promedio likes</div>
          <div className="metric-value">{fmt(avgLikes, 0)}</div>
          <div className="metric-label mt-16">incluye outliers</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Socios relevados</div>
          <div className="metric-value">{rows.length}</div>
          <div className="metric-label mt-16">declaraciones</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
          <span className="badge badge-red">Outlier alto</span>
          <span>Declara más del doble de la mediana</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
          <span className="badge badge-orange">Outlier bajo</span>
          <span>Declara menos del 40% de la mediana</span>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              <th>Socio</th>
              {stockKey && <th className="right">Stock declarado</th>}
              {stockKey && <th className="right">% vs mediana</th>}
              {likesKey && <th className="right">Likes declarados</th>}
              {likesKey && <th className="right">% vs mediana</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                  Sin datos disponibles
                </td>
              </tr>
            )}
            {sorted.map((r, i) => {
              const cls       = classify(r)
              const trClass   = cls === 'high' ? 'row-red' : cls === 'low' ? 'row-orange' : ''
              const stockRatio = medianStock > 0 && r.stock != null ? (r.stock / medianStock) * 100 : null
              const likesRatio = medianLikes > 0 && r.likes != null ? (r.likes / medianLikes) * 100 : null

              const stockHi = r.stock != null && r.stock > medianStock * 2
              const stockLo = r.stock != null && r.stock < medianStock * 0.4 && r.stock < medianStock
              const likesHi = r.likes != null && r.likes > medianLikes * 2
              const likesLo = r.likes != null && r.likes < medianLikes * 0.4 && r.likes < medianLikes

              return (
                <tr key={i} className={trClass}>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{r.socio}</td>
                  {stockKey && (
                    <td className="mono right">{r.stock != null ? fmt(r.stock) : '—'}</td>
                  )}
                  {stockKey && (
                    <td className="right">
                      {stockRatio != null && (
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: 'var(--mono)',
                            fontWeight: 600,
                            color: stockHi ? 'var(--red)' : stockLo ? 'var(--orange)' : 'var(--muted)',
                          }}
                        >
                          {Math.round(stockRatio)}%
                        </span>
                      )}
                    </td>
                  )}
                  {likesKey && (
                    <td className="mono right">{r.likes != null ? fmt(r.likes) : '—'}</td>
                  )}
                  {likesKey && (
                    <td className="right">
                      {likesRatio != null && (
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: 'var(--mono)',
                            fontWeight: 600,
                            color: likesHi ? 'var(--red)' : likesLo ? 'var(--orange)' : 'var(--muted)',
                          }}
                        >
                          {Math.round(likesRatio)}%
                        </span>
                      )}
                    </td>
                  )}
                  <td>
                    {cls === 'high' && <span className="badge badge-red">Alto</span>}
                    {cls === 'low'  && <span className="badge badge-orange">Bajo</span>}
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
