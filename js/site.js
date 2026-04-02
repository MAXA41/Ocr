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
