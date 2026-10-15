import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { openDatabase, runSql } from '../docs/.vitepress/theme/lib/sql/engine-core'
import { checkAnswer } from '../docs/.vitepress/theme/lib/sql/check'
import { compareResults } from '../docs/.vitepress/theme/lib/sql/compare'
import { assertUniqueSqlIds, parseSqlTaskFile, SQL_TOPICS, type SqlTask } from '../docs/.vitepress/theme/lib/sql/tasks'

const tasksDir = path.resolve(__dirname, '../docs/sql-tasks')
const datasetsDir = path.resolve(__dirname, '../docs/.vitepress/theme/lib/sql/datasets')
const files = fs.readdirSync(tasksDir).filter((f) => /\.ya?ml$/.test(f))

// Тот же разбор, что в data loader (docs/sql-tasks/sql-tasks.data.ts), но без markdown.
const tasks: SqlTask[] = files.flatMap((f) =>
  parseSqlTaskFile(yaml.load(fs.readFileSync(path.join(tasksDir, f), 'utf8')), path.basename(f, '.yaml'), (s) => s),
)

let SQL: SqlJsStatic
const scripts = new Map<string, string>()
beforeAll(async () => {
  SQL = await initSqlJs()
})
const fresh = (dataset: string) => {
  if (!scripts.has(dataset)) scripts.set(dataset, fs.readFileSync(path.join(datasetsDir, `${dataset}.sql`), 'utf8'))
  return openDatabase(SQL, scripts.get(dataset)!)
}

describe('банк SQL-задач', () => {
  it('только .yaml', () => {
    expect(files.filter((f) => f.endsWith('.yml'))).toEqual([])
  })
  it('есть файл на каждую тему задачника', () => {
    for (const t of SQL_TOPICS) expect(files).toContain(`${t.id}.yaml`)
  })
  it('id уникальны во всём банке', () => {
    expect(() => assertUniqueSqlIds(tasks)).not.toThrow()
  })
  it('в каждой теме есть задачи', () => {
    for (const t of SQL_TOPICS) expect(tasks.filter((x) => x.topic === t.id).length).toBeGreaterThan(0)
  })
})

describe.each(tasks.map((t) => [t.id, t] as const))('задача %s', (_id, task) => {
  if (task.kind === 'select') {
    it('эталон выполняется и возвращает таблицу', () => {
      const r = runSql(fresh(task.dataset), task.solution)
      if (r.kind === 'error') throw new Error(r.raw)
      expect(r.kind).toBe('table')
      if (r.kind === 'table') expect(r.total > 0).toBe(!task.expectEmpty)
    })
  } else {
    it('эталон выполняется и меняет данные, check возвращает таблицу', () => {
      const db = fresh(task.dataset)
      const before = runSql(db, task.check!)
      const r = runSql(db, task.solution)
      if (r.kind === 'error') throw new Error(r.raw)
      expect(r).toMatchObject({ kind: 'changes' })
      const after = runSql(db, task.check!)
      if (after.kind === 'error') throw new Error(after.raw)
      expect(after.kind).toBe('table')
      if (after.kind === 'table') expect(after.total > 0).toBe(!task.expectEmpty)
      // иначе задачу «решает» пустой запрос
      if (before.kind === 'table' && after.kind === 'table') {
        expect(compareResults(before, after, { ordered: task.ordered }).ok).toBe(false)
      }
    })
  }
  it('эталон проходит собственную проверку', () => {
    const r = checkAnswer(fresh(task.dataset), fresh(task.dataset), task, task.solution)
    expect(r.message).toMatch(/Верно/)
  })
  it.skipIf(task.expectEmpty)('пустой ответ не проходит проверку', () => {
    expect(checkAnswer(fresh(task.dataset), fresh(task.dataset), task, 'SELECT 1 WHERE 0').ok).toBe(false)
  })
})
