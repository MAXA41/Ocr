# n8n схема для заказов Odesa Coffee Roasters

## Что уже отправляет сайт

Фронтенд отправляет в резервный webhook JSON такого вида:

```json
{
  "name": "Ім'я клієнта",
  "email": "client@example.com",
  "phone": "+380991112233",
  "city": "Одеса",
  "deliveryMethod": "nova-branch",
  "deliveryMethodLabel": "Нова Пошта: відділення",
  "deliveryDetails": "Відділення №7",
  "paymentMethod": "card-transfer",
  "paymentMethodLabel": "Переказ на картку",
  "comment": "Подзвонити перед відправкою",
  "total": 1560,
  "totalLabel": "1560 грн",
  "cart": [
    {
      "id": "kenya-wanrich-aa",
      "title": "Kenya Wanrich AA",
      "category": "espresso",
      "price": 810,
      "qty": 1,
      "grindMethod": "filter",
      "grindLabel": "Помол під фільтр"
    }
  ],
  "orderItems": "Kenya Wanrich AA x1 - 810 грн, Rwanda Fuci x1 - 750 грн",
  "createdAt": "2026-04-08T12:00:00.000Z",
  "source": "website",
  "brand": "Odesa Coffee Roasters",
  "deliveryChannel": "fallback-webhook",
  "sharedSecret": "replace_with_long_random_string"
}
```

## Рекомендуемая схема в n8n

1. `Webhook`
2. `IF` или `Code` для базовой валидации данных
3. `Set` или `Code` для сборки красивого текста заказа
4. `Telegram` или `HTTP Request` в Telegram Bot API
5. `Email` или `SMTP` как второй канал
6. `Respond to Webhook`

## Логика потока

### 1. Webhook

Параметры:

- Method: `POST`
- Path: `ocr-orders`
- Response mode: `Using Respond to Webhook`

После публикации workflow ты получишь Production URL вида:

```text
https://YOUR-N8N-DOMAIN/webhook/ocr-orders
```

Его нужно вставить в `.env.local` в поле `VITE_ORDER_FALLBACK_WEBHOOK_URL`.

### 2. Проверка данных

Минимум проверь:

- `name`
- `phone`
- `address`
- `cart`

Пример для `IF`:

- `{{$json.name}}` `is not empty`
- `{{$json.phone}}` `is not empty`
- `{{$json.address}}` `is not empty`

Если проверка не прошла:

- сразу вернуть `400`
- текст ответа: `Invalid order payload`

### 3. Формирование текста заказа

Удобнее всего сделать в `Set` или `Code`.

Пример текста для Telegram:

```text
Нове замовлення з сайту Odesa Coffee Roasters

Клієнт: {{$json.name}}
Email: {{$json.email}}
Телефон: {{$json.phone}}
Місто: {{$json.city}}
Доставка: {{$json.deliveryMethodLabel}}
Деталі доставки: {{$json.deliveryDetails}}
Оплата: {{$json.paymentMethodLabel}}
Коментар: {{$json.comment}}
Сума: {{$json.totalLabel}}

Товари:
{{$json.orderItems}}

Дата: {{$json.createdAt}}
Канал: {{$json.deliveryChannel}}
```

Если хочешь красивее, собери список из массива `cart` через `Code` node.

Пример JavaScript для `Code` node:

```javascript
const incoming =
  $json.body && typeof $json.body === "object" ? $json.body : $json;
const order =
  incoming.data && typeof incoming.data === "object" ? incoming.data : incoming;
const expectedSharedSecret = "REPLACE_WITH_SHARED_SECRET";
const sharedSecretValid =
  Boolean(order.sharedSecret) && order.sharedSecret === expectedSharedSecret;
const items = (order.cart || [])
  .map(
    (item) =>
      `- ${item.title} (${item.grindLabel || item.grindMethod || "без уточнення"}) x${item.qty} = ${item.price * item.qty} грн`,
  )
  .join("\n");

return [
  {
    json: {
      ...order,
      valid: sharedSecretValid,
      validationMessage: sharedSecretValid ? "ok" : "Invalid shared secret",
      telegramText: [
        "Нове замовлення з сайту Odesa Coffee Roasters",
        "",
        `Клієнт: ${order.name || "-"}`,
        `Email: ${order.email || "-"}`,
        `Телефон: ${order.phone || "-"}`,
        `Місто: ${order.city || "-"}`,
        `Доставка: ${order.deliveryMethodLabel || order.deliveryMethod || "-"}`,
        `Деталі доставки: ${order.deliveryDetails || "-"}`,
        `Оплата: ${order.paymentMethodLabel || order.paymentMethod || "-"}`,
        `Коментар: ${order.comment || "-"}`,
        `Сума: ${order.totalLabel || `${order.total} грн`}`,
        "",
        "Товари:",
        items || "-",
        "",
        `Дата: ${order.createdAt || "-"}`,
        `Канал: ${order.deliveryChannel || "webhook"}`,
      ].join("\n"),
    },
  },
];
```

### 4. Отправка в Telegram

Есть два нормальных способа.

Вариант A: через `Telegram` node

- Credentials: Telegram Bot
- Operation: `Send Message`
- Chat ID: твой chat id или id группы
- Text: `{{$json.telegramText}}`

Вариант B: через `HTTP Request`

- Method: `POST`
- URL:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage
```

- Body Content Type: `JSON`
- JSON body:

```json
{
  "chat_id": "<TELEGRAM_CHAT_ID>",
  "text": "={{$json.telegramText}}"
}
```

Если отправляешь в группу, сначала добавь туда бота и выдай ему право писать сообщения.

### 5. Дублирование на email

Самый простой путь в n8n:

- `Email Send`
- или `Gmail`
- или `SMTP`

Рекомендация по теме письма:

```text
Нове замовлення OCR на {{$json.totalLabel}}
```

Рекомендация по телу письма:

- используй тот же `telegramText`
- или HTML-таблицу по массиву `cart`

### 6. Ответ сайту

В `Respond to Webhook` верни JSON:

```json
{
  "ok": true,
  "message": "Order accepted"
}
```

HTTP status: `200`

Это нужно, чтобы сайт считал резервную отправку успешной.

## Практический workflow без лишней сложности

Минимальная рабочая цепочка:

1. `Webhook`
2. `Code`
3. `Telegram`
4. `Respond to Webhook`

Более надежная цепочка:

1. `Webhook`
2. `IF`
3. `Code`
4. `Telegram`
5. `Email Send`
6. `Respond to Webhook`

## Что вписать на стороне сайта

В `.env.local`:

```env
VITE_ORDER_FALLBACK_WEBHOOK_URL=https://YOUR-N8N-DOMAIN/webhook/ocr-orders
VITE_ORDER_DUPLICATE_TO_WEBHOOK=true
VITE_ORDER_WEBHOOK_SHARED_SECRET=replace_with_long_random_string
```

Режимы:

- `true`: отправлять в n8n всегда, даже если Web3Forms сработал
- `false`: использовать n8n только как резервный канал, когда основной провайдер не ответил

## Что лучше сделать для безопасности

1. Используй production webhook URL, не test URL.
2. Добавь простой shared secret, если workflow будет доступен извне.
3. Ограничь rate limit на уровне reverse proxy, если n8n открыт в интернет.
4. Не храни Telegram bot token во фронтенде. Только внутри n8n credentials.

## Shared secret

Сейчас проект уже поддерживает простую проверку shared secret.

Что нужно сделать:

1. В сайте задать `VITE_ORDER_WEBHOOK_SHARED_SECRET` в `.env.local`.
2. В n8n в `Code` node заменить `REPLACE_WITH_SHARED_SECRET` на то же значение.
3. После этого отклонять запросы, где `sharedSecret` не совпадает.

Важно:

1. Для статического фронтенда это не полноценная защита, потому что значение попадает в клиентский бандл.
2. Это хороший базовый фильтр от случайных и мусорных запросов, но не замена backend-подписи.
3. Для более сильной защиты нужен серверный посредник или подписанный HMAC, который считается не в браузере.

## Что могу сделать следующим шагом

1. Подготовить готовый JSON workflow для импорта в n8n.
2. Добавить shared secret между сайтом и n8n.
3. Сделать форматирование Telegram-сообщения более аккуратным для менеджера.
