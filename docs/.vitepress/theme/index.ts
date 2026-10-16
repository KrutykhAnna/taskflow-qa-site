import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import CourseBlocks from './components/CourseBlocks.vue'
import InterviewTrainer from './components/InterviewTrainer.vue'
import LessonTabs from './components/LessonTabs.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('CourseBlocks', CourseBlocks)
    app.component('InterviewTrainer', InterviewTrainer)
    app.component('LessonTabs', LessonTabs)
  },
} satisfies Theme
