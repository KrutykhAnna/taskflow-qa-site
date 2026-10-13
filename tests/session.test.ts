import { describe, it, expect } from 'vitest'
import { pickSession } from '../docs/.vitepress/theme/lib/session'
import type { Question } from '../docs/.vitepress/theme/lib/questions'

const card = (id: string, topic: string): Question => ({ id, topic, type: 'card', question: id, answerHtml: '' })
const bank = [
  card('a1', 'osnovy/x'), card('a2', 'osnovy/x'), card('a3', 'osnovy/y'),
  card('b1', 'api/z'), card('b2', 'api/z'),
]
const ids = (qs: Question[]) => qs.map((q) => q.id)

describe('pickSession', () => {
  it('all: берёт из всего банка, не больше size', () => {
    expect(pickSession(bank, { kind: 'all' }, 3)).toHaveLength(3)
  })

  it('если вопросов меньше size — отдаёт все', () => {
    expect(pickSession(bank, { kind: 'all' }, 10)).toHaveLength(5)
  })

  it('block: только вопросы блока', () => {
    expect(ids(pickSession(bank, { kind: 'block', block: 'osnovy' })).sort()).toEqual(['a1', 'a2', 'a3'])
  })

  it('topic: только вопросы темы', () => {
    expect(ids(pickSession(bank, { kind: 'topic', topic: 'osnovy/x' })).sort()).toEqual(['a1', 'a2'])
  })

  it('без повторов', () => {
    const s = ids(pickSession(bank, { kind: 'all' }))
    expect(new Set(s).size).toBe(s.length)
  })

  it('перемешивает детерминированно при заданном random', () => {
    const r = () => 0
    expect(ids(pickSession(bank, { kind: 'all' }, 10, r))).toEqual(ids(pickSession(bank, { kind: 'all' }, 10, r)))
    expect(ids(pickSession(bank, { kind: 'all' }, 10, r))).not.toEqual(ids(bank))
  })

  it('не мутирует исходный банк', () => {
    const copy = [...bank]
    pickSession(bank, { kind: 'all' }, 10, () => 0)
    expect(bank).toEqual(copy)
  })
})
