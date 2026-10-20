# 🎨 Додавання управління варіантами кольорів товарів

## Резюме

Додана функціональність для управління варіантами кольорів товарів в адміністративній панелі. Адміністратори можуть тепер:
- Додавати різні варіанти кольорів для товарів (темна, світла, середня обпалювання)
- Вказувати назву, опис та фото для кожного варіанту
- Зберігати варіанти у структурованому JSON форматі

## 📋 Що було змінено

### Базова дата (Supabase)
- **Нова колонка:** `color_variants` в таблиці `product_price_overrides`
- **Тип:** JSONB
- **Формат:** `[{name: "...", description: "...", image_url: "..."}]`

### Код
1. **js/account.js**
   - Додана UI fieldset для управління кольорами
   - Обробники подій для добавлення/видалення варіантів кольорів
   - Логіка сохранення color_variants у Supabase
   - Обновлена функція `buildCatalogAdminRows` для парсингу JSON

2. **js/site.js**
   - Обновлена `fetchActivePriceOverrides` для завантаження color_variants
   - Обновлена `applyPriceOverrides` для застосування цих даних
   - Фронтенд готовий передавати color_variants в компоненти товарів

3. **css/styles.css**
   - Додано стилі для `.catalog-admin-colors-container`
   - Додано стилі для `.catalog-admin-color-item`
   - Додано стилі для кнопок додавання/видалення

4. **docs/**
   - `color-variants-admin.md` — Керівництво адміністратора
   - `color-variants-migration.md` — Інструкція по міграції БД
   - `color-variants-checklist.md` — Чек-лист перед запуском

## 🚀 Виконання міграції

### Крок 1: Перевірка файлів

Переконайтеся, що наступні файли оновлені:
```bash
git status
# Повинні бути M (модифіковані):
# M  js/account.js
# M  js/site.js
# M  css/styles.css
# M  docs/supabase-schema.sql
```

### Крок 2: Синтаксис перевірений

```bash
node --check js/account.js
node --check js/site.js
# Обидва мають завершитися без помилок
```

### Крок 3: Виконайте SQL міграцію в Supabase

1. Перейдіть до [Supabase Dashboard](https://supabase.com/dashboard)
2. Виберіть ваш проект
3. Перейдіть до **SQL Editor**
4. Створіть новий запит (New query)
5. Скопіюйте та вставте:

```sql
-- Добавляем нову колонку для варіантів кольорів
alter table public.product_price_overrides
  add column if not exists color_variants jsonb default '[]'::jsonb;

-- Добавляем коментар
comment on column public.product_price_overrides.color_variants is 
'Array of color variant objects: [{name: "Black", description: "Dark roast", image_url: "https://..."}, ...]';
```

6. Натисніть **Run** (Ctrl+Enter)
7. Очікуйте успішного завершення ✅

### Крок 4: Перевірка міграції

Виконайте запит перевірки:
```sql
select column_name, data_type, column_default 
from information_schema.columns 
where table_name = 'product_price_overrides' 
  and column_name = 'color_variants';
```

Повинна вивести:
```
color_variants | jsonb | '[]'::jsonb
```

### Крок 5: Оновіть код на сайті

Залежно від вашої платформи розгортання:

**Для GitHub Pages з GitHub Actions:**
```bash
git add .
git commit -m "feat: add color variants support for products

- Add color_variants column to product_price_overrides table
- Add admin UI for managing product colors
- Update frontend to load and display color variants
- Add documentation for admins and migration

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push origin main
# Чекайте завершення GitHub Actions (≈2-5 хвилин)
```

**Для локального розгортання:**
```bash
npm run build
npm run preview
# Тестуйте локально, потім скопіюйте в production
```

### Крок 6: Тестування

1. Очистіть кеш браузера:
   ```
   Ctrl+Shift+Delete → Очистити весь кеш → ОК
   ```

2. Перезавантажте сайт:
   ```
   Ctrl+Shift+R
   ```

3. Залогіньтеся на [ocr.com.ua/account.html](https://ocr.com.ua/account.html)

4. Розкрийте карточку будь-якого товару

5. Прокрутіть вниз до розділу **"Варіанти кольорів"**

6. Натисніть **"+ Додати колір"**

7. Заповніть тестові дані:
   - Назва: `Тест Чорна`
   - Опис: `Темна тестова обпалювання`
   - Фото: `images/products/test.webp`

8. Натисніть **"Зберегти"**

9. Перевірте в Supabase (SQL Editor):
   ```sql
   select product_id, color_variants 
   from product_price_overrides 
   where product_id = 'YOUR_PRODUCT_ID'
   limit 1;
   ```

10. Видаліть тестовий варіант (натисніть ✕) і збережіть знову

**Очікуваний результат:** Варіанти додаються/видаляються в реальному часі ✅

## 📚 Документація

Для адміністраторів:
- 📖 [Управління варіантами кольорів](./color-variants-admin.md)

Для розробників:
- 📖 [SQL міграція](./color-variants-migration.md)
- 📖 [Чек-лист](./color-variants-checklist.md)

## ⚠️ Важливо

- **Зворотнісна сумісність:** Старий код працює без color_variants колонки
- **Дані:** Якщо видалити колонку, усі варіанти будуть втрачені (тому: регулярні резервні копії!)
- **Фото:** Можуть бути локальні (`images/...`) або зовнішні URL (`https://...`)
- **JSON парсинг:** Внутрішньо обробляється автоматично, не хвилюйтеся про формат

## 🆘 Можливі проблеми

### Помилка: "relation does not exist"
**Причина:** SQL міграція не виконана або виконана з помилкою  
**Рішення:** Перевірте SQL запит в Supabase, спробуйте ще раз

### Кнопка "Додати колір" не з'являється
**Причина:** Кеш браузера  
**Рішення:** Очистіть кеш (Ctrl+Shift+Delete) та перезавантажте (Ctrl+Shift+R)

### Помилка при збереженні
**Причина:** Проблеми з доступом або JSON парсингом  
**Рішення:** 
- Перевірте F12 → Console на помилки
- Переконайтеся, що ваш email у таблиці `catalog_admins`

## 📊 Структура даних

```json
{
  "product_id": "coffee-dark-roast",
  "color_variants": [
    {
      "name": "Чорна обпалювання",
      "description": "Темна, інтенсивна, більше тіла",
      "image_url": "images/products/roast-dark.webp"
    },
    {
      "name": "Світла обпалювання",
      "description": "Яскрава кислотність, вишневі нотки",
      "image_url": "images/products/roast-light.webp"
    }
  ]
}
```

## 🎯 Наступні кроки (опціонально)

Після успішної міграції можна:

1. **Інтегрувати на фронтенд:**
   - Додати вкладки/слайдер з варіантами кольорів на сторінці товару
   - Відображати фото для вибраного кольору
   - Дозволити клієнту вибирати колір перед додаванням в кошик

2. **Розширити функціонал:**
   - Додати ціни за колір (якщо колір впливає на ціну)
   - Синхронізація наявності за колір
   - Аналітика по популярності кольорів

3. **Документація для клієнтів:**
   - Пояснити, як вибирати колір при замовленні
   - Показати відмінності між варіантами

## ✅ Завершено

Всі компоненти готові до роботи:
- ✅ Базова дата розширена
- ✅ Адміністративний інтерфейс добавлений
- ✅ Фронтенд готовий до інтеграції
- ✅ Документація створена
- ✅ Синтаксис перевірений

**Готово до запуску! 🚀**
