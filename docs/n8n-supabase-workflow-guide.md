## n8n + Supabase Workflow Guide

Ниже уже не общая идея, а практический план, как собрать workflow в `n8n`, чтобы заказы с сайта попадали в `Supabase` и потом отображались в кабинете.

Если нужен короткий порядок запуска без детализации по каждой ноде, смотри [docs/n8n-launch-checklist.md](docs/n8n-launch-checklist.md).

Если хочешь не собирать руками, а сразу импортировать готовый workflow, используй [docs/n8n-supabase-orders-workflow.json](docs/n8n-supabase-orders-workflow.json).

Для второго этапа, когда заказ нужно перевести в `completed` и начислить накопление, используй [docs/n8n-supabase-completion-guide.md](docs/n8n-supabase-completion-guide.md) и [docs/n8n-supabase-complete-order-workflow.json](docs/n8n-supabase-complete-order-workflow.json).

Если хочешь запускать завершение заказа прямо из Telegram, сверху на completion-flow можно добавить [docs/n8n-telegram-complete-order-guide.md](docs/n8n-telegram-complete-order-guide.md) и [docs/n8n-telegram-complete-order-workflow.json](docs/n8n-telegram-complete-order-workflow.json).

---

## 1. Что должно быть готово заранее

Перед сборкой workflow у тебя уже должно быть:

1. выполнен SQL из [docs/supabase-schema.sql](docs/supabase-schema.sql)
2. включен email magic link в Supabase
3. сайт уже отправляет payload заказа в webhook
4. в `.env.local` уже есть `SUPABASE_SECRET_KEY`

Для ручной сборки workflow в `n8n` понадобятся минимум 2 переменные:

```text
SUPABASE_URL=https://sxxlotfbcblnjgcvxaqe.supabase.co
SUPABASE_SECRET_KEY=твій secret key
```

Secret key держим только в `n8n`, не на фронтенде.

Если используешь готовый импортируемый workflow из [docs/n8n-supabase-orders-workflow.json](docs/n8n-supabase-orders-workflow.json), подготовь сразу 5 переменных:

```text
SUPABASE_URL=https://sxxlotfbcblnjgcvxaqe.supabase.co
SUPABASE_SECRET_KEY=твій secret key
ORDER_WEBHOOK_SHARED_SECRET=той самий shared secret, що приходить із сайту
TELEGRAM_BOT_TOKEN=токен Telegram бота
TELEGRAM_CHAT_ID=id чату або групи для сповіщень
```

`ORDER_WEBHOOK_SHARED_SECRET` в workflow опционален: если не задан, проверка секрета не сработает и webhook будет принимать payload без этого сравнения.

---

## 2. Что должен делать workflow

Workflow должен:

1. принять заказ из webhook
2. определить `customer_id`
3. создать запись в `orders`
4. создать записи в `order_items`
5. отправить уведомление в Telegram

На этом этапе кабинет уже начнет показывать реальные заказы для авторизованного клиента.

---

## 3. Структура workflow

Рекомендуемая цепочка нод:

1. `Webhook`
2. `Code` -> normalize payload
3. `HTTP Request` -> find profile by `customerId`
4. `IF` -> profile found?
5. `HTTP Request` -> fallback find profile by email
6. `Code` -> resolve final customer id
7. `HTTP Request` -> insert order
8. `Code` -> prepare order items
9. `HTTP Request` -> insert order items
10. `Telegram` -> notify admin
11. `Respond to Webhook`

---

## 4. Node by node

### Node 1. Webhook

Тип:

- `Webhook`

Метод:

- `POST`

Ожидает JSON payload с сайта.

---

### Node 2. Code -> Normalize payload

Тип:

- `Code`

Код:

```javascript
const payload = $json;

return [
  {
    json: {
      payload,
      customerId: payload.customerId || null,
      email: (payload.customerEmail || payload.email || "")
        .trim()
        .toLowerCase(),
      orderStatus: "new",
      orderTotal: Number(payload.total || 0),
      cart: Array.isArray(payload.cart) ? payload.cart : [],
    },
  },
];
```

Что делает:

1. нормализует email
2. приводит total к числу
3. подготавливает cart

---

### Node 3. HTTP Request -> Find profile by customerId

Тип:

- `HTTP Request`

Метод:

- `GET`

URL:

```text
{{$env.SUPABASE_URL}}/rest/v1/profiles?id=eq.{{$json.customerId}}&select=id,email
```

Headers:

```text
apikey: {{$env.SUPABASE_SECRET_KEY}}
Authorization: Bearer {{$env.SUPABASE_SECRET_KEY}}
```

Настройка:

- `Send Query Parameters`: off, можно прямо в URL
- `Response Format`: JSON
- `Ignore Response Code`: on

Если `customerId` пустой, ответ просто будет пустой массив. Это нормально.

---

### Node 4. IF -> Profile found by customerId?

Условие:

```javascript
{
  {
    Array.isArray($json) && $json.length > 0;
  }
}
```

Если `true`, идем дальше с найденным профилем.
Если `false`, делаем поиск по email.

---

### Node 5. HTTP Request -> Find profile by email

Тип:

- `HTTP Request`

Метод:

- `GET`

URL:

```text
{{$env.SUPABASE_URL}}/rest/v1/profiles?select=id,email&email=ilike.{{$('Code -> Normalize payload').item.json.email}}
```

Headers:

```text
apikey: {{$env.SUPABASE_SECRET_KEY}}
Authorization: Bearer {{$env.SUPABASE_SECRET_KEY}}
```

Примечание:

Если email пустой, профиль не найдется. Это тоже нормально.

---

### Node 6. Code -> Resolve final customer id

Тип:

- `Code`

Код:

```javascript
const payload = $("Code -> Normalize payload").item.json.payload;

const byCustomerId =
  $("HTTP Request -> Find profile by customerId").first()?.json || [];
const byEmail = $("HTTP Request -> Find profile by email").first()?.json || [];

const customerFromId =
  Array.isArray(byCustomerId) && byCustomerId.length > 0
    ? byCustomerId[0]
    : null;
const customerFromEmail =
  Array.isArray(byEmail) && byEmail.length > 0 ? byEmail[0] : null;

const resolvedCustomer = customerFromId || customerFromEmail;

return [
  {
    json: {
      payload,
      customerId: resolvedCustomer?.id || null,
      customerEmail:
        resolvedCustomer?.email ||
        payload.customerEmail ||
        payload.email ||
        null,
    },
  },
];
```

Что делает:

1. сначала берет профиль по `customerId`
2. если его нет, ищет по email
3. возвращает финальный `customerId`

---

### Node 7. HTTP Request -> Insert order

Тип:

- `HTTP Request`

Метод:

- `POST`

URL:

```text
{{$env.SUPABASE_URL}}/rest/v1/orders
```

Headers:

```text
apikey: {{$env.SUPABASE_SECRET_KEY}}
Authorization: Bearer {{$env.SUPABASE_SECRET_KEY}}
Content-Type: application/json
Prefer: return=representation
```

Body JSON:

```json
{
  "customer_id": "={{ $json.customerId }}",
  "source": "={{ $json.payload.source || 'website' }}",
  "status": "new",
  "customer_name": "={{ $json.payload.name }}",
  "customer_email": "={{ $json.payload.email }}",
  "customer_phone": "={{ $json.payload.phone }}",
  "city": "={{ $json.payload.city || null }}",
  "delivery_method": "={{ $json.payload.deliveryMethod || null }}",
  "delivery_method_label": "={{ $json.payload.deliveryMethodLabel || null }}",
  "delivery_details": "={{ $json.payload.deliveryDetails || null }}",
  "payment_method": "={{ $json.payload.paymentMethod || null }}",
  "payment_method_label": "={{ $json.payload.paymentMethodLabel || null }}",
  "comment": "={{ $json.payload.comment || null }}",
  "subtotal_amount": "={{ Number($json.payload.total || 0) }}",
  "discount_percent": 0,
  "discount_amount": 0,
  "total_amount": "={{ Number($json.payload.total || 0) }}",
  "accumulation_amount": 0,
  "items_summary": "={{ $json.payload.orderItems || null }}",
  "raw_payload": "={{ $json.payload }}",
  "placed_at": "={{ $json.payload.createdAt || new Date().toISOString() }}"
}
```

Важно:

`Prefer: return=representation` нужен, чтобы сразу получить `id` созданного заказа.

---

### Node 8. Code -> Prepare order items

Тип:

- `Code`

Код:

```javascript
const payload = $("Code -> Resolve final customer id").item.json.payload;
const orderResponse = $json;
const createdOrder = Array.isArray(orderResponse)
  ? orderResponse[0]
  : orderResponse;

const orderId = createdOrder.id;
const cart = Array.isArray(payload.cart) ? payload.cart : [];

return cart.map((item) => ({
  json: {
    order_id: orderId,
    product_id: item.id || null,
    product_title: item.title,
    category: item.category || null,
    quantity: Number(item.qty || 0),
    unit_price: Number(item.price || 0),
    grind_method: item.grindMethod || null,
    grind_label: item.grindLabel || null,
    raw_item: item,
  },
}));
```

---

### Node 9. HTTP Request -> Insert order items

Тип:

- `HTTP Request`

Метод:

- `POST`

URL:

```text
{{$env.SUPABASE_URL}}/rest/v1/order_items
```

Headers:

```text
apikey: {{$env.SUPABASE_SECRET_KEY}}
Authorization: Bearer {{$env.SUPABASE_SECRET_KEY}}
Content-Type: application/json
Prefer: return=minimal
```

Body:

Можно отправлять по одному item из текущего input.

Body JSON:

```json
{
  "order_id": "={{ $json.order_id }}",
  "product_id": "={{ $json.product_id }}",
  "product_title": "={{ $json.product_title }}",
  "category": "={{ $json.category }}",
  "quantity": "={{ $json.quantity }}",
  "unit_price": "={{ $json.unit_price }}",
  "grind_method": "={{ $json.grind_method }}",
  "grind_label": "={{ $json.grind_label }}",
  "raw_item": "={{ $json.raw_item }}"
}
```

---

### Node 10. Telegram -> Notify admin

Отправляй краткое сообщение:

```text
Нове замовлення

Клієнт: {{$('Code -> Resolve final customer id').item.json.payload.name}}
Email: {{$('Code -> Resolve final customer id').item.json.payload.email}}
Телефон: {{$('Code -> Resolve final customer id').item.json.payload.phone}}
Сума: {{$('Code -> Resolve final customer id').item.json.payload.total}} грн
Доставка: {{$('Code -> Resolve final customer id').item.json.payload.deliveryMethodLabel}}
Деталі: {{$('Code -> Resolve final customer id').item.json.payload.deliveryDetails}}
```

---

### Node 11. Respond to Webhook

Верни простой JSON:

```json
{
  "ok": true,
  "message": "Order accepted"
}
```

---

## 5. Как потом начислять накопление

Это уже второй workflow.

Он должен запускаться, когда ты меняешь статус заказа на `completed`.

Что он делает:

1. обновляет `orders.status = completed`
2. ставит `completed_at = now()`
3. ставит `accumulation_amount = total_amount`

После этого триггер из Supabase сам пересчитает `customer_discount_state`.

---

## 6. Почему это уже рабочий этап

После сборки этого workflow у тебя будет:

1. заказ уходит с сайта
2. `n8n` пишет его в `Supabase`
3. кабинет начинает видеть заказы
4. потом достаточно добавить смену статуса на `completed`, чтобы ожили скидки

---

## 7. Что делать следующим шагом

После этого я предлагаю делать уже точечно:

1. workflow смены статуса заказа из Telegram
2. автоматическое начисление накопления
3. подтягивание реальных заказов в кабинет без пустых блоков
