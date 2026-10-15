// Ядро SQL-движка без привязки к браузеру: работает и в vitest (Node), и на странице.
// Загрузка sql.js и датасетов — в engine.ts (браузер) и в тестах (Node).
import type { Database, SqlJsStatic, Statement } from 'sql.js'
import type { Cell } from './compare'

/** Сколько строк результата держим в памяти. Больше не нужно ни для показа, ни для проверки. */
export const MAX_COLLECT = 10000

export type RunResult =
  /** Последний запрос, вернувший таблицу. rows обрезаны до лимита, total — сколько строк было всего. */
  | { kind: 'table'; columns: string[]; rows: Cell[][]; total: number; statements: number }
  /** Ни один запрос не вернул таблицу: сколько строк изменено всего. */
  | { kind: 'changes'; changes: number; statements: number }
  | { kind: 'error'; message: string; raw: string }

/** Новая база из SQL-скрипта датасета. */
export function openDatabase(SQL: SqlJsStatic, script: string): Database {
  const db = new SQL.Database()
  try {
    db.exec(script)
  } catch (e) {
    db.close()
    throw e
  }
  return db
}

const totalChanges = (db: Database) => Number(db.exec('SELECT total_changes()')[0].values[0][0])

/** Выполняет один или несколько запросов (через `;`). */
export function runSql(db: Database, sql: string, limit = MAX_COLLECT): RunResult {
  const before = totalChanges(db)
  let statements = 0
  let table: Extract<RunResult, { kind: 'table' }> | null = null
  let stmt: Statement | null = null
  try {
    for (stmt of db.iterateStatements(sql)) {
      statements++
      const columns = stmt.getColumnNames()
      if (columns.length === 0) {
        while (stmt.step()) { /* DDL/DML: строк не возвращает */ }
      } else {
        const rows: Cell[][] = []
        let total = 0
        while (stmt.step()) {
          if (total < limit) rows.push(stmt.get())
          total++
        }
        table = { kind: 'table', columns, rows, total, statements: 0 }
      }
      stmt.free()
      stmt = null
    }
  } catch (e) {
    stmt?.free()
    const raw = e instanceof Error ? e.message : String(e)
    return { kind: 'error', message: humanizeError(raw), raw }
  }
  if (statements === 0) {
    return { kind: 'error', message: 'Запрос пустой — напиши SQL в поле выше.', raw: '' }
  }
  if (table) return { ...table, statements }
  return { kind: 'changes', changes: totalChanges(db) - before, statements }
}

const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/no such table: (\S+)/, (m) => `Таблицы «${m[1]}» нет в базе. Проверь название — список таблиц в схеме базы.`],
  [/no such column: (\S+)/, (m) => `Столбца «${m[1]}» нет. Проверь название и таблицу — список столбцов в схеме базы.`],
  [/near "([^"]*)": syntax error/, (m) => `Синтаксическая ошибка рядом с «${m[1]}». Проверь запятые, кавычки и порядок частей запроса.`],
  [/incomplete input/, () => 'Запрос оборван: не хватает окончания — закрывающей скобки, кавычки или части запроса.'],
  [/unrecognized token: "?([^"]*)"?/, (m) => `Непонятный фрагмент «${m[1]}». Часто это незакрытая кавычка: строки пишутся в одинарных кавычках '...'.`],
  [/ambiguous column name: (\S+)/, (m) => `Столбец «${m[1]}» есть в нескольких таблицах — укажи, из какой: таблица.${m[1]}.`],
  [/UNIQUE constraint failed: (.+)/, (m) => `Нарушена уникальность: такое значение ${m[1]} уже есть в таблице.`],
  [/NOT NULL constraint failed: (.+)/, (m) => `Поле ${m[1]} обязательное — в него нельзя записать NULL.`],
  [/FOREIGN KEY constraint failed/, () => 'Нарушен внешний ключ: ссылка ведёт на несуществующую строку или на эту строку ещё ссылаются.'],
  [/CHECK constraint failed: (.+)/, (m) => `Значение не прошло проверку CHECK (${m[1]}).`],
  [/no such function: (\S+)/, (m) => `Функции «${m[1]}» нет в SQLite. Посмотри список отличий SQLite от PostgreSQL на странице задачника.`],
  [/misuse of aggregate/, () => 'Агрегатная функция использована не там: COUNT/SUM/AVG нельзя писать в WHERE — для условий по группам есть HAVING.'],
  [/(\d+) values for (\d+) columns/, (m) => `Значений ${m[1]}, а столбцов ${m[2]} — их число должно совпадать.`],
  [/SELECTs to the left and right of (UNION|INTERSECT|EXCEPT)[^ ]* do not have the same number of result columns/, (m) => `В частях ${m[1]} разное число столбцов — оно должно совпадать.`],
  [/a GROUP BY clause is required before HAVING/, () => 'HAVING без GROUP BY: сначала сгруппируй строки.'],
]

/** Переводит сообщение SQLite в понятный текст; оригинал остаётся в конце для поиска в интернете. */
export function humanizeError(raw: string): string {
  for (const [re, text] of RULES) {
    const m = raw.match(re)
    if (m) return `${text(m)} (SQLite: ${raw})`
  }
  return `Ошибка SQLite: ${raw}`
}

export type SchemaColumn = { name: string; type: string; pk: boolean; notNull: boolean; ref: string | null }
export type SchemaTable = { name: string; columns: SchemaColumn[] }

/** Таблицы и столбцы базы — для панели «Схема». */
export function describeSchema(db: Database): SchemaTable[] {
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")
  const names = (tables[0]?.values ?? []).map((r) => String(r[0]))
  return names.map((name) => {
    const q = name.replace(/'/g, "''")
    const refs = new Map<string, string>()
    for (const r of db.exec(`SELECT "from", "table", "to" FROM pragma_foreign_key_list('${q}')`)[0]?.values ?? []) {
      refs.set(String(r[0]), `${r[1]}.${r[2]}`)
    }
    const cols = db.exec(`SELECT name, type, pk, "notnull" FROM pragma_table_info('${q}') ORDER BY cid`)[0]?.values ?? []
    return {
      name,
      columns: cols.map((c) => ({
        name: String(c[0]),
        type: String(c[1]),
        pk: Number(c[2]) > 0,
        notNull: Number(c[3]) === 1,
        ref: refs.get(String(c[0])) ?? null,
      })),
    }
  })
}
