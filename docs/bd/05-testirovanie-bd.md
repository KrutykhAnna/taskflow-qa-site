# Как тестировать базу данных

<LessonTabs>
<template #theory>

## Простыми словами

Представь магазин. **API — витрина**: покупатель видит товары, цены, кнопку «Купить». **База данных — склад** за стеной. Покупатель склад не видит, но всё, что на витрине, берётся оттуда.

Если на складе бардак — не тот товар на полке, две коробки с одним номером, коробка без накладной, — витрина рано или поздно начнёт врать. Покупатель увидит заказ, которого нет, или не увидит тот, за который заплатил.

**Тестирование базы данных** — проверка склада:

- **что** сохранилось, изменилось или удалилось после действия — и ничего лишнего;
- **как** сохранилось — значения, пустые поля, время, служебные отметки;
- **может ли склад сам не пустить мусор** — ограничения базы;
- **всё или ничего** — не остаётся ли «половины операции» после сбоя.

До сих пор ты в базе только читал: `SELECT`, `JOIN`, агрегаты. В этом уроке впервые **меняешь** данные — `INSERT`, `UPDATE`, `DELETE` — и учишься делать это безопасно: внутри транзакции, которую потом откатываешь.

В этом уроке разберём:

- что проверяет тестировщик в базе и чего обычно не делает;
- **главный приём «API → БД»**: действие в Postman, сверка в DBeaver;
- изменение данных: `INSERT`, `UPDATE`, `DELETE` — и главную опасность, забытый `WHERE`;
- **ограничения** — `NOT NULL`, `PRIMARY KEY`, `UNIQUE`, `FOREIGN KEY`, `CHECK`, `DEFAULT`, длина и тип: что запрещает каждое, какой текст ошибки пишет PostgreSQL и что при этом должен вернуть API;
- **валидацию в API и ограничения в базе** — почему их границы должны совпадать;
- **транзакции**: `BEGIN`, `COMMIT`, `ROLLBACK`, автокоммит в DBeaver, ACID;
- как готовить тестовые данные через базу и не навредить;
- чек-лист тестирования базы для фичи.

Вся практика — на базе TaskFlow на твоём компьютере. Ограничения в примерах — настоящие: из моделей и миграций ветки `training-public`.

## Что такое тестирование БД и зачем

API вернул `201` — это значит только одно: сервер **сказал**, что всё хорошо. Что он на самом деле записал, ответ не показывает. Тестирование базы закрывает этот разрыв.

Что проверяет тестировщик:

| Направление | Что проверяем | Пример в TaskFlow |
|---|---|---|
| **1. Данные после действия** | Сохранилось, изменилось или удалилось ровно то, что нужно, — и больше ничего | После `PATCH` задачи изменился только статус, название — как было |
| **2. Целостность и ограничения** | База сама не даёт записать мусор: пустое обязательное поле, ссылку «в никуда», повтор ключа | Нельзя записать задачу в несуществующий проект |
| **3. Служебные поля и побочные эффекты** | `created_at`, `deleted_at`, журнал `audit_log`, связанные таблицы, каскады | Удаление проекта помечает удалёнными его задачи и комментарии |
| **4. Транзакции** | Операция из нескольких шагов выполняется целиком или не выполняется вовсе | Проект создан — и создатель стал его участником, а не только одно из двух |
| **5. Тестовые данные** | Подготовить нужное состояние и убрать за собой | 30 задач для проверки пагинации |
| **6. Безопасность данных** | Пароли не хранятся открытым текстом, персональные данные — только где нужно | В `users` лежит `password_hash`, а не пароль |

**Мидл.** Чего ручной тестировщик обычно не делает: нагрузочное тестирование СУБД, настройку индексов и планов запросов, администрирование. Это работа администратора баз данных и нагрузочного тестирования. Но заметить «список открывается 20 секунд, когда задач 10 000» и принести это команде — твоя работа.

## Главный приём «API → БД»

Почти всё тестирование базы в работе выглядит так: **сделал действие через API — проверил результат в базе**.

<figure class="dbt-api-db">
<svg viewBox="0 0 440 500" role="img" aria-label="Приём «API → БД» в пять шагов. Шаг 1, Postman: запрос POST /api/v1/projects, ответ 201 и id 5 — смотрим код, тело и id. Шаг 2, API: в одной транзакции пишет строки в таблицы projects, project_members и audit_log. Шаг 3, DBeaver: находим строку по id из ответа и сверяем каждое поле — значение, NULL, длину, регистр, время в UTC. Шаг 4: проверяем соседей — другие проекты и участники не изменились. Шаг 5: побочные эффекты — строка владельца в project_members и запись project.create в audit_log">
  <rect x="0" y="0" width="440" height="500" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="20" y="30" font-size="15" font-weight="700" fill="#1f2937">Приём «API → БД»: действие и сверка</text>
  <rect x="16" y="48" width="408" height="70" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="28" y="70" font-size="14" font-weight="700" fill="#1f2937">1. Postman — действие</text>
  <text x="28" y="90" font-size="14" fill="#1f2937">POST /api/v1/projects → 201, "id": 5</text>
  <text x="28" y="108" font-size="14" fill="#475569">смотрим: код ответа, тело, id</text>
  <text x="220" y="136" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="144" width="408" height="70" rx="6" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/>
  <text x="28" y="166" font-size="14" font-weight="700" fill="#1f2937">2. API пишет в базу — одной транзакцией</text>
  <text x="28" y="186" font-size="14" fill="#1f2937">projects · project_members · audit_log</text>
  <text x="28" y="204" font-size="14" fill="#475569">этого шага не видно — его и проверяем</text>
  <text x="220" y="232" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="240" width="408" height="70" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
  <text x="28" y="262" font-size="14" font-weight="700" fill="#1f2937">3. DBeaver — строка по id из ответа</text>
  <text x="28" y="282" font-size="14" fill="#1f2937">SELECT … FROM projects WHERE id = 5</text>
  <text x="28" y="300" font-size="14" fill="#475569">каждое поле: значение, NULL, длина, UTC</text>
  <text x="220" y="328" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="336" width="408" height="52" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
  <text x="28" y="358" font-size="14" font-weight="700" fill="#1f2937">4. Соседи не задеты</text>
  <text x="28" y="376" font-size="14" fill="#1f2937">другие проекты и участники — как были</text>
  <text x="220" y="406" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="414" width="408" height="70" rx="6" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
  <text x="28" y="436" font-size="14" font-weight="700" fill="#1f2937">5. Побочные эффекты</text>
  <text x="28" y="456" font-size="14" fill="#1f2937">project_members: владелец с ролью OWNER</text>
  <text x="28" y="474" font-size="14" fill="#1f2937">audit_log: project.create</text>
</svg>
<figcaption>Ответ API — только первый шаг. Строку ищут в базе по id из ответа и сверяют поля, соседей и побочные эффекты. Пример — создание проекта в TaskFlow.</figcaption>
</figure>

По шагам:

1. **Действие в Postman.** Запомни `id` из ответа — по нему ищешь в базе. Нет `id` в ответе — ищи по уникальному признаку: названию, которое ты только что придумал, и `created_at`.
2. **Строка в базе.** `SELECT` всех столбцов по `id`.
3. **Каждое поле.** Значение совпадает с запросом? Пустое — это `NULL` или пустая строка `''`? Строка не обрезана? Регистр не изменился? Время — в UTC? Поля, которых не было в запросе, получили ожидаемые значения по умолчанию?
4. **Соседи.** Изменилась **только** нужная строка. `UPDATE` с ошибкой в условии может задеть соседние записи — и ответ API об этом не скажет.
5. **Побочные эффекты.** Записи в связанных таблицах, журнал, каскадные изменения.

Что сверять в TaskFlow после основных действий — по коду ветки `training-public`:

| Действие | Что проверить в базе |
|---|---|
| `POST /api/v1/projects` | Строка в `projects`: `status = 'ACTIVE'`, `owner_id` — твой `id`, `deleted_at` пустой. Строка в `project_members`: ты с ролью `OWNER`. В `audit_log` — `project.create` |
| `PATCH /api/v1/tasks/{id}` | Изменились **только** переданные поля. У таблицы `tasks` нет `updated_at` — момент изменения виден только в `audit_log`: `task.update`, в `details` — переданные поля |
| `POST /api/v1/projects/{id}/members` | Новая строка в `project_members` с нужной ролью. В `audit_log` — `project_member.add`, `entity_type = 'project'`, `entity_id` — id проекта, в `details` — `userId` и `role` |
| `DELETE /api/v1/projects/{id}/members/{userId}` | Строки участника **нет** — участники удаляются по-настоящему, `deleted_at` у них нет. В журнале — `project_member.remove` |
| `DELETE /api/v1/tasks/{id}` | Строка задачи на месте, `deleted_at` заполнен. У её комментариев — тоже. В журнале — `task.delete` |
| `DELETE /api/v1/projects/{id}` | `deleted_at` у проекта, у его действующих задач и их комментариев — один и тот же момент. Строки в `project_members` **остаются**. В журнале — `project.delete` с `{"cascadedTasks": N}` |

Журнал TaskFlow пишется **в той же транзакции**, что и само действие: по коду запись добавляется в сессию до общего `COMMIT`. Значит, если действие не сохранилось — записи в журнале тоже быть не должно. И наоборот: запись в журнале без самого изменения — баг.

## Изменение данных: INSERT, UPDATE, DELETE

Три команды группы DML из урока [«Что такое база данных»](/bd/01-chto-takoe-bd).

::: warning Примеры ниже — не для копирования на стенд
Они показывают, как устроены команды. Выполнять `INSERT`, `UPDATE` и `DELETE` — только во вкладке «Задание», на своём стенде и внутри `BEGIN … ROLLBACK`.
:::

### INSERT — добавить строку

```sql
INSERT INTO comments (task_id, author_id, text)
VALUES (5, 2, 'Комментарий из DBeaver')
RETURNING id, created_at, deleted_at;
```

- **Перечисляй столбцы явно.** `INSERT INTO comments VALUES (…)` без списка столбцов зависит от их порядка в таблице — добавят столбец, и запрос сломается или запишет значение не туда.
- **Не указал столбец** — база подставит значение по умолчанию (`DEFAULT`), а если его нет — `NULL`. Здесь `id` возьмётся из счётчика, `created_at` — текущее время, `deleted_at` — `NULL`.
- **`RETURNING`** — вернуть столбцы только что вставленной строки. Удобно: сразу видишь новый `id` и значения по умолчанию, не нужен отдельный `SELECT`.

### UPDATE — изменить строки

```sql
UPDATE tasks
SET status = 'IN_PROGRESS'
WHERE id = 5;
```

`SET` — что меняем, `WHERE` — **в каких строках**. Можно менять несколько столбцов через запятую: `SET status = 'DONE', assignee_id = 2`. Значение может зависеть от старого: `SET title = title || ' (архив)'`.

База отвечает, сколько строк изменено: `UPDATE 1`. **`UPDATE 0` — не ошибка.** Если `WHERE id = 999` не нашёл строк, PostgreSQL спокойно скажет «изменено 0» — и ничего не изменит. Всегда смотри на это число.

### DELETE — удалить строки

```sql
DELETE FROM comments
WHERE id = 5;
```

Строка удаляется **физически** — её больше нет. Вернуть можно только откатом транзакции или из резервной копии.

### Главная опасность — забытый WHERE

```sql
UPDATE tasks SET status = 'DONE';   -- без WHERE: ВСЕ задачи стали DONE
DELETE FROM comments;               -- без WHERE: удалены ВСЕ комментарии
```

Оба запроса выполнятся без ошибки. `WHERE` не обязателен — без него команда действует на **всю таблицу**. На начальных данных TaskFlow первый запрос ответит `UPDATE 7`.

**Привычка, которая спасает: сначала `SELECT` с тем же `WHERE`.**

```sql
-- 1. Посмотри, что попадёт под изменение
SELECT id, title, status
FROM tasks
WHERE project_id = 1 AND status = 'TODO' AND deleted_at IS NULL;

-- 2. Число строк то, что ожидал? Тогда меняй — с тем же WHERE
UPDATE tasks
SET status = 'IN_PROGRESS'
WHERE project_id = 1 AND status = 'TODO' AND deleted_at IS NULL;
```

На начальных данных `SELECT` вернёт 2 строки, и `UPDATE` скажет `UPDATE 2`. Число совпало — изменил то, что хотел. Не совпало — откатывай и разбирайся.

DBeaver при выполнении `UPDATE` или `DELETE` без `WHERE` обычно переспрашивает, уверен ли ты. Но надеяться на это окно не стоит: его могли отключить, а `WHERE`, который задевает не те строки, оно не поймает.

### Мягкое удаление — это UPDATE

Помнишь из урока [«Что такое база данных»](/bd/01-chto-takoe-bd): TaskFlow не удаляет пользователей, проекты, задачи и комментарии, а ставит `deleted_at`. На языке SQL мягкое удаление — это **`UPDATE`**, а не `DELETE`:

```sql
UPDATE comments
SET deleted_at = now()
WHERE id = 2;
```

Строка на месте, текст на месте, `deleted_at` заполнен. Все запросы приложения отфильтруют её условием `deleted_at IS NULL`.

**Мидл: `now()` внутри транзакции одинаковый.** В PostgreSQL `now()` — время **начала транзакции**, а не момент выполнения команды. Поэтому, если в одной транзакции пометить удалёнными задачу и её комментарии, у всех будет одно и то же время — даже если между командами прошла секунда. В TaskFlow результат при каскадном мягком удалении такой же — одинаковый `deleted_at` у проекта, его задач и комментариев, — но получается иначе: приложение берёт одно время в своём коде и ставит его всем строкам.

## Ограничения — база как охранник

**Ограничение** (constraint) — правило, которое база проверяет при каждом `INSERT` и `UPDATE`. Нарушил — команда не выполнится, данные не изменятся, база вернёт ошибку. Не важно, кто пишет: API, скрипт импорта или тестировщик в DBeaver.

<figure class="dbt-constraints">
<svg viewBox="0 0 440 540" role="img" aria-label="Охранники на входе в таблицу. Сверху строка, которая хочет войти. Её по очереди проверяют пять охранников. Тип и длина: имя из 101 символа в varchar(100) — отказ value too long. NOT NULL: пустой title — отказ null value violates not-null constraint. CHECK: цена 0 при условии price больше 0 — отказ violates check constraint. PRIMARY KEY и UNIQUE: такой ключ уже есть — отказ duplicate key value. FOREIGN KEY: проекта 999 нет — отказ violates foreign key constraint. Внизу: прошла всех — строка в таблице">
  <rect x="0" y="0" width="440" height="540" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="20" y="30" font-size="15" font-weight="700" fill="#1f2937">Ограничения — охранники на входе</text>
  <rect x="16" y="44" width="408" height="38" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="28" y="68" font-size="14" font-weight="700" fill="#1f2937">Новая строка хочет в таблицу</text>
  <text x="220" y="100" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <g font-size="14" fill="#1f2937">
    <rect x="16" y="108" width="150" height="56" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
    <text x="28" y="132" font-weight="700">Тип и длина</text>
    <text x="28" y="152">varchar(100)</text>
    <text x="180" y="132">101 символ</text>
    <text x="180" y="152" fill="#991b1b">✗ value too long</text>
    <text x="91" y="182" fill="#64748b" text-anchor="middle">↓</text>
    <rect x="16" y="190" width="150" height="56" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
    <text x="28" y="214" font-weight="700">NOT NULL</text>
    <text x="28" y="234">title</text>
    <text x="180" y="214">title = NULL</text>
    <text x="180" y="234" fill="#991b1b">✗ null value … not-null</text>
    <text x="91" y="264" fill="#64748b" text-anchor="middle">↓</text>
    <rect x="16" y="272" width="150" height="56" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
    <text x="28" y="296" font-weight="700">CHECK</text>
    <text x="28" y="316">price &gt; 0</text>
    <text x="180" y="296">price = 0</text>
    <text x="180" y="316" fill="#991b1b">✗ violates check constraint</text>
    <text x="91" y="346" fill="#64748b" text-anchor="middle">↓</text>
    <rect x="16" y="354" width="150" height="56" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
    <text x="28" y="378" font-weight="700">PK и UNIQUE</text>
    <text x="28" y="398">без повторов</text>
    <text x="180" y="378">такой ключ уже есть</text>
    <text x="180" y="398" fill="#991b1b">✗ duplicate key value</text>
    <text x="91" y="428" fill="#64748b" text-anchor="middle">↓</text>
    <rect x="16" y="436" width="150" height="56" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
    <text x="28" y="460" font-weight="700">FOREIGN KEY</text>
    <text x="28" y="480">ссылка жива</text>
    <text x="180" y="460">project_id = 999</text>
    <text x="180" y="480" fill="#991b1b">✗ … foreign key constraint</text>
  </g>
  <text x="20" y="522" font-size="14" font-weight="700" fill="#166534">✓ Прошла всех — строка в таблице</text>
</svg>
<figcaption>Каждое ограничение — охранник со своим правилом. Нарушила строка хоть одно — в таблицу она не попадёт, а PostgreSQL сообщит о первом нарушении, которое нашёл. Ограничение CHECK — на условной таблице товаров: в TaskFlow его нет.</figcaption>
</figure>

Ниже — каждое ограничение: что запрещает, какую ошибку пишет PostgreSQL и как это должно выглядеть снаружи, в API. Тексты ошибок проверены выполнением. Первая строка — сама ошибка, вторая, `DETAIL`, — подробности: какая строка или ключ. DBeaver показывает обе.

### NOT NULL — обязательное поле

Запрещает `NULL` в столбце. В TaskFlow `NOT NULL` у `tasks.title`, `tasks.status`, `tasks.priority`, `comments.text`, `project_members.role` и многих других.

```sql
INSERT INTO tasks (project_id, title, priority)
VALUES (1, 'Задача без статуса', 'LOW');
```

```text
ERROR: null value in column "status" of relation "tasks" violates not-null constraint
DETAIL: Failing row contains (8, 1, null, Задача без статуса, null, null, LOW, …).
```

`relation` — так PostgreSQL называет таблицу. `Failing row contains` — строка, которую пытались записать, по порядку столбцов.

**Ловушка: `NOT NULL` не запрещает пустую строку.** `''` — это значение, а не `NULL`. В TaskFlow база пропустит комментарий с текстом `''` — длину «от 1 символа» проверяет только API.

### PRIMARY KEY — уникальный идентификатор

Первичный ключ уникален и не бывает `NULL`. У `project_members` ключ **составной** — пара `(project_id, user_id)`: один пользователь в одном проекте — одна строка.

```sql
INSERT INTO project_members (project_id, user_id, role)
VALUES (1, 2, 'VIEWER');   -- пользователь 2 уже участник проекта 1
```

```text
ERROR: duplicate key value violates unique constraint "project_members_pkey"
DETAIL: Key (project_id, user_id)=(1, 2) already exists.
```

`project_members_pkey` — имя ограничения. PostgreSQL по умолчанию называет первичный ключ `<таблица>_pkey`. А в тот же проект другой пользователь — пожалуйста, и тот же пользователь в другой проект — тоже.

### UNIQUE — без повторов

Значение в столбце или сочетание столбцов не повторяется. Отличия от первичного ключа:

- уникальных ограничений у таблицы может быть много, первичный ключ — один;
- **уникальный столбец допускает `NULL` — и не один.** `NULL` значит «неизвестно», а два «неизвестно» PostgreSQL не считает равными. Поэтому две строки с пустым артикулом не нарушат `UNIQUE (sku)`.

Пример на условной таблице товаров — ограничение и что оно делает:

```sql
-- фрагмент CREATE TABLE products
sku varchar(20) UNIQUE
```

```text
INSERT … sku = 'TS-001'  -- второй раз:
ERROR: duplicate key value violates unique constraint "products_sku_key"
DETAIL: Key (sku)=(TS-001) already exists.

INSERT … sku = NULL      -- дважды: обе строки записаны
```

Ошибка та же, что у первичного ключа: технически оба держатся на уникальном индексе.

**Мидл: уникальность «только среди живых».** При мягком удалении обычный `UNIQUE` мешает: удалённая строка физически на месте и занимает значение. Поэтому делают **частичный уникальный индекс** — уникальность действует только для строк с `deleted_at IS NULL`. Пример из урока [«Что такое база данных»](/bd/01-chto-takoe-bd) ты уже видел. Что проверять в любом проекте: можно ли снова создать запись с тем же значением после удаления — и нельзя ли создать дубль живой.

### FOREIGN KEY — ссылка должна вести куда-то

Значение внешнего ключа должно существовать в родительской таблице.

```sql
INSERT INTO tasks (project_id, title, status, priority)
VALUES (999, 'Задача в несуществующем проекте', 'TODO', 'LOW');
```

```text
ERROR: insert or update on table "tasks" violates foreign key constraint "tasks_project_id_fkey"
DETAIL: Key (project_id)=(999) is not present in table "projects".
```

**Ловушка: внешний ключ ничего не знает про мягкое удаление.** Проект с заполненным `deleted_at` для базы существует. Задачу в «удалённый» проект или на «удалённого» исполнителя база запишет без ошибки. Проверять «живость» — работа API. В TaskFlow она есть: на несуществующего или удалённого исполнителя `POST /tasks` и `PATCH /tasks/{id}` отвечают `404`.

### ON DELETE: что будет с детьми

Внешний ключ ещё решает, что делать, если **удаляют родителя**.

<figure class="dbt-cascade">
<svg viewBox="0 0 440 400" role="img" aria-label="Что будет с дочерними строками, если удалить строку-родителя. Три правила внешнего ключа. CASCADE: дети удаляются вместе с родителем; в TaskFlow так связаны проект, его задачи и их комментарии. RESTRICT или NO ACTION: удалить родителя нельзя, пока есть дети, база вернёт ошибку; в TaskFlow так пользователь и задачи, где он исполнитель. SET NULL: дети остаются, ссылка в них становится NULL; в TaskFlow такого правила нет, пример — заказ и уволенный менеджер">
  <rect x="0" y="0" width="440" height="400" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="20" y="30" font-size="15" font-weight="700" fill="#1f2937">Удалили родителя — что с детьми?</text>
  <g font-size="14" fill="#1f2937">
    <rect x="12" y="48" width="134" height="40" rx="6" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
    <text x="79" y="73" font-weight="700" text-anchor="middle">CASCADE</text>
    <text x="22" y="112">Дети удаляются</text>
    <text x="22" y="132">вместе с ним.</text>
    <text x="22" y="160" fill="#475569">Без ошибки</text>
    <text x="22" y="180" fill="#475569">и без вопросов.</text>
    <rect x="12" y="200" width="134" height="88" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
    <text x="22" y="222" font-weight="700">TaskFlow:</text>
    <text x="22" y="242">проект →</text>
    <text x="22" y="262">задачи →</text>
    <text x="22" y="282">комментарии</text>
    <rect x="153" y="48" width="134" height="40" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
    <text x="220" y="73" font-weight="700" text-anchor="middle">RESTRICT</text>
    <text x="163" y="112">Удалить нельзя,</text>
    <text x="163" y="132">пока есть дети.</text>
    <text x="163" y="160" fill="#991b1b">Ошибка foreign</text>
    <text x="163" y="180" fill="#991b1b">key constraint</text>
    <rect x="153" y="200" width="134" height="88" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
    <text x="163" y="222" font-weight="700">TaskFlow:</text>
    <text x="163" y="242">пользователь,</text>
    <text x="163" y="262">если он где-то</text>
    <text x="163" y="282">исполнитель</text>
    <rect x="294" y="48" width="134" height="40" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
    <text x="361" y="73" font-weight="700" text-anchor="middle">SET NULL</text>
    <text x="304" y="112">Дети остаются,</text>
    <text x="304" y="132">ссылка = NULL.</text>
    <text x="304" y="160" fill="#475569">Столбец должен</text>
    <text x="304" y="180" fill="#475569">допускать NULL</text>
    <rect x="294" y="200" width="134" height="88" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
    <text x="304" y="222" font-weight="700">В TaskFlow нет.</text>
    <text x="304" y="242">Пример: заказ</text>
    <text x="304" y="262">и уволенный</text>
    <text x="304" y="282">менеджер</text>
  </g>
  <text x="20" y="318" font-size="14" fill="#1f2937">Без ON DELETE работает NO ACTION — для</text>
  <text x="20" y="338" font-size="14" fill="#1f2937">тестировщика почти то же, что RESTRICT.</text>
  <text x="20" y="372" font-size="14" fill="#475569">Правила срабатывают только на настоящий DELETE,</text>
  <text x="20" y="390" font-size="14" fill="#475569">а не на мягкое удаление.</text>
</svg>
<figcaption>Три правила внешнего ключа при физическом удалении родителя. В TaskFlow есть CASCADE и правило по умолчанию NO ACTION; SET NULL — пример из другой системы.</figcaption>
</figure>

| Правило | Что происходит | В TaskFlow |
|---|---|---|
| `ON DELETE CASCADE` | Дети удаляются вместе с родителем | `tasks.project_id`, `comments.task_id`, оба ключа `project_members` |
| `ON DELETE RESTRICT` / `NO ACTION` | Удалить родителя нельзя, пока есть дети. `NO ACTION` — то, что действует, когда правило не указано | `tasks.assignee_id`, `comments.author_id`, `projects.owner_id`, `audit_log.user_id` — правило не указано |
| `ON DELETE SET NULL` | Дети остаются, ссылка в них становится `NULL` | Нет |

Попытка физически удалить пользователя 5 — Екатерину, исполнителя задачи «Импорт клиентов»:

```sql
DELETE FROM users WHERE id = 5;
```

```text
ERROR: update or delete on table "users" violates foreign key constraint "tasks_assignee_id_fkey" on table "tasks"
DETAIL: Key (id)=(5) is still referenced from table "tasks".
```

А `DELETE FROM projects WHERE id = 4` пройдёт молча — и каскадом заберёт задачу проекта, её комментарий и строку участника. Ни одного предупреждения.

`RESTRICT` и `NO ACTION` для тестировщика почти одинаковы — оба запрещают. Текст ошибки у `RESTRICT` в зависимости от версии PostgreSQL может быть таким же, как у `NO ACTION` выше, или содержать слова `violates RESTRICT setting of foreign key constraint`.

**Важно:** правила `ON DELETE` срабатывают только на настоящий `DELETE`. API TaskFlow удаляет мягко — каскад «пометить удалёнными задачи и комментарии» делает код приложения, а не база. Каскад базы ударит, если кто-то выполнит `DELETE` в обход API.

**Мидл: как выбирают правило.** `CASCADE` — когда дети без родителя бессмысленны: позиции заказа без заказа. `RESTRICT` — когда удаление родителя опасно: товар, который есть в заказах. `SET NULL` — когда дети живут и без родителя: заказ остаётся, если уволили менеджера. Вопрос для тест-дизайна: «а что будет с детьми?» — и проверка, что правило в базе совпадает с требованием.

### CHECK — условие на значение

Произвольное условие на строку: цена больше нуля, остаток не меньше нуля, статус из списка. В TaskFlow ограничений `CHECK` сейчас нет. Пример на условной таблице товаров:

```sql
-- фрагмент CREATE TABLE products
price  numeric(10,2) NOT NULL CHECK (price > 0),
stock  integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
status varchar(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'archived'))
```

Цена `0` при условии `price > 0`:

```text
ERROR: new row for relation "products" violates check constraint "products_price_check"
DETAIL: Failing row contains (2, TS-002, Бесплатная футболка, 0.00, 0, new, …).
```

Граничные значения — ровно на границе и рядом: `0` не пройдёт, `0.01` — пройдёт. `stock = stock - 5` при остатке 0 упадёт с той же ошибкой, только `products_stock_check`.

**В TaskFlow статус задачи — просто строка.** `tasks.status` — это `varchar(20)` без `CHECK`. Допустимые `TODO`, `IN_PROGRESS`, `DONE` проверяет только API. База пропустит `UPDATE tasks SET status = 'ГОТОВО'` без единой ошибки. Если такое значение попадёт в базу в обход API, API, который ждёт одно из трёх значений, вероятно, не сможет отдать эту задачу.

### DEFAULT — значение по умолчанию

`DEFAULT` подставляется, когда столбец в `INSERT` не указан. В TaskFlow `DEFAULT now()` есть у всех `created_at`, а у `id` — следующее число счётчика.

**Мидл: «по умолчанию» в API ≠ «по умолчанию» в базе.** Новая задача через API получает статус `TODO`, новый проект — `ACTIVE`, новый участник без роли — `VIEWER`. Но это значения по умолчанию **в коде приложения**. В самой базе у `tasks.status`, `projects.status` и `project_members.role` `DEFAULT` нет. Поэтому `INSERT` без статуса прямо в базу упадёт на `NOT NULL` — ошибку ты видел выше. Где смотреть, что правда: в DBeaver, вкладка **Columns** — столбец **Default**, или в DDL.

### Тип и длина

Значение должно подходить по типу и размеру.

| Что нарушено | Ошибка PostgreSQL |
|---|---|
| Строка длиннее `varchar(n)` | `value too long for type character varying(100)` |
| Не то значение для enum-типа | `invalid input value for enum projectrole: "BOSS"` |
| Не число в числовом столбце | `invalid input syntax for type integer: "десять"` |
| Число больше, чем вмещает `integer` | `integer out of range` |

Что важно для тестов:

- **`varchar(n)` считает символы, а не байты.** 100 русских букв — ровно 100, пройдёт; 101 — нет. Проверяй границу именно `n` и `n + 1`.
- **Enum-тип в TaskFlow** — у ролей: `users.role` — тип `userrole` (`USER`, `ADMIN`), `project_members.role` — тип `projectrole` (`OWNER`, `MANAGER`, `VIEWER`, `ADMIN`). Значение сравнивается точно, с учётом регистра: `'viewer'` и `'Manager'` база не примет.
- **Время.** `timestamptz` хранит момент в UTC. Сравнивая с ответом API, переводи в один пояс.

### Как ограничения выглядят снаружи

Ограничение — последний рубеж. Пользователь не должен видеть текст ошибки базы. Правильное поведение API:

| Что случилось | Что должен вернуть API |
|---|---|
| Повтор уникального значения | `409 Conflict` с понятным кодом. В TaskFlow — `409 MEMBER_ALREADY_EXISTS` при повторном добавлении участника |
| Неверный формат, длина, пустое обязательное поле | `422` с указанием поля |
| Ссылка на несуществующее | `404` или `422` — как записано в спецификации |
| Ограничение базы сработало, а API его не ожидал | Обычно `500 Internal Server Error` — **это баг** |

`500` в ответ на неверные данные клиента — всегда повод для баг-репорта: сервер не проверил данные сам и «упал» о базу. Ещё хуже, если в теле `500` виден текст SQL-ошибки: имена таблиц и ограничений — подсказка злоумышленнику. В TaskFlow необработанная ошибка превращается в `500` с общим текстом «Внутренняя ошибка сервера» — SQL наружу не уходит. Про коды ответа — урок [«Коды ответа»](/api/05-kody-otveta).

### Где смотреть ограничения в DBeaver

Открой таблицу → вкладка **Properties**:

- **Columns** — тип, длина, `Not Null`, `Default`;
- **Constraints** — первичный ключ, уникальность, `CHECK`;
- **Foreign Keys** — внешние ключи и правило при удалении;
- **DDL** — всё сразу одной командой `CREATE TABLE`.

В разных версиях DBeaver названия вкладок могут немного отличаться. Если что-то не нашёл — **DDL** показывает всё.

Список ключей можно получить и запросом — это обычный `SELECT` к служебной таблице PostgreSQL `pg_constraint`:

```sql
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass
  AND contype IN ('p', 'f', 'u', 'c')
ORDER BY conname;
```

`p` — первичный ключ, `f` — внешний, `u` — уникальность, `c` — `CHECK`. Для `tasks` — 3 строки: `tasks_assignee_id_fkey`, `tasks_pkey` и `tasks_project_id_fkey` с `ON DELETE CASCADE`. Запрос только читает — его можно выполнять и в подключении «только чтение».

Откуда ограничения берутся в базе и как их меняют, когда база уже работает, — в следующем уроке, [«Миграции и как их тестировать»](/bd/06-migracii).

## Валидация в API и ограничения в базе

**Мидл, важно.** Защита от мусора — на двух уровнях:

1. **Валидация в API** — проверяет запрос до того, как он дойдёт до базы. Даёт понятную ошибку `422` с указанием поля.
2. **Ограничение в базе** — последний рубеж. Защищает от всех, кто пишет мимо API: импорта, скриптов, другого сервиса, ручных правок.

Границы на двух уровнях **должны совпадать**. Как в TaskFlow:

| Поле | API (спецификация) | База | Совпадают? |
|---|---|---|---|
| `projects.name` | 1–100 символов | `varchar(100) NOT NULL` | Верх — да. Низ — только в API: `''` база пропустит |
| `projects.description` | до 1000 | `varchar(1000)` | Да |
| `tasks.title` | 1–100 | `varchar(100) NOT NULL` | Верх — да, низ — только в API |
| `comments.text` | 1–500 | `varchar(500) NOT NULL` | Верх — да, низ — только в API |
| `tasks.status` | `TODO`, `IN_PROGRESS`, `DONE` | `varchar(20)`, без `CHECK` | Только в API |
| `project_members.role` | `OWNER`, `MANAGER`, `VIEWER`; `ADMIN` — только глобальному администратору | enum `projectrole` | Список значений — да. Правило про `ADMIN` — только в API |
| Участник в проекте один раз | `409 MEMBER_ALREADY_EXISTS` | составной первичный ключ | Да |
| У проекта есть хотя бы один `OWNER` | `409 LAST_PROJECT_OWNER` | ничего | Только в API |

Что бывает, когда границы разошлись:

- **API пропускает, база не пускает.** API разрешает 255 символов, в базе `varchar(100)`. Запрос на 150 символов прошёл валидацию, упал в базе — пользователь получил `500`. Баг: валидация не совпадает со схемой.
- **База пропускает, API не проверяет.** Ограничения нет нигде — в базу попадает мусор: статус `'ГОТОВО'`, отрицательная цена, пустое имя. Позже мусор ломает отчёты, фильтры и соседние сервисы.
- **Проверка только в API.** Пока все пишут через API — работает. Импорт, второй сервис или два одновременных запроса — и правило нарушено.

**Как тестировщик находит расхождение:** сравнивает три источника — спецификацию, ограничения в DDL и поведение API **на границе**. Спека говорит «до 100» → в DDL `varchar(100)` → запросы с 100 и 101 символом. 100 — `201`, 101 — `422`. Если 101 дал `500` или 100 дал `500` — границы разошлись.

## Транзакции

### Простыми словами

Перевод денег с карты на карту — два действия: списать с одного счёта и зачислить на другой. Если после списания пропал свет, деньги не должны исчезнуть. Либо оба действия, либо ни одного.

**Транзакция** — группа команд, которая выполняется **целиком или никак**.

<figure class="dbt-tx">
<svg viewBox="0 0 440 470" role="img" aria-label="Транзакция на примере перевода 1000 рублей со счёта А на счёт Б. До начала на А 5000, на Б 200. BEGIN. Шаг 1: списать 1000 с А — теперь 4000. Дальше две ветки. Слева всё хорошо: шаг 2 — зачислить 1000 на Б, COMMIT, итог А 4000, Б 1200, сохранено. Справа сбой посередине: ошибка или обрыв связи, ROLLBACK, итог А 5000, Б 200 — как было, деньги не пропали">
  <rect x="0" y="0" width="440" height="470" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="20" y="30" font-size="15" font-weight="700" fill="#1f2937">Перевод 1000 ₽: всё или ничего</text>
  <text x="20" y="56" font-size="14" fill="#475569">До перевода: А = 5000, Б = 200</text>
  <rect x="120" y="70" width="200" height="34" rx="6" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/>
  <text x="220" y="92" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">BEGIN</text>
  <text x="220" y="122" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="80" y="130" width="280" height="52" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="220" y="152" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">1. Списать 1000 с А</text>
  <text x="220" y="172" font-size="14" fill="#1f2937" text-anchor="middle">А = 4000 (видно только тебе)</text>
  <text x="110" y="204" font-size="14" fill="#64748b" text-anchor="middle">↙</text>
  <text x="330" y="204" font-size="14" fill="#64748b" text-anchor="middle">↘</text>
  <rect x="16" y="214" width="196" height="52" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="114" y="236" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">2. Зачислить на Б</text>
  <text x="114" y="256" font-size="14" fill="#1f2937" text-anchor="middle">Б = 1200</text>
  <rect x="228" y="214" width="196" height="52" rx="6" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
  <text x="326" y="236" font-size="14" font-weight="700" fill="#991b1b" text-anchor="middle">✗ Сбой посередине</text>
  <text x="326" y="256" font-size="14" fill="#1f2937" text-anchor="middle">ошибка, обрыв связи</text>
  <text x="114" y="286" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <text x="326" y="286" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="294" width="196" height="34" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
  <text x="114" y="316" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">COMMIT</text>
  <rect x="228" y="294" width="196" height="34" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
  <text x="326" y="316" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">ROLLBACK</text>
  <text x="114" y="346" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <text x="326" y="346" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="354" width="196" height="70" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="2"/>
  <text x="114" y="378" font-size="14" fill="#1f2937" text-anchor="middle">А = 4000, Б = 1200</text>
  <text x="114" y="398" font-size="14" font-weight="700" fill="#166534" text-anchor="middle">сохранено,</text>
  <text x="114" y="416" font-size="14" fill="#1f2937" text-anchor="middle">видно всем</text>
  <rect x="228" y="354" width="196" height="70" rx="6" fill="#ffffff" stroke="#d97706" stroke-width="2"/>
  <text x="326" y="378" font-size="14" fill="#1f2937" text-anchor="middle">А = 5000, Б = 200</text>
  <text x="326" y="398" font-size="14" font-weight="700" fill="#92400e" text-anchor="middle">как было,</text>
  <text x="326" y="416" font-size="14" fill="#1f2937" text-anchor="middle">деньги не пропали</text>
  <text x="20" y="452" font-size="14" fill="#1f2937">Половины перевода не бывает: А − 1000, а Б + 0.</text>
</svg>
<figcaption>Транзакция — всё или ничего. До COMMIT изменения видны только тебе, а ROLLBACK возвращает всё как было.</figcaption>
</figure>

### BEGIN, COMMIT, ROLLBACK

```sql
BEGIN;                                              -- начать транзакцию
UPDATE accounts SET balance = balance - 1000 WHERE id = 1;
UPDATE accounts SET balance = balance + 1000 WHERE id = 2;
COMMIT;                                             -- сохранить всё
```

- `BEGIN` — начать. С этого момента изменения копятся.
- `COMMIT` — сохранить. После него изменения видят все, и отменить их уже нельзя.
- `ROLLBACK` — откатить. Всё, что сделано после `BEGIN`, исчезает, как будто не было.

**Незакоммиченные изменения видишь только ты.** Пока нет `COMMIT`, твоё подключение видит новые значения, а все остальные — API TaskFlow, коллега в своём DBeaver — старые. Поэтому эксперимент внутри транзакции безопасен: никто его не заметит, а `ROLLBACK` уберёт следы.

**Обратная сторона: открытая транзакция держит блокировки.** Строку, которую ты изменил и не закоммитил, никто другой изменить не может — его запрос будет ждать. Забыл транзакцию открытой — у API «зависли» запросы на изменение этой строки. Закончил эксперимент — сразу `ROLLBACK`.

### Автокоммит

Без явного `BEGIN` каждая команда — отдельная транзакция, которая сохраняется сразу. Это **автокоммит**. В уроке 1 ты видел переключатель на верхней панели DBeaver:

| Режим DBeaver | Что происходит |
|---|---|
| **Auto-Commit** | Каждая команда сохраняется сразу после выполнения. «Отменить» нельзя — `ROLLBACK` ответит предупреждением `there is no transaction in progress` и ничего не вернёт |
| **Manual Commit** | DBeaver сам открывает транзакцию. Изменения копятся, пока не нажмёшь **Commit** или **Rollback** на панели или не выполнишь `COMMIT` / `ROLLBACK` |

Для экспериментов — только **Manual Commit**. И всё равно пиши `BEGIN;` первой строкой: если режим случайно окажется Auto-Commit, `BEGIN` явно откроет транзакцию. В Manual Commit PostgreSQL может ответить на него предупреждением `there is already a transaction in progress` — это не ошибка, продолжай.

### Ошибка внутри транзакции

В PostgreSQL ошибка внутри транзакции **ломает её целиком**. Все следующие команды до конца транзакции отвергаются:

```sql
BEGIN;
UPDATE projects SET owner_id = 5 WHERE id = 4;                              -- выполнено
INSERT INTO project_members (project_id, user_id, role) VALUES (4, 4, 'OWNER'); -- ошибка: такой ключ есть
SELECT id, owner_id FROM projects WHERE id = 4;                             -- отвергнуто
```

```text
ERROR: current transaction is aborted, commands ignored until end of transaction block
```

Выход один — `ROLLBACK`. Даже `COMMIT` в такой транзакции ничего не сохранит: PostgreSQL выполнит откат и ответит `ROLLBACK`. Первый `UPDATE`, который прошёл успешно, тоже отменится. Это и есть «всё или ничего».

В DBeaver это частая загадка: «выполняю простой `SELECT`, а он пишет `current transaction is aborted`». Значит, раньше в этой же транзакции была ошибка. Нажми **Rollback** — и продолжай.

### ACID — для собеседования

Четыре свойства транзакции, простыми словами:

| Буква | Свойство | Простыми словами | Пример |
|---|---|---|---|
| **A** | Atomicity — атомарность | Всё или ничего | Списали — значит, и зачислили. Или ни то, ни другое |
| **C** | Consistency — согласованность | После транзакции все ограничения соблюдены | Нет задачи в несуществующем проекте |
| **I** | Isolation — изолированность | Параллельные транзакции не видят «полуготовые» изменения друг друга | Пока перевод не закоммичен, баланс у других — старый |
| **D** | Durability — долговечность | После `COMMIT` данные не пропадут, даже если сервер сразу выключился | Подтверждённый платёж остаётся после перезагрузки |

::: tip Мидл: SAVEPOINT и две транзакции одновременно
**SAVEPOINT** — «точка сохранения» внутри транзакции. Откатиться можно не к началу, а к ней:

```sql
BEGIN;
UPDATE tasks SET status = 'DONE' WHERE id = 5;
SAVEPOINT before_assignee;
UPDATE tasks SET assignee_id = 999 WHERE id = 5;   -- ошибка: пользователя 999 нет
ROLLBACK TO SAVEPOINT before_assignee;              -- транзакция снова рабочая
SELECT id, status, assignee_id FROM tasks WHERE id = 5;  -- status = DONE остался
ROLLBACK;
```

Это лечит и «сломанную» транзакцию: после `ROLLBACK TO SAVEPOINT` можно продолжать.

**Две транзакции одновременно — потерянное обновление.** На складе 10 штук товара. Два менеджера одновременно открыли карточку: оба видят 10. Первый продал 3 и сохранил `stock = 7`. Второй продал 2 и сохранил `stock = 8`. Итог — 8 вместо 5: обновление первого **потеряно**. Ошибки нет, каждая транзакция по отдельности корректна. Спасает запись «от текущего значения» (`SET stock = stock - 2`), блокировка строки или проверка версии записи.

Как тестировщик это проверяет: два клиента — две вкладки браузера или два запроса в Postman — открывают одну запись и сохраняют разные изменения почти одновременно. Потом в базе смотрят, чьё изменение осталось и не потерялось ли чьё-то молча.
:::

## Как тестировщик использует транзакции

**1. Эксперимент без следов.** Хочешь посмотреть, что сделает база, — открой транзакцию, проверь, откати:

```sql
BEGIN;
DELETE FROM projects WHERE id = 4;                    -- что заберёт каскад?
SELECT COUNT(*) FROM tasks WHERE project_id = 4;      -- 0
SELECT COUNT(*) FROM project_members WHERE project_id = 4;  -- 0
ROLLBACK;                                             -- всё вернулось
```

Только на **своём** стенде и только в Manual Commit — подробные правила во вкладке «Задание».

**2. Проверка атомарности фичи через API.** Тестировщик не видит транзакций в коде, но видит их результат. Пример вне TaskFlow — оформление заказа: создать заказ, его позиции и списать остаток со склада. Что проверить:

- после успешного заказа — все три изменения на месте;
- если операция упала посередине — например, товара не хватило на складе, — в базе **нет ни заказа, ни позиций**, остаток не изменился;
- нет «заказа без позиций» и «списания без заказа» — ищется запросом `LEFT JOIN … WHERE … IS NULL` из урока [«JOIN»](/bd/03-join).

Как устроить сбой посередине: невалидная позиция в конце списка, товар, которого не хватает, отключённый внешний сервис оплаты. Если после ответа с ошибкой в базе остались «половинки» — баг: операция не атомарна.

**3. Проверка журнала.** В TaskFlow журнал пишется в той же транзакции, что и действие. Ответ с ошибкой — записи в журнале быть не должно. Успех — ровно одна запись.

## Тестовые данные через базу

**Когда уместно** готовить данные прямо в базе:

- **много данных**: 500 задач для пагинации — через API долго;
- **состояние, недостижимое через интерфейс**: «старая» дата создания, редкий статус, запись из прошлой версии системы;
- **быстрое повторение**: одно и то же состояние перед каждым прогоном.

**Риски:**

- **Данные, которые API никогда бы не создал.** Задача со статусом `'ГОТОВО'`, проект без участника-владельца, комментарий с пустым текстом. Найдёшь «баг» на таких данных — а это не баг, а твой мусор. Ложный баг-репорт стоит команде времени.
- **Обход бизнес-логики.** API при создании проекта добавляет владельца в участники и пишет журнал. `INSERT` в `projects` — нет. Данные «как будто есть», но система в них не верит.
- **Чужие данные.** На общем стенде твой `UPDATE` ломает чужие проверки — вспомни разбор про заблокированную карту из урока 1.

**Правила:**

1. По возможности создавай данные **через API**. Через базу — осознанно, когда через API нельзя или слишком долго.
2. Повторяй **всё**, что делает API: если он пишет три таблицы — пиши три таблицы.
3. Эксперименты — внутри `BEGIN … ROLLBACK`.
4. После теста — **убери за собой** или верни стенд в исходное состояние.
5. На общем стенде — только с согласия команды. Про общие и личные стенды — урок [«Тестовые окружения»](/osnovy/11-testovye-okruzheniya).

В TaskFlow вернуть стенд в исходное состояние можно двумя способами — подробно во вкладке «Задание».

## Чек-лист тестирования БД для фичи

**Мидл.** Итоговая таблица — пройдись по ней для любой фичи, которая меняет данные:

| Что | Вопросы |
|---|---|
| **Создание** | Строка появилась? Все поля — как в запросе? Значения по умолчанию — правильные? `created_at` — сейчас, в UTC? |
| **Изменение** | Изменились только переданные поля? Соседние строки не задеты? `null` в запросе и «поле не передали» — разное поведение? |
| **Удаление** | Мягкое или физическое — как по требованиям? Что с детьми? Удалённое не видно в списках, поиске, счётчиках? |
| **Ограничения** | Обязательные поля, уникальность, ссылки, длины — есть в базе? Совпадают с валидацией API? Нарушение даёт `4xx`, а не `500`? |
| **Каскады** | Что станет со связанными записями при удалении — мягком и физическом? |
| **Служебные поля** | `created_at`, `updated_at`, `deleted_at`, автор, владелец — заполнены верно? |
| **Аудит** | Запись в журнале есть, одна, с правильными действием, автором и деталями? При ошибке — нет? |
| **Транзакции** | Сбой посередине — не остаётся половины? Два одновременных запроса — не теряется изменение, не появляется дубль? |
| **Права и персональные данные** | Пароли — только хеш? Лишние персональные данные не сохраняются? Удалённые данные пользователя не утекают в ответы? |

## Разборы из жизни

Пять ситуаций из разных проектов. Первый разбор открыт — это образец. Остальные сначала попробуй разобрать сам.

<details class="details custom-block" open>
<summary>Разбор 1. «Почистил цены» — у всех товаров цена 0 — общий стенд интернет-магазина</summary>

**Ситуация.** Тестировщику нужен товар с нулевой ценой для проверки акции «бесплатно». Он открывает DBeaver, подключённый к общему стенду, и пишет запрос в две строки: `UPDATE products SET price = 0` и ниже `WHERE id = 1542`. Выделяет мышкой и выполняет — но в выделение попала только первая строка. Автокоммит включён. Через десять минут в общем чате: «Почему весь каталог бесплатный?»

**Что видит мидл.**

- Выполнился `UPDATE` без `WHERE` — изменены **все** товары. В автокоммите он сохранился сразу, `ROLLBACK` не поможет.
- Стенд общий: сломаны проверки всей команды — и, возможно, автотесты.
- Старые цены не потеряны навсегда: есть ли резервная копия стенда? Журнал изменений цен? Начальный скрипт данных?

**Что делать.**

1. Сразу написать в общий чат: что сделал, когда, какая таблица. Скрывать нельзя — коллеги будут искать «баг» в новой сборке.
2. С разработчиком или администратором найти источник старых цен: резервная копия, журнал, скрипт наполнения стенда.
3. Восстановить цены — и проверить: число товаров с ценой 0 до и после, выборочно — несколько карточек.
4. Себе на будущее: Manual Commit, `BEGIN` первой строкой, сначала `SELECT` с тем же `WHERE`, на общем стенде — подключение «только чтение», а для правок — отдельное.

**Чего не делать.**

- Не «восстанавливать по памяти» `UPDATE products SET price = 990` — так получится другой мусор.
- Не молчать в надежде, что никто не заметит.

</details>

::: details Разбор 2. API ответил 201, а заказ без позиций — сервис доставки еды
**Ситуация.** Клиенты жалуются: в истории заказов есть пустые заказы — «0 позиций, 0 ₽». В логах — ошибки при оформлении. API на эти заказы отвечал `500`, но заказ всё равно появился.

**Что видит мидл.**

- Оформление — несколько шагов: заказ → позиции → резерв в ресторане. Похоже, каждый шаг сохраняется отдельно: заказ уже закоммичен, а позиции упали.
- Это нарушение атомарности: операции «всё или ничего» нет.
- Заказы без позиций находятся запросом `orders LEFT JOIN order_items … WHERE oi.id IS NULL`.

**Что делать.**

1. Найти в базе все заказы без позиций и сравнить время их создания с ошибками в логах.
2. Воспроизвести: оформить заказ, в котором последняя позиция заведомо невалидна — например, блюдо из выключенного меню. Ожидаю: ошибка — и в базе нет ни заказа, ни позиций.
3. Завести баг: «Оформление заказа не атомарно: при ошибке на позициях заказ остаётся в базе». Приложить запрос, который находит пустые заказы, и их число.
4. Отдельно — вопрос команде: что делать с уже созданными пустыми заказами.

**Чего не делать.**

- Не закрывать как «ошибка разовая, данные поправили руками». Без транзакции «половинки» будут появляться снова.
:::

::: details Разбор 3. Дубли клиентов при одновременной регистрации — CRM
**Ситуация.** В CRM появились клиенты-близнецы: одинаковый телефон, одинаковое имя, созданы с разницей в 40 миллисекунд. В требованиях — «телефон уникален». API на повторную регистрацию с тем же телефоном отвечает `409` — тестировщик это проверял.

**Что видит мидл.**

- `409` при повторе — это проверка **в коде**: «найди клиента с таким телефоном — если есть, ошибка». Два одновременных запроса оба выполнили поиск, оба ничего не нашли, оба записали.
- В базе на телефоне нет `UNIQUE` — иначе вторая запись упала бы на ограничении.
- 40 миллисекунд — двойное нажатие кнопки или повтор запроса мобильным приложением при плохой связи.

**Что делать.**

1. Найти дубли: `GROUP BY phone HAVING COUNT(*) > 1` — из урока [«Агрегаты»](/bd/04-agregaty).
2. Посмотреть DDL таблицы: есть ли уникальность на телефоне.
3. Воспроизвести: два одинаковых запроса регистрации одновременно — например, запуском коллекции Postman с двумя одинаковыми запросами параллельно или двойным нажатием на медленной сети.
4. Завести баг: «Уникальность телефона проверяется только в коде, в базе ограничения нет — при одновременных запросах создаются дубли». Предложение — уникальное ограничение в базе, а нарушение ограничения API должен превращать в `409`.

**Чего не делать.**

- Не считать проверку уникальности законченной после одного последовательного повтора. Одновременность — отдельный тест.
:::

::: details Разбор 4. Удалили категорию — пропали товары — маркетплейс
**Ситуация.** Контент-менеджер удалил пустую, как ему казалось, категорию «Летние распродажи». Через час продавцы пишут: пропало 300 товаров. Восстановление из резервной копии заняло ночь.

**Что видит мидл.**

- Внешний ключ `products.category_id` объявлен с `ON DELETE CASCADE`: удалили категорию — база удалила все её товары. Без ошибки и без вопроса.
- Для товаров правильнее `RESTRICT`: «нельзя удалить категорию, пока в ней есть товары», или мягкое удаление категории.
- Интерфейс показал «пустую» категорию, потому что считал только активные товары, а в ней лежали снятые с продажи.

**Что делать.**

1. На тестовом стенде воспроизвести: категория с одним товаром → удалить → проверить товары в базе.
2. Посмотреть правило внешнего ключа в DBeaver: вкладка **Foreign Keys**.
3. Завести баг: «Удаление категории каскадом удаляет товары. Ожидается запрет удаления непустой категории». Приложить DDL и шаги.
4. Добавить в чек-лист фичи удаления вопрос «что будет с детьми?» и проверку для каждого внешнего ключа на эту таблицу.

**Чего не делать.**

- Не проверять удаление только на пустых родителях: на них `CASCADE` и `RESTRICT` выглядят одинаково.
:::

::: details Разбор 5. API принимает 255 символов, база — 100 — служба поддержки
**Ситуация.** Пользователь пишет обращение с длинной темой. Форма разрешает до 255 символов, кнопка «Отправить» — и «Что-то пошло не так». В логах — ошибка базы `value too long for type character varying(100)`.

**Что видит мидл.**

- Валидация на клиенте и в API — до 255, в базе — `varchar(100)`. Границы разошлись.
- API не ожидал ошибки базы — отсюда `500`.
- Пострадали все темы длиной 101–255 символов. Тесты не поймали: проверяли короткие темы — 10 и 50 символов. Длинную не пробовал никто.

**Что делать.**

1. Сравнить три источника: требование, валидацию API, DDL столбца.
2. Проверить границы базы через API: 100 символов — `201`, 101 — сейчас `500`.
3. Завести баг: «Тема обращения: API принимает до 255 символов, в базе `varchar(100)` — ответ 500 на 101–255 символов». Решение выбирает команда: расширить столбец или ограничить API, но **одинаково**.
4. Предложить проверку: для каждого строкового поля — граница из DDL и граница API, тесты на `n` и `n + 1`.

**Чего не делать.**

- Не проверять длину только «на максимум из требований». Граница базы может быть меньше — и прятаться до первой длинной строки.
:::

## Частые ошибки

- **`UPDATE` или `DELETE` без `WHERE`.** Задета вся таблица. Сначала `SELECT` с тем же `WHERE`.
- **Эксперимент в Auto-Commit.** Изменение сохранилось сразу, `ROLLBACK` не помогает. Для экспериментов — Manual Commit и `BEGIN`.
- **Забытая открытая транзакция.** Изменённые строки заблокированы, у API «висят» запросы. Закончил — `ROLLBACK`.
- **«Почему `SELECT` не работает?»** — `current transaction is aborted`: раньше в транзакции была ошибка. Только `ROLLBACK`.
- **`UPDATE 0` принят за успех.** Ошибки нет, но ничего не изменилось. Смотри число строк.
- **`DELETE` вместо мягкого удаления.** В TaskFlow данные удаляются через `deleted_at`. `DELETE` в обход API — каскад базы и потерянная история.
- **`NOT NULL` спутан с «не пустая строка».** `''` проходит `NOT NULL`.
- **Внешний ключ спутан с «запись живая».** Ключ не знает про `deleted_at`.
- **Значение по умолчанию искали в базе, а оно в коде.** `INSERT` прямо в базу ведёт себя не как API.
- **Граница проверена только с одной стороны.** Нужны `n` и `n + 1` — и в API, и в DDL.
- **Тестовые данные, которые API не создал бы.** Ложные баги и сломанные проверки.
- **Проверили только строку из ответа.** Соседние строки, связанные таблицы и журнал остались без внимания.
- **`500` на неверные данные принят за норму.** Это баг: сервер не проверил данные до базы.

</template>

<template #task>

## Что нужно сделать

Цель — научиться менять данные в базе **безопасно** и проверять базу как тестировщик: предсказывать, какое ограничение сработает и с какой ошибкой; писать `INSERT`, `UPDATE`, `DELETE` и не задевать лишнего; пользоваться транзакциями; сверять результат действий API с базой.

Задание из шести частей:

1. 20 задач на ограничения таблиц TaskFlow.
2. 16 задач на `INSERT`, `UPDATE`, `DELETE` и транзакции.
3. 11 ситуаций «API → БД»: действие в Postman, проверка в DBeaver только чтением.
4. 3 эксперимента «база и API вместе» с откатом.
5. 10 задач на внимательность: условие словами, в нём подвох.
6. Мидл, письменно: чек-лист проверок базы для выдуманной фичи.

Всё — на **твоём локальном стенде TaskFlow**, ветка `training-public`. TaskFlow должен быть запущен по инструкции из `README.md` репозитория (`docker compose up -d`). Части 1, 2, 4 и 5 меняют данные — поэтому сначала прочитай подготовку.

Уровни: **джун** — база, **мидл** — с подвохом, **с собеседования** — такие дают на собеседованиях.

## Подготовка: как менять данные и ничего не сломать

### Правила

::: warning Пять правил на весь урок
1. **Только свой локальный стенд.** Никогда — общий стенд команды и тем более продакшен.
2. **Режим Manual Commit** в DBeaver.
3. **`BEGIN;` первой строкой** каждой задачи.
4. **`ROLLBACK;` последней строкой.** Закоммитить можно только там, где задача прямо это просит, — и там же сказано, как вернуть стенд.
5. **Не оставляй транзакцию открытой.** Пока она открыта, изменённые строки заблокированы, и API не сможет их изменить.
:::

### Отдельное подключение для записи

В уроке [«Что такое база данных»](/bd/01-chto-takoe-bd) ты включил подключению режим **только чтение**. Оставь его как есть — для части 3 и всех будущих проверок. Для изменений создай **второе** подключение:

1. **Database → New Database Connection → PostgreSQL**, параметры те же: `localhost`, порт `5432`, база `taskflow`, пользователь и пароль `taskflow`.
2. Назови его так, чтобы не перепутать: например, `TaskFlow — ЗАПИСЬ (локально)`. Галочку **Read-only connection** не ставь.
3. В настройках подключения можно выбрать его тип и цвет — выбери заметный, чтобы вкладка редактора этого подключения бросалась в глаза. Где именно эта настройка, зависит от версии DBeaver; не нашёл — хватит понятного имени.
4. Открой SQL-редактор этого подключения и переключи режим транзакций на верхней панели в **Manual Commit**.

Как выполнять задачи: выполняй команды **по одной** — курсор на команде и `Ctrl+Enter` (`Cmd+Enter` на macOS). Так видно результат и ошибку каждой. Можно и всю задачу сразу — **Execute SQL Script** (`Alt+X`), тогда результаты откроются на отдельных вкладках.

После каждой задачи проверь, что транзакция закрыта: кнопки **Commit** и **Rollback** на панели неактивны или счётчик изменений пустой — как это выглядит, зависит от версии DBeaver. Сомневаешься — выполни `ROLLBACK;` ещё раз: лишний `ROLLBACK` безопасен, PostgreSQL ответит только предупреждением `there is no transaction in progress`.

### Если что-то закоммитил по ошибке

Стенд локальный, его можно вернуть в исходное состояние. Два способа.

**Способ 1 — ручка сброса** `POST /api/v1/admin/reset`. Только для пользователя с ролью `ADMIN`: учётная запись администратора — в `README.md` репозитория. Получи его токен так же, как в блоке 2, и вызови ручку в Postman. Ответ — `204`. Перед сбросом закрой транзакцию в DBeaver — **Rollback** или `ROLLBACK;`: пока она открыта, сброс будет ждать.

**Способ 2 — пересоздать контейнеры** из папки проекта:

```bash
docker compose down -v
docker compose up --build -d
```

Флаг `-v` удаляет том с данными PostgreSQL — база создастся заново.

::: danger Сброс необратим
Оба способа удаляют **все** данные стенда — и то, что ты создавал в блоке 2: проекты, задачи, комментарии, новых пользователей. После сброса на стенде — только начальные данные, а номера `id` снова начинаются с 1. По коду ручка сброса очищает все таблицы, включая журнал, заново заполняет начальные данные и пишет в журнал одну запись — `admin.reset`.
:::

**Хочешь, чтобы числа совпадали с эталонами**, — можешь сбросить стенд **перед** уроком. Не хочешь терять свои данные из блока 2 — не сбрасывай: эталоны с конкретными числами рассчитаны на начальные данные, на твоём стенде числа могут отличаться. Тексты ошибок от данных не зависят.

Начальные данные TaskFlow, на которые опираются задачи:

| Таблица | Что есть |
|---|---|
| `users` | 1 — администратор, 2 — Иван Иванов, 3 — Анна Петрова, 4 — Алексей Сидоров, 5 — Екатерина Орлова, 6 — Дмитрий Соколов, 7 — Ольга Смирнова (неактивна) |
| `projects` | 1 — TaskFlow Backend (владелец 1), 2 — Mobile Banking (2), 3 — CRM System (3), 4 — Online Store (4) |
| `project_members` | проект 1: 1 `OWNER`, 2 `MANAGER`, 3 `VIEWER`; проект 2: 2 `OWNER`, 5 `VIEWER`; проект 3: 3 `OWNER`; проект 4: 4 `OWNER` |
| `tasks` | 1 «Создать регистрацию» (проект 1, исполнитель 2, `TODO`), 2 «JWT авторизация» (1, 3, `IN_PROGRESS`), 3 «Push-уведомления» (2, 4, `DONE`), 4 «Импорт клиентов» (3, 5, `TODO`), 5 «Настроить CI» (1, без исполнителя, `TODO`), 6 «Двухфакторная аутентификация» (2, 6, `IN_PROGRESS`), 7 «Корзина покупок» (4, 4, `DONE`) |
| `comments` | 1 и 2 — у задачи 1, 3 — у задачи 2, 4 — у задачи 6 (автор 6), 5 — у задачи 7 |

**Как работать с задачами.** Сначала **предскажи** результат: пройдёт команда или нет, какая будет ошибка. Запиши предсказание. Потом выполни и сверься с эталоном. Предсказание — главная часть: на работе ты будешь решать заранее, что проверять, а не перебирать всё подряд.

В эталонах ошибка дана так, как её пишет PostgreSQL: первая строка — `ERROR`, вторая — `DETAIL`. Номера в `DETAIL` на твоём стенде могут отличаться — там, где они зависят от данных, стоит `…`.

## Часть 1. Ограничения TaskFlow

### Найди ограничения

**Задача 1** (джун). Какие столбцы таблицы `tasks` обязательные, какой у них тип и длина, у каких есть значение по умолчанию? Посмотри в DBeaver на вкладке **Columns** — и тем же запросом.

::: details Подсказка
Служебное представление `information_schema.columns` — обычная таблица для `SELECT`: столбцы `column_name`, `data_type`, `character_maximum_length`, `is_nullable`, `column_default`.
:::

::: details Эталон
```sql
SELECT column_name, data_type, character_maximum_length AS max_len,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;
```
9 строк. Обязательные (`is_nullable = NO`): `id`, `project_id`, `title`, `status`, `priority`. Длины: `title` — 100, `description` — 1000, `status` — 20. Значение по умолчанию только у двух: `id` — `nextval('tasks_id_seq'::regclass)`, следующее число счётчика, и `created_at` — `now()`. У `status` значения по умолчанию в базе **нет**, хотя через API задача получает `TODO`.
:::

**Задача 2** (джун). Какие ключи у таблиц `tasks` и `project_members`? Что будет с задачами и участниками, если физически удалить проект?

::: details Подсказка
Запрос к `pg_constraint` из теории — для каждой таблицы. Или вкладки **Constraints** и **Foreign Keys** в DBeaver.
:::

::: details Эталон
```sql
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass
  AND contype IN ('p', 'f', 'u', 'c')
ORDER BY conname;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'project_members'::regclass
  AND contype IN ('p', 'f', 'u', 'c')
ORDER BY conname;
```
У `tasks` — 3 строки: `tasks_assignee_id_fkey` — `FOREIGN KEY (assignee_id) REFERENCES users(id)` без правила, `tasks_pkey` — `PRIMARY KEY (id)`, `tasks_project_id_fkey` — `… REFERENCES projects(id) ON DELETE CASCADE`.

У `project_members` — 3 строки: `project_members_pkey` — `PRIMARY KEY (project_id, user_id)`, составной; оба внешних ключа — с `ON DELETE CASCADE`.

При физическом удалении проекта база удалит его задачи и участников. `UNIQUE` и `CHECK` у этих таблиц нет.
:::

**Задача 3** (джун). Те же вопросы для `comments` и `projects`. Можно ли физически удалить пользователя, который написал комментарий? А владельца проекта?

::: details Подсказка
Смотри, у каких внешних ключей нет `ON DELETE`.
:::

::: details Эталон
Запрос из задачи 2 с `'comments'::regclass` и `'projects'::regclass`.

`comments`: `comments_author_id_fkey` — на `users(id)` без правила, `comments_pkey`, `comments_task_id_fkey` — на `tasks(id)` с `ON DELETE CASCADE`. `projects`: `projects_owner_id_fkey` — на `users(id)` без правила, `projects_pkey`.

Без правила действует `NO ACTION`: удалить пользователя, у которого есть комментарии или проекты во владении, база не даст. А удаление задачи заберёт её комментарии.
:::

**Задача 4** (джун). Какие значения допускают роли в проекте и глобальные роли пользователей?

::: details Подсказка
Это enum-типы `projectrole` и `userrole`. Функция `enum_range(NULL::тип)` возвращает все значения.
:::

::: details Эталон
```sql
SELECT enum_range(NULL::projectrole) AS project_roles,
       enum_range(NULL::userrole)    AS user_roles;
```
`{OWNER,MANAGER,VIEWER,ADMIN}` и `{USER,ADMIN}`. Другие значения база не примет. Для статуса задачи такого типа нет: `tasks.status` — обычная строка.
:::

### NOT NULL и значения по умолчанию

**Задача 5** (джун). Предскажи результат: создаём задачу без статуса.

```sql
BEGIN;
INSERT INTO tasks (project_id, title, priority)
VALUES (1, 'Задача без статуса', 'LOW');
ROLLBACK;
```

::: details Подсказка
Через API статус не передают — и задача получает `TODO`. А в базе у `status` есть значение по умолчанию?
:::

::: details Эталон
Ошибка:
```text
ERROR: null value in column "status" of relation "tasks" violates not-null constraint
DETAIL: Failing row contains (…, 1, null, Задача без статуса, null, null, LOW, …).
```
`TODO` по умолчанию подставляет **код API**, а не база. В базе значения по умолчанию у `status` нет, столбец не указан — значит, `NULL`, а он запрещён.
:::

**Задача 6** (джун). Предскажи результат каждой команды. Это одна задача — две попытки.

```sql
BEGIN;
INSERT INTO project_members (project_id, user_id)
VALUES (3, 2);
ROLLBACK;

BEGIN;
INSERT INTO projects (name, owner_id)
VALUES ('Проект без статуса', 2);
ROLLBACK;
```

::: details Подсказка
Через API участник без роли получает `VIEWER`, проект — статус `ACTIVE`. Где живут эти значения?
:::

::: details Эталон
Обе — ошибка `NOT NULL`:
```text
ERROR: null value in column "role" of relation "project_members" violates not-null constraint
ERROR: null value in column "status" of relation "projects" violates not-null constraint
```
Значения по умолчанию `VIEWER` и `ACTIVE` — в коде API. Вывод для тестов: данные, вставленные прямо в базу, не получают «умолчаний» API — их нужно указывать самому.
:::

**Задача 7** (джун). Предскажи: комментарий с текстом `NULL` и комментарий с пустым текстом `''`.

```sql
BEGIN;
INSERT INTO comments (task_id, author_id, text)
VALUES (1, 2, NULL);
ROLLBACK;

BEGIN;
INSERT INTO comments (task_id, author_id, text)
VALUES (1, 2, '')
RETURNING id, text, length(text) AS len;
ROLLBACK;
```

::: details Подсказка
`NULL` и пустая строка — разные вещи. Что из них запрещает `NOT NULL`?
:::

::: details Эталон
Первая — ошибка:
```text
ERROR: null value in column "text" of relation "comments" violates not-null constraint
```
Вторая **проходит**: `RETURNING` вернёт строку с `len = 0`. `NOT NULL` запрещает только `NULL`, пустая строка — значение. Текст «от 1 символа» проверяет только API — `CommentCreate: text (1–500)` в спецификации. Через API пустой комментарий — `422`, мимо API — пожалуйста.
:::

### FOREIGN KEY

**Задача 8** (джун). Предскажи: задача в проекте 999.

```sql
BEGIN;
INSERT INTO tasks (project_id, title, status, priority)
VALUES (999, 'Задача в несуществующем проекте', 'TODO', 'LOW');
ROLLBACK;
```

::: details Эталон
```text
ERROR: insert or update on table "tasks" violates foreign key constraint "tasks_project_id_fkey"
DETAIL: Key (project_id)=(999) is not present in table "projects".
```
Через API на тот же запрос с `"projectId": 999` спецификация обещает `404`, а не `500`.
:::

**Задача 9** (джун). Предскажи: назначаем задаче 5 исполнителя 999.

```sql
BEGIN;
UPDATE tasks SET assignee_id = 999 WHERE id = 5;
ROLLBACK;
```

::: details Подсказка
Внешний ключ проверяется и при `INSERT`, и при `UPDATE`.
:::

::: details Эталон
```text
ERROR: insert or update on table "tasks" violates foreign key constraint "tasks_assignee_id_fkey"
DETAIL: Key (assignee_id)=(999) is not present in table "users".
```
`insert or update` в тексте — как раз потому, что внешний ключ охраняет оба действия.
:::

**Задача 10** (мидл). Пометь проект 3 удалённым и перенеси в него задачу 5. Предскажи: пустит ли база? Что ответил бы API на `POST /api/v1/tasks` с `"projectId": 3` после удаления проекта через API?

```sql
BEGIN;
UPDATE projects SET deleted_at = now() WHERE id = 3;
UPDATE tasks SET project_id = 3 WHERE id = 5;
SELECT t.id, t.title, t.project_id, p.deleted_at IS NOT NULL AS project_deleted
FROM tasks t
JOIN projects p ON p.id = t.project_id
WHERE t.id = 5;
ROLLBACK;
```

::: details Подсказка
Внешний ключ проверяет, есть ли **строка**. Знает ли он про `deleted_at`?
:::

::: details Эталон
База пускает: обе команды — `UPDATE 1`, `SELECT` вернёт `5`, «Настроить CI», `3`, `project_deleted = true`. Строка проекта 3 существует — внешнему ключу этого достаточно.

API проверяет «живость» сам: по спецификации для `POST /tasks` несуществующий проект — `404`, а удалённый снаружи неотличим от несуществующего. Вывод: проверка «нельзя писать в удалённый проект» — только в коде, база её не дублирует. Это тест-кейс для API, а не для базы.
:::

### PRIMARY KEY

**Задача 11** (джун). Предскажи: добавляем пользователя 2 в проект 1 ещё раз.

```sql
BEGIN;
INSERT INTO project_members (project_id, user_id, role)
VALUES (1, 2, 'VIEWER');
ROLLBACK;
```

::: details Эталон
```text
ERROR: duplicate key value violates unique constraint "project_members_pkey"
DETAIL: Key (project_id, user_id)=(1, 2) already exists.
```
Пользователь 2 уже `MANAGER` в проекте 1. Роль не важна — ключ из пары `(project_id, user_id)`. Через API на такой повтор спецификация обещает `409 MEMBER_ALREADY_EXISTS`.
:::

**Задача 12** (джун). А теперь пользователь 3 — в проект 2. Пройдёт? Сколько проектов у пользователя 3 станет внутри транзакции?

```sql
BEGIN;
INSERT INTO project_members (project_id, user_id, role)
VALUES (2, 3, 'VIEWER')
RETURNING project_id, user_id, role, created_at;
SELECT project_id, user_id, role
FROM project_members
WHERE user_id = 3
ORDER BY project_id;
ROLLBACK;
```

::: details Эталон
Проходит. Составной ключ запрещает повтор **пары**, а пары `(2, 3)` ещё нет. `created_at` заполнился сам — `DEFAULT now()`. `SELECT` — 3 строки: проект 1 `VIEWER`, проект 2 `VIEWER`, проект 3 `OWNER`. После `ROLLBACK` — снова две.
:::

**Задача 13** (джун). Предскажи: задача с явно указанным `id = 1`.

```sql
BEGIN;
INSERT INTO tasks (id, project_id, title, status, priority)
VALUES (1, 1, 'Ещё одна первая задача', 'TODO', 'LOW');
ROLLBACK;
```

::: details Эталон
```text
ERROR: duplicate key value violates unique constraint "tasks_pkey"
DETAIL: Key (id)=(1) already exists.
```
Первичный ключ уникален. Даже если задача 1 мягко удалена — строка есть, номер занят. Обычно `id` не указывают и оставляют базе.
:::

### Тип и длина

**Задача 14** (джун). Предскажи результат обеих команд.

```sql
BEGIN;
UPDATE project_members SET role = 'BOSS'
WHERE project_id = 1 AND user_id = 2;
ROLLBACK;

BEGIN;
UPDATE project_members SET role = 'viewer'
WHERE project_id = 1 AND user_id = 2;
ROLLBACK;
```

::: details Подсказка
Вспомни список значений из задачи 4. Важен ли регистр?
:::

::: details Эталон
Обе — ошибка:
```text
ERROR: invalid input value for enum projectrole: "BOSS"
ERROR: invalid input value for enum projectrole: "viewer"
```
Значение enum-типа сравнивается точно, с учётом регистра. `VIEWER` — да, `viewer` — нет.
:::

**Задача 15** (джун). Граница длины названия проекта. Предскажи результат обоих `UPDATE`.

```sql
BEGIN;
UPDATE projects SET name = repeat('я', 100) WHERE id = 1;
SELECT id, length(name) AS len FROM projects WHERE id = 1;
UPDATE projects SET name = repeat('я', 101) WHERE id = 1;
ROLLBACK;
```

`repeat('я', 100)` — строка из ста букв «я».

::: details Эталон
Первый — `UPDATE 1`, `SELECT` покажет `len = 100`. Второй — ошибка:
```text
ERROR: value too long for type character varying(100)
```
`varchar(100)` считает **символы**: сто русских букв проходят. Граница базы совпадает с границей API — `name (1–100)` в спецификации.
:::

**Задача 16** (джун). То же для текста комментария: 500 и 501 символ. Напиши сам.

::: details Подсказка
`comments.text` — `varchar(500)`. Две вставки в одной транзакции, потом `ROLLBACK`.
:::

::: details Эталон
```sql
BEGIN;
INSERT INTO comments (task_id, author_id, text)
VALUES (1, 2, repeat('а', 500))
RETURNING id, length(text) AS len;
INSERT INTO comments (task_id, author_id, text)
VALUES (1, 2, repeat('а', 501));
ROLLBACK;
```
Первая — проходит, `len = 500`. Вторая:
```text
ERROR: value too long for type character varying(500)
```
:::

**Задача 17** (мидл). Предскажи результат каждой команды.

```sql
BEGIN;
UPDATE tasks SET status = 'ГОТОВО' WHERE id = 5;
SELECT id, title, status FROM tasks WHERE id = 5;
ROLLBACK;

BEGIN;
UPDATE tasks SET status = 'WAITING_FOR_CUSTOMER_REPLY' WHERE id = 5;
ROLLBACK;
```

::: details Подсказка
Вспомни задачу 1: какой тип у `status`? Есть ли список допустимых значений в базе?
:::

::: details Эталон
Первый `UPDATE` **проходит**: `status = 'ГОТОВО'`. Второй — ошибка:
```text
ERROR: value too long for type character varying(20)
```
Строка из 26 символов не влезает в `varchar(20)`. А `'ГОТОВО'` — влезает, и больше база ничего не проверяет: `CHECK` на статус нет. Допустимые `TODO`, `IN_PROGRESS`, `DONE` охраняет только API. Это не баг урока, а факт схемы, который тестировщик должен знать: любые данные, вставленные мимо API, могут оказаться с таким статусом.
:::

### ON DELETE

**Задача 18** (джун). Сколько задач, комментариев и участников заберёт физическое удаление проекта 4? Сначала посчитай, потом удали, посчитай снова и откати.

::: details Подсказка
Задачи проекта — по `project_id = 4`. Комментарии этих задач — `JOIN` с `tasks`. Участники — `project_members`. Посчитай до `DELETE` и после.
:::

::: details Эталон
```sql
BEGIN;
SELECT COUNT(*) AS tasks FROM tasks WHERE project_id = 4;
SELECT COUNT(*) AS comments
FROM comments c
JOIN tasks t ON t.id = c.task_id
WHERE t.project_id = 4;
SELECT COUNT(*) AS members FROM project_members WHERE project_id = 4;

DELETE FROM projects WHERE id = 4;

SELECT COUNT(*) AS tasks FROM tasks WHERE project_id = 4;
SELECT COUNT(*) AS comments FROM comments WHERE task_id = 7;
SELECT COUNT(*) AS members FROM project_members WHERE project_id = 4;
ROLLBACK;
```
До: 1 задача («Корзина покупок», id 7), 1 комментарий, 1 участник. `DELETE 1` — а после все три счётчика `0`. Ни ошибки, ни вопроса: `ON DELETE CASCADE` по цепочке проект → задачи → комментарии и проект → участники. После `ROLLBACK` всё на месте. Журнал `audit_log` каскад не тронул: у него нет внешнего ключа на проекты — `entity_id` просто число.

Комментарии после `DELETE` считаем по `task_id = 7`: задачи уже нет, и `JOIN` с ней ничего не найдёт.
:::

**Задача 19** (джун). Можно ли физически удалить пользователя 5, Екатерину? `DELETE` на `users` не выполняй — ответь по ключам и по данным.

::: details Подсказка
Где упоминается пользователь 5? Посмотри `tasks.assignee_id` и `project_members.user_id` и вспомни правила этих ключей из задач 2 и 3.
:::

::: details Эталон
```sql
SELECT COUNT(*) AS tasks       FROM tasks           WHERE assignee_id = 5;
SELECT COUNT(*) AS memberships FROM project_members WHERE user_id = 5;
```
На начальных данных — 1 и 1. Екатерина — исполнитель задачи «Импорт клиентов», а у `tasks_assignee_id_fkey` правила нет, значит `NO ACTION`: удалить нельзя, пока есть ссылка. PostgreSQL ответил бы ошибкой из теории:
```text
ERROR: update or delete on table "users" violates foreign key constraint "tasks_assignee_id_fkey" on table "tasks"
DETAIL: Key (id)=(5) is still referenced from table "tasks".
```
Участие в проекте 2 удалению бы не помешало: у `project_members` — `CASCADE`, строка участия удалилась бы молча.
:::

**Задача 20** (мидл). А пользователя 7, Ольгу? Проверь все таблицы, которые ссылаются на `users`, — и ответь, пустила бы база `DELETE`.

::: details Подсказка
Четыре запроса `COUNT(*)`: задачи, где она исполнитель; комментарии, где автор; проекты, где владелец; участие в проектах. И журнал — `audit_log.user_id` тоже внешний ключ.
:::

::: details Эталон
```sql
SELECT COUNT(*) AS tasks       FROM tasks           WHERE assignee_id = 7;
SELECT COUNT(*) AS comments    FROM comments        WHERE author_id = 7;
SELECT COUNT(*) AS projects    FROM projects        WHERE owner_id = 7;
SELECT COUNT(*) AS memberships FROM project_members WHERE user_id = 7;
SELECT COUNT(*) AS audit_rows  FROM audit_log       WHERE user_id = 7;
```
На начальных данных все пять — `0`: ссылок нет, внешним ключам нечего защищать, и `DELETE` прошёл бы. На твоём стенде результат может быть другим: если в блоке 2 ты назначал Ольгу исполнителем задачи, сработал бы `tasks_assignee_id_fkey`, как в задаче 19.

Вывод: «можно ли удалить» зависит не от пользователя, а от данных вокруг. Поэтому тест на удаление готовят двумя наборами: родитель без детей и родитель с детьми в каждой таблице-ссылке.
:::

## Часть 2. INSERT, UPDATE, DELETE и транзакции

### INSERT

**Задача 21** (джун). Добавь комментарий к задаче 5 от пользователя 2 и сразу получи его `id`, `created_at` и `deleted_at`. Проверь `SELECT`-ом, откати и проверь снова.

::: details Подсказка
`INSERT … RETURNING`. Проверка — комментарии задачи 5.
:::

::: details Эталон
```sql
BEGIN;
INSERT INTO comments (task_id, author_id, text)
VALUES (5, 2, 'Комментарий из DBeaver')
RETURNING id, task_id, author_id, text, created_at, deleted_at;

SELECT id, author_id, text FROM comments WHERE task_id = 5 ORDER BY id;
ROLLBACK;

SELECT id, author_id, text FROM comments WHERE task_id = 5 ORDER BY id;
```
`RETURNING` — одна строка: новый `id` (на начальных данных — 6), `created_at` — сейчас, `deleted_at` — `NULL`. Первый `SELECT` — 1 строка, второй, после отката, — 0: у задачи 5 в начальных данных комментариев нет.
:::

**Задача 22** (джун). Создай задачу в проекте 1 с исполнителем 3, статусом `TODO` и приоритетом `MEDIUM`. Верни все её столбцы. Какие поля заполнила сама база?

::: details Эталон
```sql
BEGIN;
INSERT INTO tasks (project_id, assignee_id, title, status, priority)
VALUES (1, 3, 'Проверить ограничения', 'TODO', 'MEDIUM')
RETURNING *;
ROLLBACK;
```
База заполнила `id` (на начальных данных — 8) и `created_at`. `description` и `deleted_at` — `NULL`: не указаны, значения по умолчанию нет. `RETURNING *` — все столбцы.
:::

**Задача 23** (мидл). Выполни два раза подряд: вставка комментария с `RETURNING id`, потом `ROLLBACK`. Какие `id` вернулись? Какой сейчас наибольший `id` в `comments`?

```sql
BEGIN;
INSERT INTO comments (task_id, author_id, text)
VALUES (5, 2, 'Первая попытка')
RETURNING id;
ROLLBACK;

BEGIN;
INSERT INTO comments (task_id, author_id, text)
VALUES (5, 2, 'Вторая попытка')
RETURNING id;
ROLLBACK;

SELECT MAX(id) FROM comments;
```

::: details Подсказка
Откатывается ли счётчик `id` вместе с транзакцией?
:::

::: details Эталон
На начальных данных: `6`, потом `7`, а `MAX(id)` — `5`. Счётчик (`serial`) не откатывается: номер, выданный в отменённой транзакции, пропадает. Поэтому **пропуски в `id` — норма**, а не баг и не «удалённые записи». Учти и в тестах: «следующий `id` будет на единицу больше» — ненадёжное ожидание. В задачах 21 и 22 на твоём стенде номера тоже могли быть другими — по той же причине.
:::

### UPDATE

**Задача 24** (джун). Переведи действующие задачи проекта 1 из `TODO` в `IN_PROGRESS`. Сначала `SELECT` с тем же условием. Сравни число строк. Проверь результат и откати.

::: details Эталон
```sql
BEGIN;
SELECT id, title, status
FROM tasks
WHERE project_id = 1 AND status = 'TODO' AND deleted_at IS NULL;

UPDATE tasks
SET status = 'IN_PROGRESS'
WHERE project_id = 1 AND status = 'TODO' AND deleted_at IS NULL;

SELECT id, title, status FROM tasks WHERE project_id = 1 ORDER BY id;
ROLLBACK;
```
`SELECT` — 2 строки: 1 «Создать регистрацию» и 5 «Настроить CI». `UPDATE 2` — совпало. После — все три задачи проекта в `IN_PROGRESS`: задача 2 была в нём и раньше.
:::

**Задача 25** (джун). Что ответит база? Это ошибка?

```sql
BEGIN;
UPDATE tasks SET status = 'DONE' WHERE id = 999;
ROLLBACK;
```

::: details Эталон
`UPDATE 0` — без ошибки. Задачи 999 нет, менять нечего. Для базы это нормально — а для тебя сигнал: условие не нашло ни одной строки. Привычка: после каждого `UPDATE` и `DELETE` смотри на число.
:::

**Задача 26** (джун). Нарочно забудь `WHERE` — внутри транзакции. Сколько задач изменилось? Посмотри распределение по статусам, откати и посмотри снова.

```sql
BEGIN;
UPDATE tasks SET status = 'DONE';
SELECT status, COUNT(*) AS tasks FROM tasks GROUP BY status;
ROLLBACK;
SELECT status, COUNT(*) AS tasks FROM tasks GROUP BY status ORDER BY status;
```

::: details Эталон
`UPDATE 7` — все задачи, включая удалённые, если они есть. Внутри транзакции — одна группа: `DONE`, 7. После `ROLLBACK` — как в начальных данных: `DONE` 2, `IN_PROGRESS` 2, `TODO` 3. Вот почему эксперименты — только в транзакции: без неё вернуть статусы было бы нечем, кроме сброса стенда.
:::

**Задача 27** (джун). Допиши ` (архив)` к названию всех действующих задач проекта 2 и сразу покажи новые названия. Откати.

::: details Подсказка
Новое значение может зависеть от старого: `title || ' (архив)'`. Вернуть изменённые строки — `RETURNING`.
:::

::: details Эталон
```sql
BEGIN;
UPDATE tasks
SET title = title || ' (архив)'
WHERE project_id = 2 AND deleted_at IS NULL
RETURNING id, title;
ROLLBACK;
```
2 строки: «Push-уведомления (архив)», «Двухфакторная аутентификация (архив)». Подумай о границе: если бы название уже было 95 символов, `UPDATE` упал бы на `varchar(100)` — и в транзакции не изменилась бы ни одна задача.
:::

### Мягкое и физическое удаление

**Задача 28** (джун). Мягко удали комментарий 2. Посчитай действующие и все комментарии задачи 1. Появилась ли запись в `audit_log`?

::: details Эталон
```sql
BEGIN;
UPDATE comments SET deleted_at = now()
WHERE id = 2
RETURNING id, text, deleted_at;

SELECT COUNT(*) AS active_comments
FROM comments
WHERE task_id = 1 AND deleted_at IS NULL;

SELECT COUNT(*) AS all_comments
FROM comments
WHERE task_id = 1;

SELECT COUNT(*) AS audit_rows
FROM audit_log
WHERE entity_type = 'comment' AND entity_id = 2;
ROLLBACK;
```
Действующих — 1, всего — 2: строка на месте, текст на месте. Записей в журнале — 0 (если ты не удалял этот комментарий через API в блоке 2). Журнал пишет **API**, а не база. Изменение мимо API в журнал не попадает — и никто потом не узнает, кто и когда удалил комментарий.
:::

**Задача 29** (мидл). Сделай с задачей 1 то же, что API при `DELETE /api/v1/tasks/1`: пометь удалёнными её действующие комментарии и саму задачу. Проверь `deleted_at` у всех. Почему моменты совпадают?

::: details Подсказка
Два `UPDATE` в одной транзакции. Чему равно `now()` внутри транзакции?
:::

::: details Эталон
```sql
BEGIN;
UPDATE comments SET deleted_at = now()
WHERE task_id = 1 AND deleted_at IS NULL;

UPDATE tasks SET deleted_at = now()
WHERE id = 1;

SELECT id, deleted_at FROM tasks WHERE id = 1;
SELECT id, deleted_at FROM comments WHERE task_id = 1 ORDER BY id;
ROLLBACK;
```
`UPDATE 2` и `UPDATE 1`. У задачи и обоих комментариев — **одинаковый** `deleted_at`, даже если между командами ты ждал минуту: `now()` — время начала транзакции. Условие `deleted_at IS NULL` для комментариев важно: уже удалённый раньше комментарий сохранит своё старое время удаления. API TaskFlow получает тот же результат, но по-своему: берёт одно время в коде приложения и ставит его задаче и комментариям. Журнал — `task.delete` — мы не писали: это ещё одно отличие от API.
:::

**Задача 30** (джун). Физически удали комментарий 5 и сразу посмотри, что удалено. Проверь, что строки нет, и откати.

::: details Эталон
```sql
BEGIN;
DELETE FROM comments
WHERE id = 5
RETURNING id, task_id, text;

SELECT COUNT(*) AS comments FROM comments WHERE id = 5;
ROLLBACK;
```
`RETURNING` у `DELETE` возвращает удалённые строки: 5, задача 7, «Готово, покрыто тестами.». Потом `COUNT` — 0: строки нет совсем, в отличие от мягкого удаления.
:::

**Задача 31** (джун). Физически удали задачу 1. Сколько комментариев у неё было и сколько осталось?

::: details Эталон
```sql
BEGIN;
SELECT COUNT(*) AS comments FROM comments WHERE task_id = 1;
DELETE FROM tasks WHERE id = 1;
SELECT COUNT(*) AS comments FROM comments WHERE task_id = 1;
ROLLBACK;
```
Было 2, стало 0 — `comments_task_id_fkey` с `ON DELETE CASCADE`. `DELETE 1` в ответе — только про саму задачу: о каскадно удалённых строках база не сообщает. Их видно только своим `SELECT`.
:::

### Транзакции

**Задача 32** (джун). Передай проект 4 от Алексея (4) Екатерине (5): владелец проекта — 5, Екатерина — участник с ролью `OWNER`, Алексей остаётся участником с ролью `MANAGER`. Три изменения в одной транзакции. Проверь внутри, откати, проверь снаружи.

::: details Подсказка
`UPDATE projects`, `INSERT INTO project_members`, `UPDATE project_members`.
:::

::: details Эталон
```sql
BEGIN;
UPDATE projects SET owner_id = 5 WHERE id = 4;
INSERT INTO project_members (project_id, user_id, role) VALUES (4, 5, 'OWNER');
UPDATE project_members SET role = 'MANAGER' WHERE project_id = 4 AND user_id = 4;

SELECT id, name, owner_id FROM projects WHERE id = 4;
SELECT project_id, user_id, role FROM project_members WHERE project_id = 4 ORDER BY user_id;
ROLLBACK;

SELECT id, owner_id FROM projects WHERE id = 4;
SELECT project_id, user_id, role FROM project_members WHERE project_id = 4 ORDER BY user_id;
```
Внутри: `owner_id = 5`; участники — 4 `MANAGER`, 5 `OWNER`. После отката: `owner_id = 4`, один участник — 4 `OWNER`. Без транзакции ошибка во второй команде оставила бы проект с владельцем 5, который в проекте даже не участник.
:::

**Задача 33** (джун). Та же передача, но с ошибкой во второй команде. Предскажи ответ каждой команды и итоговый `owner_id`.

```sql
BEGIN;
UPDATE projects SET owner_id = 5 WHERE id = 4;
INSERT INTO project_members (project_id, user_id, role) VALUES (4, 4, 'OWNER');
SELECT id, owner_id FROM projects WHERE id = 4;
ROLLBACK;
SELECT id, owner_id FROM projects WHERE id = 4;
```

::: details Подсказка
Пара `(4, 4)` в `project_members` уже есть. Что PostgreSQL делает с транзакцией после ошибки?
:::

::: details Эталон
- `UPDATE 1`.
- `INSERT` — ошибка `duplicate key value violates unique constraint "project_members_pkey"`, `DETAIL: Key (project_id, user_id)=(4, 4) already exists.`
- `SELECT` — ошибка `current transaction is aborted, commands ignored until end of transaction block`.
- `ROLLBACK` — транзакция закрыта.
- Последний `SELECT` — `owner_id = 4`. Первый `UPDATE` тоже отменён.

Это атомарность в действии: одна ошибка — и не сохранилось ничего. Если бы вместо `ROLLBACK` ты выполнил `COMMIT`, PostgreSQL ответил бы `ROLLBACK`: в сломанной транзакции сохранять нечего.
:::

**Задача 34** (мидл). Точка сохранения. Предскажи `status` и `assignee_id` задачи 5 после `ROLLBACK TO SAVEPOINT` и после последнего `ROLLBACK`.

```sql
BEGIN;
UPDATE tasks SET status = 'DONE' WHERE id = 5;
SAVEPOINT before_assignee;
UPDATE tasks SET assignee_id = 999 WHERE id = 5;
ROLLBACK TO SAVEPOINT before_assignee;
SELECT id, status, assignee_id FROM tasks WHERE id = 5;
ROLLBACK;
SELECT id, status, assignee_id FROM tasks WHERE id = 5;
```

::: details Эталон
Второй `UPDATE` — ошибка внешнего ключа `tasks_assignee_id_fkey`. `ROLLBACK TO SAVEPOINT` отменяет только то, что после точки, и «чинит» транзакцию. Первый `SELECT` — `DONE`, `NULL`: изменение статуса до точки сохранилось. После `ROLLBACK` — `TODO`, `NULL`: отменено всё.
:::

**Задача 35** (мидл). Добавь Ивана (2) в проект 3 зрителем прямо в базе. Потом сравни с тем, что сделал бы API: посмотри журнал. Откати.

::: details Подсказка
Какие записи пишет API при `POST /api/v1/projects/{id}/members`? В теории есть таблица «что сверять».
:::

::: details Эталон
```sql
BEGIN;
INSERT INTO project_members (project_id, user_id, role)
VALUES (3, 2, 'VIEWER');

SELECT project_id, user_id, role FROM project_members WHERE project_id = 3 ORDER BY user_id;

SELECT user_id, action, entity_type, entity_id, details
FROM audit_log
WHERE action = 'project_member.add' AND entity_id = 3;
ROLLBACK;
```
Участников проекта 3 — два: 2 `VIEWER`, 3 `OWNER`. А журнал пуст (если в блоке 2 ты не добавлял участников в проект 3). API в той же транзакции записал бы `project_member.add` от владельца проекта: `entity_type = 'project'`, `entity_id = 3`, в `details` — `{"userId": 2, "role": "VIEWER"}`. Журнал TaskFlow для участников ссылается на **проект**, а кого добавили — в `details`.

Вывод: данные через базу «как настоящие», только если повторить **всё**, что делает API. Пропустил журнал — участник есть, а истории нет. Поэтому проще и честнее — через API.
:::

**Задача 36** (джун). Выполни `ROLLBACK;` без `BEGIN` — в Auto-Commit или сразу после предыдущего `ROLLBACK`. Что ответит база? Вернёт ли она что-нибудь?

::: details Эталон
Предупреждение `there is no transaction in progress` — не ошибка. Откатывать нечего, и ничего не вернётся. В Auto-Commit каждое изменение уже сохранено в момент выполнения — поэтому `ROLLBACK` после случайного `UPDATE` в этом режиме бесполезен. Единственный путь назад на своём стенде — сброс.
:::

## Часть 3. API → БД: проверь после действия

Это основной режим работы тестировщика с базой. Действие — в Postman, проверка — в DBeaver, **в подключении только для чтения**. Ничего не меняй в базе руками.

Для каждой ситуации:

- выполни действие в Postman, запиши код ответа и `id`;
- выполни `SELECT`-ы из эталона — подставь свои номера;
- сравни с ожиданием и запиши, что было бы багом.

Числа и номера в ситуациях — для примера: подставь свои. Нужен «чужой» пользователь для добавления в проект — возьми действующего **обычного** пользователя, не себя и не администратора: глобальный `ADMIN` в проекте всегда получает роль `ADMIN`, какую бы роль ты ни передал.

**Ситуация 1.** `POST /api/v1/projects` с телом `{"name": "Проверка БД", "description": "Урок 5"}`. Ответ — `201`, `"id": 5`.

::: details Эталон
```sql
SELECT id, name, description, status, owner_id, created_at, deleted_at
FROM projects
WHERE id = 5;

SELECT project_id, user_id, role, created_at
FROM project_members
WHERE project_id = 5;

SELECT id, user_id, action, entity_type, entity_id, details, created_at
FROM audit_log
WHERE entity_type = 'project' AND entity_id = 5
ORDER BY id;
```
Ожидаю: название и описание как в запросе, `status = 'ACTIVE'`, `owner_id` — мой `id`, `deleted_at` — `NULL`, `created_at` — только что, в UTC. В `project_members` — одна строка: я, `OWNER`. В журнале — одна запись `project.create` от меня, `details` — `NULL`: при создании детали не пишутся.

Багом будет: нет строки владельца в участниках — проект «без хозяина», в списке «мои проекты» его не будет; две записи в журнале; `created_at` в другом поясе.
:::

**Ситуация 2.** Перед действием сделай «снимок» задач проекта. Потом `PATCH /api/v1/tasks/5` с телом `{"status": "DONE"}`. Ответ — `200`.

::: details Эталон
```sql
-- до и после действия — один и тот же запрос
SELECT id, project_id, assignee_id, title, description, status, priority, deleted_at
FROM tasks
WHERE project_id = 1
ORDER BY id;

SELECT id, user_id, action, details, created_at
FROM audit_log
WHERE entity_type = 'task' AND entity_id = 5
ORDER BY id DESC
LIMIT 3;
```
Ожидаю: у задачи 5 изменился только `status`. Остальные поля задачи 5 и все поля других задач проекта — как в снимке. В журнале — `task.update`, в `details` — `{"status": "DONE"}`, только переданное поле.

Сравнение «до и после» — главный способ поймать «соседей». Сохрани результат первого запроса — в DBeaver можно закрепить вкладку результата или скопировать строки — и сравни со вторым.
:::

**Ситуация 3.** Граница длины. `PATCH /api/v1/projects/5` с `name` из 100 символов, потом — из 101.

::: details Эталон
```sql
SELECT id, length(name) AS len, name
FROM projects
WHERE id = 5;

SELECT id, action, details, created_at
FROM audit_log
WHERE entity_type = 'project' AND entity_id = 5
ORDER BY id DESC
LIMIT 3;
```
Ожидаю: 100 символов — `200`, в базе `len = 100`, строка не обрезана; в журнале — `project.update`. 101 символ — `422 VALIDATION_ERROR`, в базе — по-прежнему старое название, новой записи в журнале нет.

Багом будет: `500` на 101 символ — значит, API не проверил длину и упал о `varchar(100)`; `200` на 101 символ и название, обрезанное до 100, — данные потеряны молча.
:::

**Ситуация 4.** `POST /api/v1/projects/5/members` с телом `{"userId": 4, "role": "MANAGER"}`. Ответ — `201`.

::: details Эталон
```sql
SELECT pm.project_id, pm.user_id, u.first_name, u.last_name, pm.role, pm.created_at
FROM project_members pm
JOIN users u ON u.id = pm.user_id
WHERE pm.project_id = 5
ORDER BY pm.user_id;

SELECT id, user_id, action, entity_type, entity_id, details, created_at
FROM audit_log
WHERE action = 'project_member.add' AND entity_id = 5
ORDER BY id DESC;
```
Ожидаю: в проекте двое — я `OWNER` и пользователь 4 `MANAGER`. В журнале — `project_member.add`, `entity_type = 'project'`, `entity_id = 5`, в `details` — `{"userId": 4, "role": "MANAGER"}`.
:::

**Ситуация 5.** Повтори запрос из ситуации 4 ещё раз — того же пользователя в тот же проект.

::: details Эталон
По спецификации — `409`, `error.code = MEMBER_ALREADY_EXISTS`.

```sql
SELECT COUNT(*) AS rows_for_pair
FROM project_members
WHERE project_id = 5 AND user_id = 4;

SELECT COUNT(*) AS add_events
FROM audit_log
WHERE action = 'project_member.add' AND entity_id = 5;
```
Ожидаю: `rows_for_pair = 1`, `add_events` — столько же, сколько после ситуации 4.

Почему база дубль бы не пустила в любом случае: `(project_id, user_id)` — составной первичный ключ, ошибка `duplicate key value violates unique constraint "project_members_pkey"` — ты видел её в задаче 11. API проверяет повтор **до** записи и отвечает понятным `409`. Багом будет: `500` — проверку в коде убрали, и API «упал» о ключ; `201` и вторая запись в журнале без второй строки участника — журнал врёт.
:::

**Ситуация 6.** `POST /api/v1/projects/5/members` с телом `{"userId": 6}` — без роли. Ответ — `201`.

::: details Эталон
```sql
SELECT project_id, user_id, role
FROM project_members
WHERE project_id = 5 AND user_id = 6;
```
Ожидаю: `role = 'VIEWER'` — по спецификации роль по умолчанию. Помнишь задачу 6: в базе значения по умолчанию у `role` нет — его подставляет API. Багом будет: `422` вместо подстановки роли или любая другая роль.
:::

**Ситуация 7.** `DELETE /api/v1/projects/5/members/6`. Ответ — `204`.

::: details Эталон
```sql
SELECT COUNT(*) AS rows_for_pair
FROM project_members
WHERE project_id = 5 AND user_id = 6;

SELECT user_id, action, details, created_at
FROM audit_log
WHERE action = 'project_member.remove' AND entity_id = 5
ORDER BY id DESC;
```
Ожидаю: `rows_for_pair = 0` — участник удалён **физически**: у `project_members` нет `deleted_at`. В журнале — `project_member.remove` с `{"userId": 6}`. Здесь мягкого удаления и нет по устройству — это не баг. Значит, история участия есть только в журнале.
:::

**Ситуация 8.** Подготовь задачу с двумя комментариями. Удали через API **один** комментарий, подожди минуту и удали саму задачу: `DELETE /api/v1/tasks/{id}`. Оба ответа — `204`.

::: details Эталон
```sql
SELECT id, deleted_at FROM tasks WHERE id = 41;

SELECT id, deleted_at
FROM comments
WHERE task_id = 41
ORDER BY id;

SELECT action, entity_type, entity_id, created_at
FROM audit_log
WHERE (entity_type = 'task' AND entity_id = 41)
   OR (entity_type = 'comment' AND action = 'comment.delete')
ORDER BY id DESC
LIMIT 5;
```
`41` — номер твоей задачи. Ожидаю: у задачи `deleted_at` заполнен. У второго комментария — **тот же** момент, что у задачи: каскад мягкого удаления. У первого — **свой, более ранний** момент: он был удалён раньше, и удаление задачи его не перезаписало. В журнале — `comment.delete`, потом `task.delete`.

Багом будет: второй комментарий остался действующим у удалённой задачи; первый получил новое время удаления — история искажена.
:::

**Ситуация 9.** `DELETE /api/v1/projects/5` — удали проект из ситуаций 1–7. Ответ — `204`. Перед этим создай в нём хотя бы одну задачу.

::: details Эталон
```sql
SELECT id, name, deleted_at FROM projects WHERE id = 5;

SELECT id, title, deleted_at FROM tasks WHERE project_id = 5 ORDER BY id;

SELECT c.id, c.task_id, c.deleted_at
FROM comments c
JOIN tasks t ON t.id = c.task_id
WHERE t.project_id = 5
ORDER BY c.id;

SELECT project_id, user_id, role FROM project_members WHERE project_id = 5 ORDER BY user_id;

SELECT user_id, action, details, created_at
FROM audit_log
WHERE entity_type = 'project' AND entity_id = 5
ORDER BY id;
```
Ожидаю: у проекта, его задач и их комментариев — один и тот же `deleted_at`. Строки физически на месте. Участники в `project_members` **остались** — код их не трогает, это по устройству. В журнале последней — `project.delete` с `{"cascadedTasks": N}`, где `N` — число задач, которые были действующими.

Багом будет: задачи живы у удалённого проекта; `cascadedTasks` не совпадает с числом задач, которые пометили; разное время удаления.
:::

**Ситуация 10.** Без действия в API. Проверь, как хранятся пароли.

::: details Эталон
```sql
SELECT id, email, left(password_hash, 7) AS hash_start, length(password_hash) AS hash_len
FROM users
ORDER BY id;

SELECT COUNT(*) AS users_with_same_hash
FROM users
GROUP BY password_hash
HAVING COUNT(*) > 1;
```
Ожидаю: у всех `hash_start = '$2b$12$'`, `hash_len = 60` — это формат bcrypt, алгоритма хеширования паролей. Второй запрос — пусто: у шести пользователей начальных данных одинаковый пароль, но хеши разные — к каждому паролю перед хешированием добавляется случайная «соль».

Багом будет: пароль открытым текстом; одинаковые хеши у одинаковых паролей — нет соли, взломать проще; хеш виден в каком-нибудь ответе API.
:::

**Ситуация 11.** Обязательные поля и `null`. В спецификации (`docs/API_SPEC.md`, раздел 6) есть правило для частичного обновления: обязательные поля можно не передавать, но явный `null` в них — ошибка валидации. Найди это правило для задач и для проектов и проверь оба эндпоинта:

- `PATCH /api/v1/tasks/{id}` — по очереди `{"title": null}`, `{"status": null}`, `{"priority": null}`;
- `PATCH /api/v1/projects/{id}` — по очереди `{"name": null}`, `{"status": null}`.

Возьми свою действующую задачу и проект, где у тебя есть права на изменение. Проект 5 после ситуации 9 удалён — создай новый.

::: details Эталон
Перед запросами и после каждого — снимок строки:

```sql
SELECT id, title, description, status, priority, deleted_at
FROM tasks
WHERE id = 42;

SELECT id, name, description, status, deleted_at
FROM projects
WHERE id = 6;

SELECT id, action, entity_type, entity_id, details, created_at
FROM audit_log
WHERE (entity_type = 'task' AND entity_id = 42)
   OR (entity_type = 'project' AND entity_id = 6)
ORDER BY id DESC
LIMIT 5;
```
`42` и `6` — номера твоих задачи и проекта.

Ожидаю по спецификации: на каждый запрос — `422`, `error.code = VALIDATION_ERROR`. В базе строка не изменилась: ни `NULL`, ни пустого значения в обязательном поле. В журнале нет новой записи `task.update` или `project.update`.

Для каждого запроса запиши: код ответа, `error.code`, что показал снимок. Если поведение хотя бы одного эндпоинта расходится со спецификацией — это находка: оформи баг-репорт с запросом, ответом и результатом `SELECT`.
:::

## Часть 4. Эксперименты: база и API вместе

Три эксперимента показывают, как транзакция в DBeaver выглядит со стороны API. Нужны оба инструмента: DBeaver — **подключение для записи**, Manual Commit; Postman — как в блоке 2.

**Эксперимент 1** (джун). Незакоммиченное видно только тебе.

1. В DBeaver:
   ```sql
   BEGIN;
   UPDATE tasks SET title = 'Черновик из DBeaver' WHERE id = 5;
   SELECT id, title FROM tasks WHERE id = 5;
   ```
   **Не откатывай пока.**
2. В Postman — `GET /api/v1/tasks/5` от пользователя с доступом к задаче: администратора или Ивана — менеджера проекта 1.
3. Сравни названия. Потом в DBeaver — `ROLLBACK;`.

::: details Эталон
DBeaver показывает «Черновик из DBeaver», API — «Настроить CI». API работает через **своё** подключение к базе, а незакоммиченные изменения видны только в том подключении, где сделаны. Если бы ты выполнил `COMMIT`, API сразу увидел бы новое название.

Вывод для работы: «я поменял в базе, а API показывает старое» — первым делом проверь, закоммичено ли изменение.
:::

**Эксперимент 2** (мидл). Открытая транзакция держит строку.

1. В DBeaver:
   ```sql
   BEGIN;
   UPDATE tasks SET title = 'Черновик из DBeaver' WHERE id = 5;
   ```
   **Не откатывай.**
2. В Postman — `PATCH /api/v1/tasks/5` с телом `{"title": "Название из Postman"}` от администратора или Ивана. Посмотри, что происходит с запросом.
3. Через 10–20 секунд в DBeaver — `ROLLBACK;`. Посмотри на Postman.
4. В DBeaver: `SELECT id, title FROM tasks WHERE id = 5;`

::: details Эталон
Запрос в Postman **висит** — ответа нет. Строку задачи 5 держит твоя транзакция, и `UPDATE` от API ждёт, пока её отпустят. После `ROLLBACK` Postman сразу получает `200`, а в базе — «Название из Postman».

Если Postman успел оборвать запрос по своему тайм-ауту — повтори опыт быстрее.

Вывод: забытая открытая транзакция в DBeaver выглядит как «API завис». На общем стенде это мешает всей команде. Это изменение сделано через API — оно законное, в журнале есть `task.update`. Верни название тем же `PATCH`, если хочешь.
:::

**Эксперимент 3** (джун). Данные мимо API и сброс стенда. **Этот эксперимент закоммитит изменения**, а потом сбросит стенд — все твои данные, включая данные блока 2, пропадут. Не готов — только прочитай эталон.

1. В DBeaver:
   ```sql
   BEGIN;
   INSERT INTO comments (task_id, author_id, text)
   VALUES (5, 2, 'Комментарий мимо API')
   RETURNING id;
   COMMIT;
   ```
2. В Postman — `GET /api/v1/tasks/5/comments` и `GET /api/v1/tasks/5`: виден ли комментарий, какой `commentsCount`?
3. В DBeaver: есть ли запись `comment.create` в `audit_log` для этого `id`? Потом нажми **Rollback** или выполни `ROLLBACK;`: в Manual Commit даже `SELECT` открывает транзакцию, а открытая транзакция не даст сбросу очистить таблицы — запрос сброса будет ждать.
4. Сбрось стенд: `POST /api/v1/admin/reset` от администратора — ответ `204`.
5. В DBeaver — проверь, что стенд вернулся в исходное состояние:
   ```sql
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM projects;
   SELECT COUNT(*) FROM tasks;
   SELECT COUNT(*) FROM comments;
   SELECT COUNT(*) FROM project_members;
   SELECT action, entity_type FROM audit_log;
   ```

::: details Эталон
Шаг 2: комментарий виден в API, `commentsCount` вырос на 1 — для API это обычный комментарий. Шаг 3: записи в журнале **нет**: «кто и когда написал» — неизвестно. Так выглядят данные мимо API: работают, но без истории и без проверок.

Шаг 5: `7`, `4`, `7`, `5`, `7` — начальные данные. В журнале одна строка: `admin.reset`, `database`. Твоего комментария нет. Если сбрасывал пересозданием контейнеров — журнал пустой.
:::

## Часть 5. Задачи на внимательность

Задачу на изменение данных тоже дают словами: «удали все отменённые», «пометь клиента удалённым». Написать `UPDATE` несложно. Сложно — **заметить подвох**: что именно значит «удали», не заденет ли команда лишнее, пропустит ли её база.

В каждой задаче сначала прочитай условие и спроси себя: «что тут может пойти не так?» Потом открой «О чём подумать» — там 2–3 строки о подвохе. Пиши запрос внутри `BEGIN … ROLLBACK`.

**Задача 37** (джун). «Удали все задачи проекта Mobile Banking».

::: details О чём подумать
- В TaskFlow «удалить» — значит мягко: `deleted_at`, а не `DELETE`. `DELETE` ещё и физически заберёт комментарии каскадом.
- API при удалении задачи помечает и её комментарии. Их тоже не забудь.
:::

::: details Эталон
```sql
BEGIN;
-- 1. Что удаляем
SELECT id, title FROM tasks WHERE project_id = 2 AND deleted_at IS NULL;

-- 2. Комментарии этих задач — по номерам из шага 1
UPDATE comments SET deleted_at = now()
WHERE task_id IN (3, 6) AND deleted_at IS NULL;

-- 3. Сами задачи
UPDATE tasks SET deleted_at = now()
WHERE project_id = 2 AND deleted_at IS NULL;
ROLLBACK;
```
На начальных данных: задачи 3 и 6, `UPDATE 1` для комментариев — у задачи 6 один комментарий — и `UPDATE 2` для задач. Через API это были бы два вызова `DELETE /api/v1/tasks/{id}` — и с журналом.
:::

**Задача 38** (джун). «Переведи все задачи в статусе TODO в работу».

::: details О чём подумать
- «Все» — во всех проектах? Проверь число строк заранее — вдруг их сотни.
- Удалённые задачи переводить незачем.
:::

::: details Эталон
```sql
BEGIN;
SELECT project_id, COUNT(*) AS todo
FROM tasks
WHERE status = 'TODO' AND deleted_at IS NULL
GROUP BY project_id
ORDER BY project_id;

UPDATE tasks
SET status = 'IN_PROGRESS'
WHERE status = 'TODO' AND deleted_at IS NULL;
ROLLBACK;
```
На начальных данных — проект 1: 2 задачи, проект 3: 1. `UPDATE 3`. Если «все» оказалось неожиданно большим числом — уточни у того, кто просил, а не выполняй.
:::

**Задача 39** (джун). «Удали комментарий Дмитрия к задаче "Двухфакторная аутентификация"».

::: details О чём подумать
- «Удали» в TaskFlow — мягко: `UPDATE … SET deleted_at`, а не `DELETE`.
- Меняй по `id` комментария, найденному заранее, а не по имени автора: у Дмитрия может быть несколько комментариев.
:::

::: details Эталон
```sql
BEGIN;
SELECT c.id, c.text, c.deleted_at
FROM comments c
JOIN users u ON u.id = c.author_id
JOIN tasks t ON t.id = c.task_id
WHERE u.first_name = 'Дмитрий'
  AND t.title = 'Двухфакторная аутентификация';

UPDATE comments SET deleted_at = now()
WHERE id = 4
RETURNING id, text, deleted_at;
ROLLBACK;
```
На начальных данных — один комментарий, `id = 4`, «Нужно выбрать провайдера OTP.». `UPDATE` — по `id` из `SELECT`. Через API это `DELETE /api/v1/tasks/6/comments/4` — с журналом.
:::

**Задача 40** (джун). «Перенеси задачу "Настроить CI" в проект 7».

::: details О чём подумать
- Проекта 7 может не быть — внешний ключ не пустит.
- **Мидл:** а если проект есть, но удалён? Внешний ключ про `deleted_at` не знает — проверь сам.
:::

::: details Эталон
```sql
BEGIN;
SELECT id, name, deleted_at FROM projects WHERE id = 7;
SELECT id, title, project_id FROM tasks WHERE title = 'Настроить CI';
ROLLBACK;
```
На начальных данных проекта 7 нет: `SELECT` пустой, а `UPDATE tasks SET project_id = 7 WHERE id = 5` упадёт с `violates foreign key constraint "tasks_project_id_fkey"` и `DETAIL: Key (project_id)=(7) is not present in table "projects".` Правильный ответ на задачу — не запрос, а вопрос: «Проекта 7 нет — в какой проект переносить?»
:::

**Задача 41** (джун). «Добавь Анну в проект Mobile Banking менеджером».

::: details О чём подумать
- Роль — значение enum-типа: `'MANAGER'`, а не `'Manager'` или «менеджер».
- Вдруг Анна уже участник?
:::

::: details Эталон
```sql
BEGIN;
SELECT id, first_name, last_name FROM users WHERE first_name = 'Анна';
SELECT id, name FROM projects WHERE name = 'Mobile Banking';
SELECT project_id, user_id, role FROM project_members WHERE project_id = 2 AND user_id = 3;

INSERT INTO project_members (project_id, user_id, role)
VALUES (2, 3, 'MANAGER')
RETURNING project_id, user_id, role;
ROLLBACK;
```
Анна — 3, проект — 2, участия нет — вставка проходит. С `'Manager'` была бы ошибка `invalid input value for enum projectrole: "Manager"`. Через API — `POST /api/v1/projects/2/members` от владельца проекта: и роль проверит, и журнал запишет.
:::

**Задача 42** (джун). «Отмени последние изменения» — коллега выполнил в DBeaver `UPDATE` пять минут назад и просит помочь.

::: details О чём подумать
- В каком режиме он работал? В Auto-Commit изменение уже сохранено.
- `ROLLBACK` откатывает только **открытую** транзакцию.
:::

::: details Эталон
Сначала — вопрос: Auto-Commit или Manual Commit?

- **Manual Commit, не коммитил** — нажать **Rollback** или выполнить `ROLLBACK;` в том же редакторе. Изменения исчезнут.
- **Auto-Commit или уже закоммичено** — `ROLLBACK` ответит `there is no transaction in progress` и ничего не вернёт. Дальше: на своём стенде — сброс; на общем — сказать команде и восстанавливать из резервной копии или исходных данных, как в разборе 1.

Запрос «обратный» по памяти — плохой план: старые значения ты не знаешь точно.
:::

**Задача 43** (джун). «Назначь Ивана на все задачи без исполнителя».

::: details О чём подумать
- «Без исполнителя» — `assignee_id IS NULL`. С `= NULL` условие не совпадёт ни с одной строкой.
- Удалённые задачи назначать незачем.
:::

::: details Эталон
```sql
BEGIN;
UPDATE tasks SET assignee_id = 2
WHERE assignee_id = NULL;                          -- UPDATE 0: ловушка

UPDATE tasks SET assignee_id = 2
WHERE assignee_id IS NULL AND deleted_at IS NULL
RETURNING id, title;
ROLLBACK;
```
Первый — `UPDATE 0` без ошибки: сравнение с `NULL` никогда не истинно. Второй — 1 строка: задача 5 «Настроить CI». Вот где спасает привычка смотреть на число строк.
:::

**Задача 44** (мидл). «Убери Анну из всех проектов».

::: details О чём подумать
- В каких проектах она и с какой ролью? Если она владелец — проект останется без владельца-участника.
- API это запрещает — `409 LAST_PROJECT_OWNER`. А база?
:::

::: details Эталон
```sql
BEGIN;
SELECT project_id, role FROM project_members WHERE user_id = 3 ORDER BY project_id;

DELETE FROM project_members WHERE user_id = 3;

SELECT project_id, user_id, role FROM project_members WHERE project_id = 3;
SELECT id, name, owner_id FROM projects WHERE id = 3;
ROLLBACK;
```
Анна — `VIEWER` в проекте 1 и `OWNER` в проекте 3. База удаляет обе строки — `DELETE 2`: правила «у проекта есть `OWNER`» в базе нет. Итог: у проекта 3 нет ни одного участника, а `owner_id` по-прежнему 3. Через API удалить последнего владельца нельзя — `409 LAST_PROJECT_OWNER`. Это правило живёт только в коде — и мимо API нарушается одной командой.
:::

**Задача 45** (мидл). «Поставь всем задачам проекта TaskFlow Backend статус "Готово"».

::: details О чём подумать
- «Готово» — это `DONE`. Какой текст статуса хранится в базе?
- Пропустит ли база `'Готово'`? Вспомни задачу 17.
:::

::: details Эталон
```sql
BEGIN;
UPDATE tasks SET status = 'DONE'
WHERE project_id = 1 AND deleted_at IS NULL
RETURNING id, status;
ROLLBACK;
```
3 строки: задачи 1, 2, 5. С `'Готово'` база **тоже** сказала бы `UPDATE 3` — без единой ошибки, ведь `CHECK` на статус нет. А в базе появилось бы значение, которого API не знает. Подвох в том, что ошибку здесь ловит не база, а только твоё внимание.
:::

**Задача 46** (джун). «Переименуй проект Online Store в "Интернет-магазин"».

::: details О чём подумать
- Название проекта не уникально: проектов «Online Store» может быть несколько, в том числе удалённых.
- Меняй по `id`, найденному заранее.
:::

::: details Эталон
```sql
BEGIN;
SELECT id, name, deleted_at FROM projects WHERE name = 'Online Store';

UPDATE projects SET name = 'Интернет-магазин'
WHERE id = 4
RETURNING id, name;
ROLLBACK;
```
На начальных данных — один проект, `id = 4`. Если бы `SELECT` вернул два — сначала уточнить, какой из них. `WHERE name = 'Online Store'` в `UPDATE` переименовал бы все — и удалённые тоже.
:::

## Часть 6 (мидл, письменно). Чек-лист для фичи «Перевод бонусов»

Выдуманная фича интернет-магазина. У клиента есть бонусный счёт. Клиент может перевести бонусы другому клиенту по номеру телефона.

Как устроено:

- таблица `bonus_accounts`: `customer_id`, `balance` — целое, `updated_at`;
- таблица `bonus_transfers`: `id`, `from_customer_id`, `to_customer_id`, `amount`, `status` (`DONE`, `FAILED`), `created_at`;
- журнал `audit_log`, как в TaskFlow;
- `POST /api/v1/bonus-transfers` с телом `{"toPhone": "+79990001122", "amount": 500}`;
- требования: сумма от 1 до 10 000; нельзя перевести больше, чем на счёте; нельзя перевести самому себе; получатель — действующий клиент.

Напиши:

1. **15–20 проверок базы** для этой фичи. Для каждой — что делаешь, что проверяешь в базе и что будет багом. Покрой: данные после перевода, ограничения в схеме, транзакцию, одновременные запросы, журнал, ошибочные запросы и откат, удалённых клиентов.
2. **5 первоочередных** — что проверишь первым при нехватке времени, и почему по риску.

::: details Пример нескольких проверок — не подглядывай, пока не напишешь свои
- Успешный перевод 500: у отправителя `balance` −500, у получателя +500, **сумма балансов двух клиентов не изменилась**. Одна строка в `bonus_transfers` со статусом `DONE`.
- Перевод больше остатка: ответ `4xx`, балансы не изменились, нет «половины» — списания без зачисления.
- Сбой посередине — например, получатель удалён между проверкой и записью: в базе ни списания, ни зачисления.
- В схеме есть ограничение `balance >= 0` — иначе одновременные запросы могут увести баланс в минус.
- Два одновременных перевода по 600 при балансе 1000: успешен только один, итоговый баланс не отрицательный, и ни одно изменение не потеряно.
- `amount` 0, −1, 10 001 — `422`, в базе ничего нового; 1 и 10 000 — проходят.
- Перевод самому себе — `422`, балансы и журнал не тронуты.
- Журнал: одна запись на успешный перевод, с отправителем, получателем и суммой; на ошибочный — ничего или запись об отказе, как в требованиях.

Первоочередные — те, где ошибка стоит денег: сохранение суммы балансов, отрицательный баланс при одновременных запросах, «половина» перевода при сбое.
:::

## Как сдавать

Оформи результат в документе и покажи куратору лично — в чат или на созвоне.

Что должно быть в результате:

- часть 1: 20 задач — твоё предсказание, запрос, скриншот результата или ошибки из DBeaver. Где предсказание не совпало — одной строкой, почему;
- часть 2: 16 задач — запросы и результаты. Где числа не совпали с эталоном — объяснение;
- часть 3: 11 ситуаций — код ответа API, запросы, скриншоты из Postman и DBeaver, вывод «баг / не баг»;
- часть 4: три эксперимента — скриншоты и объяснение своими словами. Если эксперимент 3 не выполнял — объясни, что бы произошло;
- часть 5: 10 запросов, к каждому — одной строкой, какой подвох ты заметил;
- часть 6: чек-лист и пять первоочередных проверок с объяснением.

</template>

<template #questions>

## Ситуационные кейсы

Это рабочие ситуации, о которых могут спросить и на собеседовании. Готового ответа, который нужно угадать, здесь нет. Сначала подумай сам, потом открывай разбор.

::: details Кейс 1. «Зачем проверять базу, если API вернул 201?»
**Ситуация.** Интервьюер: «Вы создали заказ через API, пришёл `201` и тело с данными заказа. Зачем ещё лезть в базу?»

**Как рассуждать.** Что гарантирует ответ API? Что может быть записано не так, хотя ответ правильный? Какие изменения ответ вообще не показывает?

**Пример ответа.** `201` — это то, что сервер **сказал**, а не то, что он записал. Тело ответа часто собирается из объекта в памяти, а не перечитывается из базы. Поэтому в базе может оказаться другое: обрезанная строка, время в другом поясе, `NULL` вместо значения по умолчанию.

И главное — ответ не показывает побочных эффектов. Создание заказа — это ещё позиции, списание остатка, запись в журнале. Ответ про них молчит. Плюс «соседи»: не задел ли запрос чужие записи.

Поэтому проверяю по схеме: строка по `id` из ответа — каждое поле; связанные таблицы; журнал; соседние записи. Не для каждого теста, а для новых фич, изменений схемы и всего, что связано с деньгами и правами.
:::

::: details Кейс 2. «Чем DELETE отличается от мягкого удаления? Как это проверить?»
**Ситуация.** Интервьюер: «В требованиях написано: "пользователь может удалить комментарий". Как проверите, что удаление работает правильно?»

**Как рассуждать.** Что физически происходит со строкой в каждом случае? Что должно случиться с удалённым в API, в списках, в счётчиках?

**Пример ответа.** Сначала выясню, какое удаление по требованиям. **Физическое** — `DELETE`, строки больше нет; вернуть можно только из резервной копии; связанные записи ведут себя по правилу внешнего ключа — каскад, запрет или `NULL`. **Мягкое** — `UPDATE … SET deleted_at = now()`: строка на месте, приложение её прячет.

Проверка мягкого удаления:

- в базе строка есть, текст не стёрт, `deleted_at` заполнен — ровно у неё одной;
- через API — `404` на `GET` по `id`, в списках её нет, счётчики уменьшились;
- повторное удаление — `404`, а не второе время удаления;
- журнал — одна запись.

Проверка физического: строки нет, дети — по правилу внешнего ключа. И отдельно: ничего лишнего не удалилось каскадом.
:::

::: details Кейс 3. «Что такое транзакция? Пример из жизни. ACID»
**Ситуация.** Интервьюер: «Объясните, что такое транзакция, и расшифруйте ACID».

**Как рассуждать.** Пример, где «половина операции» — катастрофа. Четыре буквы — по одному предложению и примеру.

**Пример ответа.** Транзакция — группа операций, которая выполняется **целиком или никак**. Пример — перевод денег: списать с одного счёта и зачислить на другой. Если после списания сбой — откат, деньги остаются на месте. Команды: `BEGIN` — начать, `COMMIT` — сохранить, `ROLLBACK` — отменить.

ACID:

- **Atomicity** — атомарность: всё или ничего;
- **Consistency** — согласованность: после транзакции соблюдены все ограничения;
- **Isolation** — изолированность: параллельные транзакции не видят незавершённых изменений друг друга;
- **Durability** — долговечность: после `COMMIT` данные переживут сбой.

Как тестировщику мне это важно в двух местах. Сам пользуюсь транзакциями для экспериментов на своём стенде — `BEGIN … ROLLBACK`. И проверяю атомарность фич: устраиваю сбой посередине операции и смотрю, не осталось ли в базе «половины».
:::

::: details Кейс 4. Хитрый вопрос: «API принимает 255 символов, а в базе varchar(100). Что будет? Чей баг?»
**Ситуация.** Интервьюер: «Поле "тема" — в спецификации до 255 символов, API так и проверяет, а в базе `varchar(100)`. Что увидит пользователь? И кто виноват — бэкенд или база?»

**Как рассуждать.** Что произойдёт с запросом на 50, 100, 101, 255 символов? Где он остановится? Какой код ответа? Какой источник — правда?

**Пример ответа.** До 100 символов — всё работает. 101–255 — валидация API пропускает, а база отвергает: `value too long for type character varying(100)`. API такую ошибку не ожидал — пользователь получит `500`. Строка не сохранится.

«Чей баг» — не про виноватого, а про расхождение: валидация и схема не совпадают. Это один баг на систему. В отчёте описываю факты: спецификация — 255, API принимает 255, в базе — 100, на 101 символе — `500`. Какой источник правильный — решают аналитик и команда: расширить столбец или ужесточить валидацию. Мне важно, чтобы после исправления границы совпадали, и я проверю `n` и `n + 1` на обоих уровнях.

Отдельно отмечу: `500` в ответ на данные клиента — уже баг сам по себе. Даже если граница 100 правильная, пользователь должен получить `422` с понятным текстом.
:::

::: details Кейс 5. Хитрый вопрос: «Поправь данные на общем стенде через UPDATE»
**Ситуация.** Разработчик пишет: «У заказа 4512 статус не тот, поправь в базе: `UPDATE orders SET status = 'PAID'`, мне некогда». Стенд общий, тестирует вся команда.

**Как рассуждать.** Что не так с самим запросом? Что может сломаться у других? Какие правила работы с общим стендом?

**Пример ответа.** Во-первых, в запросе нет `WHERE` — он поменяет статус **всем** заказам. Это первое, что скажу разработчику.

Во-вторых, даже с правильным условием я бы:

1. Уточнил, зачем: это подготовка данных для теста или «починка» бага? Если баг привёл заказ в неверный статус — сначала баг-репорт, а данные чинить потом, иначе пропадёт доказательство.
2. Проверил, можно ли сделать то же через API или интерфейс — тогда отработает бизнес-логика: журнал, уведомления, связанные таблицы.
3. Если всё же база: `BEGIN`, `SELECT` с тем же `WHERE` — ровно одна строка, `UPDATE`, проверка `SELECT`-ом, `COMMIT`. В Manual Commit.
4. Написал в общий чат: что, где и зачем изменил. Записал старое значение — чтобы можно было вернуть.

Не стал бы: выполнять чужой запрос вслепую в автокоммите и молчать.
:::

::: details Кейс 6. «Как проверить, что операция атомарна?»
**Ситуация.** Интервьюер: «Фича "оформить заказ": создаётся заказ, его позиции и списывается остаток со склада. Как вы проверите, что это всё или ничего?»

**Как рассуждать.** Как вызвать сбой посередине, не имея доступа к коду? Что искать в базе после сбоя?

**Пример ответа.** Сначала успешный сценарий: после заказа в базе есть заказ, все позиции, остатки уменьшены ровно на количество.

Потом — сбой посередине. Способы, доступные тестировщику:

- последняя позиция заведомо невалидна: несуществующий товар, количество больше остатка;
- внешняя зависимость недоступна: сервис оплаты выключен на стенде или замокан на ошибку;
- данные меняются между проверкой и записью: товар сняли с продажи параллельным запросом.

После ответа с ошибкой проверяю в базе: нет заказа, нет позиций, остатки не изменились, в журнале нет записи об успехе. Ищу «сирот»: заказы без позиций, позиции без заказа — `LEFT JOIN … WHERE … IS NULL`.

И одновременность: два заказа последней единицы товара сразу. Успешен должен быть один, остаток — не отрицательный.
:::

## Вопросы для собеседования

<InterviewTrainer topic="bd/testirovanie-bd" />

</template>
</LessonTabs>
