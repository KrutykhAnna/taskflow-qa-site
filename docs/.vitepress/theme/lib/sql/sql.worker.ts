// Web Worker с sql.js: запросы выполняются вне основного потока, поэтому зависший запрос
// можно прервать, уничтожив воркер (см. client.ts). Создаётся лениво из engine.ts.
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import taskflow from './datasets/taskflow.sql?raw'
import shop from './datasets/shop.sql?raw'
import type { DatasetId } from './datasets'
import { createWorkerHandler, type WorkerEnvelope, type WorkerReply } from './worker-core'

const SCRIPTS: Record<DatasetId, string> = { taskflow, shop }

const { handle } = createWorkerHandler(
  () => initSqlJs({ locateFile: () => wasmUrl }),
  async (id) => SCRIPTS[id],
)

// Без lib "webworker" в tsconfig (он конфликтует с DOM): описываем только нужное.
const ctx = self as unknown as {
  onmessage: ((e: { data: WorkerEnvelope }) => void) | null
  postMessage(message: WorkerReply): void
}

ctx.onmessage = async ({ data: { id, req } }) => {
  try {
    ctx.postMessage({ id, ok: true, value: await handle(req) })
  } catch (e) {
    ctx.postMessage({ id, ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}
