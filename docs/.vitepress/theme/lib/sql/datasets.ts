// Реестр учебных баз (только метаданные). Скрипты баз на PostgreSQL — docs/public/sql/<id>.sql:
// студент копирует или скачивает их и выполняет в онлайн-песочнице или в DBeaver.
export const DATASETS = {
  taskflow: { title: 'TaskFlow', description: 'пользователи, проекты, задачи, комментарии, метки, журнал действий' },
  shop: { title: 'Магазин', description: 'клиенты, товары, заказы, сотрудники и отделы' },
} as const

export type DatasetId = keyof typeof DATASETS

export const DATASET_IDS = Object.keys(DATASETS) as DatasetId[]

export const isDatasetId = (v: unknown): v is DatasetId => typeof v === 'string' && v in DATASETS
