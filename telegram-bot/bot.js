import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env')
  process.exit(1)
}

const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let updateOffset = 0

console.log('=' .repeat(50))
console.log('🤖 TELEGRAM BOT - Simple Polling Edition')
console.log('=' .repeat(50))
console.log(`✅ TOKEN loaded (${TOKEN.substring(0, 12)}...)`)
console.log(`✅ Supabase connected (${SUPABASE_URL.substring(0, 30)}...)`)
console.log('')

async function sendMsg(chatId, text) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    })
    console.log(`✅ [SEND] Chat ${chatId}: ${text.substring(0, 40)}...`)
  } catch (e) {
    console.error(`❌ [SEND ERROR] ${e.message}`)
  }
}

async function poll() {
  console.log(`\n📡 Poll cycle (offset: ${updateOffset})`)
  
  try {
    const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${updateOffset}&timeout=30`, {
      method: 'GET',
      timeout: 35000
    })
    
    const data = await res.json()
    
    if (!data.ok) {
      console.error(`❌ [API] ${data.description}`)
      return
    }
    
    const updates = data.result || []
    if (updates.length === 0) {
      console.log(`📭 No updates`)
      return
    }
    
    console.log(`📨 Got ${updates.length} updates`)
    
    for (const update of updates) {
      updateOffset = Math.max(updateOffset, update.update_id + 1)
      
      if (!update.message?.text) continue
      
      const msg = update.message
      const text = msg.text.trim()
      const chatId = msg.chat.id
      const userId = msg.from.id
      const name = msg.from.first_name || 'User'
      
      console.log(`\n📩 [MSG] @${name} (${userId}): ${text}`)
      console.log(`   Chat: ${chatId}`)
      
      // Обработка команд
      if (text.startsWith('/start')) {
        const reply = `<b>👋 Admin Panel - Product Manager</b>\n\n` +
                      `<b>Commands:</b>\n` +
                      `/list - Show all products\n` +
                      `/stats - Show statistics\n` +
                      `/add - Add new product\n` +
                      `/help - Show help`
        await sendMsg(chatId, reply)
      }
      
      else if (text.startsWith('/list')) {
        console.log(`🔄 Fetching products...`)
        const { data: products, error } = await supabase
          .from('product_catalog_items')
          .select('id, name, description, is_available')
          .limit(20)
        
        if (error) {
          console.error(`❌ [DB] ${error.message}`)
          await sendMsg(chatId, `❌ Database error: ${error.message}`)
        } else if (!products || products.length === 0) {
          await sendMsg(chatId, `📦 No products in catalog`)
        } else {
          let reply = `<b>📦 Product List (${products.length}):</b>\n\n`
          products.forEach((p, i) => {
            const status = p.is_available ? '✅' : '❌'
            reply += `${i+1}. <b>${p.name}</b> ${status}\n   ${p.description || '(no description)'}\n\n`
          })
          await sendMsg(chatId, reply)
        }
      }
      
      else if (text.startsWith('/stats')) {
        console.log(`🔄 Calculating stats...`)
        const { data: products, error } = await supabase
          .from('product_catalog_items')
          .select('id, is_available')
        
        if (error) {
          await sendMsg(chatId, `❌ Error: ${error.message}`)
        } else {
          const total = products?.length || 0
          const available = products?.filter(p => p.is_available).length || 0
          const reply = `<b>📊 Statistics</b>\n\n` +
                        `Total: <b>${total}</b>\n` +
                        `Available: <b>${available}</b> ✅\n` +
                        `Unavailable: <b>${total - available}</b> ❌`
          await sendMsg(chatId, reply)
        }
      }
      
      else if (text.startsWith('/add')) {
        await sendMsg(chatId, `📝 Send product info in format:\n<code>Name | Description</code>`)
      }
      
      else if (text.includes('|')) {
        const [name, desc] = text.split('|').map(s => s.trim())
        console.log(`➕ Adding product: ${name}`)
        
        const { data: result, error } = await supabase
          .from('product_catalog_items')
          .insert({ name, description: desc, is_available: true })
          .select()
        
        if (error) {
          console.error(`❌ [INSERT] ${error.message}`)
          await sendMsg(chatId, `❌ Failed: ${error.message}`)
        } else if (result?.length > 0) {
          const p = result[0]
          const reply = `✅ <b>Product Added!</b>\n\n` +
                        `<b>${p.name}</b>\n` +
                        `${p.description}\n\n` +
                        `ID: <code>${p.id}</code>`
          await sendMsg(chatId, reply)
        }
      }
      
      else if (text.startsWith('/help')) {
        const reply = `<b>🆘 Help</b>\n\n` +
                      `/start - Menu\n` +
                      `/list - Products\n` +
                      `/stats - Stats\n` +
                      `/add - Add product\n` +
                      `\nTo add: <code>Name | Desc</code>`
        await sendMsg(chatId, reply)
      }
      
      else {
        await sendMsg(chatId, `🤔 Unknown command. Try /help`)
      }
    }
    
  } catch (error) {
    console.error(`❌ [FATAL] ${error.message}`)
  }
  
  // Next poll in 1 second
  setTimeout(poll, 1000)
}

console.log('🚀 Starting polling...\n')
poll().catch(e => {
  console.error(`💀 Bot crashed: ${e.message}`)
  process.exit(1)
})

process.on('SIGINT', () => {
  console.log('\n\n✅ Bot stopped gracefully')
  process.exit(0)
})
