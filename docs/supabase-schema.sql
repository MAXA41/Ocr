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
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = timezone('utc', now());

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

create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_customer_email_idx on public.orders (lower(customer_email));
create index if not exists orders_status_idx on public.orders (status);
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

alter table public.profiles enable row level security;
alter table public.discount_tiers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customer_discount_state enable row level security;

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