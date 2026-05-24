import { useState, useEffect } from 'react'

const SHEET_ID = '1TjM_AeONimhZ2TsrueKT3g1RWUPnqikP7qLKVZMO8P4'

// Parse gviz date string "Date(y,m,d)" → Date object
function parseGvizDate(v) {
  if (typeof v !== 'string' || !v.startsWith('Date(')) return null
  const p = v.slice(5, -1).split(',').map(Number)
  return new Date(p[0], p[1], p[2] ?? 1)
}

function parseGvizResponse(text) {
  // Strip JSONP wrapper using indexOf/lastIndexOf — immune to regex edge cases.
  // Format: /*O_o*/ google.visualization.Query.setResponse({...});
  // We take everything between the first '(' and the last ')'.
  const raw  = text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'))
  const json = JSON.parse(raw)

  if (json.status !== 'ok') {
    throw new Error(json.errors?.[0]?.message || 'Error en la hoja')
  }

  const { cols, rows } = json.table
  const numCols = cols.length

  // colHeaders: raw label strings (often "" when the sheet has no header row)
  const colHeaders = cols.map(c => c.label ?? '')

  // matrix[i][j] = parsed value at table row i, column j
  // Accessed as: rows[i].c[j]?.v
  const matrix = (rows ?? []).map(row =>
    Array.from({ length: numCols }, (_, j) => {
      const cell = row?.c?.[j]
      if (!cell || cell.v == null) return null
      const t = cols[j]?.type
      if (t === 'date' || t === 'datetime') return parseGvizDate(String(cell.v))
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

// ── Numeric coercion — returns null for missing/NaN ───────────────────────────
export function num(v) {
  if (v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// ── Median (ignores nulls / NaN) ──────────────────────────────────────────────
export function median(arr) {
  const s = arr.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b)
  if (!s.length) return 0
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ── Number formatters ─────────────────────────────────────────────────────────
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

// Handles pct stored as fraction (0.15 → "15,0%") or whole (15 → "15,0%")
export function fmtPctAuto(n, decimals = 1) {
  if (n == null || isNaN(n)) return '—'
  const v = Math.abs(Number(n)) <= 1 ? Number(n) * 100 : Number(n)
  return fmtPct(v, decimals)
}
