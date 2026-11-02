import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

if (!telegramBotToken) {
  console.error('Missing TELEGRAM_BOT_TOKEN')
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '')

// Store user state in memory (in production, use Redis or database)
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
      .select('fields, name_uk, variant_options')
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
  userStates.set(chatId, { action: 'adding_product', category: categoryId, data: {} })
  
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
  
  if (categoryData.variant_options && categoryData.variant_options.length > 0) {
    fieldsInfo += `\n🎨 Варіанти:\n`
    categoryData.variant_options.forEach((opt: any) => {
      fieldsInfo += `• ${opt.name_uk}\n`
    })
  }
  
  fieldsInfo += `\n📝 Спочатку відправте назву товару:`

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

async function downloadTelegramPhoto(fileId: string): Promise<string | null> {
  try {
    // Get file info from Telegram
    const fileInfoUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile`
    const fileInfoResponse = await fetch(fileInfoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    })
    
    const fileInfo = await fileInfoResponse.json()
    if (!fileInfo.ok || !fileInfo.result) {
      console.error('Failed to get file info:', fileInfo)
      return null
    }

    const filePath = fileInfo.result.file_path
    const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${filePath}`
    
    // Download the file
    const fileResponse = await fetch(fileUrl)
    const fileBlob = await fileResponse.blob()
    
    // Convert to base64 for storage
    const arrayBuffer = await fileBlob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    
    return `data:image/jpeg;base64,${base64}`
  } catch (error) {
    console.error('Error downloading photo:', error)
    return null
  }
}

async function handleProductInput(chatId: number, text: string) {
  const state = userStates.get(chatId)
  if (!state || state.action !== 'adding_product') {
    return
  }

  const fields = await getCategoryFields(state.category)
  if (!fields) return

  const fieldList = fields.fields || []
  const inputCount = Object.keys(state.data).length

  if (inputCount === 0) {
    // First input is product name
    state.data.name = text
    userStates.set(chatId, state)
    
    await sendTelegramMessage(
      chatId,
      `✅ Назва: <b>${text}</b>\n\nТепер введіть опис товару:`
    )
  } else if (inputCount === 1) {
    // Second input is description
    state.data.description = text
    userStates.set(chatId, state)
    
    await sendTelegramMessage(
      chatId,
      `✅ Опис збережено.\n\nТепер введіть ціну (в гривнях):`
    )
  } else if (inputCount === 2) {
    // Third input is price
    const price = parseInt(text)
    if (isNaN(price) || price < 0) {
      await sendTelegramMessage(chatId, '❌ Ціна повинна бути числом!')
      return
    }
    
    state.data.price = price
    state.awaitingPhoto = true
    userStates.set(chatId, state)
    
    // Ask for photo or additional fields
    if (fieldList.length > 0) {
      await sendTelegramMessage(
        chatId,
        `✅ Ціна: <b>${price} грн</b>\n\n📸 Надішліть фото товару (або /skip для пропуску):`
      )
    } else {
      await sendTelegramMessage(
        chatId,
        `✅ Ціна: <b>${price} грн</b>\n\n📸 Надішліть фото товару (або /skip для пропуску):`
      )
    }
  } else if (inputCount >= 3) {
    // Additional dynamic fields (after photo is handled)
    state.data[`field_${inputCount - 3}`] = text
    userStates.set(chatId, state)
    
    if (inputCount - 3 < fieldList.length - 1) {
      const nextField = fieldList[inputCount - 3]
      await sendTelegramMessage(
        chatId,
        `✅ Записано.\n\nТепер введіть: <b>${nextField.name_uk}</b>`
      )
    } else {
      // All fields complete, ask for photo again if not provided
      await sendTelegramMessage(
        chatId,
        `✅ Все основні дані введені!\n\n📸 Надішліть фото товару (або /skip для пропуску):`
      )
    }
  }
}

async function handlePhotoInput(chatId: number, photoFileId: string) {
  const state = userStates.get(chatId)
  if (!state || state.action !== 'adding_product') {
    return
  }

  try {
    await sendTelegramMessage(chatId, '⏳ Завантажую фото...')
    
    // Download and process photo
    const photoData = await downloadTelegramPhoto(photoFileId)
    
    if (!photoData) {
      await sendTelegramMessage(chatId, '❌ Не вдалось завантажити фото. Спробуйте ще раз.')
      return
    }

    state.data.photo = photoData
    state.awaitingPhoto = false
    userStates.set(chatId, state)
    
    await sendTelegramMessage(chatId, '✅ Фото завантажено!')
    
    // Check if we need additional fields
    const fields = await getCategoryFields(state.category)
    const fieldList = fields?.fields || []
    
    if (fieldList.length > 0 && !state.data.field_0) {
      const field = fieldList[0]
      await sendTelegramMessage(
        chatId,
        `Тепер введіть: <b>${field.name_uk}</b>`
      )
    } else {
      // Save product
      await saveProductFromBot(chatId, state)
    }
  } catch (error) {
    console.error('Error handling photo:', error)
    await sendTelegramMessage(chatId, '❌ Помилка при обробці фото. Спробуйте ще раз.')
  }
}

async function saveProductFromBot(chatId: number, state: any) {
  try {
    const { data, error } = await supabase
      .from('product_catalog_items')
      .insert([
        {
          name: state.data.name,
          description: state.data.description,
          category: state.category,
          price: state.data.price,
          is_available: true,
          extra_data: state.data,
        },
      ])
      .select()

    if (error) throw error

    const productId = data[0].id
    userStates.delete(chatId)

    await sendTelegramMessage(
      chatId,
      `✅ <b>Товар успішно додано!</b>\n\n` +
      `📦 Назва: ${state.data.name}\n` +
      `💵 Ціна: ${state.data.price} грн\n` +
      `🆔 ID: <code>${productId}</code>\n\n` +
      `Товар доступний на сайті!`
    )
  } catch (error) {
    await sendTelegramMessage(
      chatId,
      `❌ Помилка при збереженні товару:\n<code>${error.message}</code>`
    )
  }
}

Deno.serve(async (req: Request) => {
  try {
    const update = await req.json()
    const message = update.message
    const callbackQuery = update.callback_query

    if (message) {
      const chatId = message.chat.id
      const text = message.text
      const photo = message.photo

      if (text === '/start') {
        await handleStart(chatId)
      } else if (text === '/list') {
        await handleListProducts(chatId)
      } else if (text === '/stats') {
        await handleStats(chatId)
      } else if (text === '/add') {
        await handleAddProduct(chatId)
      } else if (text === '/skip') {
        // Handle skip photo
        const state = userStates.get(chatId)
        if (state && state.awaitingPhoto) {
          state.awaitingPhoto = false
          userStates.set(chatId, state)
          await saveProductFromBot(chatId, state)
        }
      } else if (photo && userStates.has(chatId)) {
        // Handle photo upload
        const state = userStates.get(chatId)
        if (state && state.awaitingPhoto) {
          // Get the largest photo size
          const largestPhoto = photo[photo.length - 1]
          await handlePhotoInput(chatId, largestPhoto.file_id)
        } else if (state && state.action === 'adding_product') {
          // Photo when not expecting it - queue it for saving
          const largestPhoto = photo[photo.length - 1]
          await handlePhotoInput(chatId, largestPhoto.file_id)
        }
      } else if (userStates.has(chatId)) {
        // User is in the middle of adding a product
        await handleProductInput(chatId, text)
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
