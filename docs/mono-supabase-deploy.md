## Mono + Supabase Deploy

Ниже короткий порядок, чтобы включить карточную оплату через Mono без ручного поиска по файлам.

### 1. Подготовить Supabase secrets

В Supabase CLI или в dashboard задай secrets:

```bash
supabase secrets set \
  SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
  MONO_MERCHANT_TOKEN=YOUR_MONO_TOKEN \
  PUBLIC_SITE_URL=https://odesacoffeeroasters.info
```

Нужны именно эти значения:

1. `SUPABASE_URL` для admin client внутри Edge Functions
2. `SUPABASE_SERVICE_ROLE_KEY` для записи в `orders`, `order_items` и обновления payment status
3. `MONO_MERCHANT_TOKEN` для запроса invoice в Mono
4. `PUBLIC_SITE_URL` для redirect после оплаты

### 2. Применить SQL-схему

Выполни [docs/supabase-schema.sql](docs/supabase-schema.sql) в Supabase SQL Editor.

После этого проверь, что есть:

1. `orders` с payment-полями
2. `product_catalog_items`
3. `product_catalog_state`
4. view `product_catalog_public`

### 3. Залить каталог в Supabase

Из корня проекта запусти:

```bash
npm run supabase:sync-products
```

Скрипт читает [products.json](products.json) и upsert-ит записи в `product_catalog_items`.

### 4. Задеплоить Edge Functions

Из корня проекта:

```bash
npm run supabase:functions:deploy:mono
```

Если нужен раздельный деплой:

```bash
npm run supabase:functions:deploy:mono-create
npm run supabase:functions:deploy:mono-webhook
```

Файлы функций:

1. [supabase/functions/mono-create-invoice/index.ts](supabase/functions/mono-create-invoice/index.ts)
2. [supabase/functions/mono-payment-webhook/index.ts](supabase/functions/mono-payment-webhook/index.ts)

### 5. Что делает каждая функция

`mono-create-invoice`:

1. принимает checkout payload с фронтенда
2. валидирует товары по `product_catalog_public`
3. создаёт заказ в `orders`
4. создаёт позиции в `order_items`
5. создаёт invoice в Mono
6. возвращает hosted payment URL

`mono-payment-webhook`:

1. принимает webhook от Mono
2. ищет заказ по `mono_invoice_id`, `payment_reference` или `order_number`
3. обновляет `payment_status`
4. при успешной оплате переводит `orders.status` в `paid`

### 6. Что должно быть на фронтенде

Фронтенд уже готов:

1. payment method `mono-card` добавлен в checkout
2. [js/site.js](js/site.js) вызывает `mono-create-invoice`
3. клиент уходит на hosted payment page Mono
4. карта не вводится на сайте

### 7. Smoke test

Минимальная проверка после деплоя:

1. открыть сайт
2. добавить товар в корзину
3. выбрать `Оплата карткою Mono`
4. отправить checkout
5. убедиться, что браузер ушёл на `paymentUrl` от Mono
6. проверить новую запись в `orders`
7. проверить новые строки в `order_items`
8. после webhook убедиться, что `payment_status` обновился

### 8. Если что-то ломается

Смотри по слоям:

1. ошибка до redirect: проблема в `mono-create-invoice`
2. invoice создался, но status не меняется: проблема в `mono-payment-webhook`
3. товара нет в заказе: сначала проверь `npm run supabase:sync-products`
4. redirect неверный: проверь `PUBLIC_SITE_URL`
