## Production Launch Checklist

Ниже список именно для этого проекта: что уже готово, что еще обязательно сделать руками и в каком порядке лучше запускать магазин.

---

## 1. Что уже готово в коде

На текущий момент в проекте уже реализовано:

1. multi-page storefront на Vite
2. каталог товаров и отдельные страницы товара
3. корзина и checkout
4. личный кабинет с регистрацией и входом по `Email + Password`
5. накопительная скидка через Supabase
6. админский блок для включения/выключения товара и учета остатков
7. поддержка Nova Poshta autocomplete
8. отправка заказа через `Web3Forms` и резервный webhook
9. подготовленные `n8n` workflow и Telegram admin flow

Локальный `.env.local` уже содержит рабочие значения для:

1. `VITE_ORDER_PROVIDER`
2. `VITE_ORDER_FALLBACK_WEBHOOK_URL`
3. `VITE_ORDER_DUPLICATE_TO_WEBHOOK`
4. `VITE_ORDER_WEBHOOK_SHARED_SECRET`
5. `VITE_NOVA_POSHTA_API_KEY`
6. `VITE_SUPABASE_URL`
7. `VITE_SUPABASE_PUBLISHABLE_KEY`
8. `VITE_AUTH_REDIRECT_URL`

Это означает, что фронтенд как приложение уже почти готов к запуску.

---

## 2. Что обязательно сделать руками

### Supabase

Нужно вручную выполнить [docs/supabase-schema.sql](docs/supabase-schema.sql) в Supabase SQL Editor.

Пока это не сделано, не будут полноценно работать:

1. кабинет клиента
2. история заказов
3. накопительная скидка
4. учет остатков
5. админка каталога
6. публичный availability overlay через `product_catalog_public`

После выполнения SQL проверь, что появились таблицы:

1. `profiles`
2. `orders`
3. `order_items`
4. `customer_discount_state`
5. `catalog_admins`
6. `product_catalog_state`

И что view `product_catalog_public` тоже доступен.

### Supabase Auth

В `Authentication` нужно проверить:

1. включен `Email`
2. включен вход по `Email + Password`
3. включено подтверждение email
4. в `Site URL` указан production domain
5. в `Redirect URLs` добавлен `https://odesacoffeeroasters.info/account.html`

### Catalog Admin Access

После выполнения SQL нужно проверить таблицу `catalog_admins`.

Сейчас схема вставляет туда `office@chaicoffski.com`.
Если товаром должен управлять другой человек, добавь его email в эту таблицу.

### Order Delivery Channel

Нужно решить, что является primary production channel:

1. `Web3Forms`
2. `n8n webhook`

Сейчас в локальном конфиге:

1. `VITE_ORDER_PROVIDER=web3forms`
2. резервный webhook уже указан
3. `VITE_ORDER_DUPLICATE_TO_WEBHOOK=true`

То есть при production-запуске нужно проверить, что:

1. Web3Forms access key реально задан в production env
2. webhook в `n8n` опубликован и отвечает
3. оба канала принимают order payload без ошибок

### n8n

В `n8n` нужно:

1. импортировать workflow из [docs/n8n-supabase-orders-workflow.json](docs/n8n-supabase-orders-workflow.json)
2. импортировать workflow из [docs/n8n-supabase-complete-order-workflow.json](docs/n8n-supabase-complete-order-workflow.json)
3. импортировать workflow из [docs/n8n-telegram-complete-order-workflow.json](docs/n8n-telegram-complete-order-workflow.json)
4. заполнить все env в `n8n`
5. подключить Telegram webhook

Подробности уже описаны в [docs/n8n-launch-checklist.md](docs/n8n-launch-checklist.md).

---

## 3. Что желательно решить до запуска

### Онлайн-оплата

Сейчас сайт умеет принимать заказ и выбранный способ оплаты, но не содержит интеграции с эквайрингом уровня LiqPay / Fondy / WayForPay.

Это не блокирует запуск, если схема работы такая:

1. клиент оформляет заказ
2. менеджер подтверждает заказ
3. клиент оплачивает переводом или по реквизитам

Если нужен настоящий checkout с мгновенной оплатой на сайте, это еще отдельный этап интеграции.

### SMTP / branded email

Для auth достаточно штатных писем Supabase.
Но если нужен нормальный брендированный sender, нужно отдельно подключить SMTP в Supabase.

### Analytics / legal / SEO

Не критично для запуска, но обычно добавляют:

1. Google Analytics / Meta Pixel
2. политика конфиденциальности
3. оферта
4. корректные SEO title/description для всех страниц

---

## 4. Что я уже сделал сам

В рамках подготовки к запуску уже закрыто:

1. product page переработана под более коммерческий layout
2. карточка товара научилась выводить расширенные specs из `products.json`
3. каталог получил дополнительные метаданные для части лотов
4. availability на витрине не показывает клиенту точные остатки
5. storefront больше не должен шуметь в консоль, если `product_catalog_public` еще не создан
6. локальная сборка проходит успешно через `npm run build`

---

## 5. Порядок запуска без лишних рисков

Рекомендую такой порядок:

1. выполнить [docs/supabase-schema.sql](docs/supabase-schema.sql)
2. проверить `Auth` и redirect URLs в Supabase
3. проверить, что кабинет открывается и регистрация работает
4. импортировать и настроить `n8n` workflow
5. сделать один тестовый заказ с сайта
6. проверить запись в `orders` и `order_items`
7. проверить уведомление в Telegram
8. закрыть тестовый заказ через completion flow
9. проверить обновление `customer_discount_state`
10. после этого только публиковать production build

---

## 6. Финальный smoke test перед релизом

Перед публикацией обязательно проверь:

1. товар открывается по прямой ссылке
2. товар добавляется в корзину
3. checkout отправляет заказ без ошибки
4. заказ доходит в выбранный канал
5. заказ создается в Supabase
6. пользователь может зарегистрироваться и войти
7. заказ виден в кабинете после записи
8. админ каталога может включать и отключать товар
9. остаток влияет на доступность товара на витрине
10. на production domain работают `account.html` и `product.html`

---

## 7. Что нельзя сделать автоматически отсюда

Из текущей среды я не могу сам:

1. выполнить SQL в вашем Supabase проекте
2. включить auth/provider настройки в Supabase UI
3. импортировать workflow в ваш `n8n` cloud и активировать их
4. подключить Telegram webhook в ваш production bot
5. подключить эквайринг

Это уже требует доступа к вашим внешним сервисам.

---

## 8. Минимум для реального запуска

Если коротко, production-ready минимум для этого проекта такой:

1. SQL schema применена
2. Supabase auth настроен
3. order flow через Web3Forms и/или n8n протестирован
4. один admin email добавлен в `catalog_admins`
5. выполнен полный тестовый заказ до статуса `completed`

После этого магазин уже можно запускать как рабочий.