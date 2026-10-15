// Клиент SQL-воркера на стороне страницы. Каждый запрос ограничен по времени: если воркер
// не ответил за QUERY_TIMEOUT_MS, он уничтожается (единственный способ прервать sql.js),
// создаётся заново, а база, на которой был запрос, открывается с исходными данными.
// Фабрика воркера внедряется — в тестах вместо Web Worker подставляется фейк.
import type { DatasetId } from './datasets'
import type { CheckableTask, CheckOutcome } from './check'
import type { RunResult, SchemaTable } from './engine-core'
import type { WorkerEnvelope, WorkerReply, WorkerRequest, WorkerResponse } from './worker-core'

export interface WorkerLike {
  postMessage(message: WorkerEnvelope): void
  terminate(): void
  onmessage: ((e: { data: WorkerReply }) => void) | null
  onerror: ((e: unknown) => void) | null
}

export const QUERY_TIMEOUT_MS = 5000

export const TIMEOUT_MESSAGE =
  'Запрос выполнялся дольше 5 секунд и был остановлен — проверь условия JOIN и рекурсии. База пересоздана с исходными данными.'
export const INTERRUPTED_MESSAGE =
  'Запрос прерван: SQL-движок перезапустился из-за долгого запроса в другом блоке страницы. База пересоздана — запусти ещё раз.'

const timeoutResult = (): RunResult => ({ kind: 'error', message: TIMEOUT_MESSAGE, raw: 'timeout' })

class QueryTimeout extends Error {}
class WorkerRestarted extends Error {}

/** Открытая база в воркере. Объект живёт у компонента; после перезапуска воркера клиент сам открывает её заново. */
export type DbHandle = { readonly dataset: DatasetId; id: number; gen: number; closed: boolean }

export type RunOutcome = { result: RunResult; reopened: boolean }

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer?: ReturnType<typeof setTimeout> }

export class SqlClient {
  private worker: WorkerLike | null = null
  private gen = 0
  private seq = 0
  private pending = new Map<number, Pending>()

  constructor(
    private readonly factory: () => WorkerLike,
    private readonly timeoutMs = QUERY_TIMEOUT_MS,
  ) {}

  private ensure(): WorkerLike {
    if (!this.worker) {
      const w = this.factory()
      w.onmessage = (e) => this.onReply(e.data)
      w.onerror = () => this.restart(null, new Error('SQL-движок не запустился'))
      this.worker = w
    }
    return this.worker
  }

  private onReply(r: WorkerReply) {
    const p = this.pending.get(r.id)
    if (!p) return
    clearTimeout(p.timer)
    this.pending.delete(r.id)
    if (r.ok) p.resolve(r.value)
    else p.reject(new Error(r.error))
  }

  /** Убить воркер; timedOut получает QueryTimeout, остальные ожидающие — reason или WorkerRestarted. */
  private restart(timedOut: number | null, reason?: Error) {
    this.worker?.terminate()
    this.worker = null
    this.gen++
    const waiting = [...this.pending]
    this.pending.clear()
    for (const [id, p] of waiting) {
      clearTimeout(p.timer)
      p.reject(id === timedOut ? new QueryTimeout() : (reason ?? new WorkerRestarted()))
    }
  }

  private call<K extends WorkerRequest['op']>(req: Extract<WorkerRequest, { op: K }>, timed: boolean): Promise<WorkerResponse[K]> {
    const w = this.ensure()
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      const p: Pending = { resolve: resolve as (v: unknown) => void, reject }
      if (timed) p.timer = setTimeout(() => this.restart(id), this.timeoutMs)
      this.pending.set(id, p)
      w.postMessage({ id, req })
    })
  }

  private async reopen(h: DbHandle): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        h.id = await this.call({ op: 'open', dataset: h.dataset }, false)
        h.gen = this.gen
        return
      } catch (e) {
        if (!(e instanceof WorkerRestarted) || attempt > 0) throw e
      }
    }
  }

  async open(dataset: DatasetId): Promise<DbHandle> {
    const h: DbHandle = { dataset, id: 0, gen: -1, closed: false }
    await this.reopen(h)
    return h
  }

  close(h: DbHandle): void {
    if (h.closed) return
    h.closed = true
    if (h.gen === this.gen && this.worker) this.call({ op: 'close', db: h.id }, false).catch(() => {})
  }

  /** Выполнить запрос на открытой базе. reopened — база была пересоздана (изменения в ней пропали). */
  async run(h: DbHandle, sql: string): Promise<RunOutcome> {
    let reopened = false
    if (h.gen !== this.gen) {
      await this.reopen(h)
      reopened = true
    }
    try {
      return { result: await this.call({ op: 'run', db: h.id, sql }, true), reopened }
    } catch (e) {
      if (e instanceof QueryTimeout) {
        await this.reopen(h)
        return { result: timeoutResult(), reopened: true }
      }
      if (e instanceof WorkerRestarted) {
        await this.reopen(h)
        return { result: { kind: 'error', message: INTERRUPTED_MESSAGE, raw: 'restarted' }, reopened: true }
      }
      throw e
    }
  }

  async schema(h: DbHandle): Promise<SchemaTable[]> {
    if (h.gen !== this.gen) await this.reopen(h)
    return this.call({ op: 'schema', db: h.id }, false)
  }

  /** Проверка ответа на двух свежих базах внутри воркера. */
  async check(dataset: DatasetId, task: CheckableTask, sql: string): Promise<CheckOutcome> {
    try {
      return await this.call({ op: 'check', dataset, task: plainTask(task), sql }, true)
    } catch (e) {
      if (e instanceof QueryTimeout) return { ok: false, message: TIMEOUT_MESSAGE, result: timeoutResult() }
      if (e instanceof WorkerRestarted) {
        return { ok: false, message: INTERRUPTED_MESSAGE, result: { kind: 'error', message: INTERRUPTED_MESSAGE, raw: 'restarted' } }
      }
      throw e
    }
  }

  async expected(dataset: DatasetId, task: CheckableTask): Promise<RunResult> {
    try {
      return await this.call({ op: 'expected', dataset, task: plainTask(task) }, true)
    } catch (e) {
      if (e instanceof QueryTimeout || e instanceof WorkerRestarted) return timeoutResult()
      throw e
    }
  }
}

// В воркер уходит только то, что нужно проверке (и что клонируется postMessage).
const plainTask = (t: CheckableTask): CheckableTask => ({ kind: t.kind, solution: t.solution, check: t.check ?? null, ordered: !!t.ordered })
