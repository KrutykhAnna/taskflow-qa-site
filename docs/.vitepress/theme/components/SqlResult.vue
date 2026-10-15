<script setup lang="ts">
import { computed } from 'vue'
import type { RunResult } from '../lib/sql/engine-core'
import type { Cell } from '../lib/sql/compare'

const props = withDefaults(defineProps<{ result: RunResult | null; maxRows?: number; caption?: string }>(), {
  maxRows: 200,
})

const shown = computed(() => (props.result?.kind === 'table' ? props.result.rows.slice(0, props.maxRows) : []))

function cellText(v: Cell): string {
  if (v === null) return 'NULL'
  if (v instanceof Uint8Array) return `[BLOB, ${v.length} байт]`
  return String(v)
}

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
</script>

<template>
  <div v-if="result" class="sql-result" aria-live="polite">
    <p v-if="result.kind === 'error'" class="sql-error" role="alert">{{ result.message }}</p>

    <p v-else-if="result.kind === 'changes'" class="sql-meta">
      Готово. Изменено {{ result.changes }} {{ plural(result.changes, 'строка', 'строки', 'строк') }}<template
        v-if="result.statements > 1"> (запросов выполнено: {{ result.statements }})</template>.
    </p>

    <template v-else>
      <p class="sql-meta">
        <template v-if="caption">{{ caption }} · </template>
        <template v-if="result.total > shown.length">Показано {{ shown.length }} из {{ result.total }} строк</template>
        <template v-else>{{ result.total }} {{ plural(result.total, 'строка', 'строки', 'строк') }}</template>
      </p>
      <div class="sql-table-wrap" tabindex="0" :aria-label="caption ?? 'Результат запроса'">
        <table class="sql-table">
          <thead>
            <tr><th v-for="(c, i) in result.columns" :key="i">{{ c }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in shown" :key="r">
              <td v-for="(v, i) in row" :key="i" :class="{ 'sql-null': v === null, 'sql-num': typeof v === 'number' }">{{ cellText(v) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
