import { describe, it, expect, beforeAll } from 'vitest'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { describeSchema, humanizeError, openDatabase, runSql } from '../docs/.vitepress/theme/lib/sql/engine-core'

const SCRIPT = `
PRAGMA foreign_keys = ON;
CREATE TABLE a (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE b (id INTEGER PRIMARY KEY, a_id INTEGER REFERENCES a(id), note TEXT);
INSERT INTO a VALUES (1, 'один'), (2, 'два'), (3, 'три');
INSERT INTO b VALUES (1, 1, NULL), (2, 1, ''), (3, 2, 'x');
`

let SQL: SqlJsStatic
beforeAll(async () => {
  SQL = await initSqlJs()
})
const fresh = () => openDatabase(SQL, SCRIPT)

describe('runSql', () => {
  it('SELECT → столбцы и строки', () => {
    const r = runSql(fresh(), 'SELECT id, name FROM a ORDER BY id')
    expect(r).toMatchObject({ kind: 'table', columns: ['id', 'name'], total: 3 })
    if (r.kind === 'table') expect(r.rows[0]).toEqual([1, 'один'])
  })

  it('пустой SELECT всё равно возвращает столбцы', () => {
    const r = runSql(fresh(), 'SELECT id, name FROM a WHERE id > 100')
    expect(r).toMatchObject({ kind: 'table', columns: ['id', 'name'], rows: [], total: 0 })
  })

  it('NULL и пустая строка различаются', () => {
    const r = runSql(fresh(), 'SELECT note FROM b ORDER BY id')
    expect(r.kind === 'table' && r.rows.map((x) => x[0])).toEqual([null, '', 'x'])
  })

  it('несколько запросов: результат последнего SELECT', () => {
    const db = fresh()
    const r = runSql(db, "UPDATE a SET name = 'ONE' WHERE id = 1; SELECT name FROM a WHERE id = 1;")
    expect(r).toMatchObject({ kind: 'table', rows: [['ONE']], statements: 2 })
  })

  it('только DML → число изменённых строк', () => {
    const r = runSql(fresh(), "UPDATE b SET note = 'y' WHERE a_id = 1")
    expect(r).toEqual({ kind: 'changes', changes: 2, statements: 1 })
  })

  it('несколько DML → сумма изменений, CREATE не считается', () => {
    const r = runSql(fresh(), "DELETE FROM b WHERE id = 3; CREATE TABLE c (x); INSERT INTO a VALUES (9, 'девять');")
    expect(r).toEqual({ kind: 'changes', changes: 2, statements: 3 })
  })

  it('большой результат обрезается, total честный', () => {
    const r = runSql(fresh(), 'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 50) SELECT x FROM n', 10)
    expect(r).toMatchObject({ kind: 'table', total: 50 })
    expect(r.kind === 'table' && r.rows.length).toBe(10)
  })

  it('пустой ввод — понятная ошибка', () => {
    expect(runSql(fresh(), '  -- только комментарий\n ')).toMatchObject({ kind: 'error', message: expect.stringMatching(/пуст/) })
  })

  it('ошибка SQLite превращается в человеческий текст', () => {
    const r = runSql(fresh(), 'SELECT * FROM nope')
    expect(r).toMatchObject({ kind: 'error', raw: expect.stringContaining('no such table') })
    expect(r.kind === 'error' && r.message).toMatch(/Таблицы «nope» нет/)
  })

  it('внешние ключи включены', () => {
    const r = runSql(fresh(), 'INSERT INTO b VALUES (10, 999, NULL)')
    expect(r.kind === 'error' && r.message).toMatch(/внешн/i)
  })
})

describe('humanizeError', () => {
  it.each([
    ['no such table: users2', /Таблицы «users2» нет/],
    ['no such column: emial', /Столбца «emial» нет/],
    ['near "FORM": syntax error', /Синтаксическая ошибка рядом с «FORM»/],
    ['incomplete input', /оборван/],
    ['ambiguous column name: id', /«id» есть в нескольких таблицах/],
    ['UNIQUE constraint failed: a.name', /уникальн.*a\.name/],
    ['NOT NULL constraint failed: a.name', /a\.name.*NULL/],
    ['FOREIGN KEY constraint failed', /внешн/],
    ['no such function: ILIKE', /Функции «ILIKE» нет в SQLite/],
    ['misuse of aggregate: COUNT()', /агрегат/i],
  ])('%s', (raw, re) => {
    expect(humanizeError(raw)).toMatch(re)
  })

  it('неизвестная ошибка — общий текст с оригиналом', () => {
    expect(humanizeError('something odd')).toContain('something odd')
  })
})

describe('describeSchema', () => {
  it('таблицы, столбцы, PK и FK', () => {
    const s = describeSchema(fresh())
    expect(s.map((t) => t.name)).toEqual(['a', 'b'])
    const b = s[1]
    expect(b.columns.map((c) => c.name)).toEqual(['id', 'a_id', 'note'])
    expect(b.columns[0].pk).toBe(true)
    expect(b.columns[1].ref).toBe('a.id')
  })
})
