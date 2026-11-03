# Admin Form - Product Addition Issue Debugging Guide

## Issue
Admin panel form (`admin-product-form.html`) for adding products was failing with HTTP 401 errors and "Invalid API key" / "No API key found in request" messages.

## Root Cause - FIXED ✅
**Authorization Header Format Error**
- ❌ **Before**: Using deprecated `apikey` header format
  ```javascript
  headers: {
    'apikey': SUPABASE_KEY,  // Wrong!
    ...
  }
  ```

- ✅ **After**: Using correct `Authorization: Bearer` format
  ```javascript
  headers: {
    'Authorization': 'Bearer ' + SUPABASE_KEY,  // Correct!
    ...
  }
  ```

**Changed Files:**
- `admin-product-form.html` (lines 735, 804)
- Both `product_catalog_items` and `product_variants` endpoints updated

**Commit:** `2756ac4` - "Fix: Use correct Supabase REST API Authorization header"

## Remaining Issue 🔴
Despite fixing the Authorization header format, the browser console still shows:
```
Error: No API key found in request
```

This indicates one of the following:
1. **Supabase RLS Policies** - Row Level Security policies may not allow INSERT for anonymous users
2. **Invalid Credentials** - The API key may be expired or invalid
3. **CORS Issue** - Cross-Origin Resource Sharing policy might be blocking the request
4. **Database Schema** - Table `product_catalog_items` may not exist or have wrong structure

## Next Steps to Debug

### Step 1: Verify Supabase RLS Policies
```
1. Log in to Supabase Dashboard
2. Navigate to: project → Authentication → Policies
3. Check table `product_catalog_items`
4. Verify INSERT policy allows:
   - Role: 'anon'  (public/anonymous user)
   - OR the current user role
```

### Step 2: Verify Table Structure
```sql
-- In Supabase SQL Editor, run:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'product_catalog_items';
```

Expected columns:
- `id` (UUID, Primary Key)
- `name` (TEXT)
- `description` (TEXT)  
- `category` (TEXT)
- `price` (INTEGER)
- `image_url` (TEXT, nullable)
- `is_available` (BOOLEAN)
- `extra_data` (JSONB, nullable)

### Step 3: Test REST API Access Directly
```bash
# Test READ access (should work)
curl -X GET \
  "https://sxxlotfbcblnjgcvxaqe.supabase.co/rest/v1/product_catalog_items?limit=1" \
  -H "Authorization: Bearer sb_publishable_6Sqqk08Zt_txQFQJeacUhg_OPTpNLxf" \
  -H "Content-Type: application/json"

# Test INSERT access (may fail due to RLS)
curl -X POST \
  "https://sxxlotfbcblnjgcvxaqe.supabase.co/rest/v1/product_catalog_items" \
  -H "Authorization: Bearer sb_publishable_6Sqqk08Zt_txQFQJeacUhg_OPTpNLxf" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "description": "Test",
    "category": "espresso",
    "price": 100,
    "is_available": true
  }'
```

### Step 4: Alternative Solution - Use Edge Function
If REST API fails due to RLS restrictions, create an Edge Function instead:

```typescript
// supabase/functions/add-product/index.ts
import { createClient } from '@supabase/supabase-js'

export async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  
  const supabase = createClient(
    Deno.env.get('SB_URL') || '',
    Deno.env.get('SB_SERVICE_ROLE_KEY') || ''  // Use service role for full access
  )
  
  const data = await req.json()
  
  const { data: product, error } = await supabase
    .from('product_catalog_items')
    .insert([data])
    .select()
  
  if (error) return new Response(JSON.stringify(error), { status: 400 })
  return new Response(JSON.stringify(product), { status: 201 })
}
```

Then update the form to call the function instead of REST API directly:
```javascript
const response = await fetch(`${SUPABASE_URL}/functions/v1/add-product`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(productData),
})
```

## Environment Info
- **Supabase URL:** https://sxxlotfbcblnjgcvxaqe.supabase.co
- **Supabase Project ID:** sxxlotfbcblnjgcvxaqe
- **API Key Used:** `sb_publishable_*` (anonymous/public key)

## Related Files
- Main form: `admin-product-form.html`
- Form guide: `docs/ADMIN-PANEL-GUIDE-UK.md`
- Admin quick start: `docs/ADMIN-QUICK-START-UK.md`
- Password guide: `docs/ADMIN-PANEL-PASSWORD-GUIDE-UK.md`

## Status
- ✅ Authorization header format fixed
- ✅ Code committed to git
- 🔴 Product addition still fails - requires RLS policy review
- 📋 Awaiting Supabase configuration verification
