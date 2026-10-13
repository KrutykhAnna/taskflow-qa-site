import { describe, it, expect } from 'vitest'
import { parseTopicFile } from '../docs/.vitepress/theme/lib/questions'

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
