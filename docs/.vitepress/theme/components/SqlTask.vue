<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useId } from 'vue'
import { data as allTasks } from '../../../sql-tasks/sql-tasks.data'
import { DATASETS } from '../lib/sql/datasets'
import { getSqlClient, loadErrorText, type DbHandle, type RunResult, type SchemaTable } from '../lib/sql/engine'
import type { CheckOutcome } from '../lib/sql/check'
import { LEVELS, sqlTopicById } from '../lib/sql/tasks'
import SqlResult from './SqlResult.vue'
import SqlSchema from './SqlSchema.vue'

const props = defineProps<{ id: string }>()

const task = computed(() => allTasks.find((t) => t.id === props.id) ?? null)
const topic = computed(() => (task.value ? sqlTopicById(task.value.topic) : undefined))
const inputId = useId()

const sql = ref('')
const busy = ref(false)
const loadError = ref<string | null>(null)
const notice = ref('')
const result = shallowRef<RunResult | null>(null)
const verdict = shallowRef<CheckOutcome | null>(null)
const expected = shallowRef<RunResult | null>(null)
const schema = shallowRef<SchemaTable[] | null>(null)
// Рабочая база для «Выполнить»: изменения в ней видны между запусками, пока не нажат «Сбросить базу».
const work = shallowRef<DbHandle | null>(null)
let unmounted = false

onBeforeUnmount(() => {
  unmounted = true
  if (work.value) getSqlClient().close(work.value)
})

/** Открыть рабочую базу; если компонент уже размонтирован — сразу закрыть её. */
async function openWork(): Promise<DbHandle | null> {
  const client = getSqlClient()
  const fresh = await client.open(task.value!.dataset)
  if (unmounted) {
    client.close(fresh)
    return null
  }
  return fresh
}

// Действия с рабочей базой и проверка — под busy (кнопки блокируются).
// Ошибку загрузки сбрасывает только успешное такое действие.
async function exclusive(fn: () => Promise<void>): Promise<void> {
  if (!task.value || busy.value) return
  busy.value = true
  try {
    await fn()
    loadError.value = null
  } catch (e) {
    loadError.value = loadErrorText(e)
  } finally {
    busy.value = false
  }
}

// Фоновые загрузки для спойлеров: не блокируют кнопки и не стирают ошибку «Выполнить».
async function background(fn: () => Promise<void>): Promise<void> {
  if (!task.value) return
  try {
    await fn()
  } catch (e) {
    loadError.value = loadErrorText(e)
  }
}

const run = () =>
  exclusive(async () => {
    notice.value = ''
    work.value ??= await openWork()
    if (!work.value) return
    const out = await getSqlClient().run(work.value, sql.value)
    verdict.value = null
    result.value = out.result
    if (out.reopened && out.result.kind !== 'error') notice.value = 'База была пересоздана с исходными данными (движок перезапускался).'
  })

// Каждая проверка — на двух свежих копиях базы (твоей и эталонной) внутри движка.
const check = () =>
  exclusive(async () => {
    notice.value = ''
    const outcome = await getSqlClient().check(task.value!.dataset, task.value!, sql.value)
    verdict.value = outcome
    result.value = outcome.result
  })

// Сначала открыть новую базу, потом закрыть старую: если открыть не вышло, старая остаётся рабочей.
const reset = () =>
  exclusive(async () => {
    const fresh = await openWork()
    if (!fresh) return
    if (work.value) getSqlClient().close(work.value)
    work.value = fresh
    result.value = null
    verdict.value = null
    notice.value = 'База сброшена к исходным данным.'
  })

const loadExpected = () =>
  expected.value ||
  background(async () => {
    expected.value = await getSqlClient().expected(task.value!.dataset, task.value!)
  })

const loadSchema = () =>
  schema.value ||
  background(async () => {
    const client = getSqlClient()
    const db = await client.open(task.value!.dataset)
    try {
      schema.value = await client.schema(db)
    } finally {
      client.close(db)
    }
  })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    void run()
  }
}

const onToggle = (load: () => unknown) => (e: Event) => {
  if ((e.target as HTMLDetailsElement).open) void load()
}
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
      База «{{ DATASETS[task.dataset].title }}».
      <template v-if="task.kind === 'dml'">Здесь нужно изменить данные: проверка сравнит таблицу после твоего запроса и после эталонного.</template>
      <template v-if="task.ordered">Порядок строк важен.</template>
    </p>
    <SqlSchema :tables="schema" :title="DATASETS[task.dataset].title" @open="loadSchema" />

    <label class="sql-label" :for="inputId">Твой запрос <span class="sql-kbd">Ctrl/⌘ + Enter — выполнить</span></label>
    <textarea
      :id="inputId"
      v-model="sql"
      class="sql-input"
      rows="5"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      placeholder="SELECT …"
      @keydown="onKey"
    />
    <div class="tq-actions">
      <button type="button" class="tq-btn" :disabled="busy" @click="run">Выполнить</button>
      <button type="button" class="tq-btn primary" :disabled="busy" @click="check">Проверить</button>
      <button type="button" class="tq-btn" :disabled="busy" @click="reset">Сбросить базу</button>
    </div>

    <p v-if="loadError" class="sql-error" role="alert">{{ loadError }}</p>
    <p v-if="notice" class="sql-meta" aria-live="polite">{{ notice }}</p>
    <p v-if="verdict" class="sql-verdict" :class="verdict.ok ? 'ok' : 'fail'" role="status">{{ verdict.message }}</p>
    <SqlResult :result="result" />

    <details class="custom-block details sql-spoiler">
      <summary>Подсказка</summary>
      <div v-html="task.hintHtml" />
    </details>
    <details class="custom-block details sql-spoiler">
      <summary>Эталонный запрос</summary>
      <p class="sql-meta">Сначала попробуй сам — правильных запросов обычно несколько, проверка сравнивает результат, а не текст.</p>
      <pre class="sql-code"><code>{{ task.solution }}</code></pre>
      <template v-if="task.check">
        <p class="sql-meta">Проверочный запрос (выполняется после твоего и после эталонного):</p>
        <pre class="sql-code"><code>{{ task.check }}</code></pre>
      </template>
    </details>
    <details class="custom-block details sql-spoiler" @toggle="onToggle(loadExpected)($event)">
      <summary>Показать ожидаемый результат</summary>
      <p v-if="!expected" class="sql-meta">Считаю…</p>
      <SqlResult v-else :result="expected" :caption="task.kind === 'dml' ? 'Проверочный запрос после эталона' : 'Ожидаемый результат'" />
    </details>
  </div>
</template>
