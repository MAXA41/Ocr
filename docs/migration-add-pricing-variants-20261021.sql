-- Migration: Add custom pricing variant columns to product_price_overrides
-- Date: 2026-10-21
-- Purpose: Support merch, piece, and custom unit pricing variants

-- Add new columns for variant pricing
alter table if exists public.product_price_overrides
  add column if not exists override_price_merch numeric(10, 2) check (override_price_merch is null or override_price_merch >= 0),
  add column if not exists override_price_piece numeric(10, 2) check (override_price_piece is null or override_price_piece >= 0),
  add column if not exists custom_unit text,
  add column if not exists override_price_custom numeric(10, 2) check (override_price_custom is null or override_price_custom >= 0),
  add column if not exists custom_variants boolean not null default false;

-- Create or update view to include new columns
drop view if exists public.product_catalog_public;

create view public.product_catalog_public as
select
  p.product_id,
  p.name,
  p.description,
  p.category,
  p.image,
  p.alt,
  p.price,
  p.weight,
  p.country,
  p.region,
  p.origin,
  p.processing,
  p.featured,
  p.raw_data,
  s.is_available,
  s.stock_quantity,
  s.sold_quantity,
  pr.override_price,
  pr.override_price_250g,
  pr.override_price_1kg,
  pr.override_price_merch,
  pr.override_price_piece,
  pr.custom_unit,
  pr.override_price_custom,
  pr.custom_variants,
  pr.currency,
  pr.is_active as price_overrides_active,
  to.name_override,
  to.description_override,
  to.image_override,
  to.origin_override,
  to.processing_override,
  to.alt_override,
  to.taste_override,
  to.cup_profile_override,
  to.brew_guide_override,
  to.audience_override,
  to.is_active as text_overrides_active,
  p.created_at,
  p.updated_at
from public.product_catalog_items p
left join public.product_catalog_state s on p.product_id = s.product_id
left join public.product_price_overrides pr on p.product_id = pr.product_id
left join public.product_text_overrides to on p.product_id = to.product_id
order by p.featured desc, p.name asc;

grant select on public.product_catalog_public to anon, authenticated;

-- Add comments for documentation
comment on column public.product_price_overrides.override_price_merch is 'Price for merchandise (per-unit without measurement)';
comment on column public.product_price_overrides.override_price_piece is 'Price for pieces/packets (drip bags, filter packets)';
comment on column public.product_price_overrides.custom_unit is 'Custom measurement unit (e.g., 50g, 100ml)';
comment on column public.product_price_overrides.override_price_custom is 'Price for custom measurement unit';
comment on column public.product_price_overrides.custom_variants is 'Flag indicating custom variants exist';
