import type { Question, QuizQuestion } from './questions'

export type SessionFilter =
  | { kind: 'all' }
  | { kind: 'block'; block: string }
  | { kind: 'topic'; topic: string }

function matches(q: Question, f: SessionFilter): boolean {
  if (f.kind === 'topic') return q.topic === f.topic
  if (f.kind === 'block') return q.topic.startsWith(`${f.block}/`)
  return true
}

export function pickSession(
  all: Question[],
  filter: SessionFilter,
  size = 10,
  random: () => number = Math.random,
): Question[] {
  const pool = all.filter((q) => matches(q, filter))
  // Fisher–Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, size)
}

export function shuffleOptions(
  q: QuizQuestion,
  random: () => number = Math.random,
): QuizQuestion {
  const order = q.options.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    correct: order.indexOf(q.correct),
  }
}
