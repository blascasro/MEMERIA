# CLAUDE.md — Memeria

Dashboard público para una comunidad de WhatsApp de memes. React 18 + Vite 6 + React Router v6 + Recharts. Datos de un Google Sheet público vía la API gviz.

**Sheet ID:** `1TjM_AeONimhZ2TsrueKT3g1RWUPnqikP7qLKVZMO8P4`

---

## Hojas por página

| Página | Hojas leídas |
|--------|-------------|
| Balances | `Stock copia`, `IPG copia`, `Presupuestacion copia` |
| Reservas | `RESERVAS` |
| Aportes | `Presupuestacion copia` |
| Escrutinios | `escrutinios 2` |

---

## Parser gviz (`src/hooks/useSheetData.js`)

La API devuelve JSONP con el wrapper:
```
/*O_o*/ google.visualization.Query.setResponse({...});
```

### Stripping del wrapper

**No usar regex** — falla con el formato real. Usar:
```js
const raw  = text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'))
const json = JSON.parse(raw)
```

### Acceso posicional (crítico)

gviz devuelve `label: ""` en todas las columnas — **nunca buscar por label**. Todo acceso es por índice:
```js
matrix[rowIndex][colIndex]
```
`matrix` se construye como array de arrays desde `rows[i].c[j].v`.

### Tipos de celda

- Columnas `date`/`datetime`: gviz devuelve `"Date(y,m,d)"` → se convierte con `parseGvizDate()` → `Date` object.
- Números que deberían ser texto de mes (cabecera): llegan como serial Excel (e.g. `46756`) → `monthLabel()` → `"JULIO 2025"`.

### `monthLabel(v)` — normalizador de cabeceras de mes

```js
export function monthLabel(v) {
  if (v == null) return null
  if (v instanceof Date) return MESES[v.getMonth()] + ' ' + v.getFullYear()
  if (typeof v === 'number' && !isNaN(v)) return serialToMes(v)
  const s = String(v).trim()
  return s || null
}
```

`serialToMes(n)`: `new Date(Math.round((n - 25569) * 86400 * 1000))` — el offset 25569 corrige el epoch de Excel (1900-01-01) al Unix epoch (1970-01-01), incluyendo el bug de Excel que considera 1900 bisiesto.

### `fmtPctAuto(n)` — porcentajes con formato dual

Algunos campos guardan el porcentaje como fracción (0.15) y otros como entero (15). Esta función maneja ambos:
```js
Math.abs(n) <= 1 ? n * 100 : n
```

---

## Layouts de hojas

### `Stock copia`
- Row 0: col 0 = vacío · cols 1..N = etiquetas de mes (números seriales)
- Row 1: Stock · Row 2: Superavit · Row 3: Interanual · Row 4: S/D diario · Row 5: Fin · Row 6: Dias asegurados
- Acceso: `colIdx = monthIdx + 1`

### `IPG copia`
- Row 0: col 0 = vacío · cols 1..N = etiquetas de mes
- Row 1: TOTAL LIKES · Row 2: PROM TANDA · Row 3: dias · Row 4: Maximo · Row 5: Minimo
- **Rango histórico distinto al de Stock** — tiene meses propios (empieza en abril 2025)
- Gráfico IPG usa `ipgMonthLabels` como eje X, nunca los de Stock

### `Presupuestacion copia` (usada en Balances y Aportes)
- Estructura **no alternada**: una columna por mes
- Row 0: col 0 = vacío · cols 1..N = etiquetas de mes
- Rows 1..M: socios — col 0 = nombre · cols 1..N = memes del mes
- Filas footer identificadas por col 0: `SOCIOS`, `TOTAL`, `Aporte ideal`, `Incumplidores`, `Evasion fiscal`, `Evasion fiscal%`, `IHH`, `Estructura`, `C5`, `C3`
- Acceso: `colIdx = monthIdx + 1`

### `RESERVAS`
- Row 0: cabecera de meses
- Row 1: Stock bruto · Row 5: Stock neto · Row 6: Institucional · Row 7: Descripción · Row 8: SS

### `escrutinios 2`
- Row 0: header (`Fecha · Socio · Stock · Likes · [ignorado]`)
- Rows 1..N: una entrada por envío
  - col 0: Fecha (serial o Date)
  - col 1: Socio (string)
  - col 2: Stock (number)
  - col 3: Likes (number)
- Los registros se agrupan por mes a partir de la Fecha

---

## Meses independientes por hoja (decisión crítica)

**Cada hoja tiene su propia lista de meses** derivada de su propia fila 0. Nunca se comparten índices entre hojas. En Balances.jsx:

```js
const monthLabels      = useMemo(() => ..., [stock.matrix])   // Stock copia
const ipgMonthLabels   = useMemo(() => ..., [ipg.matrix])     // IPG copia — rango distinto
const presupMonthLabels= useMemo(() => ..., [presp.matrix])   // Presupuestacion copia
```

El selector de mes muestra los meses de Stock; para IPG y Presupuestacion se busca el mes seleccionado en su propia lista:
```js
const ipgMonthIdx    = currentLabel ? ipgMonthLabels.indexOf(currentLabel)    : ipgMonthLabels.length - 1
const presupMonthIdx = currentLabel ? presupMonthLabels.indexOf(currentLabel) : presupMonthLabels.length - 1
const ipgColIdx      = ipgMonthIdx    >= 0 ? ipgMonthIdx + 1    : -1
const presupColIdx   = presupMonthIdx >= 0 ? presupMonthIdx + 1 : -1
```
`-1` es seguro porque `array[-1]` devuelve `undefined`, y `num(undefined)` devuelve `null`.

---

## `findRow` — búsqueda case-insensitive de filas footer

```js
function findRow(matrix, key) {
  const k = key.trim().toLowerCase()
  return matrix.find(row => String(row[0] ?? '').trim().toLowerCase() === k) ?? []
}
```

Devuelve `[]` si no encuentra la fila, para que los accesos por índice sean seguros. **La comparación debe ser case-insensitive** — "Estructura" en la hoja no siempre coincide en mayúsculas/minúsculas.

---

## `mesNum` — comparación cronológica de meses

Convierte `"JULIO 2025"` → `202507` para usar `>=` / `<=`:
```js
function mesNum(label) {
  const [mes, anio] = String(label).trim().split(' ')
  return (parseInt(anio, 10) || 0) * 100 + (_MES_NUM[mes] ?? 0)
}
```
Implementado en Aportes.jsx (con `_MES_NUM` lookup table) y Escrutinios.jsx (con `MESES_STR.indexOf(mes) + 1`). Funcionalmente equivalentes.

---

## Reglas de visibilidad de socios en Aportes

```js
function isSocioVisible(nombre, mes) {
  const idx = mesNum(mes)
  switch (nombre) {
    case 'Cartel Los analistas de Lirilí Larilá':
      return mes === 'JULIO 2025' || mes === 'AGOSTO 2025'
    case 'Afro':
    case 'Capilla':
    case 'Jere':
      return mes !== 'JULIO 2025' && mes !== 'AGOSTO 2025'
    case 'Amado':
      return mes !== 'JULIO 2025'
    case 'Bian':
      return idx >= mesNum('AGOSTO 2025')
    case 'Mari':
      return idx >= mesNum('SEPTIEMBRE 2025')
    default:
      return true
  }
}
```

Filas que **no son socios** (excluidas de la tabla):
```js
const NON_MEMBER_NAMES = new Set([
  'A termino', 'Incompletos', 'SOCIOS', 'TOTAL', 'Aporte ideal',
  'Incumplidores', 'Evasion fiscal', 'Evasion fiscal%', 'IHH', 'Estructura',
  'C5', 'C3',
])
// También: cualquier nombre que incluya "(baneado)"
```

---

## Lista de socios activos (Escrutinios)

```js
const SOCIOS_ACTIVOS = [
  'Pey', 'Jacob', 'Afro', 'Nico', 'Maxi', 'Boca', 'Joaco', 'Bian', 'Jere',
  'Lobense', 'Thomy', 'Mari', 'Dante', 'Capilla', 'Ianni', 'Peter', 'Amado', 'Borghix',
]
```

Los socios ausentes en un mes aparecen como "No votó" (null). La detección de outliers usa la mediana (no el promedio):
- Rojo: stock o likes > 2× mediana
- Naranja: stock o likes < 0,4× mediana

---

## Reglas de hooks (React)

**Todos los `useState` y `useMemo` deben ir antes de cualquier `return` condicional** (early returns para loading/error). Violar esto causa crashes en runtime. Patrón correcto en todos los componentes:

```js
export default function Component() {
  // 1. Todos los hooks aquí
  const { matrix, loading, error } = useSheetData('...')
  const [selected, setSelected] = useState(null)
  const derived = useMemo(() => ..., [matrix])

  // 2. Early returns recién acá
  if (loading) return <Loading />
  if (error)   return <Error />

  // 3. Renderizado
  return ...
}
```

---

## Colores de filas en tablas

| Clase CSS | Condición | Color |
|-----------|-----------|-------|
| `row-red` | 0 memes / outlier alto | `--red-dim` |
| `row-yellow` | faltante > 0 | `--yellow-dim` |
| `row-orange` | outlier bajo (Escrutinios) | `--orange-dim` |

---

## Decisiones técnicas

- **Recharts** — única librería de gráficos. Sin otros componentes UI externos.
- **gviz en lugar de Sheets API** — no requiere API key, es acceso público de solo lectura.
- **Acceso posicional** — gviz no expone nombres de columna útiles; todos los índices son hardcodeados y documentados por layout de hoja.
- **`vercel.json`** — rewrites `/(.*) → /` para que React Router funcione como SPA.
- **`vite.config.js`** — `manualChunks` separa vendor (react stack) y charts (recharts) en chunks distintos.
- **Temas claro/oscuro** — CSS custom properties en `:root` y `[data-theme="dark"]`. Toggle guardado en `localStorage`.
- **IPG gráfico anual** — usa dual Y axes: `yAxisId="left"` para barras de likes, `yAxisId="right"` para línea de promedio por tanda.
- **Etiquetas C5/C3** — mostradas en UI como "TOP 5" / "TOP 3"; los nombres de fila en la hoja siguen siendo `C5` / `C3`.
