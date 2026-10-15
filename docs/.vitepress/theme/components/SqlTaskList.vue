<script setup lang="ts">
import { computed, ref } from 'vue'
import { data as allTasks } from '../../../sql-tasks/sql-tasks.data'
import { LEVELS, sqlTopicById, type Level } from '../lib/sql/tasks'
import SqlTask from './SqlTask.vue'

const props = defineProps<{ topic: string }>()

const tasks = computed(() => allTasks.filter((t) => t.topic === props.topic))
const levels = computed(() =>
  (Object.keys(LEVELS) as Level[])
    .map((id) => ({ id, title: LEVELS[id], count: tasks.value.filter((t) => t.level === id).length }))
    .filter((l) => l.count > 0),
)
const level = ref<Level | 'all'>('all')
</script>

<template>
  <div class="sql-task-list">
    <p v-if="!sqlTopicById(topic)" class="sql-error" role="alert">Неизвестная тема задач «{{ topic }}».</p>
    <p v-else-if="tasks.length === 0">Задач по этой теме пока нет.</p>
    <template v-else>
      <div class="tq-actions" role="group" aria-label="Фильтр по уровню">
        <button type="button" class="tq-btn" :class="{ on: level === 'all' }" :aria-pressed="level === 'all'" @click="level = 'all'">
          Все ({{ tasks.length }})
        </button>
        <button
          v-for="l in levels"
          :key="l.id"
          type="button"
          class="tq-btn"
          :class="{ on: level === l.id }"
          :aria-pressed="level === l.id"
          @click="level = l.id"
        >{{ l.title }} ({{ l.count }})</button>
      </div>
      <!-- v-show, а не фильтрация списка: при смене фильтра набранные запросы не теряются -->
      <SqlTask v-for="t in tasks" v-show="level === 'all' || t.level === level" :key="t.id" :id="t.id" />
    </template>
  </div>
</template>
