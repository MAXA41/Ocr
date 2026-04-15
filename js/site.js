// Mobile menu toggle
const viteEnv = import.meta.env || {};
const runtimeEnv = globalThis.__OCR_ENV__ || {};

const getEnv = (key, fallback = '') => {
  const value = runtimeEnv[key] ?? viteEnv[key] ?? fallback;
  return String(value).trim();
};

const orderProvider = getEnv('VITE_ORDER_PROVIDER', 'web3forms');
const web3FormsAccessKey = getEnv('VITE_WEB3FORMS_ACCESS_KEY');
const fallbackWebhookUrl = getEnv('VITE_ORDER_FALLBACK_WEBHOOK_URL');
const duplicateToWebhook = getEnv('VITE_ORDER_DUPLICATE_TO_WEBHOOK', 'false') === 'true';
const webhookSharedSecret = getEnv('VITE_ORDER_WEBHOOK_SHARED_SECRET');
const novaPoshtaApiKey = getEnv('VITE_NOVA_POSHTA_API_KEY');
const novaPoshtaInitialPageSize = 100;
const novaPoshtaSearchPageSize = 50;
const deliveryAutocompleteLimit = 24;

const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

const ensureToast = () => {
  let toast = document.querySelector('#site-toast');
  if (toast) return toast;

  toast = document.createElement('div');
  toast.id = 'site-toast';
  toast.className = 'site-toast';
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  document.body.append(toast);

  return toast;
};

let toastTimer;

const showToast = (message, tone = 'neutral') => {
  const toast = ensureToast();
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add('visible');

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('visible');
  }, 2600);
};

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
    const expanded = mainNav.classList.contains('open');
    menuToggle.setAttribute('aria-expanded', String(expanded));
  });

  window.addEventListener('click', (event) => {
    if (!mainNav.contains(event.target) && !menuToggle.contains(event.target)) {
      mainNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Product catalog
const bestsellerGrid = document.querySelector('#bestsellers-grid');
const categoryGrid = document.querySelector('#category-grid');
const pageCategory = document.body.dataset.pageCategory || '';
const productDetailRoot = document.querySelector('#product-detail');
const relatedGrid = document.querySelector('#related-grid');
const categoryLabels = {
  all: 'Всі',
  espresso: 'Еспресо',
  filter: 'Фільтр',
  decaf: 'Декаф',
  drips: 'Дріпи',
};

const brewGuides = {
  espresso: {
    title: 'Рекомендація для еспресо',
    text: 'Почніть з рецепту 18 г in / 36 г out та коригуйте помел залежно від щільності й солодкості чашки.',
  },
  filter: {
    title: 'Рекомендація для фільтру',
    text: 'Стартова точка: 15 г кави на 250 мл води, температура 92-94°C. Підійде для V60, Kalita та AeroPress.',
  },
  drips: {
    title: 'Рекомендація для дріпів',
    text: 'Використовуйте 180-200 мл гарячої води та заливайте у 3-4 підходи, щоб чашка лишалася чистою й солодкою.',
  },
  decaf: {
    title: 'Рекомендація для декафу',
    text: 'Декаф добре працює як в еспресо, так і у фільтрі. Почніть з м’якшого рецепту й підлаштуйте екстракцію під свій смак.',
  },
};

const buildMetaItems = (product, showCategory = false) => {
  const items = [
    showCategory ? categoryLabels[product.category] || product.category : null,
    product.origin,
    product.processing,
  ]
    .filter(Boolean)
    .map((item) => `<span>${item}</span>`)
    .join('');

  return items;
};

const renderProductCard = (product, showCategory = false) => {
  return `
    <article class="product-card" data-category="${product.category}" data-price="${product.price}">
      <div class="product-media">
        <a href="product.html?id=${product.id}" aria-label="Перейти на сторінку ${product.name}">
          <img src="${product.image}" alt="${product.alt}" loading="lazy" decoding="async">
        </a>
      </div>
      <div class="product-body">
        <h3><a href="product.html?id=${product.id}">${product.name}</a></h3>
        <p>${product.description}</p>
        <div class="product-meta">${buildMetaItems(product, showCategory)}</div>
        <div class="product-card-actions">
          <span class="product-price">${product.price} грн</span>
          <a class="btn outline" href="product.html?id=${product.id}">Детальніше</a>
          <button class="btn primary product-buy" data-id="${product.id}" data-name="${product.name}" data-category="${product.category}" data-price="${product.price}" type="button">Купити</button>
        </div>
      </div>
    </article>`;
};

const renderProductCollection = (container, products, showCategory = false) => {
  if (!container) return;
  container.innerHTML = products.map((product) => renderProductCard(product, showCategory)).join('');
  attachBuyHandlers();
};

const renderEmptyCategory = () => {
  if (!categoryGrid) return;
  categoryGrid.innerHTML = `
    <article class="coffee-card empty-state">
      <h3>Декаф незабаром повернеться в меню</h3>
      <p>Сторінка вже готова під окремі позиції без кофеїну. Щойно з'явиться новий декаф-лот, він автоматично потрапить у цей розділ.</p>
      <div class="card-meta">
        <span>оновлення каталогу</span>
        <span>окремий напрямок</span>
      </div>
      <a class="btn outline" href="index.html#contact">Запитати про декаф</a>
    </article>`;
};

const getProductPageCopy = (product) => {
  const brewGuide = brewGuides[product.category] || brewGuides.filter;

  return {
    eyebrow: categoryLabels[product.category] || 'Лот',
    categoryLabel: categoryLabels[product.category] || product.category,
    guideTitle: brewGuide.title,
    guideText: brewGuide.text,
    whyItFits:
      product.category === 'espresso'
        ? 'Підійде для щільної чашки, молочних напоїв і стабільного щоденного рецепту.'
        : product.category === 'filter'
          ? 'Підійде для ручного заварювання, якщо хочеться чистої ароматики та прозорого aftertaste.'
          : product.category === 'drips'
            ? 'Підійде для швидкого приготування в дорозі, в офісі або як подарунковий формат.'
            : 'Підійде для тих, хто хоче м’який смаковий профіль без кофеїну.',
  };
};

const renderProductDetail = (product, allProducts) => {
  if (!productDetailRoot) return;

  const copy = getProductPageCopy(product);
  document.title = `${product.name} | Odesa Coffee Roasters`;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', `${product.name} від Odesa Coffee Roasters: ${product.description}`);
  }

  productDetailRoot.innerHTML = `
    <section class="hero product-hero">
      <div class="container product-detail-grid">
        <div class="product-detail-media">
          <img src="${product.image}" alt="${product.alt}">
        </div>
        <div class="hero-copy product-detail-copy">
          <p class="eyebrow">${copy.eyebrow}</p>
          <h1>${product.name}</h1>
          <p class="lead">${product.description}</p>
          <div class="product-meta product-detail-meta">
            <span>${copy.categoryLabel}</span>
            ${product.origin ? `<span>${product.origin}</span>` : ''}
            ${product.processing ? `<span>${product.processing}</span>` : ''}
          </div>
          <div class="product-detail-price-row">
            <span class="product-detail-price">${product.price} грн</span>
            <button class="btn primary product-buy" data-id="${product.id}" data-name="${product.name}" data-category="${product.category}" data-price="${product.price}" type="button">Додати в кошик</button>
          </div>
          <div class="hero-actions">
            <a class="btn ghost" href="${product.category}.html">Назад до категорії</a>
            <a class="btn light" href="index.html#products">До хітів продажу</a>
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container product-info-grid">
        <article class="coffee-card">
          <p class="eyebrow">Що в чашці</p>
          <h2>Смаковий профіль</h2>
          <p>${product.description}</p>
        </article>
        <article class="coffee-card">
          <p class="eyebrow">Походження</p>
          <h2>${product.origin || 'Лот у процесі оновлення'}</h2>
          <p>Спосіб обробки: ${product.processing || 'уточнюємо найближчим оновленням каталогу'}.</p>
        </article>
        <article class="coffee-card">
          <p class="eyebrow">Як заварювати</p>
          <h2>${copy.guideTitle}</h2>
          <p>${copy.guideText}</p>
        </article>
        <article class="coffee-card">
          <p class="eyebrow">Кому підійде</p>
          <h2>Для щоденного меню</h2>
          <p>${copy.whyItFits}</p>
        </article>
      </div>
    </section>`;

  if (relatedGrid) {
    const relatedProducts = allProducts
      .filter((item) => item.category === product.category && item.id !== product.id)
      .slice(0, 3);

    relatedGrid.innerHTML = relatedProducts.length > 0
      ? relatedProducts.map((item) => renderProductCard(item, false)).join('')
      : '';
  }

  attachBuyHandlers();
};

const renderProductNotFound = () => {
  if (!productDetailRoot) return;
  productDetailRoot.innerHTML = `
    <section class="section">
      <div class="container">
        <article class="coffee-card empty-state">
          <h1>Лот не знайдено</h1>
          <p>Можливо, товар було прибрано з каталогу або посилання застаріло.</p>
          <a class="btn outline" href="index.html#products">Повернутися до каталогу</a>
        </article>
      </div>
    </section>`;
};

const getProductPayload = (button) => {
  const card = button.closest('.product-card');
  const detailSection = button.closest('.product-detail-copy');

  const title = button.dataset.name
    || card?.querySelector('h3')?.textContent?.trim()
    || detailSection?.querySelector('h1')?.textContent?.trim()
    || 'Кавовий лот';
  const category = button.dataset.category || card?.dataset.category || 'default';
  const price = Number(button.dataset.price || card?.dataset.price || '0');
  const id = button.dataset.id || title.toLowerCase().replace(/\s+/g, '-');

  return { id, title, category, price };
};

const attachBuyHandlers = () => {
  const productBuyButtons = document.querySelectorAll('.product-buy');
  productBuyButtons.forEach((btn) => {
    if (btn.dataset.buyBound === 'true') return;
    btn.dataset.buyBound = 'true';

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const product = getProductPayload(btn);
      if (!product) return;
      addToCart(product);
      showToast(`${product.title} додано до кошика.`, 'success');
      if (cartModal) {
        cartModal.classList.add('open');
      }
      renderCart();
    });
  });
};

if (bestsellerGrid || categoryGrid || productDetailRoot) {
  fetch('products.json')
    .then((res) => res.json())
    .then((products) => {
      if (bestsellerGrid) {
        const featuredProducts = products.filter((product) => product.featured).slice(0, 3);
        renderProductCollection(bestsellerGrid, featuredProducts, true);
      }

      if (categoryGrid && pageCategory) {
        const categoryProducts = products.filter((product) => product.category === pageCategory);
        if (categoryProducts.length > 0) {
          renderProductCollection(categoryGrid, categoryProducts, false);
        } else {
          renderEmptyCategory();
        }
      }

      if (productDetailRoot) {
        const productId = new URLSearchParams(window.location.search).get('id');
        const product = products.find((item) => item.id === productId);
        if (product) {
          renderProductDetail(product, products);
        } else {
          renderProductNotFound();
        }
      }
    })
    .catch((err) => {
      console.error('Failed to load products', err);
    });
} else {
  attachBuyHandlers();
}

// Cart logic
const cartKey = 'ocr_cart_items';
const checkoutDraftKey = 'ocr_checkout_draft';
const latestOrderKey = 'latest_order';
const cartButton = document.querySelector('.cart-button');
const cartCount = document.querySelector('#cart-count');
const cartModal = document.querySelector('#cart-modal');
const cartItemsContainer = document.querySelector('#cart-items');
const cartTotal = document.querySelector('#cart-total');
const cartClose = document.querySelector('#cart-close');

const cartGrindOptions = [
  { value: '', label: 'Оберіть помол' },
  { value: 'beans', label: 'У зерні' },
  { value: 'espresso', label: 'Помол під еспресо' },
  { value: 'moka', label: 'Помол під гейзер' },
  { value: 'filter', label: 'Помол під фільтр' },
  { value: 'aeropress', label: 'Помол під AeroPress' },
  { value: 'french-press', label: 'Помол під French Press' },
  { value: 'turka', label: 'Помол під турку' },
];

const normalizeCartItem = (item) => ({
  ...item,
  grindMethod: item.category === 'drips' ? 'drip-ready' : item.grindMethod || '',
});

const getCart = () => JSON.parse(localStorage.getItem(cartKey) || '[]').map(normalizeCartItem);
const setCart = (items) => localStorage.setItem(cartKey, JSON.stringify(items.map(normalizeCartItem)));

const updateCartCounter = () => {
  const items = getCart();
  const total = items.reduce((sum, item) => sum + item.qty, 0);
  if (cartCount) cartCount.textContent = String(total);
};

const getGrindLabel = (item) => {
  if (item.category === 'drips') {
    return 'Готовий дріп';
  }

  return cartGrindOptions.find((option) => option.value === item.grindMethod)?.label || 'Оберіть помол';
};

const getGrindOptionsMarkup = (item) => {
  const options = item.category === 'drips'
    ? [{ value: 'drip-ready', label: 'Готовий дріп' }]
    : cartGrindOptions;

  return options
    .map((option) => `<option value="${option.value}"${option.value === item.grindMethod ? ' selected' : ''}>${option.label}</option>`)
    .join('');
};

const renderCart = () => {
  const items = getCart();
  if (!cartItemsContainer || !cartTotal) return;
  cartItemsContainer.innerHTML = '';
  if (items.length === 0) {
    cartItemsContainer.innerHTML = '<p>Кошик порожній</p>';
    cartTotal.textContent = 'Разом: 0 грн';
  } else {
    const totalCost = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.dataset.id = item.id;
      row.innerHTML = `
        <div class="cart-item-main">
          <span class="cart-item-title">${item.title}</span>
          <div class="cart-item-grind">
            <label for="grind-${item.id}">Помол для цієї позиції</label>
            <select class="item-grind${!item.grindMethod && item.category !== 'drips' ? ' is-invalid' : ''}" id="grind-${item.id}" data-id="${item.id}" aria-label="Помол для ${item.title}" ${item.category === 'drips' ? 'disabled' : ''}>
              ${getGrindOptionsMarkup(item)}
            </select>
          </div>
        </div>
        <div class="cart-item-controls">
          <div class="cart-item-qty">
            <button class="item-decrease" type="button" aria-label="Зменшити кількість">-</button>
            <span>${item.qty}</span>
            <button class="item-increase" type="button" aria-label="Збільшити кількість">+</button>
            <button class="item-remove" type="button" aria-label="Видалити">✕</button>
          </div>
          <span class="cart-item-subtotal">${item.price * item.qty} грн</span>
        </div>
      `;
      cartItemsContainer.append(row);
    });
    cartTotal.textContent = `Разом: ${totalCost} грн`;
  }
};

const addToCart = (product) => {
  const items = getCart();
  const existing = items.find((i) => i.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    items.push(normalizeCartItem({ ...product, qty: 1 }));
  }
  setCart(items);
  updateCartCounter();
};

const cartItems = document.querySelector('#cart-items');
const clearCartBtn = document.querySelector('#clear-cart');
const checkoutForm = document.querySelector('#checkout-form');
const checkoutStatus = document.querySelector('#checkout-status');
const checkoutSummary = document.querySelector('#checkout-summary');
const partnerCitiesList = document.querySelector('#partner-cities-list');
let currentCityOptions = [];
let currentDeliveryLocationOptions = [];
let novaPoshtaLookupTimer;
let novaPoshtaDeliveryLookupTimer;
let lastNovaPoshtaBaseLookupKey = '';

const novaPoshtaSettlementRefCache = new Map();
const novaPoshtaLocationsCache = new Map();
const novaPoshtaLocationsRequestCache = new Map();

const ukraineCities = [
  'Київ',
  'Харків',
  'Одеса',
  'Дніпро',
  'Львів',
  'Запоріжжя',
  'Кривий Ріг',
  'Миколаїв',
  'Вінниця',
  'Херсон',
  'Полтава',
  'Чернігів',
  'Черкаси',
  'Житомир',
  'Суми',
  'Хмельницький',
  'Чернівці',
  'Рівне',
  'Івано-Франківськ',
  'Тернопіль',
  'Кропивницький',
  'Луцьк',
  'Ужгород',
  'Біла Церква',
  'Бровари',
  'Бориспіль',
  'Кременчук',
  'Кам\'янське',
  'Нікополь',
  'Павлоград',
  'Краматорськ',
  'Слов\'янськ',
  'Маріуполь',
  'Бердянськ',
  'Мелітополь',
  'Мукачево',
  'Дрогобич',
  'Стрий',
  'Трускавець',
  'Коломия',
  'Ковель',
  'Дубно',
  'Прилуки',
  'Ніжин',
  'Умань',
  'Конотоп',
  'Олександрія',
  'Калуш',
  'Буча',
  'Ірпінь',
];

const partnerPickupLocations = {
  'Одеса': [
    'Переяславська, вул. Переяславська, 8',
    'Морський порт, Митна площа, 1',
    'Фонтан, Французький бульвар, 20',
  ],
};

const checkoutPersistedFields = [
  'name',
  'phone',
  'email',
  'deliveryMethod',
  'city',
  'deliveryDetails',
  'deliveryLocation',
  'pickupLocation',
  'paymentMethod',
  'comment',
];

const checkoutLabels = {
  deliveryMethod: {
    '': 'Не обрано',
    'nova-branch': 'Нова Пошта: відділення',
    'nova-locker': 'Нова Пошта: поштомат',
    courier: 'Адресна доставка',
    pickup: 'Самовивіз з кав\'ярні партнера',
  },
  paymentMethod: {
    '': 'Не обрано',
    'card-transfer': 'Переказ на картку',
    'bank-details': 'Оплата за реквізитами',
    cod: 'Післяплата',
    'cash-pickup': 'Готівкою при самовивозі',
  },
};

const getCheckoutField = (name) => checkoutForm?.elements.namedItem(name) || null;

const ensureCityAutocompleteMenu = () => {
  if (!checkoutForm) return null;

  let menu = checkoutForm.querySelector('.city-autocomplete-menu');
  if (menu) return menu;

  const cityInput = getCheckoutField('city');
  if (!cityInput) return null;

  menu = document.createElement('div');
  menu.className = 'city-autocomplete-menu';
  menu.hidden = true;
  cityInput.insertAdjacentElement('afterend', menu);

  menu.addEventListener('mousedown', (event) => {
    const option = event.target.closest('.city-autocomplete-option');
    if (!(option instanceof HTMLButtonElement)) return;

    event.preventDefault();

    const cityInputField = getCheckoutField('city');
    if (!cityInputField) return;

    cityInputField.value = option.dataset.city || '';
    clearFieldValidation(cityInputField);

    if (getCheckoutField('deliveryMethod')?.value === 'pickup') {
      renderPickupLocations(cityInputField.value.trim());
      const pickupSelect = getCheckoutField('pickupLocation');
      const deliveryDetails = getCheckoutField('deliveryDetails');
      if (pickupSelect) pickupSelect.value = '';
      if (deliveryDetails) deliveryDetails.value = '';
    }

    if (['nova-branch', 'nova-locker'].includes(getCheckoutField('deliveryMethod')?.value || '')) {
      scheduleNovaPoshtaLookup();
    }

    hideCityAutocomplete();
    persistCheckoutForm();
    renderCheckoutSummary();
  });

  return menu;
};

const ensureDeliveryAutocompleteMenu = () => {
  if (!checkoutForm) return null;

  let menu = checkoutForm.querySelector('.delivery-autocomplete-menu');
  if (menu) return menu;

  const deliveryInput = getCheckoutField('deliveryLocation');
  if (!deliveryInput) return null;

  menu = document.createElement('div');
  menu.className = 'delivery-autocomplete-menu';
  menu.hidden = true;
  deliveryInput.insertAdjacentElement('afterend', menu);

  menu.addEventListener('mousedown', (event) => {
    const option = event.target.closest('.delivery-autocomplete-option');
    if (!(option instanceof HTMLButtonElement)) return;

    event.preventDefault();

    const deliveryInputField = getCheckoutField('deliveryLocation');
    if (!deliveryInputField) return;

    deliveryInputField.value = option.dataset.location || '';
    clearFieldValidation(deliveryInputField);
    syncDeliveryLocationValue();
    hideDeliveryAutocomplete();
    persistCheckoutForm();
    renderCheckoutSummary();
  });

  return menu;
};

const renderCityOptions = (cities) => {
  currentCityOptions = [...new Set(cities)];
  if (!partnerCitiesList) return;
  partnerCitiesList.innerHTML = cities
    .map((city) => `<option value="${city}"></option>`)
    .join('');
};

const hideCityAutocomplete = () => {
  const menu = ensureCityAutocompleteMenu();
  if (!menu) return;

  menu.hidden = true;
  menu.innerHTML = '';
};

const syncCityAutocomplete = () => {
  const cityInput = getCheckoutField('city');
  if (!cityInput) return;

  const query = cityInput.value.trim().toLocaleLowerCase('uk-UA');
  if (query.length < 1 || currentCityOptions.length === 0) {
    hideCityAutocomplete();
    return;
  }

  const matches = currentCityOptions
    .filter((city) => city.toLocaleLowerCase('uk-UA').startsWith(query))
    .slice(0, 8);

  const menu = ensureCityAutocompleteMenu();
  if (!menu || matches.length === 0) {
    hideCityAutocomplete();
    return;
  }

  menu.innerHTML = matches
    .map((city) => `<button class="city-autocomplete-option" type="button" data-city="${city}">${city}</button>`)
    .join('');
  menu.hidden = false;
};

const renderPartnerCities = () => {
  renderCityOptions(Object.keys(partnerPickupLocations));
};

const renderPickupLocations = (city) => {
  const pickupSelect = getCheckoutField('pickupLocation');
  if (!pickupSelect) return;

  const locations = partnerPickupLocations[city] || [];
  pickupSelect.innerHTML = ['<option value="">Оберіть кав\'ярню партнера</option>']
    .concat(locations.map((location) => `<option value="${location}">${location}</option>`))
    .join('');
};

const renderDeliveryLocations = (locations, emptyLabel = 'Оберіть відділення або поштомат') => {
  currentDeliveryLocationOptions = [...new Set(locations)];
  const npHint = checkoutForm?.querySelector('[data-field-hint="np"]');
  if (npHint && currentDeliveryLocationOptions.length === 0) {
    npHint.textContent = emptyLabel;
  }
};

const hideDeliveryAutocomplete = () => {
  const menu = ensureDeliveryAutocompleteMenu();
  if (!menu) return;

  menu.hidden = true;
  menu.innerHTML = '';
};

const syncDeliveryAutocomplete = () => {
  const deliveryInput = getCheckoutField('deliveryLocation');
  const deliveryMethod = getCheckoutField('deliveryMethod')?.value || '';
  if (!deliveryInput || !['nova-branch', 'nova-locker'].includes(deliveryMethod)) {
    hideDeliveryAutocomplete();
    return;
  }

  const query = deliveryInput.value.trim().toLocaleLowerCase('uk-UA');
  if (query.length < 1 || currentDeliveryLocationOptions.length === 0) {
    hideDeliveryAutocomplete();
    return;
  }

  const matches = currentDeliveryLocationOptions
    .filter((location) => location.toLocaleLowerCase('uk-UA').includes(query))
    .sort((left, right) => {
      const leftText = left.toLocaleLowerCase('uk-UA');
      const rightText = right.toLocaleLowerCase('uk-UA');
      const leftRank = leftText.includes(`№${query}`) ? 0 : leftText.startsWith(query) ? 1 : 2;
      const rightRank = rightText.includes(`№${query}`) ? 0 : rightText.startsWith(query) ? 1 : 2;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return leftText.localeCompare(rightText, 'uk-UA');
    })
    .slice(0, deliveryAutocompleteLimit);

  const menu = ensureDeliveryAutocompleteMenu();
  if (!menu || matches.length === 0) {
    hideDeliveryAutocomplete();
    return;
  }

  menu.innerHTML = matches
    .map((location) => `<button class="delivery-autocomplete-option" type="button" data-location="${location}">${location}</button>`)
    .join('');
  menu.hidden = false;
};

const callNovaPoshtaApi = async (modelName, calledMethod, methodProperties) => {
  if (!novaPoshtaApiKey) {
    throw new Error('Додайте VITE_NOVA_POSHTA_API_KEY у .env.local, щоб підтягувати відділення та поштомати.');
  }

  const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      apiKey: novaPoshtaApiKey,
      modelName,
      calledMethod,
      methodProperties,
    }),
  });

  const result = await response.json();

  if (!response.ok || result.success === false) {
    const message = Array.isArray(result.errors) && result.errors.length > 0
      ? result.errors.join(', ')
      : 'Не вдалося отримати дані Нової Пошти.';
    throw new Error(message);
  }

  return result.data || [];
};

const getNovaPoshtaSettlementRef = async (cityName) => {
  const normalizedCity = cityName.trim();
  if (!normalizedCity) return '';

  if (novaPoshtaSettlementRefCache.has(normalizedCity)) {
    return novaPoshtaSettlementRefCache.get(normalizedCity);
  }

  const settlements = await callNovaPoshtaApi('Address', 'searchSettlements', {
    CityName: normalizedCity,
    Limit: 10,
    Page: 1,
  });

  const match = settlements
    .flatMap((item) => item.Addresses || [])
    .find((item) => item.Present && item.Present.toLocaleLowerCase('uk-UA') === normalizedCity.toLocaleLowerCase('uk-UA'))
    || settlements.flatMap((item) => item.Addresses || [])[0];

  const ref = match?.Ref || '';
  if (ref) {
    novaPoshtaSettlementRefCache.set(normalizedCity, ref);
  }

  return ref;
};

const isNovaPoshtaLocker = (item) => {
  const category = String(item.CategoryOfWarehouse || '').trim().toLocaleLowerCase('uk-UA');
  const type = String(item.TypeOfWarehouse || '').trim().toLocaleLowerCase('uk-UA');
  const text = [item.Description, item.ShortAddress, item.DescriptionRu, item.PostMachineType]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('uk-UA');

  return category === 'postomat'
    || type === 'f9316480-5f2d-425d-bc2c-ac7cd29decf0'
    || text.includes('поштомат');
};

const filterNovaPoshtaLocations = (locations, deliveryMethod) => {
  if (deliveryMethod === 'nova-locker') {
    return locations.filter((item) => isNovaPoshtaLocker(item));
  }

  if (deliveryMethod === 'nova-branch') {
    return locations.filter((item) => !isNovaPoshtaLocker(item));
  }

  return locations;
};

const normalizeLookupValue = (value) => String(value || '').trim().toLocaleLowerCase('uk-UA');

const isKnownNovaPoshtaCity = (cityName) => {
  const normalizedCity = normalizeLookupValue(cityName);
  if (!normalizedCity) return false;

  return ukraineCities.some((city) => normalizeLookupValue(city) === normalizedCity);
};

const formatNovaPoshtaLocation = (item) => {
  const kindLabel = isNovaPoshtaLocker(item) ? 'Поштомат' : 'Відділення';
  const number = String(item.Number || '').trim();
  const shortAddress = String(item.ShortAddress || '').trim();
  const fallbackAddress = String(item.Description || item.DescriptionRu || '').trim();
  const address = shortAddress || fallbackAddress;

  if (number && address) {
    return `${kindLabel} №${number}: ${address}`;
  }

  return address;
};

const loadNovaPoshtaWarehouses = async ({ settlementRef, deliveryMethod, searchTerm = '' }) => {
  const normalizedSearch = String(searchTerm || '').trim();
  const effectiveSearch = normalizedSearch || (deliveryMethod === 'nova-locker' ? 'Поштомат' : '');
  const requestKey = `${deliveryMethod}:${settlementRef}:${effectiveSearch}`;

  if (novaPoshtaLocationsRequestCache.has(requestKey)) {
    return novaPoshtaLocationsRequestCache.get(requestKey);
  }

  const requestPromise = callNovaPoshtaApi('AddressGeneral', 'getWarehouses', {
    SettlementRef: settlementRef,
    Limit: effectiveSearch ? novaPoshtaSearchPageSize : novaPoshtaInitialPageSize,
    Page: 1,
    Language: 'UA',
    FindByString: effectiveSearch,
  });

  novaPoshtaLocationsRequestCache.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    novaPoshtaLocationsRequestCache.delete(requestKey);
  }
};

const loadNovaPoshtaLocations = async ({ city, deliveryMethod, searchTerm = '' }) => {
  const normalizedCity = city.trim();
  if (!normalizedCity || !['nova-branch', 'nova-locker'].includes(deliveryMethod)) {
    renderDeliveryLocations([], deliveryMethod === 'nova-locker' ? 'Оберіть поштомат' : 'Оберіть відділення');
    return;
  }

  const effectiveSearch = String(searchTerm || '').trim() || (deliveryMethod === 'nova-locker' ? 'Поштомат' : '');
  const cacheKey = `${deliveryMethod}:${normalizedCity}:${effectiveSearch}`;
  if (novaPoshtaLocationsCache.has(cacheKey)) {
    renderDeliveryLocations(
      novaPoshtaLocationsCache.get(cacheKey),
      deliveryMethod === 'nova-locker' ? 'Оберіть поштомат' : 'Оберіть відділення',
    );
    return;
  }

  const npHint = checkoutForm?.querySelector('[data-field-hint="np"]');
  if (npHint) {
    npHint.textContent = 'Завантажуємо список пунктів Нової Пошти...';
  }

  const settlementRef = await getNovaPoshtaSettlementRef(normalizedCity);
  if (!settlementRef) {
    throw new Error('Не вдалося знайти місто в довіднику Нової Пошти.');
  }

  const locations = await loadNovaPoshtaWarehouses({ settlementRef, deliveryMethod, searchTerm: effectiveSearch });

  const mappedLocations = filterNovaPoshtaLocations(locations, deliveryMethod)
    .map(formatNovaPoshtaLocation)
    .filter(Boolean);

  novaPoshtaLocationsCache.set(cacheKey, mappedLocations);
  renderDeliveryLocations(
    mappedLocations,
    deliveryMethod === 'nova-locker' ? 'Оберіть поштомат' : 'Оберіть відділення',
  );

  if (npHint) {
    npHint.textContent = mappedLocations.length > 0
      ? searchTerm
        ? `Знайдено ${mappedLocations.length} пунктів за запитом "${searchTerm}".`
        : deliveryMethod === 'nova-locker'
          ? `Знайдено ${mappedLocations.length} поштоматів у місті ${normalizedCity}.`
          : `Знайдено ${mappedLocations.length} відділень у місті ${normalizedCity}.`
      : 'Для цього міста не знайдено доступних пунктів цього типу.';
  }
};

const scheduleNovaPoshtaLookup = () => {
  const deliveryMethod = getCheckoutField('deliveryMethod')?.value || '';
  const city = getCheckoutField('city')?.value.trim() || '';
  const deliveryLocationInput = getCheckoutField('deliveryLocation');
  const deliveryDetails = getCheckoutField('deliveryDetails');
  const npHint = checkoutForm?.querySelector('[data-field-hint="np"]');

  window.clearTimeout(novaPoshtaLookupTimer);

  if (!deliveryLocationInput || !['nova-branch', 'nova-locker'].includes(deliveryMethod)) {
    return;
  }

  if (!city) {
    renderDeliveryLocations([], deliveryMethod === 'nova-locker' ? 'Оберіть поштомат' : 'Оберіть відділення');
    deliveryLocationInput.value = '';
    if (deliveryDetails) deliveryDetails.value = '';
    if (npHint) npHint.textContent = 'Спочатку оберіть місто.';
    hideDeliveryAutocomplete();
    return;
  }

  if (!isKnownNovaPoshtaCity(city)) {
    renderDeliveryLocations([], deliveryMethod === 'nova-locker' ? 'Оберіть поштомат' : 'Оберіть відділення');
    if (npHint) npHint.textContent = 'Оберіть місто зі списку, щоб підтягнути пункти Нової Пошти.';
    hideDeliveryAutocomplete();
    return;
  }

  const baseLookupKey = `${deliveryMethod}:${normalizeLookupValue(city)}`;
  if (baseLookupKey === lastNovaPoshtaBaseLookupKey && currentDeliveryLocationOptions.length > 0) {
    return;
  }

  novaPoshtaLookupTimer = window.setTimeout(async () => {
    try {
      await loadNovaPoshtaLocations({ city, deliveryMethod });
      lastNovaPoshtaBaseLookupKey = baseLookupKey;
      const refreshedInput = getCheckoutField('deliveryLocation');
      if (refreshedInput) {
        refreshedInput.value = '';
      }
      if (deliveryDetails) {
        deliveryDetails.value = '';
      }
      hideDeliveryAutocomplete();
    } catch (error) {
      renderDeliveryLocations([], deliveryMethod === 'nova-locker' ? 'Оберіть поштомат' : 'Оберіть відділення');
      hideDeliveryAutocomplete();
      if (npHint) {
        npHint.textContent = error.message || 'Не вдалося завантажити пункти Нової Пошти.';
      }
    }
  }, 300);
};

const scheduleNovaPoshtaDeliverySearch = () => {
  const deliveryMethod = getCheckoutField('deliveryMethod')?.value || '';
  const city = getCheckoutField('city')?.value.trim() || '';
  const deliveryLocationInput = getCheckoutField('deliveryLocation');
  const npHint = checkoutForm?.querySelector('[data-field-hint="np"]');

  window.clearTimeout(novaPoshtaDeliveryLookupTimer);

  if (!deliveryLocationInput || !['nova-branch', 'nova-locker'].includes(deliveryMethod)) {
    return;
  }

  const query = deliveryLocationInput.value.trim();
  if (!query || query.length < 2 || !isKnownNovaPoshtaCity(city)) {
    return;
  }

  const normalizedQuery = normalizeLookupValue(query);
  const hasLocalMatch = currentDeliveryLocationOptions.some((location) => normalizeLookupValue(location).includes(normalizedQuery));
  if (hasLocalMatch) {
    return;
  }

  novaPoshtaDeliveryLookupTimer = window.setTimeout(async () => {
    try {
      await loadNovaPoshtaLocations({ city, deliveryMethod, searchTerm: query });
      syncDeliveryAutocomplete();
    } catch (error) {
      if (npHint) {
        npHint.textContent = error.message || 'Не вдалося знайти пункти Нової Пошти за цим запитом.';
      }
    }
  }, 350);
};

const setCheckoutStatus = (message, tone = 'neutral') => {
  if (!checkoutStatus) return;
  checkoutStatus.textContent = message;
  checkoutStatus.dataset.tone = tone;
};

const getStoredJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};

const getSavedCheckoutData = () => {
  const latestOrder = getStoredJson(latestOrderKey) || {};
  const draft = getStoredJson(checkoutDraftKey) || {};
  return { ...latestOrder, ...draft };
};

const collectCheckoutFormData = () => {
  if (!checkoutForm) return {};

  return checkoutPersistedFields.reduce((accumulator, fieldName) => {
    const field = getCheckoutField(fieldName);
    if (!field || field.disabled) return accumulator;
    accumulator[fieldName] = field.value.trim();
    return accumulator;
  }, {});
};

const persistCheckoutForm = () => {
  if (!checkoutForm) return;
  localStorage.setItem(checkoutDraftKey, JSON.stringify(collectCheckoutFormData()));
};

const hydrateCheckoutForm = async () => {
  if (!checkoutForm) return;

  const savedData = getSavedCheckoutData();
  if (!savedData || Object.keys(savedData).length === 0) return;

  ['name', 'phone', 'email', 'deliveryMethod', 'city', 'paymentMethod', 'comment'].forEach((fieldName) => {
    const field = getCheckoutField(fieldName);
    const savedValue = savedData[fieldName];
    if (field && typeof savedValue === 'string' && savedValue) {
      field.value = savedValue;
    }
  });

  syncDeliveryFields();

  const deliveryMethod = getCheckoutField('deliveryMethod')?.value || '';
  const city = getCheckoutField('city')?.value.trim() || '';

  if (deliveryMethod === 'pickup') {
    renderPickupLocations(city);

    const pickupSelect = getCheckoutField('pickupLocation');
    const savedPickupLocation = savedData.pickupLocation || savedData.deliveryDetails || '';
    if (pickupSelect && savedPickupLocation) {
      pickupSelect.value = savedPickupLocation;
    }
    syncPickupLocationValue();
  } else if (['nova-branch', 'nova-locker'].includes(deliveryMethod) && city) {
    try {
      await loadNovaPoshtaLocations({ city, deliveryMethod });
      const deliveryLocationSelect = getCheckoutField('deliveryLocation');
      const savedDeliveryLocation = savedData.deliveryLocation || savedData.deliveryDetails || '';
      if (deliveryLocationSelect && savedDeliveryLocation) {
        deliveryLocationSelect.value = savedDeliveryLocation;
      }
      syncDeliveryLocationValue();
    } catch (error) {
      const npHint = checkoutForm?.querySelector('[data-field-hint="np"]');
      if (npHint) {
        npHint.textContent = error.message || 'Не вдалося відновити список пунктів Нової Пошти.';
      }
    }
  } else {
    const deliveryDetails = getCheckoutField('deliveryDetails');
    if (deliveryDetails && typeof savedData.deliveryDetails === 'string' && savedData.deliveryDetails) {
      deliveryDetails.value = savedData.deliveryDetails;
    }
  }

  renderCheckoutSummary();
};

const getCheckoutLabel = (group, value) => checkoutLabels[group]?.[value] || value || 'Не обрано';

const getDeliveryFieldConfig = (deliveryMethod) => {
  if (deliveryMethod === 'pickup') {
    return {
      cityLabel: 'Місто',
      detailsLabel: 'Кав\'ярня для самовивозу',
      detailsPlaceholder: 'Оберіть місто та кав\'ярню партнера',
      cityRequired: true,
    };
  }

  if (deliveryMethod === 'courier') {
    return {
      cityLabel: 'Місто',
      detailsLabel: 'Адреса доставки',
      detailsPlaceholder: 'Вулиця, будинок, квартира',
      cityRequired: true,
    };
  }

  if (deliveryMethod === 'nova-locker') {
    return {
      cityLabel: 'Місто',
      detailsLabel: 'Поштомат',
      detailsPlaceholder: 'Номер поштомату або повна назва',
      cityRequired: true,
    };
  }

  return {
    cityLabel: 'Місто',
    detailsLabel: 'Відділення / адреса',
    detailsPlaceholder: 'Номер відділення або повна адреса',
    cityRequired: true,
  };
};

const syncDeliveryFields = () => {
  if (!checkoutForm) return;

  const deliveryMethod = getCheckoutField('deliveryMethod')?.value || '';
  const cityInput = getCheckoutField('city');
  const deliveryDetails = getCheckoutField('deliveryDetails');
  const deliveryLocationSelect = getCheckoutField('deliveryLocation');
  const pickupSelect = getCheckoutField('pickupLocation');
  const cityLabel = cityInput?.closest('label[data-field="city"]');
  const detailsLabel = deliveryDetails?.closest('label[data-field="deliveryDetails"]');
  const cityHint = checkoutForm?.querySelector('[data-field-hint="city"]');
  const pickupHint = checkoutForm?.querySelector('[data-field-hint="pickup"]');
  const npHint = checkoutForm?.querySelector('[data-field-hint="np"]');

  if (!cityInput || !deliveryDetails || !deliveryLocationSelect || !pickupSelect || !cityLabel || !detailsLabel) return;

  const config = getDeliveryFieldConfig(deliveryMethod);
  const cityTitle = cityLabel.childNodes[0];
  const detailsTitle = detailsLabel.childNodes[0];

  if (cityTitle) cityTitle.textContent = `${config.cityLabel}`;
  if (detailsTitle) detailsTitle.textContent = `${config.detailsLabel}`;

  cityInput.required = config.cityRequired;
  cityInput.disabled = false;

  deliveryDetails.placeholder = config.detailsPlaceholder;

  if (deliveryMethod === 'pickup') {
    lastNovaPoshtaBaseLookupKey = '';
    renderPartnerCities();
    renderPickupLocations(cityInput.value.trim());
    cityInput.placeholder = 'Оберіть місто з партнерською кав\'ярнею';
    cityHint.textContent = Object.keys(partnerPickupLocations).length > 0
      ? `Доступні міста: ${Object.keys(partnerPickupLocations).join(', ')}`
      : '';
    pickupHint.textContent = 'Оберіть кав\'ярню, де вам буде зручно забрати замовлення.';
    npHint.textContent = '';
    deliveryLocationSelect.hidden = true;
    deliveryLocationSelect.disabled = true;
    deliveryLocationSelect.value = '';
    hideDeliveryAutocomplete();
    pickupSelect.hidden = false;
    pickupSelect.disabled = false;
    deliveryDetails.hidden = true;
    deliveryDetails.disabled = true;
    deliveryDetails.value = pickupSelect.value;
  } else if (deliveryMethod === 'nova-branch' || deliveryMethod === 'nova-locker' || deliveryMethod === 'courier') {
    renderCityOptions(ukraineCities);
    cityInput.placeholder = 'Почніть вводити місто України';
    cityHint.textContent = 'Для доставки Новою Поштою можна вибрати місто зі списку або почати вводити його назву.';
    pickupHint.textContent = '';
    pickupSelect.hidden = true;
    pickupSelect.disabled = true;
    pickupSelect.value = '';
    if (deliveryMethod === 'courier') {
      lastNovaPoshtaBaseLookupKey = '';
      npHint.textContent = '';
      deliveryLocationSelect.hidden = true;
      deliveryLocationSelect.disabled = true;
      deliveryLocationSelect.value = '';
      hideDeliveryAutocomplete();
      deliveryDetails.hidden = false;
      deliveryDetails.disabled = false;
    } else {
      npHint.textContent = cityInput.value.trim() ? 'Підберемо пункти Нової Пошти після вибору міста.' : 'Спочатку оберіть місто.';
      deliveryLocationSelect.hidden = false;
      deliveryLocationSelect.disabled = false;
      deliveryLocationSelect.placeholder = deliveryMethod === 'nova-locker' ? 'Почніть вводити назву поштомату' : 'Почніть вводити назву відділення';
      deliveryDetails.hidden = true;
      deliveryDetails.disabled = true;
      renderDeliveryLocations([], deliveryMethod === 'nova-locker' ? 'Оберіть поштомат' : 'Оберіть відділення');
      scheduleNovaPoshtaLookup();
    }
  } else {
    lastNovaPoshtaBaseLookupKey = '';
    renderCityOptions([]);
    cityInput.placeholder = '';
    cityHint.textContent = '';
    pickupHint.textContent = '';
    npHint.textContent = '';
    deliveryLocationSelect.hidden = true;
    deliveryLocationSelect.disabled = true;
    deliveryLocationSelect.value = '';
    hideDeliveryAutocomplete();
    pickupSelect.hidden = true;
    pickupSelect.disabled = true;
    pickupSelect.value = '';
    deliveryDetails.hidden = false;
    deliveryDetails.disabled = false;
  }

  syncCityAutocomplete();
};

const renderCheckoutSummary = () => {
  if (!checkoutSummary) return;

  const items = getCart();
  if (items.length === 0) {
    checkoutSummary.innerHTML = '<p>Додайте товари в кошик, щоб побачити підсумок.</p>';
    return;
  }

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const deliveryMethod = getCheckoutField('deliveryMethod')?.value || '';
  const paymentMethod = getCheckoutField('paymentMethod')?.value || '';

  checkoutSummary.innerHTML = `
    <div class="checkout-summary-row"><span>Товарів</span><strong>${items.reduce((sum, item) => sum + item.qty, 0)}</strong></div>
    <div class="checkout-summary-row"><span>Сума</span><strong>${total} грн</strong></div>
    <div class="checkout-summary-row"><span>Доставка</span><strong>${getCheckoutLabel('deliveryMethod', deliveryMethod)}</strong></div>
    <div class="checkout-summary-row"><span>Оплата</span><strong>${getCheckoutLabel('paymentMethod', paymentMethod)}</strong></div>
    <small>Помол вказується окремо для кожного товару в кошику. Вартість доставки уточнюється менеджером після підтвердження.</small>
    <div class="checkout-summary-items">
      ${items.map((item) => `
        <div class="checkout-summary-item">
          <div class="checkout-summary-item-copy">
            <span class="checkout-summary-item-title">${item.title} x${item.qty}</span>
            <span class="checkout-summary-item-grind">Помол: ${getGrindLabel(item)}</span>
          </div>
          <strong>${item.price * item.qty} грн</strong>
        </div>
      `).join('')}
    </div>
  `;
};

const clearFieldValidation = (field) => {
  field.classList.remove('is-invalid');
};

const markFieldInvalid = (field) => {
  field.classList.add('is-invalid');
};

const validateCheckoutForm = () => {
  if (!checkoutForm) return false;

  const requiredFields = ['name', 'phone', 'email', 'deliveryMethod', 'paymentMethod'];
  const deliveryMethod = getCheckoutField('deliveryMethod')?.value || '';

  if (['nova-branch', 'nova-locker'].includes(deliveryMethod)) {
    requiredFields.push('deliveryLocation');
  } else {
    requiredFields.push('deliveryDetails');
  }

  if (getCheckoutField('city')?.required) {
    requiredFields.push('city');
  }

  checkoutForm.querySelectorAll('input, textarea, select').forEach(clearFieldValidation);

  let firstInvalidField = null;

  requiredFields.forEach((name) => {
    const field = getCheckoutField(name);
    if (!field) return;
    if ('disabled' in field && field.disabled) return;
    const value = field.value.trim();
    if (!value) {
      markFieldInvalid(field);
      firstInvalidField ||= field;
    }
  });

  const emailField = getCheckoutField('email');
  if (emailField && emailField.value.trim()) {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(emailField.value.trim())) {
      markFieldInvalid(emailField);
      firstInvalidField ||= emailField;
    }
  }

  if (firstInvalidField) {
    setCheckoutStatus('Перевірте, будь ласка, обов\'язкові поля форми.', 'error');
    firstInvalidField.focus();
    return false;
  }

  setCheckoutStatus('', 'neutral');
  return true;
};

const syncPickupLocationValue = () => {
  const pickupSelect = getCheckoutField('pickupLocation');
  const deliveryDetails = getCheckoutField('deliveryDetails');
  const cityInput = getCheckoutField('city');
  const deliveryMethod = getCheckoutField('deliveryMethod')?.value || '';

  if (!pickupSelect || !deliveryDetails || deliveryMethod !== 'pickup') return;

  if (cityInput && cityInput.value.trim()) {
    renderPickupLocations(cityInput.value.trim());
  }

  deliveryDetails.value = pickupSelect.value;
};

const syncDeliveryLocationValue = () => {
  const deliveryLocationSelect = getCheckoutField('deliveryLocation');
  const deliveryDetails = getCheckoutField('deliveryDetails');
  const deliveryMethod = getCheckoutField('deliveryMethod')?.value || '';

  if (!deliveryLocationSelect || !deliveryDetails || !['nova-branch', 'nova-locker'].includes(deliveryMethod)) return;

  deliveryDetails.value = deliveryLocationSelect.value;
};

const buildCartSummary = (cart) => {
  return cart
    .map((item) => `${item.title} (${getGrindLabel(item)}) x${item.qty} - ${item.price * item.qty} грн`)
    .join(', ');
};

const buildOrderPayload = ({
  name,
  email,
  phone,
  city,
  deliveryMethod,
  deliveryDetails,
  paymentMethod,
  comment,
  cart,
  total,
}) => {
  return {
    name,
    email,
    phone,
    city,
    deliveryMethod,
    deliveryMethodLabel: getCheckoutLabel('deliveryMethod', deliveryMethod),
    deliveryDetails,
    paymentMethod,
    paymentMethodLabel: getCheckoutLabel('paymentMethod', paymentMethod),
    comment,
    total,
    totalLabel: `${total} грн`,
    cart: cart.map((item) => ({
      ...item,
      grindLabel: getGrindLabel(item),
    })),
    orderItems: buildCartSummary(cart),
    createdAt: new Date().toISOString(),
    source: 'website',
    brand: 'Odesa Coffee Roasters',
    sharedSecret: webhookSharedSecret,
  };
};

const submitToWebhook = async (payload) => {
  if (!fallbackWebhookUrl) {
    throw new Error('Не налаштовано резервний webhook-канал.');
  }

  const response = await fetch(fallbackWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof result === 'string' ? result : result.message;
    throw new Error(message || 'Webhook не прийняв замовлення.');
  }

  return result;
};

const submitViaWeb3Forms = async ({
  name,
  email,
  phone,
  city,
  deliveryMethod,
  deliveryDetails,
  paymentMethod,
  comment,
  cart,
  total,
}) => {
  if (orderProvider !== 'web3forms') {
    throw new Error('Непідтримуваний провайдер замовлень.');
  }

  if (!web3FormsAccessKey) {
    throw new Error('Не налаштовано ключ відправки замовлень.');
  }

  const payload = {
    access_key: web3FormsAccessKey,
    subject: `Нове замовлення з Odesa Coffee Roasters на ${total} грн`,
    from_name: name,
    email,
    phone,
    city,
    delivery_method: getCheckoutLabel('deliveryMethod', deliveryMethod),
    delivery_details: deliveryDetails,
    payment_method: getCheckoutLabel('paymentMethod', paymentMethod),
    grind_preferences: cart.map((item) => `${item.title}: ${getGrindLabel(item)}`).join(', '),
    comment,
    total: `${total} грн`,
    order_items: buildCartSummary(cart),
    order_json: JSON.stringify(cart),
    botcheck: '',
  };

  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Не вдалося відправити замовлення.');
  }

  return result;
};

const submitOrder = async (order) => {
  const payload = buildOrderPayload(order);

  try {
    const primaryResult = await submitViaWeb3Forms(order);

    if (fallbackWebhookUrl && duplicateToWebhook) {
      submitToWebhook({ ...payload, deliveryChannel: 'backup-webhook' }).catch((error) => {
        console.error('Fallback webhook duplication failed', error);
      });
    }

    return { channel: 'web3forms', result: primaryResult };
  } catch (primaryError) {
    if (!fallbackWebhookUrl) {
      throw primaryError;
    }

    const fallbackResult = await submitToWebhook({ ...payload, deliveryChannel: 'fallback-webhook' });
    return { channel: 'webhook', result: fallbackResult, fallbackReason: primaryError.message };
  }
};

const updateCartControls = () => {
  if (!cartItems) return;

  cartItems.addEventListener('mousedown', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('.item-grind')) {
      event.stopPropagation();
    }
  });

  cartItems.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('.item-grind')) {
      event.stopPropagation();
    }
  });

  cartItems.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionButton = target.closest('.item-decrease, .item-increase, .item-remove');
    if (!actionButton) return;

    const itemRow = target.closest('.cart-item');
    if (!itemRow) return;
    const itemId = itemRow.dataset.id;
    if (!itemId) return;
    const items = getCart();
    const itemIndex = items.findIndex((n) => n.id === itemId);
    if (itemIndex < 0) return;

    if (actionButton.matches('.item-decrease')) {
      if (items[itemIndex].qty > 1) {
        items[itemIndex].qty -= 1;
      } else {
        items.splice(itemIndex, 1);
      }
    }

    if (actionButton.matches('.item-increase')) {
      items[itemIndex].qty += 1;
    }

    if (actionButton.matches('.item-remove')) {
      items.splice(itemIndex, 1);
    }

    setCart(items);
    renderCart();
    updateCartCounter();
    renderCheckoutSummary();
  });

  cartItems.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.matches('.item-grind')) return;

    const itemId = target.dataset.id;
    if (!itemId) return;

    const items = getCart();
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex < 0) return;

    items[itemIndex].grindMethod = target.value;
    setCart(items);
    clearFieldValidation(target);
    renderCheckoutSummary();
  });
};

const validateCartItems = () => {
  const cart = getCart();
  const invalidItem = cart.find((item) => item.category !== 'drips' && !item.grindMethod);

  cartItemsContainer?.querySelectorAll('.item-grind').forEach((select) => clearFieldValidation(select));

  if (!invalidItem) return true;

  const invalidSelect = cartItemsContainer?.querySelector(`.item-grind[data-id="${invalidItem.id}"]`);
  if (invalidSelect) {
    markFieldInvalid(invalidSelect);
    invalidSelect.focus();
  }

  setCheckoutStatus('Оберіть спосіб помолу для кожного товару в кошику.', 'error');
  return false;
};

if (clearCartBtn) {
  clearCartBtn.addEventListener('click', () => {
    setCart([]);
    renderCart();
    updateCartCounter();
    renderCheckoutSummary();
  });
}

if (checkoutForm) {
  const cityInput = getCheckoutField('city');

  if (cityInput) {
    cityInput.addEventListener('focus', () => {
      syncCityAutocomplete();
    });
  }

  const deliveryLocationInput = getCheckoutField('deliveryLocation');
  if (deliveryLocationInput) {
    deliveryLocationInput.addEventListener('focus', () => {
      syncDeliveryAutocomplete();
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;

    const cityLabel = getCheckoutField('city')?.closest('label[data-field="city"]');
    const deliveryLabel = getCheckoutField('deliveryLocation')?.closest('label[data-field="deliveryDetails"]');
    if (cityLabel?.contains(target) || deliveryLabel?.contains(target)) return;

    hideCityAutocomplete();
    hideDeliveryAutocomplete();
  });

  checkoutForm.querySelectorAll('input, textarea, select').forEach((field) => {
    field.addEventListener('input', () => {
      clearFieldValidation(field);
      if (field.name === 'deliveryMethod') {
        syncDeliveryFields();
      }
      if (field.name === 'city') {
        renderPickupLocations(field.value.trim());
        lastNovaPoshtaBaseLookupKey = '';
        scheduleNovaPoshtaLookup();
        syncCityAutocomplete();
      }
      if (field.name === 'deliveryLocation') {
        syncDeliveryLocationValue();
        syncDeliveryAutocomplete();
        scheduleNovaPoshtaDeliverySearch();
      }
      if (field.name === 'pickupLocation') {
        syncPickupLocationValue();
      }
      persistCheckoutForm();
      renderCheckoutSummary();
    });

    field.addEventListener('change', () => {
      clearFieldValidation(field);
      if (field.name === 'deliveryMethod') {
        lastNovaPoshtaBaseLookupKey = '';
        syncDeliveryFields();
      }
      if (field.name === 'city') {
        renderPickupLocations(field.value.trim());
        lastNovaPoshtaBaseLookupKey = '';
        scheduleNovaPoshtaLookup();
        syncCityAutocomplete();
      }
      if (field.name === 'deliveryLocation') {
        syncDeliveryLocationValue();
        syncDeliveryAutocomplete();
        scheduleNovaPoshtaDeliverySearch();
      }
      if (field.name === 'pickupLocation') {
        syncPickupLocationValue();
      }
      persistCheckoutForm();
      renderCheckoutSummary();
    });
  });

  renderPartnerCities();
  hydrateCheckoutForm();
  syncDeliveryFields();
  renderCheckoutSummary();

  checkoutForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!validateCheckoutForm()) {
      return;
    }

    if (!validateCartItems()) {
      return;
    }

    const formData = new FormData(checkoutForm);
    const name = formData.get('name')?.toString().trim();
    const phone = formData.get('phone')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const deliveryMethod = formData.get('deliveryMethod')?.toString().trim();
    const city = formData.get('city')?.toString().trim() || '';
    const deliveryDetails = getCheckoutField('deliveryDetails')?.value.trim();
    const paymentMethod = formData.get('paymentMethod')?.toString().trim();
    const comment = formData.get('comment')?.toString().trim() || '';

    const cart = getCart();
    if (cart.length === 0) {
      setCheckoutStatus('Кошик порожній. Додайте товар перед оформленням замовлення.', 'error');
      return;
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const submitButton = checkoutForm.querySelector('button[type="submit"]');

    try {
      if (submitButton) submitButton.disabled = true;
      setCheckoutStatus('Відправляємо замовлення...', 'neutral');

      const submission = await submitOrder({
        name,
        email,
        phone,
        city,
        deliveryMethod,
        deliveryDetails,
        paymentMethod,
        comment,
        cart,
        total,
      });

      localStorage.setItem(latestOrderKey, JSON.stringify({
        name,
        email,
        phone,
        city,
        deliveryMethod,
        deliveryDetails,
        paymentMethod,
        comment,
        cart,
        total,
        date: new Date().toISOString(),
      }));
      persistCheckoutForm();
      setCart([]);
      renderCart();
      updateCartCounter();
      renderCheckoutSummary();
      const successMessage = submission.channel === 'webhook'
        ? 'Замовлення відправлено через резервний канал. Ми зв\'яжемося з вами найближчим часом для підтвердження деталей і помолу.'
        : `Замовлення прийнято. Доставка: ${getCheckoutLabel('deliveryMethod', deliveryMethod)}. Помол по кожній позиції збережено.`;
      setCheckoutStatus(successMessage, 'success');
      showToast('Замовлення прийнято. Дякуємо!', 'success');
      checkoutForm.reset();
      syncDeliveryFields();
      renderCheckoutSummary();

      window.setTimeout(() => {
        if (cartModal) cartModal.classList.remove('open');
        setCheckoutStatus('', 'neutral');
      }, 1500);
    } catch (error) {
      console.error('Order submission failed', error);
      setCheckoutStatus(error.message || 'Не вдалося відправити замовлення. Спробуйте ще раз.', 'error');
      showToast('Не вдалося відправити замовлення.', 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

if (cartButton) {
  cartButton.addEventListener('click', () => {
    if (cartModal) cartModal.classList.add('open');
    renderCart();
    syncDeliveryFields();
    renderCheckoutSummary();
  });
}

if (cartClose) {
  cartClose.addEventListener('click', () => {
    if (cartModal) cartModal.classList.remove('open');
  });
}

if (cartModal) {
  cartModal.addEventListener('click', (event) => {
    if (event.target === cartModal) {
      cartModal.classList.remove('open');
    }
  });
}

updateCartCounter();

updateCartCounter();
renderCart();
renderPartnerCities();
hydrateCheckoutForm();
syncDeliveryFields();
renderCheckoutSummary();
updateCartControls();

