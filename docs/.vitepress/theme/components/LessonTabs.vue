<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

type Tab = 'theory' | 'task' | 'questions'
const tabs: { id: Tab; label: string }[] = [
  { id: 'theory', label: 'Теория' },
  { id: 'task', label: 'Задание' },
  { id: 'questions', label: 'Вопросы' },
]
const active = ref<Tab>('theory')
const root = ref<HTMLElement>()
const panels: Partial<Record<Tab, HTMLElement>> = {}

function syncWithHash() {
  const id = decodeURIComponent(location.hash.slice(1))
  if (!id) return
  const target = document.getElementById(id)
  if (!target) return
  for (const t of tabs) {
    if (panels[t.id]?.contains(target)) {
      active.value = t.id
      syncOutline()
      // Роутер VitePress сам скроллит в rAF, пока вкладка ещё скрыта (координаты неверные).
      // Ждём отрисовку вкладки и его скролл, затем скроллим сами (scroll-margin-top в style.css).
      nextTick(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => target.scrollIntoView()))
      })
      return
    }
  }
}

// Высота закреплённых сверху панелей VitePress: шапка и, на узких экранах, локальная панель.
function stickyOffset(): number {
  let offset = 0
  for (const sel of ['.VPNav', '.VPLocalNav']) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el && getComputedStyle(el).position !== 'static') offset += el.getBoundingClientRect().height
  }
  return offset
}

// Оглавление «На этой странице» общее на всю страницу: прячем пункты скрытых вкладок.
function syncOutline() {
  nextTick(() => {
    const panel = panels[active.value]
    if (!panel) return
    for (const link of document.querySelectorAll<HTMLAnchorElement>('.VPDocAsideOutline a.outline-link, .VPLocalNavOutlineDropdown a.outline-link')) {
      const id = decodeURIComponent(link.hash.slice(1))
      const target = id ? document.getElementById(id) : null
      const li = link.closest('li')
      if (li) li.style.display = target && !panel.contains(target) ? 'none' : ''
    }
  })
}

function selectTab(id: Tab) {
  active.value = id
  syncOutline()
  // Сбрасываем hash, чтобы повторный клик по той же ссылке оглавления снова переключал вкладку.
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search)
  // Если панель вкладок уже прокручена выше экрана — новая вкладка открывается с начала, а не с середины.
  nextTick(() => {
    if (!root.value) return
    const top = root.value.getBoundingClientRect().top - stickyOffset()
    if (top < 0) window.scrollTo({ top: window.scrollY + top })
  })
}

let outlineObserver: MutationObserver | undefined
onMounted(() => {
  syncWithHash()
  syncOutline()
  // Оглавление дорисовывается после монтирования (и в мобильном выпадающем списке — при открытии).
  outlineObserver = new MutationObserver(() => syncOutline())
  outlineObserver.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('hashchange', syncWithHash)
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncWithHash)
  outlineObserver?.disconnect()
})
</script>

<template>
  <div ref="root" class="lesson-tabs">
    <div class="lesson-tabs-bar" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        role="tab"
        :aria-selected="active === t.id"
        :class="{ active: active === t.id }"
        @click="selectTab(t.id)"
      >{{ t.label }}</button>
    </div>
    <div v-show="active === 'theory'" class="lesson-tab-panel" :ref="(el) => (panels.theory = el as HTMLElement)"><slot name="theory" /></div>
    <div v-show="active === 'task'" class="lesson-tab-panel" :ref="(el) => (panels.task = el as HTMLElement)"><slot name="task" /></div>
    <div v-show="active === 'questions'" class="lesson-tab-panel" :ref="(el) => (panels.questions = el as HTMLElement)"><slot name="questions" /></div>
  </div>
</template>
