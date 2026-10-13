import { describe, it, expect } from 'vitest'
import { pickSession, shuffleOptions } from '../docs/.vitepress/theme/lib/session'
import type { Question, QuizQuestion } from '../docs/.vitepress/theme/lib/questions'

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

describe('shuffleOptions', () => {
  const quiz: QuizQuestion = {
    id: 'q', topic: 'osnovy/x', type: 'quiz', question: 'Q',
    options: ['a', 'b', 'c', 'd'], correct: 1, explanationHtml: '<p>E</p>',
  }
  const seq = (...vals: number[]) => { let i = 0; return () => vals[i++ % vals.length] }

  it('перестановка тех же вариантов, correct указывает на тот же текст', () => {
    for (const r of [seq(0), seq(0.99), seq(0.3, 0.6, 0.1), Math.random]) {
      const s = shuffleOptions(quiz, r)
      expect([...s.options].sort()).toEqual(['a', 'b', 'c', 'd'])
      expect(s.options[s.correct]).toBe('b')
      expect(s.explanationHtml).toBe(quiz.explanationHtml)
    }
  })

  it('действительно меняет порядок', () => {
    expect(shuffleOptions(quiz, seq(0)).options).not.toEqual(quiz.options)
  })

  it('не мутирует исходный вопрос', () => {
    shuffleOptions(quiz, seq(0))
    expect(quiz.options).toEqual(['a', 'b', 'c', 'd'])
    expect(quiz.correct).toBe(1)
  })
})
