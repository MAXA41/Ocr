# Укрпошта Delivery Method

## Overview

Укрпошта (Ukrainian Post) delivery method has been added to the checkout system. This delivery option is simplified compared to Nova Poshta:

- **Fixed location**: Kyiv city only
- **Fixed department**: 02223
- **City field**: Auto-populated and disabled (not required)
- **Delivery details**: Pre-filled with "Київ, відділення 02223"

## Files Modified

### `delivery.html`
- Added new `<option value="ukrposhta">Укрпошта: відділення Київ</option>` in the delivery method select
- Updated hero panel text to mention Укрпошта alongside Nova Poshta
- Updated footer to include Укрпошта as an available delivery method

### `js/site.js`

#### 1. `checkoutLabels` Object (line 1610)
Added Укрпошта label:
```javascript
'ukrposhta': 'Укрпошта: відділення Київ',
```

#### 2. `getDeliveryFieldConfig()` Function (line 2280)
Added Укрпошта configuration:
```javascript
if (deliveryMethod === 'ukrposhta') {
  return {
    cityLabel: 'Місто',
    detailsLabel: 'Відділення Укрпошти',
    detailsPlaceholder: 'Київ, відділення 02223',
    cityRequired: false,
  };
}
```

#### 3. `syncDeliveryFields()` Function (line 2316)
Added Укрпошта handling:
```javascript
else if (deliveryMethod === 'ukrposhta') {
  // Sets city to 'Київ' and disables city input
  // Auto-fills deliveryDetails with 'Київ, відділення 02223'
  // Hides delivery location autocomplete
  // Shows deliveryDetails field for user reference
}
```

## User Experience

When a customer selects "Укрпошта: відділення Київ":

1. **City field** is automatically populated with "Київ" and disabled
2. **Delivery details field** displays "Київ, відділення 02223" (read-only for display)
3. **No autocomplete** is shown for delivery locations
4. A hint message states: "Доставка Укрпоштою доступна тільки до Киева, відділення 02223"

## Backend Integration

The order submission payload will include:
```javascript
{
  deliveryMethod: 'ukrposhta',
  city: 'Київ',
  deliveryDetails: 'Київ, відділення 02223',
  deliveryMethodLabel: 'Укрпошта: відділення Київ'
}
```

This payload is sent to both:
- Supabase (if configured)
- n8n webhook for order processing
- Mono payment webhook (for payment orders)

## Order Workflow Notes

For n8n and order processing systems:
- Treat 'ukrposhta' as a valid delivery method alongside 'nova-branch', 'nova-locker', 'courier', and 'pickup'
- City is always 'Київ'
- Department is always '02223'
- No additional location selection is needed

## Testing Checklist

- [ ] Delivery method dropdown shows "Укрпошта: відділення Київ"
- [ ] Selecting Укрпошта auto-fills city with "Київ"
- [ ] City field is disabled when Укрпошта is selected
- [ ] Delivery details shows "Київ, відділення 02223"
- [ ] No delivery location autocomplete appears
- [ ] Form can be submitted with Укрпошта selected
- [ ] Order payload includes correct deliveryMethod, city, and deliveryDetails
- [ ] Order appears in n8n webhook with all details
- [ ] Mono payment integration works with Укрпошта orders

## Related Documentation

- [delivery.html](/delivery.html) - Checkout form
- [js/site.js](/js/site.js) - Delivery logic and form handling
- [docs/n8n-order-flow.md](/docs/n8n-order-flow.md) - Order webhook configuration
