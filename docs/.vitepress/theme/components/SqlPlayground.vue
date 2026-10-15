<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, useId } from 'vue'
import type { Database } from 'sql.js'
import { DATASETS, isDatasetId, type DatasetId } from '../lib/sql/datasets'
import { describeSchema, loadErrorText, openDataset, runSql, type RunResult, type SchemaTable } from '../lib/sql/engine'
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
const db = shallowRef<Database | null>(null)
const schema = shallowRef<SchemaTable[] | null>(null)
const loadError = ref<string | null>(null)
const busy = ref(false)
const result = shallowRef<RunResult | null>(null)
const notice = ref('')

// sql.js и база грузятся только в браузере (onMounted / по кнопке): engine.ts тянет их через import().
async function open(): Promise<Database | null> {
  try {
    const fresh = await openDataset(ds)
    db.value?.close()
    db.value = fresh
    schema.value = describeSchema(fresh)
    loadError.value = null
    return fresh
  } catch (e) {
    loadError.value = loadErrorText(e)
    return null
  }
}

onMounted(() => {
  if (valid) void open()
})
onBeforeUnmount(() => db.value?.close())

async function run() {
  if (busy.value) return
  busy.value = true
  notice.value = ''
  try {
    const d = db.value ?? (await open())
    if (!d) return
    result.value = runSql(d, sql.value)
    // запрос мог создать или удалить таблицу — схема должна это показать
    if (result.value.kind !== 'error') schema.value = describeSchema(d)
  } finally {
    busy.value = false
  }
}

async function reset() {
  if (busy.value) return
  busy.value = true
  try {
    if (await open()) {
      result.value = null
      notice.value = 'База сброшена к исходным данным.'
    }
  } finally {
    busy.value = false
  }
}

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
      <p v-if="loadError && !schema" class="sql-error" role="alert">{{ loadError }}</p>
      <p v-if="notice" class="sql-meta" aria-live="polite">{{ notice }}</p>
      <SqlResult :result="result" />
    </template>
  </div>
</template>
