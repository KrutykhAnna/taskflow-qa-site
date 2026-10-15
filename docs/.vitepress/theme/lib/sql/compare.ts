/** Значение ячейки так, как его отдаёт sql.js. */
export type Cell = string | number | null | Uint8Array

export type ResultSet = { columns: string[]; rows: Cell[][] }

export type CompareReason = 'noTable' | 'columns' | 'rowCount' | 'rows' | 'order'

export type CompareResult =
  | { ok: true; message: string }
  | { ok: false; reason: CompareReason; message: string }

/** Округление до 2 знаков без ловушки 1.005 → 1.00 (сдвиг порядка через строку). */
function round2(n: number): number {
  const s = String(n)
  const r = s.includes('e') ? Math.round(n * 100) / 100 : Number(`${Math.round(Number(`${s}e2`))}e-2`)
  return r === 0 ? 0 : r // -0 → 0
}

/**
 * Ключ ячейки для сравнения. Тип входит в ключ: NULL ≠ '' и число 1 ≠ строка '1'.
 * Числа: целые как есть, дробные округляются до 2 знаков (1 = 1.0, 2.004 = 2).
 */
export function normalizeCell(v: Cell): string {
  if (v === null) return 'null'
  if (typeof v === 'number') return `n:${round2(v)}`
  if (typeof v === 'string') return `s:${v}`
  return `b:${Array.from(v, (x) => x.toString(16).padStart(2, '0')).join('')}`
}

// Разделитель, которого не бывает в нормальных данных: строки склеиваются в один ключ.
const rowKey = (row: Cell[]) => row.map(normalizeCell).join('\u0001')

/**
 * Сравнивает результат студента с эталоном. Имена столбцов не сравниваются.
 * Объяснение не раскрывает эталонные значения — только количества и характер расхождения.
 */
export function compareResults(
  actual: ResultSet | null,
  expected: ResultSet,
  opts: { ordered?: boolean } = {},
): CompareResult {
  if (!actual) {
    return {
      ok: false,
      reason: 'noTable',
      message: 'Запрос не вернул таблицу. Здесь нужен SELECT — последний запрос в поле должен выбирать данные.',
    }
  }
  if (actual.columns.length !== expected.columns.length) {
    return {
      ok: false,
      reason: 'columns',
      message: `Не совпадает: столбцов ожидалось ${expected.columns.length}, у тебя ${actual.columns.length}.`,
    }
  }
  if (actual.rows.length !== expected.rows.length) {
    return {
      ok: false,
      reason: 'rowCount',
      message: `Не совпадает: строк ожидалось ${expected.rows.length}, у тебя ${actual.rows.length}.`,
    }
  }

  const a = actual.rows.map(rowKey)
  const e = expected.rows.map(rowKey)
  const sortedA = [...a].sort()
  const sortedE = [...e].sort()
  if (sortedA.some((k, i) => k !== sortedE[i])) {
    return {
      ok: false,
      reason: 'rows',
      message: 'Не совпадает: количество строк верное, но состав строк отличается. Проверь условия, столбцы и NULL.',
    }
  }
  if (opts.ordered && a.some((k, i) => k !== e[i])) {
    return {
      ok: false,
      reason: 'order',
      message: 'Почти: строки те же, но порядок строк не совпадает. Проверь ORDER BY.',
    }
  }
  return { ok: true, message: 'Верно! Результат совпадает с эталоном.' }
}
