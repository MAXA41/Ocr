# Система логирования аудита с Telegram уведомлениями

## 📋 Что было установлено

### 1. Таблица `audit_logs`
Автоматически логирует все изменения в:
- `product_catalog_items` (каталог товаров)
- `product_price_overrides` (цены)
- `orders` (заказы)

**Структура логов:**
```
- id: UUID
- user_id: ID пользователя (администратор)
- user_email: Email администратора
- action: INSERT, UPDATE или DELETE
- table_name: название таблицы
- record_id: ID измененной записи
- record_name: дружеское имя (название товара, номер заказа)
- old_data: JSONB - старые значения
- new_data: JSONB - новые значения
- changes: человекочитаемое описание изменений
- created_at: время изменения
```

### 2. Автоматические триггеры
На каждой таблице установлены триггеры, которые:
- ✅ Автоматически записывают изменения
- ✅ Сохраняют старые и новые значения
- ✅ Генерируют человекочитаемое описание
- ✅ Захватывают ID и email администратора

### 3. Edge Function для Telegram
Функция `telegram-audit-logger` отправляет уведомления в Telegram при каждом изменении.

## 🔧 Как настроить Telegram интеграцию

### Шаг 1: Получите данные

Используемые данные:
- **Bot Token**: `9179345540:AAFkEwDYsBIbCFwrSFRairVYOW0J3Rm8uH0`
- **Chat ID**: `-5495908125`

### Шаг 2: Добавьте в Supabase Secrets

1. Откройте Supabase Dashboard
2. Перейдите: **Project Settings** → **Secrets**
3. Добавьте две переменные:

```
TELEGRAM_BOT_TOKEN = 9179345540:AAFkEwDYsBIbCFwrSFRairVYOW0J3Rm8uH0
TELEGRAM_CHAT_ID = -5495908125
```

### Шаг 3: Разверните Edge Function

```bash
cd C:\Users\user\Desktop\ocr\Ocr-1
supabase functions deploy telegram-audit-logger --project-ref sxxlotfbcblnjgcvxaqe
```

### Шаг 4: Создайте Database Webhooks

Откройте Supabase SQL Editor и выполните:

```sql
-- Webhook для product_catalog_items
select
  pg_net.http_post(
    url := (select url from public.supabase_functions_endpoint || '/telegram-audit-logger'),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', 'product_catalog_items',
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    )::text
  ) as request_id;
```

**Или используйте Supabase Dashboard:**

1. **Database** → **Webhooks** → **Create**
2. Таблица: `product_catalog_items`
3. URL: `https://[your-project-id].supabase.co/functions/v1/telegram-audit-logger`
4. Events: ✓ Insert, ✓ Update, ✓ Delete

**Повторите для:**
- `product_price_overrides`
- `orders`

## 📱 Структура Telegram уведомлений

Примеры того, что вы получите:

```
✨ Створено
📊 Продукт
📝 Espresso 250g

⏰ 02.11.2026, 04:10
```

```
✏️ Оновлено
📊 Ціна
💰 Ціна: 150 → 180
🏷️ SKU: ESP-250 → ESP-250-NEW

⏰ 02.11.2026, 04:15
```

```
❌ Видалено
📊 Замовлення
📦 Замовлення #123e4567-e89b-12d3-a456-426614174000

⏰ 02.11.2026, 04:20
```

## 🔍 Как просмотреть логи в приложении

### В SQL Editor:

```sql
-- Все логи
select * from public.audit_logs order by created_at desc limit 100;

-- Логи по таблице
select * from public.audit_logs 
where table_name = 'product_catalog_items'
order by created_at desc;

-- Логи по пользователю
select * from public.audit_logs 
where user_email = 'admin@example.com'
order by created_at desc;

-- Последние изменения за день
select * from public.audit_logs 
where created_at > now() - interval '1 day'
order by created_at desc;
```

### Для удобства добавьте админ-панель:

Можно добавить страницу `audit-logs.html` с таблицей логов (опционально).

## 🔐 Безопасность

- ✅ Логи видны только администраторам (через RLS)
- ✅ Telegram сообщения защищены токеном бота
- ✅ Chat ID приватный (группа/личный чат)
- ✅ Все данные в JSONB (легко искать и фильтровать)

## 🚀 Проверка работы

1. Откройте админ-панель каталога
2. Отредактируйте товар (цену, имя, доступность)
3. Должно прийти сообщение в Telegram группу `-5495908125`
4. Проверьте логи в БД:

```sql
select * from public.audit_logs order by created_at desc limit 10;
```

## 📊 Что отслеживается

| Таблица | Отслеживаемые поля |
|---------|-------------------|
| `product_catalog_items` | name, description, is_available |
| `product_price_overrides` | price, sku, gradation_variants |
| `orders` | status, delivery_status, total_price |

## ❓ Вопросы и помощь

Если что-то не работает:
1. Проверьте Supabase Secrets (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
2. Проверьте, что функция развернута: **Functions** → **telegram-audit-logger**
3. Проверьте логи функции: **Functions** → **telegram-audit-logger** → **Logs**
4. Убедитесь, что Webhooks созданы для всех таблиц
