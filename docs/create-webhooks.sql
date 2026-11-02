-- Create webhooks for audit logging
-- These webhooks will send data changes to the telegram-audit-logger Edge Function

-- Webhook 1: product_catalog_items changes
SELECT
  net.http_post(
    url:='https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:=json_build_object(
      'table', 'product_catalog_items',
      'event', 'all'
    )::text
  ) as response;

-- Note: In Supabase Dashboard, create webhooks manually via:
-- Dashboard > Project Settings > Integrations > Database Webhooks > Create webhook
-- 
-- Webhook 1:
-- - Name: product_catalog_items_webhook
-- - Table: public.product_catalog_items  
-- - Events: INSERT, UPDATE, DELETE
-- - Type: HTTP Request
-- - Method: POST
-- - URL: https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger
--
-- Webhook 2:
-- - Name: product_price_overrides_webhook
-- - Table: public.product_price_overrides
-- - Events: INSERT, UPDATE, DELETE
-- - Type: HTTP Request
-- - Method: POST
-- - URL: https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger
--
-- Webhook 3:
-- - Name: orders_webhook
-- - Table: public.orders
-- - Events: INSERT, UPDATE, DELETE
-- - Type: HTTP Request
-- - Method: POST
-- - URL: https://sxxlotfbcblnjgcvxaqe.supabase.co/functions/v1/telegram-audit-logger
