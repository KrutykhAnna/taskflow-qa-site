import { defineConfig } from 'vitepress'
import { BLOCKS, TOPICS } from './theme/lib/topics'
import { withMermaid } from 'vitepress-plugin-mermaid'

const sidebar = BLOCKS.map((b, i) => {
  const topics = TOPICS.filter((t) => t.block === b.id).sort((x, y) => x.num - y.num)
  return {
    text: `${i + 1}. ${b.title}`,
    items: topics.length
      ? [{ text: 'Обзор блока', link: `/${b.id}/` }, ...topics.map((t) => ({ text: t.title, link: t.link }))]
      : [{ text: 'Скоро', link: `/${b.id}/` }],
  }
})

export default withMermaid(
  defineConfig({
    lang: 'ru-RU',
    // сайт публикуется на GitHub Pages по адресу /taskflow-qa-site/; локально — VITEPRESS_BASE=/
    base: process.env.VITEPRESS_BASE ?? '/taskflow-qa-site/',
    title: 'TaskFlow QA',
    description: 'Ручное тестирование на примере TaskFlow',
    cleanUrls: true,
    themeConfig: {
      nav: [
        { text: 'Курс', link: '/osnovy/' },
        { text: 'Тренажёр интервью', link: '/trainer' },
      ],
      sidebar,
      search: {
        provider: 'local',
        options: {
          translations: {
            button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск' },
            modal: {
              noResultsText: 'Ничего не найдено',
              resetButtonTitle: 'Сбросить',
              footer: { selectText: 'выбрать', navigateText: 'навигация', closeText: 'закрыть' },
            },
          },
        },
      },
      outline: { label: 'На этой странице', level: [2, 3] },
      docFooter: { prev: 'Назад', next: 'Дальше' },
      darkModeSwitchLabel: 'Тема',
      sidebarMenuLabel: 'Меню',
      returnToTopLabel: 'Наверх',
    },
  }),
)
