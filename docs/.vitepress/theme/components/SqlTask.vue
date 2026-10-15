<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useId } from 'vue'
import type { Database } from 'sql.js'
import { data as allTasks } from '../../../sql-tasks/sql-tasks.data'
import { DATASETS } from '../lib/sql/datasets'
import { describeSchema, loadErrorText, openDataset, runSql, type RunResult, type SchemaTable } from '../lib/sql/engine'
import { checkAnswer, expectedResult, type CheckOutcome } from '../lib/sql/check'
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
const result = shallowRef<RunResult | null>(null)
const verdict = shallowRef<CheckOutcome | null>(null)
const expected = shallowRef<RunResult | null>(null)
const schema = shallowRef<SchemaTable[] | null>(null)
// Рабочая база для «Выполнить»: изменения в ней видны между запусками, пока не нажат «Сбросить базу».
const work = shallowRef<Database | null>(null)

onBeforeUnmount(() => work.value?.close())

// exclusive — действие с рабочей базой или проверкой: кнопки блокируются, пока оно идёт.
async function guard(fn: () => Promise<void>, exclusive = true): Promise<void> {
  if (!task.value || (exclusive && busy.value)) return
  if (exclusive) busy.value = true
  try {
    await fn()
    loadError.value = null
  } catch (e) {
    loadError.value = loadErrorText(e)
  } finally {
    if (exclusive) busy.value = false
  }
}

const run = () =>
  guard(async () => {
    work.value ??= await openDataset(task.value!.dataset)
    verdict.value = null
    result.value = runSql(work.value, sql.value)
  })

// Каждая проверка — на двух свежих копиях базы: твоей и эталонной.
const check = () =>
  guard(async () => {
    const [mine, reference] = await Promise.all([openDataset(task.value!.dataset), openDataset(task.value!.dataset)])
    try {
      const outcome = checkAnswer(mine, reference, task.value!, sql.value)
      verdict.value = outcome
      result.value = outcome.result
    } finally {
      mine.close()
      reference.close()
    }
  })

const reset = () =>
  guard(async () => {
    work.value?.close()
    work.value = await openDataset(task.value!.dataset)
    result.value = null
    verdict.value = null
  })

const loadExpected = () =>
  expected.value ||
  guard(async () => {
    const db = await openDataset(task.value!.dataset)
    try {
      expected.value = expectedResult(db, task.value!)
    } finally {
      db.close()
    }
  }, false)

const loadSchema = () =>
  schema.value ||
  guard(async () => {
    const db = await openDataset(task.value!.dataset)
    try {
      schema.value = describeSchema(db)
    } finally {
      db.close()
    }
  }, false)

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
