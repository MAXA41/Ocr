# 🤖 Технічний гайд Telegram-бота O.Roasters

## 📋 Вміст

1. [Архітектура бота](#архітектура-бота)
2. [Встановлення](#встановлення)
3. [Конфігурація](#конфігурація)
4. [Функціональність](#функціональність)
5. [Розширення та кастомізація](#розширення-та-кастомізація)
6. [Развертывание](#розгортання)
7. [Debugging](#debugging)

---

## 🏗️ Архітектура бота

### Структура файлів

```
supabase/functions/telegram-bot/
├── index.ts              # Основний код бота
├── deno.json            # Конфігурація Deno
└── .env.local           # Локальні змінні (не commited)
```

### Компоненты системи

```
┌─────────────────┐
│  Telegram User  │
└────────┬────────┘
         │ sends message/photo
         ▼
┌─────────────────────────────────────┐
│   Telegram Bot API                  │
│   api.telegram.org/bot.../          │
└────────┬────────────────────────────┘
         │ webhook
         ▼
┌─────────────────────────────────────┐
│   Edge Function (index.ts)          │
│   - Parse message                   │
│   - Handle user state               │
│   - Download photos                 │
│   - Validate data                   │
└────────┬────────────────────────────┘
         │ queries/inserts
         ▼
┌─────────────────────────────────────┐
│   Supabase Database                 │
│   - product_categories              │
│   - product_catalog_items           │
│   - product_variants                │
└─────────────────────────────────────┘
```

### User State Management

Бот відстежує стан користувача в пам'яті:

```typescript
interface UserState {
  action: string                      // 'adding_product'
  category: string                    // category ID
  awaitingPhoto: boolean              // чи чекаємо фото
  data: {
    name: string                      // назва товара
    description: string               // опис
    price: number                     // ціна
    photo?: string                    // base64 фото
    field_0?: string                  // додаткові поля
    field_1?: string                  // ...
  }
}
```

⚠️ **ВАЖЛИВО:** Стан зберігається тільки в пам'яті (Map). При перезапуску функції стан втрачається!

---

## 🚀 Встановлення

### Крок 1: Підготовка

```bash
# Переконайтеся, що Supabase CLI встановлено
supabase --version

# Перейдіть в папку проекту
cd /path/to/Ocr-1
```

### Крок 2: Налаштування локального оточення

Створіть файл `.env.local` у директорії проекту:

```env
# .env.local
TELEGRAM_BOT_TOKEN=your_bot_token_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

### Крок 3: Запуск локально

```bash
# Запустіть Edge Function локально
supabase functions serve telegram-bot --env-file .env.local

# Результат:
# Available functions:
# - telegram-bot → http://localhost:54321/functions/v1/telegram-bot
```

### Крок 4: Налаштування Telegram Webhook

```bash
# Встановіть webhook (замініть свої значення):
curl -X POST \
  https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"http://localhost:54321/functions/v1/telegram-bot\"}"

# Перевірка:
curl https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getWebhookInfo
```

---

## ⚙️ Конфігурація

### Змінні оточення

| Змінна | Опис | Приклад |
|--------|------|---------|
| `TELEGRAM_BOT_TOKEN` | Token для Telegram Bot API | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |
| `SUPABASE_URL` | URL вашого Supabase проекту | `https://sxxlotfbcblnjgcvxaqe.supabase.co` |
| `SUPABASE_ANON_KEY` | Публічний ключ Supabase | `eyJhbGciOiJIUzI1NiIsInR...` |

### Отримання Telegram Bot Token

1. Відкрийте Telegram і знайдіть **@BotFather**
2. Введіть `/newbot`
3. Дайте імʻя та юзернейм боту
4. Скопіюйте токен

### Отримання Supabase ключів

1. Перейдіть на https://supabase.com/dashboard
2. Виберіть ваш проект
3. Settings → API → Project API keys
4. Скопіюйте `anon public key`

---

## 📱 Функціональність

### 1. Команда `/start`

**Назва функції:** `handleStart(chatId: number)`

**Описание:** Показує головне меню з кнопками

**Функціональність:**
- Привіт користувачу
- Показує 4 основні дії в інлайн-клавіатурі

**Приклад вихідних даних:**
```
👋 Привіт! Я O.Roasters адмін-бот.

Основні команди:

[📦 Список товарів] [📊 Статистика]
[➕ Додати товар]
```

---

### 2. Команда `/add` - Додавання товара

**Flow:**

```
/add
  ↓
handleAddProduct()
  ├─ getCategories() → 6 категорій
  └─ Показує inline-keyboard з категоріями
  
Користувач обирає категорію
  ↓
handleCategorySelection()
  ├─ Зберігає стан: { action: 'adding_product', category: X }
  ├─ getCategoryFields(categoryId)
  └─ Спрашує першу інформацію (назва)
  
Користувач вводить текст
  ↓
handleProductInput()
  ├─ Зберігає дані в state.data
  ├─ Спрашує наступне поле
  └─ Цикл: назва → опис → ціна → фото → додаткові поля
  
Користувач надсилає фото
  ↓
handlePhotoInput()
  ├─ downloadTelegramPhoto(fileId)
  ├─ Конвертує у base64
  └─ Зберігає в state.data.photo
  
Все готово
  ↓
saveProductFromBot()
  ├─ INSERT в product_catalog_items
  ├─ Генерує SKU
  └─ Показує успіх + ID товара
```

### Обробка фото

**Функция:** `downloadTelegramPhoto(fileId: string)`

```typescript
// 1. Отримати інформацію про файл від Telegram
GET /bot{TOKEN}/getFile?file_id={FILE_ID}
// Отримуємо: file_path = "photos/file_123.jpg"

// 2. Завантажити файл
GET /file/bot{TOKEN}/{file_path}
// Отримуємо: ArrayBuffer з даними зображення

// 3. Конвертувати у base64
const base64 = btoa(binaryString)
// Результат: "iVBORw0KGgo..."

// 4. Зберегти як data URL
const dataUrl = `data:image/jpeg;base64,${base64}`
// Результат: "data:image/jpeg;base64,iVBORw0KGgo..."
```

**Виміри до фото:**
- Максимум 10 МБ
- Формати: JPG, PNG, WebP
- Рекомендовано: 500x500px мінімум, 2-5 МБ оптимально

---

### 3. Команда `/list` - Список товарів

**Функция:** `handleListProducts(chatId: number)`

**Запит:**
```sql
SELECT id, name, description, is_available 
FROM product_catalog_items 
LIMIT 20
```

**Вихідні:**
```
📦 Топ товарів (останні 20):

1. ✅ Еспресо Лімон
   Солодкий апельсин, чистого походження...

2. ❌ Фільтр Brasil
   Класичний бразильский смак...
```

---

### 4. Команда `/stats` - Статистика

**Функция:** `handleStats(chatId: number)`

**Запити:**
```sql
-- Підрахунок всіх товарів
SELECT COUNT(*) as total 
FROM product_catalog_items

-- Підрахунок доступних
SELECT COUNT(*) as available 
FROM product_catalog_items 
WHERE is_available = true
```

**Вихідні:**
```
📊 Статистика магазину:

📦 Всього товарів: 45
✅ Доступних: 38
❌ Недоступних: 7
```

---

### 5. Обробка категорій

**Функция:** `getCategories()`

**Запит:**
```sql
SELECT id, name_uk 
FROM product_categories 
WHERE is_active = true 
ORDER BY display_order ASC
```

**Результат:**
```
[
  { id: '1', name_uk: 'Еспресо' },
  { id: '2', name_uk: 'Фільтр' },
  { id: '3', name_uk: 'Дріп' },
  { id: '4', name_uk: 'Без кофеїну' },
  { id: '5', name_uk: 'Аксесуари' },
  { id: '6', name_uk: 'Мерч' },
]
```

**Динамічні поля:**

```typescript
// Для категорії "Еспресо"
{
  name_uk: "Еспресо",
  fields: [
    { name_uk: "Регіон", required: true },
    { name_uk: "Обпалювання", required: true },
    { name_uk: "Висота", required: false }
  ],
  variant_options: []
}

// Для категорії "Аксесуари"
{
  name_uk: "Аксесуари",
  fields: [],
  variant_options: [
    { name_uk: "Колір", type: "color" }
  ]
}
```

---

## 🔧 Розширення та кастомізація

### Додавання нової команди

```typescript
// 1. Додайте обробник в Deno.serve()
if (text === '/mycommand') {
  await handleMyCommand(chatId)
}

// 2. Створіть функцію обробника
async function handleMyCommand(chatId: number) {
  await sendTelegramMessage(chatId, 'Привіт!')
}
```

### Додавання нового типу варіанту

**База даних:**

```sql
-- 1. Додайте варіант до категорії
UPDATE product_categories 
SET variant_options = jsonb_append(
  variant_options, 
  '{"name_uk": "Матеріал", "type": "material"}'
)
WHERE id = '5'

-- 2. Додайте варіант до товара
INSERT INTO product_variants (
  product_id, 
  variant_type, 
  variant_values,
  variant_name_uk, 
  price
) VALUES (
  'prod_123',
  'material',
  '{"material": "Дерево"}',
  'Дерево',
  5000
)
```

**Бот:**

```typescript
// Отримайте тип варіанту
const variantType = 'material'
const variantOptions = categoryData.variant_options
  .find(opt => opt.type === variantType)

// Спросіть користувача
await sendTelegramMessage(
  chatId,
  `Виберіть ${variantOptions.name_uk}:\n${variantOptions.options.join(', ')}`
)
```

---

### Збереження стану в базі даних

**Поточна реалізація (НЕ РЕКОМЕНДУЄТЬСЯ):**
```typescript
const userStates = new Map()  // Втрачається при перезапуску!
```

**Рекомендована реалізація:**

```typescript
// Таблиця в Supabase
CREATE TABLE bot_user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  action TEXT,
  category_id TEXT,
  data JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

// Зберегти стан
async function saveUserState(chatId: number, state: any) {
  await supabase
    .from('bot_user_sessions')
    .upsert({
      chat_id: chatId,
      action: state.action,
      category_id: state.category,
      data: state.data,
      updated_at: new Date(),
    }, { onConflict: 'chat_id' })
}

// Отримати стан
async function getUserState(chatId: number) {
  const { data } = await supabase
    .from('bot_user_sessions')
    .select('*')
    .eq('chat_id', chatId)
    .single()
  return data
}
```

---

## 🚀 Розгортання

### Розгортання на Supabase

```bash
# 1. Встановіть змінні оточення в Supabase
supabase secrets set TELEGRAM_BOT_TOKEN="your_token"
supabase secrets set SUPABASE_URL="your_url"
supabase secrets set SUPABASE_ANON_KEY="your_key"

# 2. Розгорніть функцію
supabase functions deploy telegram-bot --no-verify-jwt

# 3. Встановіть webhook на production URL
curl -X POST \
  https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://your-project.supabase.co/functions/v1/telegram-bot\"}"
```

### Перевірка веб-хука

```bash
# Перевірте, що webhook встановлено
curl https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getWebhookInfo

# Результат повинен мати:
{
  "ok": true,
  "result": {
    "url": "https://your-project.supabase.co/functions/v1/telegram-bot",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": 0
  }
}
```

---

## 🐛 Debugging

### Логування

Бот використовує `console.error()` для логування помилок:

```typescript
console.error('getCategories error:', e)
console.error('Error downloading photo:', error)
console.error('Error:', error)
```

### Перегляд логів локально

```bash
# Запустіть з максимальною деталізацією
supabase functions serve telegram-bot --env-file .env.local --no-verify-jwt

# Ви побачите логи в консолі
```

### Перегляд логів на Supabase

```bash
# Через CLI
supabase functions logs telegram-bot

# Через веб-панель
# Перейдіть на https://supabase.com/dashboard → Functions → Logs
```

### Тестування функції

```bash
# Локальне тестування з curl
curl -X POST \
  http://localhost:54321/functions/v1/telegram-bot \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "chat": { "id": 123456789 },
      "text": "/start"
    }
  }'

# Повинні отримати:
# {"ok":true} або помилка з console output
```

### Поширені помилки

| Помилка | Причина | Рішення |
|---------|---------|--------|
| 401 Unauthorized | Неправильний Supabase ключ | Перевірте SUPABASE_ANON_KEY |
| Missing TELEGRAM_BOT_TOKEN | Токен не встановлено | Додайте в .env.local |
| getWebhookInfo error | Webhook не встановлено | Запустіть `setWebhook` команду |
| Photo download failed | Файл ID занадто старий | File ID дійсний тільки 24 години |

---

## 📊 Мониторинг

### Метрики для відстеження

```typescript
// Додайте лічильники
let totalMessages = 0
let totalProductsAdded = 0
let totalPhotosFailed = 0

// У функціях:
totalMessages++
totalProductsAdded++
totalPhotosFailed++

// Надсилайте на послугу моніторингу (Sentry, LogRocket тощо)
await fetch('https://monitoring.example.com/metrics', {
  method: 'POST',
  body: JSON.stringify({
    totalMessages,
    totalProductsAdded,
    totalPhotosFailed,
    timestamp: new Date(),
  })
})
```

---

## 📚 Додаткові ресурси

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Deno Manual](https://deno.land/manual)

---

**Версія:** 1.0  
**Останнє оновлення:** 2 листопада 2026
