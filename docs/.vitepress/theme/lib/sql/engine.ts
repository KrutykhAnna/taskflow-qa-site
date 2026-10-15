// Браузерная точка входа SQL-движка. sql.js, wasm и датасеты живут в Web Worker
// (sql.worker.ts), который создаётся при первом обращении — только в браузере
// (вызывать из onMounted или обработчиков, не при SSR) и только на страницах с SQL-компонентами.
import { SqlClient, type WorkerLike } from './client'

export type { DbHandle, RunOutcome } from './client'
export type { RunResult, SchemaTable } from './engine-core'

let client: SqlClient | null = null

/** Один воркер и один клиент на страницу. */
export function getSqlClient(): SqlClient {
  if (typeof window === 'undefined') throw new Error('SQL-движок работает только в браузере')
  client ??= new SqlClient(
    () => new Worker(new URL('./sql.worker.ts', import.meta.url), { type: 'module', name: 'sql' }) as unknown as WorkerLike,
  )
  return client
}

/** Текст ошибки загрузки для пользователя. */
export function loadErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return `Не удалось загрузить SQL-движок: ${msg}. Обнови страницу; если не помогло — проверь, что браузер поддерживает WebAssembly.`
}
