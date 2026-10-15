import { describe, it, expect } from 'vitest'
import { compareResults, normalizeCell, type ResultSet } from '../docs/.vitepress/theme/lib/sql/compare'

const rs = (rows: ResultSet['rows'], columns = rows[0]?.map((_, i) => `c${i}`) ?? ['c0']): ResultSet => ({ columns, rows })

describe('normalizeCell', () => {
  it('целое и «дробное без дроби» — одно и то же', () => {
    expect(normalizeCell(1)).toBe(normalizeCell(1.0))
  })
  it('дробные округляются до 2 знаков', () => {
    expect(normalizeCell(2.3333333)).toBe(normalizeCell(2.33))
    expect(normalizeCell(0.1 + 0.2)).toBe(normalizeCell(0.3))
    expect(normalizeCell(1.005)).toBe(normalizeCell(1.01))
  })
  it('-0 равен 0', () => {
    expect(normalizeCell(-0)).toBe(normalizeCell(0))
  })
  it('NULL ≠ пустая строка', () => {
    expect(normalizeCell(null)).not.toBe(normalizeCell(''))
  })
  it('число ≠ строка с тем же текстом', () => {
    expect(normalizeCell(1)).not.toBe(normalizeCell('1'))
  })
  it('BLOB сравнивается по содержимому', () => {
    expect(normalizeCell(new Uint8Array([1, 2]))).toBe(normalizeCell(new Uint8Array([1, 2])))
    expect(normalizeCell(new Uint8Array([1, 2]))).not.toBe(normalizeCell(new Uint8Array([2, 1])))
  })
})

describe('compareResults', () => {
  const expected = rs([[1, 'a'], [2, 'b'], [3, null]])

  it('совпадение — ok', () => {
    const r = compareResults(rs([[1, 'a'], [2, 'b'], [3, null]]), expected)
    expect(r.ok).toBe(true)
    expect(r.message).toMatch(/Верно/)
  })

  it('имена столбцов не сравниваются', () => {
    expect(compareResults(rs([[1, 'a'], [2, 'b'], [3, null]], ['id', 'name']), expected).ok).toBe(true)
  })

  it('без ordered порядок строк не важен', () => {
    expect(compareResults(rs([[3, null], [1, 'a'], [2, 'b']]), expected).ok).toBe(true)
  })

  it('числа нормализуются: 1 = 1.0, дробные до 2 знаков', () => {
    const r = compareResults(rs([[1.0, 2.004]]), rs([[1, 2]]))
    expect(r.ok).toBe(true)
  })

  it('другое число столбцов', () => {
    const r = compareResults(rs([[1, 'a', 0]]), rs([[1, 'a']]))
    expect(r).toMatchObject({ ok: false, reason: 'columns' })
    expect(r.message).toContain('столбцов ожидалось 2, у тебя 3')
  })

  it('другое число строк', () => {
    const r = compareResults(rs([[1, 'a']]), expected)
    expect(r).toMatchObject({ ok: false, reason: 'rowCount' })
    expect(r.message).toContain('строк ожидалось 3, у тебя 1')
  })

  it('другой состав строк при том же количестве', () => {
    const r = compareResults(rs([[1, 'a'], [2, 'b'], [3, '']]), expected)
    expect(r).toMatchObject({ ok: false, reason: 'rows' })
    expect(r.message).toContain('состав строк отличается')
  })

  it('мультимножество: дубли считаются', () => {
    const r = compareResults(rs([[1, 'a'], [1, 'a'], [2, 'b']]), rs([[1, 'a'], [2, 'b'], [2, 'b']]))
    expect(r).toMatchObject({ ok: false, reason: 'rows' })
  })

  it('ordered: порядок важен', () => {
    const r = compareResults(rs([[2, 'b'], [1, 'a'], [3, null]]), expected, { ordered: true })
    expect(r).toMatchObject({ ok: false, reason: 'order' })
    expect(r.message).toContain('порядок строк не совпадает')
  })

  it('ordered: при верном порядке — ok', () => {
    expect(compareResults(rs([[1, 'a'], [2, 'b'], [3, null]]), expected, { ordered: true }).ok).toBe(true)
  })

  it('ordered: сначала проверяется состав, потом порядок', () => {
    const r = compareResults(rs([[9, 'z'], [1, 'a'], [3, null]]), expected, { ordered: true })
    expect(r).toMatchObject({ ok: false, reason: 'rows' })
  })

  it('пустой результат с тем же числом столбцов совпадает с пустым эталоном', () => {
    expect(compareResults({ columns: ['a', 'b'], rows: [] }, { columns: ['x', 'y'], rows: [] }).ok).toBe(true)
  })

  it('нет таблицы (не SELECT) — отдельное объяснение', () => {
    const r = compareResults(null, expected)
    expect(r).toMatchObject({ ok: false, reason: 'noTable' })
    expect(r.message).toMatch(/SELECT/)
  })

  it('объяснение не раскрывает эталонные значения', () => {
    const secret = rs([[1, 'секрет']])
    for (const actual of [rs([[1, 'x']]), rs([[1, 'x'], [2, 'y']]), rs([[1]]), null]) {
      expect(compareResults(actual, secret).message).not.toContain('секрет')
    }
  })
})
