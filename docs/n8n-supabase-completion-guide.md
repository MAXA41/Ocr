## n8n Order Completion Workflow

Этот workflow нужен для второго этапа: не принять новый заказ, а перевести уже существующий заказ в статус `completed`.

Именно этот шаг запускает реальное накопление, потому что в таблице `orders` обновляются:

1. `status = completed`
2. `completed_at = now()`
3. `accumulation_amount = total_amount`

После этого trigger в Supabase сам пересчитывает `customer_discount_state`.

---

## Готовый workflow

Импортируй [docs/n8n-supabase-complete-order-workflow.json](docs/n8n-supabase-complete-order-workflow.json) в `n8n`.

Если хочешь вызывать этот workflow не вручную, а прямо из Telegram-команды менеджера, следующий слой описан в [docs/n8n-telegram-complete-order-guide.md](docs/n8n-telegram-complete-order-guide.md) и [docs/n8n-telegram-complete-order-workflow.json](docs/n8n-telegram-complete-order-workflow.json).

---

## Какие env нужны

Для этого workflow нужны:

```text
SUPABASE_URL=https://sxxlotfbcblnjgcvxaqe.supabase.co
SUPABASE_SECRET_KEY=твій secret key
ORDER_ADMIN_SHARED_SECRET=окремий server-side secret тільки для адмінських дій
TELEGRAM_BOT_TOKEN=токен Telegram бота
TELEGRAM_CHAT_ID=id чату або групи для сповіщень
```

Важно:

`ORDER_ADMIN_SHARED_SECRET` должен быть отдельным секретом и не должен совпадать с фронтенд-переменными вида `VITE_*`.

---

## Что принимает webhook

Webhook принимает `POST` JSON с одним из идентификаторов заказа:

```json
{
  "orderId": "uuid-заказа",
  "adminSecret": "server-side-secret"
}
```

или:

```json
{
  "orderNumber": 123,
  "adminSecret": "server-side-secret"
}
```

Можно передавать либо `orderId`, либо `orderNumber`.

---

## Что делает workflow

1. валидирует `adminSecret`
2. ищет заказ по `orderId`
3. если `orderId` не дал результата, ищет по `orderNumber`
4. проверяет текущий статус заказа
5. если заказ уже `completed`, возвращает успешный ответ без повторного обновления
6. если заказ в `canceled` или `refunded`, возвращает `409`
7. если заказ можно завершить, обновляет запись в `orders`
8. отправляет уведомление в Telegram

---

## Почему это важно для скидок

В твоей SQL-схеме скидка считается не по всем заказам подряд, а только по тем, где:

1. `status = completed`
2. `accumulation_amount` больше нуля

Значит логика такая:

1. клиент оформил заказ -> заказ создается как `new`
2. ты реально выполнил заказ -> этот workflow переводит его в `completed`
3. Supabase trigger пересчитывает накопление и текущий discount tier

---

## Что делать после импорта

1. импортировать [docs/n8n-supabase-complete-order-workflow.json](docs/n8n-supabase-complete-order-workflow.json)
2. заполнить env-переменные в `n8n`
3. протестировать webhook на одном заказе
4. проверить в Supabase, что у заказа обновились `status`, `completed_at`, `accumulation_amount`
5. проверить, что у клиента обновилась строка в `customer_discount_state`
6. при необходимости подключить Telegram admin-команду через [docs/n8n-telegram-complete-order-guide.md](docs/n8n-telegram-complete-order-guide.md)
