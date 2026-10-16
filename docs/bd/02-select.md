# SELECT: выбрать и отфильтровать

<LessonTabs>
<template #theory>

## Простыми словами

Открой каталог интернет-магазина. Слева фильтры: «только обувь», «цена от 3000 до 5000», «в наличии». Сверху — «сортировать: сначала дешёвые». Внизу — «показывать по 20». А в карточке товара видно не всё, что знает магазин, а только название, цену и фото.

`SELECT` — это те же фильтры, только для таблицы:

- **какие колонки показать** — `SELECT name, price`;
- **из какой таблицы** — `FROM products`;
- **какие строки оставить** — `WHERE category = 'Обувь' AND price BETWEEN 3000 AND 5000`;
- **в каком порядке** — `ORDER BY price`;
- **сколько показать** — `LIMIT 20`.

В уроке [«Что такое база данных»](/bd/01-chto-takoe-bd) ты уже писал `SELECT … FROM … WHERE … ORDER BY … LIMIT` с простым условием. Здесь — полноценный `SELECT`:

- в каком порядке база **выполняет** запрос и почему это важно;
- выражения, псевдонимы, кавычки, склейка строк и приведение типов;
- сложные условия: `AND`/`OR`/`NOT` и скобки, `IN`, `BETWEEN`, даты;
- поиск по части строки: `LIKE` и `ILIKE`, как найти сам символ `%`;
- **`NULL` — главная ловушка урока**: трёхзначная логика, `IS NULL`, `NOT IN` с `NULL`, `COALESCE`;
- сортировка по нескольким столбцам, `NULLS FIRST/LAST`, логический порядок через `CASE`;
- `LIMIT`/`OFFSET`, `DISTINCT` и `DISTINCT ON`;
- **как тестировщик использует `SELECT`** в работе.

Примеры в теории — на двух учебных таблицах интернет-магазина: `products` (товары) и `orders` (заказы). Скрипт, который их создаёт, — во вкладке «Задание»: можно выполнить его в онлайн-песочнице и повторять каждый пример. И на таблицах TaskFlow.

## Порядок написания и порядок выполнения

Пишем запрос мы в одном порядке, а база выполняет его в другом:

| Шаг | Часть | Что делает |
|---|---|---|
| 1 | `FROM` | Берёт таблицу |
| 2 | `WHERE` | Оставляет строки, где условие верно |
| 3 | `SELECT` | Вычисляет столбцы и выражения, даёт им имена |
| 4 | `ORDER BY` | Сортирует то, что осталось |
| 5 | `LIMIT` / `OFFSET` | Отрезает нужное число строк |

<figure class="sql-order">
<svg viewBox="0 0 440 444" role="img" aria-label="Слева — порядок, в котором пишем запрос: SELECT, FROM, WHERE, ORDER BY, LIMIT. Справа — порядок, в котором его выполняет база: 1 FROM, 2 WHERE, 3 SELECT, 4 ORDER BY, 5 LIMIT. Стрелка от SELECT идёт на третье место. Псевдоним из SELECT появляется на шаге 3, поэтому в WHERE на шаге 2 его ещё нет, а в ORDER BY на шаге 4 он уже есть">
  <rect x="0" y="0" width="440" height="444" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="20" y="30" font-size="15" font-weight="700" fill="#1f2937">Пишем в одном порядке, база выполняет в другом</text>
  <text x="71" y="64" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">Как пишем</text>
  <text x="302" y="64" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">Как выполняет база</text>
  <rect x="16" y="80" width="110" height="36" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
  <text x="71" y="103" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">SELECT</text>
  <rect x="16" y="128" width="110" height="36" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="71" y="151" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">FROM</text>
  <rect x="16" y="176" width="110" height="36" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="71" y="199" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">WHERE</text>
  <rect x="16" y="224" width="110" height="36" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="71" y="247" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">ORDER BY</text>
  <rect x="16" y="272" width="110" height="36" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="71" y="295" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">LIMIT</text>
  <rect x="180" y="80" width="244" height="36" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
  <text x="192" y="103" font-size="14" font-weight="700" fill="#374151">1</text>
  <text x="210" y="103" font-size="14" font-weight="700" fill="#1f2937">FROM</text>
  <text x="298" y="103" font-size="14" fill="#374151">откуда брать</text>
  <rect x="180" y="128" width="244" height="36" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
  <text x="192" y="151" font-size="14" font-weight="700" fill="#374151">2</text>
  <text x="210" y="151" font-size="14" font-weight="700" fill="#1f2937">WHERE</text>
  <text x="298" y="151" font-size="14" fill="#374151">какие строки</text>
  <rect x="180" y="176" width="244" height="36" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
  <text x="192" y="199" font-size="14" font-weight="700" fill="#374151">3</text>
  <text x="210" y="199" font-size="14" font-weight="700" fill="#1f2937">SELECT</text>
  <text x="298" y="199" font-size="14" fill="#374151">какие столбцы</text>
  <rect x="180" y="224" width="244" height="36" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
  <text x="192" y="247" font-size="14" font-weight="700" fill="#374151">4</text>
  <text x="210" y="247" font-size="14" font-weight="700" fill="#1f2937">ORDER BY</text>
  <text x="298" y="247" font-size="14" fill="#374151">в каком порядке</text>
  <rect x="180" y="272" width="244" height="36" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
  <text x="192" y="295" font-size="14" font-weight="700" fill="#374151">5</text>
  <text x="210" y="295" font-size="14" font-weight="700" fill="#1f2937">LIMIT</text>
  <text x="298" y="295" font-size="14" fill="#374151">сколько строк</text>
  <line x1="126" y1="98.0" x2="172" y2="194.0" stroke="#d97706" stroke-width="2.5"/>
  <polygon points="172.0,194.0 172.2,185.1 164.9,188.5" fill="#d97706"/>
  <line x1="126" y1="146.0" x2="172" y2="98.0" stroke="#64748b" stroke-width="1.5"/>
  <polygon points="172.0,98.0 163.6,101.0 169.4,106.5" fill="#64748b"/>
  <line x1="126" y1="194.0" x2="172" y2="146.0" stroke="#64748b" stroke-width="1.5"/>
  <polygon points="172.0,146.0 163.6,149.0 169.4,154.5" fill="#64748b"/>
  <line x1="126" y1="242.0" x2="172" y2="242.0" stroke="#64748b" stroke-width="1.5"/>
  <polygon points="172.0,242.0 164.0,238.0 164.0,246.0" fill="#64748b"/>
  <line x1="126" y1="290.0" x2="172" y2="290.0" stroke="#64748b" stroke-width="1.5"/>
  <polygon points="172.0,290.0 164.0,286.0 164.0,294.0" fill="#64748b"/>
  <line x1="14" y1="326" x2="426" y2="326" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="6 4"/>
  <text x="20" y="352" font-size="14" fill="#1f2937">SELECT price * stock AS total — псевдоним</text>
  <text x="20" y="372" font-size="14" fill="#1f2937">появляется только на шаге 3.</text>
  <text x="20" y="400" font-size="15" font-weight="700" fill="#991b1b">✗</text>
  <text x="40" y="400" font-size="14" fill="#1f2937">WHERE total &gt; 1000 — шаг 2, total ещё нет</text>
  <text x="20" y="426" font-size="15" font-weight="700" fill="#15803d">✓</text>
  <text x="40" y="426" font-size="14" fill="#1f2937">ORDER BY total — шаг 4, total уже есть</text>
</svg>
<figcaption>Запрос пишут, начиная с SELECT, а база начинает с FROM. Поэтому псевдоним из SELECT виден в ORDER BY, но не в WHERE.</figcaption>
</figure>

Из этого порядка следуют правила, которые иначе пришлось бы зубрить.

**Псевдоним из `SELECT` нельзя использовать в `WHERE`.** На шаге 2 его ещё нет:

```sql
-- ошибка: column "stock_value" does not exist
SELECT name, price * stock AS stock_value
FROM products
WHERE stock_value > 50000;

-- так работает: выражение повторяем целиком
SELECT name, price * stock AS stock_value
FROM products
WHERE price * stock > 50000;
```

**А в `ORDER BY` — можно.** Шаг 4 идёт после шага 3, имя уже есть:

```sql
SELECT name, price * stock AS stock_value
FROM products
ORDER BY stock_value DESC
LIMIT 3;
```

**`LIMIT` срабатывает последним.** Сначала база сортирует все подходящие строки, потом берёт первые три. Поэтому `ORDER BY … LIMIT 3` — это «три самых», а `LIMIT 3` без сортировки — «какие-то три».

::: tip Где тут GROUP BY и HAVING
Между `WHERE` и `SELECT` есть ещё два шага — группировка `GROUP BY` и фильтр групп `HAVING`. Они появятся в уроке про агрегаты и группировку. Порядок от этого не ломается: `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT`.
:::

## SELECT: какие столбцы показать

### Столбцы, звёздочка, выражения

```sql
SELECT * FROM products LIMIT 5;              -- все столбцы — для разведки
SELECT name, price FROM products;            -- только нужные
SELECT name, price, stock, price * stock     -- выражение: стоимость остатка
FROM products;
```

В `SELECT` можно писать не только столбцы, но и **выражения**: арифметику, функции, константы. Выражение вычисляется для каждой строки отдельно.

| Выражение | Что получится |
|---|---|
| `price * stock` | Стоимость остатка на складе |
| `price * 0.9` | Цена со скидкой 10 % |
| `length(name)` | Длина названия в символах |
| `upper(category)`, `lower(category)` | Строка большими или маленькими буквами |
| `now()` | Текущий момент — одинаковый для всех строк запроса |

Деление целых чисел — **целочисленное**: `7 / 2` даст `3`, а не `3.5`. Если нужно дробное — `7 / 2.0` или приведение типа (ниже). На этом ломаются проценты и средние в отчётах.

### Псевдонимы и кавычки

**Псевдоним** — имя столбца в результате. Пишется через `AS`:

```sql
SELECT name AS product,
       price * stock AS stock_value,
       price AS "Цена, ₽"
FROM products;
```

`AS` можно не писать — `price * stock stock_value` тоже сработает, — но с `AS` запрос читается легче.

Кавычки в PostgreSQL — частый источник ошибок у новичков:

| Кавычки | Что значат | Пример |
|---|---|---|
| Одинарные `'…'` | **Строка** — значение | `WHERE category = 'Обувь'` |
| Двойные `"…"` | **Имя** — столбца, таблицы, псевдонима | `AS "Цена, ₽"` |
| Без кавычек | Имя, приведённое к нижнему регистру | `AS Total` превратится в `total` |

Классическая ошибка — `WHERE status = "DONE"`. PostgreSQL ответит `column "DONE" does not exist`: в двойных кавычках он ищет столбец с именем `DONE`, а не строку.

Двойные кавычки нужны, когда в имени пробел, запятая, большие буквы или русские буквы — как в `"Цена, ₽"`. В отчётах это удобно. В обычной работе имена пишут латиницей маленькими буквами — и без кавычек.

Если внутри строки нужна одинарная кавычка — её удваивают: `'Магазин ''Ромашка'''` — это строка `Магазин 'Ромашка'`.

### Склейка строк и приведение типов

`||` склеивает строки:

```sql
SELECT name || ' (' || category || ')' AS title
FROM products;
-- Футболка базовая белая (Одежда)
```

Если в склейке хоть одна часть `NULL` — весь результат `NULL`. Про `NULL` подробно ниже.

`::` превращает значение в другой тип:

```sql
SELECT price::integer          AS rub,        -- 990.00 → 990
       created_at::date        AS day,        -- момент → только дата
       '2026-10-01'::date      AS start_day,  -- строка → дата
       stock::numeric / 4      AS per_week    -- дробное деление
FROM products;
```

`::` — запись PostgreSQL. В стандарте SQL то же самое пишут как `CAST(price AS integer)` — так работает в любой СУБД.

## WHERE: какие строки оставить

### Сравнение

| Оператор | Значит | Пример |
|---|---|---|
| `=` | Равно | `category = 'Обувь'` |
| `<>` или `!=` | Не равно — в PostgreSQL оба одинаковы | `status <> 'CANCELLED'` |
| `<`, `>`, `<=`, `>=` | Меньше, больше, не больше, не меньше | `price >= 1000` |

Сравнивать можно числа, строки и даты. Строки сравниваются **с учётом регистра**: `'Одежда' = 'одежда'` — ложь. Если в данных встречаются оба написания, `WHERE category = 'Одежда'` найдёт только одно. В учебной таблице `products` такая строка есть — найдёшь её в задачах.

Логический столбец можно не сравнивать с `true`: `WHERE discontinued` то же, что `WHERE discontinued = true`, а `WHERE NOT discontinued` — то же, что `= false`.

### AND, OR, NOT и скобки

- `AND` — должны выполниться **оба** условия;
- `OR` — хотя бы **одно**;
- `NOT` — наоборот.

Главная ловушка: **`AND` выполняется раньше `OR`**, как умножение раньше сложения. Задача — «обувь и электроника дешевле 1000 ₽»:

```sql
-- неправильно: вся обувь + дешёвая электроника
SELECT name, category, price
FROM products
WHERE category = 'Обувь' OR category = 'Электроника' AND price < 1000;
```

База читает это как `category = 'Обувь' OR (category = 'Электроника' AND price < 1000)`. В учебной таблице — 5 строк, из них три пары обуви дороже 4000 ₽.

```sql
-- правильно: скобки говорят, что сначала OR
SELECT name, category, price
FROM products
WHERE (category = 'Обувь' OR category = 'Электроника') AND price < 1000;
```

Теперь 2 строки — два кабеля. Правило на всю жизнь: **если в условии есть и `AND`, и `OR` — ставь скобки**, даже если помнишь приоритет. Через месяц коллега прочитает запрос и не будет гадать.

`NOT` выполняется раньше `AND`. `NOT a AND b` — это `(NOT a) AND b`, а не `NOT (a AND b)`.

### IN и NOT IN

`IN` — короткая запись для нескольких `OR` по одному столбцу:

```sql
WHERE category IN ('Обувь', 'Электроника')
-- то же, что
WHERE category = 'Обувь' OR category = 'Электроника'
```

`NOT IN` — «ни одно из»: `WHERE status NOT IN ('CANCELLED', 'DELIVERED')`. У него есть опасная ловушка с `NULL` — она в разделе про `NULL`.

### BETWEEN — границы включительно

```sql
SELECT name, price FROM products WHERE price BETWEEN 590 AND 990;
-- то же, что price >= 590 AND price <= 990
```

**Обе границы входят.** Товары ровно за 590 и ровно за 990 ₽ попадут в результат. Это те же граничные значения, что в уроке [«Техники тест-дизайна»](/osnovy/08-tehniki-test-dizayna): если требование «от 590 до 990 включительно», `BETWEEN` подходит. Если «до 990, не включая» — нужно `price >= 590 AND price < 990`.

Порядок границ важен: `BETWEEN 990 AND 590` не найдёт ничего — меньшая граница должна быть первой.

`NOT BETWEEN 500 AND 5000` — всё, что дешевле 500 или дороже 5000. Сами 500 и 5000 сюда не попадут.

### Даты и время

Столбцы `timestamptz` (`timestamp with time zone`) сравниваются как числа: раньше — меньше.

```sql
-- заказы с 1 октября 2026
WHERE created_at >= '2026-10-01'

-- за последние 7 суток — ровно 7 × 24 часа назад от этого момента
WHERE created_at >= now() - interval '7 days'

-- за сегодня — с полуночи текущего дня
WHERE created_at >= current_date

-- за вчера — от вчерашней полуночи до сегодняшней
WHERE created_at >= current_date - 1 AND created_at < current_date

-- за прошлый календарный месяц
WHERE created_at >= date_trunc('month', now()) - interval '1 month'
  AND created_at <  date_trunc('month', now())
```

`interval '7 days'` — промежуток времени: `'2 hours'`, `'1 month'`, `'30 minutes'`. `date_trunc('month', …)` обрезает момент до начала месяца.

**Мидл: ловушка `BETWEEN` с датами.** Нужны заказы за октябрь:

```sql
-- неправильно: теряются заказы 31 октября
WHERE created_at BETWEEN '2026-10-01' AND '2026-10-31'
```

`'2026-10-31'` для столбца с временем — это `2026-10-31 00:00:00`. Заказ 31 октября в 09:20 больше этого значения и в выборку не попадёт. Весь последний день теряется, кроме самой полуночи. В учебной таблице `orders` так пропадают 2 заказа из 14.

```sql
-- правильно: полуоткрытый интервал — начало включаем, конец нет
WHERE created_at >= '2026-10-01' AND created_at < '2026-11-01'
```

Такая запись не зависит от того, хранятся ли в столбце секунды и миллисекунды, и не захватывает полночь следующего месяца. Это стандартная привычка для периодов.

**Мидл: «сегодня» — в каком поясе?** `current_date` и строка `'2026-10-01'` считаются в часовом поясе **сессии** — того подключения, из которого ты выполняешь запрос. DBeaver обычно ставит пояс твоего компьютера, сервер приложения — чаще UTC. Один и тот же запрос «за сегодня» у тебя и в отчёте сервера может дать разные строки: заказ в 01:30 по Москве — это 22:30 предыдущего дня по UTC. Проверить пояс сессии — `SHOW timezone;`. Разбор про пояса — в уроке [«Что такое база данных»](/bd/01-chto-takoe-bd).

## LIKE и ILIKE: поиск по части строки

### Шаблоны `%` и `_`

`LIKE` сравнивает строку с **шаблоном**. В шаблоне два особых символа:

| Символ | Значит | Пример | Найдёт |
|---|---|---|---|
| `%` | Любое число любых символов, в том числе ноль | `'Кабель%'` | «Кабель USB-C 2 м», «Кабель» |
| `_` | Ровно один любой символ | `'Худи _'` | «Худи S», «Худи M», но не «Худи XL» |

```sql
WHERE name LIKE 'Чай%'        -- начинается с «Чай»
WHERE name LIKE '%см'         -- заканчивается на «см»
WHERE name LIKE '%USB%'       -- содержит «USB» где угодно
```

Без `%` и `_` `LIKE` работает как `=`: `name LIKE 'Чай'` найдёт только строку ровно «Чай».

`NOT LIKE` — строки, которые под шаблон **не** подходят.

### Регистр: LIKE и ILIKE

`LIKE` учитывает регистр: `'%sony%'` не найдёт «Наушники SONY» и «Колонка Sony». Для поиска без учёта регистра в PostgreSQL есть **`ILIKE`**:

```sql
SELECT name FROM products WHERE name ILIKE '%sony%';
-- Наушники SONY WH-1000, Колонка Sony mini, пульт sony для ТВ
```

`ILIKE` — особенность PostgreSQL. В других СУБД пишут `lower(name) LIKE '%sony%'` — это работает везде.

### Как найти сам символ `%` или `_`

Ищем купон «50%»:

```sql
-- неправильно: второй % — тоже шаблон, это «содержит 50»
WHERE name LIKE '%50%%'
-- найдёт: Купон 50% на доставку, Плед 150×200, Полка настенная 50 см
```

Чтобы символ значил сам себя, его **экранируют** — ставят перед ним обратный слэш:

```sql
WHERE name LIKE '%50\%%'       -- только «Купон 50% на доставку»
WHERE name LIKE '%USB\_C%'     -- только «Кабель USB_C», без «USB-C»
```

Можно назначить свой символ экранирования — удобно, если в данных много обратных слэшей:

```sql
WHERE name LIKE '%50!%%' ESCAPE '!'
```

Это ровно тот баг поиска, что в уроке [«Тест-дизайн для API»](/api/09-test-dizayn-api): если сервер подставляет ввод пользователя в `LIKE` без экранирования, поиск по `%` вернёт всё, а по `_` — лишнее. Теперь ты видишь, как это выглядит изнутри.

### «Ё» и «е» — разные буквы

Для базы `ё` и `е` — разные символы, как `a` и `b`. Поиск «зеленый» не найдёт «Зелёный», и наоборот:

```sql
WHERE name ILIKE '%зелен%'                            -- только «Зеленый с мятой»
WHERE name ILIKE '%зелен%' OR name ILIKE '%зелён%'    -- оба чая
```

Если пользователи ищут «ежик», а в каталоге «Ёжик», — это вопрос к требованиям поиска. Тестировщик проверяет оба написания и в данных, и в поисковом запросе.

::: tip ILIKE и русские буквы
`ILIKE` и `lower()` переводят русские буквы в нижний регистр, если база создана с обычной локалью вроде `ru_RU.UTF-8` или `en_US.UTF-8`. На базе с локалью `C` регистр меняется только у латиницы. Если в песочнице `ILIKE` по кириллице не находит очевидное — дело в настройках песочницы, а не в запросе.
:::

## NULL: главная ловушка SELECT

В уроке [«Что такое база данных»](/bd/01-chto-takoe-bd) мы договорились: `NULL` — это «значения нет или оно неизвестно». Не ноль, не пустая строка. Теперь — почему из-за него запросы врут.

### Трёхзначная логика

В SQL условие бывает не только **истинным** (TRUE) или **ложным** (FALSE), но и **неизвестным** — UNKNOWN. Любое сравнение с `NULL` даёт UNKNOWN:

- `5 = NULL` — неизвестно: мы не знаем, что там;
- `NULL = NULL` — тоже неизвестно: два неизвестных не обязательно равны;
- `5 <> NULL` — неизвестно.

<figure class="null-logic">
<svg viewBox="0 0 440 372" role="img" aria-label="Таблицы истинности трёхзначной логики. AND: TRUE и UNKNOWN дают UNKNOWN, FALSE и UNKNOWN дают FALSE, UNKNOWN и UNKNOWN дают UNKNOWN. OR: TRUE и UNKNOWN дают TRUE, FALSE и UNKNOWN дают UNKNOWN, UNKNOWN и UNKNOWN дают UNKNOWN. Любое сравнение с NULL даёт UNKNOWN, NOT UNKNOWN — тоже UNKNOWN. WHERE пропускает только строки, где условие TRUE">
  <rect x="0" y="0" width="440" height="372" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <text x="20" y="30" font-size="15" font-weight="700" fill="#1f2937">Трёхзначная логика: TRUE, FALSE, UNKNOWN</text>
  <rect x="20" y="52" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="43.0" y="74" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">AND</text>
  <rect x="66" y="52" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="89.0" y="74" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">T</text>
  <rect x="20" y="86" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="43.0" y="108" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">T</text>
  <rect x="112" y="52" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="135.0" y="74" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">F</text>
  <rect x="20" y="120" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="43.0" y="142" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">F</text>
  <rect x="158" y="52" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="181.0" y="74" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">U</text>
  <rect x="20" y="154" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="43.0" y="176" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">U</text>
  <rect x="66" y="86" width="46" height="34" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="89.0" y="108" font-size="14" font-weight="700" fill="#14532d" text-anchor="middle">T</text>
  <rect x="112" y="86" width="46" height="34" fill="#fee2e2" stroke="#94a3b8" stroke-width="1"/>
  <text x="135.0" y="108" font-size="14" font-weight="700" fill="#7f1d1d" text-anchor="middle">F</text>
  <rect x="158" y="86" width="46" height="34" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="181.0" y="108" font-size="14" font-weight="700" fill="#78350f" text-anchor="middle">U</text>
  <rect x="66" y="120" width="46" height="34" fill="#fee2e2" stroke="#94a3b8" stroke-width="1"/>
  <text x="89.0" y="142" font-size="14" font-weight="700" fill="#7f1d1d" text-anchor="middle">F</text>
  <rect x="112" y="120" width="46" height="34" fill="#fee2e2" stroke="#94a3b8" stroke-width="1"/>
  <text x="135.0" y="142" font-size="14" font-weight="700" fill="#7f1d1d" text-anchor="middle">F</text>
  <rect x="158" y="120" width="46" height="34" fill="#fee2e2" stroke="#94a3b8" stroke-width="1"/>
  <text x="181.0" y="142" font-size="14" font-weight="700" fill="#7f1d1d" text-anchor="middle">F</text>
  <rect x="66" y="154" width="46" height="34" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="89.0" y="176" font-size="14" font-weight="700" fill="#78350f" text-anchor="middle">U</text>
  <rect x="112" y="154" width="46" height="34" fill="#fee2e2" stroke="#94a3b8" stroke-width="1"/>
  <text x="135.0" y="176" font-size="14" font-weight="700" fill="#7f1d1d" text-anchor="middle">F</text>
  <rect x="158" y="154" width="46" height="34" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="181.0" y="176" font-size="14" font-weight="700" fill="#78350f" text-anchor="middle">U</text>
  <rect x="236" y="52" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="259.0" y="74" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">OR</text>
  <rect x="282" y="52" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="305.0" y="74" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">T</text>
  <rect x="236" y="86" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="259.0" y="108" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">T</text>
  <rect x="328" y="52" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="351.0" y="74" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">F</text>
  <rect x="236" y="120" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="259.0" y="142" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">F</text>
  <rect x="374" y="52" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="397.0" y="74" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">U</text>
  <rect x="236" y="154" width="46" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="259.0" y="176" font-size="14" font-weight="700" fill="#1f2937" text-anchor="middle">U</text>
  <rect x="282" y="86" width="46" height="34" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="305.0" y="108" font-size="14" font-weight="700" fill="#14532d" text-anchor="middle">T</text>
  <rect x="328" y="86" width="46" height="34" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="351.0" y="108" font-size="14" font-weight="700" fill="#14532d" text-anchor="middle">T</text>
  <rect x="374" y="86" width="46" height="34" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="397.0" y="108" font-size="14" font-weight="700" fill="#14532d" text-anchor="middle">T</text>
  <rect x="282" y="120" width="46" height="34" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="305.0" y="142" font-size="14" font-weight="700" fill="#14532d" text-anchor="middle">T</text>
  <rect x="328" y="120" width="46" height="34" fill="#fee2e2" stroke="#94a3b8" stroke-width="1"/>
  <text x="351.0" y="142" font-size="14" font-weight="700" fill="#7f1d1d" text-anchor="middle">F</text>
  <rect x="374" y="120" width="46" height="34" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="397.0" y="142" font-size="14" font-weight="700" fill="#78350f" text-anchor="middle">U</text>
  <rect x="282" y="154" width="46" height="34" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="305.0" y="176" font-size="14" font-weight="700" fill="#14532d" text-anchor="middle">T</text>
  <rect x="328" y="154" width="46" height="34" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="351.0" y="176" font-size="14" font-weight="700" fill="#78350f" text-anchor="middle">U</text>
  <rect x="374" y="154" width="46" height="34" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="397.0" y="176" font-size="14" font-weight="700" fill="#78350f" text-anchor="middle">U</text>
  <rect x="20" y="203" width="22" height="20" fill="#dcfce7" stroke="#94a3b8" stroke-width="1"/>
  <text x="31" y="218" font-size="14" font-weight="700" fill="#14532d" text-anchor="middle">T</text>
  <text x="50" y="218" font-size="14" fill="#1f2937">да</text>
  <rect x="84" y="203" width="22" height="20" fill="#fee2e2" stroke="#94a3b8" stroke-width="1"/>
  <text x="95" y="218" font-size="14" font-weight="700" fill="#7f1d1d" text-anchor="middle">F</text>
  <text x="114" y="218" font-size="14" fill="#1f2937">нет</text>
  <rect x="156" y="203" width="22" height="20" fill="#fef3c7" stroke="#94a3b8" stroke-width="1"/>
  <text x="167" y="218" font-size="14" font-weight="700" fill="#78350f" text-anchor="middle">U</text>
  <text x="186" y="218" font-size="14" fill="#1f2937">неизвестно</text>
  <text x="20" y="252" font-size="14" fill="#1f2937">NULL = NULL  →  U</text>
  <text x="236" y="252" font-size="14" fill="#1f2937">5 &lt;&gt; NULL  →  U</text>
  <text x="20" y="276" font-size="14" fill="#1f2937">NOT U  →  U</text>
  <text x="236" y="276" font-size="14" fill="#1f2937">NULL IS NULL  →  T</text>
  <rect x="20" y="298" width="400" height="58" rx="8" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/>
  <text x="220" y="322" font-size="15" font-weight="700" fill="#4c1d95" text-anchor="middle">WHERE пропускает только TRUE.</text>
  <text x="220" y="344" font-size="14" fill="#1f2937" text-anchor="middle">Строки с FALSE и UNKNOWN отбрасываются</text>
</svg>
<figcaption>Сравнение с NULL даёт UNKNOWN. WHERE оставляет только строки с TRUE — строки с UNKNOWN теряются так же, как с FALSE.</figcaption>
</figure>

Как читать таблицы: `FALSE AND что угодно` — `FALSE`, ведь одного «нет» хватает. `TRUE OR что угодно` — `TRUE`. Во всех остальных случаях с UNKNOWN результат — UNKNOWN.

И главное правило: **`WHERE` оставляет только строки, где условие TRUE.** FALSE и UNKNOWN отбрасываются одинаково. Отсюда все ловушки ниже.

### IS NULL вместо = NULL

```sql
-- всегда пусто: phone = NULL — UNKNOWN для каждой строки
SELECT customer FROM orders WHERE phone = NULL;

-- правильно
SELECT customer FROM orders WHERE phone IS NULL;
SELECT customer FROM orders WHERE phone IS NOT NULL;
```

`IS NULL` и `IS NOT NULL` — единственные проверки, которые на `NULL` отвечают TRUE или FALSE, а не UNKNOWN. Запрос с `= NULL` не падает с ошибкой — он молча возвращает пусто. Это хуже ошибки: кажется, что таких строк нет.

### `<>` и NOT IN теряют строки с NULL

**`<>` не находит `NULL`.** Нужны «все заказы, кроме отменённых»:

```sql
SELECT external_no, status FROM orders WHERE status <> 'CANCELLED';
```

В учебной таблице 16 заказов, 3 отменены. Ожидаешь 13 — получаешь 11. У двух заказов `status` — `NULL`: `NULL <> 'CANCELLED'` — UNKNOWN, и `WHERE` их выбросил. Если «не отменённые» по смыслу включают заказы без статуса — нужно сказать это явно:

```sql
WHERE status <> 'CANCELLED' OR status IS NULL
```

**`NOT IN` со списком, где есть `NULL`, возвращает пусто.** Классика собеседований:

```sql
SELECT external_no FROM orders WHERE status NOT IN ('CANCELLED', NULL);
-- 0 строк
```

`NOT IN ('CANCELLED', NULL)` — это `status <> 'CANCELLED' AND status <> NULL`. Вторая часть для любой строки — UNKNOWN. `TRUE AND UNKNOWN` — UNKNOWN, `FALSE AND UNKNOWN` — FALSE. TRUE не получается ни для одной строки — результат пустой.

Руками `NULL` в список никто не пишет. Но список часто берут из другого запроса — **подзапроса**: «клиенты, которых нет в списке отписавшихся». Если в том списке есть хоть один `NULL`, основной запрос вернёт пусто.

А вот `IN` с `NULL` в списке работает как ожидаешь: `status IN ('NEW', NULL)` найдёт новые заказы. Просто `NULL` в нём ничего не находит — строки со `status IS NULL` не попадут.

### COALESCE — подставить значение вместо NULL

`COALESCE(a, b, c)` возвращает первое значение, которое не `NULL`:

```sql
SELECT name, COALESCE(description, '(нет описания)') AS description
FROM products;
```

Полезно в отчётах — вместо пустой ячейки понятная надпись. И в склейке строк: `first_name || ' ' || COALESCE(middle_name, '')` не превратится в `NULL` из-за отсутствующего отчества.

`COALESCE` не трогает пустую строку `''` — это не `NULL`. Товары с `description = ''` останутся пустыми.

### Мидл: IS DISTINCT FROM

`a IS DISTINCT FROM b` — «a отличается от b», но `NULL` считается обычным значением:

| Выражение | `<>` | `IS DISTINCT FROM` |
|---|---|---|
| `'NEW'` и `'CANCELLED'` | TRUE | TRUE |
| `'CANCELLED'` и `'CANCELLED'` | FALSE | FALSE |
| `NULL` и `'CANCELLED'` | UNKNOWN | **TRUE** |
| `NULL` и `NULL` | UNKNOWN | **FALSE** |

```sql
-- все заказы, кроме отменённых, включая заказы без статуса — 13 строк
SELECT external_no, status FROM orders WHERE status IS DISTINCT FROM 'CANCELLED';
```

Пара — `IS NOT DISTINCT FROM`: «равно, и `NULL` равен `NULL`». Пригодится, когда сравниваешь два столбца, в которых может быть `NULL`: «изменилось ли значение после `PATCH`?»

### NULL и пустая строка

| | `NULL` | `''` |
|---|---|---|
| Что значит | Значения нет | Значение есть, оно пустое |
| `= ''` | UNKNOWN — не найдётся | TRUE |
| `IS NULL` | TRUE | FALSE — не найдётся |
| `length(…)` | `NULL` | `0` |
| `COALESCE(…, 'x')` | `'x'` | `''` |

Чтобы найти «описания нет» в обоих смыслах:

```sql
SELECT name, description
FROM products
WHERE description IS NULL OR description = '';
```

Для тестировщика это сигнал: в одном столбце живут оба варианта. Значит, разные пути записи пишут по-разному — один `NULL`, другой `''`. Фильтр, отчёт или проверка «заполнено ли» обработает их по-разному. Это повод спросить, как должно быть, и проверить оба варианта через API.

## ORDER BY: в каком порядке

### Несколько столбцов и направление

```sql
SELECT name, category, price
FROM products
ORDER BY category, price DESC, id;
```

Сначала по категории, внутри категории — от дорогих к дешёвым, при одинаковой цене — по `id`. `ASC` (по возрастанию) — по умолчанию, `DESC` — по убыванию. Направление пишется **для каждого столбца отдельно**: в `ORDER BY category, price DESC` по убыванию только `price`.

Сортировать можно по выражению и по псевдониму: `ORDER BY price * stock DESC`, `ORDER BY stock_value DESC`.

### Где окажутся NULL

В PostgreSQL `NULL` при сортировке считается **больше любого значения**:

- `ORDER BY description` — `NULL` в конце;
- `ORDER BY description DESC` — `NULL` в начале.

Поменять можно явно: `ORDER BY description NULLS FIRST` или `ORDER BY created_at DESC NULLS LAST`.

В MySQL и MS SQL Server наоборот — `NULL` считается меньше всего. Один и тот же запрос «новые сверху» в разных СУБД покажет строки без даты в разных местах. Если API сортирует по полю, которое бывает `NULL`, это отдельная проверка: где оказываются такие записи и что об этом сказано в требованиях.

### Логический порядок через CASE

Размеры одежды по алфавиту:

```sql
SELECT name, size FROM products WHERE category = 'Одежда' ORDER BY size;
-- L, L, M, M, M, S, XL, XS
```

Алфавит не знает, что `XS` меньше `S`. Нужен **логический** порядок — его задают через `CASE`, превращая значение в номер:

```sql
SELECT name, size
FROM products
WHERE category = 'Одежда'
ORDER BY CASE size
             WHEN 'XS' THEN 1
             WHEN 'S'  THEN 2
             WHEN 'M'  THEN 3
             WHEN 'L'  THEN 4
             WHEN 'XL' THEN 5
         END,
         id;
-- XS, S, M, M, M, L, L, XL
```

Так же сортируют статусы заказа по этапам жизни — «новый → оплачен → отправлен → доставлен», а не по алфавиту. Значение, которого нет в `CASE`, получит `NULL` и уйдёт в конец списка.

### Строки и числа: «10» меньше «9»

Строки сравниваются **посимвольно**, как слова в словаре. `'10'` начинается с `'1'`, а `'1'` меньше `'9'` — значит, `'10' < '9'`.

```sql
SELECT external_no FROM orders ORDER BY external_no;
-- 10, 100, 101, 102, 105, 11, 110, 12, 14, 20, 21, 5, 7, 8, 9, 99

SELECT external_no FROM orders ORDER BY external_no::integer;
-- 5, 7, 8, 9, 10, 11, 12, 14, 20, 21, 99, 100, 101, 102, 105, 110
```

Если номера, суммы или размеры обуви хранятся в строковом столбце, сортировка «по возрастанию» выглядит сломанной. В интерфейсе это баг, даже если «база так сортирует».

### Без ORDER BY порядок не гарантирован

Без `ORDER BY` база отдаёт строки в том порядке, в котором ей удобно. Часто он совпадает с порядком вставки — и это создаёт иллюзию, что «так и будет». После обновления строк, очистки таблицы или смены плана запроса порядок меняется.

Отсюда два правила:

- **если порядок важен — `ORDER BY` обязателен**;
- **сортировка должна быть однозначной.** `ORDER BY created_at` при одинаковом времени у нескольких строк — порядок между ними не определён. Добавь второй столбец, уникальный: `ORDER BY created_at DESC, id DESC`.

## LIMIT и OFFSET: сколько строк

```sql
SELECT id, name, price
FROM products
ORDER BY price, id
LIMIT 5 OFFSET 5;    -- вторая страница по 5 строк
```

- `LIMIT 5` — не больше 5 строк;
- `OFFSET 5` — сначала пропустить 5;
- `FETCH FIRST 5 ROWS ONLY` — то же, что `LIMIT 5`, но по стандарту SQL. Встретишь в Oracle и MS SQL Server.

Это та же **offset-пагинация**, что в API из урока [«Тест-дизайн для API»](/api/09-test-dizayn-api): `?limit=5&offset=5` сервер часто превращает именно в `LIMIT 5 OFFSET 5`. И проблемы те же:

- **без `ORDER BY` страницы «плавают»** — одна строка может попасть на две страницы, другая не попасть ни на одну;
- **без уникального столбца в сортировке** то же самое случается на строках с одинаковым значением: десять товаров по 990 ₽ разложатся по страницам как попало;
- **большой `OFFSET` медленный**: чтобы отдать строки с 100 000-й, база всё равно перебирает первые 100 000.

## DISTINCT: убрать повторы

`DISTINCT` убирает одинаковые строки результата:

```sql
SELECT DISTINCT category FROM products;          -- какие категории бывают
SELECT DISTINCT category, size FROM products;    -- уникальные пары
```

`DISTINCT` относится ко **всей строке**, а не к первому столбцу. `SELECT DISTINCT category, size` уберёт только полностью одинаковые пары.

`NULL` для `DISTINCT` — обычное значение: все `NULL` схлопнутся в одну строку.

**Когда нужен.** Узнать, какие значения встречаются в столбце: статусы, категории, роли. Это первая разведка незнакомой таблицы — так ты, например, найдёшь категорию `одежда` с маленькой буквы рядом с `Одежда`.

**Когда прячет проблему.** Запрос вернул дубли — и рука тянется написать `DISTINCT`. Но дубли — **симптом**: в данных лишние строки или запрос соединяет таблицы неправильно. `DISTINCT` убирает симптом из твоего отчёта, а причина остаётся — и в приложении пользователь видит тот же товар дважды. Сначала разберись, откуда дубли. Как они возникают при соединении таблиц — в [уроке про JOIN](/bd/03-join).

### Мидл: DISTINCT ON

`DISTINCT ON (столбец)` — особенность PostgreSQL: «одна строка на каждое значение столбца, первая по сортировке».

```sql
-- самый дешёвый товар в каждой категории
SELECT DISTINCT ON (category) category, name, price
FROM products
ORDER BY category, price, id;
```

Правило: столбцы из `DISTINCT ON` должны стоять **первыми** в `ORDER BY`. Дальше — порядок, который решает, какая строка «первая». Без полного `ORDER BY` база выберет любую строку группы — и результат будет меняться.

Типичные задачи тестировщика: последний комментарий к каждой задаче, последняя запись журнала по каждому объекту, последний заказ каждого клиента.

## CASE: вычисляемая колонка

`CASE` — «если … то … иначе» прямо в запросе:

```sql
SELECT name, stock,
       CASE
           WHEN stock = 0 THEN 'нет в наличии'
           WHEN stock < 5 THEN 'мало'
           ELSE 'есть'
       END AS availability
FROM products;
```

Условия проверяются **сверху вниз**, срабатывает первое верное. Если ни одно не сработало и нет `ELSE` — результат `NULL`.

Есть короткая форма для сравнения одного столбца со значениями — её ты видел в сортировке размеров: `CASE size WHEN 'XS' THEN 1 WHEN 'S' THEN 2 … END`.

`CASE` ещё встретится в уроке про агрегаты и группировку: там он работает вместе с подсчётами.

## Как тестировщик использует SELECT

Мидл пишет `SELECT` не ради отчётов, а ради проверок. Пять типичных задач — на таблицах TaskFlow.

**1. Проверить запись после API.** API вернул `201` и `"id": 15`. Смотрим, что легло в базу, по `id` из ответа:

```sql
SELECT id, name, description, status, owner_id, created_at, deleted_at
FROM projects
WHERE id = 15;
```

Сравниваем с телом запроса и с ответом: название то же, `owner_id` — тот, кто создавал, `status` по умолчанию, `deleted_at` пустой. Поиск по `id` надёжнее поиска по названию: названия повторяются.

**2. Найти тестовые данные.** Нужна живая задача без исполнителя:

```sql
SELECT id, project_id, title
FROM tasks
WHERE assignee_id IS NULL AND deleted_at IS NULL
LIMIT 5;
```

**3. Проверить граничные значения прямо в базе.** В блоке 2 ты отправлял название проекта ровно из 100 символов. Сохранилось ли оно целиком?

```sql
SELECT id, length(name) AS name_len
FROM projects
WHERE length(name) >= 99
ORDER BY name_len DESC, id;
```

Видишь 100 — граница сохранена. Видишь 99 там, где отправлял 100 — где-то по дороге обрезали символ.

**4. Найти «мусор».** Пустые строки там, где их быть не должно, `NULL` в обязательных по смыслу полях, необычные значения:

```sql
SELECT id, description FROM projects WHERE description = '';
SELECT DISTINCT status FROM tasks;
```

`DISTINCT status` по всей таблице — быстрый способ увидеть, нет ли статуса, которого нет в спецификации.

**5. Проверить мягкое удаление.**

```sql
SELECT id, title, deleted_at
FROM tasks
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC
LIMIT 10;
```

После `DELETE` строка на месте, `deleted_at` заполнен. В списках API её быть не должно. А «действующие» — это всегда `deleted_at IS NULL`: забудешь это условие в своей проверке — и сам насчитаешь удалённые задачи.

**Привычки, которые экономят время:**

- **всегда `LIMIT`** на незнакомых и больших таблицах. На стенде в журнале могут быть миллионы строк;
- **не `SELECT *` в баг-репорте и отчёте** — только нужные столбцы, по именам;
- **комментарии `--`** — что проверяет запрос и откуда взят `id`. Через неделю ты сам не вспомнишь;
- **сохраняй полезные запросы** — в DBeaver это скрипты. Набор «проверок после API» пригодится на каждом релизе.

## Разборы из жизни

Ниже пять ситуаций, где `SELECT` обманывает того, кто его пишет. Первый разбор открыт — это образец. Остальные попробуй сначала разобрать сам и только потом открывай.

<details class="details custom-block" open>
<summary>Разбор 1. Отчёт «клиенты без телефона» пустой — CRM салона красоты</summary>

**Ситуация.** Администратор хочет обзвонить клиентов, у которых не указан телефон, и попросить его оставить. Разработчик добавил в админку отчёт. Отчёт пустой. Администратор: «Странно, я точно знаю, что у Ивановой телефона нет». Разработчик: «Отчёт работает, значит, у всех есть».

**Что видит мидл.**

- Пустой отчёт — подозрительный результат, а не ответ. «Таких строк нет» и «запрос их не находит» выглядят одинаково.
- Скорее всего, в запросе `WHERE phone = NULL`. Такое условие для каждой строки — UNKNOWN, и `WHERE` отбрасывает всё. Ошибки нет — запрос молча возвращает пусто.
- Второй вариант: часть клиентов записана с пустой строкой `''` — например, через старую форму. Тогда даже `IS NULL` найдёт не всех.

**Что делать.**

1. Найти карточку Ивановой и посмотреть, что лежит в `phone`: `NULL`, `''` или что-то ещё.
2. Выполнить в базе два запроса: `WHERE phone IS NULL` и `WHERE phone = ''`. Сравнить количество с отчётом.
3. Попросить у разработчика запрос отчёта или найти его в логах. Увидеть `= NULL` — сразу причина.
4. Завести баг: «Отчёт "клиенты без телефона" пустой. В базе 37 клиентов с `phone IS NULL` и 5 с `phone = ''`. Ожидается: отчёт показывает оба случая». Приложить оба запроса.
5. Спросить аналитика: `''` и `NULL` в телефоне — одно и то же для бизнеса? Если да — хорошо бы хранить одинаково.

**Чего не делать.**

- Не принимать «пусто» как «таких нет», не проверив данные напрямую.
- Не проверять только один вариант «пустого». `NULL` и `''` — оба.

</details>

::: details Разбор 2. «Не отменённые» заказы — а выручка не сходится — служба доставки еды
**Ситуация.** Финансовый отчёт считает выручку по заказам «кроме отменённых». Бухгалтер сверяет с платёжной системой: денег пришло больше, чем в отчёте, разница — пара процентов каждый день.

**Что видит мидл.**

- В отчёте, скорее всего, `WHERE status <> 'CANCELLED'`. Заказы со `status = NULL` в него не попадают: `NULL <> 'CANCELLED'` — UNKNOWN.
- Откуда `NULL` в статусе? Например, заказы из нового мобильного приложения или от партнёров записываются без статуса, пока их не подтвердит ресторан. Деньги за них уже пришли.
- Разница «пару процентов каждый день» — как раз доля таких заказов.

**Что делать.**

1. Посчитать в базе отдельно: сколько заказов `status IS NULL` за день и сколько `status <> 'CANCELLED'`. Сложить — сравнить с платёжной системой.
2. Найти, откуда приходят заказы без статуса: посмотреть у них канал, время, партнёра.
3. Завести два бага. Первый — в отчёте: «Заказы со статусом `NULL` не попадают в выручку». Второй — в создании заказа: «Заказы из канала X сохраняются без статуса». Это разные исправления, и делать их могут разные люди.
4. Предложить проверку на будущее: `SELECT DISTINCT status FROM orders` после каждого релиза — нет ли неожиданных значений и `NULL`.

**Чего не делать.**

- Не «чинить» отчёт заменой на `IS DISTINCT FROM`, не выяснив, должны ли такие заказы считаться. Может быть, правильно их не считать — но тогда платёжная система должна знать почему.
:::

::: details Разбор 3. Выгрузка «за октябрь» без 31-го числа — маркетплейс
**Ситуация.** Продавец скачал выгрузку заказов за октябрь и сверил со своим учётом: не хватает всех заказов 31 октября, кроме одного, оформленного ровно в полночь. Поддержка: «Мы выгружаем строго с 1 по 31 октября, как вы и выбрали».

**Что видит мидл.**

- Классика: `created_at BETWEEN '2026-10-01' AND '2026-10-31'`. Для столбца с временем правая граница — `2026-10-31 00:00:00`. Всё, что позже полуночи 31-го, не входит.
- «Ровно в полночь» — подсказка, которая это подтверждает: такой заказ равен границе и попадает.
- Рядом может жить вторая проблема — часовой пояс. Выгрузка считает «31 октября» в UTC, продавец — по Москве. Тогда на границах суток теряются или прибавляются ещё несколько часов.

**Что делать.**

1. Воспроизвести на стенде: создать заказы 31-го в 00:00, 00:01, 12:00, 23:59 и 1 ноября в 00:00. Выгрузить за октябрь.
2. Ожидание: первые четыре — да, заказ 1 ноября — нет.
3. Завести баг с этим набором и правильным условием: `created_at >= '2026-10-01' AND created_at < '2026-11-01'`.
4. Отдельно проверить часовой пояс: заказ в 01:30 по Москве 1 ноября — это 22:30 31 октября по UTC. В какой месяц он попал? Чего ожидает продавец? Это вопрос к требованиям.
5. Добавить в чек-лист любых фильтров по датам: «первая и последняя секунда периода, полночь после периода, граница суток в поясе пользователя».

**Чего не делать.**

- Не проверять фильтр по датам на данных, созданных в середине дня в середине месяца. На них всё работает.
:::

::: details Разбор 4. Поиск «50%» находит весь каталог — магазин бытовой техники
**Ситуация.** Менеджер ищет в админке акционные товары по слову «50%». Находит весь каталог, где есть «50» — «Чайник 1500 Вт», «Полка 50 см», «Телевизор 50"». Разработчик: «Поиск по подстроке, как просили».

**Что видит мидл.**

- В `LIKE` символ `%` — шаблон «любые символы». Ввод «50%» превращается в шаблон `'%50%%'` — это «содержит 50».
- Значит, сервер подставляет ввод в `LIKE` **без экранирования**. Тот же эффект у `_`.
- Со стороны API это разбирали в уроке [«Тест-дизайн для API»](/api/09-test-dizayn-api). Из базы видно, что нашлось бы правильным запросом.

**Что делать.**

1. Узнать правильный ответ из базы: `WHERE name LIKE '%50\%%'` — товары, где буквально есть «50%».
2. Сравнить с результатом поиска в админке. Разница — доказательство бага.
3. Проверить `_`: поиск «USB_C» не должен находить «USB-C».
4. Завести баг: «Поиск не экранирует `%` и `_`, они работают как шаблон». Приложить оба запроса — с экранированием и без — и их результаты.
5. Заодно проверить кавычку `'` и обратный слэш — если они ломают поиск, это повод проверить защиту от SQL-инъекций.

**Чего не делать.**

- Не считать, что «поиск находит» — значит «поиск работает». Важно, что он **не** находит лишнего.
:::

::: details Разбор 5. Рассылка ушла пустой из-за одного NULL — онлайн-кинотеатр
**Ситуация.** Маркетинг запускает рассылку «всем, кто не отписался». Список получателей строится так: пользователи, чей `id` не входит в таблицу отписавшихся. Вчера рассылка ушла 200 000 людей, сегодня — никому. Код рассылки не меняли.

**Что видит мидл.**

- Запрос, скорее всего, такой: `WHERE id NOT IN (SELECT user_id FROM unsubscribes)`. Внутренний запрос — подзапрос — даёт список `id`.
- Если в `unsubscribes.user_id` появился хоть один `NULL`, `NOT IN` для каждого пользователя даёт UNKNOWN, и результат — пусто. Это не «сломалось всё», это ровно одна строка.
- Откуда `NULL`: например, отписка анонимного посетителя по ссылке из письма без привязки к аккаунту. Новая фича — вчера её выкатили.

**Что делать.**

1. Проверить в базе: `SELECT * FROM unsubscribes WHERE user_id IS NULL`. Нашлась строка — причина найдена.
2. Завести баг на запрос рассылки: «`NOT IN` по подзапросу с `NULL` даёт пустой результат». Исправление выбирают разработчики: `NOT EXISTS` или условие `user_id IS NOT NULL` в подзапросе.
3. Отдельно — вопрос к фиче отписки: должен ли `user_id` быть пустым? Может быть, столбец должен быть `NOT NULL`.
4. Добавить в регрессию: «в таблице исключений есть строка с пустым ключом — рассылка уходит остальным».

**Чего не делать.**

- Не «починить» данные удалением строки с `NULL`. Завтра анонимный посетитель отпишется снова.
:::

## Частые ошибки

- **`= NULL` вместо `IS NULL`.** Запрос не падает, а молча возвращает пусто.
- **Забыть, что `<>` и `NOT IN` выбрасывают `NULL`.** «Все, кроме отменённых» без заказов со статусом `NULL`.
- **`AND` и `OR` без скобок.** `AND` выполняется раньше — результат шире, чем задумано.
- **Двойные кавычки для строк.** `"DONE"` — это имя столбца, а не значение.
- **Псевдоним в `WHERE`.** На этом шаге его ещё нет — повтори выражение.
- **`BETWEEN` с датами для столбца со временем.** Теряется последний день. Для периодов — `>= начало AND < начало следующего`.
- **`LIKE` без экранирования.** `%` и `_` в искомом тексте работают как шаблон.
- **`LIKE` там, где нужен `ILIKE`,** и наоборот. И забыть, что `ё` и `е` — разные буквы.
- **`LIMIT` без `ORDER BY`.** «Последние 5» превращаются в «какие-то 5».
- **Сортировка без уникального столбца в конце.** Строки с одинаковым значением меняются местами, страницы «плывут».
- **Сортировка чисел, которые хранятся строкой.** `'10' < '9'`.
- **`DISTINCT` как лекарство от дублей.** Дубли — симптом, ищи причину.
- **Забыть `deleted_at IS NULL`,** когда считаешь «действующие» записи в TaskFlow.
- **Сравнивать «за сегодня», не глядя на часовой пояс сессии.**

</template>
<template #task>

## Что нужно сделать

Цель — набить руку на `SELECT`: условия, поиск по части строки, `NULL`, сортировка, страницы, повторы. И научиться проверять запросом то, что сделал API.

Задание из четырёх частей:

1. 30 задач на базе TaskFlow в DBeaver.
2. 20 задач на учебных таблицах интернет-магазина в онлайн-песочнице.
3. Мидл: что проверить в базе после действия в API — 6 ситуаций.
4. Найди ошибки в 6 чужих запросах — письменно.

**Ветка TaskFlow:** `training-public`. Для частей 1 и 3 TaskFlow должен быть запущен у тебя на компьютере по инструкции из `README.md` репозитория (`docker compose up -d`). Подключение к базе в DBeaver — **только чтение**, как в уроке [«Что такое база данных»](/bd/01-chto-takoe-bd). Части 2 и 4 делаются без TaskFlow.

**Онлайн-песочницы PostgreSQL** — для части 2. Ссылки ниже.

<!-- TODO: ссылки на песочницы PostgreSQL от автора -->

**Как работать с задачами.** Сначала напиши запрос сам и выполни. Не получается — открой подсказку. Потом сверься с эталоном. Если твой запрос другой, а результат тот же — это нормально.

Уровни: **джун** — база, **мидл** — с подвохом, **с собеседования** — такие дают на собеседованиях.

## Часть 1. Задачи на TaskFlow (DBeaver)

Результаты зависят от твоего стенда: в блоке 2 ты создавал и удалял проекты, задачи, комментарии. Поэтому эталон — это **запрос**, а не числа. «Действующие» записи — это те, у которых `deleted_at IS NULL`.

### Столбцы и псевдонимы

**Задача 1** (джун). Список проектов: `id`, название и статус. Столбец с названием в результате должен называться «Название».

::: details Подсказка
Псевдоним с русскими буквами пишется в двойных кавычках.
:::

::: details Эталон
```sql
SELECT id, name AS "Название", status FROM projects;
```
Двойные кавычки — для имён, а псевдоним — это имя столбца результата.
:::

**Задача 2** (джун). Список пользователей: `id` и имя с фамилией в одном столбце `full_name` через пробел.

::: details Подсказка
Строки склеивает `||`. Пробел — тоже строка: `' '`.
:::

::: details Эталон
```sql
SELECT id, first_name || ' ' || last_name AS full_name FROM users;
```
`first_name` и `last_name` в TaskFlow обязательные — `NULL` в склейке не появится.
:::

**Задача 3** (джун). 10 задач с самыми длинными названиями: `id`, название и длина названия `title_len`. При одинаковой длине — по `id`.

::: details Подсказка
Длина строки — `length(…)`. Сортировать можно по псевдониму.
:::

::: details Эталон
```sql
SELECT id, title, length(title) AS title_len
FROM tasks
ORDER BY title_len DESC, id
LIMIT 10;
```
Псевдоним в `ORDER BY` работает: сортировка идёт после `SELECT`.
:::

**Задача 4** (мидл). Комментарии: `id`, `task_id`, день создания **без времени** и текст. Сначала новые.

::: details Подсказка
Приведи `created_at` к типу `date`. Сортируй по исходному `created_at`, а не по дню — иначе комментарии одного дня перемешаются.
:::

::: details Эталон
```sql
SELECT id, task_id, created_at::date AS day, text
FROM comments
ORDER BY created_at DESC, id DESC;
```
`::date` берёт дату в часовом поясе сессии — поздний вечерний комментарий по UTC у тебя может оказаться «завтрашним».
:::

### WHERE и логика

**Задача 5** (джун). Действующие задачи проекта с `id = 1` в статусе `TODO`: `id`, название, исполнитель.

::: details Подсказка
Три условия через `AND`. Не забудь про мягкое удаление.
:::

::: details Эталон
```sql
SELECT id, title, assignee_id
FROM tasks
WHERE project_id = 1 AND status = 'TODO' AND deleted_at IS NULL;
```
Без `deleted_at IS NULL` в список попадут задачи, которые пользователь уже не видит.
:::

**Задача 6** (джун). Действующие задачи, которые ещё не сделаны, — статус любой, кроме `DONE`.

::: details Подсказка
«Не равно» — `<>` или `!=`.
:::

::: details Эталон
```sql
SELECT id, title, status
FROM tasks
WHERE status <> 'DONE' AND deleted_at IS NULL;
```
Здесь `<>` безопасен: `tasks.status` — `NOT NULL`, строк со статусом `NULL` не бывает.
:::

**Задача 7** (с собеседования). Действующие задачи в статусе `IN_PROGRESS` из проектов 1 **или** 2. Сначала напиши условие без скобок и сравни результат.

::: details Подсказка
`AND` выполняется раньше `OR`. Где должны стоять скобки, чтобы `OR` сработал первым?
:::

::: details Эталон
```sql
SELECT id, title, project_id, status
FROM tasks
WHERE status = 'IN_PROGRESS'
  AND (project_id = 1 OR project_id = 2)
  AND deleted_at IS NULL;
```
Без скобок `… AND project_id = 1 OR project_id = 2 AND …` вернёт ещё и задачи проекта 2 в любом статусе. Короче — `project_id IN (1, 2)`.
:::

**Задача 8** (джун). Пользователи, которые могут войти в систему: активные и не удалённые. `id`, email, имя.

::: details Подсказка
Логический столбец можно писать без `= true`.
:::

::: details Эталон
```sql
SELECT id, email, first_name
FROM users
WHERE is_active AND deleted_at IS NULL;
```
`WHERE is_active` — то же, что `WHERE is_active = true`.
:::

**Задача 9** (мидл). Наоборот — пользователи, которые войти **не могут**: деактивированные **или** удалённые.

::: details Подсказка
Возьми условие из задачи 8 и поставь перед ним `NOT` в скобках. А потом попробуй записать то же без `NOT (…)`.
:::

::: details Эталон
```sql
SELECT id, email, is_active, deleted_at
FROM users
WHERE NOT is_active OR deleted_at IS NOT NULL;

-- то же самое
SELECT id, email, is_active, deleted_at
FROM users
WHERE NOT (is_active AND deleted_at IS NULL);
```
«Не (A и B)» — это «не A или не B». Перепутать `AND` и `OR` при отрицании — частая ошибка в фильтрах.
:::

### IN, BETWEEN, даты

**Задача 10** (джун). Действующие задачи из проектов 1, 2 и 4. Используй `IN`.

::: details Подсказка
`project_id IN (…)`.
:::

::: details Эталон
```sql
SELECT id, title, project_id
FROM tasks
WHERE project_id IN (1, 2, 4) AND deleted_at IS NULL;
```
`IN` — короткая запись трёх условий через `OR`, и скобки за тебя уже расставлены.
:::

**Задача 11** (джун). Участники проектов с ролью `OWNER` или `MANAGER`: проект, пользователь, роль.

::: details Подсказка
Таблица `project_members`. Значения enum — в одинарных кавычках, большими буквами.
:::

::: details Эталон
```sql
SELECT project_id, user_id, role
FROM project_members
WHERE role IN ('OWNER', 'MANAGER')
ORDER BY project_id, user_id;
```
Сортировка по двум столбцам делает результат удобным для чтения и одинаковым при каждом запуске.
:::

**Задача 12** (джун). Задачи с `id` от 3 до 6. Сколько строк самое большее может вернуть такой запрос?

::: details Подсказка
`BETWEEN` включает обе границы.
:::

::: details Эталон
```sql
SELECT id, title, deleted_at FROM tasks WHERE id BETWEEN 3 AND 6;
```
Не больше четырёх: 3, 4, 5 и 6 — обе границы входят. Мягко удалённые тоже попадут, их видно по `deleted_at`.
:::

**Задача 13** (мидл). Проекты, созданные за последние 7 суток. Если пусто — создай проект через Swagger и выполни снова.

::: details Подсказка
Текущий момент — `now()`, промежуток — `interval '7 days'`.
:::

::: details Эталон
```sql
SELECT id, name, created_at
FROM projects
WHERE created_at >= now() - interval '7 days'
ORDER BY created_at DESC;
```
Это ровно 7 × 24 часа назад от момента запроса. «С начала дня неделю назад» — уже `created_at >= current_date - 7`.
:::

**Задача 14** (мидл). Записи журнала `audit_log` за сегодня: действие, тип и номер объекта, время. Перед этим выполни `SHOW timezone;` — в каком поясе для тебя наступило «сегодня»?

::: details Подсказка
`current_date` — сегодняшняя дата в поясе сессии. Сравнение с ней — это «с полуночи».
:::

::: details Эталон
```sql
SHOW timezone;

SELECT action, entity_type, entity_id, created_at
FROM audit_log
WHERE created_at >= current_date
ORDER BY created_at DESC, id DESC;
```
Полночь считается в поясе DBeaver, а не в UTC: у тебя и на сервере «сегодня» может начинаться в разное время.
:::

**Задача 15** (мидл). Записи `audit_log` за вчера.

::: details Подсказка
Нужны две границы: от вчерашней полуночи **включительно** до сегодняшней **не включая**.
:::

::: details Эталон
```sql
SELECT action, entity_type, entity_id, created_at
FROM audit_log
WHERE created_at >= current_date - 1
  AND created_at <  current_date
ORDER BY created_at, id;
```
Полуоткрытый интервал не захватит запись ровно в полночь сегодняшнего дня.
:::

**Задача 16** (с собеседования). Задачи, созданные в прошлом календарном месяце. Не используй `BETWEEN` — объясни почему.

::: details Подсказка
Начало текущего месяца — `date_trunc('month', now())`. Начало прошлого — на месяц раньше.
:::

::: details Эталон
```sql
SELECT id, title, created_at
FROM tasks
WHERE created_at >= date_trunc('month', now()) - interval '1 month'
  AND created_at <  date_trunc('month', now())
ORDER BY created_at, id;
```
`BETWEEN '…-01' AND '…-31'` для столбца со временем потеряет последний день месяца после полуночи.
:::

### LIKE и ILIKE

**Задача 17** (джун). Задачи, в названии которых есть «JWT». Потом поищи «jwt» маленькими буквами — сначала через `LIKE`, потом через `ILIKE`.

::: details Подсказка
`%` с обеих сторон — «содержит где угодно».
:::

::: details Эталон
```sql
SELECT id, title FROM tasks WHERE title LIKE '%JWT%';
SELECT id, title FROM tasks WHERE title LIKE '%jwt%';    -- пусто, если ты не создавал такую задачу
SELECT id, title FROM tasks WHERE title ILIKE '%jwt%';
```
`LIKE` учитывает регистр, `ILIKE` — нет.
:::

**Задача 18** (джун). Проекты, название которых начинается с латинской буквы «M».

::: details Подсказка
`%` только справа.
:::

::: details Эталон
```sql
SELECT id, name FROM projects WHERE name LIKE 'M%';
```
В начальных данных такой проект — «Mobile Banking». Проекты на русскую «М» сюда не попадут: это другой символ.
:::

**Задача 19** (мидл). Задачи, в описании которых **буквально** есть символ `%`. В блоке 2 ты проверял поиск спецсимволами — возможно, такие задачи у тебя есть. Сравни с запросом без экранирования.

::: details Подсказка
Перед `%`, который должен значить сам себя, ставится `\`.
:::

::: details Эталон
```sql
SELECT id, description FROM tasks WHERE description LIKE '%\%%';

-- для сравнения: это «описание из любых символов» — все, где описание не NULL
SELECT id, description FROM tasks WHERE description LIKE '%%%';
```
Неэкранированный `%` — шаблон, поэтому второй запрос находит почти всё.
:::

**Задача 20** (мидл). Проекты, в названии которых буквально есть подчёркивание `_`. Сравни с `LIKE '%_%'`.

::: details Подсказка
`_` — шаблон «один любой символ». Как сделать его обычным символом?
:::

::: details Эталон
```sql
SELECT id, name FROM projects WHERE name LIKE '%\_%';

-- для сравнения: «хотя бы один символ» — все проекты
SELECT id, name FROM projects WHERE name LIKE '%_%';
```
Если поиск в API подставляет ввод в `LIKE` без экранирования, поиск по `_` ведёт себя как второй запрос.
:::

### NULL

**Задача 21** (джун). Действующие задачи без исполнителя. Сначала напиши `assignee_id = NULL` — что получилось? Потом исправь.

::: details Подсказка
Сравнение с `NULL` через `=` всегда UNKNOWN.
:::

::: details Эталон
```sql
SELECT id, title, project_id
FROM tasks
WHERE assignee_id IS NULL AND deleted_at IS NULL;
```
В начальных данных такая задача — «Настроить CI». `= NULL` вернёт пусто, но без ошибки.
:::

**Задача 22** (джун). Проекты без описания — и с `NULL`, и с пустой строкой. Какие записи с `NULL`, а какие с пустой строкой?

::: details Подсказка
Два разных условия через `OR`. Чтобы видеть, какой случай где, выведи `description IS NULL` отдельным столбцом.
:::

::: details Эталон
```sql
SELECT id, name, description IS NULL AS is_null
FROM projects
WHERE description IS NULL OR description = '';
```
Если встречаются оба варианта — разные пути записи сохраняют «пусто» по-разному. Это повод спросить, как должно быть.
:::

**Задача 23** (мидл). Действующие задачи, которые **не** назначены на пользователя 2 — в том числе задачи без исполнителя. Сначала попробуй `assignee_id <> 2`.

::: details Подсказка
Строки, где `assignee_id` — `NULL`, на `<> 2` дают UNKNOWN. Добавь их явно — или используй сравнение, которое считает `NULL` обычным значением.
:::

::: details Эталон
```sql
SELECT id, title, assignee_id
FROM tasks
WHERE assignee_id IS DISTINCT FROM 2 AND deleted_at IS NULL;

-- то же самое
SELECT id, title, assignee_id
FROM tasks
WHERE (assignee_id <> 2 OR assignee_id IS NULL) AND deleted_at IS NULL;
```
`<> 2` молча теряет задачи без исполнителя.
:::

**Задача 24** (мидл). Действующие задачи с колонкой «исполнитель»: номер исполнителя или текст `не назначен`.

::: details Подсказка
`COALESCE` возвращает значение одного типа. Число и текст в одном столбце не уживутся — номер нужно привести к тексту.
:::

::: details Эталон
```sql
SELECT id, title, COALESCE(assignee_id::text, 'не назначен') AS assignee
FROM tasks
WHERE deleted_at IS NULL;
```
Без `::text` PostgreSQL попробует превратить «не назначен» в число и выдаст ошибку.
:::

**Задача 25** (мидл). Все задачи с колонкой `state`: `удалена`, если задача мягко удалена; `без исполнителя`, если исполнителя нет; иначе `назначена`. Удалённая задача без исполнителя должна быть `удалена`.

::: details Подсказка
`CASE WHEN … THEN … WHEN … THEN … ELSE … END`. Условия проверяются сверху вниз — какое поставить первым?
:::

::: details Эталон
```sql
SELECT id, title,
       CASE
           WHEN deleted_at IS NOT NULL THEN 'удалена'
           WHEN assignee_id IS NULL    THEN 'без исполнителя'
           ELSE 'назначена'
       END AS state
FROM tasks
ORDER BY id;
```
Срабатывает первое верное условие, поэтому проверка удаления — первой.
:::

### ORDER BY, LIMIT, DISTINCT

**Задача 26** (джун). 5 последних созданных действующих задач, новые сверху. Порядок должен быть одинаковым при каждом запуске.

::: details Подсказка
У задач из начального наполнения `created_at` может совпадать. Что добавить в сортировку?
:::

::: details Эталон
```sql
SELECT id, title, created_at
FROM tasks
WHERE deleted_at IS NULL
ORDER BY created_at DESC, id DESC
LIMIT 5;
```
Уникальный `id` вторым столбцом делает порядок однозначным.
:::

**Задача 27** (джун). Вторая страница проектов по 3 штуки в порядке `id`.

::: details Подсказка
Вторая страница — пропустить первые 3.
:::

::: details Эталон
```sql
SELECT id, name
FROM projects
WHERE deleted_at IS NULL
ORDER BY id
LIMIT 3 OFFSET 3;
```
Так же сервер отдаёт `GET /projects?limit=3&offset=3`. Без `ORDER BY` страницы могли бы пересекаться.
:::

**Задача 28** (джун). Какие статусы встречаются у задач? А у проектов? Сравни со спецификацией TaskFlow.

::: details Подсказка
`DISTINCT` — уникальные значения.
:::

::: details Эталон
```sql
SELECT DISTINCT status FROM tasks ORDER BY status;
SELECT DISTINCT status FROM projects ORDER BY status;
```
Значение, которого нет в спецификации, — повод разобраться: статусы в TaskFlow — обычные строки, их охраняет только код.
:::

**Задача 29** (мидл). Действующие задачи, отсортированные по исполнителю. Задачи без исполнителя — **в начале** списка.

::: details Подсказка
В PostgreSQL при сортировке по возрастанию `NULL` уходят в конец. Как это поменять?
:::

::: details Эталон
```sql
SELECT id, title, assignee_id
FROM tasks
WHERE deleted_at IS NULL
ORDER BY assignee_id NULLS FIRST, id;
```
По умолчанию при `ASC` `NULL` в конце, при `DESC` — в начале.
:::

**Задача 30** (мидл). Последняя созданная действующая задача в каждом проекте — одна строка на проект.

::: details Подсказка
`DISTINCT ON (project_id)` и `ORDER BY`, который начинается с `project_id`, а дальше решает, какая задача «первая».
:::

::: details Эталон
```sql
SELECT DISTINCT ON (project_id) project_id, id, title, created_at
FROM tasks
WHERE deleted_at IS NULL
ORDER BY project_id, created_at DESC, id DESC;
```
Без `created_at DESC, id DESC` база выберет в каждом проекте случайную задачу.
:::

## Часть 2. Задачи на учебных таблицах

Две таблицы интернет-магазина: `products` — 24 товара и `orders` — 16 заказов. В них специально собраны ловушки урока: `NULL` и пустые строки, `%` и `_` в названиях, разный регистр, «ё», размеры одежды, номера-строки, заказы на границе месяца.

Открой онлайн-песочницу PostgreSQL, вставь скрипт целиком и выполни. Потом пиши запросы. Скрипт можно выполнять повторно — он сначала удаляет таблицы.

::: details Скрипт для песочницы
```sql
-- Учебные таблицы интернет-магазина для урока «SELECT: выбрать и отфильтровать».
-- Время в created_at — в UTC.

DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;

CREATE TABLE products (
    id           serial PRIMARY KEY,
    name         varchar(100)  NOT NULL,
    category     varchar(30)   NOT NULL,
    price        numeric(10,2) NOT NULL,
    stock        integer       NOT NULL,
    size         varchar(5),
    created_at   timestamptz   NOT NULL,
    discontinued boolean       NOT NULL DEFAULT false,
    description  varchar(500)
);

INSERT INTO products (name, category, price, stock, size, created_at, discontinued, description) VALUES
('Футболка базовая белая',  'Одежда',      990.00,   25,   'M',  '2026-08-03 10:15:00+00', false, 'Хлопок 100%, плотная ткань'),
('Футболка базовая чёрная', 'Одежда',      990.00,    0,   'L',  '2026-08-03 10:20:00+00', false, NULL),
('Худи оверсайз',           'Одежда',     3490.00,    8,   'XL', '2026-08-10 11:00:00+00', false, ''),
('Худи оверсайз',           'Одежда',     3490.00,    3,   'S',  '2026-08-10 11:05:00+00', false, ''),
('Джинсы прямые',           'Одежда',     4590.00,   12,   'M',  '2026-08-17 09:40:00+00', false, 'Классическая посадка'),
('Куртка зимняя',           'Одежда',    12990.00,    0,   'XS', '2026-08-20 12:30:00+00', true,  NULL),
('Платье летнее',           'одежда',     2790.00,    5,   'S',  '2026-08-24 13:10:00+00', false, 'Вискоза'),
('Рубашка льняная',         'Одежда',     3990.00,    4,   'L',  '2026-09-01 10:00:00+00', false, 'Лён 100%'),
('Носки, 3 пары',           'Одежда',      590.00,   60,   'M',  '2026-09-01 10:30:00+00', false, NULL),
('Кроссовки беговые',       'Обувь',      6990.00,    7,   '42', '2026-09-05 09:15:00+00', false, ''),
('Кеды «Ретро»',            'Обувь',      4290.00,   15,   '39', '2026-09-07 11:45:00+00', false, NULL),
('Сапоги ЗИМНИЕ',           'Обувь',      8990.00,    2,   '38', '2026-09-12 12:00:00+00', false, 'Натуральная кожа'),
('Наушники SONY WH-1000',   'Электроника', 24990.00,  4,   NULL, '2026-09-15 10:10:00+00', false, 'Шумоподавление'),
('Колонка Sony mini',       'Электроника', 5990.00,  10,   NULL, '2026-09-18 13:20:00+00', false, NULL),
('пульт sony для ТВ',       'Электроника', 1490.00,   0,   NULL, '2026-09-20 09:05:00+00', true,  ''),
('Кабель USB_C 1 м',        'Электроника',  590.00,  50,   NULL, '2026-09-25 10:00:00+00', false, 'Быстрая зарядка'),
('Кабель USB-C 2 м',        'Электроника',  790.00,  40,   NULL, '2026-09-25 10:05:00+00', false, NULL),
('Купон 50% на доставку',   'Купоны',         0.00, 1000,  NULL, '2026-10-01 09:00:00+00', false, 'Действует 30 дней'),
('Скидка 5% на всё',        'Купоны',         0.00,  500,  NULL, '2026-10-01 09:10:00+00', false, NULL),
('Ёлочная игрушка «Шар»',   'Дом',          350.00,  120,  NULL, '2026-10-05 11:00:00+00', false, 'Стекло'),
('Плед 150×200',            'Дом',         2990.00,    6,  NULL, '2026-10-06 12:15:00+00', false, ''),
('Полка настенная 50 см',   'Дом',         1890.00,    9,  NULL, '2026-10-08 13:40:00+00', false, NULL),
('Чай «Зелёный жасмин»',    'Продукты',     450.00,   30,  NULL, '2026-10-10 10:25:00+00', false, NULL),
('Чай «Зеленый с мятой»',   'Продукты',     420.00,    0,  NULL, '2026-10-12 09:50:00+00', false, 'Без сахара');

CREATE TABLE orders (
    id          serial PRIMARY KEY,
    external_no varchar(10)  NOT NULL,
    product_id  integer      NOT NULL REFERENCES products (id),
    customer    varchar(100) NOT NULL,
    phone       varchar(20),
    status      varchar(20),
    quantity    integer      NOT NULL,
    created_at  timestamptz  NOT NULL
);

INSERT INTO orders (external_no, product_id, customer, phone, status, quantity, created_at) VALUES
('5',   1,  'Алёна Котова',      '+79001110001', 'DELIVERED', 2, '2026-09-30 13:30:00+00'),
('7',   13, 'Пётр Иванов',       '+79001110002', 'DELIVERED', 1, '2026-10-01 09:15:00+00'),
('8',   5,  'Мария Лебедева',    NULL,           'CANCELLED', 1, '2026-10-03 10:40:00+00'),
('9',   10, 'Олег Ким',          '+79001110004', 'DELIVERED', 1, '2026-10-05 12:00:00+00'),
('10',  18, 'Алена Смирнова',    '',             'PAID',      1, '2026-10-08 11:20:00+00'),
('11',  3,  'Игорь Белов',       '+79001110006', NULL,        1, '2026-10-10 09:45:00+00'),
('12',  23, 'Светлана Орлова',   '+79001110007', 'SHIPPED',   3, '2026-10-12 13:05:00+00'),
('14',  16, 'Пётр Иванов',       '+79001110002', 'PAID',      2, '2026-10-15 10:00:00+00'),
('20',  21, 'Наталья Фёдорова',  NULL,           'NEW',       1, '2026-10-18 12:30:00+00'),
('21',  9,  'Олег Ким',          '+79001110004', 'CANCELLED', 4, '2026-10-20 09:10:00+00'),
('99',  12, 'Дарья Волкова',     '+79001110011', 'SHIPPED',   1, '2026-10-24 11:55:00+00'),
('100', 2,  'Алёна Котова',      '+79001110001', NULL,        1, '2026-10-27 10:35:00+00'),
('101', 14, 'Мария Лебедева',    NULL,           'NEW',       1, '2026-10-29 13:15:00+00'),
('102', 20, 'Кирилл Зуев',       '+79001110014', 'PAID',      5, '2026-10-31 09:20:00+00'),
('105', 7,  'Ольга Петрова',     '+79001110015', 'CANCELLED', 1, '2026-10-31 13:50:00+00'),
('110', 11, 'Иван Сергеев',      '+79001110016', 'NEW',       1, '2026-11-01 10:05:00+00');
```
:::

В этой части данные известны, поэтому в эталонах указано, **сколько строк** должен вернуть запрос. Если у тебя другое число — ищи разницу.

**Задача 31** (джун). Все товары: название, цена, остаток и стоимость остатка `stock_value` — цена, умноженная на остаток.

::: details Подсказка
Выражение в `SELECT` и псевдоним через `AS`.
:::

::: details Эталон
```sql
SELECT name, price, stock, price * stock AS stock_value FROM products;
```
24 строки. Выражение вычисляется для каждой строки.
:::

**Задача 32** (джун). Товары дороже 5000 ₽, которые не сняты с продажи.

::: details Подсказка
Снятые с продажи — `discontinued = true`.
:::

::: details Эталон
```sql
SELECT name, price FROM products WHERE price > 5000 AND NOT discontinued;
```
4 строки. Куртка за 12 990 ₽ снята с продажи — её нет.
:::

**Задача 33** (джун). Товары категорий «Обувь» и «Электроника». Используй `IN`.

::: details Подсказка
`category IN (…, …)`.
:::

::: details Эталон
```sql
SELECT name, category FROM products WHERE category IN ('Обувь', 'Электроника');
```
8 строк.
:::

**Задача 34** (джун). Товары ценой от 590 до 990 ₽ включительно.

::: details Подсказка
`BETWEEN` включает границы. Есть ли товары ровно на границах?
:::

::: details Эталон
```sql
SELECT name, price FROM products WHERE price BETWEEN 590 AND 990;
```
5 строк, из них два товара по 590 и два по 990 — граничные значения входят.
:::

**Задача 35** (мидл). Все товары категории «Одежда». Выполни `WHERE category = 'Одежда'` и посчитай строки. Потом посмотри, какие категории вообще есть, — всю ли одежду ты нашёл?

::: details Подсказка
`SELECT DISTINCT category FROM products;` — а потом `ILIKE`. Если в песочнице `ILIKE` по русским буквам не находит очевидное, у её базы локаль `C` — там регистр меняется только у латиницы. Тогда перечисли оба написания: `category IN ('Одежда', 'одежда')`.
:::

::: details Эталон
```sql
SELECT id, name, category FROM products WHERE category = 'Одежда';        -- 8 строк
SELECT DISTINCT category FROM products;                                     -- есть «одежда»
SELECT id, name, category FROM products WHERE category ILIKE 'одежда';     -- 9 строк
```
«Платье летнее» записано в категорию `одежда` с маленькой буквы. `=` учитывает регистр. Для тестировщика это ещё и находка: в справочнике категорий грязные данные.
:::

**Задача 36** (джун). Все товары Sony — в названии бренд написан по-разному. Сравни `LIKE` и `ILIKE`.

::: details Подсказка
`'%Sony%'` и `'%sony%'` — разные шаблоны для `LIKE`.
:::

::: details Эталон
```sql
SELECT name FROM products WHERE name LIKE '%Sony%';     -- 1 строка
SELECT name FROM products WHERE name ILIKE '%sony%';    -- 3 строки
```
«SONY», «Sony» и «sony» — для `LIKE` три разных слова.
:::

**Задача 37** (мидл). Найди купон «50%». Сначала напиши `LIKE '%50%%'` — что нашлось? Потом исправь.

::: details Подсказка
Второй `%` должен значить сам себя. Экранируй его.
:::

::: details Эталон
```sql
SELECT name FROM products WHERE name LIKE '%50%%';     -- 3 строки: «содержит 50»
SELECT name FROM products WHERE name LIKE '%50\%%';    -- 1 строка
```
Неэкранированный `%` нашёл ещё плед 150×200 и полку 50 см.
:::

**Задача 38** (мидл). Найди кабель, в названии которого буквально «USB_C» с подчёркиванием.

::: details Подсказка
`_` — «один любой символ». Дефис тоже символ.
:::

::: details Эталон
```sql
SELECT name FROM products WHERE name LIKE '%USB_C%';     -- 2 строки
SELECT name FROM products WHERE name LIKE '%USB\_C%';    -- 1 строка
```
Без экранирования `_` совпал с дефисом в «USB-C».
:::

**Задача 39** (мидл). Найди весь зелёный чай. Попробуй `ILIKE '%зеленый%'` и `ILIKE '%зелёный%'`.

::: details Подсказка
Для базы «е» и «ё» — разные буквы. Нужны оба варианта. Если `ILIKE` по русским буквам не срабатывает, в песочнице локаль `C` — перечисли написания с большой и маленькой буквы через `LIKE` и `OR`: `name LIKE '%Зелен%' OR name LIKE '%Зелён%' OR …`.
:::

::: details Эталон
```sql
SELECT name FROM products WHERE name ILIKE '%зелен%' OR name ILIKE '%зелён%';
```
2 строки. Каждый вариант по отдельности находит по одной. Короче можно `ILIKE '%зел_н%'`, но такой шаблон найдёт и «зелан».
:::

**Задача 40** (джун). Товары без описания. Посчитай отдельно: описание `NULL`, описание — пустая строка, и оба случая вместе.

::: details Подсказка
`IS NULL`, `= ''` и их `OR`. Попробуй ещё `description = NULL`.
:::

::: details Эталон
```sql
SELECT name FROM products WHERE description IS NULL;                        -- 9 строк
SELECT name FROM products WHERE description = '';                           -- 5 строк
SELECT name FROM products WHERE description IS NULL OR description = '';    -- 14 строк
```
`description = NULL` вернёт 0 строк — без ошибки.
:::

**Задача 41** (джун). Список товаров для каталога: название и описание. Вместо `NULL` — текст «(нет описания)». Что стало с пустыми описаниями?

::: details Подсказка
`COALESCE(столбец, 'замена')`.
:::

::: details Эталон
```sql
SELECT name, COALESCE(description, '(нет описания)') AS description FROM products;
```
24 строки. 9 описаний заменились, а 5 пустых строк остались пустыми: `''` — не `NULL`, `COALESCE` их не трогает.
:::

**Задача 42** (с собеседования). Товары, размер которых не S и не M. Потом добавь в список `NULL`: `NOT IN ('S', 'M', NULL)`. Потом напиши запрос, который вернёт ещё и товары без размера.

::: details Подсказка
Посчитай, что даёт `NOT IN` для строки с размером `NULL` и для списка, в котором есть `NULL`.
:::

::: details Эталон
```sql
SELECT name, size FROM products WHERE size NOT IN ('S', 'M');                     -- 7 строк
SELECT name, size FROM products WHERE size NOT IN ('S', 'M', NULL);               -- 0 строк
SELECT name, size FROM products WHERE size NOT IN ('S', 'M') OR size IS NULL;     -- 19 строк
```
Товары без размера теряются в первом запросе. `NULL` в списке делает `NOT IN` пустым для всех строк.
:::

**Задача 43** (мидл). Одежда с большой буквы «Одежда» в порядке размеров: XS, S, M, L, XL. Сначала отсортируй просто `ORDER BY size` и посмотри, что получилось.

::: details Подсказка
`ORDER BY CASE size WHEN 'XS' THEN 1 … END`. При одинаковом размере — по `id`.
:::

::: details Эталон
```sql
SELECT name, size
FROM products
WHERE category = 'Одежда'
ORDER BY CASE size
             WHEN 'XS' THEN 1
             WHEN 'S'  THEN 2
             WHEN 'M'  THEN 3
             WHEN 'L'  THEN 4
             WHEN 'XL' THEN 5
         END,
         id;
```
8 строк: XS, S, M, M, M, L, L, XL. По алфавиту было бы L, L, M, M, M, S, XL, XS.
:::

**Задача 44** (джун). Три самых дорогих товара.

::: details Подсказка
Сначала сортировка, потом ограничение.
:::

::: details Эталон
```sql
SELECT name, price FROM products ORDER BY price DESC LIMIT 3;
```
3 строки: наушники, куртка, сапоги. Тот же результат — `FETCH FIRST 3 ROWS ONLY` вместо `LIMIT 3`.
:::

**Задача 45** (мидл). Каталог от дешёвых к дорогим по 5 товаров на странице. Покажи **вторую** страницу. Порядок должен быть одинаковым при каждом запуске.

::: details Подсказка
Есть товары с одинаковой ценой: два по 590 и два по 990. Что добавить в сортировку?
:::

::: details Эталон
```sql
SELECT id, name, price FROM products ORDER BY price, id LIMIT 5 OFFSET 5;
```
5 строк с `id` 9, 16, 17, 1, 2. Без `id` в сортировке товары с одной ценой могут поменяться местами между страницами.
:::

**Задача 46** (джун). Какие категории товаров есть в магазине? Что в результате подозрительно?

::: details Подсказка
`DISTINCT`.
:::

::: details Эталон
```sql
SELECT DISTINCT category FROM products ORDER BY category;
```
7 строк — «Одежда» и «одежда» отдельно. `DISTINCT` — быстрый способ найти грязные данные в справочниках.
:::

**Задача 47** (мидл). Самый дешёвый товар в каждой категории — одна строка на категорию. При равной цене — товар с меньшим `id`.

::: details Подсказка
`DISTINCT ON (category)`, а `ORDER BY` начинается с `category`.
:::

::: details Эталон
```sql
SELECT DISTINCT ON (category) category, name, price
FROM products
ORDER BY category, price, id;
```
7 строк. В «Одежде» самый дешёвый — носки за 590, а у «одежды» с маленькой буквы — своя строка с платьем.
:::

**Задача 48** (с собеседования). Все заказы, кроме отменённых. Заказы без статуса тоже должны попасть. Сравни три варианта: `<>`, `NOT IN ('CANCELLED', NULL)` и правильный.

::: details Подсказка
Сколько заказов со статусом `NULL`? Что даёт для них `<>`?
:::

::: details Эталон
```sql
SELECT external_no, status FROM orders WHERE status <> 'CANCELLED';                   -- 11 строк
SELECT external_no, status FROM orders WHERE status NOT IN ('CANCELLED', NULL);       -- 0 строк
SELECT external_no, status FROM orders WHERE status IS DISTINCT FROM 'CANCELLED';      -- 13 строк
```
Из 16 заказов 3 отменены, у 2 статуса нет. Вместо `IS DISTINCT FROM` подойдёт `status <> 'CANCELLED' OR status IS NULL`.
:::

**Задача 49** (с собеседования). Заказы за октябрь 2026. Сначала напиши через `BETWEEN '2026-10-01' AND '2026-10-31'` и посмотри, каких заказов не хватает.

::: details Подсказка
Во сколько оформлены заказы 31 октября? Чему равна строка `'2026-10-31'` для столбца со временем?
:::

::: details Эталон
```sql
SELECT external_no, created_at FROM orders
WHERE created_at BETWEEN '2026-10-01' AND '2026-10-31';             -- 12 строк

SELECT external_no, created_at FROM orders
WHERE created_at >= '2026-10-01' AND created_at < '2026-11-01';    -- 14 строк
```
`BETWEEN` потерял оба заказа 31 октября: правая граница — 31 октября 00:00.
:::

**Задача 50** (мидл). Заказы по номеру `external_no` по возрастанию. Сначала отсортируй как есть, потом — как числа.

::: details Подсказка
`external_no` — строка. Строки сравниваются посимвольно.
:::

::: details Эталон
```sql
SELECT external_no FROM orders ORDER BY external_no;             -- 10, 100, 101, …, 9, 99
SELECT external_no FROM orders ORDER BY external_no::integer;    -- 5, 7, 8, 9, 10, …, 110
```
16 строк. Номера хранятся строкой, поэтому `'10'` оказывается раньше `'9'`.
:::

## Часть 3 (мидл). Проверь в базе после действия в API

Ты выполняешь запрос в Swagger и получаешь ответ. Что выполнишь в базе, чтобы убедиться, что всё сохранилось правильно? Для каждой ситуации напиши:

- какие `SELECT` выполнишь — по одному на таблицу, без соединения таблиц;
- что ожидаешь увидеть в каждом столбце;
- что будет багом.

Выполни хотя бы три ситуации на своём стенде по-настоящему: запрос в API → запросы в базу → скриншоты.

**Ситуация 1.** `POST /api/v1/projects` с телом `{"name": "QA проверка БД", "description": "Проект для урока"}`. Ответ — `201`, в нём `"id": 15`.

::: details Эталон
```sql
-- сам проект
SELECT id, name, description, status, owner_id, created_at, deleted_at
FROM projects WHERE id = 15;

-- создатель стал участником
SELECT project_id, user_id, role
FROM project_members WHERE project_id = 15;

-- запись в журнале
SELECT user_id, action, entity_type, entity_id, details, created_at
FROM audit_log WHERE entity_type = 'project' AND entity_id = 15
ORDER BY id;
```
Ожидаю: название и описание — как в запросе, `status = 'ACTIVE'`, `owner_id` — мой `id`, `deleted_at` пустой, `created_at` — только что. В `project_members` — одна строка: я с ролью `OWNER`. В журнале — `project.create` от моего `user_id`. Багом будет: нет строки участника, другой владелец, пустой `status`, нет записи в журнале.
:::

**Ситуация 2.** `PATCH /api/v1/projects/15` с телом `{"description": "Новое описание"}` — только описание. Ответ `200`.

::: details Эталон
```sql
SELECT id, name, description, status, owner_id, deleted_at
FROM projects WHERE id = 15;

SELECT user_id, action, details, created_at
FROM audit_log WHERE entity_type = 'project' AND entity_id = 15
ORDER BY id DESC LIMIT 3;
```
Ожидаю: изменилось только `description`, `name` и `status` — как были. Частичное обновление не должно затирать непереданные поля — ни в `NULL`, ни в значения по умолчанию. В журнале — `project.update`, в `details` — только `description`. Заметь: у таблицы `projects` нет столбца `updated_at`, поэтому момент изменения виден только в журнале.
:::

**Ситуация 3.** `DELETE /api/v1/tasks/7/comments/12` — удалить свой комментарий. Ответ `204`.

::: details Эталон
```sql
-- сам комментарий
SELECT id, task_id, author_id, text, deleted_at
FROM comments WHERE id = 12;

-- остальные комментарии задачи
SELECT id, deleted_at
FROM comments WHERE task_id = 7 ORDER BY id;

-- журнал
SELECT user_id, action, entity_id, created_at
FROM audit_log WHERE entity_type = 'comment' AND entity_id = 12;
```
Ожидаю: строка на месте, текст не стёрт, `deleted_at` заполнен — это мягкое удаление. У других комментариев задачи `deleted_at` пустой. В журнале — `comment.delete`. Багом будет: строка исчезла физически, удалились чужие комментарии, `deleted_at` пустой при ответе `204`.
:::

**Ситуация 4.** `POST /api/v1/tasks` с телом `{"projectId": 15, "title": "Проверить фильтры", "assigneeId": 3}`. Ответ `201`, `"id": 40`.

::: details Эталон
```sql
SELECT id, project_id, assignee_id, title, description, status, created_at, deleted_at
FROM tasks WHERE id = 40;

-- исполнитель существует и может работать
SELECT id, email, is_active, deleted_at
FROM users WHERE id = 3;

SELECT user_id, action, entity_id
FROM audit_log WHERE entity_type = 'task' AND entity_id = 40;
```
Ожидаю: `project_id = 15`, `assignee_id = 3`, `status = 'TODO'` — статус при создании не передаётся, `description` — `NULL`, потому что я его не отправлял, `deleted_at` пустой. Исполнитель активен и не удалён. В журнале — `task.create`. Отдельно — вопрос для исследования: что будет, если назначить удалённого или деактивированного пользователя?
:::

**Ситуация 5.** `DELETE /api/v1/tasks/40`. Ответ `204`. Перед удалением ты добавил к задаче два комментария.

::: details Эталон
```sql
SELECT id, deleted_at FROM tasks WHERE id = 40;

SELECT id, deleted_at FROM comments WHERE task_id = 40 ORDER BY id;

SELECT action, entity_type, entity_id, created_at
FROM audit_log WHERE entity_type = 'task' AND entity_id = 40
ORDER BY id;
```
Ожидаю: у задачи `deleted_at` заполнен, у обоих её комментариев — тоже, с тем же моментом: по спецификации удаление задачи каскадом удаляет комментарии. Строки физически на месте. В журнале — `task.delete`. Багом будет: комментарии остались живыми — тогда они «висят» у задачи, которой нет.
:::

**Ситуация 6.** `PATCH /api/v1/tasks/41` с телом `{"assigneeId": null}` — снять исполнителя. Ответ `200`.

::: details Эталон
```sql
SELECT id, assignee_id, title, status
FROM tasks WHERE id = 41;

SELECT action, details
FROM audit_log WHERE entity_type = 'task' AND entity_id = 41
ORDER BY id DESC LIMIT 1;
```
Ожидаю: `assignee_id IS NULL` — именно `NULL`, а не `0`. Остальные поля не изменились. В журнале — `task.update`. Проверь ещё отличие: тело `{}` без `assigneeId` не должно снимать исполнителя — «не передал» и «передал `null`» значат разное.
:::

## Часть 4 (письменно). Найди ошибки в чужих запросах

Коллега написал шесть запросов к учебным таблицам из части 2. Каждый работает без ошибки, но возвращает не то. Для каждого:

1. Объясни, что не так и что запрос вернёт на самом деле.
2. Напиши исправленный запрос.
3. Проверь оба варианта в песочнице.

**Запрос 1.** «Обувь и электроника дешевле 1000 ₽».

```sql
SELECT name, category, price
FROM products
WHERE category = 'Обувь' OR category = 'Электроника' AND price < 1000;
```

**Запрос 2.** «Клиенты, у которых не указан телефон».

```sql
SELECT customer, phone FROM orders WHERE phone = NULL;
```

**Запрос 3.** «Заказы за октябрь 2026».

```sql
SELECT external_no, created_at
FROM orders
WHERE created_at BETWEEN '2026-10-01' AND '2026-10-31';
```

**Запрос 4.** «Товары со скидкой 50%».

```sql
SELECT name FROM products WHERE name LIKE '%50%%';
```

**Запрос 5.** «Заказы по номеру по возрастанию».

```sql
SELECT external_no, customer FROM orders ORDER BY external_no;
```

**Запрос 6.** «Три самых новых заказа».

```sql
SELECT external_no, created_at FROM orders LIMIT 3;
```

::: details Самопроверка: что должно получиться
- Запрос 1: исправленный — 2 строки.
- Запрос 2: исправленный — 3 строки с `NULL`, а если по смыслу «не указан» включает пустую строку — 4.
- Запрос 3: исправленный — 14 строк.
- Запрос 4: исправленный — 1 строка.
- Запрос 5: исправленный начинается с 5, 7, 8, 9, 10.
- Запрос 6: исправленный — заказы 110, 105, 102.

Объяснение пиши своими словами — числа только помогают проверить запрос.
:::

## Как сдавать

Оформи результат в документе и покажи куратору лично — в чат или на созвоне.

Что должно быть в результате:

- часть 1: 30 запросов, к каждому — скриншот результата из DBeaver;
- часть 2: 20 запросов и число строк, которое вернул каждый. Где число не совпало с эталоном — объяснение почему;
- часть 3: шесть ситуаций — запросы, ожидания и что будет багом. Для трёх выполненных — скриншоты ответа API и результатов в базе;
- часть 4: шесть объяснений и исправленных запросов.

</template>
<template #questions>

## Ситуационные кейсы

Это рабочие ситуации, о которых могут спросить и на собеседовании. Готового ответа, который нужно угадать, здесь нет. Сначала подумай сам, потом открывай разбор.

::: details Кейс 1. «Почему WHERE x = NULL ничего не находит?»
**Ситуация.** Интервьюер: «В таблице точно есть клиенты без телефона. Запрос `WHERE phone = NULL` возвращает пусто. Почему? Как правильно?»

**Как рассуждать.** Что значит `NULL`? Что получается при сравнении неизвестного с чем-то? Какие строки пропускает `WHERE`?

**Пример ответа.** `NULL` — это «значение неизвестно». Сравнение с неизвестным даёт не «да» и не «нет», а третий результат — UNKNOWN. Даже `NULL = NULL` — UNKNOWN: два неизвестных не обязательно равны.

`WHERE` пропускает только строки, где условие TRUE. UNKNOWN он отбрасывает так же, как FALSE. Поэтому `= NULL` не находит ничего — и при этом не падает с ошибкой, что опаснее всего.

Правильно — `WHERE phone IS NULL`. И я бы уточнил, что значит «нет телефона» для бизнеса: если в данных бывает пустая строка, нужно ещё `OR phone = ''`. Та же логика ломает `<>`: `status <> 'CANCELLED'` не вернёт строки со статусом `NULL`.
:::

::: details Кейс 2. Хитрый вопрос: «Что вернёт NOT IN, если в списке есть NULL?»
**Ситуация.** Интервьюер пишет на доске: `SELECT * FROM orders WHERE status NOT IN ('CANCELLED', NULL);` — «Сколько строк вернёт, если в таблице 1000 заказов и 50 из них отменены?»

**Как рассуждать.** Во что раскрывается `NOT IN`? Что даёт сравнение с `NULL`? Что даёт `AND` с UNKNOWN?

**Пример ответа.** Ноль строк. `NOT IN ('CANCELLED', NULL)` — это `status <> 'CANCELLED' AND status <> NULL`. Вторая часть для любой строки — UNKNOWN. Для отменённых заказов получается `FALSE AND UNKNOWN` — FALSE, для остальных `TRUE AND UNKNOWN` — UNKNOWN. TRUE нет ни у одной строки.

На практике `NULL` в список руками не пишут — он приходит из подзапроса: `WHERE id NOT IN (SELECT user_id FROM unsubscribes)`. Один `NULL` в `user_id` — и результат пустой. Лечится через `NOT EXISTS` или фильтром `IS NOT NULL` в подзапросе.

Как тестировщик я бы добавил такую проверку в регрессию: положить в таблицу исключений строку с пустым ключом и убедиться, что основной список не опустел.
:::

::: details Кейс 3. «Как найти записи за вчера?»
**Ситуация.** Интервьюер: «Напишите запрос: все заказы, созданные вчера. Столбец `created_at` — `timestamp with time zone`».

**Как рассуждать.** Какие границы у «вчера»? Входит ли полночь сегодняшнего дня? Чьё «вчера» — пользователя, сервера, UTC?

**Пример ответа.**

```sql
SELECT id, created_at
FROM orders
WHERE created_at >= current_date - 1
  AND created_at <  current_date;
```

Полуоткрытый интервал: вчерашняя полночь входит, сегодняшняя — нет. `BETWEEN` здесь опасен: `BETWEEN вчера AND сегодня` захватит заказы ровно в сегодняшнюю полночь, а `BETWEEN '2026-10-15' AND '2026-10-15'` найдёт только заказы ровно в 00:00.

Отдельный вопрос — часовой пояс. `current_date` считается в поясе сессии. Если отчёт для менеджеров в Москве, а сервер работает в UTC, «вчера» сервера сдвинуто на 3 часа. Я бы уточнил, по чьему времени нужен отчёт, и проверил заказы около полуночи.
:::

::: details Кейс 4. «Чем WHERE отличается от HAVING?»
**Ситуация.** Интервьюер: «Оба фильтруют. Зачем два?»

**Как рассуждать.** Что фильтрует каждый — строки или группы? На каком шаге выполнения запроса?

**Пример ответа.** `WHERE` фильтрует **строки** до группировки. `HAVING` фильтрует **группы** после `GROUP BY` — по результатам подсчётов. Например, «клиенты, у которых больше пяти заказов»: сначала заказы группируют по клиенту и считают, потом `HAVING` оставляет группы, где счётчик больше пяти. В `WHERE` такое условие не написать — на его шаге подсчётов ещё нет.

Порядок выполнения: `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT`. Подробно группировка и `HAVING` — в уроке про агрегаты и группировку.
:::

::: details Кейс 5. «Как проверить, что API действительно сохранил данные?»
**Ситуация.** Интервьюер: «Вы создали заказ через API, получили `201`. Как убедиться, что всё сохранилось правильно?»

**Как рассуждать.** По какому ключу искать? Какие поля сравнивать — только те, что в ответе? Что ещё могло измениться в базе?

**Пример ответа.** `201` — обещание сервера, а не факт. Я беру `id` из ответа и смотрю строку в базе по нему — не по названию: названия повторяются.

Сравниваю три источника: тело запроса, ответ и строку в базе. Отдельно смотрю поля, которых нет в ответе: кто владелец, значения по умолчанию, время в UTC, отметка удаления пустая. Проверяю, что поля, которые я **не** отправлял, получили правильные значения по умолчанию, а не `NULL` или пустую строку.

Потом — побочные эффекты: связанные таблицы, например участник проекта или строки заказа; запись в журнале действий. И граничные значения: если отправлял 100 символов — `length()` в базе тоже 100.

Если в ответе и в базе разное — это баг, даже если ответ «правильный».
:::

::: details Кейс 6. Хитрый вопрос: «Почему порядок строк разный при одном и том же запросе?»
**Ситуация.** Интервьюер: «Тестировщик жалуется: один и тот же запрос дважды подряд вернул строки в разном порядке. Данные не менялись. Это баг базы?»

**Как рассуждать.** Есть ли в запросе `ORDER BY`? Однозначна ли сортировка? Что база обещает без неё?

**Пример ответа.** Не баг базы. Если в запросе нет `ORDER BY`, база вправе вернуть строки в любом порядке. Обычно он совпадает с порядком хранения, но меняется после обновлений, очистки таблицы, смены плана запроса или параллельного чтения.

Если `ORDER BY` есть, но по неуникальному столбцу — например, по дате, а у нескольких строк дата одинаковая, — порядок между ними тоже не определён.

Для тестировщика здесь два вывода. Первый — в своих проверках всегда сортировать однозначно: `ORDER BY created_at DESC, id DESC`. Второй — если так ведёт себя список в API, это **баг приложения**: при пагинации записи будут повторяться на соседних страницах и пропадать. Я бы проверил это на данных с одинаковым значением сортировки.
:::

## Вопросы для собеседования

<InterviewTrainer topic="bd/select" />

</template>
</LessonTabs>
