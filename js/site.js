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
  if (!card) return null;

  const title = button.dataset.name || card.querySelector('h3')?.textContent?.trim() || 'Кавовий лот';
  const category = button.dataset.category || card.dataset.category || 'default';
  const price = Number(button.dataset.price || card.dataset.price || '0');
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
const cartButton = document.querySelector('.cart-button');
const cartCount = document.querySelector('#cart-count');
const cartModal = document.querySelector('#cart-modal');
const cartItemsContainer = document.querySelector('#cart-items');
const cartTotal = document.querySelector('#cart-total');
const cartClose = document.querySelector('#cart-close');

const getCart = () => JSON.parse(localStorage.getItem(cartKey) || '[]');
const setCart = (items) => localStorage.setItem(cartKey, JSON.stringify(items));

const updateCartCounter = () => {
  const items = getCart();
  const total = items.reduce((sum, item) => sum + item.qty, 0);
  if (cartCount) cartCount.textContent = String(total);
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
        <span>${item.title}</span>
        <div>
          <button class="item-decrease" type="button" aria-label="Зменшити кількість">-</button>
          <span>${item.qty}</span>
          <button class="item-increase" type="button" aria-label="Збільшити кількість">+</button>
          <button class="item-remove" type="button" aria-label="Видалити">✕</button>
        </div>
        <span>${item.price * item.qty} грн</span>
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
    items.push({ ...product, qty: 1 });
  }
  setCart(items);
  updateCartCounter();
};

const cartItems = document.querySelector('#cart-items');
const clearCartBtn = document.querySelector('#clear-cart');
const checkoutForm = document.querySelector('#checkout-form');
const checkoutStatus = document.querySelector('#checkout-status');

const setCheckoutStatus = (message, tone = 'neutral') => {
  if (!checkoutStatus) return;
  checkoutStatus.textContent = message;
  checkoutStatus.dataset.tone = tone;
};

const buildCartSummary = (cart) => {
  return cart
    .map((item) => `${item.title} x${item.qty} - ${item.price * item.qty} грн`)
    .join(', ');
};

const buildOrderPayload = ({ name, email, phone, address, cart, total }) => {
  return {
    name,
    email,
    phone,
    address,
    total,
    totalLabel: `${total} грн`,
    cart,
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

const submitViaWeb3Forms = async ({ name, email, phone, address, cart, total }) => {
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
    address,
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
  cartItems.addEventListener('click', (event) => {
    const target = event.target;
    const itemRow = target.closest('.cart-item');
    if (!itemRow) return;
    const itemId = itemRow.dataset.id;
    if (!itemId) return;
    const items = getCart();
    const itemIndex = items.findIndex((n) => n.id === itemId);
    if (itemIndex < 0) return;

    if (target.matches('.item-decrease')) {
      if (items[itemIndex].qty > 1) {
        items[itemIndex].qty -= 1;
      } else {
        items.splice(itemIndex, 1);
      }
    }

    if (target.matches('.item-increase')) {
      items[itemIndex].qty += 1;
    }

    if (target.matches('.item-remove')) {
      items.splice(itemIndex, 1);
    }

    setCart(items);
    renderCart();
    updateCartCounter();
  });
};

if (clearCartBtn) {
  clearCartBtn.addEventListener('click', () => {
    setCart([]);
    renderCart();
    updateCartCounter();
  });
}

if (checkoutForm) {
  checkoutForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(checkoutForm);
    const name = formData.get('name')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const phone = formData.get('phone')?.toString().trim();
    const address = formData.get('address')?.toString().trim();

    if (!name || !email || !phone || !address) {
      alert('Будь ласка, заповніть всі поля форми.');
      return;
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
      alert('Будь ласка, введіть коректну email-адресу.');
      return;
    }

    const cart = getCart();
    if (cart.length === 0) {
      alert('Кошик порожній. Додайте товар перед оформленням замовлення.');
      return;
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const submitButton = checkoutForm.querySelector('button[type="submit"]');

    try {
      if (submitButton) submitButton.disabled = true;
      setCheckoutStatus('Відправляємо замовлення...', 'neutral');

      const submission = await submitOrder({ name, email, phone, address, cart, total });

      localStorage.setItem('latest_order', JSON.stringify({ name, email, phone, address, cart, total, date: new Date().toISOString() }));
      setCart([]);
      renderCart();
      updateCartCounter();
      const successMessage = submission.channel === 'webhook'
        ? 'Замовлення відправлено через резервний канал. Ми зв’яжемося з вами найближчим часом.'
        : 'Замовлення успішно відправлено. Ми зв’яжемося з вами найближчим часом.';
      setCheckoutStatus(successMessage, 'success');
      showToast('Замовлення прийнято. Дякуємо!', 'success');
      checkoutForm.reset();

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
updateCartControls();

