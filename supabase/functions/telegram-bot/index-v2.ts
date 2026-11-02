import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

if (!telegramBotToken) {
  console.error('Missing TELEGRAM_BOT_TOKEN')
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '')

// Store user state (in production, use Redis or database)
const userStates = new Map()

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: unknown) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup || undefined,
    }),
  })
  return response.json()
}

async function getCategories() {
  try {
    const { data } = await supabase
      .from('product_categories')
      .select('id, name_uk')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    return data || []
  } catch (e) {
    console.error('getCategories error:', e)
    return []
  }
}

async function getCategoryFields(categoryId: string) {
  try {
    const { data } = await supabase
      .from('product_categories')
      .select('fields, name_uk')
      .eq('id', categoryId)
      .single()
    return data
  } catch (e) {
    console.error('getCategoryFields error:', e)
    return null
  }
}

async function getProducts() {
  try {
    const { data } = await supabase
      .from('product_catalog_items')
      .select('id, name, description, is_available')
      .limit(20)
    return data || []
  } catch (e) {
    console.error('getProducts error:', e)
    return []
  }
}

async function getStats() {
  try {
    const { data } = await supabase
      .from('product_catalog_items')
      .select('id, is_available')
    
    if (!data) return { total: 0, available: 0 }
    
    const total = data.length
    const available = data.filter((p: any) => p.is_available).length
    return { total, available }
  } catch (e) {
    console.error('getStats error:', e)
    return { total: 0, available: 0 }
  }
}

async function handleStart(chatId: number) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📦 Список товарів', callback_data: 'cmd_list' },
        { text: '📊 Статистика', callback_data: 'cmd_stats' },
      ],
      [
        { text: '➕ Додати товар', callback_data: 'cmd_add' },
      ],
    ],
  }

  await sendTelegramMessage(
    chatId,
    '👋 Привіт! Я O.Roasters адмін-бот.\n\nОсновні команди:',
    keyboard
  )
}

async function handleAddProduct(chatId: number) {
  const categories = await getCategories()
  
  if (categories.length === 0) {
    await sendTelegramMessage(chatId, '❌ Немає доступних категорій товарів.')
    return
  }

  const keyboard = {
    inline_keyboard: categories.map((cat: any) => [
      {
        text: cat.name_uk,
        callback_data: `select_category:${cat.id}`,
      },
    ]),
  }

  await sendTelegramMessage(
    chatId,
    '📂 Виберіть категорію товару:',
    keyboard
  )
}

async function handleCategorySelection(chatId: number, categoryId: string) {
  userStates.set(chatId, { action: 'adding_product', category: categoryId })
  
  const categoryData = await getCategoryFields(categoryId)
  
  if (!categoryData) {
    await sendTelegramMessage(chatId, '❌ Категорія не знайдена.')
    return
  }

  let fieldsInfo = `📝 Додаємо товар: <b>${categoryData.name_uk}</b>\n\n`
  fieldsInfo += `Необхідні поля:\n`
  
  const fields = categoryData.fields || []
  fields.forEach((field: any, idx: number) => {
    const required = field.required ? ' (обов\'язково)' : ' (опційно)'
    fieldsInfo += `${idx + 1}. ${field.name_uk}${required}\n`
  })
  
  fieldsInfo += `\nОтправляйте значення по одному для кожного поля.`
  fieldsInfo += `\nНаприклад:\n<code>Назва товару</code>`

  await sendTelegramMessage(chatId, fieldsInfo)
}

async function handleListProducts(chatId: number) {
  const products = await getProducts()
  
  if (products.length === 0) {
    await sendTelegramMessage(chatId, '📦 Немає товарів.')
    return
  }

  let text = '📦 <b>Топ товарів (останні 20):</b>\n\n'
  products.forEach((p: any, idx: number) => {
    const status = p.is_available ? '✅' : '❌'
    text += `${idx + 1}. ${status} <b>${p.name}</b>\n`
    if (p.description) {
      text += `   <i>${p.description.substring(0, 50)}...</i>\n`
    }
    text += '\n'
  })

  await sendTelegramMessage(chatId, text)
}

async function handleStats(chatId: number) {
  const { total, available } = await getStats()
  
  const text = `📊 <b>Статистика магазину:</b>\n\n` +
    `📦 Всього товарів: <b>${total}</b>\n` +
    `✅ Доступних: <b>${available}</b>\n` +
    `❌ Недоступних: <b>${total - available}</b>`

  await sendTelegramMessage(chatId, text)
}

Deno.serve(async (req: Request) => {
  try {
    const update = await req.json()
    const message = update.message
    const callbackQuery = update.callback_query

    if (message) {
      const chatId = message.chat.id
      const text = message.text

      if (text === '/start') {
        await handleStart(chatId)
      } else if (text === '/list') {
        await handleListProducts(chatId)
      } else if (text === '/stats') {
        await handleStats(chatId)
      } else if (text === '/add') {
        await handleAddProduct(chatId)
      } else if (userStates.has(chatId)) {
        // User is in the middle of adding a product
        const state = userStates.get(chatId)
        await sendTelegramMessage(chatId, `📝 Записав: <code>${text}</code>\n\nІди далі...`)
      }
    }

    if (callbackQuery) {
      const chatId = callbackQuery.message.chat.id
      const data = callbackQuery.data

      if (data === 'cmd_list') {
        await handleListProducts(chatId)
      } else if (data === 'cmd_stats') {
        await handleStats(chatId)
      } else if (data === 'cmd_add') {
        await handleAddProduct(chatId)
      } else if (data.startsWith('select_category:')) {
        const categoryId = data.replace('select_category:', '')
        await handleCategorySelection(chatId, categoryId)
      }
    }

    return new Response('OK')
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
