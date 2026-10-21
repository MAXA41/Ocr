# Supabase Migration Required

## Problem
After deploying custom pricing variants feature, Supabase schema needs to be updated to support:
- `override_price_merch` - Price for merchandise items
- `override_price_piece` - Price for piece/packet items
- `custom_unit` - Custom measurement text (e.g., "50g")
- `override_price_custom` - Price for custom measurement
- `custom_variants` - Boolean flag for variant tracking

## Error Message
```
Could not find the 'custom_unit' column of 'product_price_overrides' in the schema cache
```

This error means the table exists but is missing the new columns.

## Solution

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**

### Step 2: Run Migration
1. Open file: `docs/migration-add-pricing-variants-20261021.sql`
2. Copy the entire content
3. Paste into Supabase SQL Editor
4. Click **Run**

Expected result:
```
✅ Successfully executed
```

### Step 3: Verify Columns Added
1. Go to **Table Editor**
2. Select `product_price_overrides` table
3. Verify new columns exist:
   - `override_price_merch` (numeric)
   - `override_price_piece` (numeric)
   - `custom_unit` (text)
   - `override_price_custom` (numeric)
   - `custom_variants` (boolean)

### Step 4: Test Admin Panel
1. Go to admin panel
2. Fill out form with variant pricing:
   - Leave 250g and 1kg empty (optional)
   - Fill Merch price: 45
   - Click "Додати товар"
3. Should see success message
4. Product should appear in catalog

## What Changed

### Database Schema
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `override_price_merch` | numeric(10,2) | NULL | Merchandise pricing |
| `override_price_piece` | numeric(10,2) | NULL | Piece/packet pricing |
| `custom_unit` | text | NULL | Custom measurement (e.g., "50g") |
| `override_price_custom` | numeric(10,2) | NULL | Custom unit pricing |
| `custom_variants` | boolean | false | Flag for variant existence |

### Updated View
`product_catalog_public` view now includes all new columns so the storefront can display variant options.

## Rollback (if needed)

If something goes wrong, you can remove the columns:

```sql
alter table if exists public.product_price_overrides
  drop column if exists override_price_merch,
  drop column if exists override_price_piece,
  drop column if exists custom_unit,
  drop column if exists override_price_custom,
  drop column if exists custom_variants;
```

## FAQ

**Q: What if I run the migration twice?**
A: It's safe - uses `if not exists` so won't error.

**Q: Do existing products need updating?**
A: No - new columns default to NULL, existing products work fine.

**Q: When will this be needed?**
A: Immediately after deploying the custom pricing variants feature.

**Q: Can I use the admin panel before running migration?**
A: No - you'll get the "column not found" error when trying to save products.

## Support

If you get an error:
1. Copy the full error message
2. Check that you ran the entire migration script
3. Make sure you're in the correct Supabase project
4. Try running the migration again

---

**Файл для запуска:** `docs/migration-add-pricing-variants-20261021.sql`
