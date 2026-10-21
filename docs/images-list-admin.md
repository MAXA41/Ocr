# Динамичний список фото для администратора

## Проблема
Администратор каталога не мог вибирати фото товарів із вложених папок (equipment/, himicals/, merch/). Datalist у формі "Додати новий товар" містив тільки 10 забиванних опцій.

## Рішення
Реалізовано автоматичне генерування списку усіх 112 доступних фото із вложених папок.

### Компоненти рішення:

#### 1. **scripts/generate-image-list.mjs** (Node.js скрипт)
- Рекурсивно скануває папку `images/` та всі вложені папки
- Генерує JSON файл із списком всіх зображень
- Підтримує розширення: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg`
- Запускається перед кожною збіркою (`npm run dev`, `npm run build`)

**Результат:** 112 фото знайдено (включаючи equipment/, himicals/, merch/)

#### 2. **public/images-list.json** (Генерований вихідний файл)
```json
{
  "generated": "2026-10-21T17:48:08.572Z",
  "totalCount": 112,
  "images": [
    "images/11-png-2-731x638.webp",
    "images/equipment/1Z Grind/1zpresso-q-new-1000x1000.webp",
    "images/merch/...",
    ...
  ]
}
```

#### 3. **account.html** (Інтеграція)
Inline скрипт заповняє datalist #catalog-image-suggestions 112 фото при завантаженні сторінки:

```html
<script>
  (async function initImages() {
    try {
      const response = await fetch('/images-list.json');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.images)) {
          const datalist = document.getElementById('catalog-image-suggestions');
          if (datalist) {
            datalist.innerHTML = '';
            data.images.forEach((imagePath) => {
              const option = document.createElement('option');
              option.value = imagePath;
              datalist.appendChild(option);
            });
            console.log(`✅ Loaded ${data.images.length} images`);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load images list:', e);
    }
  })();
</script>
```

### Використання

1. **При розробці:** 
   ```bash
   npm run dev  # генерує образи список автоматично перед запуском сервера
   ```

2. **При збірці:**
   ```bash
   npm run build  # генерує образи список перед побудовою
   ```

3. **Вручну:**
   ```bash
   npm run images:list  # генерує /public/images-list.json
   ```

### Адміністратор користується

На сторінці account.html в формі "Додати новий товар":

1. Кліке в поле "Фото товару"
2. Начинає писати: `images/` або `images/equipment/` або `images/merch/`
3. Отримує список усіх відповідних фото із автодоповненням
4. Вибирає потрібне фото

### Структура фото

```
images/
├── root-level-photos.jpg
├── equipment/
│   ├── 1Z Grind/
│   │   ├── 1zpresso-q-new-1000x1000.webp
│   │   └── ...
│   └── Comandante/
│       ├── GrindComandanteC40.webp
│       └── ...
├── himicals/
│   └── ...
└── merch/
    └── ...
```

Усі фото з'являються у списку з повним шляхом: `images/equipment/1Z Grind/1zpresso-q-new-1000x1000.webp`

### Технічні деталі

- **Формат шляху:** усі шляхи використовують forward-слеші (`/`) навіть на Windows
- **Впорядкування:** фото впорядковані alfabetycally по абсолютному шляху
- **Інших розширень:** легко додаються в масив `imageExtensions` у скрипті
- **Кеширування:** JSON файл регенерується при кожному запуску `npm run dev`/`build`

### Майбутні поліпшення

- [ ] Інтеграція із Supabase Storage (замість локальних файлів)
- [ ] Миніатури фото при наведенні
- [ ] Пошук та фільтрування фото у датасписку
