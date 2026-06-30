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

Для Mono checkout также понадобятся:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_SITE_URL`
- `MONO_MERCHANT_TOKEN`

### 2. Настроить Authentication

1. Перейди в `Authentication` -> `Providers`.
2. Включи `Email`.
3. Включи вход по `Email + Password`.
4. Если есть отдельная настройка `Confirm email`, включи подтверждение email.
5. Если у вас раньше был только magic link, отключи сценарий входа без пароля, чтобы пользователи шли через обычную регистрацию и вход.

### 3. Настроить URL для входа

1. Перейди в `Authentication` -> `URL Configuration`.
2. В `Site URL` укажи адрес сайта.

Для локальной разработки можно временно поставить:

```text
http://localhost:5173/account.html
```

3. В `Redirect URLs` добавь:

```text
http://localhost:5173/account.html
https://odesacoffeeroasters.info/account.html
```

Если используешь GitHub Pages preview или другой дополнительный адрес, добавь и его тоже.

4. В локальном `.env.local` или в прод-конфиге укажи тот же URL в переменной:

```text
VITE_AUTH_REDIRECT_URL=https://odesacoffeeroasters.info/account.html
```

Для локальной разработки можно временно переключать на:

```text
VITE_AUTH_REDIRECT_URL=http://localhost:5173/account.html
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
- создаются `catalog_admins`, `product_catalog_state`, `product_catalog_items`
- создаются триггеры и функции
- в `profiles` автоматически создаётся запись после регистрации
- `full_name` из регистрации подтягивается в профиль
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
- `catalog_admins`
- `product_catalog_state`
- `product_catalog_items`

И что view `product_catalog_public` тоже доступен.

### 6. Синхронизировать каталог в Supabase

После SQL нужно один раз залить `products.json` в таблицу `product_catalog_items`.

Запуск из проекта:

```bash
npm run supabase:sync-products
```

Перед этим должны быть доступны:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Если используешь старую переменную `SUPABASE_SECRET_KEY`, скрипт тоже её подхватит.

### 7. Проверить уровни скидок

Открой таблицу `discount_tiers`. Там должны быть уровни:

- `0 грн -> 0%`
- `3000 грн -> 3%`
- `7000 грн -> 5%`
- `12000 грн -> 7%`
- `20000 грн -> 10%`

Если хочешь поменять пороги, скажи мне, и я сразу скорректирую схему и логику.

### 8. Настроить письма

1. Перейди в `Authentication` -> `Emails`.
2. Проверь, что включена отправка писем для:
   - `Confirm signup`
   - `Reset password` если будешь включать восстановление позже
3. Если нужен нормальный прод-отправитель, подключи SMTP.

Пока SMTP не подключён, письма будет слать сам Supabase. Для запуска этого достаточно.

### 9. Протестировать auth

После шагов выше:

1. Запусти сайт локально.
2. Открой `account.html`.
3. Переключись в `Реєстрація`.
4. Введи имя, email и пароль, который проходит требования.
5. Нажми регистрацию.
6. Получи письмо подтверждения.
7. Перейди по ссылке из письма.
8. Вернись в `Вхід` и войди по email и паролю.

Если всё настроено правильно, ты попадешь в кабинет без пароля.

Проверить отдельно:

- если войти до подтверждения email, сайт должен показать сообщение, что email ещё не подтверждён
- кнопка повторной отправки письма должна отправлять confirmation email ещё раз

### 10. Mono Edge Functions

Для карточной оплаты нужно задеплоить Edge Functions.

Подробный порядок вынесен в [docs/mono-supabase-deploy.md](docs/mono-supabase-deploy.md).

Минимум:

1. задать secrets в Supabase
2. задеплоить `mono-create-invoice`
3. задеплоить `mono-payment-webhook`
4. сделать один тестовый платёж

### 11. Что делать не нужно

- Не вставляй `secret key` во фронтенд-код.
- Не отключай `RLS` на этих таблицах.
- Не меняй policy вручную, если не уверен — лучше сначала показать мне.

### 12. Что уже сделано в коде

В проекте уже реализовано:

- регистрация по email и паролю
- требования к паролю на фронтенде
- вход по email и паролю
- сообщение о неподтверждённом email
- повторная отправка письма подтверждения
- синхронизация `profiles` после подтверждённого входа
- Mono checkout через Supabase Edge Functions
- sync `products.json` -> `product_catalog_items`

### 13. Что уже готово для заказов и оплаты

В проекте уже есть:

1. запись заказов в `orders` и `order_items`
2. публичный catalog overlay через `product_catalog_public`
3. Mono invoice creation через Edge Function
4. Mono payment webhook для обновления payment status
5. скрипт для заливки каталога в Supabase

Дальше остаётся только применить SQL, задеплоить функции, настроить secrets и прогнать smoke test.
