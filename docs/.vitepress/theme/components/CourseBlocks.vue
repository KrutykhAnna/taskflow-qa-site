<script setup lang="ts">
import { withBase } from 'vitepress'
import { BLOCKS, TOPICS } from '../lib/topics'

function lessons(n: number) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} урок`
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} урока`
  return `${n} уроков`
}

const blocks = BLOCKS.map((b, i) => {
  const count = TOPICS.filter((t) => t.block === b.id).length
  const meta =
    b.status === 'soon' ? 'скоро' : b.status === 'progress' ? `${lessons(count)} · блок пополняется` : lessons(count)
  return { ...b, num: i + 1, meta }
})
</script>

<template>
  <section class="course-blocks">
    <h2>Программа курса</h2>
    <div class="course-blocks-grid">
      <template v-for="b in blocks" :key="b.id">
        <div v-if="b.status === 'soon'" class="course-block soon">
          <div class="course-block-num">Блок {{ b.num }}</div>
          <div class="course-block-title">{{ b.title }}</div>
          <div class="course-block-meta">{{ b.meta }}</div>
        </div>
        <a v-else class="course-block" :href="withBase(`/${b.id}/`)">
          <div class="course-block-num">Блок {{ b.num }}</div>
          <div class="course-block-title">{{ b.title }}</div>
          <div class="course-block-meta">{{ b.meta }}</div>
        </a>
      </template>
    </div>
  </section>
</template>
