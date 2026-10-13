export type CardQuestion = {
  id: string
  topic: string
  type: 'card'
  question: string
  answerHtml: string
}

export type QuizQuestion = {
  id: string
  topic: string
  type: 'quiz'
  question: string
  options: string[]
  correct: number
  explanationHtml: string
}

export type Question = CardQuestion | QuizQuestion

const ROOT_LINK = /\]\(\//

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

export function parseTopicFile(
  raw: unknown,
  topic: string,
  render: (md: string) => string,
): Question[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) throw new Error(`[${topic}] файл вопросов должен быть списком`)

  const seen = new Set<string>()
  return raw.map((item, index) => {
    const r = (item ?? {}) as Record<string, unknown>
    const where = `[${topic}] вопрос ${isText(r.id) ? r.id : `#${index}`}`
    const fail = (msg: string): never => {
      throw new Error(`${where}: ${msg}`)
    }

    if (!isText(r.id)) fail('нет id')
    const id = (r.id as string).trim()
    if (seen.has(id)) fail('id повторяется')
    seen.add(id)
    if (!isText(r.question)) fail('нет question')
    const question = r.question as string
    for (const field of ['answer', 'explanation']) {
      const v = r[field]
      if (typeof v === 'string' && ROOT_LINK.test(v)) {
        fail('ссылки в ответах не нужны — тренажёр сам показывает ссылку на тему')
      }
    }

    if (r.type === 'card') {
      if (!isText(r.answer)) fail('нет answer')
      return { id, topic, type: 'card', question, answerHtml: render(r.answer as string) }
    }

    if (r.type === 'quiz') {
      const options = r.options
      if (!Array.isArray(options) || options.length < 2 || !options.every(isText)) {
        fail('options — минимум 2 непустые строки')
      }
      const opts = options as string[]
      if (!Number.isInteger(r.correct) || (r.correct as number) < 0 || (r.correct as number) >= opts.length) {
        fail('correct — индекс варианта с нуля')
      }
      if (!isText(r.explanation)) fail('нет explanation')
      return {
        id, topic, type: 'quiz', question,
        options: opts, correct: r.correct as number,
        explanationHtml: render(r.explanation as string),
      }
    }

    return fail(`неизвестный type "${String(r.type)}" (нужно card или quiz)`)
  })
}

export function assertUniqueIds(questions: Question[]): void {
  const firstTopic = new Map<string, string>()
  for (const q of questions) {
    const prev = firstTopic.get(q.id)
    if (prev !== undefined) throw new Error(`id ${q.id} повторяется в ${prev} и ${q.topic}`)
    firstTopic.set(q.id, q.topic)
  }
}
