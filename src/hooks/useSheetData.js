import { useState, useEffect } from 'react'

const SHEET_ID = '1TjM_AeONimhZ2TsrueKT3g1RWUPnqikP7qLKVZMO8P4'

// Parse gviz date string "Date(y,m,d)" → Date object
function parseGvizDate(v) {
  if (typeof v !== 'string' || !v.startsWith('Date(')) return null
  const p = v.slice(5, -1).split(',').map(Number)
  return new Date(p[0], p[1], p[2] ?? 1)
}

// Strip JSONP wrapper and parse the inner JSON
function parseGvizResponse(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);?\s*$/)
  if (!match) throw new Error('Formato gviz inválido')

  const data = JSON.parse(match[1])
  if (data.status !== 'ok') {
    throw new Error(data.errors?.[0]?.message || 'Error en la hoja')
  }

  const { cols, rows } = data.table
  const numCols = cols.length

  // colHeaders: raw label strings from gviz (often "" when labels are missing)
  const colHeaders = cols.map(c => c.label ?? '')

  // matrix[i][j] = parsed value at row i, col j
  const matrix = (rows || []).map(row =>
    Array.from({ length: numCols }, (_, j) => {
      const cell = row?.c?.[j]
      if (!cell || cell.v == null) return null
      const colType = cols[j]?.type
      if (colType === 'date' || colType === 'datetime') {
        return parseGvizDate(String(cell.v))
      }
      return cell.v
    })
  )

  return { matrix, colHeaders }
}

// ── Core hook ──────────────────────────────────────────────────────────────────
export function useSheetData(sheetName) {
  const [state, setState] = useState({
    matrix: [],
    colHeaders: [],
    loading: !!sheetName,
    error: null,
  })

  useEffect(() => {
    if (!sheetName) return
    setState(s => ({ ...s, loading: true, error: null }))

    const url =
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}` +
      `/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`

    let cancelled = false

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then(text => {
        if (cancelled) return
        const parsed = parseGvizResponse(text)
        setState({ ...parsed, loading: false, error: null })
      })
      .catch(err => {
        if (cancelled) return
        setState({ matrix: [], colHeaders: [], loading: false, error: err.message })
      })

    return () => { cancelled = true }
  }, [sheetName])

  return state
}

// ── Numeric coercion (returns null for invalid / missing) ──────────────────────
export function num(v) {
  if (v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// ── Median (ignores nulls/NaN) ─────────────────────────────────────────────────
export function median(arr) {
  const s = arr.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b)
  if (!s.length) return 0
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ── Formatters ─────────────────────────────────────────────────────────────────
export function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function fmtPct(n, decimals = 1) {
  if (n == null || isNaN(n)) return '—'
  return `${Number(n).toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`
}

// pct stored as fraction (0.15) or whole (15) → always render as whole
export function fmtPctAuto(n, decimals = 1) {
  if (n == null || isNaN(n)) return '—'
  const v = Math.abs(Number(n)) <= 1 ? Number(n) * 100 : Number(n)
  return fmtPct(v, decimals)
}
