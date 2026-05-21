import { useMemo } from 'react'
import { useSheetData, num, fmt, median } from '../hooks/useSheetData'

// ── ESCRUTINIOS matrix layout ─────────────────────────────────────────────────
// row 0        = header  (col 1 = "Socios", col 2 = "Stock", col 3 = "Likes")
// rows 1..n    = one member per row
//   col 1 = nombre socio
//   col 2 = stock declarado
//   col 3 = likes declarados
// col 0 is unused (empty / row number)

function Loading() {
  return <div className="state-box"><div className="spinner" /><span>Cargando escrutinios…</span></div>
}

export default function Escrutinios() {
  const { matrix, loading, error } = useSheetData('ESCRUTINIOS')

  // Parse members starting at row 1 (skip header)
  const members = useMemo(() =>
    (matrix.slice(1) ?? [])
      .filter(row => row[1] != null && String(row[1]).trim() !== '')
      .map(row => ({
        socio: String(row[1]),
        stock: num(row[2]),
        likes: num(row[3]),
      })),
    [matrix]
  )

  const sorted = useMemo(
    () => [...members].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0)),
    [members]
  )

  const stockValues = members.map(m => m.stock).filter(v => v != null)
  const likesValues = members.map(m => m.likes).filter(v => v != null)

  const medStock = median(stockValues)
  const medLikes = median(likesValues)
  const avgStock = stockValues.length ? stockValues.reduce((s, v) => s + v, 0) / stockValues.length : 0
  const avgLikes = likesValues.length ? likesValues.reduce((s, v) => s + v, 0) / likesValues.length : 0

  // Classify a member relative to the median
  function classify(m) {
    const hiStock = m.stock != null && m.stock > medStock * 2
    const hiLikes = m.likes != null && m.likes > medLikes * 2
    if (hiStock || hiLikes) return 'high'
    const loStock = m.stock != null && m.stock < medStock * 0.4
    const loLikes = m.likes != null && m.likes < medLikes * 0.4
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
          <div className="metric-value accent">{fmt(medStock)}</div>
          <div className="metric-label mt-16">métrica central</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Mediana likes</div>
          <div className="metric-value accent">{fmt(medLikes)}</div>
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
          <div className="metric-value">{members.length}</div>
          <div className="metric-label mt-16">declaraciones</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
          <span className="badge badge-red">Outlier alto</span>
          <span>Más del doble de la mediana</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
          <span className="badge badge-orange">Outlier bajo</span>
          <span>Menos del 40% de la mediana</span>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              <th>Socio</th>
              <th className="right">Stock declarado</th>
              <th className="right">% vs mediana</th>
              <th className="right">Likes declarados</th>
              <th className="right">% vs mediana</th>
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
            {sorted.map((m, i) => {
              const cls         = classify(m)
              const trClass     = cls === 'high' ? 'row-red' : cls === 'low' ? 'row-orange' : ''
              const stockRatio  = medStock > 0 && m.stock != null ? (m.stock / medStock) * 100 : null
              const likesRatio  = medLikes > 0 && m.likes != null ? (m.likes / medLikes) * 100 : null
              const stockHi     = m.stock != null && m.stock > medStock * 2
              const stockLo     = m.stock != null && m.stock < medStock * 0.4
              const likesHi     = m.likes != null && m.likes > medLikes * 2
              const likesLo     = m.likes != null && m.likes < medLikes * 0.4

              function ratioColor(hi, lo) {
                return hi ? 'var(--red)' : lo ? 'var(--orange)' : 'var(--muted)'
              }

              return (
                <tr key={i} className={trClass}>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{m.socio}</td>
                  <td className="mono right">{m.stock != null ? fmt(m.stock) : '—'}</td>
                  <td className="right">
                    {stockRatio != null && (
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, color: ratioColor(stockHi, stockLo) }}>
                        {Math.round(stockRatio)}%
                      </span>
                    )}
                  </td>
                  <td className="mono right">{m.likes != null ? fmt(m.likes) : '—'}</td>
                  <td className="right">
                    {likesRatio != null && (
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, color: ratioColor(likesHi, likesLo) }}>
                        {Math.round(likesRatio)}%
                      </span>
                    )}
                  </td>
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
