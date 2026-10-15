// Логика SQL-воркера без привязки к Web Worker: сам воркер (sql.worker.ts) только передаёт
// сообщения сюда. В тестах этот обработчик вызывается напрямую в Node.
import type { Database, SqlJsStatic } from 'sql.js'
import type { DatasetId } from './datasets'
import { checkAnswer, expectedResult, type CheckableTask, type CheckOutcome } from './check'
import { describeSchema, openDatabase, runSql, type RunResult, type SchemaTable } from './engine-core'

export type WorkerRequest =
  | { op: 'open'; dataset: DatasetId }
  | { op: 'close'; db: number }
  | { op: 'run'; db: number; sql: string }
  | { op: 'schema'; db: number }
  | { op: 'check'; dataset: DatasetId; task: CheckableTask; sql: string }
  | { op: 'expected'; dataset: DatasetId; task: CheckableTask }

/** Что возвращает каждая операция. */
export type WorkerResponse = {
  open: number
  close: null
  run: RunResult
  schema: SchemaTable[]
  check: CheckOutcome
  expected: RunResult
}

export type WorkerEnvelope = { id: number; req: WorkerRequest }
export type WorkerReply = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string }

export function createWorkerHandler(getSQL: () => Promise<SqlJsStatic>, loadScript: (id: DatasetId) => Promise<string>) {
  let sql: Promise<SqlJsStatic> | null = null
  const scripts = new Map<DatasetId, Promise<string>>()
  const dbs = new Map<number, Database>()
  let next = 1

  async function fresh(dataset: DatasetId): Promise<Database> {
    sql ??= getSQL().catch((e) => {
      sql = null
      throw e
    })
    let script = scripts.get(dataset)
    if (!script) {
      script = loadScript(dataset)
      script.catch(() => scripts.delete(dataset))
      scripts.set(dataset, script)
    }
    const [SQL, text] = await Promise.all([sql, script])
    return openDatabase(SQL, text)
  }

  const get = (id: number) => {
    const db = dbs.get(id)
    if (!db) throw new Error('База закрыта — нажми «Сбросить базу».')
    return db
  }

  async function handle(req: WorkerRequest): Promise<unknown> {
    switch (req.op) {
      case 'open': {
        const id = next++
        dbs.set(id, await fresh(req.dataset))
        return id
      }
      case 'close':
        dbs.get(req.db)?.close()
        dbs.delete(req.db)
        return null
      case 'run':
        return runSql(get(req.db), req.sql)
      case 'schema':
        return describeSchema(get(req.db))
      case 'check': {
        // Обе базы свежие; закрываются при любом исходе, даже если вторая не открылась.
        const mine = await fresh(req.dataset)
        try {
          const reference = await fresh(req.dataset)
          try {
            return checkAnswer(mine, reference, req.task, req.sql)
          } finally {
            reference.close()
          }
        } finally {
          mine.close()
        }
      }
      case 'expected': {
        const db = await fresh(req.dataset)
        try {
          return expectedResult(db, req.task)
        } finally {
          db.close()
        }
      }
    }
  }

  return { handle, openCount: () => dbs.size }
}
