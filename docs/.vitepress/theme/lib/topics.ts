export type Block = { id: string; title: string }
export type Topic = { id: string; block: string; title: string; link: string }

export const BLOCKS: Block[] = [
  { id: 'osnovy', title: 'Основы тестирования' },
  { id: 'api', title: 'Клиент-сервер и API' },
  { id: 'bd', title: 'Базы данных и SQL' },
  { id: 'web', title: 'Web' },
  { id: 'mobile', title: 'Мобильное через web' },
]

export const TOPICS: Topic[] = [
  {
    id: 'osnovy/tehniki-test-dizayna',
    block: 'osnovy',
    title: 'Техники тест-дизайна',
    link: '/osnovy/06-tehniki-test-dizayna',
  },
]

export const topicById = (id: string) => TOPICS.find((t) => t.id === id)
