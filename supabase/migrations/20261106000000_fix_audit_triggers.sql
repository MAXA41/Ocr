-- Fix audit triggers that referenced columns which do not exist in the catalog/price/orders tables.
-- Idempotent: safe to run more than once.

-- Record ids are text in the catalog tables (product_id), uuid in orders; keep them all as text.
alter table public.audit_logs
  alter column record_id type text using record_id::text;

-- Remove the permissive insert policy that was added as a workaround.
drop policy if exists "product_catalog_items_insert_all" on public.product_catalog_items;

create or replace function public.log_catalog_items_changes()
returns trigger as $$
declare
  v_changes text;
begin
  if TG_OP = 'INSERT' then
    v_changes := 'Created catalog item: ' || NEW.name;
  elsif TG_OP = 'UPDATE' then
    v_changes := '';
    if OLD.name is distinct from NEW.name then v_changes := v_changes || 'Name: ' || coalesce(OLD.name, 'null') || ' → ' || coalesce(NEW.name, 'null') || '; '; end if;
    if OLD.description is distinct from NEW.description then v_changes := v_changes || 'Description changed; '; end if;
    if OLD.price is distinct from NEW.price then v_changes := v_changes || 'Price: ' || coalesce(OLD.price::text, 'null') || ' → ' || coalesce(NEW.price::text, 'null') || '; '; end if;
  elsif TG_OP = 'DELETE' then
    v_changes := 'Deleted catalog item: ' || OLD.name;
  end if;

  insert into public.audit_logs (
    user_id, user_email, action, table_name, record_id, record_name, old_data, new_data, changes
  ) values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    TG_OP,
    'product_catalog_items',
    case when TG_OP = 'DELETE' then OLD.product_id else NEW.product_id end,
    case when TG_OP = 'DELETE' then OLD.name else NEW.name end,
    case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end,
    v_changes
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.log_price_overrides_changes()
returns trigger as $$
declare
  v_changes text;
  v_product_id text;
  v_product_name text;
begin
  v_product_id := case when TG_OP = 'DELETE' then OLD.product_id else NEW.product_id end;
  select name into v_product_name from public.product_catalog_items where product_id = v_product_id limit 1;

  if TG_OP = 'INSERT' then
    v_changes := 'New price override for ' || coalesce(v_product_name, v_product_id);
  elsif TG_OP = 'UPDATE' then
    v_changes := '';
    if OLD.override_price is distinct from NEW.override_price then v_changes := v_changes || 'Price: ' || coalesce(OLD.override_price::text, 'null') || ' → ' || coalesce(NEW.override_price::text, 'null') || '; '; end if;
    if OLD.override_price_250g is distinct from NEW.override_price_250g then v_changes := v_changes || '250g: ' || coalesce(OLD.override_price_250g::text, 'null') || ' → ' || coalesce(NEW.override_price_250g::text, 'null') || '; '; end if;
    if OLD.override_price_1kg is distinct from NEW.override_price_1kg then v_changes := v_changes || '1kg: ' || coalesce(OLD.override_price_1kg::text, 'null') || ' → ' || coalesce(NEW.override_price_1kg::text, 'null') || '; '; end if;
    if OLD.is_active is distinct from NEW.is_active then v_changes := v_changes || 'Active: ' || OLD.is_active::text || ' → ' || NEW.is_active::text || '; '; end if;
  elsif TG_OP = 'DELETE' then
    v_changes := 'Deleted price override for ' || coalesce(v_product_name, v_product_id);
  end if;

  insert into public.audit_logs (
    user_id, user_email, action, table_name, record_id, record_name, old_data, new_data, changes
  ) values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    TG_OP,
    'product_price_overrides',
    v_product_id,
    coalesce(v_product_name, v_product_id),
    case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end,
    v_changes
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.log_orders_changes()
returns trigger as $$
declare
  v_changes text;
  v_old jsonb := case when TG_OP = 'INSERT' then '{}'::jsonb else to_jsonb(OLD) end;
  v_new jsonb := case when TG_OP = 'DELETE' then '{}'::jsonb else to_jsonb(NEW) end;
begin
  if TG_OP = 'INSERT' then
    v_changes := 'Order created. Status: ' || coalesce(v_new->>'status', '-') || ', Total: ' || coalesce(v_new->>'total_amount', '-');
  elsif TG_OP = 'UPDATE' then
    v_changes := '';
    if v_old->>'status' is distinct from v_new->>'status' then v_changes := v_changes || 'Status: ' || coalesce(v_old->>'status', 'null') || ' → ' || coalesce(v_new->>'status', 'null') || '; '; end if;
    if v_old->>'payment_status' is distinct from v_new->>'payment_status' then v_changes := v_changes || 'Payment: ' || coalesce(v_old->>'payment_status', 'null') || ' → ' || coalesce(v_new->>'payment_status', 'null') || '; '; end if;
    if v_old->>'total_amount' is distinct from v_new->>'total_amount' then v_changes := v_changes || 'Total: ' || coalesce(v_old->>'total_amount', 'null') || ' → ' || coalesce(v_new->>'total_amount', 'null') || '; '; end if;
  elsif TG_OP = 'DELETE' then
    v_changes := 'Order deleted. ID: ' || (v_old->>'id');
  end if;

  insert into public.audit_logs (
    user_id, user_email, action, table_name, record_id, record_name, old_data, new_data, changes
  ) values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    TG_OP,
    'orders',
    coalesce(v_new->>'id', v_old->>'id'),
    'Order ' || coalesce(v_new->>'order_number', v_old->>'order_number', coalesce(v_new->>'id', v_old->>'id')),
    case when TG_OP = 'INSERT' then null else v_old end,
    case when TG_OP = 'DELETE' then null else v_new end,
    v_changes
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists catalog_items_audit_trigger on public.product_catalog_items;
create trigger catalog_items_audit_trigger
  after insert or update or delete on public.product_catalog_items
  for each row execute function public.log_catalog_items_changes();

drop trigger if exists price_overrides_audit_trigger on public.product_price_overrides;
create trigger price_overrides_audit_trigger
  after insert or update or delete on public.product_price_overrides
  for each row execute function public.log_price_overrides_changes();

drop trigger if exists orders_audit_trigger on public.orders;
create trigger orders_audit_trigger
  after insert or update or delete on public.orders
  for each row execute function public.log_orders_changes();
