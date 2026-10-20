# Агрегаты, GROUP BY, HAVING

<LessonTabs>
<template #theory>

## Простыми словами

До сих пор запрос возвращал строки как есть: десять задач — десять строк, отфильтровал — стало пять. Но часто нужна не сама таблица, а **итог**: сколько задач, какая сумма, какая средняя оценка.

Представь кассира в конце смены. Начальник не просит распечатать все 120 чеков. Он спрашивает: «Сколько чеков? Какая выручка?» — и получает две цифры: 120 чеков, 85 000 рублей. **Агрегатная функция** делает то же: «сворачивает» много строк в одно число.

А если касс несколько, начальник просит: «По каждому кассиру отдельно». Чеки раскладывают **по стопкам** — у каждого кассира своя — и считают в каждой стопке. Это **`GROUP BY`**.

И последний шаг: «Покажи только тех кассиров, у кого выручка больше 50 000». Стопки уже посчитаны — лишние откладываем. Это **`HAVING`**.

В этом уроке разберём:

- агрегатные функции: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`;
- **`NULL` в агрегатах — главная ловушка урока**: почему `COUNT(*)` и `COUNT(столбец)` дают разные числа, а сумма пустого набора — не ноль;
- округление и деление целых — коротко, для мидла;
- **`GROUP BY`**: по одной строке на группу и правило «всё, что не агрегат, — в `GROUP BY`»;
- **`HAVING` и `WHERE`**: кто фильтрует строки, а кто группы;
- «топ-N» через `ORDER BY` и `LIMIT` и ловушку ничьей;
- **мидл: агрегаты вместе с `JOIN`** — откуда берётся «проект без задач, а задач 1» и почему сумма в отчёте бывает вдвое больше;
- условные подсчёты: «сколько задач в каждом статусе» одной строкой;
- **как тестировщик использует агрегаты** в работе.

Примеры — на таблицах TaskFlow и на учебных таблицах магазина из урока [«JOIN: соединение таблиц»](/bd/03-join). В этом уроке у магазина больше заказов — за три месяца — и у заказа два новых столбца: скидка `discount` и оценка клиента `rating`. Скрипт — во вкладке «Задание»: выполни его в песочнице и повторяй примеры.

## Агрегатные функции

### Главные функции

| Функция | Что считает | Пример |
|---|---|---|
| `COUNT(*)` | число **строк** | сколько всего задач |
| `COUNT(столбец)` | число **непустых** значений столбца | у скольких задач есть исполнитель |
| `COUNT(DISTINCT столбец)` | число **разных** непустых значений | сколько разных людей — исполнители |
| `SUM(столбец)` | сумму | выручка |
| `AVG(столбец)` | среднее | средняя оценка |
| `MIN(столбец)` | наименьшее | самый дешёвый товар, первый заказ |
| `MAX(столбец)` | наибольшее | самый дорогой товар, последний заказ |

Без группировки агрегат возвращает **ровно одну строку** — итог по всем строкам, которые прошли `WHERE`:

```sql
SELECT COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL;
```

В начальных данных TaskFlow — 7. Одна строка, одно число.

### Три вида COUNT

```sql
SELECT COUNT(*)                    AS tasks,
       COUNT(assignee_id)          AS with_assignee,
       COUNT(DISTINCT assignee_id) AS assignees
FROM tasks
WHERE deleted_at IS NULL;
```

В начальных данных TaskFlow — `7`, `6`, `5`:

- `COUNT(*)` — 7 задач: считает строки, ему всё равно, что в них;
- `COUNT(assignee_id)` — 6: у «Настроить CI» исполнителя нет, `NULL` не считается;
- `COUNT(DISTINCT assignee_id)` — 5: у Алексея Сидорова две задачи, а как исполнитель он один.

На учебных таблицах то же самое: `COUNT(*)`, `COUNT(customer_id)` и `COUNT(DISTINCT customer_id)` по заказам дают `20`, `17` и `7`. Двадцать заказов, у семнадцати есть клиент, а разных клиентов — семь.

### SUM, AVG, MIN, MAX

```sql
SELECT SUM(quantity) AS items,
       MIN(price)    AS min_price,
       MAX(price)    AS max_price
FROM order_items;
```

`44`, `450.00`, `24990.00`: всего продано 44 штуки, самая дешёвая строка — по 450, самая дорогая — по 24 990.

Внутри агрегата можно писать выражение: выручка — это сумма «количество × цена» по всем строкам заказов:

```sql
SELECT SUM(quantity * price) AS revenue
FROM order_items;
```

**`MIN` и `MAX` работают не только с числами.** С датами — самая ранняя и самая поздняя. Со строками — первая и последняя по алфавиту:

```sql
SELECT MIN(created_at) AS first_order, MAX(created_at) AS last_order
FROM orders;

SELECT MIN(name), MAX(name)
FROM customers;
```

Первый заказ — 3 августа, последний — 16 октября. По алфавиту первая — «Алёна Котова», последняя — «Светлана Орлова». `SUM` и `AVG` со строками и датами не работают — их можно складывать только как числа.

## NULL в агрегатах — главная ловушка

Помнишь из урока [«SELECT: выбрать и отфильтровать»](/bd/02-select): `NULL` — это «значение неизвестно». Агрегаты обращаются с ним по одному правилу: **все функции, кроме `COUNT(*)`, пропускают `NULL`**. Как будто этих строк нет.

<figure class="agg-null">
<svg viewBox="0 0 440 360" role="img" aria-label="Слева столбец rating из пяти строк: 5, NULL, 4, NULL, 3. Справа результаты: COUNT(*) равно 5 — считает строки; COUNT(rating) равно 3 — только непустые; SUM(rating) равно 12; AVG(rating) равно 4 — это 12 разделить на 3, а не на 5. Внизу предупреждение: SUM разделить на COUNT(*) даёт 2,4 — это не среднее">
  <rect x="0" y="0" width="440" height="360" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="20" y="30" font-size="15" font-weight="700" fill="#1f2937">Агрегаты и NULL: 5 строк, 2 пустые</text>
  <rect x="16" y="50" width="120" height="30" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="28" y="70" font-size="14" font-weight="700" fill="#1f2937">rating</text>
  <rect x="16" y="80" width="120" height="30" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="28" y="100" font-size="14" fill="#1f2937">5</text>
  <rect x="16" y="110" width="120" height="30" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
  <text x="28" y="130" font-size="14" fill="#6b7280">NULL</text>
  <rect x="16" y="140" width="120" height="30" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="28" y="160" font-size="14" fill="#1f2937">4</text>
  <rect x="16" y="170" width="120" height="30" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
  <text x="28" y="190" font-size="14" fill="#6b7280">NULL</text>
  <rect x="16" y="200" width="120" height="30" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="28" y="220" font-size="14" fill="#1f2937">3</text>
  <text x="156" y="70" font-size="14" font-weight="700" fill="#1f2937">COUNT(*) = 5</text>
  <text x="156" y="90" font-size="14" fill="#1f2937">все строки, даже пустые</text>
  <text x="156" y="122" font-size="14" font-weight="700" fill="#1f2937">COUNT(rating) = 3</text>
  <text x="156" y="142" font-size="14" fill="#1f2937">только непустые значения</text>
  <text x="156" y="174" font-size="14" font-weight="700" fill="#1f2937">SUM(rating) = 12</text>
  <text x="156" y="194" font-size="14" fill="#1f2937">5 + 4 + 3, NULL пропущены</text>
  <text x="156" y="226" font-size="14" font-weight="700" fill="#1f2937">AVG(rating) = 4</text>
  <text x="156" y="246" font-size="14" fill="#1f2937">12 / 3 — делит на непустые</text>
  <rect x="16" y="266" width="408" height="76" rx="8" fill="#fee2e2" stroke="#dc2626" stroke-width="1.5"/>
  <text x="28" y="290" font-size="14" font-weight="700" fill="#991b1b">SUM(rating) / COUNT(*) = 12 / 5 = 2,4</text>
  <text x="28" y="310" font-size="14" fill="#1f2937">Это не то же, что AVG. Какое число верное,</text>
  <text x="28" y="330" font-size="14" fill="#1f2937">решают требования, а не база.</text>
</svg>
<figcaption>Все агрегаты, кроме COUNT(*), пропускают NULL. Поэтому AVG — это сумма, делённая на число непустых значений, а не на число строк.</figcaption>
</figure>

### COUNT(*) и COUNT(столбец)

`COUNT(*)` отвечает на вопрос «сколько строк». `COUNT(rating)` — «сколько строк, где оценка есть». Это разные вопросы, и ответы у них разные:

```sql
SELECT COUNT(*)      AS all_orders,
       COUNT(rating) AS rated,
       SUM(rating)   AS rating_sum,
       AVG(rating)   AS avg_rating
FROM orders;
```

`20`, `8`, `35`, `4.375…`. Двадцать заказов, оценку поставили только восемь клиентов, сумма оценок — 35, средняя — 35 / 8.

Как выбрать: если нужно «сколько записей» — `COUNT(*)`. Если «сколько записей, где что-то заполнено» — `COUNT(столбец)`. Ошибка в любую сторону даёт число, которое выглядит правдоподобно.

### AVG делит на непустые

`AVG(rating)` — это `SUM(rating) / COUNT(rating)`, а **не** `SUM(rating) / COUNT(*)`. На учебных таблицах: 35 / 8 = 4,375. А если поделить на все 20 заказов — 1,75.

Какое число верное? Зависит от вопроса. «Средняя оценка среди тех, кто оценил» — 4,375. «Средняя оценка, если неоценённый заказ считать нулём» — 1,75. Это решают требования, не база. Тестировщику важно знать, **как считает система**, и проверять тем же способом.

То же со скидками. У 5 заказов из 20 есть промокод, скидки — 2 500 рублей в сумме. В запросе ниже есть `COALESCE(a, b)` — функция из урока 2: вернуть `a`, а если оно `NULL` — `b`.

```sql
SELECT AVG(discount)              AS avg_promo,
       AVG(COALESCE(discount, 0)) AS avg_all
FROM orders;
```

`500` и `125`. Первое — средняя скидка **среди заказов с промокодом**. Второе — средняя скидка **на любой заказ**: `COALESCE` превратил `NULL` в 0, и строки без промокода стали участвовать в среднем.

### SUM пустого набора — NULL, а не 0

Что вернёт `SUM`, если строк нет вообще? Или все значения — `NULL`?

```sql
SELECT COUNT(*) AS orders, SUM(discount) AS discounts
FROM orders
WHERE customer_id = 7;
```

У Кирилла Зуева заказов нет. Результат: `0` и `NULL`. **`COUNT` пустого набора — 0, а `SUM`, `AVG`, `MIN`, `MAX` — `NULL`.** Складывать нечего — значит, сумма неизвестна.

В отчёте вместо «0 ₽» будет пустая ячейка. Хуже — если этот `NULL` дальше участвует в вычислении: `NULL + 100` — тоже `NULL`. Исправление — `COALESCE`:

```sql
SELECT COUNT(*) AS orders, COALESCE(SUM(discount), 0) AS discounts
FROM orders
WHERE customer_id = 7;
```

### Мидл: округление и деление целых

`AVG` по целому столбцу возвращает дробное число с длинным хвостом: `4.3750000000000000`. Для отчёта и для сверки его округляют:

```sql
SELECT AVG(rating)              AS avg_raw,
       ROUND(AVG(rating), 2)    AS avg_rounded,
       SUM(rating) / COUNT(rating) AS int_div
FROM orders;
```

`4.3750000000000000`, `4.38`, `4`. Третий столбец — ловушка из урока 2: **деление целого на целое отбрасывает дробную часть**, `7 / 2` даёт `3`. `SUM(rating)` и `COUNT(rating)` — целые, значит, и результат целый.

Почему это важно тестировщику. API показывает «средняя оценка 4.38», ты считаешь в базе и получаешь `4`, или `4.375`, или `4.3750000000000000`. Прежде чем заводить баг, выясни: где и до скольких знаков округляет система? Что она делит — целые или дробные? Расхождение во втором знаке после запятой бывает и честной ошибкой округления, и признаком того, что система считает по другой формуле.

## GROUP BY: по строке на группу

### Синтаксис

```sql
SELECT status, COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL
GROUP BY status;
```

`GROUP BY status` раскладывает задачи по стопкам: в одной все `TODO`, в другой все `IN_PROGRESS`, в третьей все `DONE`. Потом `COUNT(*)` считается **в каждой стопке отдельно**. В результате — по одной строке на группу. В начальных данных TaskFlow: `TODO` — 3, `IN_PROGRESS` — 2, `DONE` — 2.

<figure class="agg-group">
<svg viewBox="0 0 440 620" role="img" aria-label="Сверху таблица orders из шести строк: Алёна 1000, Пётр 3000, Алёна 2000, Мария 500, Пётр 1500, Алёна 700. Строки одного клиента закрашены одним цветом. Ниже GROUP BY customer раскладывает их по трём стопкам: у Алёны три строки, у Петра две, у Марии одна. Внизу результат — три строки, по одной на клиента: Алёна, COUNT 3, SUM 3700; Пётр, COUNT 2, SUM 4500; Мария, COUNT 1, SUM 500">
  <rect x="0" y="0" width="440" height="620" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="20" y="30" font-size="15" font-weight="700" fill="#1f2937">GROUP BY: разложить строки по стопкам</text>
  <text x="16" y="60" font-size="14" font-weight="700" fill="#1f2937">orders — 6 строк</text>
  <rect x="16" y="70" width="408" height="28" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="89" font-size="14" font-weight="700" fill="#1f2937">customer</text>
  <text x="228" y="89" font-size="14" font-weight="700" fill="#1f2937">total</text>
  <rect x="16" y="98" width="408" height="28" fill="#e0f2fe" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="117" font-size="14" fill="#1f2937">Алёна</text>
  <text x="228" y="117" font-size="14" fill="#1f2937">1000</text>
  <rect x="16" y="126" width="408" height="28" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="145" font-size="14" fill="#1f2937">Пётр</text>
  <text x="228" y="145" font-size="14" fill="#1f2937">3000</text>
  <rect x="16" y="154" width="408" height="28" fill="#e0f2fe" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="173" font-size="14" fill="#1f2937">Алёна</text>
  <text x="228" y="173" font-size="14" fill="#1f2937">2000</text>
  <rect x="16" y="182" width="408" height="28" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="201" font-size="14" fill="#1f2937">Мария</text>
  <text x="228" y="201" font-size="14" fill="#1f2937">500</text>
  <rect x="16" y="210" width="408" height="28" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="229" font-size="14" fill="#1f2937">Пётр</text>
  <text x="228" y="229" font-size="14" fill="#1f2937">1500</text>
  <rect x="16" y="238" width="408" height="28" fill="#e0f2fe" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="257" font-size="14" fill="#1f2937">Алёна</text>
  <text x="228" y="257" font-size="14" fill="#1f2937">700</text>
  <line x1="220" y1="70" x2="220" y2="266" stroke="#94a3b8" stroke-width="1"/>
  <text x="20" y="294" font-size="14" font-weight="700" fill="#1d4ed8">↓ GROUP BY customer — по стопкам</text>
  <rect x="16" y="306" width="128" height="114" rx="8" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5"/>
  <text x="80" y="328" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">Алёна</text>
  <text x="80" y="354" font-size="14" fill="#1f2937" text-anchor="middle">1000</text>
  <text x="80" y="378" font-size="14" fill="#1f2937" text-anchor="middle">2000</text>
  <text x="80" y="402" font-size="14" fill="#1f2937" text-anchor="middle">700</text>
  <rect x="156" y="306" width="128" height="114" rx="8" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
  <text x="220" y="328" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">Пётр</text>
  <text x="220" y="354" font-size="14" fill="#1f2937" text-anchor="middle">3000</text>
  <text x="220" y="378" font-size="14" fill="#1f2937" text-anchor="middle">1500</text>
  <rect x="296" y="306" width="128" height="114" rx="8" fill="#dcfce7" stroke="#16a34a" stroke-width="1.5"/>
  <text x="360" y="328" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">Мария</text>
  <text x="360" y="354" font-size="14" fill="#1f2937" text-anchor="middle">500</text>
  <text x="20" y="448" font-size="14" font-weight="700" fill="#1d4ed8">↓ COUNT(*), SUM(total) — по строке на стопку</text>
  <rect x="16" y="460" width="408" height="28" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="479" font-size="14" font-weight="700" fill="#1f2937">customer</text>
  <text x="168" y="479" font-size="14" font-weight="700" fill="#1f2937">COUNT(*)</text>
  <text x="300" y="479" font-size="14" font-weight="700" fill="#1f2937">SUM(total)</text>
  <rect x="16" y="488" width="408" height="28" fill="#e0f2fe" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="507" font-size="14" fill="#1f2937">Алёна</text>
  <text x="168" y="507" font-size="14" fill="#1f2937">3</text>
  <text x="300" y="507" font-size="14" fill="#1f2937">3700</text>
  <rect x="16" y="516" width="408" height="28" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="535" font-size="14" fill="#1f2937">Пётр</text>
  <text x="168" y="535" font-size="14" fill="#1f2937">2</text>
  <text x="300" y="535" font-size="14" fill="#1f2937">4500</text>
  <rect x="16" y="544" width="408" height="28" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="563" font-size="14" fill="#1f2937">Мария</text>
  <text x="168" y="563" font-size="14" fill="#1f2937">1</text>
  <text x="300" y="563" font-size="14" fill="#1f2937">500</text>
  <line x1="160" y1="460" x2="160" y2="572" stroke="#94a3b8" stroke-width="1"/>
  <line x1="292" y1="460" x2="292" y2="572" stroke="#94a3b8" stroke-width="1"/>
  <text x="20" y="602" font-size="14" fill="#1f2937">6 строк превратились в 3 — по одной на клиента.</text>
</svg>
<figcaption>GROUP BY раскладывает строки по группам — по одной на каждое значение. Агрегат считается внутри каждой группы, и в результате остаётся по строке на группу. Суммы условные.</figcaption>
</figure>

Без `GROUP BY` агрегат сворачивает **все** строки в одну. С `GROUP BY` — каждую группу в одну строку.

### Главное правило: всё, что не агрегат, — в GROUP BY

Посмотри на запрос:

```sql
SELECT status, customer_id, COUNT(*)
FROM orders
GROUP BY status;
```

PostgreSQL отвечает ошибкой:

```
ERROR: column "orders.customer_id" must appear in the GROUP BY clause
or be used in an aggregate function
```

Как читать: «столбец `customer_id` должен стоять в `GROUP BY` или быть внутри агрегатной функции». Почему: в группе `DELIVERED` 11 заказов от разных клиентов. Какой `customer_id` показать в **одной** строке группы? База не угадывает — она требует, чтобы ты решил.

Решений два:

- нужен разрез «статус × клиент» — добавь столбец в `GROUP BY`: `GROUP BY status, customer_id`;
- нужен итог по клиентам внутри статуса — заверни столбец в агрегат: `COUNT(DISTINCT customer_id)`.

Правило на каждый запрос: **каждый столбец в `SELECT` — либо в `GROUP BY`, либо внутри агрегата.**

Мидл-деталь: если в `GROUP BY` стоит первичный ключ таблицы, PostgreSQL разрешит выводить остальные столбцы этой таблицы без перечисления — они однозначно определяются ключом. Но в других базах это не работает, а в запросе с `JOIN` легко запутаться. В уроке мы перечисляем столбцы явно: `GROUP BY c.id, c.name`.

### Группировка по нескольким столбцам

```sql
SELECT project_id, status, COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL
GROUP BY project_id, status
ORDER BY project_id, status;
```

Группа — это уникальное **сочетание** значений: «проект 1, `TODO`», «проект 1, `IN_PROGRESS`», «проект 2, `DONE`»… Строк в результате — столько, сколько таких сочетаний реально встречается. Сочетаний, которых нет в данных, — например, «проект 3, `DONE`», — в результате тоже нет. Нулей `GROUP BY` не придумывает.

### NULL — отдельная группа

```sql
SELECT customer_id, COUNT(*) AS orders
FROM orders
GROUP BY customer_id
ORDER BY customer_id;
```

8 строк: семь клиентов и ещё одна строка, где `customer_id` — `NULL`, с числом 3. Это заказы гостей. В `WHERE` два `NULL` не равны друг другу, а `GROUP BY` складывает все `NULL` в **одну** группу.

Для тестировщика это важно в двух местах. Первое — группа `NULL` есть в результате, а на экране её может не быть: «заказы без клиента» потерялись в отчёте. Второе — условие на группы может зацепить эту строку, как будто это обычный клиент. Это будет в задачах.

### Группировка по выражению

Группировать можно не только по столбцу, но и по выражению. Например, по месяцу — `date_trunc('month', …)` из урока 2 обрезает момент до начала месяца:

```sql
SELECT date_trunc('month', created_at) AS month, COUNT(*) AS orders
FROM orders
GROUP BY date_trunc('month', created_at)
ORDER BY month;
```

Август — 5 заказов, сентябрь — 7, октябрь — 8. Повтори в `GROUP BY` то же выражение, что в `SELECT`: если они различаются, сработает правило выше и база выдаст ошибку. По дню — `created_at::date`. Помни про часовой пояс: границы дня и месяца считаются в поясе сессии.

## HAVING и WHERE

### WHERE — строки до, HAVING — группы после

Нужны клиенты, у которых 3 заказа и больше. Условие «больше трёх» — про **группу**: число заказов существует только после того, как заказы разложили по клиентам. Для этого есть `HAVING`:

```sql
SELECT customer_id, COUNT(*) AS orders
FROM orders
WHERE customer_id IS NOT NULL
GROUP BY customer_id
HAVING COUNT(*) >= 3
ORDER BY customer_id;
```

3 строки: клиенты 1, 2 и 3. Здесь работают оба фильтра:

- `WHERE customer_id IS NOT NULL` — условие на **строку**: выбросить заказы гостей ещё до группировки;
- `HAVING COUNT(*) >= 3` — условие на **группу**: после подсчёта оставить только тех, у кого три и больше.

Полный порядок выполнения — продолжение того, что было в уроке [«SELECT: выбрать и отфильтровать»](/bd/02-select):

`FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT`

<figure class="agg-where-having">
<svg viewBox="0 0 440 520" role="img" aria-label="Конвейер запроса сверху вниз. FROM orders — 20 строк. WHERE status не CANCELLED отсекает строки — осталось 18. GROUP BY customer_id раскладывает 18 строк на 8 групп. HAVING COUNT больше или равно 3 отсекает группы — осталось 3. SELECT вычисляет столбцы и псевдонимы. ORDER BY сортирует. WHERE работает со строками до группировки, HAVING — с группами после">
  <rect x="0" y="0" width="440" height="520" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="20" y="30" font-size="15" font-weight="700" fill="#1f2937">WHERE — строки до, HAVING — группы после</text>
  <rect x="16" y="50" width="168" height="48" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="28" y="72" font-size="14" font-weight="700" fill="#1f2937">1. FROM</text>
  <text x="28" y="90" font-size="14" fill="#1f2937">orders</text>
  <text x="200" y="72" font-size="14" fill="#1f2937">берёт таблицу</text>
  <text x="200" y="90" font-size="14" font-weight="700" fill="#1f2937">20 строк</text>
  <text x="100" y="116" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="124" width="168" height="48" rx="6" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>
  <text x="28" y="146" font-size="14" font-weight="700" fill="#1f2937">2. WHERE</text>
  <text x="28" y="164" font-size="14" fill="#1f2937">status &lt;&gt; 'CANCELLED'</text>
  <text x="200" y="146" font-size="14" fill="#991b1b">отсекает строки</text>
  <text x="200" y="164" font-size="14" font-weight="700" fill="#1f2937">осталось 18 строк</text>
  <text x="100" y="190" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="198" width="168" height="48" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="28" y="220" font-size="14" font-weight="700" fill="#1f2937">3. GROUP BY</text>
  <text x="28" y="238" font-size="14" fill="#1f2937">customer_id</text>
  <text x="200" y="220" font-size="14" fill="#1f2937">раскладывает по группам</text>
  <text x="200" y="238" font-size="14" font-weight="700" fill="#1f2937">8 групп</text>
  <text x="100" y="264" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="272" width="168" height="48" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
  <text x="28" y="294" font-size="14" font-weight="700" fill="#1f2937">4. HAVING</text>
  <text x="28" y="312" font-size="14" fill="#1f2937">COUNT(*) &gt;= 3</text>
  <text x="200" y="294" font-size="14" fill="#92400e">отсекает группы</text>
  <text x="200" y="312" font-size="14" font-weight="700" fill="#1f2937">осталось 3 группы</text>
  <text x="100" y="338" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="346" width="168" height="48" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="28" y="368" font-size="14" font-weight="700" fill="#1f2937">5. SELECT</text>
  <text x="28" y="386" font-size="14" fill="#1f2937">COUNT(*) AS orders</text>
  <text x="200" y="368" font-size="14" fill="#1f2937">считает столбцы,</text>
  <text x="200" y="386" font-size="14" fill="#1f2937">даёт псевдонимы</text>
  <text x="100" y="412" font-size="14" fill="#64748b" text-anchor="middle">↓</text>
  <rect x="16" y="420" width="168" height="48" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="28" y="442" font-size="14" font-weight="700" fill="#1f2937">6. ORDER BY</text>
  <text x="28" y="460" font-size="14" fill="#1f2937">orders DESC</text>
  <text x="200" y="442" font-size="14" fill="#1f2937">сортирует; псевдоним</text>
  <text x="200" y="460" font-size="14" fill="#1f2937">здесь уже есть</text>
  <text x="20" y="498" font-size="14" fill="#1f2937">В HAVING псевдонима orders ещё нет: SELECT — шаг 5.</text>
</svg>
<figcaption>WHERE отсекает строки до группировки, HAVING — группы после. Числа — для учебных таблиц магазина. JOIN, если он есть, — часть шага FROM, LIMIT — после ORDER BY.</figcaption>
</figure>

Отсюда три следствия.

**1. Агрегат в `WHERE` написать нельзя.** На шаге `WHERE` групп ещё нет, считать нечего:

```sql
SELECT customer_id, COUNT(*)
FROM orders
WHERE COUNT(*) >= 3
GROUP BY customer_id;
-- ERROR: aggregate functions are not allowed in WHERE
```

**2. Псевдоним из `SELECT` нельзя использовать в `HAVING`.** `HAVING` выполняется раньше `SELECT`, псевдонима ещё нет:

```sql
SELECT customer_id, COUNT(*) AS cnt
FROM orders
GROUP BY customer_id
HAVING cnt >= 3;
-- ERROR: column "cnt" does not exist
```

Пиши агрегат целиком: `HAVING COUNT(*) >= 3`. А в `ORDER BY` псевдоним можно — он выполняется после `SELECT`: `ORDER BY cnt DESC` работает. Это поведение PostgreSQL. Некоторые другие базы псевдоним в `HAVING` разрешают — не удивляйся, если увидишь такое в чужом запросе.

**3. Условие на строки пиши в `WHERE`, даже если оно «работает» в `HAVING`.** `HAVING status <> 'CANCELLED'` при `GROUP BY status` выполнится и даст верный результат. Но читать такой запрос труднее: `HAVING` обещает условие на итог, а там условие на строку. Условие на столбец, которого нет в `GROUP BY`, в `HAVING` и вовсе вызовет ошибку — привычка «строки — в `WHERE`» от этого страхует. И так запрос одинаково понятно работает в любой базе: в некоторых СУБД условие в `HAVING` ещё и выполняется медленнее. Правило простое: условие **без агрегата** — в `WHERE`, условие **с агрегатом** — в `HAVING`.

| Вопрос | `WHERE` | `HAVING` |
|---|---|---|
| Что фильтрует | строки | группы |
| Когда | до `GROUP BY` | после `GROUP BY` |
| Агрегаты в условии | нельзя | можно — для этого и нужен |
| Без `GROUP BY` | обычный фильтр | весь результат — одна группа |

## ORDER BY по агрегату и «топ-N»

«Три проекта с наибольшим числом задач» — это сортировка по агрегату и `LIMIT`:

```sql
SELECT p.name, COUNT(t.id) AS tasks
FROM projects p
JOIN tasks t ON t.project_id = p.id
WHERE p.deleted_at IS NULL
  AND t.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY tasks DESC, p.id
LIMIT 3;
```

**Ловушка ничьей.** На учебных таблицах у Алёны Котовой и Марии Лебедевой одинаковая выручка — по 17 320. Запрос «топ-3 клиента по выручке» с `ORDER BY revenue DESC LIMIT 3` вернёт одну из них — какую, база не обещает. Сегодня Марию, завтра Алёну. Добавь второй столбец сортировки — `ORDER BY revenue DESC, c.name` — и результат станет предсказуемым. А для тестировщика ничья на границе — отдельный вопрос к требованиям: показывать троих или четверых?

## Мидл: агрегаты и JOIN

Здесь живут самые дорогие ошибки урока. Запрос выполняется без ошибок, числа выглядят правдоподобно — и они неверные.

### COUNT(*) при LEFT JOIN: проект без задач показывает 1

Нужно: у каждого проекта — число задач, **включая проекты без задач**. Из урока 3 ты знаешь: «включая тех, у кого нет пары» — это `LEFT JOIN`. Пишем:

```sql
-- неправильно: у проекта без задач будет 1
SELECT p.id, p.name, COUNT(*) AS tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name;
```

У проекта без задач пары нет — и `LEFT JOIN` оставил для него **одну строку** с `NULL` в столбцах задачи. `COUNT(*)` считает строки — и честно насчитал одну.

<figure class="agg-left-count">
<svg viewBox="0 0 440 440" role="img" aria-label="Результат projects LEFT JOIN tasks до группировки: три строки проекта TaskFlow Backend с задачами Регистрация, JWT, CI и одна строка Нового проекта, где t.id равно NULL. После GROUP BY для TaskFlow Backend COUNT(*) и COUNT(t.id) равны 3. Для Нового проекта COUNT(*) равно 1, потому что строка есть, а COUNT(t.id) равно 0, потому что t.id пустой">
  <rect x="0" y="0" width="440" height="440" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="20" y="30" font-size="15" font-weight="700" fill="#1f2937">Проект без задач: COUNT(*) = 1</text>
  <text x="16" y="60" font-size="14" font-weight="700" fill="#1f2937">projects p LEFT JOIN tasks t — до GROUP BY</text>
  <rect x="16" y="70" width="408" height="30" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="90" font-size="14" font-weight="700" fill="#1f2937">p.name</text>
  <text x="196" y="90" font-size="14" font-weight="700" fill="#1f2937">t.id</text>
  <text x="270" y="90" font-size="14" font-weight="700" fill="#1f2937">t.title</text>
  <rect x="16" y="100" width="408" height="30" fill="#e0f2fe" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="120" font-size="14" fill="#1f2937">TaskFlow Backend</text>
  <text x="196" y="120" font-size="14" fill="#1f2937">1</text>
  <text x="270" y="120" font-size="14" fill="#1f2937">Регистрация</text>
  <rect x="16" y="130" width="408" height="30" fill="#e0f2fe" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="150" font-size="14" fill="#1f2937">TaskFlow Backend</text>
  <text x="196" y="150" font-size="14" fill="#1f2937">2</text>
  <text x="270" y="150" font-size="14" fill="#1f2937">JWT</text>
  <rect x="16" y="160" width="408" height="30" fill="#e0f2fe" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="180" font-size="14" fill="#1f2937">TaskFlow Backend</text>
  <text x="196" y="180" font-size="14" fill="#1f2937">5</text>
  <text x="270" y="180" font-size="14" fill="#1f2937">CI</text>
  <rect x="16" y="190" width="408" height="30" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="210" font-size="14" fill="#1f2937">Новый проект</text>
  <text x="196" y="210" font-size="14" fill="#6b7280">NULL</text>
  <text x="270" y="210" font-size="14" fill="#6b7280">NULL</text>
  <line x1="188" y1="70" x2="188" y2="220" stroke="#94a3b8" stroke-width="1"/>
  <line x1="262" y1="70" x2="262" y2="220" stroke="#94a3b8" stroke-width="1"/>
  <text x="20" y="248" font-size="14" font-weight="700" fill="#1d4ed8">↓ GROUP BY p.id, p.name</text>
  <rect x="16" y="260" width="408" height="30" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="280" font-size="14" font-weight="700" fill="#1f2937">p.name</text>
  <text x="196" y="280" font-size="14" font-weight="700" fill="#1f2937">COUNT(*)</text>
  <text x="312" y="280" font-size="14" font-weight="700" fill="#1f2937">COUNT(t.id)</text>
  <rect x="16" y="290" width="408" height="30" fill="#ffffff" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="310" font-size="14" fill="#1f2937">TaskFlow Backend</text>
  <text x="196" y="310" font-size="14" fill="#1f2937">3</text>
  <text x="312" y="310" font-size="14" fill="#1f2937">3</text>
  <rect x="16" y="320" width="408" height="30" fill="#ffffff" stroke="#94a3b8" stroke-width="1"/>
  <text x="24" y="340" font-size="14" fill="#1f2937">Новый проект</text>
  <text x="196" y="340" font-size="14" font-weight="700" fill="#991b1b">1 ✗</text>
  <text x="312" y="340" font-size="14" font-weight="700" fill="#166534">0 ✓</text>
  <line x1="188" y1="260" x2="188" y2="350" stroke="#94a3b8" stroke-width="1"/>
  <line x1="304" y1="260" x2="304" y2="350" stroke="#94a3b8" stroke-width="1"/>
  <text x="20" y="378" font-size="14" fill="#1f2937">COUNT(*) считает строку, которую LEFT JOIN</text>
  <text x="20" y="398" font-size="14" fill="#1f2937">оставил для проекта без пары. COUNT(t.id)</text>
  <text x="20" y="418" font-size="14" fill="#1f2937">пропускает NULL — и даёт честный 0.</text>
</svg>
<figcaption>LEFT JOIN оставляет для проекта без задач одну строку с NULL. COUNT(*) её считает, COUNT(t.id) — нет. Названия задач сокращены.</figcaption>
</figure>

Правильно — считать **столбец правой таблицы**, который у настоящей строки не бывает пустым. Обычно — её `id`:

```sql
-- правильно: у проекта без задач — 0
SELECT p.id, p.name, COUNT(t.id) AS tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name;
```

`COUNT(t.id)` пропускает `NULL` — и у проекта без задач получается 0. Это тот же приём, что поиск «без пары» в уроке 3: там `WHERE t.id IS NULL`, здесь `COUNT(t.id)`.

На учебных таблицах: все действующие клиенты и число их заказов. С `COUNT(*)` у Кирилла Зуева и Натальи Фёдоровой — по 1 заказу. С `COUNT(o.id)` — по 0, как и есть на самом деле.

**Правило: при `LEFT JOIN` считай `COUNT(правая.id)`, а не `COUNT(*)`.**

### Мягкое удаление — в ON, иначе нулевые группы пропадут

Фильтр `t.deleted_at IS NULL` в запросе выше стоит в `ON`. Что будет, если перенести его в `WHERE`?

```sql
-- неправильно: проекты, где все задачи удалены, пропадут
SELECT p.id, p.name, COUNT(t.id) AS tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
WHERE p.deleted_at IS NULL
  AND t.deleted_at IS NULL
GROUP BY p.id, p.name;
```

Ловушка из урока 3 возвращается. Проект, у которого все задачи удалены, получит строки с заполненным `t.deleted_at` — `WHERE` их выбросит. Строки «без пары» у такого проекта нет — пары ведь были. Проект исчезнет из отчёта целиком, хотя должен быть в нём с нулём. Проект совсем без задач уцелеет: у его строки `t.deleted_at` — `NULL`. Поэтому на «чистых» данных ошибку не видно.

Правило то же, что в уроке 3: **условие на правую таблицу при `LEFT JOIN` — в `ON`**. Для подсчётов это особенно важно: потерянная группа — это «ноль», которого нет в отчёте.

### Дубли 1:N раздувают SUM

В уроке 3 был разбор: выручка выросла вдвое, потому что к заказам присоединили доставки. Посмотрим, как это выглядит в агрегатах.

Скидка хранится в заказе — одна на весь заказ. Коллега хочет одним запросом посчитать и скидки, и выручку, поэтому присоединяет строки заказа:

```sql
SELECT SUM(o.discount)              AS discounts,
       SUM(oi.quantity * oi.price)  AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.id;
```

Скидки — `4200`. А настоящая сумма скидок, `SELECT SUM(discount) FROM orders`, — `2500`. Что случилось: у заказа из двух строк скидка повторилась в двух строках соединения и посчиталась дважды. Заказ 6 со скидкой 1 000 и двумя товарами дал 2 000.

Выручка в том же запросе — верная: `quantity * price` относится к строке заказа, каждая строка встречается один раз. **Раздувается то, что принадлежит стороне «один»** — заказу, а не его строкам.

### COUNT(DISTINCT) спасает счёт, но не сумму

Со счётом дубли лечатся: `COUNT(DISTINCT o.id)` посчитает каждый заказ один раз, сколько бы строк у него ни было. Это честный приём — ты считаешь **уникальные заказы**, и `id` у каждого свой.

С суммой так не выйдет. `SUM(DISTINCT o.discount)` складывает **разные значения** скидки, а не скидки разных заказов. На учебных таблицах он даёт `2000`: два разных заказа со скидкой по 500 «схлопнулись» в одну пятисотку. Было слишком много — стало слишком мало.

Правильно — не смешивать в одном запросе данные «одного» и «многих»: скидки считать по `orders` без `JOIN` к строкам, выручку — со строками. Два запроса — нормальное решение.

## Условные подсчёты

«По каждому проекту — сколько задач всего, сколько в `TODO`, `IN_PROGRESS`, `DONE`» — одной строкой на проект. `GROUP BY project_id, status` даст по строке на сочетание, а нужно в столбцах. Тут помогает `CASE` из урока [«SELECT: выбрать и отфильтровать»](/bd/02-select):

```sql
SELECT p.name,
       COUNT(t.id)                                          AS total,
       COUNT(CASE WHEN t.status = 'TODO' THEN 1 END)        AS todo,
       COUNT(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 END) AS in_progress,
       COUNT(CASE WHEN t.status = 'DONE' THEN 1 END)        AS done
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY p.id;
```

Как это работает: `CASE WHEN t.status = 'TODO' THEN 1 END` для задачи в `TODO` даёт `1`, для остальных — `NULL` (нет `ELSE`). `COUNT` пропускает `NULL` — значит, считает только задачи в `TODO`.

Вторая запись, которую часто встретишь, — через `SUM`:

```sql
SUM(CASE WHEN t.status = 'TODO' THEN 1 ELSE 0 END) AS todo
```

Каждая задача в `TODO` даёт 1, остальные — 0, сумма — их число. Результат тот же. Одна разница: у проекта без задач `SUM` по строке «без пары» даст `0` — `CASE` с `ELSE 0` превратит её в ноль. А если `ELSE 0` забыть, `SUM` даст `NULL`. `COUNT(CASE … THEN 1 END)` такой проблемы не имеет: ноль всегда ноль.

::: tip Мидл: FILTER в PostgreSQL
В PostgreSQL есть короткая запись условного агрегата:

```sql
COUNT(t.id) FILTER (WHERE t.status = 'DONE') AS done
```

Читается как «посчитай `t.id`, но только по строкам, где статус `DONE`». Работает с любым агрегатом: `SUM(…) FILTER (WHERE …)`. Это удобнее `CASE`, но есть не во всех базах. Если увидишь в чужом запросе — это то же самое, что `COUNT(CASE …)`.
:::

## Как тестировщик использует агрегаты

**1. Сверить счётчики API и экрана с базой.** Списки TaskFlow возвращают обёртку `{ "items": [...], "total": N, "limit": N, "offset": N, "hasNext": … }`. `total` — число **всех** подходящих записей, а не только тех, что на странице. Это можно проверить запросом:

```sql
-- GET /api/v1/projects/1/members → total
SELECT COUNT(*) AS members
FROM project_members
WHERE project_id = 1;
```

`total` есть у списков проектов, участников проекта, задач, комментариев задачи и пользователей (последний — только для `ADMIN`). Фильтры запроса в API — те же условия в `WHERE`: `GET /tasks?projectId=1&status=TODO`, вызванный администратором, сверяют с `COUNT(*)` по `project_id = 1 AND status = 'TODO'` среди действующих задач. У обычного пользователя добавляется ещё одно условие — какие задачи ему видны; это в части 3 задания. А сам массив `items` сверяй со страницей: при `limit=20` и `total=45` в нём 20 элементов, `hasNext` — `true`.

Ещё один счётчик — `commentsCount` в каждой задаче из `GET /tasks`: по спецификации это число неудалённых комментариев. В базе — `COUNT(c.id)` с `LEFT JOIN comments … AND c.deleted_at IS NULL`. Удалил комментарий — счётчик должен уменьшиться.

**2. Найти дубли.** «Нет ли повторов» — это `GROUP BY` по полям, которые должны быть уникальны, и `HAVING COUNT(*) > 1`:

```sql
SELECT project_id, user_id, COUNT(*) AS copies
FROM project_members
GROUP BY project_id, user_id
HAVING COUNT(*) > 1;
```

Здесь результат всегда пустой: `(project_id, user_id)` — первичный ключ, база не даст записать повтор. Но такой же запрос по полям **без** ограничения в базе — например, «одинаковые названия задач в одном проекте» — может найти что угодно. Знать, где уникальность гарантирует база, а где только код, — уже половина тест-дизайна.

**3. Проверить распределение тестовых данных.** Перед тестом фильтра «по статусу» посмотри, что есть в базе:

```sql
SELECT status, COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL
GROUP BY status;
```

Если все задачи в одном статусе — фильтр нечем проверить: он вернёт «всё» или «ничего», и ошибку не будет видно. Сначала подготовь данные: хотя бы по одной задаче в каждом статусе.

**4. Проверить отчёт или дашборд.** «Задач в работе — 12» на дашборде — это чей-то `COUNT`. Напиши свой с теми же условиями и сравни. Расхождение — повод узнать, **какие** условия у системы: учитывает ли она удалённые, архивные проекты, задачи без исполнителя.

**5. Найти аномалии в данных.** `MIN` и `MAX` хорошо ловят «невозможные» даты:

```sql
-- задачи, созданные раньше своего проекта
SELECT p.id, p.name, p.created_at AS project_created, MIN(t.created_at) AS first_task
FROM projects p
JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.name, p.created_at
HAVING MIN(t.created_at) < p.created_at;
```

Ожидается пусто. Строка в результате — признак ошибки в коде, в импорте данных или в часовых поясах. Так же проверяют: комментарий раньше задачи, удаление раньше создания.

**Привычки:**

- **`COUNT(*)` или `COUNT(столбец)` — осознанно**: «считаю строки» или «считаю заполненные»;
- **при `LEFT JOIN` — `COUNT(правая.id)`** и фильтры правой таблицы в `ON`;
- **после `JOIN` 1:N не суммируй столбцы стороны «один»**;
- **`SUM` может вернуть `NULL`** — где нужен ноль, `COALESCE`;
- **перед сравнением средних — договорись об округлении**.

## Разборы из жизни

Пять ситуаций, где агрегаты обманывают. Первый разбор открыт — это образец. Остальные сначала попробуй разобрать сам.

<details class="details custom-block" open>
<summary>Разбор 1. Выручка в отчёте вдвое больше, чем у бухгалтерии — магазин электроники</summary>

**Ситуация.** Аналитик добавил в отчёт «Выручка по месяцам» столбец «число позиций в заказах». После релиза выручка за сентябрь — 9,8 млн, бухгалтерия по банковским выпискам насчитала 4,1 млн. До релиза отчёт сходился.

**Что видит мидл.**

- Чтобы посчитать позиции, к заказам присоединили `order_items`. Связь заказ → строки — 1:N.
- Выручку отчёт брал из `orders.total` — суммы заказа. После `JOIN` сумма заказа повторилась в каждой его строке и в `SUM` учлась столько раз, сколько в заказе позиций.
- Расхождение не кратно двум ровно: заказы из одной позиции посчитаны верно, из пяти — впятеро.

**Что делать.**

1. Взять один заказ с несколькими позициями и выполнить запрос отчёта только для него. Сравнить сумму с `orders.total`.
2. Сравнить число строк до и после нового `JOIN` за один день.
3. Завести баг: «После добавления столбца "число позиций" `SUM(orders.total)` считается по строкам заказа. Пример: заказ 8812, 4 позиции, 12 000 ₽ — в отчёте 48 000 ₽». Приложить оба запроса.
4. Предложить проверку на регрессию: заказ из одной позиции и заказ из нескольких в одном периоде.

**Чего не делать.**

- Не предлагать `SUM(DISTINCT total)` как исправление. Два разных заказа на одинаковую сумму «схлопнутся», и выручка станет меньше настоящей.

</details>

::: details Разбор 2. Средний чек на дашборде не совпадает с API — сервис доставки еды
**Ситуация.** На дашборде руководителя «средний чек за неделю — 1 247 ₽». Мобильное приложение для ресторанов через API показывает «средний чек — 1 038 ₽» за ту же неделю. Разработчики: «Формула одна — сумма на количество».

**Что видит мидл.**

- «Сумма на количество» — а количество чего? Если дашборд делит на `COUNT(*)` всех заказов, а API — на заказы с суммой, `AVG(total)`, — числа разойдутся из-за `NULL` у отменённых заказов.
- Если в одном месте сумма в копейках целого типа и делится как целое — дробная часть теряется.
- Округление: дашборд округляет каждый заказ, а потом считает среднее, API — наоборот. Разница — в копейках, но на неделе с тысячами заказов она заметна.

**Что делать.**

1. Посчитать в базе три варианта: `SUM(total) / COUNT(*)`, `AVG(total)`, `AVG(COALESCE(total, 0))` за ту же неделю. Увидеть, какой совпал с дашбордом, какой — с API.
2. Посмотреть, какие заказы попадают в каждый подсчёт: отменённые, тестовые, с нулевой суммой.
3. Задать вопрос аналитику: как **по требованиям** считается средний чек? Какие заказы входят, где округлять?
4. Завести баг на тот источник, который считает не по требованиям, — с запросом, который это показывает.

**Чего не делать.**

- Не подгонять свой запрос под одно из чисел и не объявлять его правильным. Правильное — то, что в требованиях.
:::

::: details Разбор 3. «Клиентов без заказов — 0», а их 300 — CRM интернет-магазина
**Ситуация.** Маркетинг готовит рассылку «вернитесь к нам» для зарегистрированных клиентов без заказов. Отчёт «Клиенты по числу заказов» показывает: с 0 заказов — никого. Маркетолог удивлён: на сайте регистрируются каждый день, и не все покупают.

**Что видит мидл.**

- Два возможных виновника. Если отчёт построен на `INNER JOIN` клиентов с заказами — клиенты без заказов просто не попадают в результат.
- Если `LEFT JOIN`, но считает `COUNT(*)`, — у клиента без заказов одна строка «без пары», и он попадает в группу «1 заказ».
- Во втором случае группа «1 заказ» раздута ровно на число клиентов без заказов. Это легко проверить.

**Что делать.**

1. Посчитать клиентов без заказов независимо: `customers LEFT JOIN orders … WHERE o.id IS NULL`.
2. Посмотреть запрос отчёта: какой `JOIN`, какой `COUNT`.
3. Завести баг: «Отчёт относит клиентов без заказов к группе "1 заказ": `COUNT(*)` после `LEFT JOIN`. Ожидается `COUNT(o.id)`. Пример: клиент 50213 зарегистрирован 01.10, заказов нет, в отчёте — 1».
4. Проверить, сколько рассылок уже ушло по неверным сегментам.

**Чего не делать.**

- Не проверять отчёт на тестовой базе, где у каждого клиента есть заказ. На таких данных `COUNT(*)` и `COUNT(o.id)` совпадают.
:::

::: details Разбор 4. На иконке 5 непрочитанных, а в списке 3 — корпоративный мессенджер
**Ситуация.** У иконки чата красный кружок «5». Пользователь открывает чат — непрочитанных сообщений три. Обновляет страницу — снова «5» на иконке и три в списке.

**Что видит мидл.**

- Счётчик и список строятся **разными** запросами. Счётчик — `COUNT(*)` по непрочитанным, список — сами сообщения.
- Список, скорее всего, фильтрует удалённые сообщения (`deleted_at IS NULL`) или сообщения из чатов, где пользователь уже не участник. Счётчик — нет.
- Разница «2» — это сообщения, которые удалили авторы после отправки.

**Что делать.**

1. Найти в базе непрочитанные сообщения пользователя без всяких фильтров — и с фильтрами списка. Сравнить числа с иконкой и со списком.
2. Определить, какие сообщения «лишние» в счётчике: удалённые, из покинутых чатов, системные.
3. Завести баг: «Счётчик непрочитанных учитывает удалённые сообщения: условие `deleted_at IS NULL` есть в списке, но нет в подсчёте».
4. Предложить тест: удалить непрочитанное сообщение — счётчик должен уменьшиться сразу.

**Чего не делать.**

- Не проверять счётчик только числом «сколько пришло». Каждое условие списка — удаление, участие, блокировка — должно быть и в счётчике.
:::

::: details Разбор 5. Фильтр по статусу «работает» — а данных для проверки не было — трекер задач
**Ситуация.** Тестировщик проверил фильтр задач по статусу: выбрал «В работе» — список задач на месте. Выбрал «Готово» — тоже на месте. «Работает». Через неделю пользователи пишут: фильтр по статусу показывает все задачи подряд.

**Что видит мидл.**

- На тестовом стенде все задачи были в статусе «Новая». Фильтр не применялся вообще, но и проверить это было нечем: при любом выборе — «какие-то задачи», а сверять не с чем.
- Пустой результат тоже не помог бы: «задач в работе нет» — честный ответ на этих данных.
- Ошибка в подготовке данных, а не в проверке шагов.

**Что делать.**

1. Перед тестом фильтра — распределение: `SELECT status, COUNT(*) FROM tasks GROUP BY status`.
2. Подготовить данные: хотя бы по одной-две задачи в каждом статусе, плюс удалённая задача в нужном статусе — она не должна попасть в выдачу.
3. Проверять не «что-то показалось», а **число**: фильтр «В работе» — ровно столько задач, сколько в базе с этим статусом. `total` в ответе API — то же число.
4. Добавить в чек-лист: «для фильтра — данные, где фильтр меняет результат».

**Чего не делать.**

- Не принимать «список не пустой» за проверку фильтра.
:::

## Частые ошибки

- **`COUNT(столбец)` вместо `COUNT(*)` — и наоборот.** Строки с `NULL` в столбце теряются или, наоборот, считаются лишние.
- **Столбец в `SELECT` не в `GROUP BY`.** Ошибка `must appear in the GROUP BY clause`. Каждый столбец — в `GROUP BY` или в агрегате.
- **Условие на группы в `WHERE`.** Агрегат в `WHERE` — ошибка. Условие с агрегатом — в `HAVING`.
- **Условие на строки в `HAVING`.** Работает, но вводит в заблуждение: `HAVING` — про группы. Без агрегата — в `WHERE`.
- **Псевдоним в `HAVING`.** В PostgreSQL — `column does not exist`. Пиши агрегат целиком.
- **`SUM` пустого набора — `NULL`.** Где нужен ноль — `COALESCE(SUM(…), 0)`.
- **`AVG` и `NULL`.** `AVG` делит на число непустых значений, а не на число строк.
- **`COUNT(*)` при `LEFT JOIN`.** Строка «без пары» превращается в 1. Считай `COUNT(правая.id)`.
- **Фильтр правой таблицы в `WHERE` при `LEFT JOIN`.** Группы с нулём пропадают из отчёта. Фильтр — в `ON`.
- **`SUM` после `JOIN` 1:N.** Столбец стороны «один» складывается столько раз, сколько у неё строк «многих».
- **`DISTINCT` «чинит» сумму.** `SUM(DISTINCT …)` схлопывает одинаковые значения разных записей.
- **Группа `NULL` не замечена.** Гостевые заказы, задачи без исполнителя — отдельная строка, которая может пройти `HAVING`.
- **Сравнение средних без округления и деление целых.** `4.375` ≠ `4.38` ≠ `4`. Сначала договорись, как считает система.
- **`LIMIT` без второго ключа сортировки.** При ничьей на границе результат меняется от запуска к запуску.

</template>

<template #task>

## Что нужно сделать

Цель — набить руку на подсчётах: выбирать между `COUNT(*)` и `COUNT(столбец)`, группировать, фильтровать группы, считать вместе с `JOIN` и не попадаться на `NULL`, нули и дубли. И проверять через агрегаты счётчики, которые показывает API.

Задание из пяти частей:

1. 30 задач на базе TaskFlow в DBeaver.
2. 25 задач на учебных таблицах магазина в онлайн-песочнице.
3. Мидл: сверь счётчики API с базой — 6 ситуаций.
4. Найди ошибки в 8 чужих запросах — письменно.
5. 12 задач на внимательность: условие словами, в нём подвох.

**Ветка TaskFlow:** `training-public`. Для частей 1 и 3 TaskFlow должен быть запущен у тебя на компьютере по инструкции из `README.md` репозитория (`docker compose up -d`). Подключение к базе в DBeaver — **только чтение**, как в уроке [«Что такое база данных»](/bd/01-chto-takoe-bd). Части 2, 4 и почти вся часть 5 делаются без TaskFlow.

**Онлайн-песочницы PostgreSQL** — для частей 2, 4 и 5. Ссылки ниже.

<!-- TODO: ссылки на песочницы PostgreSQL от автора -->

**Как работать с задачами.** Сначала напиши запрос сам и выполни. Не получается — открой подсказку. Потом сверься с эталоном. Если твой запрос другой, а результат тот же — это нормально.

В части 1 и части 3 есть запросы к проекту `1`, пользователю `2` по номеру. Если ты удалял их в блоке 2 — возьми другой действующий проект или пользователя.

**Привычка на весь урок:** прежде чем доверять числу, спроси себя: «что именно я считаю — строки, заполненные значения или разные значения?»

Уровни: **джун** — база, **мидл** — с подвохом, **с собеседования** — такие дают на собеседованиях.

## Часть 1. Задачи на TaskFlow (DBeaver)

Результаты зависят от твоего стенда: в блоке 2 ты создавал и удалял проекты, задачи, комментарии, участников. Поэтому эталон — это **запрос**, а не числа. Где сказано «в начальных данных» — это про данные, с которыми TaskFlow запускается впервые. «Действующие» записи — те, у которых `deleted_at IS NULL`.

### Агрегаты без группировки

**Задача 1** (джун). Сколько всего действующих задач?

::: details Подсказка
`COUNT(*)` и фильтр мягкого удаления.
:::

::: details Эталон
```sql
SELECT COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL;
```
В начальных данных — 7. Результат — одна строка, даже если задач нет: тогда `0`.
:::

**Задача 2** (джун). Одним запросом: сколько действующих задач всего, у скольких есть исполнитель и у скольких нет.

::: details Подсказка
`COUNT(*)` считает строки, `COUNT(assignee_id)` — заполненные значения. Разница между ними — задачи без исполнителя.
:::

::: details Эталон
```sql
SELECT COUNT(*)                      AS tasks,
       COUNT(assignee_id)            AS with_assignee,
       COUNT(*) - COUNT(assignee_id) AS without_assignee
FROM tasks
WHERE deleted_at IS NULL;
```
В начальных данных — 7, 6 и 1. Агрегаты можно складывать и вычитать, как обычные числа.
:::

**Задача 3** (джун). Сколько действующих задач назначено и сколько **разных** пользователей среди исполнителей? Почему числа разные?

::: details Подсказка
`COUNT(DISTINCT …)`.
:::

::: details Эталон
```sql
SELECT COUNT(assignee_id)          AS assigned_tasks,
       COUNT(DISTINCT assignee_id) AS assignees
FROM tasks
WHERE deleted_at IS NULL;
```
В начальных данных — 6 и 5: у Алексея Сидорова две задачи. `COUNT(DISTINCT)` тоже пропускает `NULL` — задача без исполнителя не стала «ещё одним исполнителем».
:::

**Задача 4** (джун). Когда зарегистрировался первый и последний из действующих пользователей?

::: details Подсказка
`MIN` и `MAX` работают с датами.
:::

::: details Эталон
```sql
SELECT MIN(created_at) AS first_user, MAX(created_at) AS last_user
FROM users
WHERE deleted_at IS NULL;
```
В начальных данных оба времени почти совпадают: пользователей создают при первом запуске. Если ты регистрировал пользователей в блоке 2, `last_user` — время твоей последней регистрации.
:::

**Задача 5** (джун). Первое и последнее по алфавиту название среди действующих проектов.

::: details Подсказка
`MIN` и `MAX` работают со строками.
:::

::: details Эталон
```sql
SELECT MIN(name) AS first_name, MAX(name) AS last_name
FROM projects
WHERE deleted_at IS NULL;
```
В начальных данных — «CRM System» и «TaskFlow Backend». Порядок строк зависит от правил сравнения базы: заглавные и строчные буквы, латиница и кириллица могут сортироваться не так, как ты ожидаешь.
:::

### GROUP BY

**Задача 6** (джун). Сколько действующих задач в каждом статусе? Сначала — статусы с наибольшим числом задач.

::: details Подсказка
`GROUP BY status`, сортировка по псевдониму агрегата.
:::

::: details Эталон
```sql
SELECT status, COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY tasks DESC, status;
```
В начальных данных: `TODO` — 3, `DONE` — 2, `IN_PROGRESS` — 2. Второй ключ `status` нужен для ничьей: без него порядок `DONE` и `IN_PROGRESS` не гарантирован.
:::

**Задача 7** (джун). Сколько действующих задач в каждом проекте — по `project_id`.

::: details Подсказка
Группа — проект.
:::

::: details Эталон
```sql
SELECT project_id, COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL
GROUP BY project_id
ORDER BY project_id;
```
В начальных данных: 3, 2, 1, 1. Проектов без задач здесь не будет никогда: запрос идёт по `tasks`, а у проекта без задач нет ни одной строки в `tasks`. Как их увидеть — задача 19.
:::

**Задача 8** (джун). Сколько действующих пользователей в каждом сочетании «глобальная роль × активен или нет».

::: details Подсказка
Два столбца в `GROUP BY`: `role` и `is_active`.
:::

::: details Эталон
```sql
SELECT role, is_active, COUNT(*) AS users
FROM users
WHERE deleted_at IS NULL
GROUP BY role, is_active
ORDER BY role, is_active;
```
В начальных данных три строки: `ADMIN` активный — 1, `USER` активный — 5, `USER` неактивный — 1 (Ольга Смирнова). Сочетания «неактивный `ADMIN`» в данных нет — и строки для него нет.
:::

**Задача 9** (джун). Сколько строк участия с каждой ролью в проектах — `OWNER`, `MANAGER`, `VIEWER`, `ADMIN`.

::: details Подсказка
Роль в проекте — в `project_members`.
:::

::: details Эталон
```sql
SELECT role, COUNT(*) AS members
FROM project_members
GROUP BY role
ORDER BY members DESC;
```
В начальных данных: `OWNER` — 4, `VIEWER` — 2, `MANAGER` — 1. `ADMIN` нет ни у кого — значит, и строки нет. Один человек с ролями в двух проектах посчитан дважды: считаем **участия**, а не людей.
:::

**Задача 10** (мидл). Сколько действующих задач на каждом исполнителе — по `assignee_id`. Найди в результате группу задач без исполнителя.

::: details Подсказка
Что `GROUP BY` делает с `NULL`?
:::

::: details Эталон
```sql
SELECT assignee_id, COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL
GROUP BY assignee_id
ORDER BY assignee_id;
```
Все задачи без исполнителя собраны в **одну** группу с `assignee_id = NULL` — в начальных данных в ней 1 задача. В DBeaver эта строка обычно последняя: при сортировке по возрастанию PostgreSQL ставит `NULL` в конец.
:::

**Задача 11** (мидл). Сколько действующих задач в каждом сочетании «проект × статус». Сравни число строк результата с задачами 6 и 7.

::: details Подсказка
Строк будет столько, сколько сочетаний реально есть в данных.
:::

::: details Эталон
```sql
SELECT project_id, status, COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL
GROUP BY project_id, status
ORDER BY project_id, status;
```
В начальных данных — 6 строк, хотя 4 проекта × 3 статуса = 12 возможных сочетаний. Отсутствующих сочетаний, например «проект 3, `DONE`», в результате нет: `GROUP BY` не создаёт строки с нулём.
:::

**Задача 12** (мидл). Сколько действующих комментариев оставлено в каждый день.

::: details Подсказка
Группировка по выражению: момент → дата, `created_at::date` из урока 2.
:::

::: details Эталон
```sql
SELECT created_at::date AS day, COUNT(*) AS comments
FROM comments
WHERE deleted_at IS NULL
GROUP BY created_at::date
ORDER BY day;
```
В начальных данных все комментарии — в день первого запуска. Дата берётся в часовом поясе сессии: комментарий, оставленный поздно вечером по UTC, у тебя может оказаться «завтрашним».
:::

**Задача 13** (джун). Выполни запрос, прочитай ошибку и исправь так, чтобы получить число действующих задач по проекту и статусу.

```sql
SELECT project_id, status, COUNT(*)
FROM tasks
GROUP BY project_id;
```

::: details Подсказка
Какой столбец из `SELECT` не стоит в `GROUP BY` и не завёрнут в агрегат?
:::

::: details Эталон
```sql
SELECT project_id, status, COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL
GROUP BY project_id, status
ORDER BY project_id, status;
```
Ошибка была `column "tasks.status" must appear in the GROUP BY clause or be used in an aggregate function`. Заодно добавлены фильтр удалённых и псевдоним: без фильтра в подсчёт попали бы удалённые задачи.
:::

### HAVING

**Задача 14** (джун). Проекты, в которых больше одной действующей задачи.

::: details Подсказка
Условие на число задач — это условие на группу.
:::

::: details Эталон
```sql
SELECT project_id, COUNT(*) AS tasks
FROM tasks
WHERE deleted_at IS NULL
GROUP BY project_id
HAVING COUNT(*) > 1
ORDER BY tasks DESC, project_id;
```
В начальных данных — проекты 1 и 2. Условие на удаление — в `WHERE`: оно про строку. Условие на количество — в `HAVING`.
:::

**Задача 15** (джун). Исполнители, на которых две и больше действующих задач: `id`, имя, фамилия, число задач.

::: details Подсказка
`JOIN users`, все неагрегатные столбцы — в `GROUP BY`.
:::

::: details Эталон
```sql
SELECT t.assignee_id, u.first_name, u.last_name, COUNT(*) AS tasks
FROM tasks t
JOIN users u ON u.id = t.assignee_id
WHERE t.deleted_at IS NULL
GROUP BY t.assignee_id, u.first_name, u.last_name
HAVING COUNT(*) >= 2
ORDER BY tasks DESC;
```
В начальных данных — Алексей Сидоров, 2 задачи. `INNER JOIN` здесь подходит: задачи без исполнителя в этом вопросе не нужны.
:::

**Задача 16** (мидл). Действующие проекты, в которых больше двух участников: `id`, название, число участников.

::: details Подсказка
Участники — строки `project_members`. Удалённый проект отсеивается в `WHERE`.
:::

::: details Эталон
```sql
SELECT p.id, p.name, COUNT(*) AS members
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name
HAVING COUNT(*) > 2
ORDER BY members DESC;
```
В начальных данных — «TaskFlow Backend», 3 участника. Здесь `COUNT(*)` честный: запрос идёт от `project_members`, каждая строка — настоящее участие.
:::

**Задача 17** (с собеседования). Проекты, где больше одной действующей задачи в статусе `TODO`. Объясни, какое условие ты поставил в `WHERE`, а какое в `HAVING` и почему.

::: details Подсказка
Статус — свойство строки. Количество — свойство группы.
:::

::: details Эталон
```sql
SELECT project_id, COUNT(*) AS todo_tasks
FROM tasks
WHERE deleted_at IS NULL
  AND status = 'TODO'
GROUP BY project_id
HAVING COUNT(*) > 1
ORDER BY project_id;
```
В начальных данных — проект 1, две задачи. `status = 'TODO'` — в `WHERE`: сначала отбираем задачи в `TODO`, потом считаем их по проектам. Условие `COUNT(*) > 1` в `WHERE` написать нельзя — групп и подсчётов на этом шаге ещё нет.
:::

### Агрегаты и JOIN

**Задача 18** (джун). Число действующих задач по действующим проектам — с названием проекта. Сначала проекты с наибольшим числом задач.

::: details Подсказка
`tasks JOIN projects`, группировка по `id` и названию проекта.
:::

::: details Эталон
```sql
SELECT p.id, p.name, COUNT(*) AS tasks
FROM tasks t
JOIN projects p ON p.id = t.project_id
WHERE t.deleted_at IS NULL
  AND p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY tasks DESC, p.id;
```
В `GROUP BY` есть `p.id`: два разных проекта с одинаковым названием не должны слиться в одну группу.
:::

**Задача 19** (мидл). Все действующие проекты и число действующих задач в каждом — **включая проекты без задач**. Сначала напиши с `COUNT(*)`, потом исправь. Если проекта без задач у тебя нет — создай его через Swagger и выполни оба запроса снова.

::: details Подсказка
`projects LEFT JOIN tasks`. Сколько строк `LEFT JOIN` оставляет для проекта без задач — и что с ней делает `COUNT(*)`?
:::

::: details Эталон
```sql
-- неправильно: у проекта без задач — 1
SELECT p.id, p.name, COUNT(*) AS tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY tasks, p.id;

-- правильно: у проекта без задач — 0
SELECT p.id, p.name, COUNT(t.id) AS tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY tasks, p.id;
```
`LEFT JOIN` оставил для проекта без задач одну строку с `NULL` в столбцах задачи. `COUNT(*)` её посчитал, `COUNT(t.id)` — нет. На проектах с задачами оба запроса совпадают — поэтому ошибку видно только на проекте без задач.
:::

**Задача 20** (мидл). Каждый действующий пользователь и число действующих задач, назначенных на него, — с нулями.

::: details Подсказка
`users LEFT JOIN tasks` по исполнителю. Фильтр удаления задачи — куда?
:::

::: details Эталон
```sql
SELECT u.id, u.first_name, u.last_name, COUNT(t.id) AS tasks
FROM users u
LEFT JOIN tasks t ON t.assignee_id = u.id AND t.deleted_at IS NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.first_name, u.last_name
ORDER BY tasks DESC, u.id;
```
В начальных данных 7 строк, у System Administrator и Ольги Смирновой — 0. Условие на `users` — в `WHERE`, на `tasks` — в `ON`.
:::

**Задача 21** (мидл). Каждый действующий проект: название, владелец (имя и фамилия одним столбцом), число участников.

::: details Подсказка
Владелец — через `projects.owner_id`, участники — через `project_members`. Склейка имени — в `GROUP BY` перечисли столбцы, из которых она собрана.
:::

::: details Эталон
```sql
SELECT p.id, p.name,
       owner.first_name || ' ' || owner.last_name AS owner,
       COUNT(pm.user_id) AS members
FROM projects p
JOIN users owner ON owner.id = p.owner_id
LEFT JOIN project_members pm ON pm.project_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, owner.first_name, owner.last_name
ORDER BY members DESC, p.id;
```
В начальных данных: 3, 2, 1, 1. `JOIN` к владельцу — «многие к одному», строк не размножает. В `GROUP BY` стоят `owner.first_name` и `owner.last_name`: выражение из них в `SELECT` разрешено. `LEFT JOIN` к участникам — на всякий случай: по спецификации владелец всегда участник, но проверить это — задача тестировщика, а не запроса.
:::

**Задача 22** (мидл). Каждая действующая задача и число её действующих комментариев — с нулями. Сначала задачи с наибольшим числом комментариев.

::: details Подсказка
Та же схема, что в задаче 19.
:::

::: details Эталон
```sql
SELECT t.id, t.title, COUNT(c.id) AS comments
FROM tasks t
LEFT JOIN comments c ON c.task_id = t.id AND c.deleted_at IS NULL
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.title
ORDER BY comments DESC, t.id;
```
В начальных данных у «Создать регистрацию» — 2, у трёх задач — по 1, у трёх — 0. Запомни этот запрос — он понадобится в части 3.
:::

**Задача 23** (с собеседования). Каждый действующий проект: число действующих задач и число участников — одним запросом. Сначала через `COUNT(t.id)` и `COUNT(pm.user_id)`. Почему у «TaskFlow Backend» получилось 9 и 9? Исправь.

::: details Подсказка
Две связи 1:N в одном запросе — урок 3. Что помогает считать уникальные записи?
:::

::: details Эталон
```sql
-- неправильно: задачи × участники
SELECT p.id, p.name, COUNT(t.id) AS tasks, COUNT(pm.user_id) AS members
FROM projects p
LEFT JOIN tasks t            ON t.project_id = p.id AND t.deleted_at IS NULL
LEFT JOIN project_members pm ON pm.project_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY p.id;

-- правильно: уникальные задачи и уникальные участники
SELECT p.id, p.name,
       COUNT(DISTINCT t.id)       AS tasks,
       COUNT(DISTINCT pm.user_id) AS members
FROM projects p
LEFT JOIN tasks t            ON t.project_id = p.id AND t.deleted_at IS NULL
LEFT JOIN project_members pm ON pm.project_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY p.id;
```
3 задачи × 3 участника = 9 строк, и оба счётчика посчитали все 9. `COUNT(DISTINCT)` спасает **счёт**: каждый `id` учитывается один раз. Если бы нужно было **суммировать** что-то из задач — `DISTINCT` бы не помог, нужны два отдельных запроса.
:::

### Условные подсчёты

**Задача 24** (мидл). Для каждого действующего проекта одной строкой: всего действующих задач, сколько в `TODO`, `IN_PROGRESS`, `DONE`.

::: details Подсказка
`COUNT(CASE WHEN … THEN 1 END)` — по столбцу на статус.
:::

::: details Эталон
```sql
SELECT p.id, p.name,
       COUNT(t.id)                                          AS total,
       COUNT(CASE WHEN t.status = 'TODO' THEN 1 END)        AS todo,
       COUNT(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 END) AS in_progress,
       COUNT(CASE WHEN t.status = 'DONE' THEN 1 END)        AS done
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY p.id;
```
В начальных данных у «TaskFlow Backend» — 3, 2, 1, 0. Сумма трёх статусных столбцов должна равняться `total`. Не равна — значит, в базе есть статус, о котором ты не знал. Хорошая проверка данных.
:::

**Задача 25** (мидл). Доля завершённых задач в каждом проекте — в процентах. Сначала посчитай `… * 100 / COUNT(*)`. Почему у «Mobile Banking» ровно 50, а если бы задач было 3 и одна готова — было бы 33, а не 33.3? Исправь.

::: details Подсказка
Деление целого на целое. Как сделать одно из чисел дробным? Проекты без задач здесь не нужны — подумай, почему.
:::

::: details Эталон
```sql
-- целочисленное деление: дробная часть теряется
SELECT p.name,
       COUNT(*) AS total,
       COUNT(CASE WHEN t.status = 'DONE' THEN 1 END) * 100 / COUNT(*) AS done_pct
FROM tasks t
JOIN projects p ON p.id = t.project_id
WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY p.id;

-- правильно: 100.0 делает выражение дробным, ROUND — один знак
SELECT p.name,
       COUNT(*) AS total,
       COUNT(CASE WHEN t.status = 'DONE' THEN 1 END) AS done,
       ROUND(COUNT(CASE WHEN t.status = 'DONE' THEN 1 END) * 100.0 / COUNT(*), 1) AS done_pct
FROM tasks t
JOIN projects p ON p.id = t.project_id
WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY p.id;
```
`INNER JOIN` здесь нарочно: у проекта без задач делить пришлось бы на 0, и запрос упал бы с ошибкой `division by zero`. Проект без задач не имеет «доли готовых» — его в этом отчёте не должно быть.
:::

### Мягкое удаление в подсчётах

**Задача 26** (мидл). По каждому проекту: сколько всего строк задач в таблице, сколько из них удалено и сколько действующих — одним запросом, без `CASE`.

::: details Подсказка
У удалённой задачи `deleted_at` заполнен. Что считает `COUNT(deleted_at)`?
:::

::: details Эталон
```sql
SELECT project_id,
       COUNT(*)                     AS all_rows,
       COUNT(deleted_at)            AS deleted,
       COUNT(*) - COUNT(deleted_at) AS active
FROM tasks
GROUP BY project_id
ORDER BY project_id;
```
`COUNT(deleted_at)` считает непустые значения — то есть удалённые задачи. В начальных данных удалённых нет. Если ты удалял задачи в блоке 2 — они здесь. Это же число полезно, когда проверяешь каскад: удалил проект — `deleted` по нему должен стать равен `all_rows`.
:::

**Задача 27** (с собеседования). Число действующих задач по действующим проектам с нулями. Напиши два варианта: `t.deleted_at IS NULL` в `WHERE` и в `ON`. На начальных данных они совпадут. Удали через API все задачи одного проекта (`DELETE /api/v1/tasks/{id}`) и сравни снова.

::: details Подсказка
Что `WHERE t.deleted_at IS NULL` сделает со строками проекта, у которого все задачи удалены? Останется ли у него строка «без пары»?
:::

::: details Эталон
```sql
-- в WHERE: проект, где все задачи удалены, пропадает
SELECT p.id, p.name, COUNT(t.id) AS tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
WHERE p.deleted_at IS NULL
  AND t.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY p.id;

-- в ON: проект остаётся с нулём
SELECT p.id, p.name, COUNT(t.id) AS tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY p.id;
```
У проекта с удалёнными задачами пары есть — удалённые задачи. `LEFT JOIN` склеил его с ними, строки «без пары» не создал. Потом `WHERE` выбросил все эти строки — и проект исчез. В `ON` удалённая задача просто не считается парой: проект без пар получает строку с `NULL`, `COUNT(t.id)` даёт 0.
:::

### Дубли и проверка данных

**Задача 28** (мидл). Найди в действующих задачах повторы: одинаковое название в одном проекте. Если у тебя пусто — создай через API две задачи с одним названием в одном проекте и выполни снова.

::: details Подсказка
Группа — сочетание проекта и названия. Повтор — группа, где больше одной строки.
:::

::: details Эталон
```sql
SELECT project_id, title, COUNT(*) AS copies
FROM tasks
WHERE deleted_at IS NULL
GROUP BY project_id, title
HAVING COUNT(*) > 1
ORDER BY copies DESC, project_id;
```
В начальных данных пусто. Спецификация TaskFlow не запрещает одинаковые названия задач — значит, это не баг, а особенность данных. Но такой запрос — универсальный шаблон поиска дублей: `GROUP BY` по полям, которые должны быть уникальны, и `HAVING COUNT(*) > 1`.
:::

**Задача 29** (с собеседования). Может ли один пользователь оказаться в одном проекте дважды? Напиши запрос, который это ищет, и объясни, почему результат всегда пустой.

::: details Подсказка
Посмотри в DBeaver ограничения таблицы `project_members` или раздел 7 спецификации.
:::

::: details Эталон
```sql
SELECT project_id, user_id, COUNT(*) AS copies
FROM project_members
GROUP BY project_id, user_id
HAVING COUNT(*) > 1;
```
Пусто всегда: `(project_id, user_id)` — составной первичный ключ, база не даст вставить вторую такую строку. Повторное добавление участника через API вернёт `409`. На собеседовании ценят именно это различие: где уникальность гарантирует **база**, а где только **код** — во втором случае поиск дублей нужен регулярно.
:::

**Задача 30** (мидл). Журнал `audit_log`: сколько записей каждого действия (`action`), когда было первое и последнее. Сначала самые частые.

::: details Подсказка
`MIN` и `MAX` по дате внутри каждой группы.
:::

::: details Эталон
```sql
SELECT action, COUNT(*) AS events, MIN(created_at) AS first_at, MAX(created_at) AS last_at
FROM audit_log
GROUP BY action
ORDER BY events DESC, action;
```
Начальные данные журнал не заполняют — всё, что здесь есть, сделал ты в блоке 2: регистрации, входы, создание проектов и задач. Удобный способ быстро увидеть, какие действия система вообще записывает и когда это было в последний раз.
:::

## Часть 2. Задачи на учебных таблицах

Те же пять таблиц магазина, что в уроке [«JOIN: соединение таблиц»](/bd/03-join), но данных больше:

- `customers` — 10 клиентов, двое мягко удалены. Трое ни разу не заказывали;
- `orders` — 20 заказов за август, сентябрь и октябрь. У трёх нет клиента — заказы гостей. У четырёх нет менеджера — оформлены на сайте. Один заказ пустой. Новые столбцы: `discount` — скидка по промокоду, пустая, если промокода не было; `rating` — оценка клиента от 1 до 5, пустая, если клиент не оценил;
- `order_items` — строки заказов: товар, количество, цена продажи;
- `products` — 12 товаров, два ни разу не заказывали;
- `employees` — 10 сотрудников, одна уволена.

**Выручка** в задачах — сумма `quantity * price` по строкам заказов, без учёта скидки. Отменённые заказы (`CANCELLED`) в выручку не входят.

Открой онлайн-песочницу PostgreSQL, вставь скрипт целиком и выполни. Скрипт можно выполнять повторно — он сначала удаляет таблицы. Если ты выполнял скрипт урока 3 — этот его заменит.

Время в данных — UTC, и первая строка скрипта, `SET TIME ZONE 'UTC';`, переключает на него сессию. Если ты выполняешь запросы отдельно от скрипта и даты или месяцы не совпали с эталоном, — выполни `SET TIME ZONE 'UTC';` и повтори.

::: details Скрипт для песочницы
```sql
-- Учебные таблицы магазина для урока «Агрегаты, GROUP BY, HAVING».
-- Расширенный вариант скрипта из урока «JOIN»: те же таблицы, клиенты,
-- товары и сотрудники, но заказов больше — за три месяца, — и у заказов
-- два новых столбца: скидка по промокоду и оценка клиента.
-- Время — в UTC, первая команда переключает на него сессию. Скрипт можно выполнять повторно.

SET TIME ZONE 'UTC';

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS employees;

-- Сотрудники. manager_id — руководитель, ссылка на эту же таблицу.
CREATE TABLE employees (
    id         serial PRIMARY KEY,
    name       varchar(100) NOT NULL,
    position   varchar(50)  NOT NULL,
    manager_id integer      REFERENCES employees (id),
    fired_at   timestamptz
);

INSERT INTO employees (name, position, manager_id, fired_at) VALUES
('Сергей Громов',   'Генеральный директор', NULL, NULL),
('Ирина Белова',    'Руководитель продаж',  1,    NULL),
('Антон Лис',       'Руководитель склада',  1,    NULL),
('Мария Ковалёва',  'Менеджер',             2,    NULL),
('Денис Орлов',     'Менеджер',             2,    NULL),
('Юлия Ким',        'Менеджер',             2,    '2026-10-10 18:00:00+00'),
('Павел Седов',     'Кладовщик',            3,    NULL),
('Ольга Нестерова', 'Кладовщик',            3,    NULL),
('Глеб Титов',      'Стажёр',               4,    NULL),
('Вера Ушакова',    'Бухгалтер',            1,    NULL);

-- Клиенты с аккаунтом. deleted_at — мягкое удаление.
CREATE TABLE customers (
    id         serial PRIMARY KEY,
    name       varchar(100) NOT NULL,
    city       varchar(50)  NOT NULL,
    deleted_at timestamptz
);

INSERT INTO customers (name, city, deleted_at) VALUES
('Алёна Котова',     'Москва',          NULL),
('Пётр Иванов',      'Казань',          NULL),
('Мария Лебедева',   'Москва',          NULL),
('Олег Ким',         'Новосибирск',     NULL),
('Светлана Орлова',  'Санкт-Петербург', NULL),
('Дарья Волкова',    'Казань',          NULL),
('Кирилл Зуев',      'Москва',          NULL),
('Наталья Фёдорова', 'Самара',          NULL),
('Игорь Белов',      'Москва',          '2026-10-12 09:00:00+00'),
('Ольга Петрова',    'Санкт-Петербург', '2026-10-14 15:30:00+00');

CREATE TABLE products (
    id           serial PRIMARY KEY,
    name         varchar(100)  NOT NULL,
    category     varchar(30)   NOT NULL,
    price        numeric(10,2) NOT NULL,
    discontinued boolean       NOT NULL DEFAULT false
);

INSERT INTO products (name, category, price, discontinued) VALUES
('Футболка базовая',      'Одежда',      990.00,  false),
('Худи оверсайз',         'Одежда',      3490.00, false),
('Джинсы прямые',         'Одежда',      4590.00, false),
('Кроссовки беговые',     'Обувь',       6990.00, false),
('Кеды «Ретро»',          'Обувь',       4290.00, false),
('Наушники SONY WH-1000', 'Электроника', 24990.00, false),
('Колонка Sony mini',     'Электроника', 5990.00, false),
('Кабель USB-C 2 м',      'Электроника', 790.00,  false),
('Плед 150×200',          'Дом',         2990.00, false),
('Полка настенная 50 см', 'Дом',         1890.00, false),
('Чай «Зелёный жасмин»',  'Продукты',    450.00,  false),
('Куртка зимняя',         'Одежда',      12990.00, true);

-- Заказы. customer_id пустой — заказ гостя без аккаунта.
-- employee_id — менеджер, который оформил заказ; пустой — заказ с сайта без менеджера.
-- discount — скидка по промокоду в рублях; пустая — промокода не было.
-- rating — оценка клиента от 1 до 5; пустая — клиент не оценил.
CREATE TABLE orders (
    id          serial PRIMARY KEY,
    customer_id integer       REFERENCES customers (id),
    employee_id integer       REFERENCES employees (id),
    status      varchar(20)   NOT NULL,
    created_at  timestamptz   NOT NULL,
    discount    numeric(10,2),
    rating      integer
);

INSERT INTO orders (customer_id, employee_id, status, created_at, discount, rating) VALUES
(1,    4,    'DELIVERED', '2026-08-03 10:15:00+00', NULL,    5),
(2,    5,    'DELIVERED', '2026-08-07 12:40:00+00', 500.00,  4),
(3,    4,    'DELIVERED', '2026-08-15 09:05:00+00', NULL,    NULL),
(NULL, 5,    'DELIVERED', '2026-08-21 14:20:00+00', NULL,    5),
(5,    6,    'CANCELLED', '2026-08-28 11:00:00+00', NULL,    NULL),
(1,    4,    'DELIVERED', '2026-09-02 16:45:00+00', 1000.00, 5),
(4,    NULL, 'DELIVERED', '2026-09-05 08:30:00+00', NULL,    3),
(2,    5,    'DELIVERED', '2026-09-11 13:10:00+00', NULL,    NULL),
(6,    5,    'DELIVERED', '2026-09-14 10:50:00+00', NULL,    4),
(NULL, NULL, 'CANCELLED', '2026-09-18 15:25:00+00', NULL,    NULL),
(9,    4,    'DELIVERED', '2026-09-22 09:40:00+00', 300.00,  NULL),
(3,    9,    'DELIVERED', '2026-09-27 12:00:00+00', NULL,    5),
(1,    4,    'PAID',      '2026-10-01 17:15:00+00', NULL,    NULL),
(2,    5,    'SHIPPED',   '2026-10-03 19:30:00+00', 500.00,  NULL),
(5,    6,    'DELIVERED', '2026-10-08 11:20:00+00', NULL,    4),
(NULL, 6,    'NEW',       '2026-10-12 12:00:00+00', NULL,    NULL),
(6,    NULL, 'NEW',       '2026-10-13 18:05:00+00', NULL,    NULL),
(3,    5,    'PAID',      '2026-10-14 10:10:00+00', NULL,    NULL),
(4,    4,    'SHIPPED',   '2026-10-15 14:35:00+00', 200.00,  NULL),
(1,    NULL, 'NEW',       '2026-10-16 20:50:00+00', NULL,    NULL);

-- Строки заказа: какой товар, сколько штук и по какой цене продан.
CREATE TABLE order_items (
    id         serial PRIMARY KEY,
    order_id   integer       NOT NULL REFERENCES orders (id),
    product_id integer       NOT NULL REFERENCES products (id),
    quantity   integer       NOT NULL,
    price      numeric(10,2) NOT NULL
);

INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
(1,  1,  2, 990.00),
(1,  8,  1, 790.00),
(2,  6,  1, 24990.00),
(3,  3,  1, 4590.00),
(3,  11, 2, 450.00),
(4,  9,  1, 2990.00),
(5,  4,  1, 6990.00),
(6,  2,  1, 3490.00),
(6,  5,  1, 4290.00),
(7,  7,  1, 5990.00),
(8,  1,  3, 990.00),
(8,  11, 4, 450.00),
(9,  6,  1, 24990.00),
(10, 11, 5, 450.00),
(11, 8,  2, 790.00),
(12, 4,  1, 6990.00),
(12, 1,  1, 990.00),
(13, 9,  2, 2990.00),
(13, 8,  1, 790.00),
(14, 7,  1, 5990.00),
(14, 2,  1, 3490.00),
(15, 3,  1, 4590.00),
(15, 5,  1, 4290.00),
(16, 1,  1, 990.00),
(17, 9,  1, 2990.00),
(18, 2,  1, 2950.00),
(18, 11, 2, 450.00),
(19, 2,  1, 3490.00),
(19, 1,  2, 990.00);
```
:::

Данные известны, поэтому в эталонах указаны числа, которые должен вернуть запрос. Если у тебя другое — ищи разницу.

**Задача 31** (джун). Сколько всего заказов, у скольких есть клиент и сколько разных клиентов делали заказы.

::: details Подсказка
Три вида `COUNT` в одном запросе.
:::

::: details Эталон
```sql
SELECT COUNT(*)                    AS all_orders,
       COUNT(customer_id)          AS with_customer,
       COUNT(DISTINCT customer_id) AS customers
FROM orders;
```
20, 17, 7. Три заказа — гостевые, а у некоторых клиентов по несколько заказов.
:::

**Задача 32** (джун). Выручка магазина. Сначала посчитай сумму по всем строкам заказов, потом — только по неотменённым заказам.

::: details Подсказка
Статус — в `orders`, деньги — в `order_items`. Во втором запросе нужен `JOIN`.
:::

::: details Эталон
```sql
SELECT SUM(quantity * price) AS revenue
FROM order_items;

SELECT SUM(oi.quantity * oi.price) AS revenue
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.status <> 'CANCELLED';
```
137 000 и 127 760. Разница — два отменённых заказа. `JOIN` строк к заказу — «многие к одному», сумма по строкам не раздувается.
:::

**Задача 33** (джун). Самая низкая, самая высокая и средняя цена товаров, которые сейчас продаются. Среднюю округли до копеек.

::: details Подсказка
Снятый с продажи товар — `discontinued`.
:::

::: details Эталон
```sql
SELECT MIN(price)           AS min_price,
       MAX(price)           AS max_price,
       ROUND(AVG(price), 2) AS avg_price
FROM products
WHERE NOT discontinued;
```
450.00, 24 990.00 и 5 222.73. Без фильтра средняя — 5 870.00: в неё попадает снятая с продажи куртка.
:::

**Задача 34** (джун). Дата и время первого и последнего заказа.

::: details Подсказка
`MIN` и `MAX` по `created_at`.
:::

::: details Эталон
```sql
SELECT MIN(created_at) AS first_order, MAX(created_at) AS last_order
FROM orders;
```
3 августа 10:15 и 16 октября 20:50 по UTC: скрипт переключает сессию на UTC.
:::

**Задача 35** (джун). Сколько заказов в каждом статусе. Сначала самые частые.

::: details Подсказка
`GROUP BY status`.
:::

::: details Эталон
```sql
SELECT status, COUNT(*) AS orders
FROM orders
GROUP BY status
ORDER BY orders DESC, status;
```
5 строк: `DELIVERED` — 11, `NEW` — 3, `CANCELLED`, `PAID` и `SHIPPED` — по 2.
:::

**Задача 36** (джун). По каждой категории товаров: сколько товаров и средняя цена, округлённая до копеек.

::: details Подсказка
Группа — `category`.
:::

::: details Эталон
```sql
SELECT category, COUNT(*) AS products, ROUND(AVG(price), 2) AS avg_price
FROM products
GROUP BY category
ORDER BY products DESC, category;
```
5 строк. «Одежда» — 4 товара, «Электроника» — 3, «Дом» и «Обувь» — по 2, «Продукты» — 1.
:::

**Задача 37** (джун). Сколько действующих клиентов в каждом городе. Потом одним запросом: сколько действующих клиентов и сколько разных городов.

::: details Подсказка
Второй запрос — без группировки: `COUNT(city)` и `COUNT(DISTINCT city)`.
:::

::: details Эталон
```sql
SELECT city, COUNT(*) AS customers
FROM customers
WHERE deleted_at IS NULL
GROUP BY city
ORDER BY customers DESC, city;

SELECT COUNT(city) AS customers, COUNT(DISTINCT city) AS cities
FROM customers
WHERE deleted_at IS NULL;
```
Первый — 5 строк, в Москве 3 клиента. Второй — 8 и 5.
:::

**Задача 38** (мидл). Средняя оценка заказов. Выведи: число заказов, число оценённых, среднюю оценку с округлением до сотых, а ещё `SUM(rating) / COUNT(*)` и `SUM(rating) / COUNT(rating)`. Объясни каждое число.

::: details Подсказка
`AVG` пропускает `NULL`. Деление целого на целое — целое.
:::

::: details Эталон
```sql
SELECT COUNT(*)                    AS all_orders,
       COUNT(rating)               AS rated,
       ROUND(AVG(rating), 2)       AS avg_rating,
       SUM(rating) / COUNT(*)      AS wrong_1,
       SUM(rating) / COUNT(rating) AS wrong_2
FROM orders;
```
20, 8, 4.38, 1, 4. `AVG` — 35 / 8 = 4,375. `wrong_1` делит на все заказы, включая неоценённые, и ещё отбрасывает дробную часть: 35 / 20 = 1. `wrong_2` делит правильно, но как целые: 4 вместо 4,375.
:::

**Задача 39** (мидл). Скидки: сколько заказов с промокодом, сумма скидок, средняя скидка среди заказов с промокодом и средняя скидка на любой заказ. Средние округли до копеек.

::: details Подсказка
Для «на любой заказ» `NULL` нужно превратить в 0.
:::

::: details Эталон
```sql
SELECT COUNT(discount)                      AS with_promo,
       SUM(discount)                        AS total_discount,
       ROUND(AVG(discount), 2)              AS avg_promo,
       ROUND(AVG(COALESCE(discount, 0)), 2) AS avg_all
FROM orders;
```
5, 2 500.00, 500.00, 125.00. Оба средних «правильные» — они отвечают на разные вопросы.
:::

**Задача 40** (мидл). Сумма скидок по отменённым заказам. Почему результат пустой? Сделай так, чтобы был 0.

::: details Подсказка
Есть ли у отменённых заказов хоть одна скидка?
:::

::: details Эталон
```sql
SELECT SUM(discount) AS discounts
FROM orders
WHERE status = 'CANCELLED';

SELECT COUNT(*) AS orders, COALESCE(SUM(discount), 0) AS discounts
FROM orders
WHERE status = 'CANCELLED';
```
Первый — `NULL`: у обоих отменённых заказов скидки нет, складывать нечего. Второй — 2 и 0. `COUNT` пустоту считает нулём, `SUM` — нет.
:::

**Задача 41** (джун). Выручка по категориям товаров. Сначала самые доходные.

::: details Подсказка
Три таблицы: строки заказа, товары — для категории, заказы — для статуса.
:::

::: details Эталон
```sql
SELECT p.category, SUM(oi.quantity * oi.price) AS revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders o   ON o.id = oi.order_id
WHERE o.status <> 'CANCELLED'
GROUP BY p.category
ORDER BY revenue DESC;
```
5 строк. «Электроника» — 65 120, «Одежда» — 31 510, «Обувь» — 15 570, «Дом» — 11 960, «Продукты» — 3 600. Сумма — 127 760, как в задаче 32. Сверять части с итогом — хорошая привычка.
:::

**Задача 42** (мидл). По месяцам: число неотменённых заказов и выручка. Потом замени счётчик заказов на `COUNT(*)` и объясни, что изменилось.

::: details Подсказка
`date_trunc('month', …)`. После `JOIN` со строками заказа заказ повторяется столько раз, сколько в нём строк.
:::

::: details Эталон
```sql
SELECT date_trunc('month', o.created_at) AS month,
       COUNT(DISTINCT o.id)              AS orders,
       SUM(oi.quantity * oi.price)       AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'CANCELLED'
GROUP BY date_trunc('month', o.created_at)
ORDER BY month;
```
Август — 4 заказа и 36 240, сентябрь — 6 и 53 090, октябрь — 7 и 38 430. С `COUNT(*)` — 6, 9 и 12: это число **строк заказов**, а не заказов. Пустой заказ 20 сюда не попал: у него нет строк, `INNER JOIN` его выбросил. Для выручки это верно.
:::

**Задача 43** (джун). Сколько заказов у каждого клиента — по `customer_id`. Что за строка с пустым `customer_id`?

::: details Подсказка
`GROUP BY` собирает все `NULL` в одну группу.
:::

::: details Эталон
```sql
SELECT customer_id, COUNT(*) AS orders
FROM orders
GROUP BY customer_id
ORDER BY orders DESC, customer_id;
```
8 строк. Строка с `NULL` — 3 заказа гостей. Это не клиент, а группа «без клиента».
:::

**Задача 44** (мидл). Клиенты, у которых 3 заказа и больше. Сначала просто `GROUP BY customer_id` и `HAVING`. Сколько строк? Кто лишний? Потом исправь и выведи имена.

::: details Подсказка
Проходит ли условие группа `NULL`?
:::

::: details Эталон
```sql
-- 4 строки: группа гостей тоже прошла HAVING
SELECT customer_id, COUNT(*) AS orders
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 3
ORDER BY customer_id;

-- 3 строки: только клиенты
SELECT c.id, c.name, COUNT(*) AS orders
FROM orders o
JOIN customers c ON c.id = o.customer_id
GROUP BY c.id, c.name
HAVING COUNT(*) >= 3
ORDER BY orders DESC, c.id;
```
Во втором запросе гостевые заказы отсеял `INNER JOIN` — у них нет пары. Можно и без `JOIN`: `WHERE customer_id IS NOT NULL`. Алёна Котова — 4, Пётр Иванов и Мария Лебедева — по 3.
:::

**Задача 45** (мидл). Все действующие клиенты и число их заказов — с нулями. Сначала через `COUNT(*)`, потом исправь.

::: details Подсказка
`customers LEFT JOIN orders`. Что `COUNT(*)` делает со строкой «без пары»?
:::

::: details Эталон
```sql
-- у клиентов без заказов — 1
SELECT c.id, c.name, COUNT(*) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name
ORDER BY orders, c.id;

-- правильно
SELECT c.id, c.name, COUNT(o.id) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name
ORDER BY orders, c.id;
```
8 строк в обоих. У Кирилла Зуева и Натальи Фёдоровой в первом — 1, во втором — 0. У остальных числа одинаковые.
:::

**Задача 46** (с собеседования). Все действующие клиенты и число их **доставленных** заказов — с нулями. Сначала поставь `o.status = 'DELIVERED'` в `WHERE`, посчитай строки, потом исправь.

::: details Подсказка
Условие на правую таблицу при `LEFT JOIN`.
:::

::: details Эталон
```sql
-- 6 строк: клиенты без доставленных заказов пропали
SELECT c.id, c.name, COUNT(o.id) AS delivered
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE c.deleted_at IS NULL
  AND o.status = 'DELIVERED'
GROUP BY c.id, c.name
ORDER BY c.id;

-- 8 строк: все действующие клиенты
SELECT c.id, c.name, COUNT(o.id) AS delivered
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'DELIVERED'
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name
ORDER BY c.id;
```
Даже `COUNT(o.id)` не спасает, если строки выбросил `WHERE` ещё до группировки. Во втором запросе у Кирилла Зуева и Натальи Фёдоровой — 0.
:::

**Задача 47** (мидл). Каждый товар и сколько штук его заказывали за всё время (по всем заказам). Товары без заказов — с нулём, а не с пустотой.

::: details Подсказка
`products LEFT JOIN order_items`, `SUM` по `quantity`. Что `SUM` возвращает, если строк нет?
:::

::: details Эталон
```sql
SELECT p.id, p.name, COALESCE(SUM(oi.quantity), 0) AS sold
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
GROUP BY p.id, p.name
ORDER BY sold DESC, p.id;
```
12 строк. Больше всего — чай, 13 штук. Полка и куртка — 0. Без `COALESCE` у них `NULL`, и при сортировке по убыванию PostgreSQL поставит их **первыми**: `NULL` считается больше любого числа.
:::

**Задача 48** (мидл). Топ-3 клиента по выручке. Выполни с `ORDER BY revenue DESC LIMIT 3`, потом с `LIMIT 4`. Что не так с третьим местом? Сделай результат предсказуемым.

::: details Подсказка
Посмотри на выручку третьего и четвёртого.
:::

::: details Эталон
```sql
SELECT c.name, SUM(oi.quantity * oi.price) AS revenue
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'CANCELLED'
GROUP BY c.id, c.name
ORDER BY revenue DESC, c.name
LIMIT 4;
```
Пётр Иванов — 39 240, Дарья Волкова — 27 980, Алёна Котова и Мария Лебедева — по 17 320. Ничья на границе: с `LIMIT 3` без второго ключа база вернёт одну из двух — какую, не обещает. Второй ключ `c.name` делает результат стабильным. А показывать ли обеих — вопрос к требованиям, не к SQL.
:::

**Задача 49** (мидл). Все сотрудники и число заказов, которые они оформили, — с нулями. Сначала через `INNER JOIN`: сколько строк? Сколько заказов не попало ни к кому и почему?

::: details Подсказка
`employees LEFT JOIN orders` по `employee_id`. Заказы без менеджера — `employee_id IS NULL`.
:::

::: details Эталон
```sql
SELECT e.id, e.name, e.position, COUNT(o.id) AS orders
FROM employees e
LEFT JOIN orders o ON o.employee_id = e.id
GROUP BY e.id, e.name, e.position
ORDER BY orders DESC, e.id;
```
10 строк, у шестерых — 0. С `INNER JOIN` — 4 строки: Мария Ковалёва и Денис Орлов — по 6, Юлия Ким — 3, Глеб Титов — 1. Вместе 16 из 20: ещё 4 заказа оформлены на сайте без менеджера. Чтобы увидеть их в отчёте как отдельную строку, нужен `orders LEFT JOIN employees` с группировкой по менеджеру — группа `NULL`.
:::

**Задача 50** (с собеседования). Процент доставленных заказов у каждого сотрудника, который оформлял заказы. Сначала посчитай `COUNT(CASE …) * 100 / COUNT(*)`. Почему у Марии Ковалёвой 66, а не 66.7? Исправь, округли до десятых.

::: details Подсказка
Целое × 100 / целое — целое.
:::

::: details Эталон
```sql
SELECT e.name,
       COUNT(*) AS orders,
       COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END) AS delivered,
       ROUND(COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END) * 100.0 / COUNT(*), 1) AS pct
FROM employees e
JOIN orders o ON o.employee_id = e.id
GROUP BY e.id, e.name
ORDER BY e.id;
```
4 строки: 66.7, 66.7, 33.3, 100.0. С `* 100 / COUNT(*)` — 66, 66, 33, 100: дробная часть отброшена, даже не округлена. `INNER JOIN` — чтобы не делить на 0 у сотрудников без заказов.
:::

**Задача 51** (с собеседования). Коллега одним запросом считает по клиентам и выручку, и сумму скидок по неотменённым заказам. Выполни его. У кого скидки неверные? Коллега предлагает `SUM(DISTINCT o.discount)` — проверь. Исправь.

```sql
SELECT c.name,
       SUM(o.discount)             AS discounts,
       SUM(oi.quantity * oi.price) AS revenue
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'CANCELLED'
GROUP BY c.id, c.name
ORDER BY c.id;
```

::: details Подсказка
Скидка — одна на заказ. Сколько строк у заказов со скидкой? Сравни с `SELECT id, discount FROM orders WHERE discount IS NOT NULL`.
:::

::: details Эталон
Скидки раздуты: у Алёны Котовой 2 000 вместо 1 000, у Петра Иванова — 1 500 вместо 1 000, у Олега Кима — 400 вместо 200. У части заказов со скидкой по две строки (заказы 6, 14, 19) — их скидка посчитана дважды. Выручка — верная: она считается по строкам.

С `SUM(DISTINCT o.discount)` у Петра Иванова — 500: два его заказа со скидкой по 500 «схлопнулись» в одно значение. У Алёны совпало случайно.

Правильно — два запроса:

```sql
-- скидки: без строк заказа
SELECT c.name, SUM(o.discount) AS discounts
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.status <> 'CANCELLED'
GROUP BY c.id, c.name
ORDER BY c.id;

-- выручка: со строками заказа
SELECT c.name, SUM(oi.quantity * oi.price) AS revenue
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'CANCELLED'
GROUP BY c.id, c.name
ORDER BY c.id;
```
Скидки: Алёна — 1 000, Пётр — 1 000, Олег — 200, Игорь Белов — 300, у троих — `NULL`.
:::

**Задача 52** (мидл). Средний чек неотменённых заказов: выручка, делённая на число заказов. Одним запросом, округли до копеек. Потом посчитай `ROUND(AVG(oi.quantity * oi.price), 2)` — почему это не средний чек?

::: details Подсказка
После `JOIN` со строками число заказов — это `COUNT(DISTINCT o.id)`, а не `COUNT(*)`.
:::

::: details Эталон
```sql
SELECT COUNT(DISTINCT o.id)                                          AS orders,
       SUM(oi.quantity * oi.price)                                   AS revenue,
       ROUND(SUM(oi.quantity * oi.price) / COUNT(DISTINCT o.id), 2)  AS avg_check
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'CANCELLED';
```
17 заказов, 127 760, средний чек — 7 515.29. `AVG(oi.quantity * oi.price)` — 4 731.85: это средняя **строка** заказа, а не средний заказ. Пустой заказ 20 в расчёт не попал — у него нет чека. Включать ли его — вопрос к требованиям.
:::

**Задача 53** (мидл). По месяцам одной строкой на месяц: всего заказов, сколько доставлено, сколько отменено.

::: details Подсказка
Группировка по месяцу и условные подсчёты.
:::

::: details Эталон
```sql
SELECT date_trunc('month', created_at)                    AS month,
       COUNT(*)                                           AS orders,
       COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END)   AS delivered,
       COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)   AS cancelled
FROM orders
GROUP BY date_trunc('month', created_at)
ORDER BY month;
```
Август — 5, 4, 1. Сентябрь — 7, 6, 1. Октябрь — 8, 1, 0: октябрьские заказы ещё в пути.
:::

**Задача 54** (мидл). Найди уволенных сотрудников, у которых последний оформленный заказ — **после** даты увольнения.

::: details Подсказка
`MAX(o.created_at)` по сотруднику и сравнение с `fired_at` в `HAVING`. `fired_at` — в `GROUP BY`.
:::

::: details Эталон
```sql
SELECT e.name, e.fired_at, COUNT(o.id) AS orders, MAX(o.created_at) AS last_order
FROM employees e
JOIN orders o ON o.employee_id = e.id
WHERE e.fired_at IS NOT NULL
GROUP BY e.id, e.name, e.fired_at
HAVING MAX(o.created_at) > e.fired_at;
```
1 строка: Юлия Ким, уволена 10 октября, последний заказ — 12 октября. В уроке 3 ты нашёл это через `JOIN` построчно, здесь — одной строкой на сотрудника. Так проверяют большие таблицы: не тысячи строк глазами, а одна строка «есть нарушение».
:::

**Задача 55** (мидл). Товары, которые продавали по разной цене или по цене, отличной от каталожной: каталожная цена, минимальная и максимальная цена продажи, число строк.

::: details Подсказка
`MIN(oi.price)` и `MAX(oi.price)` по товару. Каталожная цена — `p.price`, её нужно добавить в `GROUP BY`.
:::

::: details Эталон
```sql
SELECT p.name, p.price AS catalog_price,
       MIN(oi.price) AS min_sold, MAX(oi.price) AS max_sold, COUNT(*) AS lines
FROM products p
JOIN order_items oi ON oi.product_id = p.id
GROUP BY p.id, p.name, p.price
HAVING MIN(oi.price) <> MAX(oi.price)
    OR MIN(oi.price) <> p.price
ORDER BY p.id;
```
1 строка: худи — в каталоге 3 490, один раз продано за 2 950. Это может быть акция, а может быть ошибка цены. Для тестировщика — повод спросить, откуда цена в строке заказа и когда она может отличаться от каталога.
:::

## Часть 3 (мидл). Сверь счётчики API с базой

Списки TaskFlow отдают не только записи, но и счётчики: `total` в обёртке списка, `commentsCount` у задачи. API считает их запросом к базе — значит, их можно проверить своим запросом с теми же условиями.

Для каждой ситуации напиши:

- какой запрос с агрегатом выполнишь;
- с каким полем ответа сравниваешь;
- что будет багом.

Выполни хотя бы три ситуации на своём стенде по-настоящему: запрос в API → запрос в базу → скриншоты.

**Ситуация 1.** `GET /api/v1/projects/1/members` вернул `items` — участников проекта — и `total`. Проверь `total`, длину массива `items` и что ни один пользователь не встречается в проекте дважды.

::: details Эталон
```sql
SELECT COUNT(*) AS members, COUNT(DISTINCT pm.user_id) AS distinct_users
FROM project_members pm
WHERE pm.project_id = 1;

SELECT pm.role, COUNT(*) AS members
FROM project_members pm
WHERE pm.project_id = 1
GROUP BY pm.role
ORDER BY pm.role;
```
Ожидаю: `total` = `members`. Длина `items` = `total`, если участников не больше `limit` (по умолчанию 20), иначе — `limit`, и `hasNext` — `true`. `members` = `distinct_users` всегда: `(project_id, user_id)` — первичный ключ. Второй запрос сверяю с ролями в `items`: сколько `OWNER`, `MANAGER`, `VIEWER`. Багом будет: `total` не совпадает с базой; `items` длиннее `limit`; в `items` один `userId` дважды — в базе так быть не может, значит, ошибка в том, как API собирает ответ: например, лишний `JOIN`.
:::

**Ситуация 2.** Администратор вызвал `GET /api/v1/tasks?projectId=1&status=TODO`. Проверь `total`.

::: details Эталон
```sql
SELECT COUNT(*) AS total
FROM tasks
WHERE deleted_at IS NULL
  AND project_id = 1
  AND status = 'TODO';
```
Ожидаю: `total` в ответе = результату. Каждый параметр запроса — условие в `WHERE`, плюс `deleted_at IS NULL`: удалённые задачи в списке не показываются. Администратор видит все задачи, поэтому других условий нет. Багом будет: `total` больше — в подсчёт попали удалённые задачи или фильтр не применился; меньше — потерялись задачи. Отдельно проверяю `limit=1`: `total` не должен измениться — это число **всех** подходящих задач, а не задач на странице.
:::

**Ситуация 3.** Иван (`ivan@example.com`, `id = 2`) вызвал `GET /api/v1/tasks` без фильтров. Спецификация: обычный пользователь видит задачи из проектов, где он участник, **плюс** задачи, назначенные на него напрямую. Проверь `total`.

::: details Эталон
```sql
SELECT COUNT(*) AS total
FROM tasks t
LEFT JOIN project_members pm
       ON pm.project_id = t.project_id
      AND pm.user_id    = 2
WHERE t.deleted_at IS NULL
  AND (pm.user_id IS NOT NULL OR t.assignee_id = 2);
```
`LEFT JOIN` к строке участия **этого** пользователя в проекте задачи: есть пара — Иван участник проекта. `OR t.assignee_id = 2` добавляет задачи, где он исполнитель без членства. `COUNT(*)` здесь честный: у пары «проект, пользователь» не больше одной строки участия — первичный ключ, — поэтому `JOIN` строк не размножает. Задача, где Иван и участник, и исполнитель, посчитается один раз.

В начальных данных — 5: три задачи «TaskFlow Backend» и две «Mobile Banking». Багом будет: `total` больше — Иван видит чужие задачи; меньше — не видит задачу, назначенную на него в чужом проекте. Для второго случая полезно назначить Ивана исполнителем задачи в проекте, где он не участник, и проверить снова.
:::

**Ситуация 4.** `GET /api/v1/tasks?projectId=1` вернул у каждой задачи `commentsCount`. По спецификации это число **неудалённых** комментариев. Проверь, потом удали один комментарий (`DELETE /api/v1/tasks/{taskId}/comments/{id}`) и проверь снова.

::: details Эталон
```sql
SELECT t.id, t.title, COUNT(c.id) AS comments_count
FROM tasks t
LEFT JOIN comments c ON c.task_id = t.id AND c.deleted_at IS NULL
WHERE t.project_id = 1
  AND t.deleted_at IS NULL
GROUP BY t.id, t.title
ORDER BY t.id;
```
Ожидаю: у каждой задачи `commentsCount` = `comments_count`, у задачи без комментариев — `0`, а не `null`. После удаления у этой задачи счётчик уменьшился на 1, в базе у комментария заполнен `deleted_at`. Ещё сверяю `commentsCount` с `total` в `GET /tasks/{taskId}/comments` — это два разных подсчёта одного и того же, они обязаны совпадать. Багом будет: счётчик не изменился после удаления; у задачи без комментариев не 0; `commentsCount` и `total` списка комментариев расходятся.
:::

**Ситуация 5.** Тебе нужно проверить фильтр `GET /tasks?status=…` во всех трёх статусах и для двух-трёх проектов. Хватит ли для этого данных на стенде? Чего не хватает?

::: details Эталон
```sql
SELECT p.id, p.name,
       COUNT(t.id)                                          AS total,
       COUNT(CASE WHEN t.status = 'TODO' THEN 1 END)        AS todo,
       COUNT(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 END) AS in_progress,
       COUNT(CASE WHEN t.status = 'DONE' THEN 1 END)        AS done,
       COUNT(DISTINCT t.assignee_id)                        AS assignees
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY p.id;
```
Смотрю на нули. В начальных данных у «TaskFlow Backend» нет ни одной задачи в `DONE`, у «CRM System» и «Online Store» — по одной задаче. Значит, для проверки «фильтр по проекту и статусу» нужно создать данные: в одном проекте — хотя бы по две задачи в каждом статусе, чтобы фильтр **отсекал** часть задач. Плюс удалённая задача в нужном статусе — её в выдаче быть не должно. Плюс несколько исполнителей — пригодится для фильтра `assigneeId`. После подготовки выполняю запрос снова: теперь у каждого фильтра есть число, с которым сравнить `total`.
:::

**Ситуация 6.** Проверь данные на «невозможные» даты: задача создана раньше своего проекта; комментарий — раньше своей задачи; запись удалена раньше, чем создана.

::: details Эталон
```sql
-- задачи раньше проекта
SELECT p.id, p.name, p.created_at AS project_created, MIN(t.created_at) AS first_task
FROM projects p
JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.name, p.created_at
HAVING MIN(t.created_at) < p.created_at;

-- комментарии раньше задачи
SELECT t.id, t.title, t.created_at AS task_created, MIN(c.created_at) AS first_comment
FROM tasks t
JOIN comments c ON c.task_id = t.id
GROUP BY t.id, t.title, t.created_at
HAVING MIN(c.created_at) < t.created_at;

-- удалено раньше, чем создано
SELECT COUNT(*) AS bad_tasks
FROM tasks
WHERE deleted_at < created_at;
```
Ожидаю: пусто, пусто, 0. Строка в результате — повод разбираться: время ставит база или код, в каком часовом поясе, не правил ли кто-то данные руками. Такие проверки особенно полезны после миграций и импорта данных: их запускают как «инварианты» после каждого прогона. Последний запрос повтори для `projects` и `comments`.
:::

## Часть 4 (письменно). Найди ошибки в чужих запросах

Коллега написал восемь запросов к учебным таблицам из части 2. Два падают с ошибкой. Остальные выполняются, но возвращают не то — или работают правильно, но написаны так, что это случайность. Для каждого:

1. Объясни, что не так и что запрос вернёт на самом деле.
2. Напиши исправленный запрос.
3. Проверь оба варианта в песочнице.

**Запрос 1.** «Клиенты, их город и число заказов».

```sql
SELECT c.name, c.city, COUNT(o.id) AS orders
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.name;
```

**Запрос 2.** «Клиенты с тремя заказами и больше».

```sql
SELECT customer_id, COUNT(*) AS orders
FROM orders
WHERE COUNT(*) >= 3
GROUP BY customer_id;
```

**Запрос 3.** «Действующие клиенты и число их заказов, включая тех, у кого заказов нет».

```sql
SELECT c.name, COUNT(*) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name;
```

**Запрос 4.** «Сколько товаров в заказах каждого клиента и сколько он сэкономил на скидках».

```sql
SELECT c.name, COUNT(oi.id) AS items, SUM(o.discount) AS discounts
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.name;
```

**Запрос 5.** «Число заказов по статусам, кроме отменённых».

```sql
SELECT status, COUNT(*) AS orders
FROM orders
GROUP BY status
HAVING status <> 'CANCELLED';
```

**Запрос 6.** «Сумма скидок по каждому действующему клиенту — для выгрузки в бухгалтерию, где пустая ячейка ломает импорт».

```sql
SELECT c.name, SUM(o.discount) AS discounts
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name;
```

**Запрос 7.** «Средняя оценка доставленных заказов — сверить с числом 4.38 на дашборде».

```sql
SELECT SUM(rating) / COUNT(*) AS avg_rating
FROM orders
WHERE status = 'DELIVERED';
```

**Запрос 8.** «По каждому статусу: сколько всего заказов и сколько из них от действующих клиентов».

```sql
SELECT o.status, COUNT(*) AS orders, COUNT(c.id) AS from_active
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
WHERE c.deleted_at IS NULL
GROUP BY o.status;
```

::: details Самопроверка: что должно получиться
- Запрос 1: исходный — ошибка про `c.city`, исправленный — 7 строк.
- Запрос 2: исходный — ошибка про агрегат в `WHERE`, исправленный — 3 строки. Если у тебя 4 — посмотри на группу гостей.
- Запрос 3: исходный — у двух клиентов 1 заказ, исправленный — 0.
- Запрос 4: исходный — скидки у Алёны Котовой 2 000, исправленный — 1 000; число товаров не меняется.
- Запрос 5: исходный и исправленный — одинаковые 4 строки. Ошибка не в результате.
- Запрос 6: исходный — у пятерых клиентов `NULL`, исправленный — 0.
- Запрос 7: исходный — 3, исправленный — 4.38.
- Запрос 8: исходный — у `DELIVERED` 10 заказов, исправленный — 11; `from_active` в обоих — 9.

Объяснение пиши своими словами — числа только помогают проверить запрос.
:::

## Часть 5. Задачи на внимательность

В жизни и на собеседовании задачу дают словами, а не готовым SQL: «отбери все книги авторов из России начиная с 1964 года». Запрос по такому условию написать несложно. Сложно — **заметить подвох**: включается ли 1964 год, что будет с книгой двух авторов, куда денется книга без года.

Поэтому в каждой задаче сначала прочитай условие медленно и спроси себя: «что тут можно понять не так?» Потом открой «О чём подумать» — там 2–3 строки о подвохе. И только потом пиши запрос.

Большая часть задач — на новых учебных таблицах «Библиотека»:

- `countries` — страны с двухбуквенным кодом;
- `authors` — авторы и их страна. У одного автора страна неизвестна, у одного нет книг;
- `books` — книги, жанр и год издания. Одна книга без года, две — ровно 1964 года;
- `book_authors` — кто написал книгу. У трёх книг по два автора;
- `readers` — читатели. Двое ещё ни разу не брали книгу;
- `loans` — выдачи книг: когда выдали, когда вернули, оценка читателя.

Скрипт выполняется в той же песочнице, что и скрипт магазина, — таблицы не пересекаются.

::: details Скрипт библиотеки для песочницы
```sql
-- Учебные таблицы библиотеки для задач на внимательность урока «Агрегаты, GROUP BY, HAVING».
-- Авторы и книги вымышленные. Время — в UTC, первая команда переключает на него сессию. Скрипт можно выполнять повторно.

SET TIME ZONE 'UTC';

DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS readers;
DROP TABLE IF EXISTS book_authors;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS authors;
DROP TABLE IF EXISTS countries;

-- Страны. code — двухбуквенный код страны.
CREATE TABLE countries (
    id   serial PRIMARY KEY,
    code varchar(2)   NOT NULL UNIQUE,
    name varchar(50)  NOT NULL
);

INSERT INTO countries (code, name) VALUES
('RU', 'Россия'),
('BY', 'Беларусь'),
('GB', 'Великобритания'),
('US', 'США');

-- Авторы. country_id — страна автора; пустая — страна неизвестна.
CREATE TABLE authors (
    id         serial PRIMARY KEY,
    name       varchar(100) NOT NULL,
    country_id integer      REFERENCES countries (id)
);

INSERT INTO authors (name, country_id) VALUES
('Олег Ветров',    1),
('Ирина Лаптева',  1),
('Сергей Дубов',   1),
('Анна Ким',       1),
('John Miller',    4),
('Emma Clark',     3),
('Павел Гусев',    2),
('Марина Белова',  NULL),
('Денис Яровой',   1);   -- книг в библиотеке пока нет

-- Книги. year — год издания; пустой — год неизвестен.
CREATE TABLE books (
    id    serial PRIMARY KEY,
    title varchar(100) NOT NULL,
    genre varchar(30)  NOT NULL,
    year  integer
);

INSERT INTO books (title, genre, year) VALUES
('Северный ветер',   'Роман',      1958),
('Город без карт',   'Фантастика', 1964),
('Тихая гавань',     'Роман',      1964),
('Обратный отсчёт',  'Фантастика', 1971),
('Ключ от лета',     'Роман',      1963),
('Последний поезд',  'Детектив',   1999),
('Пустые улицы',     'Детектив',   2003),
('Чужой код',        'Фантастика', 2008),
('Нулевой меридиан', 'Фантастика', 2012),
('Снег в апреле',    'Роман',      2015),
('Тени прошлого',    'Детектив',   2019),
('Дом у реки',       'Роман',      NULL),
('Starfall',         'Фантастика', 2010),
('Silent Hours',     'Детектив',   2016),
('Граница',          'Роман',      2005),
('Лабиринт',         'Детектив',   2021),
('Мостовая',         'Роман',      2000);

-- Кто написал книгу. У книги может быть несколько авторов — соавторы.
CREATE TABLE book_authors (
    book_id   integer NOT NULL REFERENCES books (id),
    author_id integer NOT NULL REFERENCES authors (id),
    PRIMARY KEY (book_id, author_id)
);

INSERT INTO book_authors (book_id, author_id) VALUES
(1, 3), (2, 3), (3, 2), (4, 2), (5, 2), (6, 1), (7, 1),
(8, 1), (8, 5),            -- «Чужой код»: Россия + США
(9, 1), (9, 4),            -- «Нулевой меридиан»: оба автора из России
(10, 4), (11, 4), (12, 2),
(13, 5), (13, 6),          -- «Starfall»: США + Великобритания
(14, 6), (15, 7), (16, 8), (17, 1);

CREATE TABLE readers (
    id            serial PRIMARY KEY,
    name          varchar(100) NOT NULL,
    registered_at timestamptz  NOT NULL
);

INSERT INTO readers (name, registered_at) VALUES
('Алиса Новикова',  '2026-03-10 10:00:00+00'),
('Борис Егоров',    '2026-04-02 15:30:00+00'),
('Вера Соколова',   '2026-05-21 12:00:00+00'),
('Глеб Морозов',    '2026-06-14 09:45:00+00'),
('Дина Захарова',   '2026-07-01 18:20:00+00'),
('Егор Павлов',     '2026-08-30 11:00:00+00'),
('Жанна Фролова',   '2026-10-05 16:10:00+00');

-- Выдачи книг. returned_at пустой — книга ещё у читателя.
-- rating — оценка читателя после возврата, от 1 до 5; пустая — не оценил.
CREATE TABLE loans (
    id          serial PRIMARY KEY,
    book_id     integer     NOT NULL REFERENCES books (id),
    reader_id   integer     NOT NULL REFERENCES readers (id),
    loaned_at   timestamptz NOT NULL,
    returned_at timestamptz,
    rating      integer
);

INSERT INTO loans (book_id, reader_id, loaned_at, returned_at, rating) VALUES
(6,  1, '2026-08-05 10:00:00+00', '2026-08-19 12:00:00+00', 5),
(13, 4, '2026-08-08 15:00:00+00', '2026-08-21 10:00:00+00', 4),
(16, 1, '2026-08-28 12:20:00+00', '2026-09-05 17:00:00+00', NULL),
(8,  1, '2026-08-20 14:00:00+00', '2026-09-02 10:00:00+00', 4),
(10, 2, '2026-08-25 17:30:00+00', '2026-09-08 11:00:00+00', NULL),
(2,  3, '2026-09-01 00:00:00+00', '2026-09-15 09:00:00+00', 5),
(13, 2, '2026-09-10 13:00:00+00', '2026-09-24 16:00:00+00', 3),
(6,  4, '2026-09-12 11:15:00+00', '2026-09-26 10:00:00+00', 4),
(9,  5, '2026-09-15 19:00:00+00', '2026-09-29 18:00:00+00', 5),
(14, 3, '2026-09-20 10:30:00+00', '2026-10-04 12:00:00+00', NULL),
(11, 1, '2026-09-30 23:30:00+00', '2026-10-14 10:00:00+00', 4),
(8,  4, '2026-10-01 00:00:00+00', '2026-10-15 15:00:00+00', 5),
(10, 5, '2026-10-03 12:00:00+00', NULL,                     NULL),
(16, 2, '2026-10-07 16:45:00+00', NULL,                     NULL),
(6,  3, '2026-10-10 10:00:00+00', '2026-10-17 13:00:00+00', 3),
(3,  4, '2026-10-12 18:00:00+00', NULL,                     NULL),
(13, 1, '2026-10-15 09:30:00+00', '2026-10-19 20:00:00+00', 5),
(7,  5, '2026-10-18 14:00:00+00', NULL,                     NULL),
(4,  3, '2026-10-19 11:00:00+00', NULL,                     NULL);
```
:::

**Задача 56** (джун). «Отбери все книги авторов из России начиная с 1964 года».

::: details О чём подумать
- «Начиная с 1964» — 1964 год **включается**: `>= 1964`, а не `> 1964`.
- У книги может быть два автора из России — после `JOIN` она появится дважды. Книга нужна один раз.
- Страну проверяй по коду `RU`, а не по названию: «Россия», «РФ», «россия» — разные строки.
- Книга российского автора без года не попадёт: `NULL >= 1964` — не TRUE. Это стоит проговорить вслух.
:::

::: details Эталон
```sql
SELECT DISTINCT b.id, b.title, b.year
FROM books b
JOIN book_authors ba ON ba.book_id = b.id
JOIN authors a       ON a.id = ba.author_id
JOIN countries c     ON c.id = a.country_id
WHERE c.code = 'RU'
  AND b.year >= 1964
ORDER BY b.year, b.id;
```
10 книг. Без `DISTINCT` — 11 строк: «Нулевой меридиан» написали двое российских авторов. С `> 1964` — 8: пропадают обе книги 1964 года. «Дом у реки» не попал — у неё нет года.
:::

**Задача 57** (джун). «Сколько книг написали российские авторы?»

::: details О чём подумать
- Считаем **книги**, а не строки «книга — автор».
- Книга двух российских авторов — одна книга.
:::

::: details Эталон
```sql
SELECT COUNT(*)                   AS rows_cnt,
       COUNT(DISTINCT ba.book_id) AS books
FROM book_authors ba
JOIN authors a   ON a.id = ba.author_id
JOIN countries c ON c.id = a.country_id
WHERE c.code = 'RU';
```
14 строк, но 13 книг. Правильный ответ — `COUNT(DISTINCT ba.book_id)`.
:::

**Задача 58** (джун). «Какая доля книг в каталоге — без года издания? В процентах».

::: details О чём подумать
- Книги без года — это `COUNT(*) - COUNT(year)`: `COUNT(year)` пропускает `NULL`.
- Деление целых отбросит дробную часть.
:::

::: details Эталон
```sql
SELECT COUNT(*)                                              AS books,
       COUNT(*) - COUNT(year)                                AS without_year,
       ROUND((COUNT(*) - COUNT(year)) * 100.0 / COUNT(*), 1) AS pct
FROM books;
```
17 книг, 1 без года, 5.9 %. С `* 100` вместо `* 100.0` — 5.
:::

**Задача 59** (джун). «Найди читателей, которые ни разу не брали книгу».

::: details О чём подумать
- Нужны читатели **без пары** в `loans` — `LEFT JOIN`.
- Если считать выдачи через `COUNT(*)`, у таких читателей будет 1, а не 0.
:::

::: details Эталон
```sql
SELECT r.id, r.name
FROM readers r
LEFT JOIN loans l ON l.reader_id = r.id
WHERE l.id IS NULL
ORDER BY r.id;
```
2 читателя: Егор Павлов и Жанна Фролова. Тот же ответ даст группировка с `HAVING COUNT(l.id) = 0`. А `HAVING COUNT(*) = 0` вернёт пусто — `COUNT(*)` у них равен 1.
:::

**Задача 60** (джун). «Какие книги сейчас на руках у читателей?»

::: details О чём подумать
- «На руках» — выдана и **не возвращена**: `returned_at IS NULL`.
- Пустая оценка `rating` тут ни при чём — её не ставят и после возврата.
:::

::: details Эталон
```sql
SELECT b.title, r.name, l.loaned_at
FROM loans l
JOIN books b   ON b.id = l.book_id
JOIN readers r ON r.id = l.reader_id
WHERE l.returned_at IS NULL
ORDER BY l.loaned_at;
```
5 строк. Самая давняя — «Снег в апреле» у Дины Захаровой с 3 октября.
:::

**Задача 61** (мидл). «Сколько выдач было в прошлом месяце?» Считай, что сегодня 20 октября 2026 года.

::: details О чём подумать
- «Прошлый месяц» — весь сентябрь, а не «последние 30 дней».
- Граница: выдача 30 сентября в 23:30 — сентябрьская. `<= '2026-09-30'` её потеряет: это 30 сентября 00:00. `BETWEEN '2026-09-01' AND '2026-10-01'` захватит выдачу ровно в полночь 1 октября.
- Надёжно — полуинтервал: `>= начало` и `< начало следующего месяца`.
:::

::: details Эталон
```sql
SELECT COUNT(*) AS loans
FROM loans
WHERE loaned_at >= '2026-09-01'
  AND loaned_at <  '2026-10-01';
```
6 выдач. С `<= '2026-09-30'` — 5, с `BETWEEN … '2026-10-01'` — 7. Числа верны для сессии в UTC — скрипт её так и настраивает. Не совпало — выполни `SET TIME ZONE 'UTC';` и повтори.
:::

**Задача 62** (джун). «Какой жанр самый популярный по числу выдач?»

::: details О чём подумать
- «Самый популярный» звучит как одна строка — `LIMIT 1`. А если первое место делят два жанра?
- Сначала посмотри на все жанры, потом решай.
:::

::: details Эталон
```sql
SELECT b.genre, COUNT(*) AS loans
FROM loans l
JOIN books b ON b.id = l.book_id
GROUP BY b.genre
ORDER BY loans DESC, b.genre;
```
«Детектив» и «Фантастика» — по 8 выдач, «Роман» — 3. С `LIMIT 1` ты бы назвал один жанр и не узнал, что второй с ним наравне. Правильный ответ — два жанра.
:::

**Задача 63** (мидл). «Топ-3 автора по числу выдач их книг».

::: details О чём подумать
- Проверь, нет ли ничьей на третьем месте: выполни с `LIMIT 4`.
- Выдача книги двух соавторов засчитывается каждому из них — для вопроса «чьи книги читают» это верно.
:::

::: details Эталон
```sql
SELECT a.name, COUNT(*) AS loans
FROM loans l
JOIN book_authors ba ON ba.book_id = l.book_id
JOIN authors a       ON a.id = ba.author_id
GROUP BY a.id, a.name
ORDER BY loans DESC, a.name
LIMIT 4;
```
Олег Ветров — 7, John Miller — 5, третье место делят Emma Clark и Анна Ким — по 4. С `LIMIT 3` в ответ попадёт только одна из них. Что делать с ничьей — показать четверых или выбрать по другому правилу — вопрос к тому, кто поставил задачу.
:::

**Задача 64** (джун). «Авторы, у которых не меньше 3 книг, изданных после 2000 года».

::: details О чём подумать
- «Не меньше 3» — `>= 3`, а не `> 3`.
- «После 2000» — 2000 год не входит: `> 2000`. У Олега Ветрова есть книга 2000 года.
- Условие на год — про строку, `WHERE`. Условие на число книг — про группу, `HAVING`.
:::

::: details Эталон
```sql
SELECT a.name, COUNT(*) AS books
FROM authors a
JOIN book_authors ba ON ba.author_id = a.id
JOIN books b         ON b.id = ba.book_id
WHERE b.year > 2000
GROUP BY a.id, a.name
HAVING COUNT(*) >= 3
ORDER BY books DESC, a.name;
```
2 автора: Олег Ветров и Анна Ким — по 3 книги. С `>= 2000` у Ветрова было бы 4 — состав тот же, а число в отчёте другое.
:::

**Задача 65** (мидл). «Средняя оценка книг каждого автора».

::: details О чём подумать
- Не каждая выдача оценена. `AVG` пропускает `NULL` — так и нужно: неоценённая выдача не равна оценке 0.
- У автора может не быть ни одной оценки — среднее будет `NULL`, и это честный ответ.
:::

::: details Эталон
```sql
SELECT a.name, COUNT(l.rating) AS rated, ROUND(AVG(l.rating), 2) AS avg_rating
FROM authors a
JOIN book_authors ba ON ba.author_id = a.id
JOIN loans l         ON l.book_id = ba.book_id
GROUP BY a.id, a.name
ORDER BY a.name;
```
7 строк. У Анны Ким — 4.50 по двум оценкам. Если «на всякий случай» написать `AVG(COALESCE(l.rating, 0))`, у неё будет 2.25: две неоценённые выдачи стали нулями. У Ирины Лаптевой и Марины Беловой — `NULL`: их книги брали, но не оценили.
:::

**Задача 66** (джун). TaskFlow, DBeaver. «Активные проекты, в которых больше двух задач».

::: details О чём подумать
- «Активный» в TaskFlow — `status = 'ACTIVE'` (бывает ещё `ARCHIVED`). И не удалённый: `deleted_at IS NULL`.
- Удалённые задачи не считаются.
- «Больше двух» — `> 2`: проект ровно с двумя задачами не подходит.
:::

::: details Эталон
```sql
SELECT p.id, p.name, COUNT(t.id) AS tasks
FROM projects p
JOIN tasks t ON t.project_id = p.id
WHERE p.deleted_at IS NULL
  AND p.status = 'ACTIVE'
  AND t.deleted_at IS NULL
GROUP BY p.id, p.name
HAVING COUNT(t.id) > 2
ORDER BY tasks DESC, p.id;
```
В начальных данных — 1 строка: «TaskFlow Backend», 3 задачи. «Mobile Banking» с двумя задачами не прошёл — с `>= 2` он бы попал.
:::

**Задача 67** (джун). Песочница магазина. «Средний чек за октябрь».

::: details О чём подумать
- Отменённые заказы в средний чек не входят.
- После `JOIN` со строками заказа делить нужно на число **заказов** — `COUNT(DISTINCT o.id)`, а не на `COUNT(*)`.
:::

::: details Эталон
```sql
SELECT COUNT(DISTINCT o.id)                                         AS orders,
       ROUND(SUM(oi.quantity * oi.price) / COUNT(DISTINCT o.id), 2) AS avg_check
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'CANCELLED'
  AND o.created_at >= '2026-10-01'
  AND o.created_at <  '2026-11-01';
```
7 заказов, средний чек 5 490.00. С `COUNT(*)` — 3 202.50: это средняя строка заказа. Пустой заказ 20 в расчёт не попал — у него нет чека.
:::

## Как сдавать

Оформи результат в документе и покажи куратору лично — в чат или на созвоне.

Что должно быть в результате:

- часть 1: 30 запросов, к каждому — скриншот результата из DBeaver. Для задач, где нужно сравнить варианты, — оба результата и вывод;
- часть 2: 25 запросов и результат каждого. Где результат не совпал с эталоном — объяснение почему;
- часть 3: шесть ситуаций — запросы, с чем сравниваешь и что будет багом. Для трёх выполненных — скриншоты ответа API и результатов в базе;
- часть 4: восемь объяснений и исправленных запросов;
- часть 5: 12 запросов, к каждому — одной строкой, какой подвох ты заметил в условии.

</template>

<template #questions>

## Ситуационные кейсы

Это рабочие ситуации, о которых могут спросить и на собеседовании. Готового ответа, который нужно угадать, здесь нет. Сначала подумай сам, потом открывай разбор.

::: details Кейс 1. «Чем WHERE отличается от HAVING?»
**Ситуация.** Интервьюер: «Объясните разницу. Можно ли всегда писать условия в `HAVING`?»

**Как рассуждать.** В каком порядке выполняются `WHERE`, `GROUP BY` и `HAVING`? Что существует на каждом шаге — строки или группы?

**Пример ответа.** `WHERE` фильтрует **строки** до группировки, `HAVING` — **группы** после неё. Порядок выполнения: `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT`. Поэтому агрегат в `WHERE` написать нельзя — групп ещё нет, — а в `HAVING` можно: «клиенты, у которых больше пяти заказов» — это `HAVING COUNT(*) > 5`.

Писать всё в `HAVING` можно не всегда: условие на столбец, которого нет в `GROUP BY`, там вызовет ошибку. А условие на сгруппированный столбец сработает, но запрос станет обманчивым: `HAVING` обещает условие на итог, а там условие на строку. В `WHERE` такое условие понятнее и одинаково работает в любой базе. Правило: условие без агрегата — в `WHERE`, с агрегатом — в `HAVING`.

И ещё деталь: в PostgreSQL в `HAVING` нельзя сослаться на псевдоним из `SELECT` — `SELECT` выполняется позже. Пишут агрегат целиком.
:::

::: details Кейс 2. «Чем COUNT(*) отличается от COUNT(столбец) и COUNT(DISTINCT столбец)?»
**Ситуация.** Интервьюер: «В таблице `orders` 1000 строк. `COUNT(*)` даёт 1000, `COUNT(promo_code)` — 230, `COUNT(DISTINCT promo_code)` — 12. Что это значит?»

**Как рассуждать.** Что каждая функция делает с `NULL`? С повторяющимися значениями?

**Пример ответа.** `COUNT(*)` считает **строки** — всего 1000 заказов. `COUNT(promo_code)` считает **непустые** значения — промокод указан в 230 заказах, у остальных 770 он `NULL`. `COUNT(DISTINCT promo_code)` считает **разные** непустые значения — использовали 12 разных промокодов.

Как тестировщик я выбираю функцию по вопросу: «сколько записей» — `COUNT(*)`, «сколько записей, где поле заполнено» — `COUNT(поле)`, «сколько разных значений» — `COUNT(DISTINCT поле)`. Перепутать их — получить правдоподобное, но неверное число. Особенно опасно с `LEFT JOIN`: там `COUNT(*)` считает строку «без пары» как единицу.
:::

::: details Кейс 3. Хитрый вопрос: «Почему сумма в отчёте больше реальной?»
**Ситуация.** Интервьюер: «В отчёте "Выручка по клиентам" сумма вдвое больше, чем в бухгалтерии. Запрос — `SUM(o.total)` с `JOIN` к строкам заказа, чтобы ещё показать число позиций. Что не так?»

**Как рассуждать.** Сколько строк у заказа после `JOIN` со строками? Чему принадлежит `total` — заказу или строке?

**Пример ответа.** Связь «заказ → строки» — один ко многим. После `JOIN` заказ из трёх позиций превращается в три строки, и `o.total` в каждой — одинаковый. `SUM` складывает его три раза. Раздувается всё, что принадлежит стороне «один».

`SUM(DISTINCT o.total)` — не исправление: два разных заказа на одинаковую сумму «схлопнутся», и выручка станет меньше. `COUNT(DISTINCT o.id)` спасает счёт заказов, но не сумму. Правильно — не смешивать уровни: выручку считать по `orders` без строк, число позиций — отдельным запросом.

Проверил бы так: заказ с несколькими позициями, запрос отчёта только для него — и сравнение с `orders.total`.
:::

::: details Кейс 4. «Как найти дубли в таблице?»
**Ситуация.** Интервьюер: «В таблице клиентов `customers` не должно быть двух записей об одном человеке. Как проверить, что дублей нет? И что сделать, если они есть?»

**Как рассуждать.** Как собрать одинаковые значения вместе? Как оставить только повторяющиеся?

**Пример ответа.**

```sql
SELECT name, city, COUNT(*) AS copies
FROM customers
WHERE deleted_at IS NULL
GROUP BY name, city
HAVING COUNT(*) > 1;
```

Сначала уточню, что значит «один человек» — по каким полям: здесь для примера имя и город. `GROUP BY name, city` собирает одинаковые сочетания в группу, `HAVING COUNT(*) > 1` оставляет только повторы. Если в ключе есть столбец, который бывает `NULL`, пустые значения исключаю в `WHERE` — иначе они соберутся в одну группу и покажутся «дублем». Удалённых не считаю — это решают требования. На учебных таблицах магазина результат пустой.

Дальше я бы выяснил, гарантирует ли уникальность **база** — ограничением, или только **код** — проверкой при регистрации. Если только код, дубли могут появиться при параллельных запросах или импорте — это тест-кейсы. А найденные дубли — баг с примерами `id` и вопросом аналитику, какую запись считать основной.
:::

::: details Кейс 5. «Как через базу проверить счётчик на экране?»
**Ситуация.** Интервьюер: «На экране проекта написано "Задач: 12". Как проверите, что число верное?»

**Как рассуждать.** Какие задачи система считает? Какие условия могут отличаться?

**Пример ответа.** Сначала выясню, **что** считает экран: все задачи проекта или только действующие, учитываются ли архивные, видит ли пользователь все задачи или только свои. Потом напишу запрос с теми же условиями:

```sql
SELECT COUNT(*)
FROM tasks
WHERE project_id = 1
  AND deleted_at IS NULL;
```

И сравню. Если число не совпало — подберу условие, при котором совпадёт: например, без `deleted_at IS NULL`. Это и будет описание бага: «счётчик учитывает удалённые задачи».

Дальше — проверка в динамике: создал задачу — счётчик +1, удалил — −1, сменил статус — не изменился. И если у API есть `total` в списке задач, сверю, что экран, `total` и база дают одно число. Три источника одного числа — частое место расхождений.
:::

::: details Кейс 6. Хитрый вопрос: «Почему у проекта без задач показывается 1?»
**Ситуация.** Интервьюер показывает запрос:

```sql
SELECT p.name, COUNT(*) AS tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.name;
```

«У нового проекта задач нет, а здесь 1. Почему? Как исправить?»

**Как рассуждать.** Сколько строк `LEFT JOIN` оставляет для проекта без пары? Что в этой строке в столбцах `tasks`? Что считает `COUNT(*)`?

**Пример ответа.** `LEFT JOIN` сохраняет каждый проект. Для проекта без задач он оставляет **одну** строку, где столбцы `tasks` — `NULL`. `COUNT(*)` считает строки — и насчитал одну.

Исправление — считать столбец правой таблицы, который у настоящей строки не бывает пустым: `COUNT(t.id)`. Он пропускает `NULL` — и даёт 0.

Ещё замечу в этом запросе: нет фильтра мягкого удаления. Если он нужен для задач, его место — в `ON`: `LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL`. В `WHERE` он выбросит проекты, у которых все задачи удалены, — и они пропадут из отчёта вместо того, чтобы показать 0.
:::

## Вопросы для собеседования

<InterviewTrainer topic="bd/agregaty" />

</template>
</LessonTabs>
