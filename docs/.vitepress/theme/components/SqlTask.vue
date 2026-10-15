<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { data as allTasks } from '../../../sql-tasks/sql-tasks.data'
import { DATASETS } from '../lib/sql/datasets'
import { LEVELS, sqlTopicById } from '../lib/sql/tasks'

const props = defineProps<{ id: string }>()

const task = computed(() => allTasks.find((t) => t.id === props.id) ?? null)
const topic = computed(() => (task.value ? sqlTopicById(task.value.topic) : undefined))
const datasetLink = computed(() => (task.value ? withBase(`/bd/uchebnye-bazy#${task.value.dataset}`) : ''))
</script>

<template>
  <div v-if="!task" class="sql-box">
    <p class="sql-error" role="alert">Задача «{{ id }}» не найдена в docs/sql-tasks/*.yaml.</p>
  </div>
  <div v-else class="sql-box sql-task" :id="`sql-${task.id}`">
    <div class="sql-head">
      <span class="tq-badge">{{ LEVELS[task.level] }}</span>
      <span class="sql-head-title">Задача {{ task.num }}<template v-if="topic"> · {{ topic.title }}</template></span>
      <span class="sql-head-id">{{ task.id }}</span>
    </div>
    <p class="sql-task-title">{{ task.title }}</p>
    <div class="sql-task-text" v-html="task.textHtml" />
    <p class="sql-meta">
      База: <a :href="datasetLink">«{{ DATASETS[task.dataset].title }}»</a>.
      <template v-if="task.kind === 'dml'">Задача меняет данные: после своего запроса выполни проверочный (он в «Эталонном запросе») и сравни с ожидаемым результатом.</template>
      <template v-if="task.ordered">Порядок строк важен.</template>
    </p>

    <details class="custom-block details sql-spoiler">
      <summary>Подсказка</summary>
      <div v-html="task.hintHtml" />
    </details>
    <details class="custom-block details sql-spoiler">
      <summary>Эталонный запрос</summary>
      <p class="sql-meta">Сначала попробуй сам — правильных запросов обычно несколько, сравнивай результат, а не текст.</p>
      <pre class="sql-code"><code>{{ task.solution }}</code></pre>
      <template v-if="task.check">
        <p class="sql-meta">Проверочный запрос — выполни его после своего:</p>
        <pre class="sql-code"><code>{{ task.check }}</code></pre>
      </template>
    </details>
  </div>
</template>
