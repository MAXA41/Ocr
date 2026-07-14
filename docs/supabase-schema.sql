create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  telegram_username text,
  default_city text,
  default_delivery_method text,
  default_delivery_details text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email))
  where email is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (
    new.id,
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, new.raw_user_meta_data ->> 'full_name'),
        updated_at = timezone('utc', now());

  update public.profiles
    set full_name = coalesce(public.profiles.full_name, new.raw_user_meta_data ->> 'full_name'),
        updated_at = timezone('utc', now())
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.profiles (id, email)
select id, email
from auth.users
on conflict (id) do update
  set email = excluded.email,
  updated_at = timezone('utc', now());

create table if not exists public.discount_tiers (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  threshold_amount numeric(10, 2) not null unique check (threshold_amount >= 0),
  discount_percent numeric(5, 2) not null check (discount_percent >= 0 and discount_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.discount_tiers (title, description, threshold_amount, discount_percent)
values
  ('Base', 'Стартовий рівень без знижки', 0, 0),
  ('Bronze', 'Перший накопичувальний рівень', 3000, 3),
  ('Silver', 'Постійний клієнт', 7000, 5),
  ('Gold', 'Високий накопичувальний рівень', 12000, 7),
  ('Black', 'Максимальний рівень знижки', 20000, 10)
on conflict (threshold_amount) do update
  set title = excluded.title,
      description = excluded.description,
      discount_percent = excluded.discount_percent,
      is_active = true;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_id uuid references public.profiles(id) on delete set null,
  source text not null default 'website',
  status text not null default 'new' check (status in ('draft', 'new', 'paid', 'processing', 'shipped', 'completed', 'canceled', 'refunded')),
  payment_provider text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'expired', 'canceled', 'refunded')),
  payment_reference text,
  payment_payload jsonb not null default '{}'::jsonb,
  payment_gateway text,
  mono_invoice_id text,
  mono_invoice_status text,
  mono_invoice_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  city text,
  delivery_method text,
  delivery_method_label text,
  delivery_details text,
  payment_method text,
  payment_method_label text,
  comment text,
  currency text not null default 'UAH',
  subtotal_amount numeric(10, 2) not null default 0,
  discount_percent numeric(5, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null default 0,
  accumulation_amount numeric(10, 2) not null default 0,
  items_summary text,
  raw_payload jsonb not null default '{}'::jsonb,
  placed_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.orders
  add column if not exists payment_provider text,
  add column if not exists payment_status text default 'unpaid',
  add column if not exists payment_reference text,
  add column if not exists payment_payload jsonb default '{}'::jsonb,
  add column if not exists payment_gateway text,
  add column if not exists mono_invoice_id text,
  add column if not exists mono_invoice_status text,
  add column if not exists mono_invoice_payload jsonb default '{}'::jsonb,
  add column if not exists paid_at timestamptz;

update public.orders
set payment_status = coalesce(payment_status, 'unpaid')
where payment_status is null;

update public.orders
set payment_payload = coalesce(payment_payload, '{}'::jsonb)
where payment_payload is null;

update public.orders
set mono_invoice_payload = coalesce(mono_invoice_payload, '{}'::jsonb)
where mono_invoice_payload is null;

alter table public.orders
  alter column payment_status set default 'unpaid',
  alter column payment_status set not null,
  alter column payment_payload set default '{}'::jsonb,
  alter column payment_payload set not null,
  alter column mono_invoice_payload set default '{}'::jsonb,
  alter column mono_invoice_payload set not null;

create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_customer_email_idx on public.orders (lower(customer_email));
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_payment_reference_idx on public.orders (payment_reference);
create index if not exists orders_placed_at_idx on public.orders (placed_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text,
  product_title text not null,
  category text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  grind_method text,
  grind_label text,
  line_total numeric(10, 2) generated always as (quantity * unit_price) stored,
  raw_item jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

create or replace function public.create_public_order(
  p_source text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_city text,
  p_delivery_method text,
  p_delivery_method_label text,
  p_delivery_details text,
  p_payment_method text,
  p_payment_method_label text,
  p_comment text,
  p_currency text,
  p_total_amount numeric,
  p_items_summary text,
  p_raw_payload jsonb,
  p_placed_at timestamptz,
  p_items jsonb
)
returns table(order_id uuid, order_number bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number bigint;
  v_customer_id uuid;
  v_item jsonb;
begin
  if coalesce(btrim(p_customer_name), '') = '' then
    raise exception 'Customer name is required';
  end if;

  if coalesce(btrim(p_customer_email), '') = '' then
    raise exception 'Customer email is required';
  end if;

  if coalesce(btrim(p_customer_phone), '') = '' then
    raise exception 'Customer phone is required';
  end if;

  if coalesce(btrim(p_delivery_method), '') = '' then
    raise exception 'Delivery method is required';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Order items are required';
  end if;

  v_customer_id := auth.uid();

  insert into public.orders (
    customer_id,
    source,
    status,
    customer_name,
    customer_email,
    customer_phone,
    city,
    delivery_method,
    delivery_method_label,
    delivery_details,
    payment_method,
    payment_method_label,
    comment,
    currency,
    subtotal_amount,
    discount_percent,
    discount_amount,
    total_amount,
    accumulation_amount,
    items_summary,
    raw_payload,
    placed_at
  )
  values (
    v_customer_id,
    coalesce(nullif(btrim(p_source), ''), 'website'),
    'new',
    p_customer_name,
    lower(p_customer_email),
    p_customer_phone,
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_delivery_method, '')), ''),
    nullif(btrim(coalesce(p_delivery_method_label, '')), ''),
    nullif(btrim(coalesce(p_delivery_details, '')), ''),
    nullif(btrim(coalesce(p_payment_method, '')), ''),
    nullif(btrim(coalesce(p_payment_method_label, '')), ''),
    nullif(btrim(coalesce(p_comment, '')), ''),
    coalesce(nullif(btrim(p_currency), ''), 'UAH'),
    coalesce(p_total_amount, 0),
    0,
    0,
    coalesce(p_total_amount, 0),
    0,
    nullif(btrim(coalesce(p_items_summary, '')), ''),
    coalesce(p_raw_payload, '{}'::jsonb),
    coalesce(p_placed_at, timezone('utc', now()))
  )
  returning id, public.orders.order_number into v_order_id, v_order_number;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.order_items (
      order_id,
      product_id,
      product_title,
      category,
      quantity,
      unit_price,
      grind_method,
      grind_label,
      raw_item
    )
    values (
      v_order_id,
      nullif(btrim(coalesce(v_item ->> 'product_id', '')), ''),
      coalesce(nullif(btrim(coalesce(v_item ->> 'product_title', '')), ''), 'Item'),
      nullif(btrim(coalesce(v_item ->> 'category', '')), ''),
      greatest(coalesce((v_item ->> 'quantity')::integer, 1), 1),
      greatest(coalesce((v_item ->> 'unit_price')::numeric, 0), 0),
      nullif(btrim(coalesce(v_item ->> 'grind_method', '')), ''),
      nullif(btrim(coalesce(v_item ->> 'grind_label', '')), ''),
      coalesce(v_item -> 'raw_item', v_item)
    );
  end loop;

  return query
  select v_order_id, v_order_number;
end;
$$;

grant execute on function public.create_public_order(text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, jsonb, timestamptz, jsonb) to anon, authenticated;

create table if not exists public.customer_discount_state (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  lifetime_spend numeric(10, 2) not null default 0,
  completed_orders_count integer not null default 0 check (completed_orders_count >= 0),
  current_tier_id bigint references public.discount_tiers(id) on delete set null,
  current_discount_percent numeric(5, 2) not null default 0,
  amount_to_next_tier numeric(10, 2) not null default 0,
  last_recalculated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.catalog_admins (
  email text primary key,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.catalog_admins (email)
values
  ('office@barista-box.com'),
  ('zdrastvyite11@gmail.com'),
  ('tapaxtejlka@ua.fm')
on conflict (email) do nothing;

create table if not exists public.product_catalog_state (
  product_id text primary key,
  is_available boolean not null default true,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  sold_quantity integer not null default 0 check (sold_quantity >= 0),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.product_price_overrides (
  product_id text primary key,
  override_price numeric(10, 2) not null check (override_price >= 0),
  currency text not null default 'UAH',
  is_active boolean not null default true,
  source text not null default 'telegram',
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.product_text_overrides (
  product_id text primary key,
  name_override text,
  description_override text,
  origin_override text,
  processing_override text,
  alt_override text,
  weight_override text,
  taste_override text,
  cup_profile_override text,
  brew_guide_override text,
  audience_override text,
  is_active boolean not null default true,
  source text not null default 'admin-panel',
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.product_text_overrides
  add column if not exists taste_override text,
  add column if not exists cup_profile_override text,
  add column if not exists brew_guide_override text,
  add column if not exists audience_override text;

create index if not exists product_price_overrides_active_idx
  on public.product_price_overrides (is_active, updated_at desc);

create index if not exists product_text_overrides_active_idx
  on public.product_text_overrides (is_active, updated_at desc);

create index if not exists order_items_product_id_idx on public.order_items (product_id);

create table if not exists public.product_catalog_items (
  product_id text primary key,
  name text not null,
  description text,
  image text not null,
  alt text,
  category text not null,
  price numeric(10, 2) not null check (price >= 0),
  weight text,
  country text,
  region text,
  origin text,
  processing text,
  farm text,
  variety text,
  altitude text,
  score numeric(5, 2),
  featured boolean not null default false,
  gift_image text,
  gift_alt text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists product_catalog_items_category_idx on public.product_catalog_items (category);
create index if not exists product_catalog_items_featured_idx on public.product_catalog_items (featured);

drop trigger if exists product_catalog_items_set_updated_at on public.product_catalog_items;
create trigger product_catalog_items_set_updated_at
before update on public.product_catalog_items
for each row
execute function public.set_updated_at();

create or replace function public.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.catalog_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.recalculate_product_catalog_sales(target_product_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sold_quantity integer;
begin
  if target_product_id is null or btrim(target_product_id) = '' then
    return;
  end if;

  insert into public.product_catalog_state (product_id)
  values (target_product_id)
  on conflict (product_id) do nothing;

  select coalesce(sum(order_items.quantity), 0)::integer
  into v_sold_quantity
  from public.order_items
  join public.orders on public.orders.id = public.order_items.order_id
  where public.order_items.product_id = target_product_id
    and public.orders.status in ('new', 'paid', 'processing', 'shipped', 'completed');

  update public.product_catalog_state
    set sold_quantity = coalesce(v_sold_quantity, 0),
        updated_at = timezone('utc', now())
  where product_id = target_product_id;
end;
$$;

create or replace function public.recalculate_product_catalog_sales_for_order(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id text;
begin
  if target_order_id is null then
    return;
  end if;

  for v_product_id in
    select distinct product_id
    from public.order_items
    where order_id = target_order_id
      and product_id is not null
  loop
    perform public.recalculate_product_catalog_sales(v_product_id);
  end loop;
end;
$$;

create or replace function public.handle_product_catalog_item_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.product_id is not null then
    perform public.recalculate_product_catalog_sales(old.product_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.product_id is not null then
    perform public.recalculate_product_catalog_sales(new.product_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.handle_product_catalog_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.id is not null then
    perform public.recalculate_product_catalog_sales_for_order(old.id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.id is not null then
    perform public.recalculate_product_catalog_sales_for_order(new.id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists product_catalog_state_set_updated_at on public.product_catalog_state;
create trigger product_catalog_state_set_updated_at
before update on public.product_catalog_state
for each row
execute function public.set_updated_at();

drop trigger if exists order_items_catalog_state_trigger on public.order_items;
create trigger order_items_catalog_state_trigger
after insert or update or delete on public.order_items
for each row
execute function public.handle_product_catalog_item_change();

drop trigger if exists orders_catalog_state_trigger on public.orders;
create trigger orders_catalog_state_trigger
after insert or update or delete on public.orders
for each row
execute function public.handle_product_catalog_order_change();

drop view if exists public.product_catalog_public;

create view public.product_catalog_public as
select
  items.product_id,
  items.name,
  items.description,
  items.image,
  items.alt,
  items.category,
  coalesce(overrides.override_price, items.price) as price,
  items.price as base_price,
  items.weight,
  items.country,
  items.region,
  items.origin,
  items.processing,
  items.farm,
  items.variety,
  items.altitude,
  items.score,
  items.featured,
  items.gift_image,
  items.gift_alt,
  coalesce(state.is_available, true) as is_available,
  case
    when state.stock_quantity is null then null
    else greatest(state.stock_quantity - state.sold_quantity, 0)
  end as available_quantity,
  case
    when coalesce(state.is_available, true) = false then 'disabled'
    when state.stock_quantity is not null and greatest(state.stock_quantity - state.sold_quantity, 0) <= 0 then 'out_of_stock'
    else 'available'
  end as availability_status,
  greatest(
    coalesce(items.updated_at, timezone('utc', now())),
    coalesce(state.updated_at, timezone('utc', now())),
    coalesce(overrides.updated_at, timezone('utc', now()))
  ) as updated_at,
  state.stock_quantity,
  state.sold_quantity,
  overrides.override_price,
  overrides.currency,
  overrides.is_active as has_active_override
from public.product_catalog_items items
left join public.product_catalog_state state on state.product_id = items.product_id
left join public.product_price_overrides overrides
  on overrides.product_id = items.product_id
 and overrides.is_active = true;

grant select on public.product_catalog_public to anon, authenticated;

create or replace function public.recalculate_customer_discount_state(target_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lifetime_spend numeric(10, 2);
  v_completed_orders_count integer;
  v_current_tier_id bigint;
  v_current_discount_percent numeric(5, 2);
  v_amount_to_next_tier numeric(10, 2);
begin
  if target_customer_id is null then
    return;
  end if;

  select
    coalesce(sum(accumulation_amount), 0),
    count(*)
  into
    v_lifetime_spend,
    v_completed_orders_count
  from public.orders
  where customer_id = target_customer_id
    and status = 'completed';

  select id, discount_percent
  into v_current_tier_id, v_current_discount_percent
  from public.discount_tiers
  where is_active = true
    and threshold_amount <= v_lifetime_spend
  order by threshold_amount desc
  limit 1;

  select min(threshold_amount - v_lifetime_spend)
  into v_amount_to_next_tier
  from public.discount_tiers
  where is_active = true
    and threshold_amount > v_lifetime_spend;

  insert into public.customer_discount_state (
    customer_id,
    lifetime_spend,
    completed_orders_count,
    current_tier_id,
    current_discount_percent,
    amount_to_next_tier,
    last_recalculated_at,
    created_at,
    updated_at
  )
  values (
    target_customer_id,
    coalesce(v_lifetime_spend, 0),
    coalesce(v_completed_orders_count, 0),
    v_current_tier_id,
    coalesce(v_current_discount_percent, 0),
    greatest(coalesce(v_amount_to_next_tier, 0), 0),
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (customer_id) do update
    set lifetime_spend = excluded.lifetime_spend,
        completed_orders_count = excluded.completed_orders_count,
        current_tier_id = excluded.current_tier_id,
        current_discount_percent = excluded.current_discount_percent,
        amount_to_next_tier = excluded.amount_to_next_tier,
        last_recalculated_at = excluded.last_recalculated_at,
        updated_at = timezone('utc', now());
end;
$$;

create or replace function public.handle_order_discount_state_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.customer_id is not null then
    perform public.recalculate_customer_discount_state(old.customer_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.customer_id is not null then
    perform public.recalculate_customer_discount_state(new.customer_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists orders_discount_state_trigger on public.orders;

create trigger orders_discount_state_trigger
after insert or update or delete on public.orders
for each row
execute function public.handle_order_discount_state_change();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

drop trigger if exists customer_discount_state_set_updated_at on public.customer_discount_state;
create trigger customer_discount_state_set_updated_at
before update on public.customer_discount_state
for each row
execute function public.set_updated_at();

drop trigger if exists product_price_overrides_set_updated_at on public.product_price_overrides;
create trigger product_price_overrides_set_updated_at
before update on public.product_price_overrides
for each row
execute function public.set_updated_at();

drop trigger if exists product_text_overrides_set_updated_at on public.product_text_overrides;
create trigger product_text_overrides_set_updated_at
before update on public.product_text_overrides
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.discount_tiers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customer_discount_state enable row level security;
alter table public.catalog_admins enable row level security;
alter table public.product_catalog_state enable row level security;
alter table public.product_price_overrides enable row level security;
alter table public.product_text_overrides enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "discount_tiers_select_all" on public.discount_tiers;
create policy "discount_tiers_select_all"
on public.discount_tiers
for select
using (true);

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
on public.orders
for select
using (customer_id = auth.uid());

drop policy if exists "order_items_select_for_own_orders" on public.order_items;
create policy "order_items_select_for_own_orders"
on public.order_items
for select
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.customer_id = auth.uid()
  )
);

drop policy if exists "customer_discount_state_select_own" on public.customer_discount_state;
create policy "customer_discount_state_select_own"
on public.customer_discount_state
for select
using (customer_id = auth.uid());

drop policy if exists "catalog_admins_select_own" on public.catalog_admins;
create policy "catalog_admins_select_own"
on public.catalog_admins
for select
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "product_catalog_state_admin_select" on public.product_catalog_state;
create policy "product_catalog_state_admin_select"
on public.product_catalog_state
for select
using (public.is_catalog_admin());

drop policy if exists "product_catalog_state_admin_insert" on public.product_catalog_state;
create policy "product_catalog_state_admin_insert"
on public.product_catalog_state
for insert
with check (public.is_catalog_admin());

drop policy if exists "product_catalog_state_admin_update" on public.product_catalog_state;
create policy "product_catalog_state_admin_update"
on public.product_catalog_state
for update
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

drop policy if exists "product_price_overrides_select_active" on public.product_price_overrides;
create policy "product_price_overrides_select_active"
on public.product_price_overrides
for select
using (is_active or public.is_catalog_admin());

drop policy if exists "product_price_overrides_admin_insert" on public.product_price_overrides;
create policy "product_price_overrides_admin_insert"
on public.product_price_overrides
for insert
with check (public.is_catalog_admin());

drop policy if exists "product_price_overrides_admin_update" on public.product_price_overrides;
create policy "product_price_overrides_admin_update"
on public.product_price_overrides
for update
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

drop policy if exists "product_price_overrides_admin_delete" on public.product_price_overrides;
create policy "product_price_overrides_admin_delete"
on public.product_price_overrides
for delete
using (public.is_catalog_admin());

drop policy if exists "product_text_overrides_select_active" on public.product_text_overrides;
create policy "product_text_overrides_select_active"
on public.product_text_overrides
for select
using (is_active or public.is_catalog_admin());

drop policy if exists "product_text_overrides_admin_insert" on public.product_text_overrides;
create policy "product_text_overrides_admin_insert"
on public.product_text_overrides
for insert
with check (public.is_catalog_admin());

drop policy if exists "product_text_overrides_admin_update" on public.product_text_overrides;
create policy "product_text_overrides_admin_update"
on public.product_text_overrides
for update
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

drop policy if exists "product_text_overrides_admin_delete" on public.product_text_overrides;
create policy "product_text_overrides_admin_delete"
on public.product_text_overrides
for delete
using (public.is_catalog_admin());