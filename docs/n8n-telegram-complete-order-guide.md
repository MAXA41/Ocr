## Telegram Admin Commands

Этот workflow нужен, если ты хочешь управлять заказами прямо из Telegram: смотреть открытые заказы и завершать их командами менеджера.

Если хочешь видеть полный порядок запуска всех workflow, смотри [docs/n8n-launch-checklist.md](docs/n8n-launch-checklist.md).

Если нужна отдельная инструкция именно по Telegram bot setup, смотри [docs/telegram-bot-setup.md](docs/telegram-bot-setup.md).

Логика такая:

1. Telegram присылает update в webhook `n8n`
2. `n8n` читает команды `/orders`, `/new`, `/neworders`, `/complete 154`
3. для списка заказов workflow читает открытые заказы из Supabase
4. для завершения workflow вызывает уже готовый completion webhook
5. заказ переводится в `completed`
6. Supabase trigger пересчитывает накопительную скидку
7. бот отвечает менеджеру результатом прямо в чат

---

## Готовый workflow

Импортируй [docs/n8n-telegram-complete-order-workflow.json](docs/n8n-telegram-complete-order-workflow.json) в `n8n`.

Этот workflow не дублирует бизнес-логику завершения заказа, а использует уже готовый endpoint из [docs/n8n-supabase-completion-guide.md](docs/n8n-supabase-completion-guide.md). При этом список открытых заказов он читает напрямую из Supabase через тот же bot webhook.

---

## Какие env нужны

```text
TELEGRAM_BOT_TOKEN=токен Telegram бота
TELEGRAM_ADMIN_CHAT_ID=id дозволеного чату або список через кому
ORDER_COMPLETION_WEBHOOK_URL=production URL workflow завершення замовлення
ORDER_ADMIN_SHARED_SECRET=той самий secret, який чекає completion workflow
SUPABASE_URL=https://sxxlotfbcblnjgcvxaqe.supabase.co
SUPABASE_SECRET_KEY=твій secret key
```

Пример:

```text
TELEGRAM_ADMIN_CHAT_ID=123456789,-100987654321
```

Это позволит принимать команды только из конкретных чатов.

---

## Какие команды поддерживаются

Поддерживаются:

```text
/help
/start
/orders
/new
/neworders
/complete 154
/complete 550e8400-e29b-41d4-a716-446655440000
```

`/orders`, `/new` и `/neworders` возвращают список открытых заказов.

`/complete` можно использовать либо с `orderNumber`, либо с `orderId`.

---

## Как подключить Telegram webhook

Подробная инструкция по получению `chat id`, установке webhook и проверке `getWebhookInfo` есть в [docs/telegram-bot-setup.md](docs/telegram-bot-setup.md).

После импорта workflow у тебя будет webhook path:

```text
ocr-telegram-admin
```

Дальше нужно один раз сказать Telegram, куда слать обновления бота.

Запрос:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<N8N_WEBHOOK_URL>
```

Где `<N8N_WEBHOOK_URL>` это production URL webhook ноды `Telegram Admin Webhook`.

---

## Что делает workflow

1. принимает webhook update от Telegram
2. читает `message.text`
3. проверяет, что chat id входит в `TELEGRAM_ADMIN_CHAT_ID`
4. если команда относится к списку заказов, загружает открытые заказы из Supabase
5. если команда относится к завершению, вызывает completion webhook
6. если команда не распознана, отправляет help
7. возвращает ответ менеджеру в этот же Telegram чат

---

## Почему такой вариант лучше

Этот подход лучше, чем плодить несколько Telegram webhook workflow, потому что:

1. вся логика завершения заказа остается в одном месте
2. у Telegram бота остается один стабильный webhook
3. Telegram workflow остается тонким управляющим слоем
4. меньше риск, что разные workflow разойдутся по поведению

---

## Рекомендуемая последовательность

1. сначала импортировать [docs/n8n-supabase-complete-order-workflow.json](docs/n8n-supabase-complete-order-workflow.json)
2. проверить completion webhook вручную
3. потом импортировать [docs/n8n-telegram-complete-order-workflow.json](docs/n8n-telegram-complete-order-workflow.json)
4. подключить Telegram webhook через `setWebhook`
5. протестировать команду `/orders`
6. протестировать команду `/complete 123`
