import { defineAsyncComponent } from 'vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import InterviewTrainer from './components/InterviewTrainer.vue'
import LessonTabs from './components/LessonTabs.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('InterviewTrainer', InterviewTrainer)
    app.component('LessonTabs', LessonTabs)
    // SQL-компоненты — асинхронные: их код и задачи грузятся отдельным чанком только на страницах,
    // где они есть; sql.js, wasm и датасеты — ещё позже, при первом запуске (lib/sql/engine.ts).
    app.component('SqlPlayground', defineAsyncComponent(() => import('./components/SqlPlayground.vue')))
    app.component('SqlTask', defineAsyncComponent(() => import('./components/SqlTask.vue')))
    app.component('SqlTaskList', defineAsyncComponent(() => import('./components/SqlTaskList.vue')))
  },
} satisfies Theme
