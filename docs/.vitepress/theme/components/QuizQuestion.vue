<script setup lang="ts">
import { ref } from 'vue'
import { withBase } from 'vitepress'
import type { QuizQuestion } from '../lib/questions'
import { topicById } from '../lib/topics'

const props = defineProps<{ q: QuizQuestion; showTopic?: boolean }>()
const emit = defineEmits<{ answered: [known: boolean] }>()
const chosen = ref<number | null>(null)
const topic = topicById(props.q.topic)

function choose(i: number) {
  if (chosen.value !== null) return
  chosen.value = i
  emit('answered', i === props.q.correct)
}
</script>

<template>
  <div class="tq">
    <div class="tq-badge">Тест</div>
    <p class="tq-question">{{ q.question }}</p>
    <ul class="tq-options">
      <li v-for="(opt, i) in q.options" :key="i">
        <button
          class="tq-option"
          :class="{
            correct: chosen !== null && i === q.correct,
            wrong: chosen === i && i !== q.correct,
          }"
          :disabled="chosen !== null"
          @click="choose(i)"
        >{{ opt }}</button>
      </li>
    </ul>
    <template v-if="chosen !== null">
      <p class="tq-verdict">{{ chosen === q.correct ? 'Верно!' : 'Неверно.' }}</p>
      <div class="tq-answer vp-doc" v-html="q.explanationHtml" />
      <p v-if="showTopic && topic" class="tq-link">
        Тема: <a :href="withBase(topic.link)">{{ topic.title }}</a>
      </p>
    </template>
  </div>
</template>
