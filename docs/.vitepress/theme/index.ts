import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import InterviewTrainer from './components/InterviewTrainer.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('InterviewTrainer', InterviewTrainer)
  },
} satisfies Theme
