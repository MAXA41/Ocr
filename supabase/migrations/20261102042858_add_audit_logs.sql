-- Migration: Add comprehensive audit logging system
-- Purpose: Track all changes to products, prices, and orders with Telegram notifications
-- Date: 2026-11-02

-- Create audit_logs table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  action text not null, -- 'INSERT', 'UPDATE', 'DELETE'
  table_name text not null, -- 'products', 'product_price_overrides', 'orders'
  record_id uuid,
  record_name text, -- friendly name (product name, order ID, etc)
  old_data jsonb, -- previous values for UPDATE/DELETE
  new_data jsonb, -- new values for INSERT/UPDATE
  changes text, -- human-readable summary: "Price: 100 → 150, SKU: OLD → NEW"
  ip_address text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_table_idx on public.audit_logs(table_name);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Allow admins to read all logs
create policy "Admins can read all audit logs"
  on public.audit_logs for select
  using (auth.jwt() ->> 'role' = 'authenticated' and (select is_admin from public.profiles where id = auth.uid()));

-- Allow admins to delete old logs
create policy "Admins can delete audit logs"
  on public.audit_logs for delete
  using (auth.jwt() ->> 'role' = 'authenticated' and (select is_admin from public.profiles where id = auth.uid()));

-- Trigger function for product_catalog_items table (replaces products)
create or replace function public.log_catalog_items_changes()
returns trigger as $$
declare
  v_changes text;
begin
  if TG_OP = 'INSERT' then
    v_changes := 'Created catalog item: ' || NEW.name;
  elsif TG_OP = 'UPDATE' then
    v_changes := '';
    if OLD.name is distinct from NEW.name then v_changes := v_changes || 'Name: ' || COALESCE(OLD.name, 'null') || ' → ' || NEW.name || '; '; end if;
    if OLD.description is distinct from NEW.description then v_changes := v_changes || 'Description changed; '; end if;
    if OLD.is_available is distinct from NEW.is_available then v_changes := v_changes || 'Availability: ' || OLD.is_available || ' → ' || NEW.is_available || '; '; end if;
  elsif TG_OP = 'DELETE' then
    v_changes := 'Deleted catalog item: ' || OLD.name;
  end if;

  insert into public.audit_logs (
    user_id,
    user_email,
    action,
    table_name,
    record_id,
    record_name,
    old_data,
    new_data,
    changes
  ) values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    TG_OP,
    'product_catalog_items',
    case when TG_OP = 'DELETE' then OLD.id else NEW.id end,
    case when TG_OP = 'DELETE' then OLD.name else NEW.name end,
    to_jsonb(OLD),
    to_jsonb(NEW),
    v_changes
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$ language plpgsql security definer;

-- Trigger on product_catalog_items
drop trigger if exists catalog_items_audit_trigger on public.product_catalog_items;
create trigger catalog_items_audit_trigger
  after insert or update or delete on public.product_catalog_items
  for each row execute function public.log_catalog_items_changes();

-- Trigger function for product_price_overrides table
create or replace function public.log_price_overrides_changes()
returns trigger as $$
declare
  v_changes text;
  v_product_name text;
begin
  -- Get product name for context
  if TG_OP = 'DELETE' then
    select name into v_product_name from public.products where id = OLD.product_id limit 1;
  else
    select name into v_product_name from public.products where id = NEW.product_id limit 1;
  end if;

  if TG_OP = 'INSERT' then
    v_changes := 'New price override for ' || COALESCE(v_product_name, 'unknown product');
  elsif TG_OP = 'UPDATE' then
    v_changes := '';
    if OLD.price is distinct from NEW.price then v_changes := v_changes || 'Price: ' || OLD.price || ' → ' || NEW.price || '; '; end if;
    if OLD.sku is distinct from NEW.sku then v_changes := v_changes || 'SKU: ' || OLD.sku || ' → ' || NEW.sku || '; '; end if;
    if OLD.gradation_variants is distinct from NEW.gradation_variants then v_changes := v_changes || 'Variants changed; '; end if;
  elsif TG_OP = 'DELETE' then
    v_changes := 'Deleted price override for ' || COALESCE(v_product_name, 'unknown product');
  end if;

  insert into public.audit_logs (
    user_id,
    user_email,
    action,
    table_name,
    record_id,
    record_name,
    old_data,
    new_data,
    changes
  ) values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    TG_OP,
    'product_price_overrides',
    case when TG_OP = 'DELETE' then OLD.id else NEW.id end,
    COALESCE(v_product_name, 'unknown') || ' - ' || COALESCE(case when TG_OP = 'DELETE' then OLD.sku else NEW.sku end, 'no-sku'),
    to_jsonb(OLD),
    to_jsonb(NEW),
    v_changes
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$ language plpgsql security definer;

-- Trigger on product_price_overrides
drop trigger if exists price_overrides_audit_trigger on public.product_price_overrides;
create trigger price_overrides_audit_trigger
  after insert or update or delete on public.product_price_overrides
  for each row execute function public.log_price_overrides_changes();

-- Trigger function for orders table
create or replace function public.log_orders_changes()
returns trigger as $$
declare
  v_changes text;
begin
  if TG_OP = 'INSERT' then
    v_changes := 'Order created. Status: ' || NEW.status || ', Total: ' || NEW.total_price;
  elsif TG_OP = 'UPDATE' then
    v_changes := '';
    if OLD.status is distinct from NEW.status then v_changes := v_changes || 'Status: ' || OLD.status || ' → ' || NEW.status || '; '; end if;
    if OLD.total_price is distinct from NEW.total_price then v_changes := v_changes || 'Total: ' || OLD.total_price || ' → ' || NEW.total_price || '; '; end if;
    if OLD.delivery_status is distinct from NEW.delivery_status then v_changes := v_changes || 'Delivery: ' || OLD.delivery_status || ' → ' || NEW.delivery_status || '; '; end if;
  elsif TG_OP = 'DELETE' then
    v_changes := 'Order deleted. ID: ' || OLD.id;
  end if;

  insert into public.audit_logs (
    user_id,
    user_email,
    action,
    table_name,
    record_id,
    record_name,
    old_data,
    new_data,
    changes
  ) values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    TG_OP,
    'orders',
    case when TG_OP = 'DELETE' then OLD.id else NEW.id end,
    'Order ' || (case when TG_OP = 'DELETE' then OLD.id else NEW.id end)::text,
    to_jsonb(OLD),
    to_jsonb(NEW),
    v_changes
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$ language plpgsql security definer;

-- Trigger on orders
drop trigger if exists orders_audit_trigger on public.orders;
create trigger orders_audit_trigger
  after insert or update or delete on public.orders
  for each row execute function public.log_orders_changes();

-- Grant permissions
grant select on public.audit_logs to authenticated;
