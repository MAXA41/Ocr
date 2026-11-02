-- Вставлення базових категорій товарів

-- Категорія: ЕСПРЕСО
INSERT INTO product_categories (
  id, name_uk, name_en, description, display_order,
  fields, variant_options
) VALUES (
  'espresso', 'Еспресо', 'Espresso', 'Зерна для еспресо та молочних напоїв',
  1,
  '[
    {
      "id": "weight",
      "name_uk": "Вага",
      "type": "select",
      "required": true,
      "options": ["250 г", "500 г", "1 кг"]
    },
    {
      "id": "origin",
      "name_uk": "Походження",
      "type": "text",
      "required": false
    },
    {
      "id": "flavor_notes",
      "name_uk": "Смакові ноти",
      "type": "textarea",
      "required": false
    },
    {
      "id": "roast_level",
      "name_uk": "Рівень обжарки",
      "type": "select",
      "options": ["Світла", "Середня", "Темна"],
      "required": true
    }
  ]'::jsonb,
  '[]'::jsonb
);

-- Категорія: ФІЛЬТР
INSERT INTO product_categories (
  id, name_uk, name_en, description, display_order,
  fields, variant_options
) VALUES (
  'filter', 'Фільтр', 'Filter', 'Зерна для фільтр-методів заварювання',
  2,
  '[
    {
      "id": "weight",
      "name_uk": "Вага",
      "type": "select",
      "required": true,
      "options": ["250 г", "500 г", "1 кг"]
    },
    {
      "id": "origin",
      "name_uk": "Походження",
      "type": "text",
      "required": false
    },
    {
      "id": "flavor_notes",
      "name_uk": "Смакові ноти",
      "type": "textarea",
      "required": false
    },
    {
      "id": "roast_level",
      "name_uk": "Рівень обжарки",
      "type": "select",
      "options": ["Світла", "Середня", "Темна"],
      "required": true
    }
  ]'::jsonb,
  '[]'::jsonb
);

-- Категорія: ДРІПИ
INSERT INTO product_categories (
  id, name_uk, name_en, description, display_order,
  fields, variant_options
) VALUES (
  'drips', 'Дріпи', 'Drips', 'Готові дріпи для швидкого заварювання',
  3,
  '[
    {
      "id": "quantity",
      "name_uk": "Кількість пакетів",
      "type": "number",
      "required": true
    },
    {
      "id": "weight_per_pack",
      "name_uk": "Вага одного пакета",
      "type": "text",
      "required": true
    }
  ]'::jsonb,
  '[]'::jsonb
);

-- Категорія: ДЕКАФ
INSERT INTO product_categories (
  id, name_uk, name_en, description, display_order,
  fields, variant_options
) VALUES (
  'decaf', 'Декаф', 'Decaf', 'Каву без кофеїну',
  4,
  '[
    {
      "id": "weight",
      "name_uk": "Вага",
      "type": "select",
      "required": true,
      "options": ["250 г", "500 г", "1 кг"]
    },
    {
      "id": "origin",
      "name_uk": "Походження",
      "type": "text",
      "required": false
    },
    {
      "id": "decaf_method",
      "name_uk": "Метод видалення кофеїну",
      "type": "select",
      "options": ["СО2", "Вода", "Натуральний"],
      "required": true
    }
  ]'::jsonb,
  '[]'::jsonb
);

-- Категорія: АКСЕСУАРИ
INSERT INTO product_categories (
  id, name_uk, name_en, description, display_order,
  fields, variant_options
) VALUES (
  'accessories', 'Аксесуари', 'Accessories', 'Обладнання для заварювання та зберігання',
  5,
  '[
    {
      "id": "type",
      "name_uk": "Тип аксесуара",
      "type": "select",
      "required": true,
      "options": ["Кофемолка", "Кофемашина", "Ваги", "Інше"]
    },
    {
      "id": "brand",
      "name_uk": "Бренд",
      "type": "text",
      "required": true
    },
    {
      "id": "material",
      "name_uk": "Матеріал",
      "type": "text",
      "required": false
    },
    {
      "id": "dimensions",
      "name_uk": "Розміри",
      "type": "text",
      "required": false
    }
  ]'::jsonb,
  '[
    {
      "id": "color",
      "name_uk": "Колір",
      "type": "color",
      "required": false
    }
  ]'::jsonb
);

-- Категорія: МЕРЧ
INSERT INTO product_categories (
  id, name_uk, name_en, description, display_order,
  fields, variant_options
) VALUES (
  'merch', 'Мерч', 'Merch', 'Одяг та подарунки з логотипом O.Roasters',
  6,
  '[
    {
      "id": "type",
      "name_uk": "Тип товару",
      "type": "select",
      "required": true,
      "options": ["Футболка", "Кружка", "Кепка", "Рюкзак", "Інше"]
    },
    {
      "id": "material",
      "name_uk": "Матеріал",
      "type": "text",
      "required": true
    },
    {
      "id": "care_instructions",
      "name_uk": "Догляд",
      "type": "textarea",
      "required": false
    }
  ]'::jsonb,
  '[
    {
      "id": "size",
      "name_uk": "Розмір",
      "type": "select",
      "options": ["XS", "S", "M", "L", "XL", "XXL"],
      "required": true
    },
    {
      "id": "color",
      "name_uk": "Колір",
      "type": "color",
      "required": false
    }
  ]'::jsonb
);
