## Telegram Bot Setup

Это отдельная практическая инструкция для твоей части по Telegram: как создать бота, получить `chat id`, подключить webhook к `n8n` и проверить, что updates реально доходят.

---

## 1. Создать Telegram бота

1. Открой BotFather в Telegram.
2. Отправь команду `/newbot`.
3. Укажи имя бота.
4. Укажи username бота, который заканчивается на `bot`.
5. Сохрани токен, который вернет BotFather.

Это значение пойдет в переменную:

```text
TELEGRAM_BOT_TOKEN
```

---

## 2. Подготовить чат для менеджера

Нужно решить, где менеджер будет работать с ботом:

1. личный чат с ботом
2. группа
3. супергруппа

Для простого старта лучше использовать личный чат или отдельную группу только для менеджера.

---

## 3. Получить chat id

Есть 2 надежных способа.

### Вариант A. Через getUpdates

1. Напиши боту любое сообщение из нужного чата.
2. Если это группа, добавь туда бота и тоже отправь сообщение.
3. Открой в браузере или через запрос:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
```

4. Найди в ответе поле:

```json
"chat": {
  "id": 123456789
}
```

или для группы:

```json
"chat": {
  "id": -100987654321
}
```

5. Это значение и есть нужный `chat id`.

Используй его в:

```text
TELEGRAM_CHAT_ID
TELEGRAM_ADMIN_CHAT_ID
```

### Вариант B. Через временный webhook в n8n

Если `getUpdates` неудобен, можно временно подключить Telegram webhook к workflow и посмотреть `chat.id` прямо в execution payload.

Но для первого старта `getUpdates` обычно быстрее.

---

## 4. Важное ограничение Telegram

У одного Telegram бота может быть только один активный webhook.

Это значит:

1. нельзя делать несколько разных Telegram webhook URL одновременно
2. все команды менеджера должны идти через один bot webhook
3. именно поэтому в проекте Telegram admin команды собраны в одном workflow

---

## 5. Импортировать Telegram workflow

Импортируй workflow:

[docs/n8n-telegram-complete-order-workflow.json](docs/n8n-telegram-complete-order-workflow.json)

После импорта открой webhook node `Telegram Admin Webhook` и скопируй production URL.

Тебе также понадобятся переменные:

```text
TELEGRAM_BOT_TOKEN=токен бота
TELEGRAM_ADMIN_CHAT_ID=id дозволеного чату або список через кому
SUPABASE_URL=https://sxxlotfbcblnjgcvxaqe.supabase.co
SUPABASE_SECRET_KEY=твій secret key
ORDER_COMPLETION_WEBHOOK_URL=production URL completion workflow
ORDER_ADMIN_SHARED_SECRET=secret для completion workflow
```

---

## 6. Подключить webhook к Telegram

Когда production URL webhook ноды уже известен, вызови:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<N8N_TELEGRAM_WEBHOOK_URL>
```

Где `<N8N_TELEGRAM_WEBHOOK_URL>` это production URL из `n8n`.

Если все хорошо, Telegram вернет примерно такой ответ:

```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

---

## 7. Проверить, что webhook действительно установлен

Сделай запрос:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo
```

Проверь:

1. `url` совпадает с production webhook URL из `n8n`
2. `last_error_message` пустой
3. `pending_update_count` не растет бесконечно

Если в `last_error_message` есть ошибка, Telegram не может достучаться до твоего `n8n`.

---

## 8. Что делать, если раньше уже был другой webhook

Если бот уже использовался раньше, сначала можно сбросить старый webhook:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook
```

Потом снова вызвать `setWebhook`.

---

## 9. Как проверить, что updates доходят в n8n

После установки webhook:

1. активируй Telegram admin workflow в `n8n`
2. отправь боту `/help`
3. открой executions в `n8n`
4. найди запуск workflow `Telegram Admin Webhook`
5. проверь, что внутри payload есть `message.text`
6. проверь, что `chat.id` совпадает с тем, что ты добавил в `TELEGRAM_ADMIN_CHAT_ID`

Если execution не появляется вообще, значит Telegram не может достучаться до webhook URL.

---

## 10. Быстрый тест после подключения

Отправь команды:

```text
/help
/orders
```

Потом, когда уже есть хотя бы один тестовый заказ:

```text
/complete 1
```

Ожидаемое поведение:

1. `/help` возвращает список команд
2. `/orders` возвращает открытые заказы
3. `/complete 1` вызывает completion workflow и возвращает результат в чат

---

## 11. Частые причины проблем

1. В `TELEGRAM_ADMIN_CHAT_ID` указан не тот chat id.
2. У бота уже был другой webhook.
3. В `n8n` используется test URL вместо production URL.
4. Workflow в `n8n` не активирован.
5. `n8n` недоступен снаружи по HTTPS.
6. У completion workflow неправильный `ORDER_ADMIN_SHARED_SECRET`.

---

## 12. Что использовать дальше

Общий запуск всей схемы: [docs/n8n-launch-checklist.md](docs/n8n-launch-checklist.md)

Команды менеджера в Telegram: [docs/n8n-telegram-complete-order-guide.md](docs/n8n-telegram-complete-order-guide.md)
