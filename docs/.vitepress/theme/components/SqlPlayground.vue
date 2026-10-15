<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, useId } from 'vue'
import { DATASETS, isDatasetId, type DatasetId } from '../lib/sql/datasets'
import { getSqlClient, loadErrorText, type DbHandle, type RunResult, type SchemaTable } from '../lib/sql/engine'
import SqlResult from './SqlResult.vue'
import SqlSchema from './SqlSchema.vue'

const props = defineProps<{ dataset: string; query?: string }>()

const STARTERS: Record<DatasetId, string> = {
  taskflow: 'SELECT id, first_name, last_name, email\nFROM users\nLIMIT 10;',
  shop: 'SELECT id, name, price\nFROM products\nLIMIT 10;',
}

const valid = isDatasetId(props.dataset)
const ds = valid ? (props.dataset as DatasetId) : 'taskflow'
const inputId = useId()
const sql = ref(props.query?.trim() || STARTERS[ds])
const db = shallowRef<DbHandle | null>(null)
const schema = shallowRef<SchemaTable[] | null>(null)
const loadError = ref<string | null>(null)
const busy = ref(false)
const result = shallowRef<RunResult | null>(null)
const notice = ref('')
let unmounted = false

// Движок (Web Worker с sql.js) создаётся только в браузере: в onMounted или по кнопке.
// Новая база открывается до закрытия старой: если открыть не вышло, старая остаётся рабочей.
async function open(): Promise<DbHandle | null> {
  try {
    const client = getSqlClient()
    const fresh = await client.open(ds)
    if (unmounted) {
      client.close(fresh)
      return null
    }
    const tables = await client.schema(fresh)
    if (db.value) client.close(db.value)
    db.value = fresh
    schema.value = tables
    loadError.value = null
    return fresh
  } catch (e) {
    loadError.value = loadErrorText(e)
    return null
  }
}

// Всё, что трогает базу, — под busy: «Выполнить» до окончания загрузки не откроет вторую базу.
async function exclusive(fn: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  try {
    await fn()
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  if (valid) void exclusive(async () => void (await open()))
})
onBeforeUnmount(() => {
  unmounted = true
  if (db.value) getSqlClient().close(db.value)
})

const run = () =>
  exclusive(async () => {
    notice.value = ''
    const d = db.value ?? (await open())
    if (!d) return
    try {
      const client = getSqlClient()
      const out = await client.run(d, sql.value)
      result.value = out.result
      if (out.reopened && out.result.kind !== 'error') notice.value = 'База была пересоздана с исходными данными (движок перезапускался).'
      // запрос мог создать или удалить таблицу — схема должна это показать
      if (out.result.kind !== 'error' || out.reopened) schema.value = await client.schema(d)
    } catch (e) {
      loadError.value = loadErrorText(e)
    }
  })

const reset = () =>
  exclusive(async () => {
    if (await open()) {
      result.value = null
      notice.value = 'База сброшена к исходным данным.'
    }
  })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    void run()
  }
}
</script>

<template>
  <div class="sql-box sql-playground">
    <p v-if="!valid" class="sql-error" role="alert">Неизвестная учебная база «{{ dataset }}». Есть: {{ Object.keys(DATASETS).join(', ') }}.</p>
    <template v-else>
      <div class="sql-head">
        <span class="tq-badge">Песочница</span>
        <span class="sql-head-title">База «{{ DATASETS[ds].title }}»: {{ DATASETS[ds].description }}</span>
      </div>
      <SqlSchema :tables="schema" :title="DATASETS[ds].title" :error="loadError" />
      <label class="sql-label" :for="inputId">SQL-запрос <span class="sql-kbd">Ctrl/⌘ + Enter — выполнить</span></label>
      <textarea
        :id="inputId"
        v-model="sql"
        class="sql-input"
        rows="6"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        @keydown="onKey"
      />
      <div class="tq-actions">
        <button type="button" class="tq-btn primary" :disabled="busy" @click="run">Выполнить</button>
        <button type="button" class="tq-btn" :disabled="busy" @click="reset">Сбросить базу</button>
      </div>
      <p v-if="loadError" class="sql-error" role="alert">{{ loadError }}</p>
      <p v-if="notice" class="sql-meta" aria-live="polite">{{ notice }}</p>
      <SqlResult :result="result" />
    </template>
  </div>
</template>
