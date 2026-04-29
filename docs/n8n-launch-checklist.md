## n8n Launch Checklist

Это короткий практический чеклист, в каком порядке поднимать workflow, чтобы вся схема заработала без разрывов:

1. прием нового заказа с сайта
2. запись заказа в Supabase
3. завершение заказа с начислением накопления
4. Telegram-команды менеджера для списка и завершения заказов

---

## 1. Что должно быть готово до n8n

Перед запуском workflow проверь:

1. SQL из [docs/supabase-schema.sql](docs/supabase-schema.sql) уже выполнен
2. magic link auth в Supabase уже включен
3. сайт уже отправляет актуальный order payload
4. у тебя есть `SUPABASE_SECRET_KEY`
5. у тебя есть Telegram bot token
6. у тебя есть id Telegram-чата менеджера

Если Telegram часть еще не настроена, сначала пройди [docs/telegram-bot-setup.md](docs/telegram-bot-setup.md).

---

## 2. Какие env подготовить в n8n

Минимальный набор переменных:

```text
SUPABASE_URL=https://sxxlotfbcblnjgcvxaqe.supabase.co
SUPABASE_SECRET_KEY=твій secret key
ORDER_WEBHOOK_SHARED_SECRET=shared secret з фронтенду
ORDER_ADMIN_SHARED_SECRET=окремий secret для admin-дій
TELEGRAM_BOT_TOKEN=токен Telegram бота
TELEGRAM_CHAT_ID=id чату для сповіщень про нові та завершені замовлення
TELEGRAM_ADMIN_CHAT_ID=id чату, де дозволені admin-команди
ORDER_COMPLETION_WEBHOOK_URL=production URL completion workflow
```

Если `TELEGRAM_CHAT_ID` и `TELEGRAM_ADMIN_CHAT_ID` у тебя один и тот же, можно использовать одно и то же значение.

---

## 3. Импорт workflow по порядку

Импортируй workflow именно в таком порядке:

1. [docs/n8n-supabase-orders-workflow.json](docs/n8n-supabase-orders-workflow.json)
2. [docs/n8n-supabase-complete-order-workflow.json](docs/n8n-supabase-complete-order-workflow.json)
3. [docs/n8n-telegram-complete-order-workflow.json](docs/n8n-telegram-complete-order-workflow.json)

Почему именно так:

1. сначала должен заработать прием и запись заказа
2. потом должен появиться endpoint завершения заказа
3. только после этого есть смысл подключать Telegram-команду, потому что она вызывает completion endpoint

---

## 4. Проверка первого workflow

Workflow: [docs/n8n-supabase-orders-workflow.json](docs/n8n-supabase-orders-workflow.json)

Что проверить:

1. webhook опубликован
2. сайт отправляет payload именно на этот URL
3. в `Supabase` после тестового заказа появилась строка в `orders`
4. в `Supabase` появились строки в `order_items`
5. в Telegram пришло уведомление о новом заказе

Если это не работает, дальше идти не надо. Сначала нужно добить первый этап.

---

## 5. Проверка второго workflow

Workflow: [docs/n8n-supabase-complete-order-workflow.json](docs/n8n-supabase-complete-order-workflow.json)

Сначала протестируй его вручную через `POST` по webhook URL.

Тестовый body:

```json
{
  "orderNumber": 1,
  "adminSecret": "YOUR_ORDER_ADMIN_SHARED_SECRET"
}
```

Что должно произойти:

1. у заказа `status` меняется на `completed`
2. заполняется `completed_at`
3. `accumulation_amount` становится равным `total_amount`
4. в `customer_discount_state` обновляется накопление клиента
5. в Telegram приходит уведомление о завершении заказа

---

## 6. Проверка третьего workflow

Workflow: [docs/n8n-telegram-complete-order-workflow.json](docs/n8n-telegram-complete-order-workflow.json)

После импорта этого workflow нужно один раз подключить Telegram webhook.

Формат запроса:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<N8N_TELEGRAM_WEBHOOK_URL>
```

Где `<N8N_TELEGRAM_WEBHOOK_URL>` это production URL webhook ноды `Telegram Admin Webhook`.

Потом протестируй в Telegram:

```text
/help
/orders
/complete 1
```

Что должно произойти:

1. бот отвечает help-сообщением на `/help`
2. бот показывает список открытых заказов на `/orders`
3. бот принимает `/complete 1`
4. completion workflow вызывается автоматически
5. заказ закрывается
6. бот пишет результат обратно в чат

---

## 7. Что проверить на сайте после запуска

После того как все три workflow работают:

1. оформи тестовый заказ с авторизованного аккаунта
2. проверь, что заказ появился в таблице `orders` с правильным `customer_id`
3. закрой его через Telegram-команду
4. открой кабинет пользователя
5. проверь, что история заказа отображается
6. проверь, что накопление и текущая скидка обновились

---

## 8. Где смотреть, если что-то сломалось

Если что-то не работает, проверяй в таком порядке:

1. executions в `n8n`
2. response body у `HTTP Request` нод
3. данные в таблицах `orders`, `order_items`, `customer_discount_state`
4. правильность env-переменных
5. совпадение `shared secret`

---

## 9. Связанные инструкции

Подробная сборка order workflow: [docs/n8n-supabase-workflow-guide.md](docs/n8n-supabase-workflow-guide.md)

Подробная сборка completion workflow: [docs/n8n-supabase-completion-guide.md](docs/n8n-supabase-completion-guide.md)

Подробная сборка Telegram admin workflow: [docs/n8n-telegram-complete-order-guide.md](docs/n8n-telegram-complete-order-guide.md)

Отдельная настройка Telegram bot и webhook: [docs/telegram-bot-setup.md](docs/telegram-bot-setup.md)
