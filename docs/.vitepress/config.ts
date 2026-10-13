import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    lang: 'ru-RU',
    title: 'TaskFlow QA',
    description: 'Ручное тестирование на примере TaskFlow',
    cleanUrls: true,
    themeConfig: {
      nav: [
        { text: 'Курс', link: '/osnovy/' },
        { text: 'Тренажёр интервью', link: '/trainer' },
      ],
      sidebar: [
        {
          text: '1. Основы тестирования',
          items: [
            { text: 'Обзор блока', link: '/osnovy/' },
            { text: 'Техники тест-дизайна', link: '/osnovy/06-tehniki-test-dizayna' },
          ],
        },
        { text: '2. Клиент-сервер и API', items: [{ text: 'Скоро', link: '/api/' }] },
        { text: '3. Базы данных и SQL', items: [{ text: 'Скоро', link: '/bd/' }] },
        { text: '4. Web', items: [{ text: 'Скоро', link: '/web/' }] },
        { text: '5. Мобильное через web', items: [{ text: 'Скоро', link: '/mobile/' }] },
      ],
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
