// Реестр учебных баз (только метаданные). Сами скрипты — в datasets/*.sql, их грузит engine.ts.
// Здесь не должно быть import(...?raw): модуль используется и в data loader задач, который собирает esbuild.
export const DATASETS = {
  taskflow: { title: 'TaskFlow', description: 'пользователи, проекты, задачи, комментарии, метки, журнал действий' },
  shop: { title: 'Магазин', description: 'клиенты, товары, заказы, сотрудники и отделы' },
} as const

export type DatasetId = keyof typeof DATASETS

export const DATASET_IDS = Object.keys(DATASETS) as DatasetId[]

export const isDatasetId = (v: unknown): v is DatasetId => typeof v === 'string' && v in DATASETS
