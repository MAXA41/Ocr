import { Telegraf, Markup } from 'telegraf'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Инициализация
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// Обработчик ошибок
bot.catch((err, ctx) => {
  console.error('❌ Ошибка бота:', err)
  console.error('Context:', ctx)
})

// Логирование всех сообщений
bot.use((ctx, next) => {
  console.log(`📨 Сообщение от ${ctx.from?.username || ctx.from?.id}: "${ctx.message?.text || ctx.message?.command || 'нет текста'}"`)
  return next()
})

// Хранение состояния пользователя
const userState = new Map()

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getProducts() {
  try {
    const { data, error } = await supabase
      .from('product_catalog_items')
      .select('id, name, description, is_available')
      .order('name')

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Ошибка при получении товаров:', err)
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
    console.error('Ошибка при получении товара:', err)
    return null
  }
}

async function createProduct(name, description, imageUrl = null) {
  try {
    const { data, error } = await supabase
      .from('product_catalog_items')
      .insert({
        name,
        description,
        image_url: imageUrl,
        is_available: true,
      })
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.error('Ошибка при создании товара:', err)
    return null
  }
}

async function updateProduct(id, updates) {
  try {
    const { data, error } = await supabase
      .from('product_catalog_items')
      .update(updates)
      .eq('id', id)
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.error('Ошибка при обновлении товара:', err)
    return null
  }
}

async function deleteProduct(id) {
  try {
    const { error } = await supabase
      .from('product_catalog_items')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Ошибка при удалении товара:', err)
    return false
  }
}

async function getProductPrice(productId) {
  try {
    const { data, error } = await supabase
      .from('product_price_overrides')
      .select('price, sku')
      .eq('product_id', productId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  } catch (err) {
    console.error('Ошибка при получении цены:', err)
    return null
  }
}

async function updateProductPrice(productId, price, sku) {
  try {
    const existing = await getProductPrice(productId)

    if (existing) {
      const { data, error } = await supabase
        .from('product_price_overrides')
        .update({ price, sku, updated_at: new Date() })
        .eq('product_id', productId)
        .select()

      if (error) throw error
      return data?.[0] || null
    } else {
      const { data, error } = await supabase
        .from('product_price_overrides')
        .insert({
          product_id: productId,
          price,
          sku,
        })
        .select()

      if (error) throw error
      return data?.[0] || null
    }
  } catch (err) {
    console.error('Ошибка при обновлении цены:', err)
    return null
  }
}

// ============================================
// AI ПОМОЩНИК (использует Ollama локально)
// ============================================

async function aiAnalyzeProduct(userInput) {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5-coder:1.5b',
        prompt: `Проанализируй это описание товара и помоги структурировать его для каталога:
        
Описание: "${userInput}"

Верни JSON в формате:
{
  "name": "Название товара",
  "description": "Короткое описание (1-2 строки)",
  "category": "Категория (кофе/аксессуары/оборудование)",
  "tags": ["тег1", "тег2"]
}

Отвечай ТОЛЬКО JSON без дополнительного текста.`,
        stream: false,
      }),
    })

    const result = await response.json()
    const content = result.response.trim()

    // Парсим JSON из ответа
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return null
  } catch (err) {
    console.error('Ошибка AI:', err.message)
    return null
  }
}

// ============================================
// КОМАНДЫ БОТА
// ============================================

// /start
bot.start(async (ctx) => {
  const welcomeText = `👋 Добро пожаловать в *админ-панель товаров*!

🛍️ *Что я умею:*
✅ Добавлять товары (с помощью AI)
✅ Редактировать товары
✅ Менять цены и SKU
✅ Удалять товары
✅ Просматривать все товары
✅ Искать товары

*Доступные команды:*
/add - добавить новый товар
/list - список всех товаров
/edit - редактировать товар
/delete - удалить товар
/search - поиск товара
/stats - статистика

Начнем? 🚀`

  await ctx.reply(welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: Markup.inlineKeyboard([
      [
        Markup.button.callback('➕ Добавить товар', 'action_add'),
        Markup.button.callback('📋 Список товаров', 'action_list'),
      ],
      [
        Markup.button.callback('✏️ Редактировать', 'action_edit'),
        Markup.button.callback('🗑️ Удалить', 'action_delete'),
      ],
    ]),
  })
})

// ============================================
// ДОБАВЛЕНИЕ ТОВАРА
// ============================================

bot.action('action_add', async (ctx) => {
  userState.set(ctx.from.id, { step: 'add_name' })
  await ctx.answerCbQuery()
  await ctx.reply(
    '📝 *Отправьте название товара или описание*\n\n_Пример: "Espresso Blend 250g, Premium качество"_\n\nИ я помогу структурировать информацию с помощью AI ✨',
    { parse_mode: 'Markdown' }
  )
})

bot.on('text', async (ctx) => {
  const state = userState.get(ctx.from.id)
  if (!state) return

  if (state.step === 'add_name') {
    const msg = await ctx.reply('⏳ Анализирую информацию с помощью AI...')

    // Анализируем с AI
    const aiAnalysis = await aiAnalyzeProduct(ctx.message.text)

    if (aiAnalysis) {
      userState.set(ctx.from.id, {
        step: 'add_confirm',
        name: aiAnalysis.name,
        description: aiAnalysis.description,
        category: aiAnalysis.category,
        tags: aiAnalysis.tags,
      })

      const confirmText = `🤖 *AI предложил:*

📦 *Название:* ${aiAnalysis.name}
📝 *Описание:* ${aiAnalysis.description}
🏷️ *Категория:* ${aiAnalysis.category}
🏷️ *Теги:* ${aiAnalysis.tags.join(', ')}

Все верно? ✅`

      await ctx.editMessageText(confirmText, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Да, создать', 'confirm_add'),
            Markup.button.callback('❌ Отредактировать', 'edit_add'),
          ],
        ]),
      })
    } else {
      await ctx.editMessageText(
        '❌ Ошибка анализа. Попробуйте еще раз с более полным описанием.',
        { parse_mode: 'Markdown' }
      )
      userState.delete(ctx.from.id)
    }
  } else if (state.step === 'add_confirm_name') {
    state.name = ctx.message.text
    userState.set(ctx.from.id, { ...state, step: 'add_confirm_desc' })
    await ctx.reply('📝 Теперь описание товара:')
  } else if (state.step === 'add_confirm_desc') {
    state.description = ctx.message.text
    userState.set(ctx.from.id, { ...state, step: 'add_confirm_price' })
    await ctx.reply('💰 Теперь цена товара (например: 150):')
  } else if (state.step === 'add_confirm_price') {
    const price = parseFloat(ctx.message.text)
    if (isNaN(price)) {
      await ctx.reply('❌ Введите правильную цену')
      return
    }

    state.price = price
    userState.set(ctx.from.id, { ...state, step: 'add_confirm_sku' })
    await ctx.reply('🏷️ SKU (артикул, например: ESP-250):')
  } else if (state.step === 'add_confirm_sku') {
    const sku = ctx.message.text
    state.sku = sku

    // Создаем товар
    const product = await createProduct(state.name, state.description)

    if (product) {
      // Добавляем цену
      await updateProductPrice(product.id, state.price, sku)

      await ctx.reply(
        `✅ *Товар создан успешно!*\n\n📦 ${product.name}\n📝 ${product.description}\n💰 Цена: ${state.price}₴\n🏷️ SKU: ${sku}`,
        { parse_mode: 'Markdown' }
      )
    } else {
      await ctx.reply('❌ Ошибка при создании товара')
    }

    userState.delete(ctx.from.id)
  } else if (state.step === 'edit_description') {
    const updated = await updateProduct(state.productId, {
      description: ctx.message.text,
    })
    if (updated) {
      await ctx.reply(`✅ Описание обновлено: ${ctx.message.text}`)
    }
    userState.delete(ctx.from.id)
  } else if (state.step === 'edit_price') {
    const price = parseFloat(ctx.message.text)
    if (isNaN(price)) {
      await ctx.reply('❌ Введите правильную цену')
      return
    }

    await updateProductPrice(state.productId, price, state.sku)
    await ctx.reply(`✅ Цена обновлена: ${price}₴`)
    userState.delete(ctx.from.id)
  } else if (state.step === 'search') {
    const products = await getProducts()
    const found = products.filter(
      (p) =>
        p.name.toLowerCase().includes(ctx.message.text.toLowerCase()) ||
        p.description.toLowerCase().includes(ctx.message.text.toLowerCase())
    )

    if (found.length === 0) {
      await ctx.reply('❌ Товары не найдены')
    } else {
      let results = '📦 *Найденные товары:*\n\n'
      found.forEach((p, i) => {
        results += `${i + 1}. *${p.name}*\n   ${p.description}\n\n`
      })
      await ctx.reply(results, { parse_mode: 'Markdown' })
    }
    userState.delete(ctx.from.id)
  }
})

// Подтверждение добавления
bot.action('confirm_add', async (ctx) => {
  const state = userState.get(ctx.from.id)
  if (!state) return

  const product = await createProduct(state.name, state.description)

  if (product) {
    userState.set(ctx.from.id, {
      step: 'add_confirm_price',
      productId: product.id,
      name: state.name,
      description: state.description,
    })

    await ctx.answerCbQuery()
    await ctx.editMessageText(
      `✅ *Товар структурирован!*\n\n📦 ${product.name}\n📝 ${product.description}`,
      { parse_mode: 'Markdown' }
    )
    await ctx.reply('💰 Теперь укажите цену (например: 150):')
  } else {
    await ctx.answerCbQuery('❌ Ошибка создания', { show_alert: true })
  }
})

bot.action('edit_add', async (ctx) => {
  const state = userState.get(ctx.from.id)
  userState.set(ctx.from.id, { ...state, step: 'add_confirm_name' })
  await ctx.answerCbQuery()
  await ctx.reply('✏️ Отредактируйте название товара:')
})

// ============================================
// ПРОСМОТР ТОВАРОВ
// ============================================

bot.action('action_list', async (ctx) => {
  const products = await getProducts()

  if (products.length === 0) {
    await ctx.answerCbQuery()
    await ctx.reply('📦 Товаров нет. Добавьте первый товар!')
    return
  }

  let listText = '📦 *Все товары:*\n\n'
  products.forEach((p, i) => {
    listText += `${i + 1}. *${p.name}*\n   ${p.description}\n   ${p.is_available ? '✅ Доступен' : '❌ Недоступен'}\n\n`
  })

  await ctx.answerCbQuery()
  await ctx.reply(listText, { parse_mode: 'Markdown' })
})

// ============================================
// РЕДАКТИРОВАНИЕ ТОВАРА
// ============================================

bot.action('action_edit', async (ctx) => {
  const products = await getProducts()

  if (products.length === 0) {
    await ctx.answerCbQuery()
    await ctx.reply('📦 Товаров нет')
    return
  }

  const buttons = products.map((p) =>
    Markup.button.callback(`✏️ ${p.name}`, `edit_product_${p.id}`)
  )

  await ctx.answerCbQuery()
  await ctx.reply('Выберите товар для редактирования:', {
    reply_markup: Markup.inlineKeyboard(
      buttons.map((b) => [b])
    ),
  })
})

bot.action(/^edit_product_/, async (ctx) => {
  const productId = ctx.match.input.split('_')[2]
  const product = await getProductById(productId)

  if (!product) {
    await ctx.answerCbQuery('❌ Товар не найден', { show_alert: true })
    return
  }

  const price = await getProductPrice(productId)

  const editText = `✏️ *Редактирование товара*

📦 *Название:* ${product.name}
📝 *Описание:* ${product.description}
💰 *Цена:* ${price?.price || 'не установлена'}₴
🏷️ *SKU:* ${price?.sku || 'не установлен'}
${product.is_available ? '✅' : '❌'} *Доступность*

Что редактировать?`

  await ctx.answerCbQuery()
  await ctx.editMessageText(editText, {
    parse_mode: 'Markdown',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('📝 Описание', `edit_desc_${productId}`)],
      [Markup.button.callback('💰 Цена', `edit_price_${productId}`)],
      [Markup.button.callback('✅ Доступность', `edit_avail_${productId}`)],
      [Markup.button.callback('⬅️ Назад', 'action_edit')],
    ]),
  })
})

bot.action(/^edit_desc_/, async (ctx) => {
  const productId = ctx.match.input.split('_')[2]
  userState.set(ctx.from.id, {
    step: 'edit_description',
    productId,
  })
  await ctx.answerCbQuery()
  await ctx.reply('📝 Отправьте новое описание:')
})

bot.action(/^edit_price_/, async (ctx) => {
  const productId = ctx.match.input.split('_')[2]
  const price = await getProductPrice(productId)

  userState.set(ctx.from.id, {
    step: 'edit_price',
    productId,
    sku: price?.sku || '',
  })
  await ctx.answerCbQuery()
  await ctx.reply(
    `💰 *Текущая цена:* ${price?.price || 'не установлена'}₴\n\nВведите новую цену:`,
    { parse_mode: 'Markdown' }
  )
})

bot.action(/^edit_avail_/, async (ctx) => {
  const productId = ctx.match.input.split('_')[2]
  const product = await getProductById(productId)

  const updated = await updateProduct(productId, {
    is_available: !product.is_available,
  })

  if (updated) {
    await ctx.answerCbQuery()
    await ctx.reply(
      `✅ Доступность изменена на: ${updated.is_available ? '✅ Доступен' : '❌ Недоступен'}`
    )
  }
})

// ============================================
// УДАЛЕНИЕ ТОВАРА
// ============================================

bot.action('action_delete', async (ctx) => {
  const products = await getProducts()

  if (products.length === 0) {
    await ctx.answerCbQuery()
    await ctx.reply('📦 Товаров нет')
    return
  }

  const buttons = products.map((p) =>
    Markup.button.callback(`🗑️ ${p.name}`, `delete_product_${p.id}`)
  )

  await ctx.answerCbQuery()
  await ctx.reply('Выберите товар для удаления:', {
    reply_markup: Markup.inlineKeyboard(
      buttons.map((b) => [b])
    ),
  })
})

bot.action(/^delete_product_/, async (ctx) => {
  const productId = ctx.match.input.split('_')[2]
  const product = await getProductById(productId)

  if (!product) {
    await ctx.answerCbQuery('❌ Товар не найден', { show_alert: true })
    return
  }

  await ctx.answerCbQuery()
  await ctx.editMessageText(
    `⚠️ *Вы уверены?*\n\nУдалить товар "*${product.name}*"?\n\nЭто действие *необратимо*!`,
    {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Да, удалить', `confirm_delete_${productId}`),
          Markup.button.callback('❌ Отмена', 'action_delete'),
        ],
      ]),
    }
  )
})

bot.action(/^confirm_delete_/, async (ctx) => {
  const productId = ctx.match.input.split('_')[2]
  const success = await deleteProduct(productId)

  if (success) {
    await ctx.answerCbQuery()
    await ctx.editMessageText('✅ Товар удален!')
  } else {
    await ctx.answerCbQuery('❌ Ошибка удаления', { show_alert: true })
  }
})

// ============================================
// КОМАНДЫ
// ============================================

bot.command('add', async (ctx) => {
  userState.set(ctx.from.id, { step: 'add_name' })
  await ctx.reply(
    '📝 *Отправьте название товара или описание*\n\n_Пример: "Espresso Blend 250g, Premium качество"_\n\nИ я помогу структурировать информацию с помощью AI ✨',
    { parse_mode: 'Markdown' }
  )
})

bot.command('list', async (ctx) => {
  const products = await getProducts()

  if (products.length === 0) {
    await ctx.reply('📦 Товаров нет. Добавьте первый товар!')
    return
  }

  let listText = '📦 *Все товары:*\n\n'
  products.forEach((p, i) => {
    listText += `${i + 1}. *${p.name}*\n   ${p.description}\n   ${p.is_available ? '✅ Доступен' : '❌ Недоступен'}\n\n`
  })

  await ctx.reply(listText, { parse_mode: 'Markdown' })
})

bot.command('edit', async (ctx) => {
  const products = await getProducts()

  if (products.length === 0) {
    await ctx.reply('📦 Товаров нет')
    return
  }

  const buttons = products.map((p) =>
    Markup.button.callback(`✏️ ${p.name}`, `edit_product_${p.id}`)
  )

  await ctx.reply('Выберите товар для редактирования:', {
    reply_markup: Markup.inlineKeyboard(
      buttons.map((b) => [b])
    ),
  })
})

bot.command('delete', async (ctx) => {
  const products = await getProducts()

  if (products.length === 0) {
    await ctx.reply('📦 Товаров нет')
    return
  }

  const buttons = products.map((p) =>
    Markup.button.callback(`🗑️ ${p.name}`, `delete_product_${p.id}`)
  )

  await ctx.reply('Выберите товар для удаления:', {
    reply_markup: Markup.inlineKeyboard(
      buttons.map((b) => [b])
    ),
  })
})

bot.command('search', (ctx) => {
  userState.set(ctx.from.id, { step: 'search' })
  ctx.reply('🔍 Введите название или описание товара для поиска:')
})

bot.command('stats', async (ctx) => {
  const products = await getProducts()
  const available = products.filter((p) => p.is_available).length

  const statsText = `📊 *Статистика*

📦 Всего товаров: ${products.length}
✅ Доступных: ${available}
❌ Недоступных: ${products.length - available}

🏷️ *Последние товары:*
${
  products
    .slice(-5)
    .map((p, i) => `${i + 1}. ${p.name}`)
    .join('\n') || 'Нет товаров'
}`

  await ctx.reply(statsText, { parse_mode: 'Markdown' })
})

// Запуск бота
bot.launch()
console.log('🤖 Бот запущен и готов к работе!')

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
