## n8n Cloud Free Setup

Если в `Settings -> Environments` у тебя показано `Available on the Enterprise plan`, не используй базовые workflow с `$env`.

Для такого случая в проект добавлены отдельные cloud-friendly файлы:

1. [docs/n8n-supabase-orders-workflow-cloud.json](docs/n8n-supabase-orders-workflow-cloud.json)
2. [docs/n8n-supabase-complete-order-workflow-cloud.json](docs/n8n-supabase-complete-order-workflow-cloud.json)
3. [docs/n8n-telegram-complete-order-workflow-cloud.json](docs/n8n-telegram-complete-order-workflow-cloud.json)

В них вместо `Environments` используется node `Workflow Config`.

---

## Что делать после импорта

После импорта каждого workflow:

1. открой node `Workflow Config`
2. нажми `Execute step`, если `n8n` просит сначала выполнить node
3. замени значения вида `PASTE_..._HERE` на свои реальные данные
4. сохрани workflow

---

## Что куда вставлять

### Order workflow

Файл: [docs/n8n-supabase-orders-workflow-cloud.json](docs/n8n-supabase-orders-workflow-cloud.json)

Заполни в `Workflow Config`:

```text
ORDER_WEBHOOK_SHARED_SECRET
SUPABASE_URL
SUPABASE_SECRET_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

### Completion workflow

Файл: [docs/n8n-supabase-complete-order-workflow-cloud.json](docs/n8n-supabase-complete-order-workflow-cloud.json)

Заполни в `Workflow Config`:

```text
ORDER_ADMIN_SHARED_SECRET
SUPABASE_URL
SUPABASE_SECRET_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

### Telegram workflow

Файл: [docs/n8n-telegram-complete-order-workflow-cloud.json](docs/n8n-telegram-complete-order-workflow-cloud.json)

Заполни в `Workflow Config`:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_ADMIN_CHAT_ID
ORDER_COMPLETION_WEBHOOK_URL
ORDER_ADMIN_SHARED_SECRET
SUPABASE_URL
SUPABASE_SECRET_KEY
```

---

## В каком порядке импортировать

1. [docs/n8n-supabase-orders-workflow-cloud.json](docs/n8n-supabase-orders-workflow-cloud.json)
2. [docs/n8n-supabase-complete-order-workflow-cloud.json](docs/n8n-supabase-complete-order-workflow-cloud.json)
3. [docs/n8n-telegram-complete-order-workflow-cloud.json](docs/n8n-telegram-complete-order-workflow-cloud.json)

После этого:

1. скопируй `Production URL` из `Complete Order Webhook`
2. вставь его в `ORDER_COMPLETION_WEBHOOK_URL` внутри Telegram workflow
3. скопируй `Production URL` из `Telegram Admin Webhook`
4. вызови `setWebhook` у Telegram бота на этот URL

---

## Что проверять

1. `/help` отвечает в Telegram
2. `/orders` показывает открытые заказы
3. `/complete 1` вызывает completion workflow

Если Telegram не отвечает, проверь сначала:

1. workflow активирован
2. используется именно `Production URL`
3. `TELEGRAM_ADMIN_CHAT_ID` заполнен правильным chat id
4. `ORDER_COMPLETION_WEBHOOK_URL` указывает на completion workflow, а не на Telegram workflow