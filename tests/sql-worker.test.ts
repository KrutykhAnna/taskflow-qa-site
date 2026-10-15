import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { createWorkerHandler, type WorkerEnvelope, type WorkerReply } from '../docs/.vitepress/theme/lib/sql/worker-core'
import { SqlClient, TIMEOUT_MESSAGE, INTERRUPTED_MESSAGE, type WorkerLike } from '../docs/.vitepress/theme/lib/sql/client'
import type { CheckableTask } from '../docs/.vitepress/theme/lib/sql/check'
import type { DatasetId } from '../docs/.vitepress/theme/lib/sql/datasets'

const dir = path.resolve(__dirname, '../docs/.vitepress/theme/lib/sql/datasets')
const loadScript = async (id: DatasetId) => fs.readFileSync(path.join(dir, `${id}.sql`), 'utf8')
const newHandler = () => createWorkerHandler(() => initSqlJs(), loadScript)

const task: CheckableTask = { kind: 'select', solution: 'SELECT id FROM labels' }

describe('createWorkerHandler', () => {
  it('open → run → schema → close', async () => {
    const { handle, openCount } = newHandler()
    const db = (await handle({ op: 'open', dataset: 'taskflow' })) as number
    expect(await handle({ op: 'run', db, sql: 'SELECT COUNT(*) FROM labels' })).toMatchObject({ kind: 'table', rows: [[10]] })
    expect(((await handle({ op: 'schema', db })) as { name: string }[]).map((t) => t.name)).toContain('tasks')
    await handle({ op: 'close', db })
    expect(openCount()).toBe(0)
    await expect(handle({ op: 'run', db, sql: 'SELECT 1' })).rejects.toThrow(/закрыта/)
  })

  it('check и expected не оставляют открытых баз', async () => {
    const { handle, openCount } = newHandler()
    expect(await handle({ op: 'check', dataset: 'taskflow', task, sql: 'SELECT id FROM labels' })).toMatchObject({ ok: true })
    expect(await handle({ op: 'expected', dataset: 'taskflow', task })).toMatchObject({ kind: 'table', total: 10 })
    expect(openCount()).toBe(0)
  })

  it('если вторая база проверки не открылась, первая всё равно закрыта', async () => {
    const real = await initSqlJs()
    let made = 0
    const closed: number[] = []
    // SQL-«модуль», у которого вторая база не создаётся
    const flaky = {
      Database: class {
        constructor() {
          const n = ++made
          if (n === 2) throw new Error('нет памяти')
          const db = new real.Database()
          const close = db.close.bind(db)
          db.close = () => {
            closed.push(n)
            close()
          }
          return db
        }
      },
    } as unknown as typeof real
    const { handle } = createWorkerHandler(async () => flaky, loadScript)
    await expect(handle({ op: 'check', dataset: 'shop', task, sql: 'SELECT 1' })).rejects.toThrow(/нет памяти/)
    expect(closed).toEqual([1])
  })
})

/**
 * Фейковый воркер: настоящий обработчик, но асинхронно, как через postMessage.
 * Запрос, содержащий HANG, «зависает» — ответа нет, как у бесконечного WITH RECURSIVE.
 */
function fakeWorkers() {
  const created: { terminated: boolean }[] = []
  const factory = (): WorkerLike => {
    const { handle } = newHandler()
    const state = { terminated: false }
    created.push(state)
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      terminate: () => {
        state.terminated = true
      },
      postMessage: ({ id, req }: WorkerEnvelope) => {
        if ('sql' in req && req.sql.includes('HANG')) return
        handle(req).then(
          (value) => !state.terminated && w.onmessage?.({ data: { id, ok: true, value } as WorkerReply }),
          (e: Error) => !state.terminated && w.onmessage?.({ data: { id, ok: false, error: e.message } }),
        )
      },
    }
    return w
  }
  return { factory, created }
}

describe('SqlClient: таймаут запроса', () => {
  it('обычный запрос работает, воркер один', async () => {
    const { factory, created } = fakeWorkers()
    const c = new SqlClient(factory, 200)
    const h = await c.open('taskflow')
    expect((await c.run(h, 'SELECT COUNT(*) FROM users')).result).toMatchObject({ kind: 'table', rows: [[26]] })
    expect(created).toHaveLength(1)
  })

  it('зависший запрос: воркер убит и создан заново, база пересоздана, понятное сообщение', async () => {
    const { factory, created } = fakeWorkers()
    const c = new SqlClient(factory, 100)
    const h = await c.open('taskflow')
    await c.run(h, 'DELETE FROM task_labels')
    const t0 = Date.now()
    const out = await c.run(h, 'SELECT 1 -- HANG')
    expect(Date.now() - t0).toBeLessThan(2000)
    expect(out).toEqual({ result: { kind: 'error', message: TIMEOUT_MESSAGE, raw: 'timeout' }, reopened: true })
    expect(created.map((w) => w.terminated)).toEqual([true, false])
    // база открыта заново с исходными данными
    expect((await c.run(h, 'SELECT COUNT(*) FROM task_labels')).result).toMatchObject({ rows: [[77]] })
  })

  it('другие базы на странице после перезапуска открываются заново сами (reopened)', async () => {
    const { factory } = fakeWorkers()
    const c = new SqlClient(factory, 100)
    const a = await c.open('taskflow')
    const b = await c.open('shop')
    await c.run(a, 'SELECT 1 -- HANG')
    const out = await c.run(b, 'SELECT COUNT(*) FROM orders')
    expect(out.reopened).toBe(true)
    expect(out.result).toMatchObject({ rows: [[64]] })
    expect((await c.run(b, 'SELECT 1')).reopened).toBe(false)
  })

  it('запрос, ждавший в очереди за зависшим, прерывается с объяснением', async () => {
    const { factory } = fakeWorkers()
    const c = new SqlClient(factory, 100)
    const a = await c.open('taskflow')
    const b = await c.open('taskflow')
    const hang = c.run(a, 'SELECT 1 -- HANG')
    // фейк отвечает асинхронно; второй запрос тоже «висит» за первым
    const queued = c.run(b, 'SELECT 2 -- HANG too')
    expect((await hang).result).toMatchObject({ message: TIMEOUT_MESSAGE })
    expect((await queued).result).toMatchObject({ message: INTERRUPTED_MESSAGE })
  })

  it('check с зависшим запросом — вердикт «не пройдено» с сообщением о таймауте', async () => {
    const { factory } = fakeWorkers()
    const c = new SqlClient(factory, 100)
    expect(await c.check('taskflow', task, 'SELECT 1 -- HANG')).toMatchObject({ ok: false, message: TIMEOUT_MESSAGE })
    expect(await c.check('taskflow', task, 'SELECT id FROM labels')).toMatchObject({ ok: true })
  })

  it('ошибка запуска воркера отклоняет ожидающие вызовы, следующий вызов создаёт воркер заново', async () => {
    let n = 0
    const { factory } = fakeWorkers()
    const c = new SqlClient(() => {
      const w = factory()
      if (n++ === 0) {
        // первый воркер не стартует: вместо ответа — событие error
        w.postMessage = () => setTimeout(() => w.onerror?.(new Error('boom')), 0)
      }
      return w
    }, 100)
    await expect(c.open('taskflow')).rejects.toThrow(/не запустился/)
    expect(await c.open('taskflow')).toMatchObject({ dataset: 'taskflow', closed: false })
  })

  it('close закрытой или устаревшей базы не падает', async () => {
    const { factory } = fakeWorkers()
    const c = new SqlClient(factory, 100)
    const h = await c.open('shop')
    c.close(h)
    c.close(h)
    expect(h.closed).toBe(true)
  })
})
