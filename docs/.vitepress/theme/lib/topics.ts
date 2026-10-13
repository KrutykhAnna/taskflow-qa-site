export type Block = { id: string; title: string }
export type Topic = { id: string; block: string; num: number; title: string; link: string }

export const BLOCKS: Block[] = [
  { id: 'osnovy', title: 'Основы тестирования' },
  { id: 'api', title: 'Клиент-сервер и API' },
  { id: 'bd', title: 'Базы данных и SQL' },
  { id: 'web', title: 'Web' },
  { id: 'mobile', title: 'Мобильное через web' },
]

export const TOPICS: Topic[] = [
  {
    id: 'osnovy/kto-takoy-testirovschik',
    block: 'osnovy',
    num: 1,
    title: 'Кто такой тестировщик',
    link: '/osnovy/01-kto-takoy-testirovschik',
  },
  {
    id: 'osnovy/tehniki-test-dizayna',
    block: 'osnovy',
    num: 7,
    title: 'Техники тест-дизайна',
    link: '/osnovy/07-tehniki-test-dizayna',
  },
]

export const topicById = (id: string) => TOPICS.find((t) => t.id === id)
