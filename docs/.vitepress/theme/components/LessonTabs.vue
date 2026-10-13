<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

type Tab = 'theory' | 'task' | 'questions'
const tabs: { id: Tab; label: string }[] = [
  { id: 'theory', label: 'Теория' },
  { id: 'task', label: 'Задание' },
  { id: 'questions', label: 'Вопросы' },
]
const active = ref<Tab>('theory')
const panels: Partial<Record<Tab, HTMLElement>> = {}

function syncWithHash() {
  const id = decodeURIComponent(location.hash.slice(1))
  if (!id) return
  const target = document.getElementById(id)
  if (!target) return
  for (const t of tabs) {
    if (panels[t.id]?.contains(target)) {
      active.value = t.id
      requestAnimationFrame(() => target.scrollIntoView())
      return
    }
  }
}

onMounted(() => {
  syncWithHash()
  window.addEventListener('hashchange', syncWithHash)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', syncWithHash))
</script>

<template>
  <div class="lesson-tabs">
    <div class="lesson-tabs-bar" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        role="tab"
        :aria-selected="active === t.id"
        :class="{ active: active === t.id }"
        @click="active = t.id"
      >{{ t.label }}</button>
    </div>
    <div v-show="active === 'theory'" :ref="(el) => (panels.theory = el as HTMLElement)"><slot name="theory" /></div>
    <div v-show="active === 'task'" :ref="(el) => (panels.task = el as HTMLElement)"><slot name="task" /></div>
    <div v-show="active === 'questions'" :ref="(el) => (panels.questions = el as HTMLElement)"><slot name="questions" /></div>
  </div>
</template>
