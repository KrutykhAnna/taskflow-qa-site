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
    id: 'osnovy/komanda-i-roli',
    block: 'osnovy',
    num: 2,
    title: 'Команда и роли',
    link: '/osnovy/02-komanda-i-roli',
  },
  {
    id: 'osnovy/modeli-razrabotki',
    block: 'osnovy',
    num: 3,
    title: 'Модели разработки',
    link: '/osnovy/03-modeli-razrabotki',
  },
  {
    id: 'osnovy/sdlc-i-stlc',
    block: 'osnovy',
    num: 4,
    title: 'SDLC и STLC',
    link: '/osnovy/04-sdlc-i-stlc',
  },
  {
    id: 'osnovy/vidy-testirovaniya',
    block: 'osnovy',
    num: 5,
    title: 'Виды тестирования',
    link: '/osnovy/05-vidy-testirovaniya',
  },
  {
    id: 'osnovy/testovaya-dokumentaciya',
    block: 'osnovy',
    num: 6,
    title: 'Тестовая документация',
    link: '/osnovy/06-testovaya-dokumentaciya',
  },
  {
    id: 'osnovy/tehniki-test-dizayna',
    block: 'osnovy',
    num: 7,
    title: 'Техники тест-дизайна',
    link: '/osnovy/07-tehniki-test-dizayna',
  },
  {
    id: 'osnovy/bag-report',
    block: 'osnovy',
    num: 8,
    title: 'Баг-репорт',
    link: '/osnovy/08-bag-report',
  },
  {
    id: 'osnovy/ocenka-zadach',
    block: 'osnovy',
    num: 9,
    title: 'Оценка задач',
    link: '/osnovy/09-ocenka-zadach',
  },
  {
    id: 'osnovy/testovye-okruzheniya',
    block: 'osnovy',
    num: 10,
    title: 'Тестовые окружения',
    link: '/osnovy/10-testovye-okruzheniya',
  },
]

export const topicById = (id: string) => TOPICS.find((t) => t.id === id)
