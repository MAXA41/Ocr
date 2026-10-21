# Custom Pricing Variants Guide

## Overview

The admin panel now supports multiple pricing variants for products beyond the standard 250g and 1kg measurements. This allows selling products in different formats:

1. **Merch pricing** (per-unit without measurement) - For items without weight measurement
2. **Piece pricing** (per-unit packets/pieces) - For drip bags, filter packets, etc.
3. **Custom measurement** (arbitrary units) - For any custom measurement (e.g., 50g, 100ml, etc.)

## When to Use Each Variant

### Merch Pricing (Ціна за штуку мерч)
- **Use for:** Merchandise without weight (cups, mugs, accessories, branded items)
- **Example:** A coffee cup priced at 45 UAH per unit
- **In checkout:** Shows as "1 шт." (1 unit) option

### Piece Pricing (Ціна за штуку пакетик)
- **Use for:** Pre-packaged items that aren't measured by weight (drip bags, filter packets)
- **Example:** A drip bag box priced at 65 UAH per unit
- **In checkout:** Shows as "1 шт." (1 unit) option

### Custom Unit (Кастомна міра)
- **Use for:** Non-standard measurements (e.g., 50g, 100ml, sample pack, etc.)
- **Required:** Must fill in BOTH the custom unit text and the price
- **Example:** "50g" for 150 UAH
- **In checkout:** Shows as "50g" option

## How to Add Custom Variants

### When Creating a New Product

1. Go to **Admin Panel** → **Додати новий товар** (Add New Product)
2. Fill in required fields (Name, Description, Image, Base Prices)
3. Scroll to **"Додаткові варіанти упаковки (опціонально)"** section
4. Enter prices for any variants you need:
   - **Ціна за штуку (мерч)** - Leave empty if not applicable
   - **Ціна за штуку (пакетик)** - Leave empty if not applicable
   - **Кастомна міра** - Enter the measurement (e.g., "50g") if applicable
   - **Ціна за кастомну міру** - Required if custom unit is filled in
5. Click "Додати товар" to create product with variants

### When Editing an Existing Product

1. Go to **Admin Panel** → Find the product
2. Click on the product card to expand editing panel
3. Scroll to **"Додаткові варіанти упаковки"** section
4. Enter or modify variant prices as needed
5. Click "Зберегти" (Save) to update product

## Technical Details

### Database Columns
- `override_price_merch` - Price for merch items
- `override_price_piece` - Price for piece/packet items
- `custom_unit` - Custom measurement text (e.g., "50g")
- `override_price_custom` - Price for custom measurement
- `custom_variants` - JSON array storing active variants

### How Variants Are Saved
When you fill in variant prices, they are stored in the `product_price_overrides` table:
- Empty fields are saved as `null`
- Only non-null variants appear in checkout
- The system automatically validates prices

### Frontend Display
The storefront (`js/site.js`) displays all non-null price variants as selectable options in the product purchase modal. Customers can choose between 250g, 1kg, merch, piece, or custom measurement options.

## Important Notes

- **Base prices (250g/1kg) are required** - Custom variants are optional additions
- **Custom unit requires custom price** - You cannot set a custom unit without a price
- **No measurement confusion** - Each variant clearly indicates its unit, so customers always know what they're buying
- **Backward compatible** - Products without variants continue to work as before
- **Supabase sync** - All variants are saved to Supabase and available immediately on the live site

## Examples

### Example 1: Coffee with Merch
```
Base: 250g @ 320 UAH, 1kg @ 1290 UAH
Merch: Coffee cup @ 45 UAH
```

### Example 2: Coffee with Sample Size
```
Base: 250g @ 320 UAH, 1kg @ 1290 UAH
Custom: 50g @ 85 UAH
```

### Example 3: Drip Bags
```
Base: 250g @ 320 UAH (ignored for drip bags)
Piece: Drip bag box @ 65 UAH
Custom: Single drip bag @ 12 UAH
```

## Troubleshooting

### "Why aren't my custom variants showing in the store?"
- Verify all prices are filled in correctly
- Make sure the product is marked as "Показувати в продажу" (Show in sale)
- Clear browser cache and refresh the page

### "Can I have multiple custom units for one product?"
- Currently, only one custom unit per product is supported
- If you need multiple custom measurements, consider creating separate products

### "I want to change pricing - what happens to existing orders?"
- Changes only affect new orders
- Existing confirmed orders retain their original prices
- There's an order history log in customer accounts
