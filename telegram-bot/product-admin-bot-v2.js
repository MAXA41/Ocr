import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let offset = 0
const userState = new Map()

console.log('🤖 Telegram Bot запущен (Manual Polling)')
console.log(`🔐 Token: ${TOKEN.substring(0, 10)}...`)
console.log('')

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sendMessage(chatId, text, options = {}) {
  try {
    const url = `${TELEGRAM_API}/sendMessage`
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...options,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    if (!data.ok) {
      console.error('❌ Ошибка sendMessage:', data.description)
    }
    return data
  } catch (err) {
    console.error('❌ Ошибка при отправке сообщения:', err.message)
  }
}

async function getProducts() {
  try {
    const { data, error } = await supabase
      .from('product_catalog_items')
      .select('id, name, description, is_available')
      .order('name')

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('❌ Ошибка при получении товаров:', err.message)
    return []
  }
}

async function getProductById(id) {
  try {
    const { data, error } = await supabase
      .from('product_catalog_items')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('❌ Ошибка при получении товара:', err.message)
    return null
  }
}

async function createProduct(name, description) {
  try {
    const { data, error } = await supabase
      .from('product_catalog_items')
      .insert({
        name,
        description,
        is_available: true,
      })
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.error('❌ Ошибка при создании товара:', err.message)
    return null
  }
}

// ============================================
// AI ANALYSIS
// ============================================

async function aiAnalyzeProduct(userInput) {
  try {
    console.log('🧠 Отправляю в Ollama...')
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5-coder:1.5b',
        prompt: `Проанализируй это описание товара и помоги структурировать его:
        
Описание: "${userInput}"

Верни ТОЛЬКО JSON (без доп текста):
{
  "name": "Название",
  "description": "Описание (1-2 строки)",
  "category": "кофе/аксессуары/оборудование"
}`,
        stream: false,
      }),
    })

    const result = await response.json()
    const content = result.response.trim()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      console.log('✅ AI проанализировал:', parsed)
      return parsed
    }
    return null
  } catch (err) {
    console.error('❌ Ошибка AI:', err.message)
    return null
  }
}

// ============================================
// COMMAND HANDLERS
// ============================================

async function handleStart(chatId, userName) {
  console.log(`📨 /start от ${userName}`)

  const text = `👋 Добро пожаловать в *админ-панель товаров*!

🛍️ *Что я умею:*
✅ Добавлять товары (с помощью AI)
✅ Просматривать все товары
✅ Просмотр статистики

*Доступные команды:*
/add - добавить новый товар
/list - список всех товаров
/stats - статистика

Начнем? 🚀`

  await sendMessage(chatId, text)
}

async function handleAdd(chatId, userName) {
  console.log(`📨 /add от ${userName}`)
  userState.set(chatId, { step: 'awaiting_description' })

  const text = `📝 Отправьте описание товара

*Пример:*
Espresso Blend 250g, премиум из Эфиопии, средний помол

И я помогу структурировать информацию с помощью AI ✨`

  await sendMessage(chatId, text)
}

async function handleList(chatId, userName) {
  console.log(`📨 /list от ${userName}`)

  const products = await getProducts()

  if (products.length === 0) {
    await sendMessage(chatId, '📦 Товаров нет. Добавьте первый товар!')
    return
  }

  let listText = '📦 *Все товары:*\n\n'
  products.forEach((p, i) => {
    listText += `${i + 1}. *${p.name}*\n   ${p.description || 'нет описания'}\n   ${p.is_available ? '✅' : '❌'}\n\n`
  })

  await sendMessage(chatId, listText)
}

async function handleStats(chatId, userName) {
  console.log(`📨 /stats от ${userName}`)

  const products = await getProducts()
  const available = products.filter((p) => p.is_available).length

  const statsText = `📊 *Статистика каталога*

📦 Всего товаров: ${products.length}
✅ Доступных: ${available}
❌ Недоступных: ${products.length - available}`

  await sendMessage(chatId, statsText)
}

// ============================================
// MESSAGE HANDLER
// ============================================

async function handleTextMessage(chatId, userName, text) {
  console.log(`💬 Сообщение от ${userName}: "${text}"`)

  const state = userState.get(chatId)

  // Если пользователь ожидает описания товара
  if (state && state.step === 'awaiting_description') {
    console.log('🎯 Обрабатываю описание товара...')
    await sendMessage(chatId, '⏳ Анализирую описание с помощью AI...')

    const analyzed = await aiAnalyzeProduct(text)

    if (analyzed) {
      // Создаём товар
      const product = await createProduct(analyzed.name, analyzed.description)

      if (product) {
        userState.delete(chatId)

        const responseText = `✅ *Товар создан!*

📦 *Название:* ${product.name}
📝 *Описание:* ${product.description}
🏷️ *ID:* \`${product.id}\`
✅ *Статус:* Доступен`

        await sendMessage(chatId, responseText)
        console.log('✅ Товар создан:', product.name)
      } else {
        await sendMessage(chatId, '❌ Ошибка при сохранении товара')
      }
    } else {
      await sendMessage(chatId, '❌ Не удалось проанализировать описание. Попробуйте ещё раз.')
    }
  }
}

// ============================================
// POLLING
// ============================================

async function pollUpdates() {
  try {
    const url = `${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=30`

    const response = await fetch(url)
    const data = await response.json()

    if (data.ok && data.result.length > 0) {
      console.log(`📨 Получено ${data.result.length} обновлений`)

      for (const update of data.result) {
        offset = update.update_id + 1

        // Обработка команд
        if (update.message?.entities?.[0]?.type === 'bot_command') {
          const command = update.message.text.split(' ')[0].slice(1) // Убираем /
          const chatId = update.message.chat.id
          const userName = update.message.from.username || update.message.from.first_name

          switch (command) {
            case 'start':
              await handleStart(chatId, userName)
              break
            case 'add':
              await handleAdd(chatId, userName)
              break
            case 'list':
              await handleList(chatId, userName)
              break
            case 'stats':
              await handleStats(chatId, userName)
              break
            default:
              await sendMessage(chatId, `❓ Команда /${command} не найдена. Используйте /start для справки.`)
          }
        }
        // Обработка текстовых сообщений
        else if (update.message?.text) {
          const chatId = update.message.chat.id
          const userName = update.message.from.username || update.message.from.first_name
          const text = update.message.text

          await handleTextMessage(chatId, userName, text)
        }
      }
    }
  } catch (err) {
    console.error('❌ Ошибка в pollUpdates:', err.message)
  }

  // Продолжаем polling
  setTimeout(pollUpdates, 1000)
}

// Запуск
console.log('⏳ Слушаю входящие сообщения...')
console.log('')
pollUpdates()
