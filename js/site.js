// Mobile menu toggle
const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

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

// Product filter (on index page)
const productGrid = document.querySelector('#product-grid');
const filterButtons = document.querySelectorAll('.product-filter button');

const renderProducts = (products) => {
  if (!productGrid) return;
  productGrid.innerHTML = products
    .map((product) => {
      return `
        <article class="product-card" data-category="${product.category}" data-price="${product.price}">
          <div class="product-media">
            <img src="${product.image}" alt="${product.alt}" loading="lazy" decoding="async">
          </div>
          <div class="product-body">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="product-meta">
              <span>${product.category}</span>
              <span>${product.origin || ''}</span>
              <span>${product.processing || ''}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <span style="font-weight:700;">${product.price} грн</span>
              <button class="btn primary product-buy" data-id="${product.id}" type="button">Купити</button>
            </div>
          </div>
        </article>`;
    })
    .join('');
  attachBuyHandlers();
};

const applyFilter = (filter) => {
  const cards = productGrid?.querySelectorAll('.product-card') || [];
  cards.forEach((card) => {
    const category = card.dataset.category;
    card.style.display = filter === 'all' || category === filter ? 'grid' : 'none';
  });
};

const setupFilter = () => {
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });
};

const attachBuyHandlers = () => {
  const productBuyButtons = document.querySelectorAll('.product-buy');
  productBuyButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const card = btn.closest('.product-card');
      if (!card) return;
      const title = card.querySelector('h3')?.textContent?.trim() ?? 'Кавовий лот';
      const category = card.dataset.category || 'default';
      const price = Number(card.dataset.price || '0');
      const id = btn.dataset.id || title.toLowerCase().replace(/\s+/g, '-');
      addToCart({ id, title, category, price });
      if (cartModal) {
        cartModal.classList.add('open');
      }
      renderCart();
    });
  });
};

fetch('products.json')
  .then((res) => res.json())
  .then((products) => {
    renderProducts(products);
    setupFilter();
  })
  .catch((err) => {
    console.error('Failed to load products', err);
  });

// Cart logic
const cartKey = 'ocr_cart_items';
const cartButton = document.querySelector('.cart-button');
const cartCount = document.querySelector('#cart-count');
const cartModal = document.querySelector('#cart-modal');
const cartItemsContainer = document.querySelector('#cart-items');
const cartTotal = document.querySelector('#cart-total');
const cartClose = document.querySelector('#cart-close');

const categoryPrices = {
  espresso: 750,
  filter: 620,
  decaf: 680,
  default: 590,
};

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
    cartItemsContainer.innerHTML = '<p>Корзина порожня</p>';
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
  checkoutForm.addEventListener('submit', (event) => {
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

    const cart = getCart();
    if (cart.length === 0) {
      alert('Корзина порожня. Додайте товар перед оформленням.');
      return;
    }

    // Mock submission for now
    localStorage.setItem('latest_order', JSON.stringify({ name, email, phone, address, cart, total: cart.reduce((sum, item) => sum + item.price * item.qty, 0), date: new Date().toISOString() }));
    setCart([]);
    renderCart();
    updateCartCounter();
    alert('Дякуємо! Ваше замовлення прийнято.');
    checkoutForm.reset();
    if (cartModal) cartModal.classList.remove('open');
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
renderCart();
updateCartControls();

