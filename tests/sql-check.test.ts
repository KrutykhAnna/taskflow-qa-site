import { describe, it, expect, beforeAll } from 'vitest'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { openDatabase } from '../docs/.vitepress/theme/lib/sql/engine-core'
import { checkAnswer, expectedResult, type CheckableTask } from '../docs/.vitepress/theme/lib/sql/check'

const SCRIPT = `
CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, score REAL);
INSERT INTO t VALUES (1, 'a', 1.5), (2, 'b', NULL), (3, 'c', 3);
`
let SQL: SqlJsStatic
beforeAll(async () => {
  SQL = await initSqlJs()
})
const check = (task: CheckableTask, sql: string) =>
  checkAnswer(openDatabase(SQL, SCRIPT), openDatabase(SQL, SCRIPT), task, sql)

const sel: CheckableTask = { kind: 'select', solution: 'SELECT name FROM t WHERE score IS NULL' }
const ord: CheckableTask = { kind: 'select', solution: 'SELECT id FROM t ORDER BY id DESC', ordered: true }
const dml: CheckableTask = {
  kind: 'dml',
  solution: "UPDATE t SET score = 0 WHERE score IS NULL",
  check: 'SELECT id, score FROM t',
}

describe('checkAnswer: select', () => {
  it('верный запрос другими словами — ok', () => {
    expect(check(sel, "SELECT name AS n FROM t WHERE id = 2").ok).toBe(true)
  })
  it('неверный — объяснение', () => {
    expect(check(sel, 'SELECT name FROM t')).toMatchObject({ ok: false, message: expect.stringContaining('строк ожидалось 1, у тебя 3') })
  })
  it('ошибка SQL — человеческий текст', () => {
    expect(check(sel, 'SELECT nam FROM t').message).toMatch(/Столбца «nam» нет/)
  })
  it('DML вместо SELECT — просим таблицу', () => {
    expect(check(sel, 'DELETE FROM t').message).toMatch(/SELECT/)
  })
  it('ordered: порядок проверяется', () => {
    expect(check(ord, 'SELECT id FROM t ORDER BY id').message).toMatch(/порядок строк/)
    expect(check(ord, 'SELECT id FROM t ORDER BY id DESC').ok).toBe(true)
  })
  it('изменения студента не влияют на эталон (разные базы)', () => {
    expect(check(sel, "UPDATE t SET score = NULL; SELECT name FROM t WHERE score IS NULL").message).toMatch(/строк ожидалось 1, у тебя 3/)
  })
})

describe('checkAnswer: dml', () => {
  it('сравниваются данные после изменения', () => {
    expect(check(dml, 'UPDATE t SET score = 0 WHERE id = 2').ok).toBe(true)
  })
  it('ничего не сделал — не ok', () => {
    const r = check(dml, 'SELECT 1')
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/состав строк/)
  })
  it('изменил лишнее — не ok', () => {
    expect(check(dml, 'UPDATE t SET score = 0').ok).toBe(false)
  })
})

describe('expectedResult', () => {
  it('select — результат эталона', () => {
    expect(expectedResult(openDatabase(SQL, SCRIPT), sel)).toMatchObject({ kind: 'table', rows: [['b']] })
  })
  it('dml — результат check после эталона', () => {
    const r = expectedResult(openDatabase(SQL, SCRIPT), dml)
    expect(r).toMatchObject({ kind: 'table', rows: [[1, 1.5], [2, 0], [3, 3]] })
  })
})
