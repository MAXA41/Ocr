-- Category-specific product data for accessories and merch:
-- brand, subcategory / product type, material, sku, specs, gallery and variants
-- (variant = { id, color, size, label, image, price, stock }).
alter table public.product_catalog_items
  add column if not exists details jsonb not null default '{}'::jsonb;

-- Adds per-variant sold/available counters computed from active order lines.
-- A cart line selects a variant through raw_item.volumeOption = 'variant-<id>'.
create or replace function public.catalog_variants_public(p_product_id text, p_details jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when jsonb_typeof(p_details -> 'variants') <> 'array' or jsonb_array_length(p_details -> 'variants') = 0 then p_details
    else jsonb_set(
      p_details,
      '{variants}',
      (
        select coalesce(jsonb_agg(
          v.value || jsonb_build_object(
            'sold', coalesce(s.sold, 0),
            'available', case
              when jsonb_typeof(v.value -> 'stock') = 'number'
                then greatest((v.value ->> 'stock')::integer - coalesce(s.sold, 0), 0)
              else null
            end
          )
          order by v.ord
        ), '[]'::jsonb)
        from jsonb_array_elements(p_details -> 'variants') with ordinality as v(value, ord)
        left join lateral (
          select sum(oi.quantity)::integer as sold
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
          where oi.product_id = p_product_id
            and oi.raw_item ->> 'volumeOption' = 'variant-' || (v.value ->> 'id')
            and o.status in ('new', 'paid', 'processing', 'shipped', 'completed')
        ) s on true
      )
    )
  end;
$$;

grant execute on function public.catalog_variants_public(text, jsonb) to anon, authenticated;

create or replace view public.product_catalog_public as
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
  overrides.override_price_250g,
  overrides.override_price_1kg,
  overrides.currency,
  overrides.is_active as has_active_override,
  public.catalog_variants_public(items.product_id, items.details) as details
from public.product_catalog_items items
left join public.product_catalog_state state on state.product_id = items.product_id
left join public.product_price_overrides overrides
  on overrides.product_id = items.product_id
 and overrides.is_active = true;
