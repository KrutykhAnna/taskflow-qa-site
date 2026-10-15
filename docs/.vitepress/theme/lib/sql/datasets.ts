// Реестр учебных баз. Сами скрипты — в datasets/*.sql, грузятся лениво (?raw → отдельный чанк).
export const DATASETS = {
  taskflow: { title: 'TaskFlow', description: 'пользователи, проекты, задачи, комментарии, метки, журнал действий' },
  shop: { title: 'Магазин', description: 'клиенты, товары, заказы, сотрудники и отделы' },
} as const

export type DatasetId = keyof typeof DATASETS

export const DATASET_IDS = Object.keys(DATASETS) as DatasetId[]

export const isDatasetId = (v: unknown): v is DatasetId => typeof v === 'string' && v in DATASETS

export const DATASET_LOADERS: Record<DatasetId, () => Promise<string>> = {
  taskflow: () => import('./datasets/taskflow.sql?raw').then((m) => m.default),
  shop: () => import('./datasets/shop.sql?raw').then((m) => m.default),
}
