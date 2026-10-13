<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { data as bank } from '../../../questions/questions.data'
import type { Question } from '../lib/questions'
import { pickSession, shuffleOptions, type SessionFilter } from '../lib/session'
import { BLOCKS, TOPICS, topicById } from '../lib/topics'
import QuestionCard from './QuestionCard.vue'
import QuizQuestion from './QuizQuestion.vue'

const props = defineProps<{ topic?: string }>()

const fixed = computed(() =>
  props.topic ? bank.filter((q) => q.topic === props.topic) : null,
)
const blocksWithQuestions = BLOCKS.filter((b) => bank.some((q) => q.topic.startsWith(`${b.id}/`)))
const topicsWithQuestions = TOPICS.filter((t) => bank.some((q) => q.topic === t.id))

const session = ref<Question[] | null>(null)
const results = ref<Record<string, boolean>>({})

function start(filter: SessionFilter) {
  session.value = pickSession(bank, filter).map((q) => (q.type === 'quiz' ? shuffleOptions(q) : q))
  results.value = {}
}
function record(id: string, known: boolean) {
  results.value = { ...results.value, [id]: known }
}

const done = computed(() => session.value !== null && Object.keys(results.value).length === session.value.length)
const knownCount = computed(() => Object.values(results.value).filter(Boolean).length)
const toRepeat = computed(() =>
  (session.value ?? [])
    .filter((q) => results.value[q.id] === false)
    .map((q) => ({ q, topic: topicById(q.topic) })),
)
</script>

<template>
  <div class="trainer">
    <!-- Режим урока: все вопросы темы -->
    <template v-if="fixed">
      <p v-if="fixed.length === 0">Вопросов по этой теме пока нет.</p>
      <template v-for="q in fixed" :key="q.id">
        <QuestionCard v-if="q.type === 'card'" :q="q" />
        <QuizQuestion v-else :q="q" />
      </template>
    </template>

    <!-- Режим тренажёра: выбор -->
    <template v-else-if="session === null">
      <p>Выбери, что тренировать. В сессии — до 10 случайных вопросов.</p>
      <div class="tq-actions">
        <button class="tq-btn primary" @click="start({ kind: 'all' })">Вперемешку</button>
      </div>
      <h3>По блоку</h3>
      <div class="tq-actions">
        <button v-for="b in blocksWithQuestions" :key="b.id" class="tq-btn" @click="start({ kind: 'block', block: b.id })">{{ b.title }}</button>
      </div>
      <h3>По теме</h3>
      <div class="tq-actions">
        <button v-for="t in topicsWithQuestions" :key="t.id" class="tq-btn" @click="start({ kind: 'topic', topic: t.id })">{{ t.title }}</button>
      </div>
    </template>

    <!-- Сессия -->
    <template v-else>
      <p class="tq-progress">Отвечено {{ Object.keys(results).length }} из {{ session.length }}</p>
      <template v-for="q in session" :key="q.id">
        <QuestionCard v-if="q.type === 'card'" :q="q" show-topic self-check @answered="record(q.id, $event)" />
        <QuizQuestion v-else :q="q" show-topic @answered="record(q.id, $event)" />
      </template>

      <div v-if="done" class="tq tq-summary">
        <h3>Итог: {{ knownCount }} из {{ session.length }}</h3>
        <template v-if="toRepeat.length">
          <p>Стоит повторить:</p>
          <ul>
            <li v-for="item in toRepeat" :key="item.q.id">
              {{ item.q.question }}
              <template v-if="item.topic"> — <a :href="withBase(item.topic.link)">{{ item.topic.title }}</a></template>
            </li>
          </ul>
        </template>
        <p v-else>Всё знаешь — отлично!</p>
      </div>
      <div class="tq-actions">
        <button class="tq-btn" @click="session = null">Новая сессия</button>
      </div>
    </template>
  </div>
</template>
