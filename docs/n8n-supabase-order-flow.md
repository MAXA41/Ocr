## n8n -> Supabase Order Flow

Это схема для следующего этапа: как текущий payload заказа с сайта записывать в Supabase через `n8n`.

Если нужен короткий запуск всей цепочки по шагам, начни с [docs/n8n-launch-checklist.md](docs/n8n-launch-checklist.md).

Если нужен уже не обзор, а точная сборка по нодам с готовыми запросами и кодом, смотри [docs/n8n-supabase-workflow-guide.md](docs/n8n-supabase-workflow-guide.md).

Если хочешь сразу импортировать готовый workflow в `n8n`, используй [docs/n8n-supabase-orders-workflow.json](docs/n8n-supabase-orders-workflow.json).

Для второго этапа со сменой статуса заказа на `completed` используй [docs/n8n-supabase-completion-guide.md](docs/n8n-supabase-completion-guide.md) и [docs/n8n-supabase-complete-order-workflow.json](docs/n8n-supabase-complete-order-workflow.json).

Если хочешь вызывать завершение заказа прямо из Telegram, используй [docs/n8n-telegram-complete-order-guide.md](docs/n8n-telegram-complete-order-guide.md) и [docs/n8n-telegram-complete-order-workflow.json](docs/n8n-telegram-complete-order-workflow.json).

### Источник

Сайт уже отправляет payload заказа в webhook. Внутри есть поля:

- `customerId`
- `customerEmail`
- `authProvider`
- `name`
- `email`
- `phone`
- `city`
- `deliveryMethod`
- `deliveryMethodLabel`
- `deliveryDetails`
- `paymentMethod`
- `paymentMethodLabel`
- `comment`
- `total`
- `totalLabel`
- `cart[]`
- `orderItems`
- `createdAt`
- `source`
- `brand`

### Что должен делать workflow в n8n

1. Принять заказ из webhook.
2. Если в payload есть `customerId`, использовать его как основной источник связи.
3. Если `customerId` нет, проверить, существует ли пользователь в `profiles` по email.
4. Если пользователь найден:
   - взять `profiles.id` и записать его как `customer_id`.
5. Если пользователь не найден:
   - заказ всё равно создается,
   - `customer_id` остается `null`,
   - позже можно связать заказ с пользователем после первого входа.
6. Создать запись в `orders`.
7. Создать массив `order_items` по `cart[]`.
8. При смене статуса заказа на `completed` записать `accumulation_amount`.
9. Дать триггеру Supabase пересчитать `customer_discount_state`.

### Маппинг в таблицу orders

- `customer_id` -> `customerId` из payload или найденный `profiles.id`, иначе `null`
- `source` -> `source`
- `status` -> `new`
- `customer_name` -> `name`
- `customer_email` -> `email`
- `customer_phone` -> `phone`
- `city` -> `city`
- `delivery_method` -> `deliveryMethod`
- `delivery_method_label` -> `deliveryMethodLabel`
- `delivery_details` -> `deliveryDetails`
- `payment_method` -> `paymentMethod`
- `payment_method_label` -> `paymentMethodLabel`
- `comment` -> `comment`
- `subtotal_amount` -> `total`
- `discount_percent` -> `0`
- `discount_amount` -> `0`
- `total_amount` -> `total`
- `accumulation_amount` -> `0` на старте
- `items_summary` -> `orderItems`
- `raw_payload` -> весь JSON заказа
- `placed_at` -> `createdAt`

### Маппинг в таблицу order_items

Для каждого элемента в `cart[]`:

- `order_id` -> id созданного заказа
- `product_id` -> `id`
- `product_title` -> `title`
- `category` -> `category`
- `quantity` -> `qty`
- `unit_price` -> `price`
- `grind_method` -> `grindMethod`
- `grind_label` -> `grindLabel`
- `raw_item` -> весь item JSON

### Когда начислять накопление

Вариант, который лучше использовать:

1. При создании заказа `status = new`, `accumulation_amount = 0`.
2. Когда заказ реально выполнен, `n8n` меняет:
   - `status = completed`
   - `completed_at = now()`
   - `accumulation_amount = total_amount`
3. После этого триггер в Supabase сам пересчитает скидку.

### Что не делать

- Не начислять накопление сразу при создании заказа.
- Не считать скидку только в `n8n` без записи в Supabase.
- Не хранить только `orderItems` строкой без `order_items` таблицы.

### Следующий практический шаг

После шагов из [docs/supabase-setup.md](docs/supabase-setup.md) последовательность теперь такая:

1. импортировать workflow создания заказа по инструкции из [docs/n8n-supabase-workflow-guide.md](docs/n8n-supabase-workflow-guide.md)
2. затем импортировать workflow завершения заказа из [docs/n8n-supabase-completion-guide.md](docs/n8n-supabase-completion-guide.md)
3. затем, если нужно, подключить Telegram admin-слой из [docs/n8n-telegram-complete-order-guide.md](docs/n8n-telegram-complete-order-guide.md)
