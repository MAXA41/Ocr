-- SQL для создания Database Webhooks (если Dashboard не работает)
-- Выполните эти команды в Supabase SQL Editor

-- Webhook для product_catalog_items
select net.http_post(
  url := 'https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger',
  body := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW),
    'old_record', to_jsonb(OLD)
  ),
  headers := jsonb_build_object('Content-Type', 'application/json')
) from public.product_catalog_items
where false;

-- Webhook для product_price_overrides
select net.http_post(
  url := 'https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger',
  body := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW),
    'old_record', to_jsonb(OLD)
  ),
  headers := jsonb_build_object('Content-Type', 'application/json')
) from public.product_price_overrides
where false;

-- Webhook для orders
select net.http_post(
  url := 'https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger',
  body := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW),
    'old_record', to_jsonb(OLD)
  ),
  headers := jsonb_build_object('Content-Type', 'application/json')
) from public.orders
where false;
