# Развертывание Telegram Audit Logger Edge Function

## 📝 Краткий чек-лист

- [ ] Edge Function создана в `supabase/functions/telegram-audit-logger/index.ts`
- [ ] Secrets добавлены в Supabase Dashboard
- [ ] Функция развернута через CLI
- [ ] Webhooks созданы для таблиц
- [ ] Тест отправлен в Telegram

## 🚀 Пошаговая инструкция

### 1️⃣ Убедитесь, что файл функции существует

```bash
dir supabase\functions\telegram-audit-logger\
```

Должен быть файл: `index.ts`

### 2️⃣ Добавьте Secrets в Supabase

**Через Dashboard:**
1. Откройте https://supabase.com/dashboard/project/sxxlotfbcblnjgcvxaqe
2. **Project Settings** (иконка шестеренки)
3. **Secrets**
4. **New Secret**

Добавьте:
```
Name: TELEGRAM_BOT_TOKEN
Value: 9179345540:AAFkEwDYsBIbCFwrSFRairVYOW0J3Rm8uH0
```

И:
```
Name: TELEGRAM_CHAT_ID
Value: -5495908125
```

### 3️⃣ Разверните функцию

```powershell
# Перейдите в корень проекта
cd C:\Users\user\Desktop\ocr\Ocr-1

# Разверните функцию
supabase functions deploy telegram-audit-logger --project-ref sxxlotfbcblnjgcvxaqe
```

**Ожидаемый результат:**
```
✓ Successfully deployed function telegram-audit-logger
  Endpoint: https://[project-id].supabase.co/functions/v1/telegram-audit-logger
```

### 4️⃣ Создайте Database Webhooks

**Способ A: Через Supabase Dashboard (проще)**

1. Откройте Supabase Dashboard
2. **Database** → **Webhooks**
3. Нажмите **Create webhook**

**Для таблицы `product_catalog_items`:**
- Name: `audit_product_catalog_items`
- Table: `public.product_catalog_items`
- Events: ✓ Insert, ✓ Update, ✓ Delete
- HTTP method: POST
- URL: `https://[project-id].supabase.co/functions/v1/telegram-audit-logger`
- Headers (optional): 
  ```
  Content-Type: application/json
  ```

**Способ B: Через SQL (для опытных)**

```sql
-- Webhook для product_catalog_items
create subscription "product_catalog_items_webhook"
after insert, update, delete on public.product_catalog_items
with (max_attempts = 3)
execute function supabase_functions.http_request_handler(
  url := 'https://[project-id].supabase.co/functions/v1/telegram-audit-logger',
  method := 'POST'
);

-- Webhook для product_price_overrides
create subscription "product_price_overrides_webhook"
after insert, update, delete on public.product_price_overrides
with (max_attempts = 3)
execute function supabase_functions.http_request_handler(
  url := 'https://[project-id].supabase.co/functions/v1/telegram-audit-logger',
  method := 'POST'
);

-- Webhook для orders
create subscription "orders_webhook"
after insert, update, delete on public.orders
with (max_attempts = 3)
execute function supabase_functions.http_request_handler(
  url := 'https://[project-id].supabase.co/functions/v1/telegram-audit-logger',
  method := 'POST'
);
```

### 5️⃣ Проверьте развертывание

1. Откройте Supabase Dashboard
2. **Functions** → **telegram-audit-logger**
3. Проверьте **Logs** в реальном времени

### 6️⃣ Тестируйте

1. Откройте админ-панель каталога
2. Отредактируйте любой товар (цену, название и т.д.)
3. Проверьте Telegram — должно прийти уведомление

## 🔧 Переменные окружения

Функция использует:
```typescript
TELEGRAM_BOT_TOKEN  // Токен Telegram бота
TELEGRAM_CHAT_ID    // ID Telegram чата/группы
SUPABASE_URL        // Автоматически (встроенное)
SUPABASE_ANON_KEY   // Автоматически (встроенное)
```

## 🚨 Если что-то не работает

### Функция не развернулась
```bash
# Проверьте, что вы авторизованы
supabase projects list

# Скопируйте project-ref и используйте его
supabase functions deploy telegram-audit-logger --project-ref [YOUR-PROJECT-REF]
```

### Нет уведомлений в Telegram
1. Проверьте Secrets добавлены правильно
2. Откройте Supabase **Functions** → **Logs**
3. Ищите ошибки в логах функции
4. Проверьте, что Chat ID правильный: `-5495908125`

### Ошибка при создании Webhook
- Убедитесь, что функция успешно развернута
- Используйте полный URL: `https://[project-id].supabase.co/functions/v1/telegram-audit-logger`
- Получить project-id можно из Supabase Dashboard URL

## 📚 Полезные команды

```bash
# Список функций
supabase functions list --project-ref sxxlotfbcblnjgcvxaqe

# Просмотр логов функции
supabase functions download telegram-audit-logger --project-ref sxxlotfbcblnjgcvxaqe

# Локальное тестирование (перед развертыванием)
supabase start
supabase functions serve

# Удаление функции (если нужно переразвернуть)
supabase functions delete telegram-audit-logger --project-ref sxxlotfbcblnjgcvxaqe
```

## ✅ Итог

После выполнения всех шагов у вас будет:
- ✅ Таблица `audit_logs` с автоматическим логированием
- ✅ Telegram уведомления для всех изменений
- ✅ Edge Function для отправки сообщений
- ✅ Webhooks на все критические таблицы
- ✅ История всех администраторских действий

Готово! 🎉
