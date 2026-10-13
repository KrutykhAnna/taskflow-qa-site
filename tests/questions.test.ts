import { describe, it, expect } from 'vitest'
import { parseTopicFile, assertUniqueIds, type Question } from '../docs/.vitepress/theme/lib/questions'

const render = (md: string) => `<p>${md}</p>`
const T = 'osnovy/tehniki-test-dizayna'

describe('parseTopicFile', () => {
  it('парсит card и рендерит ответ', () => {
    const [q] = parseTopicFile([{ id: 'a', type: 'card', question: 'Q?', answer: 'A' }], T, render)
    expect(q).toEqual({ id: 'a', topic: T, type: 'card', question: 'Q?', answerHtml: '<p>A</p>' })
  })

  it('парсит quiz', () => {
    const [q] = parseTopicFile(
      [{ id: 'b', type: 'quiz', question: 'Q?', options: ['x', 'y'], correct: 1, explanation: 'E' }],
      T,
      render,
    )
    expect(q).toEqual({
      id: 'b', topic: T, type: 'quiz', question: 'Q?',
      options: ['x', 'y'], correct: 1, explanationHtml: '<p>E</p>',
    })
  })

  it('пустой файл — пустой список', () => {
    expect(parseTopicFile(null, T, render)).toEqual([])
  })

  it('не массив — ошибка с темой', () => {
    expect(() => parseTopicFile({ id: 'a' }, T, render)).toThrow(T)
  })

  it('неизвестный type — ошибка с id', () => {
    expect(() => parseTopicFile([{ id: 'c', type: 'essay', question: 'Q' }], T, render)).toThrow(/вопрос c:/)
  })

  it('card без answer — ошибка', () => {
    expect(() => parseTopicFile([{ id: 'd', type: 'card', question: 'Q' }], T, render)).toThrow(/вопрос d:/)
  })

  it('quiz: correct вне диапазона — ошибка', () => {
    expect(() =>
      parseTopicFile([{ id: 'e', type: 'quiz', question: 'Q', options: ['x', 'y'], correct: 2, explanation: 'E' }], T, render),
    ).toThrow(/вопрос e:/)
  })

  it('quiz: меньше двух вариантов — ошибка', () => {
    expect(() =>
      parseTopicFile([{ id: 'f', type: 'quiz', question: 'Q', options: ['x'], correct: 0, explanation: 'E' }], T, render),
    ).toThrow(/вопрос f:/)
  })

  it('повторяющийся id — ошибка', () => {
    const q = { id: 'g', type: 'card', question: 'Q', answer: 'A' }
    expect(() => parseTopicFile([q, q], T, render)).toThrow(/вопрос g:/)
  })
})

describe('id: trim и ссылки', () => {
  it('обрезает пробелы в id', () => {
    const [q] = parseTopicFile([{ id: ' a ', type: 'card', question: 'Q', answer: 'A' }], T, render)
    expect(q.id).toBe('a')
  })

  it('дубликат после trim — ошибка', () => {
    expect(() =>
      parseTopicFile(
        [
          { id: 'a', type: 'card', question: 'Q', answer: 'A' },
          { id: ' a', type: 'card', question: 'Q', answer: 'A' },
        ],
        T,
        render,
      ),
    ).toThrow('id повторяется')
  })

  it('запрещает корневые ссылки в answer', () => {
    expect(() =>
      parseTopicFile([{ id: 'a', type: 'card', question: 'Q', answer: 'см. [x](/osnovy/)' }], T, render),
    ).toThrow('ссылки в ответах не нужны')
  })

  it('запрещает корневые ссылки в explanation', () => {
    expect(() =>
      parseTopicFile(
        [{ id: 'a', type: 'quiz', question: 'Q', options: ['x', 'y'], correct: 0, explanation: '[x](/a)' }],
        T,
        render,
      ),
    ).toThrow('ссылки в ответах не нужны')
  })
})

describe('assertUniqueIds', () => {
  const c = (id: string, topic: string): Question => ({ id, topic, type: 'card', question: id, answerHtml: '' })
  it('пропускает уникальные', () => {
    expect(() => assertUniqueIds([c('a', 't1'), c('b', 't2')])).not.toThrow()
  })
  it('бросает на дубликате между темами', () => {
    expect(() => assertUniqueIds([c('a', 't1'), c('a', 't2')])).toThrow('id a повторяется в t1 и t2')
  })
})
