import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { openDatabase } from '../docs/.vitepress/theme/lib/sql/engine-core'
import { DATASET_IDS } from '../docs/.vitepress/theme/lib/sql/datasets'

const dir = path.resolve(__dirname, '../docs/.vitepress/theme/lib/sql/datasets')
const script = (id: string) => fs.readFileSync(path.join(dir, `${id}.sql`), 'utf8')

let SQL: SqlJsStatic
const dbs: Record<string, Database> = {}
beforeAll(async () => {
  SQL = await initSqlJs()
  for (const id of DATASET_IDS) dbs[id] = openDatabase(SQL, script(id))
})

/** Значения первого столбца запроса. */
const col = (db: Database, sql: string) => (db.exec(sql)[0]?.values ?? []).map((r) => r[0])
const one = (db: Database, sql: string) => col(db, sql)[0]

describe.each(DATASET_IDS)('датасет %s: общее', (id) => {
  it('начинается с комментария-описания и ловушек', () => {
    const head = script(id).split('\n').slice(0, 5).join('\n')
    expect(head).toMatch(/^--/)
    expect(script(id)).toMatch(/Ловушки/i)
  })
  it('детерминированный: нет random() и «текущего времени»', () => {
    expect(script(id)).not.toMatch(/random\s*\(|'now'|current_(date|time|timestamp)/i)
  })
  it('внешние ключи включены и целостны', () => {
    expect(one(dbs[id], 'PRAGMA foreign_keys')).toBe(1)
    expect(dbs[id].exec('PRAGMA foreign_key_check')).toEqual([])
  })
  it('загружается повторно с тем же результатом', () => {
    const again = openDatabase(SQL, script(id))
    const dump = (db: Database) =>
      col(db, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map(
        (t) => JSON.stringify(db.exec(`SELECT * FROM "${t}" ORDER BY rowid`)),
      )
    expect(dump(again)).toEqual(dump(dbs[id]))
  })
})

describe('датасет taskflow', () => {
  const db = () => dbs.taskflow
  const count = (t: string, where = '1') => Number(one(db(), `SELECT COUNT(*) FROM ${t} WHERE ${where}`))

  it('таблицы как в схеме TaskFlow', () => {
    expect(col(db(), "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).toEqual([
      'audit_log', 'comments', 'labels', 'project_members', 'projects', 'task_labels', 'tasks', 'users',
    ])
  })
  it('объём', () => {
    expect(count('users')).toBeGreaterThanOrEqual(22)
    expect(count('projects')).toBeGreaterThanOrEqual(7)
    expect(count('tasks')).toBeGreaterThanOrEqual(75)
    expect(count('comments')).toBeGreaterThanOrEqual(55)
    expect(count('labels')).toBeGreaterThanOrEqual(9)
    expect(count('task_labels')).toBeGreaterThanOrEqual(40)
    expect(count('audit_log')).toBeGreaterThanOrEqual(35)
  })
  it('enum-значения из спецификации, все встречаются', () => {
    expect(col(db(), 'SELECT DISTINCT role FROM users ORDER BY 1')).toEqual(['ADMIN', 'USER'])
    expect(col(db(), 'SELECT DISTINCT status FROM projects ORDER BY 1')).toEqual(['ACTIVE', 'ARCHIVED'])
    expect(col(db(), 'SELECT DISTINCT role FROM project_members ORDER BY 1')).toEqual(['ADMIN', 'MANAGER', 'OWNER', 'VIEWER'])
    expect(col(db(), 'SELECT DISTINCT status FROM tasks ORDER BY 1')).toEqual(['DONE', 'IN_PROGRESS', 'TODO'])
    expect(col(db(), 'SELECT DISTINCT priority FROM tasks ORDER BY 1')).toEqual(['HIGH', 'LOW', 'MEDIUM'])
  })
  it('инварианты API: 1–3 активных ADMIN, у владельца проекта есть строка OWNER', () => {
    const admins = count('users', "role = 'ADMIN' AND is_active = 1 AND deleted_at IS NULL")
    expect(admins).toBeGreaterThanOrEqual(1)
    expect(admins).toBeLessThanOrEqual(3)
    expect(count('projects p', "NOT EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = p.owner_id AND m.role = 'OWNER')")).toBe(0)
  })
  it('ловушки: NULL, мягкое удаление, неактивные', () => {
    expect(count('tasks', 'assignee_id IS NULL')).toBeGreaterThanOrEqual(5)
    for (const t of ['users', 'projects', 'tasks', 'comments']) expect(count(t, 'deleted_at IS NOT NULL')).toBeGreaterThan(0)
    expect(count('users', 'is_active = 0')).toBeGreaterThan(0)
    expect(count('tasks', 'description IS NULL')).toBeGreaterThan(0)
    expect(count('tasks', "description = ''")).toBeGreaterThan(0)
    expect(count('audit_log', 'user_id IS NULL')).toBeGreaterThan(0)
  })
  it('ловушки: однофамильцы, email в разном регистре, повторная регистрация после удаления', () => {
    expect(count('(SELECT last_name FROM users GROUP BY last_name HAVING COUNT(*) > 1)')).toBeGreaterThan(0)
    expect(count('(SELECT lower(email) FROM users WHERE deleted_at IS NULL GROUP BY lower(email) HAVING COUNT(DISTINCT email) > 1)')).toBeGreaterThan(0)
    expect(count('(SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1)')).toBeGreaterThan(0)
  })
  it('ловушки для LEFT JOIN: проект без задач, метка без задач, пользователь без проектов', () => {
    expect(count('projects p', 'NOT EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = p.id)')).toBeGreaterThan(0)
    expect(count('labels l', 'NOT EXISTS (SELECT 1 FROM task_labels x WHERE x.label_id = l.id)')).toBeGreaterThan(0)
    expect(count('users u', 'NOT EXISTS (SELECT 1 FROM project_members m WHERE m.user_id = u.id)')).toBeGreaterThan(0)
    expect(count('tasks t', 'NOT EXISTS (SELECT 1 FROM comments c WHERE c.task_id = t.id)')).toBeGreaterThan(0)
  })
  it('audit_log: каждое *.delete указывает на удалённую сущность, время совпадает с deleted_at', () => {
    const rows = db().exec("SELECT action, entity_type, entity_id, created_at FROM audit_log WHERE action LIKE '%.delete'")[0].values
    expect(rows.length).toBeGreaterThan(0)
    const table: Record<string, string> = { task: 'tasks', comment: 'comments', user: 'users', project: 'projects' }
    for (const [action, type, id, at] of rows) {
      if (type === 'label') continue // метки удаляются физически
      expect(table[String(type)], `${action}: неизвестный entity_type ${type}`).toBeDefined()
      const deletedAt = one(db(), `SELECT deleted_at FROM ${table[String(type)]} WHERE id = ${Number(id)}`)
      expect(deletedAt, `${action} ${type} ${id}`).toBe(at)
    }
  })
  it('audit_log: id растут вместе со временем', () => {
    expect(count('audit_log a', 'EXISTS (SELECT 1 FROM audit_log b WHERE b.id > a.id AND b.created_at < a.created_at)')).toBe(0)
  })
  it('даты — ISO-текст UTC', () => {
    expect(count('tasks', "created_at NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'")).toBe(0)
  })
})

describe('датасет shop', () => {
  const db = () => dbs.shop
  const count = (t: string, where = '1') => Number(one(db(), `SELECT COUNT(*) FROM ${t} WHERE ${where}`))

  it('таблицы', () => {
    expect(col(db(), "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).toEqual([
      'categories', 'customers', 'departments', 'employees', 'order_items', 'orders', 'products',
    ])
  })
  it('ловушки: клиенты без заказов, заказы без позиций, товары без категории', () => {
    expect(count('customers c', 'NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)')).toBeGreaterThan(0)
    expect(count('orders o', 'NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id)')).toBeGreaterThan(0)
    expect(count('products', 'category_id IS NULL')).toBeGreaterThan(0)
  })
  it('ловушки: одинаковые зарплаты на вершине, сотрудник без руководителя, отдел без сотрудников', () => {
    expect(one(db(), 'SELECT COUNT(*) FROM employees WHERE salary = (SELECT MAX(salary) FROM employees)')).toBeGreaterThan(1)
    expect(count('employees', 'manager_id IS NULL')).toBeGreaterThan(0)
    expect(count('employees', 'department_id IS NULL')).toBeGreaterThan(0)
    expect(count('departments d', 'NOT EXISTS (SELECT 1 FROM employees e WHERE e.department_id = d.id)')).toBeGreaterThan(0)
  })
  it('заказы за два года', () => {
    expect(col(db(), "SELECT DISTINCT substr(order_date, 1, 4) FROM orders ORDER BY 1")).toEqual(['2024', '2025'])
  })
})
