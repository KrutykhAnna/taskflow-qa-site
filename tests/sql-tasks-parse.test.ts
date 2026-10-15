import { describe, it, expect } from 'vitest'
import { assertUniqueSqlIds, parseSqlTaskFile, stripSqlNoise } from '../docs/.vitepress/theme/lib/sql/tasks'

const render = (md: string) => `<p>${md}</p>`
const base = {
  id: 'sel-01', topic: 'select', level: 'junior', dataset: 'taskflow', kind: 'select',
  title: 'Т', text: 'Условие', solution: 'SELECT 1', hint: 'Подсказка',
}
const parse = (over: Record<string, unknown>, topic = 'select') => parseSqlTaskFile([{ ...base, ...over }], topic, render)

describe('parseSqlTaskFile', () => {
  it('парсит задачу и рендерит markdown', () => {
    expect(parse({})[0]).toEqual({
      id: 'sel-01', topic: 'select', num: 1, level: 'junior', dataset: 'taskflow', kind: 'select',
      title: 'Т', textHtml: '<p>Условие</p>', solution: 'SELECT 1', check: null,
      ordered: false, expectEmpty: false, hintHtml: '<p>Подсказка</p>',
    })
  })
  it('num — порядковый номер в файле', () => {
    const tasks = parseSqlTaskFile([base, { ...base, id: 'sel-02' }], 'select', render)
    expect(tasks.map((t) => t.num)).toEqual([1, 2])
  })
  it('пустой файл — пустой список', () => {
    expect(parseSqlTaskFile(null, 'select', render)).toEqual([])
  })
  it('неизвестная тема — ошибка', () => {
    expect(() => parseSqlTaskFile([], 'nope', render)).toThrow(/SQL_TOPICS/)
  })
  it('не список — ошибка', () => {
    expect(() => parseSqlTaskFile({}, 'select', render)).toThrow(/списком/)
  })
  it.each([
    [{ id: 'agg-01' }, /sel-01/],
    [{ id: 'sel-1' }, /sel-01/],
    [{ topic: 'join' }, /topic/],
    [{ level: 'senior' }, /level/],
    [{ dataset: 'pg' }, /dataset/],
    [{ kind: 'ddl' }, /kind/],
    [{ text: ' ' }, /нет text/],
    [{ hint: undefined }, /нет hint/],
    [{ check: 'SELECT 1' }, /check нужен только для dml/],
    [{ kind: 'dml' }, /нужен check/],
    [{ ordered: 'yes' }, /ordered/],
    [{ ordered: true }, /ORDER BY/],
    [{ ordered: true, solution: "SELECT 'order by' -- order by" }, /ORDER BY/],
    [{ expectEmpty: 1 }, /expectEmpty/],
    [{ answer: 'x' }, /неизвестное поле answer/],
  ])('ошибка схемы %o', (over, re) => {
    expect(() => parse(over)).toThrow(re)
  })
  it('ordered с ORDER BY — ок', () => {
    expect(parse({ ordered: true, solution: 'SELECT 1 ORDER  BY 1' })[0].ordered).toBe(true)
  })
  it('dml: ordered проверяется по check', () => {
    const t = parse({ id: 'dml-01', topic: 'dml', kind: 'dml', solution: 'DELETE FROM t', check: 'SELECT * FROM t ORDER BY id', ordered: true }, 'dml')[0]
    expect(t).toMatchObject({ check: 'SELECT * FROM t ORDER BY id', ordered: true })
  })
  it('повтор id в файле — ошибка', () => {
    expect(() => parseSqlTaskFile([base, base], 'select', render)).toThrow(/повторяется/)
  })
})

describe('assertUniqueSqlIds', () => {
  it('повтор между темами — ошибка', () => {
    const [a] = parse({})
    expect(() => assertUniqueSqlIds([a, { ...a, topic: 'join' }])).toThrow(/sel-01 повторяется/)
  })
})

describe('stripSqlNoise', () => {
  it('убирает комментарии и строки', () => {
    expect(stripSqlNoise("SELECT 'a -- b' /* x */ -- y\nFROM t")).not.toMatch(/a -- b|x|y/)
  })
})
