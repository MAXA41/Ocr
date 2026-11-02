-- Migration: Add gradation_variants column to product_price_overrides
-- Purpose: Store accessory size/type variations with individual prices and SKUs
-- Date: 2026-11-02

alter table public.product_price_overrides
  add column if not exists gradation_variants jsonb default '[]'::jsonb;

comment on column public.product_price_overrides.gradation_variants is 
'Array of gradation/accessory variant objects: [{name: "Black L", description: "Large size", price: 150, sku: "ACC-BLK-L-001"}, {name: "Red M", description: "Medium size", price: 125, sku: "ACC-RED-M-001"}]';

-- For discount_percent column in orders table (if not exists)
alter table public.orders
  add column if not exists discount_percent numeric(5, 2) check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));

comment on column public.orders.discount_percent is 'Applied discount percentage from customer tier';
