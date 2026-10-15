// Задачи по SQL: формат YAML (docs/sql-tasks/<topic>.yaml) и его проверка при сборке.
// Выполнение эталонов на датасетах проверяют тесты (tests/sql-tasks.test.ts).
import { isDatasetId, type DatasetId } from './datasets'

export type SqlTopic = { id: string; prefix: string; title: string }

/** Темы задачника. Порядок — порядок на странице задачника. */
export const SQL_TOPICS: SqlTopic[] = [
  { id: 'select', prefix: 'sel', title: 'SELECT: выборка, фильтры, сортировка' },
  { id: 'aggregate', prefix: 'agg', title: 'Агрегаты, GROUP BY, HAVING' },
  { id: 'join', prefix: 'join', title: 'JOIN: соединения таблиц' },
  { id: 'subquery', prefix: 'sub', title: 'Подзапросы, EXISTS, CASE' },
  { id: 'dml', prefix: 'dml', title: 'INSERT, UPDATE, DELETE' },
]

export const sqlTopicById = (id: string) => SQL_TOPICS.find((t) => t.id === id)

export const LEVELS = {
  junior: 'Джун',
  middle: 'Мидл',
  interview: 'Собеседование',
} as const
export type Level = keyof typeof LEVELS

export type SqlTask = {
  id: string
  topic: string
  /** Номер задачи внутри темы (с 1, по порядку в файле). */
  num: number
  level: Level
  dataset: DatasetId
  kind: 'select' | 'dml'
  title: string
  textHtml: string
  solution: string
  check: string | null
  ordered: boolean
  expectEmpty: boolean
  hintHtml: string
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/** SQL без комментариев и строковых литералов — чтобы искать ключевые слова. */
export function stripSqlNoise(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

const KNOWN = new Set(['id', 'topic', 'level', 'dataset', 'kind', 'title', 'text', 'solution', 'check', 'ordered', 'expectEmpty', 'hint'])

export function parseSqlTaskFile(raw: unknown, topic: string, render: (md: string) => string): SqlTask[] {
  const t = sqlTopicById(topic)
  if (!t) throw new Error(`[sql-tasks/${topic}] тема не описана в SQL_TOPICS (lib/sql/tasks.ts)`)
  if (raw == null) return []
  if (!Array.isArray(raw)) throw new Error(`[sql-tasks/${topic}] файл задач должен быть списком`)

  const seen = new Set<string>()
  return raw.map((item, index) => {
    const r = (item ?? {}) as Record<string, unknown>
    const where = `[sql-tasks/${topic}] задача ${isText(r.id) ? r.id : `#${index}`}`
    const fail = (msg: string): never => {
      throw new Error(`${where}: ${msg}`)
    }

    for (const key of Object.keys(r)) if (!KNOWN.has(key)) fail(`неизвестное поле ${key}`)
    if (!isText(r.id)) fail('нет id')
    const id = (r.id as string).trim()
    if (!new RegExp(`^${t.prefix}-\\d{2,}$`).test(id)) fail(`id должен быть вида ${t.prefix}-01`)
    if (seen.has(id)) fail('id повторяется')
    seen.add(id)
    if (r.topic !== topic) fail(`topic должен совпадать с именем файла (${topic})`)
    if (typeof r.level !== 'string' || !(r.level in LEVELS)) fail('level — junior, middle или interview')
    if (!isDatasetId(r.dataset)) fail('dataset — taskflow или shop')
    if (r.kind !== 'select' && r.kind !== 'dml') fail('kind — select или dml')
    for (const field of ['title', 'text', 'solution', 'hint']) if (!isText(r[field])) fail(`нет ${field}`)
    if (r.kind === 'dml' && !isText(r.check)) fail('для dml нужен check — запрос, которым сравнивают данные')
    if (r.kind === 'select' && r.check !== undefined) fail('check нужен только для dml')
    for (const field of ['ordered', 'expectEmpty']) {
      if (r[field] !== undefined && typeof r[field] !== 'boolean') fail(`${field} — true или false`)
    }
    const ordered = r.ordered === true
    // Для dml порядок сравнивается по результату check, для select — по самому эталону.
    const orderedBy = r.kind === 'dml' ? (r.check as string) : (r.solution as string)
    if (ordered && !/\border\s+by\b/i.test(stripSqlNoise(orderedBy))) fail('ordered: true только если в запросе есть ORDER BY')

    return {
      id,
      topic,
      num: index + 1,
      level: r.level as Level,
      dataset: r.dataset as DatasetId,
      kind: r.kind as 'select' | 'dml',
      title: (r.title as string).trim(),
      textHtml: render(r.text as string),
      solution: (r.solution as string).trim(),
      check: r.kind === 'dml' ? (r.check as string).trim() : null,
      ordered,
      expectEmpty: r.expectEmpty === true,
      hintHtml: render(r.hint as string),
    }
  })
}

export function assertUniqueSqlIds(tasks: SqlTask[]): void {
  const first = new Map<string, string>()
  for (const t of tasks) {
    const prev = first.get(t.id)
    if (prev !== undefined) throw new Error(`id ${t.id} повторяется в ${prev} и ${t.topic}`)
    first.set(t.id, t.topic)
  }
}
