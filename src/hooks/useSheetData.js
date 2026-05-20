import { useState, useEffect } from 'react'

const SHEET_ID = '1TjM_AeONimhZ2TsrueKT3g1RWUPnqikP7qLKVZMO8P4'

function parseGvizDate(val) {
  if (!val || typeof val !== 'string' || !val.startsWith('Date(')) return null
  const parts = val.slice(5, -1).split(',').map(Number)
  return new Date(parts[0], parts[1], parts[2] ?? 1)
}

function parseGvizResponse(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/)
  if (!match) throw new Error('Respuesta gviz inválida')

  let data
  try {
    data = JSON.parse(match[1])
  } catch {
    throw new Error('Error al parsear JSON de Google Sheets')
  }

  if (data.status !== 'ok') {
    const msg =
      data.errors?.[0]?.detailed_message ||
      data.errors?.[0]?.message ||
      'Error en la hoja'
    throw new Error(msg)
  }

  const { cols, rows } = data.table

  const parsed = (rows || [])
    .filter(row => row?.c?.some(c => c?.v != null && c?.v !== ''))
    .map(row => {
      const obj = {}
      cols.forEach((col, i) => {
        const cell = row.c?.[i]
        let val = cell?.v ?? null
        if ((col.type === 'date' || col.type === 'datetime') && val != null) {
          val = parseGvizDate(String(val))
        }
        const key = col.label || col.id || `col_${i}`
        obj[key] = val
      })
      return obj
    })

  return {
    data: parsed,
    cols: cols.map(c => ({ ...c, key: c.label || c.id })),
  }
}

export function useSheetData(sheetName) {
  const [state, setState] = useState({
    data: [],
    cols: [],
    loading: !!sheetName,
    error: null,
  })

  useEffect(() => {
    if (!sheetName) return

    setState(s => ({ ...s, loading: true, error: null }))

    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`

    let cancelled = false

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then(text => {
        if (cancelled) return
        const { data, cols } = parseGvizResponse(text)
        setState({ data, cols, loading: false, error: null })
      })
      .catch(err => {
        if (cancelled) return
        setState({ data: [], cols: [], loading: false, error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [sheetName])

  return state
}

// Find a column key by trying candidate substrings (case-insensitive)
export function findColKey(cols, ...patterns) {
  for (const pat of patterns) {
    const found = cols.find(c =>
      c.key?.toLowerCase().includes(pat.toLowerCase())
    )
    if (found) return found.key
  }
  return null
}

// Median of a numeric array (ignores nulls/NaN)
export function median(arr) {
  const sorted = arr.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Format number in Argentine locale
export function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Format percentage
export function fmtPct(n, decimals = 1) {
  if (n == null || isNaN(n)) return '—'
  return `${n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`
}

// Get unique sorted months from a dataset
export function getMonths(data, dateKey) {
  if (!dateKey) return []
  const seen = new Set()
  const months = []
  for (const row of data) {
    const raw = row[dateKey]
    if (!raw) continue
    const d = raw instanceof Date ? raw : new Date(raw)
    if (isNaN(d)) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!seen.has(key)) {
      seen.add(key)
      months.push({
        key,
        label: d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
        date: d,
      })
    }
  }
  return months.sort((a, b) => a.date - b.date)
}

// Filter rows matching a YYYY-MM key
export function filterByMonth(data, dateKey, monthKey) {
  if (!dateKey || !monthKey) return data
  return data.filter(r => {
    const raw = r[dateKey]
    if (!raw) return false
    const d = raw instanceof Date ? raw : new Date(raw)
    if (isNaN(d)) return false
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === monthKey
  })
}
