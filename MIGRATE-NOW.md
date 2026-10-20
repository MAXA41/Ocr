# ⚡ СРОЧНЫЕ ДЕЙСТВИЯ: Выполнить миграцию в Supabase

## 🎯 Цель

Добавить колонку `color_variants` в таблицу `product_price_overrides` для хранения данных о варіантах кольорів товарів.

## 🔑 SQL команда для выполнения

Скопируйте ВСЕ эти строки и вставьте в **Supabase SQL Editor**:

```sql
-- Добавляем новую колонку для вариантов цветов
alter table public.product_price_overrides
  add column if not exists color_variants jsonb default '[]'::jsonb;

-- Добавляем комментарий для документирования
comment on column public.product_price_overrides.color_variants is 'Array of color variant objects: [{name: "Black", image_url: "https://...", description: "Чорна обпалювання"}, {name: "Light", image_url: "https://...", description: "Світла обпалювання"}]';
```

## 📍 Как выполнить

### Вариант 1: Через веб-интерфейс Supabase

1. Откройте https://supabase.com/dashboard
2. Выберите ваш проект
3. Перейдите на вкладку **"SQL Editor"** слева
4. Нажмите **"New query"** (зеленая кнопка)
5. Вставьте SQL код из поля выше
6. Нажмите **"Run"** или **Ctrl+Enter**
7. Должно вывести успешное сообщение ✅

### Вариант 2: Через Supabase CLI (если установлен)

```bash
cd C:\Users\user\Desktop\ocr\Ocr-1

# Выполнить SQL из файла
cat docs/supabase-schema.sql | tail -n 5 | supabase db push
```

## ✅ Проверка результата

После выполнения запроса используйте эту команду для верификации:

```sql
select column_name, data_type, column_default 
from information_schema.columns 
where table_name = 'product_price_overrides' 
  and column_name = 'color_variants';
```

**Ожидаемый результат:**
```
column_name      | data_type | column_default
-----------------+-----------+----------------
color_variants   | jsonb     | '[]'::jsonb
```

## 🔄 Откат (если что-то пошло не так)

Если нужно удалить колонку:

```sql
alter table public.product_price_overrides
  drop column if exists color_variants;
```

⚠️ **Это удалит все данные о вариантах цветов!**

## 📋 Что будет дальше

После миграции:

1. Код уже готов и работает (файлы обновлены)
2. Администраторы смогут добавлять варианты цветов
3. Данные будут сохраняться в Supabase
4. Фронтенд сможет получать и отображать цвета

## 📊 Формат данных

Варианты цветов хранятся как JSON массив:

```json
[
  {
    "name": "Чорна обпалювання",
    "description": "Темна, інтенсивна",
    "image_url": "images/products/roast-dark.webp"
  },
  {
    "name": "Світла обпалювання",
    "description": "Яскрава кислотність",
    "image_url": "images/products/roast-light.webp"
  }
]
```

## ⏱️ Время выполнения

- SQL миграция: **< 1 минута**
- Проверка результата: **< 1 минута**
- Всего: **2 минуты**

## 🆘 Если возникла ошибка

### Ошибка: "Column already exists"
- Это нормально - колонка уже создана, миграция успешна ✅

### Ошибка: "relation does not exist"
- Проверьте название таблицы (должно быть `product_price_overrides`)
- Убедитесь, что вы в правильной базе данных

### Ошибка: "syntax error"
- Перепроверьте SQL код - скопируйте еще раз из блока выше

### Ошибка: "permission denied"
- У вас может не быть прав на изменение схемы БД
- Свяжитесь с администратором Supabase

## 🚀 Готово!

После выполнения миграции:
- ✅ Админы могут добавлять цвета в товары
- ✅ Данные сохраняются в БД
- ✅ Фронтенд готов к отображению цветов

**Выполните миграцию и наслаждайтесь новой функцией! 🎨**
