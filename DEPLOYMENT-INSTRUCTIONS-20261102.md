# Deployment Instructions - November 2, 2026

## Changes Summary

This deployment includes three major bug fixes:

### 1. Discount Tier System (✅ COMPLETE)
- Customers now receive automatic discounts based on their accumulated purchase history
- Discount tiers: Base (0%), Bronze (3%), Silver (5%), Gold (7%), Black (10%)
- System calculates from customer's previous orders total in Supabase
- Best discount wins (promotional code discount vs accumulated tier discount)
- Discount percentage stored in orders table

### 2. Image Selection in Admin Panel (✅ ENHANCED)
- Fixed datalist for product image suggestions
- Added detailed console logging for debugging
- Improved error handling
- Images load from `/public/images-list.json`
- Folder filtering now works properly

### 3. Accessory Gradation Variants (✅ NEW)
- Admin can now define size/type/price/SKU combinations for accessories
- New UI form section "Варіанти градацій" (shows only for accessories category)
- Supports unlimited gradation rows with individual prices and SKUs
- Data stored as JSON array in `gradation_variants` column

---

## Database Changes Required

### Step 1: Apply SQL Migration to Supabase

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Add gradation_variants column to product_price_overrides
alter table public.product_price_overrides
  add column if not exists gradation_variants jsonb default '[]'::jsonb;

comment on column public.product_price_overrides.gradation_variants is 
'Array of gradation/accessory variant objects: [{name: "Black L", description: "Large size", price: 150, sku: "ACC-BLK-L-001"}, {name: "Red M", description: "Medium size", price: 125, sku: "ACC-RED-M-001"}]';
```

**Note:** The `discount_percent` column already exists in the `orders` table, so no migration needed there.

### Step 2: Verify Columns Exist

In Supabase Dashboard, check:
1. **product_price_overrides** table has `gradation_variants` column (JSONB type)
2. **orders** table has both `discount_percent` and `discount_amount` columns (NUMERIC type)

---

## Code Changes (Already Applied)

### Files Modified:
1. **js/site.js**
   - Added `getDiscountTierForAccumulation()` function
   - Updated `calculateCartPricing()` to accept accumulation discount parameter
   - Added `getCustomerAccumulationDiscount()` async function
   - Loads customer's accumulated order total from Supabase on checkout
   - Stores `discountPercent` in order payload

2. **js/account.js**
   - Added gradation variants form UI section (hidden for non-accessories)
   - Added event handlers for add/remove gradation buttons
   - Updated product loading to fetch `gradation_variants` from Supabase
   - Modified save handler to collect and store gradation data
   - Added category change handler to show/hide gradations section

3. **account.html**
   - Enhanced image datalist loading script with better error handling
   - Added focus event listener for datalist activation
   - Improved console logging for debugging

---

## Testing Checklist

### Local Testing (http://localhost:5173):

- [ ] Admin Panel:
  - [ ] Login as admin (check `catalog_admins` table)
  - [ ] Edit an accessory product
  - [ ] Verify "Варіанти градацій" section appears only for accessories
  - [ ] Add 3 gradation variants with names, descriptions, prices, SKUs
  - [ ] Save and reload - verify gradations persist
  - [ ] Change category to "espresso" - section should hide
  - [ ] Change back to "accessories" - section should show again

- [ ] Image Selection:
  - [ ] Open admin product form
  - [ ] Click on image input field
  - [ ] Verify datalist suggestions appear in browser console
  - [ ] Check browser console (F12) for "✅ Updated image list" messages
  - [ ] Filter by folder and verify correct images show

- [ ] Checkout & Discount:
  - [ ] Create test account or login with existing account that has order history
  - [ ] Add items to cart
  - [ ] Go to checkout
  - [ ] Browser console should show discount calculation
  - [ ] Verify discount amount displays correctly
  - [ ] Complete order (test mode)
  - [ ] Check order record in Supabase - `discount_percent` should be populated

### Production Testing (After Deployment):

1. **Discount Verification:**
   - [ ] Customer with no prior orders: 0% discount
   - [ ] Customer with €500+ accumulated: 3% (Bronze tier)
   - [ ] Customer with €2000+ accumulated: 5% (Silver tier)
   - [ ] Customer with €5000+ accumulated: 7% (Gold tier)
   - [ ] Customer with €10000+ accumulated: 10% (Black tier)
   - [ ] Customer with promo code vs tier - best discount applied
   - [ ] Check n8n webhook receives `discount_percent` in payload
   - [ ] Verify Telegram notification includes discount info

2. **Admin Features:**
   - [ ] Can edit accessories and add gradation variants
   - [ ] Gradation data saves to Supabase correctly
   - [ ] No JavaScript errors in console
   - [ ] All buttons work (add/remove gradations)

3. **Customer Experience:**
   - [ ] Discount displays in personal cabinet
   - [ ] Discount shows in order history
   - [ ] Discount calculation doesn't break checkout flow

---

## Rollback Plan (If Issues Occur)

If problems arise with discount system:
```bash
git revert 0a7a04b  # Revert the commit
git push origin main
```

Database changes are additive (new columns only), so no rollback SQL needed.

---

## Notes

- Discount system only applies to logged-in users (checks `currentSupabaseSession?.user?.id`)
- Guest checkouts do not receive tier discounts
- Promo codes still work and are checked against tier discount (best wins)
- Gradation variants are optional - products without gradations work normally
- Migration includes `if not exists` clauses, so safe to run multiple times

---

## Files to Deploy

```
js/site.js
js/account.js
account.html
docs/supabase-schema.sql (updated with gradation_variants)
docs/migration-add-gradation-variants-20261102.sql
```

**Deployed via:** GitHub Pages workflow (automatically picks up changes to main branch)
