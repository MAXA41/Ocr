# 🔗 Создание Database Webhooks - Пошаговое руководство

Теперь нам нужно создать 3 webhooks для автоматического логирования изменений в Telegram.

## ✅ Что уже сделано:

- ✅ Secrets добавлены (`TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`)
- ✅ Edge Function развернута (`telegram-audit-logger`)
- ⏳ **Нужно создать**: 3 Database Webhooks

---

## 📝 Создание Webhook #1: product_catalog_items

### Шаг 1: Откройте Webhooks страницу

1. Перейдите на https://supabase.com/dashboard
2. Откройте ваш проект **MAXA41's Project** (PRODUCTION)
3. В левой боковой панели нажмите **Integrations** (иконка разъёмов)
4. Нажмите **Database Webhooks** 
5. Перейдите на вкладку **Webhooks**
6. Нажмите зелёную кнопку **"Create webhook"**

### Шаг 2: Заполните форму

**General section:**
- **Name**: `product_catalog_items_webhook`

**Conditions to fire webhook:**
- **Table**: Select → `public.product_catalog_items`
- **Events**: ☑️ INSERT, ☑️ UPDATE, ☑️ DELETE

**Type of webhook:**
- **Type**: HTTP Request (по умолчанию)
- **Method**: POST (по умолчанию)

**URL section:**
- **URL**: `https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger`

### Шаг 3: Нажмите "Create webhook"

✅ Webhook #1 создан!

---

## 📝 Создание Webhook #2: product_price_overrides

Повторите то же самое, но с другой таблицей:

**General section:**
- **Name**: `product_price_overrides_webhook`

**Conditions to fire webhook:**
- **Table**: Select → `public.product_price_overrides`
- **Events**: ☑️ INSERT, ☑️ UPDATE, ☑️ DELETE

**URL section:**
- **URL**: `https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger`

---

## 📝 Создание Webhook #3: orders

Повторите то же самое для таблицы orders:

**General section:**
- **Name**: `orders_webhook`

**Conditions to fire webhook:**
- **Table**: Select → `public.orders`
- **Events**: ☑️ INSERT, ☑️ UPDATE, ☑️ DELETE

**URL section:**
- **URL**: `https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger`

---

## ✅ Проверка

После создания всех 3 webhooks:

1. Откройте Telegram чат/группу где вы получаете логи
2. Попробуйте **добавить новый товар** через бота
3. Посмотрите **Telegram** - должно прийти уведомление об изменении

**Пример сообщения в Telegram:**
```
✏️ ОБНОВЛЕНО
📊 Продукт
📝 Espresso Blend 250g
⏰ 02.11.2026, 06:30
```

---

## 🔧 Troubleshooting

### Telegram не получает сообщения?

1. Проверьте что Secrets добавлены:
   - Settings → Functions → Secrets
   - ✅ `TELEGRAM_BOT_TOKEN`
   - ✅ `TELEGRAM_CHAT_ID`

2. Проверьте что все 3 webhooks созданы в Database Webhooks

3. Проверьте URL Edge Function правильный:
   - `https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger`

4. Проверьте что бот добавлен в группу Telegram и имеет права на отправку сообщений

### Webhook не срабатывает?

1. Убедитесь что выбраны ВСЕ события: INSERT, UPDATE, DELETE
2. Проверьте URL в webhook (без опечаток)
3. Посмотрите в Supabase Logs → Edge Functions для ошибок

---

## 🚀 Что будет дальше

После создания webhooks вся система автоматически будет:

1. **Отслеживать** все изменения товаров
2. **Логировать** в таблицу `audit_logs` с полной историей
3. **Отправлять** уведомления в Telegram админам
4. **Сохранять** старые и новые значения для анализа

---

**Готово! После создания webhooks система будет полностью работающей!** 🎉
