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
const filterButtons = document.querySelectorAll('.product-filter button');
const productCards = document.querySelectorAll('.product-card');

if (filterButtons.length > 0 && productCards.length > 0) {
  // annotate cards by first category tag in meta
  productCards.forEach((card) => {
    const category = card.querySelector('.product-meta span')?.textContent?.trim().toLowerCase().split(' ')[0];
    if (category) {
      card.dataset.category = category;
    }
  });

  const updateFilter = (filter) => {
    productCards.forEach((card) => {
      const category = card.dataset.category;
      card.style.display = filter === 'all' || category === filter ? 'grid' : 'none';
    });
  };

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filterValue = btn.dataset.filter;
      updateFilter(filterValue);
    });
  });
}

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
      row.innerHTML = `<span>${item.title} × ${item.qty}</span><span>${item.price * item.qty} грн</span>`;
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

const productBuyButtons = document.querySelectorAll('.product-buy');
productBuyButtons.forEach((btn) => {
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    const card = btn.closest('.product-card');
    if (!card) return;
    const title = card.querySelector('h3')?.textContent?.trim() ?? 'Кавовий лот';
    const category = card.dataset.category || 'default';
    const price = categoryPrices[category] || categoryPrices.default;
    const id = title.toLowerCase().replace(/\s+/g, '-');
    addToCart({ id, title, category, price });
    if (cartModal) {
      cartModal.classList.add('open');
    }
    renderCart();
  });
});

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

