import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID')!

// Remove the unused supabase client creation

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    const { record, old_record, type, table } = payload

    // Determine action and format message
    let action = ''
    let message = ''

    if (type === 'INSERT') {
      action = '✨ Створено'
      const tableName = table === 'product_catalog_items' ? 'Продукт' :
                       table === 'product_price_overrides' ? 'Ціна' :
                       table === 'orders' ? 'Замовлення' : table
      message = `${action}\n📊 ${tableName}\n`
      
      if (table === 'product_catalog_items') {
        message += `📝 ${record.name || 'N/A'}\n`
      } else if (table === 'product_price_overrides') {
        message += `💰 SKU: ${record.sku || 'N/A'}\n💵 Ціна: ${record.price || 'N/A'}\n`
      } else if (table === 'orders') {
        message += `📦 Замовлення #${record.id || 'N/A'}\n`
      }
    } else if (type === 'UPDATE') {
      action = '✏️ Оновлено'
      const tableName = table === 'product_catalog_items' ? 'Продукт' :
                       table === 'product_price_overrides' ? 'Ціна' :
                       table === 'orders' ? 'Замовлення' : table
      message = `${action}\n📊 ${tableName}\n`

      // Show what changed
      if (table === 'product_catalog_items') {
        if (old_record.name !== record.name) {
          message += `📝 Ім'я: ${old_record.name} → ${record.name}\n`
        }
        if (old_record.is_available !== record.is_available) {
          message += `📦 Доступність: ${old_record.is_available} → ${record.is_available}\n`
        }
      } else if (table === 'product_price_overrides') {
        if (old_record.price !== record.price) {
          message += `💰 Ціна: ${old_record.price} → ${record.price}\n`
        }
        if (old_record.sku !== record.sku) {
          message += `🏷️ SKU: ${old_record.sku} → ${record.sku}\n`
        }
      } else if (table === 'orders') {
        if (old_record.status !== record.status) {
          message += `📍 Статус: ${old_record.status} → ${record.status}\n`
        }
        if (old_record.total_price !== record.total_price) {
          message += `💵 Сума: ${old_record.total_price} → ${record.total_price}\n`
        }
      }
    } else if (type === 'DELETE') {
      action = '❌ Видалено'
      const tableName = table === 'product_catalog_items' ? 'Продукт' :
                       table === 'product_price_overrides' ? 'Ціна' :
                       table === 'orders' ? 'Замовлення' : table
      message = `${action}\n📊 ${tableName}\n`
      
      if (table === 'product_catalog_items') {
        message += `📝 ${old_record.name || 'N/A'}\n`
      } else if (table === 'product_price_overrides') {
        message += `💰 SKU: ${old_record.sku || 'N/A'}\n`
      } else if (table === 'orders') {
        message += `📦 Замовлення #${old_record.id || 'N/A'}\n`
      }
    }

    message += `⏰ ${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}\n`

    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    const telegramData = await telegramResponse.json()

    if (!telegramResponse.ok) {
      throw new Error(`Telegram error: ${telegramData.description}`)
    }

    return new Response(JSON.stringify({ success: true, message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
