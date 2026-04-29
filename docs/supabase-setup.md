## Supabase Setup

Ниже твоя часть работы в Supabase. Делай шаги по порядку.

### 1. Проверить Project Settings

1. Открой свой проект в Supabase.
2. Перейди в `Project Settings` -> `API`.
3. Убедись, что у тебя есть:
   - `Project URL`
   - `Publishable / anon key`
   - `Secret key`

Что уже используется в проекте локально:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

### 2. Настроить Authentication

1. Перейди в `Authentication` -> `Providers`.
2. Включи `Email`.
3. Включи `Magic Link`.
4. Если Supabase просит выбрать режим входа, оставь вход без пароля по email.

### 3. Настроить URL для входа

1. Перейди в `Authentication` -> `URL Configuration`.
2. В `Site URL` укажи адрес сайта.

Для локальной разработки можно временно поставить:

```text
http://localhost:5173
```

3. В `Redirect URLs` добавь:

```text
http://localhost:5173/account.html
http://localhost:5173/Ocr/account.html
```

Если сайт потом будет жить на домене, туда нужно будет добавить и продовый URL, например:

```text
https://your-domain.com/account.html
https://your-domain.com/Ocr/account.html
```

### 4. Выполнить SQL-схему

1. Перейди в `SQL Editor`.
2. Создай новый query.
3. Открой файл [docs/supabase-schema.sql](docs/supabase-schema.sql).
4. Скопируй весь файл целиком.
5. Вставь его в `SQL Editor`.
6. Нажми `Run`.

Ожидаемый результат:

- создаются таблицы `profiles`, `discount_tiers`, `orders`, `order_items`, `customer_discount_state`
- создаются триггеры и функции
- включается `RLS`
- создаются policy для личного кабинета

Если вылезет ошибка, просто пришли мне текст ошибки или скрин.

### 5. Проверить таблицы

После выполнения SQL зайди в `Table Editor` и проверь, что появились:

- `profiles`
- `discount_tiers`
- `orders`
- `order_items`
- `customer_discount_state`

### 6. Проверить уровни скидок

Открой таблицу `discount_tiers`. Там должны быть уровни:

- `0 грн -> 0%`
- `3000 грн -> 3%`
- `7000 грн -> 5%`
- `12000 грн -> 7%`
- `20000 грн -> 10%`

Если хочешь поменять пороги, скажи мне, и я сразу скорректирую схему и логику.

### 7. Протестировать auth

После шагов выше:

1. Запусти сайт локально.
2. Открой `account.html`.
3. Введи email.
4. Получи magic link.
5. Перейди по ссылке из письма.

Если всё настроено правильно, ты попадешь в кабинет без пароля.

### 8. Что делать не нужно

- Не вставляй `secret key` во фронтенд-код.
- Не отключай `RLS` на этих таблицах.
- Не меняй policy вручную, если не уверен — лучше сначала показать мне.

### 9. Что я делаю дальше

После того как ты:

1. выполнишь SQL,
2. включишь magic link,
3. добавишь redirect URLs,

я делаю следующую часть:

- готовлю запись заказов в Supabase через `n8n`
- готовлю структуру данных для `orders` и `order_items`
- связываю историю заказов в кабинете с реальными заказами
- подвожу накопительную скидку к рабочему циклу
