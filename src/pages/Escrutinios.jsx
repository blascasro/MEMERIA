import { useState, useMemo } from 'react'
import { useSheetData, num, fmt, median } from '../hooks/useSheetData'

// ── "escrutinios 2" layout ────────────────────────────────────────────────────
// row 0: header — Fecha · Socio · Stock · Likes · [ignored]
// rows 1..N: one entry per submission
//   col 0 = Fecha   (serial date number or Date object from gviz)
//   col 1 = Socio   (name string)
//   col 2 = Stock   (number, or "No votó" → null)
//   col 3 = Likes   (number, or "No votó" → null)
//   col 4 = ignored
//
// Entries are grouped by month (NOMBRE_MES YYYY).
// SOCIOS_ACTIVOS defines the canonical member list; those absent from a given
// month's data are shown in the table as "No votó".

const MESES_STR = [
  'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
]

const SOCIOS_ACTIVOS = [
  'Pey', 'Jacob', 'Afro', 'Nico', 'Maxi', 'Boca', 'Joaco', 'Bian', 'Jere',
  'Lobense', 'Thomy', 'Mari', 'Dante', 'Capilla', 'Ianni', 'Peter', 'Amado', 'Borghix',
]

// Convert a Fecha cell (serial number or Date) to "NOMBRE_MES YYYY".
// Returns null for unrecognised values.
function cellToMesLabel(v) {
  if (v == null) return null
  let date
  if (v instanceof Date) {
    date = v
  } else if (typeof v === 'number' && !isNaN(v)) {
    date = new Date(Math.round((v - 25569) * 86400 * 1000))
  } else {
    return null
  }
  return MESES_STR[date.getUTCMonth()] + ' ' + date.getUTCFullYear()
}

// "JULIO 2025" → 202507  (used for chronological sort)
function mesNum(label) {
  if (!label) return 0
  const [mes, anio] = String(label).trim().split(' ')
  return (parseInt(anio, 10) || 0) * 100 + (MESES_STR.indexOf(mes) + 1)
}

// "No votó" or null → null; anything else → numeric coercion
function parseVal(v) {
  if (v === 'No votó' || v == null) return null
  return num(v)
}

function Loading() {
  return <div className="state-box"><div className="spinner" /><span>Cargando escrutinios…</span></div>
}

export default function Escrutinios() {
  // ── All hooks first ───────────────────────────────────────────────────────
  const { matrix, loading, error } = useSheetData('escrutinios 2')
  const [selectedLabel, setSelectedLabel] = useState(null)

  // Group data rows by month → Map<mesLabel, Map<nombre, {stock, likes}>>
  const byMonth = useMemo(() => {
    const map = new Map()
    for (const row of matrix.slice(1)) {          // skip header row 0
      const label  = cellToMesLabel(row[0])
      if (!label) continue
      const nombre = row[1] != null ? String(row[1]).trim() : ''
      if (!nombre) continue
      if (!map.has(label)) map.set(label, new Map())
      map.get(label).set(nombre, {
        stock: parseVal(row[2]),
        likes: parseVal(row[3]),
      })
    }
    return map
  }, [matrix])

  // Available months, most-recent first
  const monthLabels = useMemo(
    () => Array.from(byMonth.keys()).sort((a, b) => mesNum(b) - mesNum(a)),
    [byMonth]
  )

  const currentLabel = selectedLabel ?? monthLabels[0] ?? null   // default = latest

  // All SOCIOS_ACTIVOS for the selected month; absent members get null (No votó)
  const members = useMemo(() => {
    const monthMap = currentLabel ? (byMonth.get(currentLabel) ?? new Map()) : new Map()
    return SOCIOS_ACTIVOS.map(socio => {
      const entry = monthMap.get(socio)
      return entry !== undefined
        ? { socio, stock: entry.stock, likes: entry.likes }
        : { socio, stock: null,        likes: null }
    })
  }, [byMonth, currentLabel])

  // Sort by stock descending; null rows go to the bottom
  const sorted = useMemo(
    () => [...members].sort((a, b) => {
      if (a.stock == null && b.stock == null) return 0
      if (a.stock == null) return  1
      if (b.stock == null) return -1
      return b.stock - a.stock
    }),
    [members]
  )

  // ── Early returns after all hooks ────────────────────────────────────────
  if (loading) return <div className="container"><Loading /></div>
  if (error)   return <div className="container"><div className="state-box" style={{ color: 'var(--red)' }}>Error: {error}</div></div>

  // ── Derived metrics — null/"No votó" rows excluded ────────────────────────
  const stockValues = members.map(m => m.stock).filter(v => v != null)
  const likesValues = members.map(m => m.likes).filter(v => v != null)
  const medStock = median(stockValues)
  const medLikes = median(likesValues)
  const avgStock = stockValues.length ? stockValues.reduce((s, v) => s + v, 0) / stockValues.length : 0
  const avgLikes = likesValues.length ? likesValues.reduce((s, v) => s + v, 0) / likesValues.length : 0

  function classify(m) {
    if ((m.stock != null && m.stock > medStock * 2) || (m.likes != null && m.likes > medLikes * 2)) return 'high'
    if ((m.stock != null && m.stock < medStock * 0.4) || (m.likes != null && m.likes < medLikes * 0.4)) return 'low'
    return 'normal'
  }

  const noVoto = <span style={{ color: 'var(--muted)', fontSize: 12, fontStyle: 'italic' }}>No votó</span>

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Escrutinios</h1>
        <p className="page-subtitle">Declaraciones de stock y likes de los socios</p>
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
          <div className="metric-label mt-16">con outliers</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Promedio likes</div>
          <div className="metric-value">{fmt(avgLikes, 0)}</div>
          <div className="metric-label mt-16">con outliers</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Socios relevados</div>
          <div className="metric-value">{stockValues.length}</div>
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
              const cls        = classify(m)
              const trClass    = cls === 'high' ? 'row-red' : cls === 'low' ? 'row-orange' : ''
              const stockRatio = medStock > 0 && m.stock != null ? (m.stock / medStock) * 100 : null
              const likesRatio = medLikes > 0 && m.likes != null ? (m.likes / medLikes) * 100 : null
              const stockHi    = m.stock != null && m.stock > medStock * 2
              const stockLo    = m.stock != null && m.stock < medStock * 0.4
              const likesHi    = m.likes != null && m.likes > medLikes * 2
              const likesLo    = m.likes != null && m.likes < medLikes * 0.4

              const ratioStyle = (hi, lo) => ({
                fontSize: 11,
                fontFamily: 'var(--mono)',
                fontWeight: 600,
                color: hi ? 'var(--red)' : lo ? 'var(--orange)' : 'var(--muted)',
              })

              return (
                <tr key={m.socio} className={trClass}>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{m.socio}</td>
                  <td className="mono right">{m.stock != null ? fmt(m.stock) : noVoto}</td>
                  <td className="right">
                    {stockRatio != null && (
                      <span style={ratioStyle(stockHi, stockLo)}>{Math.round(stockRatio)}%</span>
                    )}
                  </td>
                  <td className="mono right">{m.likes != null ? fmt(m.likes) : noVoto}</td>
                  <td className="right">
                    {likesRatio != null && (
                      <span style={ratioStyle(likesHi, likesLo)}>{Math.round(likesRatio)}%</span>
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
