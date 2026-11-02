# ⚡ БЫСТРАЯ ИНСТРУКЦИЯ - добавить Secrets и Webhooks

## 🔑 Шаг 1: Добавьте Secrets в Supabase (5 минут)

1. Откройте: https://supabase.com/dashboard/project/sxxlotfbcblnjgcvxaqe
2. Слева меню → **Project Settings** (иконка ⚙️)
3. В правом меню → **Secrets** или **API**
4. Нажмите **New secret**

**Добавьте 2 секрета:**

```
Name: TELEGRAM_BOT_TOKEN
Value: 9179345540:AAFkEwDYsBIbCFwrSFRairVYOW0J3Rm8uH0
```

Нажмите **Add secret**

```
Name: TELEGRAM_CHAT_ID
Value: -5495908125
```

Нажмите **Add secret**

✅ Secrets добавлены!

---

## 🔗 Шаг 2: Создайте Database Webhooks (10 минут)

1. Откройте Supabase Dashboard
2. Левое меню → **Database** → **Webhooks**
3. Нажмите **Create webhook**

**Заполните для каждой таблицы:**

### Webhook #1: product_catalog_items

```
Name: audit_product_catalog_items
Table: product_catalog_items
Events: ✓ Insert, ✓ Update, ✓ Delete
HTTP method: POST
URL: https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger
```

Нажмите **Create webhook**

---

### Webhook #2: product_price_overrides

```
Name: audit_product_price_overrides
Table: product_price_overrides
Events: ✓ Insert, ✓ Update, ✓ Delete
HTTP method: POST
URL: https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger
```

Нажмите **Create webhook**

---

### Webhook #3: orders

```
Name: audit_orders
Table: orders
Events: ✓ Insert, ✓ Update, ✓ Delete
HTTP method: POST
URL: https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger
```

Нажмите **Create webhook**

---

## ✅ Готово! Проверьте работу

1. Откройте админ-панель: http://localhost:5173/account.html
2. Отредактируйте любой товар (цену, название)
3. Должно прийти сообщение в Telegram чат `-5495908125`

**Проверьте логи в SQL:**
```sql
select * from public.audit_logs order by created_at desc limit 5;
```

---

## 🆘 Если Telegram уведомления не приходят

1. Проверьте, что Secrets добавлены:
   - Dashboard → Project Settings → Secrets
   - Должны быть TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID

2. Проверьте логи функции:
   - Dashboard → Functions → telegram-audit-logger → Logs
   - Ищите ошибки

3. Проверьте Webhooks:
   - Dashboard → Database → Webhooks
   - Должны быть 3 вебхука для трёх таблиц

4. Проверьте, что таблица audit_logs создана:
   ```sql
   select count(*) from public.audit_logs;
   ```

---

## 📚 Дополнительно

**Просмотреть все логи:**
```sql
select 
  created_at,
  user_email,
  action,
  table_name,
  record_name,
  changes
from public.audit_logs 
order by created_at desc 
limit 100;
```

**Логи только изменений цен:**
```sql
select * from public.audit_logs 
where table_name = 'product_price_overrides'
order by created_at desc;
```

**Логи только товаров:**
```sql
select * from public.audit_logs 
where table_name = 'product_catalog_items'
order by created_at desc;
```

---

✨ **Всё готово!** Система логирования с Telegram уведомлениями полностью настроена.
