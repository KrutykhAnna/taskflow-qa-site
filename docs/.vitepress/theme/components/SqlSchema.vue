<script setup lang="ts">
import type { SchemaTable } from '../lib/sql/engine-core'

defineProps<{ tables: SchemaTable[] | null; title: string; error?: string | null }>()
const emit = defineEmits<{ open: [] }>()

function onToggle(e: Event) {
  if ((e.target as HTMLDetailsElement).open) emit('open')
}
</script>

<template>
  <details class="sql-schema" @toggle="onToggle">
    <summary>Схема базы «{{ title }}»</summary>
    <p v-if="error" class="sql-error" role="alert">{{ error }}</p>
    <p v-else-if="!tables" class="sql-meta">Загружаю базу…</p>
    <div v-else class="sql-schema-tables">
      <div v-for="t in tables" :key="t.name" class="sql-schema-table">
        <div class="sql-schema-name">{{ t.name }}</div>
        <ul>
          <li v-for="c in t.columns" :key="c.name">
            <code>{{ c.name }}</code>
            <span class="sql-schema-type">{{ c.type }}</span>
            <span v-if="c.pk" class="sql-schema-tag" title="первичный ключ">PK</span>
            <span v-if="c.ref" class="sql-schema-tag" :title="`внешний ключ на ${c.ref}`">→ {{ c.ref }}</span>
            <span v-if="c.notNull && !c.pk" class="sql-schema-type">NOT NULL</span>
          </li>
        </ul>
      </div>
    </div>
  </details>
</template>
