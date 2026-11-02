import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Ошибка: Отсутствуют переменные окружения!')
  console.error(`TOKEN: ${TOKEN ? 'OK' : 'MISSING'}`)
  console.error(`SUPABASE_URL: ${SUPABASE_URL ? 'OK' : 'MISSING'}`)
  console.error(`SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? 'OK' : 'MISSING'}`)
  process.exit(1)
}

const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let updateOffset = 0

console.log('🚀 Инициализация бота...')
console.log(`✅ TOKEN: ${TOKEN.substring(0, 12)}...`)
console.log(`✅ Supabase подключен`)
console.log('')

// Простая функция для отправки сообщений
async function sendMsg(chatId, text) {
  console.log(`[SEND] Chat ${chatId}: ${text.substring(0, 50)}...`)
  
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    })
    
    const data = await res.json()
    if (data.ok) {
      console.log(`✅ Отправлено`)
    } else {
      console.log(`❌ Ошибка: ${data.description}`)
    }
  } catch (e) {
    console.error(`❌ sendMsg error: ${e.message}`)
  }
}

// Основной polling цикл
async function start() {
  console.log('⏳ Запуск polling цикла...\n')
  
  let retryCount = 0
  
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      console.log(`📡 getUpdates(offset=${updateOffset})...`)
      
      const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${updateOffset}&timeout=30`, {
        method: 'POST'
      })
      
      const data = await res.json()
      
      if (!data.ok) {
        if (data.description && data.description.includes('webhook')) {
          console.error(`⚠️ Webhook конфликт, жду 5 сек...`)
          await new Promise(r => setTimeout(r, 5000))
          retryCount++
          if (retryCount > 10) {
            console.error(`❌ Не получается удалить webhook после 10 попыток`)
            process.exit(1)
          }
          continue
        } else {
          console.error(`❌ API Error: ${data.description}`)
          await new Promise(r => setTimeout(r, 2000))
          continue
        }
      }
      
      retryCount = 0 // Сброс счётчика если успешно
      
      const updates = data.result || []
      console.log(`📊 Получено обновлений: ${updates.length}`)
      
      for (const update of updates) {
        console.log(`\n═══════════════════════════════════════`)
        console.log(`🔄 Update ID: ${update.update_id}`)
        
        // Обновляем offset
        updateOffset = update.update_id + 1
        
        // Обрабатываем message
        if (update.message && update.message.text) {
          const msg = update.message
          const chatId = msg.chat.id
          const userId = msg.from.id
          const username = msg.from.username || msg.from.first_name || `User${userId}`
          const text = msg.text
          
          console.log(`👤 From: ${username} (${userId})`)
          console.log(`💬 Text: ${text}`)
          console.log(`🔑 Chat: ${chatId}`)
          
          // Обработка команд
          if (text.startsWith('/')) {
            const cmd = text.split(' ')[0].slice(1).toLowerCase()
            console.log(`✨ Command: /${cmd}`)
            
            switch (cmd) {
              case 'start':
                await sendMsg(chatId, '👋 Привет! Это админ-бот товаров.\n\n/add - добавить товар\n/list - список товаров\n/stats - статистика')
                break
                
              case 'list': {
                console.log('🔍 Загружаю товары из Supabase...')
                const { data: products, error } = await supabase
                  .from('product_catalog_items')
                  .select('id, name, description')
                  .limit(10)
                
                if (error) {
                  console.error(`❌ DB Error: ${error.message}`)
                  await sendMsg(chatId, `❌ Ошибка БД: ${error.message}`)
                } else {
                  if (products.length === 0) {
                    await sendMsg(chatId, '📦 Товаров нет')
                  } else {
                    let text = '📦 Товары:\n\n'
                    products.forEach((p, i) => {
                      text += `${i+1}. **${p.name}**\n${p.description || 'нет описания'}\n\n`
                    })
                    await sendMsg(chatId, text)
                  }
                }
                break
              }
                
              case 'stats': {
                console.log('🔍 Загружаю статистику...')
                const { data: products, error } = await supabase
                  .from('product_catalog_items')
                  .select('id, is_available')
                
                if (error) {
                  await sendMsg(chatId, `❌ Ошибка: ${error.message}`)
                } else {
                  const available = products.filter(p => p.is_available).length
                  const text = `📊 Статистика\n📦 Всего: ${products.length}\n✅ Доступных: ${available}\n❌ Недоступных: ${products.length - available}`
                  await sendMsg(chatId, text)
                }
                break
              }
                
              case 'add':
                await sendMsg(chatId, '📝 Отправьте описание товара в формате:\nНазвание | Описание')
                break
                
              default:
                await sendMsg(chatId, `❓ Команда /${cmd} не найдена`)
            }
          }
          
          // Обработка обычных сообщений
          else if (text.includes('|')) {
            const [name, description] = text.split('|').map(s => s.trim())
            console.log(`➕ Добавляю товар: ${name}`)
            
            const { data, error } = await supabase
              .from('product_catalog_items')
              .insert({
                name: name,
                description: description,
                is_available: true
              })
              .select()
            
            if (error) {
              console.error(`❌ Insert error: ${error.message}`)
              await sendMsg(chatId, `❌ Ошибка при добавлении: ${error.message}`)
            } else {
              await sendMsg(chatId, `✅ Товар добавлен!\n📦 ${data[0].name}\n📝 ${data[0].description}`)
            }
          }
        }
      }
      
      if (updates.length === 0) {
        console.log('📭 Нет новых обновлений\n')
      }
      
    } catch (error) {
      console.error(`❌ FATAL: ${error.message}`)
      console.error(error.stack)
      await new Promise(r => setTimeout(r, 2000))
    }
  }
}

// Запуск
start().catch(e => {
  console.error('❌ Bот умер:', e.message)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n✅ Бот остановлен')
  process.exit(0)
})
