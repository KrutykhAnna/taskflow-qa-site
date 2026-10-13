<script setup lang="ts">
import { ref } from 'vue'
import { withBase } from 'vitepress'
import type { CardQuestion } from '../lib/questions'
import { topicById } from '../lib/topics'

const props = defineProps<{ q: CardQuestion; showTopic?: boolean; selfCheck?: boolean }>()
const emit = defineEmits<{ answered: [known: boolean] }>()
const open = ref(false)
const verdict = ref<boolean | null>(null)
const topic = topicById(props.q.topic)

function mark(known: boolean) {
  if (verdict.value !== null) return
  verdict.value = known
  emit('answered', known)
}
</script>

<template>
  <div class="tq">
    <div class="tq-badge">Открытый вопрос</div>
    <p class="tq-question">{{ q.question }}</p>
    <button v-if="!open" class="tq-btn" @click="open = true">Показать ответ</button>
    <template v-else>
      <div class="tq-answer vp-doc" v-html="q.answerHtml" />
      <p v-if="showTopic && topic" class="tq-link">
        Тема: <a :href="withBase(topic.link)">{{ topic.title }}</a>
      </p>
      <div v-if="selfCheck" class="tq-actions">
        <button class="tq-btn" :class="{ on: verdict === true }" :disabled="verdict !== null" @click="mark(true)">Знал(а)</button>
        <button class="tq-btn" :class="{ on: verdict === false }" :disabled="verdict !== null" @click="mark(false)">Не знал(а)</button>
      </div>
    </template>
  </div>
</template>
