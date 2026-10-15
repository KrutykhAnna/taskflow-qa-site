// Браузерная часть движка. Всё тяжёлое (sql.js, wasm, скрипты датасетов) грузится
// динамическим import() при первом обращении — только на страницах с SQL-компонентами
// и только в браузере (вызывать из onMounted или обработчиков, не при SSR).
import type { Database, SqlJsStatic } from 'sql.js'
import { openDatabase } from './engine-core'
import { DATASET_LOADERS, type DatasetId } from './datasets'

export { runSql, describeSchema, type RunResult, type SchemaTable } from './engine-core'

let sqlPromise: Promise<SqlJsStatic> | null = null

/** Одна инициализация sql.js на страницу. Wasm отдаётся с нашего сайта (без CDN). */
export function loadSqlJs(): Promise<SqlJsStatic> {
  if (typeof window === 'undefined') return Promise.reject(new Error('sql.js загружается только в браузере'))
  sqlPromise ??= Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm-browser.wasm?url')])
    .then(([mod, wasm]) => mod.default({ locateFile: () => wasm.default }))
    .catch((e) => {
      sqlPromise = null // дать шанс повторить, например после обрыва сети
      throw e
    })
  return sqlPromise
}

const scripts = new Map<DatasetId, Promise<string>>()

function datasetScript(id: DatasetId): Promise<string> {
  let p = scripts.get(id)
  if (!p) {
    p = DATASET_LOADERS[id]()
    p.catch(() => scripts.delete(id))
    scripts.set(id, p)
  }
  return p
}

/** Свежая база датасета: каждая проверка и каждый «Сбросить базу» — с чистого листа. */
export async function openDataset(id: DatasetId): Promise<Database> {
  const [SQL, script] = await Promise.all([loadSqlJs(), datasetScript(id)])
  return openDatabase(SQL, script)
}

/** Текст ошибки загрузки для пользователя. */
export function loadErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return `Не удалось загрузить SQL-движок: ${msg}. Обнови страницу; если не помогло — проверь, что браузер поддерживает WebAssembly.`
}
