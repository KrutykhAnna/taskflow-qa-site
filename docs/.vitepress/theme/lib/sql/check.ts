// Проверка ответа на задачу. Обе базы должны быть свежими копиями датасета:
// студент и эталон стартуют с одинаковых данных, предыдущие запуски не влияют.
import type { Database } from 'sql.js'
import { compareResults, type ResultSet } from './compare'
import { runSql, type RunResult } from './engine-core'

export type CheckableTask = { kind: 'select' | 'dml'; solution: string; check?: string; ordered?: boolean }

export type CheckOutcome = { ok: boolean; message: string }

const asTable = (r: RunResult): ResultSet | null => (r.kind === 'table' ? { columns: r.columns, rows: r.rows } : null)

/** Что должно получиться: результат эталона (select) или check-запроса после эталона (dml). */
export function expectedResult(referenceDb: Database, task: CheckableTask): RunResult {
  const r = runSql(referenceDb, task.solution)
  if (task.kind === 'select' || r.kind === 'error') return r
  return runSql(referenceDb, task.check ?? '')
}

export function checkAnswer(studentDb: Database, referenceDb: Database, task: CheckableTask, sql: string): CheckOutcome {
  const mine = runSql(studentDb, sql)
  if (mine.kind === 'error') return { ok: false, message: mine.message }

  const expected = expectedResult(referenceDb, task)
  if (expected.kind !== 'table') {
    // Сюда попадаем только при сломанной задаче — валидатор задач такого не пропускает.
    return { ok: false, message: 'Эталон задачи не выполнился — это ошибка в задаче, а не в твоём запросе.' }
  }
  const want = asTable(expected)!

  if (task.kind === 'select') {
    if (mine.kind === 'table' && mine.total > mine.rows.length) {
      return { ok: false, message: `Не совпадает: строк ожидалось ${expected.total}, у тебя ${mine.total}.` }
    }
    return compareResults(asTable(mine), want, { ordered: task.ordered })
  }

  const after = runSql(studentDb, task.check ?? '')
  if (after.kind === 'error') return { ok: false, message: after.message }
  const verdict = compareResults(asTable(after), want, { ordered: task.ordered })
  if (verdict.ok) return { ok: true, message: 'Верно! Данные после твоего запроса совпадают с эталоном.' }
  return {
    ok: false,
    message: `Данные после твоего запроса не такие, как после эталонного (проверочный запрос). ${verdict.message}`,
  }
}
