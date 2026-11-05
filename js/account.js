import { supabase, isSupabaseConfigured } from './supabase-client.js?v=2';
import { normalizeCatalogState } from './catalog-state.js?v=3';
import { buildImagePickerMarkup, hydrateImagePickers, syncImagePickers } from './image-picker.js?v=1';

const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const authForm = document.querySelector('#account-auth-form');
const authModeTriggers = document.querySelectorAll('[data-auth-mode-trigger]');
const authEyebrow = document.querySelector('#account-auth-eyebrow');
const authTitle = document.querySelector('#account-auth-title');
const authHelp = document.querySelector('#account-auth-help');
const authSubmit = document.querySelector('#account-auth-submit');
const authStatus = document.querySelector('#account-auth-status');
const authState = document.querySelector('#account-auth-state');
const authCard = document.querySelector('#account-auth-card');
const authToggle = document.querySelector('.account-auth-toggle');
const authSecondary = document.querySelector('#account-auth-secondary');
const confirmationHint = document.querySelector('#account-confirmation-hint');
const resendConfirmationButton = document.querySelector('#account-resend-confirmation');
const forgotPasswordButton = document.querySelector('#account-forgot-password');
const authNameField = document.querySelector('[data-auth-name-field]');
const authPasswordField = document.querySelector('[data-auth-password-field]');
const authRecoveryPasswordField = document.querySelector('[data-auth-recovery-password-field]');
const passwordRules = document.querySelector('#account-password-rules');
const passwordRuleItems = document.querySelectorAll('[data-password-rule]');
const userEmail = document.querySelector('#account-user-email');
const signOutButton = document.querySelector('#account-signout');
const dashboard = document.querySelector('#account-dashboard');
const profileList = document.querySelector('#account-profile-list');
const discountCard = document.querySelector('#account-discount-card');
const ordersRoot = document.querySelector('#account-orders');
const catalogAdminPanel = document.querySelector('#catalog-admin-panel');
const catalogAdminLead = document.querySelector('#catalog-admin-lead');
const catalogAdminSearch = document.querySelector('#catalog-admin-search');
const catalogAdminFilter = document.querySelector('#catalog-admin-filter');
const catalogAdminRefresh = document.querySelector('#catalog-admin-refresh');
const catalogAdminStatus = document.querySelector('#catalog-admin-status');
const catalogAdminList = document.querySelector('#catalog-admin-list');
const catalogAdminCreateForm = document.querySelector('#catalog-admin-create-form');
const catalogAdminCreateStatus = document.querySelector('#catalog-admin-create-status');
const catalogAdminCreateSubmit = document.querySelector('#catalog-admin-create-submit');
const fullNameInput = authForm?.querySelector('input[name="fullName"]') || null;
const passwordInput = authForm?.querySelector('input[name="password"]') || null;
const recoveryPasswordInput = authForm?.querySelector('input[name="recoveryPassword"]') || null;
const emailInput = authForm?.querySelector('input[name="email"]') || null;
let pendingConfirmationEmail = '';
let currentSession = null;
let currentProfile = null;
let catalogAdminRows = [];
let catalogAdminHasUnsavedChanges = false;
const catalogVolumeOptions = ['250g', '1kg'];
const editableCatalogTextFields = ['category', 'name', 'description', 'image', 'origin', 'processing', 'alt', 'weight', 'taste', 'cup_profile', 'brew_guide', 'audience'];
const catalogTextFieldColumnMap = {
  category: 'category_override',
  name: 'name_override',
  description: 'description_override',
  image: 'image_override',
  origin: 'origin_override',
  processing: 'processing_override',
  alt: 'alt_override',
  weight: 'weight_override',
  taste: 'taste_override',
  cup_profile: 'cup_profile_override',
  brew_guide: 'brew_guide_override',
  audience: 'audience_override',
};

const catalogCategoryLabels = {
  espresso: 'Еспресо',
  filter: 'Фільтр',
  drips: 'Дріпи',
  decaf: 'Декаф',
  accessories: 'Аксесуари',
  merch: 'Мерч',
};

const catalogCategoryOrder = ['espresso', 'filter', 'drips', 'decaf', 'accessories', 'merch'];
const catalogTextTemplates = {
  espresso: {
    taste: 'Шоколад, горіх, карамель і щільний солодкий aftertaste.',
    cup_profile: 'Щільне тіло, низько-середня кислотність і стабільна солодкість у чашці.',
    brew_guide: 'Еспресо: почніть з 18 г in / 36 г out, 25-30 секунд, помел під щільну, солодку екстракцію.',
    audience: 'Підійде для еспресо, капучино, латте та щоденного домашнього використання.',
  },
  filter: {
    taste: 'Ягоди, цитрус, квіти та прозорий солодкий aftertaste.',
    cup_profile: 'Чиста, яскрава чашка з виразною кислотністю й легкою текстурою.',
    brew_guide: 'Фільтр: 15 г на 250 мл, 92-94°C, заливання у 3-4 підходи, 2:30-3:30 хв.',
    audience: 'Підійде для V60, Kalita, AeroPress і тих, хто любить яскраву ароматику.',
  },
  drips: {
    taste: 'Солодка, чиста чашка з нотами карамелі, ягід або сухофруктів.',
    cup_profile: 'М’яке тіло, акуратний aftertaste і зрозумілий смак без складних налаштувань.',
    brew_guide: 'Дріп: 1 пакетик, 180-200 мл води, 3-4 проливи, 92-94°C.',
    audience: 'Підійде для офісу, подорожей, подарунків і швидкого приготування без кавомолки.',
  },
  decaf: {
    taste: 'Шоколад, горіх і м’яка солодкість без кофеїнового ефекту.',
    cup_profile: 'Спокійна, збалансована чашка з м’яким тілом і чистим післясмаком.',
    brew_guide: 'Декаф: використовуйте трохи дрібніший помел і м’якший рецепт для стабільної солодкості.',
    audience: 'Підійде для вечора, чутливих до кофеїну гостей і тих, хто хоче каву без стимуляції.',
  },
  accessories: {
    taste: '',
    cup_profile: '',
    brew_guide: '',
    audience: 'Обладнання і аксесуари для приготування кави.',
  },
  merch: {
    taste: '',
    cup_profile: '',
    brew_guide: '',
    audience: 'Мерч і сувеніри Odesa Coffee Roasters.',
  },
};

const AUTH_MODE_CONFIG = {
  login: {
    eyebrow: 'Вхід',
    title: 'Увійти в кабінет',
    help: 'Введіть email і пароль, щоб увійти в особистий кабінет.',
    submit: 'Увійти',
  },
  register: {
    eyebrow: 'Реєстрація',
    title: 'Створити акаунт',
    help: 'Створіть пароль і підтвердьте email, щоб увімкнути особистий кабінет.',
    submit: 'Зареєструватися',
  },
  recovery: {
    eyebrow: 'Відновлення',
    title: 'Створити новий пароль',
    help: 'Вкажіть новий пароль для акаунта. Після збереження увійдіть з ним.',
    submit: 'Зберегти пароль',
  },
};

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(mainNav.classList.contains('open')));
  });

  window.addEventListener('click', (event) => {
    if (!mainNav.contains(event.target) && !menuToggle.contains(event.target)) {
      mainNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

const setAuthStatus = (message, tone = 'neutral') => {
  if (!authStatus) return;
  authStatus.textContent = message;
  authStatus.dataset.tone = tone;
};

const setCatalogAdminStatus = (message, tone = 'neutral') => {
  if (!catalogAdminStatus) return;
  catalogAdminStatus.textContent = message;
  catalogAdminStatus.dataset.tone = tone;
};

const setCatalogCreateStatus = (message, tone = 'neutral') => {
  if (!catalogAdminCreateStatus) return;
  catalogAdminCreateStatus.textContent = message;
  catalogAdminCreateStatus.dataset.tone = tone;
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const isMissingRelationError = (error, relationName) => {
  if (!error) return false;
  return error.code === 'PGRST205' || String(error.message || '').includes(relationName);
};

const isMissingColumnError = (error, columnName) => {
  if (!error || !columnName) return false;
  const normalizedMessage = String(error.message || '').toLowerCase();
  return error.code === 'PGRST204' || normalizedMessage.includes(String(columnName).toLowerCase());
};

const isCatalogRlsAccessError = (error) => {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  return error.code === '42501'
    || message.includes('row-level security')
    || details.includes('row-level security');
};

const isValidCatalogImageValue = (value) => {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  if (!normalized) return false;
  const localImagePattern = /^\/?images\/.+\.(webp|jpg|jpeg|png|gif|avif|svg)$/i;
  const remoteImagePattern = /^https?:\/\/.+\.(webp|jpg|jpeg|png|gif|avif|svg)(\?.*)?$/i;
  return localImagePattern.test(normalized) || remoteImagePattern.test(normalized);
};

const parseNonNegativePriceInput = (value) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return null;

  const parsedValue = Number(rawValue.replace(',', '.'));
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return Number.NaN;
  }

  return Math.round(parsedValue * 100) / 100;
};

const slugifyProductId = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeOptionalText = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const parseOptionalIntegerInput = (value) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return null;
  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return Number.NaN;
  }
  return parsedValue;
};

const isOneKgWeight = (weight) => /1\s*кг|1\s*kg/i.test(String(weight || ''));
const isQuarterKgWeight = (weight) => /250\s*г|0[.,]?25\s*кг|250\s*g/i.test(String(weight || ''));

const getBaseVolumePrices = (product) => {
  const basePrice = Number(product?.price || 0);
  const explicit250 = Number(product?.volumePrices?.['250g']);
  const explicit1kg = Number(product?.volumePrices?.['1kg']);

  if (Number.isFinite(explicit250) && explicit250 > 0 && Number.isFinite(explicit1kg) && explicit1kg > 0) {
    return {
      '250g': explicit250,
      '1kg': explicit1kg,
      defaultVolume: isOneKgWeight(product?.weight) ? '1kg' : '250g',
    };
  }

  if (isOneKgWeight(product?.weight) && Number.isFinite(basePrice) && basePrice > 0) {
    return {
      '250g': Math.round(basePrice * 0.25),
      '1kg': basePrice,
      defaultVolume: '1kg',
    };
  }

  if (isQuarterKgWeight(product?.weight) && Number.isFinite(basePrice) && basePrice > 0) {
    return {
      '250g': basePrice,
      '1kg': Math.round(basePrice * 4),
      defaultVolume: '250g',
    };
  }

  if (Number.isFinite(explicit250) && explicit250 > 0) {
    return {
      '250g': explicit250,
      '1kg': null,
      defaultVolume: '250g',
    };
  }

  if (Number.isFinite(explicit1kg) && explicit1kg > 0) {
    return {
      '250g': null,
      '1kg': explicit1kg,
      defaultVolume: '1kg',
    };
  }

  return {
    '250g': null,
    '1kg': Number.isFinite(basePrice) && basePrice > 0 ? basePrice : null,
    defaultVolume: '1kg',
  };
};

const normalizeRemoteCatalogProduct = (row = {}) => {
  const productId = String(row.product_id || '').trim();
  if (!productId) return null;

  const basePrice = Number(row.base_price ?? row.price ?? 0);

  return {
    id: productId,
    name: String(row.name || '').trim(),
    description: String(row.description || '').trim(),
    image: String(row.image || '').trim(),
    alt: String(row.alt || row.name || '').trim(),
    category: String(row.category || 'espresso').trim(),
    price: Number.isFinite(basePrice) ? basePrice : 0,
    weight: String(row.weight || '').trim(),
    country: normalizeOptionalText(row.country),
    region: normalizeOptionalText(row.region),
    origin: normalizeOptionalText(row.origin),
    processing: normalizeOptionalText(row.processing),
    farm: normalizeOptionalText(row.farm),
    variety: normalizeOptionalText(row.variety),
    altitude: normalizeOptionalText(row.altitude),
    score: row.score ?? null,
    featured: Boolean(row.featured),
    giftImage: normalizeOptionalText(row.gift_image),
    giftAlt: normalizeOptionalText(row.gift_alt),
    details: row.details && typeof row.details === 'object' && !Array.isArray(row.details) ? row.details : null,
  };
};

const mergeCatalogProducts = (localProducts = [], remoteRows = []) => {
  const productMap = new Map();

  (localProducts || []).forEach((product) => {
    if (!product?.id) return;
    productMap.set(product.id, { ...product, catalogSource: 'local' });
  });

  (remoteRows || []).forEach((row) => {
    const remoteProduct = normalizeRemoteCatalogProduct(row);
    if (!remoteProduct?.id) return;

    const localProduct = productMap.get(remoteProduct.id) || {};
    productMap.set(remoteProduct.id, {
      ...localProduct,
      ...remoteProduct,
      catalogSource: localProduct.id ? 'local' : 'remote',
      volumePrices: localProduct.volumePrices || undefined,
    });
  });

  return [...productMap.values()];
};

const fetchCatalogProductsForAdmin = async () => {
  const localProducts = await fetch('products.json').then((response) => response.json()).catch(() => []);

  if (!isSupabaseConfigured || !supabase) {
    return localProducts;
  }

  const { data, error } = await supabase
    .from('product_catalog_public')
    .select('product_id, name, description, image, alt, category, base_price, weight, country, region, origin, processing, farm, variety, altitude, score, featured, gift_image, gift_alt, details')
    .order('updated_at', { ascending: false });

  if (error) {
    const isMissingRelation = error.code === 'PGRST205' || String(error.message || '').includes('product_catalog_public');
    if (!isMissingRelation) {
      console.error('Failed to load public catalog products', error);
    }
    return localProducts;
  }

  return mergeCatalogProducts(localProducts, data || []);
};

const inferCatalogWeight = ({ category, price250, price1kg }) => {
  if (category === 'drips') {
    return 'Фіксований формат';
  }

  if (price250 !== null && price1kg !== null) {
    return '250 г / 1 кг';
  }

  if (price1kg !== null) {
    return '1 кг';
  }

  if (price250 !== null) {
    return '250 г';
  }

  return 'Фіксований формат';
};

const getDefaultCatalogPrice = ({ price250, price1kg }) => {
  return price250 ?? price1kg ?? 0;
};

const nonCoffeeCreateCategories = ['accessories', 'merch'];
const standardMerchSizes = ['S', 'M', 'L', 'XL'];

const isNonCoffeeCategory = (category) => nonCoffeeCreateCategories.includes(category);

const getCreateFormGroup = (category) => (isNonCoffeeCategory(category) ? category : 'coffee');

const toInputValue = (value) => escapeHtml(value === null || value === undefined ? '' : String(value));

const buildNonCoffeeRowMarkup = (kind, group, values = {}) => {
  const imageField = (label, value) => `
    <div class="catalog-admin-field catalog-admin-field-image">
      <span>${label}</span>
      ${buildImagePickerMarkup({ value: value || '', inputAttrs: 'data-row-field="image"' })}
    </div>`;
  const removeButton = '<button type="button" class="btn ghost" data-row-remove title="Видалити рядок">✕</button>';

  if (kind === 'spec') {
    return `
      <label class="catalog-admin-field">
        <span>Назва</span>
        <input type="text" data-row-field="label" value="${toInputValue(values.label)}" placeholder="Потужність">
      </label>
      <label class="catalog-admin-field">
        <span>Значення</span>
        <input type="text" data-row-field="value" value="${toInputValue(values.value)}" placeholder="1520 Вт">
      </label>
      ${removeButton}`;
  }

  if (kind === 'gallery') {
    return `${imageField('Фото', values.image)}${removeButton}`;
  }

  const sizeField = group === 'merch'
    ? `
      <label class="catalog-admin-field">
        <span>Розмір</span>
        <input type="text" data-row-field="size" value="${toInputValue(values.size)}" placeholder="M">
      </label>`
    : '';
  const soldNote = Number(values.sold) > 0
    ? `<small class="catalog-admin-hint">Продано / в обробці: ${Number(values.sold)} шт.${values.available === null || values.available === undefined ? '' : `, доступно: ${Number(values.available)}`}</small>`
    : '';

  return `
    <label class="catalog-admin-field">
      <span>${group === 'merch' ? 'Колір' : 'Колір / модель'}</span>
      <input type="text" data-row-field="color" value="${toInputValue(values.color)}" placeholder="${group === 'merch' ? 'Чорний' : 'Off-white'}">
    </label>
    ${sizeField}
    ${imageField('Фото варіанта', values.image)}
    <label class="catalog-admin-field">
      <span>Ціна, грн</span>
      <input type="number" data-row-field="price" min="0" step="0.01" value="${toInputValue(values.price)}" placeholder="як базова">
    </label>
    <label class="catalog-admin-field">
      <span>Заведено, шт.</span>
      <input type="number" data-row-field="stock" min="0" step="1" value="${toInputValue(values.stock)}" placeholder="без ліміту">
      ${soldNote}
    </label>
    ${removeButton}`;
};

const addNonCoffeeRow = (root, kind, values = {}) => {
  const containerKey = kind === 'spec' ? 'specs' : kind === 'gallery' ? 'gallery' : 'variants';
  const container = root.querySelector(`[data-rows="${containerKey}"]`);
  if (!container) return null;

  const row = document.createElement('div');
  row.className = 'catalog-admin-row';
  row.dataset.rowKind = kind;
  if (values.id) row.dataset.variantId = values.id;
  if (Number(values.sold) > 0) row.dataset.sold = String(Number(values.sold));
  if (values.available !== null && values.available !== undefined) row.dataset.available = String(values.available);
  row.innerHTML = buildNonCoffeeRowMarkup(kind, root.dataset.noncoffeeGroup, values);
  container.append(row);
  hydrateImagePickers(row);
  return row;
};

const buildNonCoffeeFieldsMarkup = (group, draft = {}) => {
  const textField = (field, label, placeholder, listId = '') => `
    <label class="catalog-admin-field">
      <span>${label}</span>
      <input type="text" data-nc-field="${field}"${listId ? ` list="${listId}"` : ''} value="${toInputValue(draft[field])}" placeholder="${placeholder}">
    </label>`;

  const priceField = `
    <label class="catalog-admin-field">
      <span>Ціна, грн</span>
      <input type="number" data-nc-field="price" min="0" step="0.01" value="${toInputValue(draft.price)}" placeholder="${group === 'merch' ? 'Наприклад: 650' : 'Наприклад: 18500'}">
      <small class="catalog-admin-hint">Базова ціна. Якщо в варіанта своя ціна, вона замінить цю.</small>
    </label>`;

  const variantsFieldset = group === 'merch'
    ? `
      <fieldset class="catalog-admin-fieldset catalog-admin-fieldset-wide">
        <legend>Варіанти: розмір і колір</legend>
        <div class="catalog-admin-rows" data-rows="variants"></div>
        <div class="catalog-admin-row-actions">
          <button type="button" class="btn ghost" data-add-row="variant">+ Додати варіант</button>
          <button type="button" class="btn ghost" data-add-sizes>Додати розміри S–XL</button>
        </div>
        <small class="catalog-admin-hint">Один рядок = одна комбінація (наприклад, «Чорний / M»). У кожного рядка своє фото, а ціну і залишок можна не вказувати.</small>
      </fieldset>`
    : `
      <fieldset class="catalog-admin-fieldset catalog-admin-fieldset-wide">
        <legend>Варіанти (колір / модель)</legend>
        <div class="catalog-admin-rows" data-rows="variants"></div>
        <button type="button" class="btn ghost" data-add-row="variant">+ Додати варіант</button>
        <small class="catalog-admin-hint">Кожен варіант має своє фото, а ціну і залишок можна не вказувати: тоді діє базова ціна і загальний залишок.</small>
      </fieldset>`;

  const fields = group === 'merch'
    ? `
      ${priceField}
      ${textField('productType', 'Тип виробу', 'Наприклад: Футболка', 'catalog-merch-types')}
      ${textField('material', 'Матеріал', 'Наприклад: 100% бавовна')}
      ${textField('sku', 'Артикул (SKU)', 'Наприклад: OR-TEE-001')}
      <fieldset class="catalog-admin-fieldset catalog-admin-fieldset-wide">
        <legend>Додаткові фото (галерея)</legend>
        <div class="catalog-admin-rows" data-rows="gallery"></div>
        <button type="button" class="btn ghost" data-add-row="gallery">+ Додати фото</button>
      </fieldset>
      ${variantsFieldset}`
    : `
      ${priceField}
      ${textField('brand', 'Бренд / виробник', 'Наприклад: Technivorm Moccamaster')}
      ${textField('subcategory', 'Підкатегорія', 'Наприклад: Кавомашини', 'catalog-accessory-subcategories')}
      <fieldset class="catalog-admin-fieldset catalog-admin-fieldset-wide">
        <legend>Характеристики</legend>
        <div class="catalog-admin-rows" data-rows="specs"></div>
        <button type="button" class="btn ghost" data-add-row="spec">+ Додати характеристику</button>
        <small class="catalog-admin-hint">Наприклад: «Потужність» — «1520 Вт», «Об'єм» — «1,25 л».</small>
      </fieldset>
      ${variantsFieldset}`;

  return `<div class="catalog-admin-text-grid" data-noncoffee-fields data-noncoffee-group="${group}">${fields}</div>`;
};

const getMaxVariantSeq = (variants = []) => variants.reduce((max, variant) => {
  const match = /^v(\d+)$/.exec(String(variant?.id || ''));
  return match ? Math.max(max, Number(match[1])) : max;
}, 0);

const mountNonCoffeeFields = (slot, group, draft = {}) => {
  if (!(slot instanceof HTMLElement)) return null;

  slot.innerHTML = buildNonCoffeeFieldsMarkup(group, draft);
  slot.hidden = false;
  const root = slot.querySelector('[data-noncoffee-fields]');
  if (!(root instanceof HTMLElement)) return null;
  root.nonCoffeeExtras = draft;
  const variants = Array.isArray(draft.variants) ? draft.variants : [];
  // New variant ids continue after every id ever seen on this product so removed ids are never reused.
  root.dataset.variantSeq = String(Math.max(Number(draft.variantSeq) || 0, getMaxVariantSeq(variants)));

  const specs = Array.isArray(draft.specs) ? draft.specs : [];
  specs.forEach((spec) => addNonCoffeeRow(root, 'spec', spec));
  if (group === 'accessories' && specs.length === 0) addNonCoffeeRow(root, 'spec');
  if (group === 'merch') {
    (Array.isArray(draft.gallery) ? draft.gallery : []).forEach((image) => addNonCoffeeRow(root, 'gallery', { image }));
  }
  variants.forEach((variant) => addNonCoffeeRow(root, 'variant', variant));

  hydrateImagePickers(root);
  return root;
};

const readRowField = (row, field) => String(row.querySelector(`[data-row-field="${field}"]`)?.value ?? '').trim();

const normalizeCatalogImagePath = (value) => String(value || '').trim().replace(/\\/g, '/');

// Raw (unvalidated) state of the accessories/merch fields, used to build details and to keep input when the category changes.
const collectNonCoffeeDraft = (root) => {
  // Fields that exist only in the other category group stay in the draft so switching back and forth loses nothing.
  const extras = root.nonCoffeeExtras || {};
  const field = (name) => {
    const element = root.querySelector(`[data-nc-field="${name}"]`);
    return element ? String(element.value ?? '').trim() : String(extras[name] ?? '');
  };
  const rowsOf = (key) => [...root.querySelectorAll(`[data-rows="${key}"] .catalog-admin-row`)];
  const hasRows = (key) => Boolean(root.querySelector(`[data-rows="${key}"]`));

  return {
    price: field('price'),
    brand: field('brand'),
    subcategory: field('subcategory'),
    productType: field('productType'),
    material: field('material'),
    sku: field('sku'),
    specs: hasRows('specs')
      ? rowsOf('specs').map((row) => ({ label: readRowField(row, 'label'), value: readRowField(row, 'value') }))
      : (extras.specs || []),
    gallery: hasRows('gallery')
      ? rowsOf('gallery').map((row) => readRowField(row, 'image'))
      : (extras.gallery || []),
    variants: rowsOf('variants').map((row) => ({
      id: row.dataset.variantId || '',
      color: readRowField(row, 'color'),
      size: readRowField(row, 'size'),
      image: readRowField(row, 'image'),
      price: readRowField(row, 'price'),
      stock: readRowField(row, 'stock'),
      sold: Number(row.dataset.sold) || 0,
      available: row.dataset.available === undefined ? null : Number(row.dataset.available),
    })),
    variantSeq: Number(root.dataset.variantSeq) || 0,
  };
};

const detailsToDraft = (row) => {
  const details = row.details && typeof row.details === 'object' ? row.details : {};
  const variants = Array.isArray(details.variants) ? details.variants : [];

  return {
    price: row.price ?? '',
    brand: details.brand || '',
    subcategory: details.subcategory || '',
    productType: details.productType || '',
    material: details.material || '',
    sku: details.sku || '',
    specs: Array.isArray(details.specs) ? details.specs : [],
    gallery: Array.isArray(details.gallery) ? details.gallery : [],
    variants: variants.map((variant) => ({
      id: variant.id || '',
      color: variant.color || '',
      size: variant.size || '',
      image: variant.image || '',
      price: variant.price ?? '',
      stock: variant.stock ?? '',
      sold: variant.sold || 0,
      available: variant.available ?? null,
    })),
  };
};

const buildNonCoffeeDetails = (draft, group) => {
  const details = {};

  const textKeys = group === 'merch' ? ['productType', 'material', 'sku'] : ['brand', 'subcategory'];
  textKeys.forEach((key) => {
    const value = normalizeOptionalText(draft[key]);
    if (value) details[key] = value;
  });

  if (group === 'accessories') {
    const specs = [];
    for (const spec of draft.specs || []) {
      if (!spec.label && !spec.value) continue;
      if (!spec.label || !spec.value) {
        return { error: 'У кожної характеристики має бути і назва, і значення.' };
      }
      specs.push({ label: spec.label, value: spec.value });
    }
    if (specs.length > 0) details.specs = specs;
  }

  if (group === 'merch') {
    const gallery = [];
    for (const rawImage of draft.gallery || []) {
      const image = normalizeCatalogImagePath(rawImage);
      if (!image) continue;
      if (!isValidCatalogImageValue(image)) {
        return { error: `Додаткове фото «${image}» має бути у форматі images/your-file.webp або повний https:// URL.` };
      }
      gallery.push(image);
    }
    if (gallery.length > 0) details.gallery = gallery;
  }

  const variants = [];
  const seenLabels = new Set();
  let variantSeq = Number(draft.variantSeq) || 0;
  for (const item of draft.variants || []) {
    const image = normalizeCatalogImagePath(item.image);
    if (!item.color && !item.size && !image && !item.price && !item.stock) continue;

    const label = [item.color, item.size].filter(Boolean).join(' / ');
    if (!label) {
      return { error: 'У кожного варіанта має бути назва: колір, модель або розмір.' };
    }
    if (seenLabels.has(label.toLowerCase())) {
      return { error: `Варіант «${label}» вказано двічі.` };
    }
    seenLabels.add(label.toLowerCase());

    if (image && !isValidCatalogImageValue(image)) {
      return { error: `Фото варіанта «${label}» має бути у форматі images/your-file.webp або повний https:// URL.` };
    }

    const price = parseNonNegativePriceInput(item.price);
    if (Number.isNaN(price)) {
      return { error: `Ціна варіанта «${label}» має бути числом 0 або більше.` };
    }

    const stock = parseOptionalIntegerInput(item.stock);
    if (Number.isNaN(stock)) {
      return { error: `Залишок варіанта «${label}» має бути цілим числом 0 або більше.` };
    }

    variantSeq += item.id ? 0 : 1;
    variants.push({
      id: item.id || `v${variantSeq}`,
      ...(item.color ? { color: item.color } : {}),
      ...(item.size ? { size: item.size } : {}),
      label,
      ...(image ? { image } : {}),
      price,
      stock,
    });
  }
  if (variants.length > 0) details.variants = variants;

  return { details };
};

const applyCreateFormCategory = (form) => {
  const category = String(new FormData(form).get('category') || '');
  const activeGroup = getCreateFormGroup(category);

  const coffeeSection = form.querySelector('[data-category-group="coffee"]');
  if (coffeeSection instanceof HTMLElement) {
    const isCoffee = activeGroup === 'coffee';
    coffeeSection.hidden = !isCoffee;
    coffeeSection.querySelectorAll('input, select, textarea').forEach((field) => {
      field.disabled = !isCoffee;
    });
  }

  const slot = form.querySelector('[data-noncoffee-slot]');
  if (slot instanceof HTMLElement) {
    const currentRoot = slot.querySelector('[data-noncoffee-fields]');
    if (activeGroup === 'coffee') {
      slot.innerHTML = '';
      slot.hidden = true;
    } else if (!currentRoot || currentRoot.dataset.noncoffeeGroup !== activeGroup) {
      mountNonCoffeeFields(slot, activeGroup, currentRoot instanceof HTMLElement ? collectNonCoffeeDraft(currentRoot) : {});
    }
  }

  const stockHint = form.querySelector('[data-stock-hint]');
  if (stockHint) stockHint.hidden = activeGroup === 'coffee';
};

const resetCreateForm = (form) => {
  form.reset();
  const slot = form.querySelector('[data-noncoffee-slot]');
  if (slot instanceof HTMLElement) slot.innerHTML = '';
  applyCreateFormCategory(form);
  syncImagePickers(form);
};

const handleNonCoffeeRowClick = (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const root = target.closest('[data-noncoffee-fields]');
  if (!(root instanceof HTMLElement)) return;

  const addButton = target.closest('[data-add-row]');
  if (addButton instanceof HTMLElement) {
    addNonCoffeeRow(root, addButton.dataset.addRow || '');
    catalogAdminHasUnsavedChanges = true;
    return;
  }

  if (target.closest('[data-add-sizes]')) {
    const presentSizes = new Set([...root.querySelectorAll('[data-rows="variants"] .catalog-admin-row')]
      .map((row) => readRowField(row, 'size').toLowerCase()));
    standardMerchSizes
      .filter((size) => !presentSizes.has(size.toLowerCase()))
      .forEach((size) => addNonCoffeeRow(root, 'variant', { size }));
    catalogAdminHasUnsavedChanges = true;
    return;
  }

  const removeButton = target.closest('[data-row-remove]');
  if (removeButton instanceof HTMLElement) {
    removeButton.closest('.catalog-admin-row')?.remove();
    catalogAdminHasUnsavedChanges = true;
  }
};

const runtimeEnv = globalThis.__OCR_ENV__ || {};
const runtimeConfig = globalThis.__OCR_CONFIG__ || {};
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const buildEmailRedirectUrl = () => {
  const configuredUrl = String(env.VITE_AUTH_REDIRECT_URL || runtimeEnv.VITE_AUTH_REDIRECT_URL || runtimeConfig.authRedirectUrl || '').trim();
  if (configuredUrl) return configuredUrl;
  return new URL(window.location.pathname, window.location.origin).toString();
};

const hideSecondaryAuthActions = () => {
  pendingConfirmationEmail = '';
  if (authSecondary) authSecondary.hidden = true;
};

const showConfirmationResend = (email) => {
  pendingConfirmationEmail = email;
  if (confirmationHint) {
    confirmationHint.textContent = `Підтвердіть адресу ${email} і попросіть новий лист, якщо попередній не дійшов.`;
  }
  if (authSecondary) authSecondary.hidden = false;
};

const isEmailConfirmationError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return message.includes('email not confirmed') || code.includes('email_not_confirmed');
};

const syncProfile = async (session, fullNameOverride = '') => {
  if (!supabase || !session?.user) return;

  const profilePayload = {
    id: session.user.id,
    email: session.user.email || null,
    full_name: fullNameOverride || session.user.user_metadata?.full_name || null,
  };

  const { error } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
  if (error) {
    setAuthStatus('Вхід виконано, але профіль не синхронізувався. Перевірте політики Supabase.', 'error');
  }
};

const getPasswordChecks = (password) => ({
  length: password.length >= 8,
  lowercase: /[a-z]/.test(password),
  uppercase: /[A-Z]/.test(password),
  digit: /\d/.test(password),
});

const renderPasswordChecks = (password = '') => {
  const checks = getPasswordChecks(password);
  passwordRuleItems.forEach((item) => {
    const ruleName = item.dataset.passwordRule;
    item.dataset.met = String(Boolean(checks[ruleName]));
  });
  return checks;
};

const isPasswordValid = (checks) => Object.values(checks).every(Boolean);

const setAuthMode = (mode) => {
  const config = AUTH_MODE_CONFIG[mode] || AUTH_MODE_CONFIG.login;
  const isLoginMode = mode === 'login';
  const isRegisterMode = mode === 'register';
  const isRecoveryMode = mode === 'recovery';

  if (authForm) {
    authForm.dataset.authMode = mode;
  }

  authModeTriggers.forEach((trigger) => {
    const isActive = trigger.dataset.authModeTrigger === mode;
    trigger.classList.toggle('is-active', isActive);
    trigger.setAttribute('aria-pressed', String(isActive));
  });

  if (authEyebrow) authEyebrow.textContent = config.eyebrow;
  if (authTitle) authTitle.textContent = config.title;
  if (authHelp) authHelp.textContent = config.help;
  if (authSubmit) authSubmit.textContent = config.submit;
  if (authToggle) authToggle.hidden = isRecoveryMode;
  if (authNameField) authNameField.hidden = !isRegisterMode;
  if (authPasswordField) authPasswordField.hidden = !(isLoginMode || isRegisterMode);
  if (authRecoveryPasswordField) authRecoveryPasswordField.hidden = !isRecoveryMode;
  if (passwordRules) passwordRules.hidden = !(isRegisterMode || isRecoveryMode);
  if (forgotPasswordButton) forgotPasswordButton.hidden = !isLoginMode;
  if (passwordInput) {
    passwordInput.required = isLoginMode || isRegisterMode;
    passwordInput.autocomplete = isRegisterMode ? 'new-password' : 'current-password';
  }
  if (emailInput) {
    emailInput.required = !isRecoveryMode;
  }
  if (recoveryPasswordInput) {
    recoveryPasswordInput.required = isRecoveryMode;
  }
  hideSecondaryAuthActions();

  if (!isRegisterMode && !isRecoveryMode) {
    renderPasswordChecks('');
  }
};

const getInitialAuthMode = () => {
  const hash = String(window.location.hash || '').toLowerCase();
  if (hash === '#register' || hash === '#signup') return 'register';
  return 'login';
};

const getHashAuthParams = () => {
  const rawHash = String(window.location.hash || '').replace(/^#/, '');
  if (!rawHash) return new URLSearchParams();

  // Some email templates add a marker before tokens: #reset-password#access_token=...
  // Convert extra hash separators to query separators to keep tokens parseable.
  const normalizedHash = rawHash.replace(/#/g, '&');
  const tokenStartIndex = normalizedHash.indexOf('access_token=');
  const queryLikeHash = tokenStartIndex >= 0 ? normalizedHash.slice(tokenStartIndex) : normalizedHash;
  return new URLSearchParams(queryLikeHash);
};

const hasRecoveryStateInUrl = () => {
  const hashParams = getHashAuthParams();
  const searchParams = new URLSearchParams(window.location.search || '');
  return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery';
};

const renderProfile = (profile) => {
  if (!profileList) return;
  currentProfile = profile || null;

  const deliveryMethod = profile?.default_delivery_method || '';

  profileList.innerHTML = `
    <form class="account-profile-form" id="account-profile-form">
      <div class="account-stat-row">
        <span>Email</span>
        <strong>${profile?.email || 'Не вказано'}</strong>
      </div>
      <label class="account-profile-field">
        <span>Ім'я</span>
        <input type="text" name="full_name" value="${profile?.full_name || ''}" placeholder="Вкажіть ім'я">
      </label>
      <label class="account-profile-field">
        <span>Телефон</span>
        <input type="tel" name="phone" value="${profile?.phone || ''}" placeholder="+380...">
      </label>
      <label class="account-profile-field">
        <span>Місто</span>
        <input type="text" name="default_city" value="${profile?.default_city || ''}" placeholder="Наприклад, Одеса">
      </label>
      <label class="account-profile-field">
        <span>Доставка</span>
        <select name="default_delivery_method">
          <option value="">Не вказано</option>
          <option value="nova-branch" ${deliveryMethod === 'nova-branch' ? 'selected' : ''}>Нова Пошта: відділення</option>
          <option value="nova-locker" ${deliveryMethod === 'nova-locker' ? 'selected' : ''}>Нова Пошта: поштомат</option>
          <option value="pickup" ${deliveryMethod === 'pickup' ? 'selected' : ''}>Самовивіз</option>
        </select>
      </label>
      <label class="account-profile-field">
        <span>Деталі доставки</span>
        <textarea name="default_delivery_details" rows="3" placeholder="Відділення, поштомат або адреса самовивозу">${profile?.default_delivery_details || ''}</textarea>
      </label>
      <div class="account-profile-actions">
        <button class="btn primary" type="submit">Зберегти дані</button>
        <p class="form-status" id="account-profile-status" aria-live="polite"></p>
      </div>
    </form>`;
};

const saveProfile = async (form) => {
  if (!supabase || !currentSession?.user) return;

  const statusNode = profileList?.querySelector('#account-profile-status');
  const formData = new FormData(form);
  const payload = {
    id: currentSession.user.id,
    email: currentSession.user.email || currentProfile?.email || null,
    full_name: String(formData.get('full_name') || '').trim() || null,
    phone: String(formData.get('phone') || '').trim() || null,
    default_city: String(formData.get('default_city') || '').trim() || null,
    default_delivery_method: String(formData.get('default_delivery_method') || '').trim() || null,
    default_delivery_details: String(formData.get('default_delivery_details') || '').trim() || null,
  };

  if (statusNode) {
    statusNode.textContent = 'Зберігаємо зміни...';
    statusNode.dataset.tone = 'neutral';
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    if (statusNode) {
      statusNode.textContent = 'Не вдалося зберегти профіль. Перевірте RLS та таблицю profiles.';
      statusNode.dataset.tone = 'error';
    }
    return;
  }

  renderProfile(data || payload);
  setAuthStatus('Профіль оновлено.', 'success');
  const nextStatusNode = profileList?.querySelector('#account-profile-status');
  if (nextStatusNode) {
    nextStatusNode.textContent = 'Дані збережено.';
    nextStatusNode.dataset.tone = 'success';
  }
};

const renderDiscountState = (state) => {
  if (!discountCard) return;

  if (!state) {
    discountCard.innerHTML = `
      <div class="account-stat-big">0%</div>
      <p>Поки що немає накопиченої знижки.</p>`;
    return;
  }

  discountCard.innerHTML = `
    <div class="account-stat-big">${Number(state.current_discount_percent || 0)}%</div>
    <div class="account-stat-row"><span>Накопичено</span><strong>${Number(state.lifetime_spend || 0).toFixed(2)} грн</strong></div>
    <div class="account-stat-row"><span>Завершених замовлень</span><strong>${state.completed_orders_count || 0}</strong></div>
    <div class="account-stat-row"><span>До наступного рівня</span><strong>${Number(state.amount_to_next_tier || 0).toFixed(2)} грн</strong></div>`;
};

const renderOrders = (orders) => {
  if (!ordersRoot) return;

  if (!orders || orders.length === 0) {
    ordersRoot.innerHTML = '<p>Поки що замовлень немає.</p>';
    return;
  }

  ordersRoot.innerHTML = orders
    .map((order) => {
      const itemsMarkup = (order.order_items || [])
        .map((item) => `
          <div class="account-order-item">
            <span>${item.product_title} x${item.quantity}</span>
            <strong>${Number(item.line_total || 0).toFixed(2)} грн</strong>
          </div>`)
        .join('');

      return `
        <article class="account-order-card">
          <div class="account-order-head">
            <div>
              <p class="eyebrow">Замовлення #${order.order_number || String(order.id).slice(0, 8)}</p>
              <h3>${order.delivery_method_label || order.delivery_method || 'Замовлення'}</h3>
            </div>
            <span class="account-order-status status-${order.status}">${order.status}</span>
          </div>
          <div class="account-order-meta">
            <div class="account-stat-row"><span>Дата</span><strong>${new Date(order.placed_at).toLocaleString('uk-UA')}</strong></div>
            <div class="account-stat-row"><span>Сума</span><strong>${Number(order.total_amount || 0).toFixed(2)} грн</strong></div>
            <div class="account-stat-row"><span>Оплата</span><strong>${order.payment_method_label || order.payment_method || 'Не вказано'}</strong></div>
            <div class="account-stat-row"><span>Доставка</span><strong>${order.delivery_details || 'Не вказано'}</strong></div>
          </div>
          <div class="account-order-items">${itemsMarkup || '<p>Без позицій.</p>'}</div>
        </article>`;
    })
    .join('');
};

const hideCatalogAdmin = () => {
  catalogAdminRows = [];
  catalogAdminHasUnsavedChanges = false;
  if (catalogAdminPanel) catalogAdminPanel.hidden = true;
  if (catalogAdminList) catalogAdminList.innerHTML = '';
  setCatalogAdminStatus('', 'neutral');
};

const getCatalogRowTone = (row) => {
  if (!row.state.isAvailable) return 'disabled';
  if (row.availableNow !== null && row.availableNow <= 0) return 'out';
  if (row.availableNow !== null && row.availableNow <= 5) return 'low';
  return 'available';
};

const getCatalogRowLabel = (row) => {
  const tone = getCatalogRowTone(row);

  if (tone === 'disabled') return 'Вимкнено';
  if (tone === 'out') return 'Немає в наявності';
  if (tone === 'low') return 'Малий залишок';
  return 'У продажу';
};

const getCatalogTemplateForRow = (row) => catalogTextTemplates[row.category] || catalogTextTemplates.espresso;

const applyCatalogCardTemplate = (card, templateKey) => {
  if (!(card instanceof HTMLElement) || !templateKey) return;

  const row = catalogAdminRows.find((item) => item.id === card.dataset.productId);
  const template = row ? getCatalogTemplateForRow(row) : null;
  if (!template) return;

  const fields = card.querySelectorAll('[data-catalog-text-field]');
  fields.forEach((field) => {
    if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLTextAreaElement)) return;
    const fieldName = field.dataset.catalogTextField;
    if (!fieldName || !Object.prototype.hasOwnProperty.call(template, fieldName)) return;
    field.value = String(template[fieldName] || '');
    const wrapper = field.closest('[data-catalog-field-wrapper]');
    if (wrapper instanceof HTMLElement) {
      wrapper.dataset.catalogFieldValue = field.value;
    }
  });

  catalogAdminHasUnsavedChanges = true;
  filterCatalogCardFields(card, card.querySelector('[data-catalog-field-search]')?.value || '');
};

const filterCatalogCardFields = (card, query) => {
  if (!(card instanceof HTMLElement)) return;

  const normalizedQuery = String(query || '').trim().toLowerCase();
  const wrappers = card.querySelectorAll('[data-catalog-field-wrapper]');
  let visibleCount = 0;

  wrappers.forEach((wrapper) => {
    if (!(wrapper instanceof HTMLElement)) return;
    if (!normalizedQuery) {
      wrapper.hidden = false;
      visibleCount += 1;
      return;
    }

    const haystack = `${wrapper.dataset.catalogFieldLabel || ''} ${wrapper.dataset.catalogFieldValue || ''}`.toLowerCase();
    const isMatch = haystack.includes(normalizedQuery);
    wrapper.hidden = !isMatch;
    if (isMatch) visibleCount += 1;
  });

  const emptyState = card.querySelector('[data-catalog-field-search-empty]');
  if (emptyState instanceof HTMLElement) {
    emptyState.hidden = visibleCount !== 0;
  }
};

const buildCatalogAdminRows = (products, stateRows) => {
  const stateById = new Map((stateRows || []).map((row) => [row.product_id, normalizeCatalogState(row)]));
  const textOverridesById = new Map((stateRows?.textOverrides || []).map((row) => [row.product_id, row]));
  const priceOverridesById = new Map((stateRows?.priceOverrides || []).map((row) => [row.product_id, row]));

  return products.map((product) => {
    const state = stateById.get(product.id) || normalizeCatalogState({ product_id: product.id });
    const availableNow = state.stockQuantity === null ? null : Math.max(state.stockQuantity - state.soldQuantity, 0);

    const textOverrideRow = textOverridesById.get(product.id);
    const baseText = editableCatalogTextFields.reduce((acc, field) => {
      acc[field] = String(product[field] ?? '');
      return acc;
    }, {});

    const textOverrides = editableCatalogTextFields.reduce((acc, field) => {
      const column = catalogTextFieldColumnMap[field];
      if (!textOverrideRow || !column) return acc;

      if (Object.prototype.hasOwnProperty.call(textOverrideRow, column) && textOverrideRow[column] !== null) {
        acc[field] = String(textOverrideRow[column]);
      }

      return acc;
    }, {});

    const textAdjustedProduct = {
      ...product,
      ...textOverrides,
    };

    const baseVolumePrices = getBaseVolumePrices(product);
    const priceOverrideRow = priceOverridesById.get(product.id);
    const legacyOverridePrice = Number(priceOverrideRow?.override_price);
    const overridePrice250 = Number(priceOverrideRow?.override_price_250g);
    const overridePrice1kg = Number(priceOverrideRow?.override_price_1kg);

    const activePriceOverrides = {};

    if (Number.isFinite(overridePrice250) && overridePrice250 >= 0) {
      activePriceOverrides['250g'] = overridePrice250;
    }

    if (Number.isFinite(overridePrice1kg) && overridePrice1kg >= 0) {
      activePriceOverrides['1kg'] = overridePrice1kg;
    }

    if (Number.isFinite(legacyOverridePrice) && legacyOverridePrice >= 0) {
      const legacyVolume = baseVolumePrices.defaultVolume || '1kg';
      if (!Object.prototype.hasOwnProperty.call(activePriceOverrides, legacyVolume)) {
        activePriceOverrides[legacyVolume] = legacyOverridePrice;
      }
    }

    const resolvedPrice250 = Object.prototype.hasOwnProperty.call(activePriceOverrides, '250g')
      ? activePriceOverrides['250g']
      : baseVolumePrices['250g'];

    const resolvedPrice1kg = Object.prototype.hasOwnProperty.call(activePriceOverrides, '1kg')
      ? activePriceOverrides['1kg']
      : baseVolumePrices['1kg'];

    let customVariants = [];
    if (priceOverrideRow?.custom_variants) {
      try {
        const parsed = typeof priceOverrideRow.custom_variants === 'string'
          ? JSON.parse(priceOverrideRow.custom_variants)
          : priceOverrideRow.custom_variants;
        customVariants = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn('Failed to parse custom_variants for product', product.id, e);
      }
    }

    let colorVariants = [];
    if (priceOverrideRow?.color_variants) {
      try {
        const parsed = typeof priceOverrideRow.color_variants === 'string'
          ? JSON.parse(priceOverrideRow.color_variants)
          : priceOverrideRow.color_variants;
        colorVariants = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn('Failed to parse color_variants for product', product.id, e);
      }
    }

    let gradationVariants = [];
    if (priceOverrideRow?.gradation_variants) {
      try {
        const parsed = typeof priceOverrideRow.gradation_variants === 'string'
          ? JSON.parse(priceOverrideRow.gradation_variants)
          : priceOverrideRow.gradation_variants;
        gradationVariants = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn('Failed to parse gradation_variants for product', product.id, e);
      }
    }

    let customUnit = '';
    if (customVariants.length > 0) {
      const customVariant = customVariants.find((v) => v.unit && v.unit !== 'merch' && v.unit !== 'piece');
      if (customVariant) {
        customUnit = customVariant.unit;
      }
    }

    return {
      ...textAdjustedProduct,
      state,
      availableNow,
      baseText,
      textOverrides,
      baseVolumePrices,
      priceOverrides: activePriceOverrides,
      price250: resolvedPrice250,
      price1kg: resolvedPrice1kg,
      customVariants,
      colorVariants,
      gradationVariants,
      customUnit,
    };
  });
};

const renderCatalogCardSummary = (row, { tone, stateLabel, stockLabel, availableLabel }) => {
  const metaItems = isNonCoffeeCategory(row.category)
    ? [row.details?.brand, row.details?.subcategory || row.details?.productType]
    : [row.origin, row.processing];

  return `
    <summary class="catalog-admin-card-summary">
      <div class="catalog-admin-summary">
        <div class="catalog-admin-media">
          <img src="${escapeHtml(row.image)}" alt="${escapeHtml(row.alt)}">
        </div>
        <div class="catalog-admin-copy">
          <p class="eyebrow">${escapeHtml(row.category || 'Каталог')}</p>
          <h3>${escapeHtml(row.name)}</h3>
          <p>${escapeHtml(row.description)}</p>
          <div class="product-meta">
            ${metaItems.filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
          </div>
          <p class="catalog-admin-card-hint">Натисніть, щоб розкрити редагування.</p>
        </div>
      </div>
      <div class="catalog-admin-summary-side">
        <span class="catalog-admin-pill catalog-admin-pill-${tone}">${stateLabel}</span>
        <div class="catalog-admin-metrics compact">
          <div class="catalog-admin-metric">
            <span>Заведено</span>
            <strong>${stockLabel}</strong>
          </div>
          <div class="catalog-admin-metric">
            <span>Доступно</span>
            <strong>${availableLabel}</strong>
          </div>
        </div>
      </div>
    </summary>`;
};

const renderNonCoffeeCard = (row, { tone, stateLabel, stockLabel, availableLabel, stockValue }) => `
  <details class="catalog-admin-card" data-product-id="${escapeHtml(row.id)}" data-tone="${tone}">
    ${renderCatalogCardSummary(row, { tone, stateLabel, stockLabel, availableLabel })}
    <div class="catalog-admin-card-body">
      <div class="catalog-admin-metrics">
        <div class="catalog-admin-metric">
          <span>Продано / в обробці</span>
          <strong>${row.state.soldQuantity} шт.</strong>
        </div>
        <div class="catalog-admin-metric">
          <span>Доступно зараз</span>
          <strong>${availableLabel}</strong>
        </div>
      </div>
      <div class="catalog-admin-controls" data-noncoffee-card>
        <label class="catalog-admin-toggle">
          <input type="checkbox" data-catalog-availability ${row.state.isAvailable ? 'checked' : ''}>
          <span>Показувати в продажу</span>
        </label>
        <label class="catalog-admin-toggle">
          <input type="checkbox" data-card-field="featured" ${row.featured ? 'checked' : ''}>
          <span>Показувати в хітах продажу</span>
        </label>
        <label class="catalog-admin-field">
          <span>Заведено на склад, шт.</span>
          <input type="number" min="0" step="1" value="${stockValue}" data-catalog-stock placeholder="Порожньо = без ліміту">
          <small class="catalog-admin-hint">Якщо в варіантів вказано залишок, цей загальний залишок не використовується.</small>
        </label>
        <div class="catalog-admin-text-grid">
          <label class="catalog-admin-field">
            <span>Категорія</span>
            <select data-card-field="category">
              ${nonCoffeeCreateCategories.map((categoryValue) => `<option value="${categoryValue}" ${row.category === categoryValue ? 'selected' : ''}>${catalogCategoryLabels[categoryValue]}</option>`).join('')}
            </select>
          </label>
          <label class="catalog-admin-field">
            <span>Назва товару</span>
            <input type="text" data-card-field="name" value="${escapeHtml(row.name || '')}">
          </label>
          <label class="catalog-admin-field catalog-admin-field-wide">
            <span>Опис</span>
            <textarea rows="3" data-card-field="description">${escapeHtml(row.description || '')}</textarea>
          </label>
          <div class="catalog-admin-field catalog-admin-field-wide">
            <span>Фото товару</span>
            ${buildImagePickerMarkup({ value: row.image || '', inputAttrs: 'data-card-field="image"' })}
          </div>
          <label class="catalog-admin-field catalog-admin-field-wide">
            <span>Alt для фото</span>
            <input type="text" data-card-field="alt" value="${escapeHtml(row.alt || '')}">
          </label>
        </div>
        <div class="catalog-admin-noncoffee-slot" data-noncoffee-slot hidden></div>
        <div class="catalog-admin-card-actions">
          <button class="btn light" type="button" data-catalog-save>Зберегти</button>
          ${row.catalogSource === 'remote'
    ? '<button class="btn danger" type="button" data-catalog-delete>Видалити позицію</button>'
    : '<p class="catalog-admin-delete-note">Локальна позиція: для повного видалення приберіть її з products.json.</p>'}
        </div>
      </div>
      <p class="form-status" data-catalog-row-status></p>
    </div>
  </details>`;

const renderCatalogAdminList = () => {
  if (!catalogAdminList) return;

  const searchValue = catalogAdminSearch?.value.trim().toLowerCase() || '';
  const filterValue = catalogAdminFilter?.value || 'all';
  const filteredRows = catalogAdminRows
    .filter((row) => {
      if (!searchValue) return true;

      const haystack = [row.name, row.category, row.origin, row.processing]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchValue);
    })
    .filter((row) => {
      const tone = getCatalogRowTone(row);
      if (filterValue === 'all') return true;
      if (filterValue === 'available') return tone === 'available' || tone === 'low';
      return tone === filterValue;
    })
    .sort((left, right) => {
      const toneOrder = { out: 0, low: 1, disabled: 2, available: 3 };
      const toneDelta = toneOrder[getCatalogRowTone(left)] - toneOrder[getCatalogRowTone(right)];
      if (toneDelta !== 0) return toneDelta;
      return left.name.localeCompare(right.name, 'uk');
    });

  if (filteredRows.length === 0) {
    catalogAdminList.innerHTML = '<p class="catalog-admin-empty">Нічого не знайдено за поточними фільтрами.</p>';
    return;
  }

  const groupedRows = filteredRows.reduce((accumulator, row) => {
    const categoryKey = row.category || 'other';
    if (!accumulator[categoryKey]) accumulator[categoryKey] = [];
    accumulator[categoryKey].push(row);
    return accumulator;
  }, {});

  const sortedCategories = [...Object.keys(groupedRows)].sort((left, right) => {
    const leftIndex = catalogCategoryOrder.indexOf(left);
    const rightIndex = catalogCategoryOrder.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right, 'uk');
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });

  catalogAdminList.innerHTML = sortedCategories.map((categoryKey) => {
    const rows = groupedRows[categoryKey];
    const categoryLabel = catalogCategoryLabels[categoryKey] || categoryKey;

    return `
      <details class="catalog-admin-group" open>
        <summary class="catalog-admin-group-summary">
          <div>
            <p class="eyebrow">${categoryLabel}</p>
            <h3>${rows.length} товар(и)</h3>
          </div>
          <span class="catalog-admin-group-count">${rows.length}</span>
        </summary>
        <div class="catalog-admin-group-body">
          ${rows.map((row) => {
            const tone = getCatalogRowTone(row);
            const stateLabel = getCatalogRowLabel(row);
            const stockValue = row.state.stockQuantity ?? '';
            const soldLabel = row.state.soldQuantity;
            const availableLabel = row.availableNow === null ? 'Без ліміту' : `${row.availableNow} шт.`;
            const stockLabel = row.state.stockQuantity === null ? 'Без ліміту' : `${row.state.stockQuantity} шт.`;
            const flavorHint = row.taste || row.description || '';
            const cupHint = row.cup_profile || row.description || '';
            const brewHint = row.brew_guide || '';
            const audienceHint = row.audience || '';
            const price250Value = row.price250 === null || row.price250 === undefined ? '' : row.price250;
            const price1kgValue = row.price1kg === null || row.price1kg === undefined ? '' : row.price1kg;

            if (isNonCoffeeCategory(row.category)) {
              return renderNonCoffeeCard(row, { tone, stateLabel, stockLabel, availableLabel, stockValue });
            }

            return `
              <details class="catalog-admin-card" data-product-id="${row.id}" data-tone="${tone}">
                ${renderCatalogCardSummary(row, { tone, stateLabel, stockLabel, availableLabel })}
                <div class="catalog-admin-card-body">
                  <div class="catalog-admin-metrics">
                    <div class="catalog-admin-metric">
                      <span>Продано / в обробці</span>
                      <strong>${soldLabel} шт.</strong>
                    </div>
                    <div class="catalog-admin-metric">
                      <span>Доступно зараз</span>
                      <strong>${availableLabel}</strong>
                    </div>
                    <div class="catalog-admin-metric">
                      <span>Формат</span>
                      <strong>${escapeHtml(row.weight || 'Без ваги')}</strong>
                    </div>
                  </div>
                  <div class="catalog-admin-controls">
                    <div class="catalog-admin-tools">
                      <label class="catalog-admin-field catalog-admin-field-wide">
                        <span>Пошук у картці</span>
                        <input type="search" data-catalog-field-search placeholder="Наприклад: кислотність, солодкість, молоко">
                      </label>
                      <p class="catalog-admin-field-search-empty" data-catalog-field-search-empty hidden>Нічого не знайдено в полях цієї картки.</p>
                      <div class="catalog-admin-template-bar">
                        <span>Швидкі шаблони:</span>
                        <div class="catalog-admin-template-actions">
                          <button class="btn ghost" type="button" data-catalog-template="espresso">Еспресо</button>
                          <button class="btn ghost" type="button" data-catalog-template="filter">Фільтр</button>
                          <button class="btn ghost" type="button" data-catalog-template="drips">Дріпи</button>
                          <button class="btn ghost" type="button" data-catalog-template="decaf">Декаф</button>
                        </div>
                      </div>
                    </div>
                    <label class="catalog-admin-toggle">
                      <input type="checkbox" data-catalog-availability ${row.state.isAvailable ? 'checked' : ''}>
                      <span>Показувати в продажу</span>
                    </label>
                    <label class="catalog-admin-field">
                      <span>Заведено на склад, шт.</span>
                      <input type="number" min="0" step="1" value="${stockValue}" data-catalog-stock placeholder="Порожньо = без ліміту">
                    </label>
                    <div class="catalog-admin-text-grid">
                      <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Ціна 250 г" data-catalog-field-value="${escapeHtml(String(price250Value))}">
                        <span>Ціна 0.250 кг, грн</span>
                        <input type="number" min="0" step="0.01" data-catalog-price-field="250g" value="${escapeHtml(String(price250Value))}" placeholder="Наприклад: 320">
                      </label>
                      <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Ціна 1 кг" data-catalog-field-value="${escapeHtml(String(price1kgValue))}">
                        <span>Ціна 1 кг, грн</span>
                        <input type="number" min="0" step="0.01" data-catalog-price-field="1kg" value="${escapeHtml(String(price1kgValue))}" placeholder="Наприклад: 1130">
                      </label>
                    </div>
                    <fieldset class="catalog-admin-fieldset">
                      <legend>Додаткові варианти упаковки</legend>
                      <div class="catalog-admin-text-grid">
                        <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Ціна за штуку (мерч)" data-catalog-field-value="">
                          <span>Ціна за штуку (мерч, без міри)</span>
                          <input type="number" min="0" step="0.01" data-catalog-price-field="merch" value="${escapeHtml(String(row.priceOverrides?.['merch'] || ''))}" placeholder="Наприклад: 45">
                        </label>
                        <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Ціна за штуку" data-catalog-field-value="">
                          <span>Ціна за штуку (пакетик, штука)</span>
                          <input type="number" min="0" step="0.01" data-catalog-price-field="piece" value="${escapeHtml(String(row.priceOverrides?.['piece'] || ''))}" placeholder="Наприклад: 65">
                        </label>
                        <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Кастомна вага (текст)" data-catalog-field-value="">
                          <span>Кастомна міра (наприклад: 50г)</span>
                          <input type="text" data-catalog-custom-unit placeholder="Наприклад: 50g" value="${escapeHtml(String(row.customUnit || ''))}">
                        </label>
                        <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Ціна за кастомну міру" data-catalog-field-value="">
                          <span>Ціна за кастомну міру, грн</span>
                          <input type="number" min="0" step="0.01" data-catalog-price-field="custom" value="${escapeHtml(String(row.priceOverrides?.['custom'] || ''))}" placeholder="Наприклад: 150">
                        </label>
                      </div>
                    </fieldset>
                    <fieldset class="catalog-admin-fieldset">
                      <legend>Варіанти кольорів</legend>
                      <div class="catalog-admin-colors-container" data-catalog-colors-container>
                        ${(row.colorVariants || []).map((color, idx) => `
                          <div class="catalog-admin-color-item" data-catalog-color-item="${idx}">
                            <div class="catalog-admin-text-grid">
                              <label class="catalog-admin-field">
                                <span>Назва кольору</span>
                                <input type="text" class="catalog-color-name" value="${escapeHtml(color.name || '')}" placeholder="Наприклад: Чорна обпалювання">
                              </label>
                              <label class="catalog-admin-field">
                                <span>Опис кольору</span>
                                <input type="text" class="catalog-color-description" value="${escapeHtml(color.description || '')}" placeholder="Наприклад: Темна, інтенсивна">
                              </label>
                              <div class="catalog-admin-field catalog-admin-field-wide">
                                <span>Фото кольору</span>
                                ${buildImagePickerMarkup({ value: color.image_url || '', inputAttrs: 'class="catalog-color-image"' })}
                              </div>
                              <button type="button" class="btn ghost remove-color" title="Видалити цей колір">✕ Видалити</button>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                      <button type="button" class="btn ghost add-color" data-catalog-add-color>+ Додати колір</button>
                    </fieldset>
                    <fieldset class="catalog-admin-fieldset" ${row.category !== 'accessories' ? 'hidden' : ''} data-catalog-accessories-section>
                      <legend>Варіанти градацій (розміри/типи)</legend>
                      <div class="catalog-admin-gradations-container" data-catalog-gradations-container>
                        ${(row.gradationVariants || []).map((gradation, idx) => `
                          <div class="catalog-admin-gradation-item" data-catalog-gradation-item="${idx}">
                            <div class="catalog-admin-text-grid">
                              <label class="catalog-admin-field">
                                <span>Назва градації (розмір/тип)</span>
                                <input type="text" class="catalog-gradation-name" value="${escapeHtml(gradation.name || '')}" placeholder="Наприклад: Чорна L">
                              </label>
                              <label class="catalog-admin-field">
                                <span>Опис</span>
                                <input type="text" class="catalog-gradation-description" value="${escapeHtml(gradation.description || '')}" placeholder="Наприклад: Великий розмір">
                              </label>
                              <label class="catalog-admin-field">
                                <span>Ціна, грн</span>
                                <input type="number" min="0" step="0.01" class="catalog-gradation-price" value="${escapeHtml(String(gradation.price || ''))}" placeholder="Наприклад: 150">
                              </label>
                              <label class="catalog-admin-field">
                                <span>SKU (артикул)</span>
                                <input type="text" class="catalog-gradation-sku" value="${escapeHtml(gradation.sku || '')}" placeholder="Наприклад: ACC-BLK-L-001">
                              </label>
                              <button type="button" class="btn ghost remove-gradation" title="Видалити цю градацію">✕ Видалити</button>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                      <button type="button" class="btn ghost add-gradation" data-catalog-add-gradation>+ Додати градацію</button>
                    </fieldset>
                    <div class="catalog-admin-text-grid">
                      <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Категорія" data-catalog-field-value="${escapeHtml(row.category || '')}">
                        <span>Категорія</span>
                        <select data-catalog-text-field="category">
                          ${catalogCategoryOrder.filter((categoryValue) => !isNonCoffeeCategory(categoryValue)).map((categoryValue) => `<option value="${categoryValue}" ${row.category === categoryValue ? 'selected' : ''}>${catalogCategoryLabels[categoryValue] || categoryValue}</option>`).join('')}
                        </select>
                      </label>
                      <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Назва картки" data-catalog-field-value="${escapeHtml(row.name || '')}">
                        <span>Назва картки</span>
                        <input type="text" data-catalog-text-field="name" value="${escapeHtml(row.name)}">
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide" data-catalog-field-wrapper data-catalog-field-label="Опис картки" data-catalog-field-value="${escapeHtml(row.description || '')}">
                        <span>Опис картки</span>
                        <textarea rows="3" data-catalog-text-field="description">${escapeHtml(row.description || '')}</textarea>
                      </label>
                      <div class="catalog-admin-field catalog-admin-field-wide" data-catalog-field-wrapper data-catalog-field-label="Фото" data-catalog-field-value="${escapeHtml(row.image || '')}">
                        <span>Фото</span>
                        ${buildImagePickerMarkup({ value: row.image || '', inputAttrs: 'data-catalog-text-field="image"' })}
                      </div>
                      <label class="catalog-admin-field catalog-admin-field-wide" data-catalog-field-wrapper data-catalog-field-label="Смак" data-catalog-field-value="${escapeHtml(flavorHint)}">
                        <span>Смак</span>
                        <textarea rows="2" data-catalog-text-field="taste" placeholder="Що відчувається в ароматиці та післясмаку">${escapeHtml(flavorHint)}</textarea>
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide" data-catalog-field-wrapper data-catalog-field-label="Що в чашці" data-catalog-field-value="${escapeHtml(cupHint)}">
                        <span>Що в чашці</span>
                        <textarea rows="2" data-catalog-text-field="cup_profile" placeholder="Щільність, кислотність, солодкість, тіло">${escapeHtml(cupHint)}</textarea>
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide" data-catalog-field-wrapper data-catalog-field-label="Як заварювати" data-catalog-field-value="${escapeHtml(brewHint)}">
                        <span>Як заварювати</span>
                        <textarea rows="3" data-catalog-text-field="brew_guide" placeholder="Рецепт, температура, помел, пропорції">${escapeHtml(brewHint)}</textarea>
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide" data-catalog-field-wrapper data-catalog-field-label="Кому підійде" data-catalog-field-value="${escapeHtml(audienceHint)}">
                        <span>Кому підійде</span>
                        <textarea rows="2" data-catalog-text-field="audience" placeholder="Для кого цей лот">${escapeHtml(audienceHint)}</textarea>
                      </label>
                      <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Походження" data-catalog-field-value="${escapeHtml(row.origin || '')}">
                        <span>Походження</span>
                        <input type="text" data-catalog-text-field="origin" value="${escapeHtml(row.origin || '')}">
                      </label>
                      <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Обробка" data-catalog-field-value="${escapeHtml(row.processing || '')}">
                        <span>Обробка</span>
                        <input type="text" data-catalog-text-field="processing" value="${escapeHtml(row.processing || '')}">
                      </label>
                      <label class="catalog-admin-field" data-catalog-field-wrapper data-catalog-field-label="Вага" data-catalog-field-value="${escapeHtml(row.weight || '')}">
                        <span>Вага</span>
                        <input type="text" data-catalog-text-field="weight" value="${escapeHtml(row.weight || '')}">
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide" data-catalog-field-wrapper data-catalog-field-label="Alt для фото" data-catalog-field-value="${escapeHtml(row.alt || '')}">
                        <span>Alt для фото</span>
                        <textarea rows="2" data-catalog-text-field="alt">${escapeHtml(row.alt || '')}</textarea>
                      </label>
                    </div>
                    <div class="catalog-admin-card-actions">
                      <button class="btn light" type="button" data-catalog-save>Зберегти</button>
                      ${row.catalogSource === 'remote'
                        ? '<button class="btn danger" type="button" data-catalog-delete>Видалити позицію</button>'
                        : '<p class="catalog-admin-delete-note">Локальна позиція: для повного видалення приберіть її з products.json.</p>'}
                    </div>
                  </div>
                  <p class="form-status" data-catalog-row-status></p>
                </div>
              </details>`;
          }).join('')}
        </div>
      </details>`;
  }).join('');

  catalogAdminList.querySelectorAll('[data-catalog-field-search]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    const card = input.closest('.catalog-admin-card');
    filterCatalogCardFields(card, input.value);
  });

  catalogAdminList.querySelectorAll('[data-noncoffee-card]').forEach((controls) => {
    const card = controls.closest('.catalog-admin-card');
    const row = catalogAdminRows.find((item) => item.id === card?.dataset.productId);
    if (!row) return;
    mountNonCoffeeFields(controls.querySelector('[data-noncoffee-slot]'), row.category, detailsToDraft(row));
  });

  hydrateImagePickers(catalogAdminList);
};

const loadCatalogAdmin = async (session) => {
  if (!supabase || !session?.user) {
    hideCatalogAdmin();
    return;
  }

  const { data: adminRows, error: adminError } = await supabase
    .from('catalog_admins')
    .select('email')
    .limit(1);

  if (adminError) {
    console.error('Failed to verify catalog admin access', adminError);
    hideCatalogAdmin();
    return;
  }

  if (!adminRows || adminRows.length === 0) {
    hideCatalogAdmin();
    return;
  }

  if (catalogAdminPanel) catalogAdminPanel.hidden = false;
  if (catalogAdminLead) {
    catalogAdminLead.textContent = `Ви увійшли як оператор каталогу (${session.user.email}). Товари згруповані за категоріями, а кожна картка розкривається по кліку для швидкого редагування.`;
  }

  setCatalogAdminStatus('Оновлюємо стан каталогу...', 'neutral');

  const [products, stateResponse, textOverrideResponse, initialPriceOverrideResponse] = await Promise.all([
    fetchCatalogProductsForAdmin(),
    supabase
      .from('product_catalog_state')
      .select('product_id, is_available, stock_quantity, sold_quantity, updated_at')
      .order('product_id', { ascending: true }),
    supabase
      .from('product_text_overrides')
      .select('product_id, category_override, name_override, description_override, image_override, origin_override, processing_override, alt_override, weight_override, taste_override, cup_profile_override, brew_guide_override, audience_override, is_active, updated_at')
      .eq('is_active', true),
    supabase
      .from('product_price_overrides')
      .select('product_id, override_price, override_price_250g, override_price_1kg, currency, is_active, custom_variants, color_variants, gradation_variants, updated_at')
      .eq('is_active', true),
  ]);

  if (stateResponse.error) {
    console.error('Failed to load product catalog state', stateResponse.error);
    setCatalogAdminStatus('Не вдалося завантажити стан каталогу. Перевірте таблиці product_catalog_state і catalog_admins у Supabase.', 'error');
    return;
  }

  let textOverrideRows = textOverrideResponse.data || [];
  if (textOverrideResponse.error) {
    if (isMissingRelationError(textOverrideResponse.error, 'product_text_overrides')) {
      setCatalogAdminStatus('Таблиця product_text_overrides ще не створена. Редагування текстів тимчасово недоступне.', 'error');
      textOverrideRows = [];
    } else {
      console.error('Failed to load product text overrides', textOverrideResponse.error);
      setCatalogAdminStatus('Не вдалося завантажити оверрайди текстів карток.', 'error');
      return;
    }
  }

  let priceOverrideResponse = initialPriceOverrideResponse;
  if (priceOverrideResponse.error && (isMissingColumnError(priceOverrideResponse.error, 'override_price_250g') || isMissingColumnError(priceOverrideResponse.error, 'override_price_1kg'))) {
    priceOverrideResponse = await supabase
      .from('product_price_overrides')
      .select('product_id, override_price, currency, is_active, updated_at')
      .eq('is_active', true);
  }

  let priceOverrideRows = priceOverrideResponse.data || [];
  if (priceOverrideResponse.error) {
    if (isMissingRelationError(priceOverrideResponse.error, 'product_price_overrides')) {
      setCatalogAdminStatus('Таблиця product_price_overrides ще не створена. Редагування цін тимчасово недоступне.', 'error');
      priceOverrideRows = [];
    } else {
      console.error('Failed to load product price overrides', priceOverrideResponse.error);
      setCatalogAdminStatus('Не вдалося завантажити оверрайди цін.', 'error');
      return;
    }
  }

  const stateWithTextRows = stateResponse.data || [];
  stateWithTextRows.textOverrides = textOverrideRows;
  stateWithTextRows.priceOverrides = priceOverrideRows;
  catalogAdminRows = buildCatalogAdminRows(products, stateWithTextRows);
  catalogAdminHasUnsavedChanges = false;
  renderCatalogAdminList();
  if (!textOverrideResponse.error && !priceOverrideResponse.error) {
    setCatalogAdminStatus('Каталог готовий до редагування.', 'success');
  }
};

const createCatalogProduct = async (form) => {
  if (!supabase || !currentSession?.user || !(form instanceof HTMLFormElement)) return;

  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  const productId = slugifyProductId(formData.get('productId') || name);
  const category = String(formData.get('category') || 'espresso').trim();
  const description = String(formData.get('description') || '').trim();
  const image = String(formData.get('image') || '').trim().replace(/\\/g, '/');
  const alt = String(formData.get('alt') || name).trim();
  const origin = normalizeOptionalText(formData.get('origin'));
  const processing = normalizeOptionalText(formData.get('processing'));
  const country = normalizeOptionalText(formData.get('country'));
  const region = normalizeOptionalText(formData.get('region'));
  const featured = formData.get('featured') === 'on';
  const isAvailable = formData.get('isAvailable') === 'on';
  const stockQuantity = parseOptionalIntegerInput(formData.get('stockQuantity'));
  const price250 = parseNonNegativePriceInput(formData.get('price250'));
  const price1kg = parseNonNegativePriceInput(formData.get('price1kg'));
  const priceMerch = parseNonNegativePriceInput(formData.get('priceMerch'));
  const pricePiece = parseNonNegativePriceInput(formData.get('pricePiece'));
  const customUnit = normalizeOptionalText(formData.get('customUnit'));
  const priceCustom = customUnit ? parseNonNegativePriceInput(formData.get('priceCustom')) : null;
  const isNonCoffee = isNonCoffeeCategory(category);
  const nonCoffeeRoot = isNonCoffee ? form.querySelector('[data-noncoffee-fields]') : null;
  const nonCoffeeDraft = nonCoffeeRoot instanceof HTMLElement ? collectNonCoffeeDraft(nonCoffeeRoot) : null;
  const priceBase = nonCoffeeDraft ? parseNonNegativePriceInput(nonCoffeeDraft.price) : null;

  if (!productId || !name || !description || !image) {
    setCatalogCreateStatus('Заповніть ID або назву, опис і фото товару.', 'error');
    return;
  }

  if (!isValidCatalogImageValue(image)) {
    setCatalogCreateStatus('Фото має бути у форматі images/your-file.webp або повний https:// URL з розширенням зображення.', 'error');
    return;
  }

  if (Number.isNaN(stockQuantity)) {
    setCatalogCreateStatus('Залишок має бути цілим числом 0 або більше.', 'error');
    return;
  }

  let details = null;
  if (isNonCoffee) {
    if (priceBase === null || Number.isNaN(priceBase)) {
      setCatalogCreateStatus('Вкажіть ціну товару: число 0 або більше.', 'error');
      return;
    }

    const detailsResult = buildNonCoffeeDetails(nonCoffeeDraft || {}, category);
    if (detailsResult.error) {
      setCatalogCreateStatus(detailsResult.error, 'error');
      return;
    }
    details = detailsResult.details;
  } else {
    if (Number.isNaN(price250) || Number.isNaN(price1kg)) {
      setCatalogCreateStatus('Ціни повинні бути числами 0 або більше.', 'error');
      return;
    }

    // At least one pricing option must be provided
    const hasBasePricing = price250 !== null || price1kg !== null;
    const hasVariantPricing = priceMerch !== null || pricePiece !== null || (customUnit && priceCustom !== null);

    if (!hasBasePricing && !hasVariantPricing) {
      setCatalogCreateStatus('Вкажіть хоча б одну ціну: 250г, 1кг, мерч, пакетик або кастомну міру.', 'error');
      return;
    }
  }

  const hasVariantStock = Boolean(details?.variants?.some((variant) => variant.stock !== null));
  const effectiveStockQuantity = hasVariantStock ? null : stockQuantity;

  const weight = isNonCoffee ? null : inferCatalogWeight({ category, price250, price1kg });

  const basePrice = isNonCoffee
    ? priceBase
    : (getDefaultCatalogPrice({ price250, price1kg }) || priceMerch || pricePiece || priceCustom || 0);
  const volumePrices = {};
  if (price250 !== null) volumePrices['250g'] = price250;
  if (price1kg !== null) volumePrices['1kg'] = price1kg;
  if (priceMerch !== null) volumePrices['merch'] = priceMerch;
  if (pricePiece !== null) volumePrices['piece'] = pricePiece;
  if (customUnit && priceCustom !== null) volumePrices['custom'] = priceCustom;

  const productPayload = {
    product_id: productId,
    name,
    description,
    image,
    alt,
    category,
    price: basePrice,
    weight,
    country,
    region,
    origin,
    processing,
    featured,
    ...(details ? { details } : {}),
    raw_data: {
      id: productId,
      name,
      description,
      image,
      alt,
      category,
      price: basePrice,
      weight,
      origin,
      processing,
      ...(country ? { country } : {}),
      ...(region ? { region } : {}),
      ...(featured ? { featured: true } : {}),
      ...(Object.keys(volumePrices).length > 0 ? { volumePrices } : {}),
      ...(details ? { details } : {}),
    },
  };

  const defaultVolume = price250 !== null ? '250g' : (price1kg !== null ? '1kg' : (priceMerch !== null ? 'merch' : (pricePiece !== null ? 'piece' : 'custom')));
  const priceOverridePayload = {
    product_id: productId,
    is_active: Object.keys(volumePrices).length > 0 || customUnit !== null,
    updated_by: currentSession.user.id,
    currency: 'UAH',
    override_price: volumePrices[defaultVolume] ?? basePrice,
    override_price_250g: volumePrices['250g'] ?? null,
    override_price_1kg: volumePrices['1kg'] ?? null,
    override_price_merch: volumePrices['merch'] ?? null,
    override_price_piece: volumePrices['piece'] ?? null,
    custom_unit: customUnit || null,
    override_price_custom: volumePrices['custom'] ?? null,
    custom_variants: (priceMerch !== null || pricePiece !== null || (customUnit && priceCustom !== null)) ? true : false,
  };

  if (catalogAdminCreateSubmit instanceof HTMLButtonElement) {
    catalogAdminCreateSubmit.disabled = true;
  }
  setCatalogCreateStatus('Створюємо товар...', 'neutral');

  const [catalogResult, stateResult, priceResult] = await Promise.all([
    supabase
      .from('product_catalog_items')
      .upsert(productPayload, { onConflict: 'product_id' }),
    supabase
      .from('product_catalog_state')
      .upsert({
        product_id: productId,
        is_available: isAvailable,
        stock_quantity: effectiveStockQuantity,
        updated_by: currentSession.user.id,
      }, { onConflict: 'product_id' }),
    // Accessories and merch keep their prices (base and per variant) in details, not in price overrides.
    isNonCoffee
      ? Promise.resolve({ error: null })
      : supabase
        .from('product_price_overrides')
        .upsert(priceOverridePayload, { onConflict: 'product_id' }),
  ]);

  if (catalogAdminCreateSubmit instanceof HTMLButtonElement) {
    catalogAdminCreateSubmit.disabled = false;
  }

  if (catalogResult.error) {
    console.error('Failed to create catalog product', catalogResult.error);
    if (isCatalogRlsAccessError(catalogResult.error)) {
      setCatalogCreateStatus('Немає прав на створення товару (RLS). Додайте email адміністратора в таблицю catalog_admins у Supabase і увійдіть у кабінет повторно.', 'error');
      return;
    }
    setCatalogCreateStatus(catalogResult.error.message || 'Не вдалося створити товар.', 'error');
    return;
  }

  if (stateResult.error) {
    console.error('Failed to create catalog state', stateResult.error);
    setCatalogCreateStatus(stateResult.error.message || 'Товар створено, але стан каталогу не збережено.', 'error');
    return;
  }

  if (priceResult.error) {
    console.error('Failed to create catalog prices', priceResult.error);
    setCatalogCreateStatus(priceResult.error.message || 'Товар створено, але ціни не збережено.', 'error');
    return;
  }

  resetCreateForm(form);
  catalogAdminHasUnsavedChanges = false;
  setCatalogCreateStatus(`Товар ${name} створено.`, 'success');
  await loadCatalogAdmin(currentSession);
};

const saveNonCoffeeCatalogRow = async (card, row) => {
  const rowStatus = card.querySelector('[data-catalog-row-status]');
  const saveButton = card.querySelector('[data-catalog-save]');
  const availabilityField = card.querySelector('[data-catalog-availability]');
  const stockField = card.querySelector('[data-catalog-stock]');
  const fieldsRoot = card.querySelector('[data-noncoffee-fields]');
  const readCardField = (name) => card.querySelector(`[data-card-field="${name}"]`);

  const finish = (message, tone) => {
    if (rowStatus) {
      rowStatus.textContent = message;
      rowStatus.dataset.tone = tone;
    }
    if (saveButton instanceof HTMLButtonElement) saveButton.disabled = false;
  };

  if (!(availabilityField instanceof HTMLInputElement) || !(stockField instanceof HTMLInputElement) || !(fieldsRoot instanceof HTMLElement)) {
    return;
  }

  const category = String(readCardField('category')?.value || row.category);
  const name = String(readCardField('name')?.value || '').trim();
  const description = String(readCardField('description')?.value || '').trim();
  const image = normalizeCatalogImagePath(readCardField('image')?.value);
  const alt = String(readCardField('alt')?.value || '').trim();
  const featured = readCardField('featured') instanceof HTMLInputElement && readCardField('featured').checked;
  const stockQuantity = parseOptionalIntegerInput(stockField.value);

  if (!name || !description || !image) {
    finish('Заповніть назву, опис і фото товару.', 'error');
    return;
  }

  if (!isValidCatalogImageValue(image)) {
    finish('Фото має бути у форматі images/your-file.webp або повний https:// URL з розширенням зображення.', 'error');
    return;
  }

  if (Number.isNaN(stockQuantity)) {
    finish('Залишок має бути цілим числом 0 або більше.', 'error');
    return;
  }

  const draft = collectNonCoffeeDraft(fieldsRoot);
  const price = parseNonNegativePriceInput(draft.price);
  if (price === null || Number.isNaN(price)) {
    finish('Вкажіть ціну товару: число 0 або більше.', 'error');
    return;
  }

  const detailsResult = buildNonCoffeeDetails(draft, category);
  if (detailsResult.error) {
    finish(detailsResult.error, 'error');
    return;
  }

  const details = detailsResult.details;
  const hasVariantStock = Boolean(details.variants?.some((variant) => variant.stock !== null));

  if (saveButton instanceof HTMLButtonElement) saveButton.disabled = true;
  if (rowStatus) {
    rowStatus.textContent = 'Зберігаємо зміни...';
    rowStatus.dataset.tone = 'neutral';
  }

  const { data: updatedItems, error: itemError } = await supabase
    .from('product_catalog_items')
    .update({
      name,
      description,
      image,
      alt: alt || name,
      category,
      price,
      featured,
      details,
      updated_at: new Date().toISOString(),
    })
    .eq('product_id', row.id)
    .select('product_id');

  if (itemError) {
    console.error('Failed to update catalog product', itemError);
    finish(isCatalogRlsAccessError(itemError)
      ? 'Немає прав на редагування товару (RLS). Додайте email адміністратора в таблицю catalog_admins у Supabase.'
      : (itemError.message || 'Не вдалося зберегти товар.'), 'error');
    return;
  }

  if (!updatedItems || updatedItems.length === 0) {
    finish('Товар не оновлено: немає прав або позицію не знайдено в каталозі Supabase.', 'error');
    return;
  }

  const { error: stateError } = await supabase
    .from('product_catalog_state')
    .upsert({
      product_id: row.id,
      is_available: availabilityField.checked,
      stock_quantity: hasVariantStock ? null : stockQuantity,
      updated_by: currentSession.user.id,
    }, { onConflict: 'product_id' });

  if (stateError) {
    console.error('Failed to save product catalog state', stateError);
    finish(stateError.message || 'Товар збережено, але наявність не оновлено.', 'error');
    return;
  }

  // Accessories and merch keep text and prices in product_catalog_items, so old overrides would shadow the edit.
  const overrideResults = await Promise.all([
    supabase.from('product_text_overrides').update({ is_active: false }).eq('product_id', row.id).eq('is_active', true),
    supabase.from('product_price_overrides').update({ is_active: false }).eq('product_id', row.id).eq('is_active', true),
  ]);
  const overrideError = overrideResults.find((result) => result.error)?.error;
  if (overrideError) {
    console.error('Failed to deactivate legacy product overrides', overrideError);
    finish('Товар збережено, але старі оверрайди тексту або цін вимкнути не вдалося: зміни можуть не відобразитися.', 'error');
    return;
  }

  catalogAdminHasUnsavedChanges = false;
  await loadCatalogAdmin(currentSession);
  setCatalogAdminStatus(`Оновлено товар: ${name}.`, 'success');
};

const saveCatalogRow = async (card) => {
  if (!supabase || !currentSession?.user || !card) return;

  const productId = card.dataset.productId;
  const availabilityField = card.querySelector('[data-catalog-availability]');
  const stockField = card.querySelector('[data-catalog-stock]');
  const rowStatus = card.querySelector('[data-catalog-row-status]');
  const saveButton = card.querySelector('[data-catalog-save]');
  const row = catalogAdminRows.find((item) => item.id === productId);

  if (row && card.querySelector('[data-noncoffee-card]')) {
    await saveNonCoffeeCatalogRow(card, row);
    return;
  }

  if (!productId || !(availabilityField instanceof HTMLInputElement) || !(stockField instanceof HTMLInputElement) || !row) {
    return;
  }

  const rawStock = stockField.value.trim();
  let stockQuantity = null;

  if (rawStock) {
    const parsedStock = Number(rawStock);
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      if (rowStatus) {
        rowStatus.textContent = 'Вкажіть ціле число або залиште поле порожнім для необмеженого залишку.';
        rowStatus.dataset.tone = 'error';
      }
      return;
    }

    stockQuantity = parsedStock;
  }

  if (saveButton instanceof HTMLButtonElement) {
    saveButton.disabled = true;
  }
  if (rowStatus) {
    rowStatus.textContent = 'Зберігаємо зміни...';
    rowStatus.dataset.tone = 'neutral';
  }

  const textInputs = card.querySelectorAll('[data-catalog-text-field]');
  const priceInputs = card.querySelectorAll('[data-catalog-price-field]');
  const textPatch = {};
  const pricePatch = {};
  let textValidationError = '';

  textInputs.forEach((input) => {
    if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement) && !(input instanceof HTMLSelectElement)) return;
    const field = input.dataset.catalogTextField;
    if (!field || !editableCatalogTextFields.includes(field)) return;

    const rawValue = String(input.value ?? '').trim();
    const nextValue = field === 'image' ? rawValue.replace(/\\/g, '/') : rawValue;

    if (field === 'image' && nextValue !== '' && !isValidCatalogImageValue(nextValue)) {
      textValidationError = 'Фото має бути у форматі images/your-file.webp або повний https:// URL з розширенням зображення.';
      return;
    }

    const baseValue = String(row.baseText?.[field] ?? '').trim();
    const hasCurrentOverride = Object.prototype.hasOwnProperty.call(row.textOverrides || {}, field);

    if (nextValue !== baseValue) {
      textPatch[field] = nextValue;
    } else if (hasCurrentOverride) {
      textPatch[field] = null;
    }
  });

  if (textValidationError) {
    if (rowStatus) {
      rowStatus.textContent = textValidationError;
      rowStatus.dataset.tone = 'error';
    }
    if (saveButton instanceof HTMLButtonElement) {
      saveButton.disabled = false;
    }
    return;
  }

  const catalogVolumeOptionsWithCustom = ['250g', '1kg', 'merch', 'piece', 'custom'];

  for (const input of priceInputs) {
    if (!(input instanceof HTMLInputElement)) continue;
    const volumeOption = input.dataset.catalogPriceField;
    if (!volumeOption || !catalogVolumeOptionsWithCustom.includes(volumeOption)) continue;

    const parsedValue = parseNonNegativePriceInput(input.value);
    if (Number.isNaN(parsedValue)) {
      if (rowStatus) {
        rowStatus.textContent = 'Ціна повинна бути числом 0 або більше.';
        rowStatus.dataset.tone = 'error';
      }
      if (saveButton instanceof HTMLButtonElement) {
        saveButton.disabled = false;
      }
      return;
    }

    const nextValue = parsedValue;
    const baseValue = Number(row.baseVolumePrices?.[volumeOption]);
    const currentOverrideValue = Number(row.priceOverrides?.[volumeOption]);

    if (nextValue === null) {
      if (Number.isFinite(currentOverrideValue)) {
        pricePatch[volumeOption] = null;
      }
      continue;
    }

    const shouldOverride = !Number.isFinite(baseValue) || Number(nextValue) !== Number(baseValue);
    if (shouldOverride) {
      pricePatch[volumeOption] = nextValue;
    } else if (Number.isFinite(currentOverrideValue)) {
      pricePatch[volumeOption] = null;
    }
  }

  const nextTextOverrides = { ...(row.textOverrides || {}) };
  Object.entries(textPatch).forEach(([field, value]) => {
    if (value === null || value === undefined) {
      delete nextTextOverrides[field];
      return;
    }
    nextTextOverrides[field] = String(value);
  });

  const nextPriceOverrides = { ...(row.priceOverrides || {}) };
  Object.entries(pricePatch).forEach(([volumeOption, value]) => {
    if (value === null || value === undefined) {
      delete nextPriceOverrides[volumeOption];
      return;
    }
    nextPriceOverrides[volumeOption] = Number(value);
  });

  const textOverridePayload = {
    product_id: productId,
    is_active: Object.keys(nextTextOverrides).length > 0,
    updated_by: currentSession.user.id,
    category_override: null,
    name_override: null,
    description_override: null,
    image_override: null,
    origin_override: null,
    processing_override: null,
    alt_override: null,
    weight_override: null,
    taste_override: null,
    cup_profile_override: null,
    brew_guide_override: null,
    audience_override: null,
  };

  const customUnitInput = card.querySelector('[data-catalog-custom-unit]');
  const customUnit = customUnitInput ? String(customUnitInput.value || '').trim() : '';

  const defaultVolume = row.baseVolumePrices?.defaultVolume || '1kg';
  const hasAnyPriceOverride = Object.keys(nextPriceOverrides).length > 0;
  const defaultVolumePrice = Object.prototype.hasOwnProperty.call(nextPriceOverrides, defaultVolume)
    ? nextPriceOverrides[defaultVolume]
    : null;
  
  const customVariants = [];
  if (Object.prototype.hasOwnProperty.call(nextPriceOverrides, 'merch') && nextPriceOverrides['merch'] !== null) {
    customVariants.push({ unit: 'merch', price: nextPriceOverrides['merch'] });
  }
  if (Object.prototype.hasOwnProperty.call(nextPriceOverrides, 'piece') && nextPriceOverrides['piece'] !== null) {
    customVariants.push({ unit: 'piece', price: nextPriceOverrides['piece'] });
  }
  if (customUnit && Object.prototype.hasOwnProperty.call(nextPriceOverrides, 'custom') && nextPriceOverrides['custom'] !== null) {
    customVariants.push({ unit: customUnit, price: nextPriceOverrides['custom'] });
  }

  const colorVariants = [];
  const colorContainer = card.querySelector('[data-catalog-colors-container]');
  if (colorContainer) {
    const colorItems = colorContainer.querySelectorAll('[data-catalog-color-item]');
    colorItems.forEach((item) => {
      const nameInput = item.querySelector('.catalog-color-name');
      const descInput = item.querySelector('.catalog-color-description');
      const imageInput = item.querySelector('.catalog-color-image');
      
      if (nameInput instanceof HTMLInputElement && descInput instanceof HTMLInputElement && imageInput instanceof HTMLInputElement) {
        const name = String(nameInput.value || '').trim();
        const description = String(descInput.value || '').trim();
        const image_url = String(imageInput.value || '').trim();
        
        if (name) {
          colorVariants.push({ name, description, image_url });
        }
      }
    });
  }

  const gradationVariants = [];
  const gradationContainer = card.querySelector('[data-catalog-gradations-container]');
  if (gradationContainer) {
    const gradationItems = gradationContainer.querySelectorAll('[data-catalog-gradation-item]');
    gradationItems.forEach((item) => {
      const nameInput = item.querySelector('.catalog-gradation-name');
      const descInput = item.querySelector('.catalog-gradation-description');
      const priceInput = item.querySelector('.catalog-gradation-price');
      const skuInput = item.querySelector('.catalog-gradation-sku');
      
      if (nameInput instanceof HTMLInputElement && priceInput instanceof HTMLInputElement) {
        const name = String(nameInput.value || '').trim();
        const description = String(descInput instanceof HTMLInputElement ? descInput.value : '').trim();
        const price = parseFloat(String(priceInput.value || '0'));
        const sku = String(skuInput instanceof HTMLInputElement ? skuInput.value : '').trim();
        
        if (name && price > 0) {
          gradationVariants.push({ name, description, price, sku });
        }
      }
    });
  }

  const priceOverridePayload = {
    product_id: productId,
    is_active: hasAnyPriceOverride || customVariants.length > 0 || colorVariants.length > 0 || gradationVariants.length > 0,
    updated_by: currentSession.user.id,
    currency: 'UAH',
    override_price: defaultVolumePrice,
    override_price_250g: Object.prototype.hasOwnProperty.call(nextPriceOverrides, '250g') ? nextPriceOverrides['250g'] : null,
    override_price_1kg: Object.prototype.hasOwnProperty.call(nextPriceOverrides, '1kg') ? nextPriceOverrides['1kg'] : null,
    override_price_merch: Object.prototype.hasOwnProperty.call(nextPriceOverrides, 'merch') ? nextPriceOverrides['merch'] : null,
    override_price_piece: Object.prototype.hasOwnProperty.call(nextPriceOverrides, 'piece') ? nextPriceOverrides['piece'] : null,
    override_price_custom: Object.prototype.hasOwnProperty.call(nextPriceOverrides, 'custom') ? nextPriceOverrides['custom'] : null,
    custom_unit: customUnit || null,
    custom_variants: customVariants.length > 0 ? JSON.stringify(customVariants) : null,
    color_variants: colorVariants.length > 0 ? JSON.stringify(colorVariants) : null,
    gradation_variants: gradationVariants.length > 0 ? JSON.stringify(gradationVariants) : null,
  };

  Object.entries(nextTextOverrides).forEach(([field, value]) => {
    const column = catalogTextFieldColumnMap[field];
    if (!column) return;
    textOverridePayload[column] = value;
  });

  const [{ data, error }, textSaveResult, priceSaveResult] = await Promise.all([
    supabase
    .from('product_catalog_state')
    .upsert({
      product_id: productId,
      is_available: availabilityField.checked,
      stock_quantity: stockQuantity,
      updated_by: currentSession.user.id,
    }, { onConflict: 'product_id' })
    .select('product_id, is_available, stock_quantity, sold_quantity, updated_at')
    .single(),
    supabase
      .from('product_text_overrides')
      .upsert(textOverridePayload, { onConflict: 'product_id' }),
    supabase
      .from('product_price_overrides')
      .upsert(priceOverridePayload, { onConflict: 'product_id' }),
  ]);

  if (saveButton instanceof HTMLButtonElement) {
    saveButton.disabled = false;
  }

  if (error) {
    console.error('Failed to save product catalog state', error);
    if (rowStatus) {
      rowStatus.textContent = error.message || 'Не вдалося зберегти зміни.';
      rowStatus.dataset.tone = 'error';
    }
    return;
  }

  if (textSaveResult.error) {
    console.error('Failed to save product text overrides', textSaveResult.error);
    if (rowStatus) {
      rowStatus.textContent = textSaveResult.error.message || 'Не вдалося зберегти текст картки.';
      rowStatus.dataset.tone = 'error';
    }
    return;
  }

  if (priceSaveResult.error) {
    console.error('Failed to save product price overrides', priceSaveResult.error);
    if (rowStatus) {
      rowStatus.textContent = priceSaveResult.error.message || 'Не вдалося зберегти ціни картки.';
      rowStatus.dataset.tone = 'error';
    }
    return;
  }

  const nextState = normalizeCatalogState(data || { product_id: productId, is_available: availabilityField.checked, stock_quantity: stockQuantity, sold_quantity: row.state.soldQuantity });
  catalogAdminRows = catalogAdminRows.map((item) => item.id === productId
    ? {
      ...item,
      ...item.baseText,
      ...nextTextOverrides,
      state: nextState,
      availableNow: nextState.stockQuantity === null ? null : Math.max(nextState.stockQuantity - nextState.soldQuantity, 0),
      textOverrides: nextTextOverrides,
      priceOverrides: nextPriceOverrides,
      price250: Object.prototype.hasOwnProperty.call(nextPriceOverrides, '250g') ? nextPriceOverrides['250g'] : item.baseVolumePrices?.['250g'],
      price1kg: Object.prototype.hasOwnProperty.call(nextPriceOverrides, '1kg') ? nextPriceOverrides['1kg'] : item.baseVolumePrices?.['1kg'],
    }
    : item);

  renderCatalogAdminList();
  catalogAdminHasUnsavedChanges = false;
  setCatalogAdminStatus(`Оновлено товар: ${row.name}.`, 'success');
};

const deleteCatalogRow = async (card) => {
  if (!supabase || !currentSession?.user || !(card instanceof HTMLElement)) return;

  const productId = String(card.dataset.productId || '').trim();
  const row = catalogAdminRows.find((item) => item.id === productId);
  const rowStatus = card.querySelector('[data-catalog-row-status]');
  const deleteButton = card.querySelector('[data-catalog-delete]');

  if (!productId || !row || row.catalogSource !== 'remote' || !(deleteButton instanceof HTMLButtonElement)) return;

  const confirmed = window.confirm(`Видалити позицію «${row.name}»? Цю дію не можна скасувати.`);
  if (!confirmed) return;

  deleteButton.disabled = true;
  if (rowStatus) {
    rowStatus.textContent = 'Видаляємо позицію...';
    rowStatus.dataset.tone = 'neutral';
  }

  const relatedTables = ['product_price_overrides', 'product_text_overrides', 'product_catalog_state'];
  for (const table of relatedTables) {
    const { error } = await supabase.from(table).delete().eq('product_id', productId);
    if (error) {
      console.error(`Failed to delete ${table} for catalog product`, error);
      deleteButton.disabled = false;
      if (rowStatus) {
        rowStatus.textContent = error.message || 'Не вдалося очистити дані товару перед видаленням.';
        rowStatus.dataset.tone = 'error';
      }
      return;
    }
  }

  const { error } = await supabase.from('product_catalog_items').delete().eq('product_id', productId);
  if (error) {
    console.error('Failed to delete catalog product', error);
    deleteButton.disabled = false;
    if (rowStatus) {
      rowStatus.textContent = error.message || 'Не вдалося видалити товар.';
      rowStatus.dataset.tone = 'error';
    }
    return;
  }

  catalogAdminRows = catalogAdminRows.filter((item) => item.id !== productId);
  renderCatalogAdminList();
  catalogAdminHasUnsavedChanges = false;
  setCatalogAdminStatus(`Позицію «${row.name}» видалено.`, 'success');
};

const setSignedInState = (session) => {
  currentSession = session || null;
  const isSignedIn = Boolean(session?.user);
  if (dashboard) dashboard.hidden = !isSignedIn;
  if (authToggle) authToggle.hidden = isSignedIn;
  if (authForm) authForm.hidden = isSignedIn;
  if (authState) authState.hidden = !isSignedIn;
  if (userEmail) userEmail.textContent = session?.user?.email || '';
  if (!isSignedIn) {
    currentProfile = null;
    renderProfile(null);
    renderDiscountState(null);
    renderOrders([]);
    catalogAdminHasUnsavedChanges = false;
    hideCatalogAdmin();
  }
};

const loadDashboard = async (session) => {
  if (!supabase || !session?.user) return;

  const userId = session.user.id;

  const [{ data: profile, error: profileError }, { data: discountState, error: discountError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('customer_discount_state').select('*').eq('customer_id', userId).maybeSingle(),
    supabase
      .from('orders')
      .select('id, order_number, status, placed_at, total_amount, payment_method, payment_method_label, delivery_method, delivery_method_label, delivery_details, order_items(product_title, quantity, line_total)')
      .order('placed_at', { ascending: false }),
  ]);

  if (profileError || discountError || ordersError) {
    setAuthStatus('Не вдалося завантажити дані кабінету. Перевірте таблиці та RLS у Supabase.', 'error');
    return;
  }

  renderProfile(profile);
  renderDiscountState(discountState);
  renderOrders(orders || []);
};

const init = async () => {
  if (!isSupabaseConfigured || !supabase) {
    setAuthStatus('Supabase ще не налаштований у цьому проєкті.', 'error');
    return;
  }

  const hashParams = getHashAuthParams();
  const searchParams = new URLSearchParams(window.location.search || '');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const authCode = searchParams.get('code');

  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);
    if (error) {
      console.error('Failed to exchange recovery code for session', error);
    }
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) {
      console.error('Failed to restore recovery session from URL hash', error);
    }
  }

  const { data } = await supabase.auth.getSession();
  setSignedInState(data.session);
  if (data.session && hasRecoveryStateInUrl()) {
    setAuthMode('recovery');
    setAuthStatus('Створіть новий пароль для завершення відновлення.', 'neutral');
    return;
  }
  if (data.session) {
    await syncProfile(data.session);
    await loadDashboard(data.session);
    await loadCatalogAdmin(data.session);
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      setAuthMode('recovery');
      setAuthStatus('Створіть новий пароль для завершення відновлення.', 'neutral');
      return;
    }

    if (session && catalogAdminHasUnsavedChanges && event !== 'SIGNED_OUT') {
      // Do not rerender admin data while user is editing unsaved fields.
      currentSession = session || null;
      if (userEmail) userEmail.textContent = session?.user?.email || '';
      setCatalogAdminStatus('Є незбережені зміни. Дані не перезавантажуються, доки ви не натиснете "Зберегти" або "Оновити дані".', 'neutral');
      return;
    }

    if (event === 'TOKEN_REFRESHED') {
      // Keep auth session fresh without reloading admin UI to avoid wiping unsaved form edits.
      currentSession = session || null;
      if (userEmail) userEmail.textContent = session?.user?.email || '';
      return;
    }

    setSignedInState(session);
    if (session) {
      hideSecondaryAuthActions();
      await syncProfile(session);
      setAuthStatus('Вхід підтверджено.', 'success');
      await loadDashboard(session);
      await loadCatalogAdmin(session);
    }
  });
};

authModeTriggers.forEach((trigger) => {
  trigger.addEventListener('click', () => {
    setAuthStatus('', 'neutral');
    setAuthMode(trigger.dataset.authModeTrigger || 'login');
  });
});

passwordInput?.addEventListener('input', () => {
  renderPasswordChecks(passwordInput.value);
});

recoveryPasswordInput?.addEventListener('input', () => {
  renderPasswordChecks(recoveryPasswordInput.value);
});

forgotPasswordButton?.addEventListener('click', async () => {
  if (!supabase) return;

  const email = String(emailInput?.value || '').trim();
  if (!email) {
    setAuthStatus('Вкажіть email у формі, і ми надішлемо лист для відновлення пароля.', 'error');
    return;
  }

  setAuthStatus('Надсилаємо лист для відновлення пароля...', 'neutral');

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildEmailRedirectUrl(),
  });

  if (error) {
    setAuthStatus(error.message || 'Не вдалося надіслати лист для відновлення пароля.', 'error');
    return;
  }

  setAuthStatus('Лист для відновлення пароля надіслано. Перейдіть за посиланням у пошті.', 'success');
});

resendConfirmationButton?.addEventListener('click', async () => {
  if (!supabase || !pendingConfirmationEmail) return;

  setAuthStatus('Надсилаємо лист підтвердження повторно...', 'neutral');

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: pendingConfirmationEmail,
    options: {
      emailRedirectTo: buildEmailRedirectUrl(),
    },
  });

  if (error) {
    setAuthStatus(error.message || 'Не вдалося повторно надіслати лист підтвердження.', 'error');
    return;
  }

  setAuthStatus('Лист підтвердження повторно відправлено.', 'success');
});

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase) return;

  const formData = new FormData(authForm);
  const authMode = authForm.dataset.authMode || 'login';
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const recoveryPassword = String(formData.get('recoveryPassword') || '');
  if (!email && authMode !== 'recovery') {
    setAuthStatus('Вкажіть email для входу.', 'error');
    return;
  }

  if (authMode === 'login') {
    if (!password) {
      setAuthStatus('Вкажіть пароль для входу.', 'error');
      return;
    }

    setAuthStatus('Виконуємо вхід...', 'neutral');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (isEmailConfirmationError(error)) {
        showConfirmationResend(email);
        setAuthStatus('Email ще не підтверджено. Перейдіть за посиланням у листі або надішліть його повторно.', 'error');
        return;
      }

      setAuthStatus(error.message || 'Не вдалося увійти в кабінет.', 'error');
      return;
    }

    authForm.reset();
    hideSecondaryAuthActions();
    setSignedInState(data.session);
    await syncProfile(data.session);
    setAuthStatus('Вхід виконано.', 'success');
    await loadDashboard(data.session);
    return;
  }

  if (authMode === 'register') {
    const fullName = String(formData.get('fullName') || '').trim();
    const checks = renderPasswordChecks(password);

    if (!isPasswordValid(checks)) {
      setAuthStatus('Пароль не відповідає вимогам для реєстрації.', 'error');
      return;
    }

    setAuthStatus('Створюємо акаунт...', 'neutral');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildEmailRedirectUrl(),
        data: fullName ? { full_name: fullName } : undefined,
      },
    });

    if (error) {
      setAuthStatus(error.message || 'Не вдалося створити акаунт.', 'error');
      return;
    }

    authForm.reset();
    renderPasswordChecks('');

    if (data.session) {
      setSignedInState(data.session);
      await syncProfile(data.session, fullName);
      setAuthStatus('Акаунт створено, ви вже увійшли.', 'success');
      await loadDashboard(data.session);
      return;
    }

    showConfirmationResend(email);
    setAuthStatus('Акаунт створено. Підтвердьте email, а потім увійдіть у кабінет.', 'success');
    return;
  }

  if (authMode === 'recovery') {
    if (!currentSession?.user) {
      setAuthStatus('Сесія відновлення не знайдена. Відкрийте посилання з листа ще раз.', 'error');
      return;
    }

    const checks = renderPasswordChecks(recoveryPassword);

    if (!isPasswordValid(checks)) {
      setAuthStatus('Новий пароль не відповідає вимогам безпеки.', 'error');
      return;
    }

    setAuthStatus('Оновлюємо пароль...', 'neutral');

    const { error } = await supabase.auth.updateUser({
      password: recoveryPassword,
    });

    if (error) {
      setAuthStatus(error.message || 'Не вдалося змінити пароль. Спробуйте ще раз за посиланням з листа.', 'error');
      return;
    }

    authForm.reset();
    renderPasswordChecks('');
    setAuthMode('login');
    if (window.location.hash) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setAuthStatus('Пароль змінено. Тепер увійдіть з новим паролем.', 'success');
    return;
  }
});

signOutButton?.addEventListener('click', async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  setAuthStatus('Ви вийшли з кабінету.', 'neutral');
});

catalogAdminSearch?.addEventListener('input', () => {
  renderCatalogAdminList();
});

catalogAdminFilter?.addEventListener('change', () => {
  renderCatalogAdminList();
});

catalogAdminRefresh?.addEventListener('click', async () => {
  if (!currentSession) return;
  await loadCatalogAdmin(currentSession);
});

catalogAdminCreateForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await createCatalogProduct(catalogAdminCreateForm);
});

if (catalogAdminCreateForm) {
  applyCreateFormCategory(catalogAdminCreateForm);

  catalogAdminCreateForm.querySelector('select[name="category"]')?.addEventListener('change', () => {
    applyCreateFormCategory(catalogAdminCreateForm);
  });

  catalogAdminCreateForm.addEventListener('click', handleNonCoffeeRowClick);
  hydrateImagePickers(catalogAdminCreateForm);
}

catalogAdminList?.addEventListener('click', handleNonCoffeeRowClick);

catalogAdminList?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const templateButton = target.closest('[data-catalog-template]');
  if (templateButton instanceof HTMLButtonElement) {
    const card = templateButton.closest('.catalog-admin-card');
    applyCatalogCardTemplate(card, templateButton.dataset.catalogTemplate || '');
    return;
  }

  const saveButton = target.closest('[data-catalog-save]');
  if (saveButton instanceof HTMLButtonElement) {
    const card = saveButton.closest('.catalog-admin-card');
    if (!(card instanceof HTMLElement)) return;

    await saveCatalogRow(card);
    return;
  }

  const deleteButton = target.closest('[data-catalog-delete]');
  if (!(deleteButton instanceof HTMLButtonElement)) return;

  const card = deleteButton.closest('.catalog-admin-card');
  if (!(card instanceof HTMLElement)) return;

  await deleteCatalogRow(card);
});

catalogAdminList?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const addColorBtn = target.closest('[data-catalog-add-color]');
  if (addColorBtn instanceof HTMLButtonElement) {
    event.preventDefault();
    const card = addColorBtn.closest('.catalog-admin-card');
    if (!card) return;

    const container = card.querySelector('[data-catalog-colors-container]');
    if (!container) return;

    const nextIdx = container.querySelectorAll('[data-catalog-color-item]').length;
    const colorItem = document.createElement('div');
    colorItem.className = 'catalog-admin-color-item';
    colorItem.dataset.catalogColorItem = String(nextIdx);
    colorItem.innerHTML = `
      <div class="catalog-admin-text-grid">
        <label class="catalog-admin-field">
          <span>Назва кольору</span>
          <input type="text" class="catalog-color-name" placeholder="Наприклад: Чорна обпалювання">
        </label>
        <label class="catalog-admin-field">
          <span>Опис кольору</span>
          <input type="text" class="catalog-color-description" placeholder="Наприклад: Темна, інтенсивна">
        </label>
        <div class="catalog-admin-field catalog-admin-field-wide">
          <span>Фото кольору</span>
          ${buildImagePickerMarkup({ inputAttrs: 'class="catalog-color-image"' })}
        </div>
        <button type="button" class="btn ghost remove-color" title="Видалити цей колір">✕ Видалити</button>
      </div>
    `;
    container.appendChild(colorItem);
    hydrateImagePickers(colorItem);
    catalogAdminHasUnsavedChanges = true;
    return;
  }

  const removeColorBtn = target.closest('.remove-color');
  if (removeColorBtn instanceof HTMLButtonElement) {
    event.preventDefault();
    const colorItem = removeColorBtn.closest('[data-catalog-color-item]');
    if (colorItem instanceof HTMLElement) {
      colorItem.remove();
      catalogAdminHasUnsavedChanges = true;
    }
    return;
  }

  const addGradationBtn = target.closest('[data-catalog-add-gradation]');
  if (addGradationBtn instanceof HTMLButtonElement) {
    event.preventDefault();
    const card = addGradationBtn.closest('.catalog-admin-card');
    if (!card) return;

    const container = card.querySelector('[data-catalog-gradations-container]');
    if (!container) return;

    const nextIdx = container.querySelectorAll('[data-catalog-gradation-item]').length;
    const gradationItem = document.createElement('div');
    gradationItem.className = 'catalog-admin-gradation-item';
    gradationItem.dataset.catalogGradationItem = String(nextIdx);
    gradationItem.innerHTML = `
      <div class="catalog-admin-text-grid">
        <label class="catalog-admin-field">
          <span>Назва градації (розмір/тип)</span>
          <input type="text" class="catalog-gradation-name" placeholder="Наприклад: Чорна L">
        </label>
        <label class="catalog-admin-field">
          <span>Опис</span>
          <input type="text" class="catalog-gradation-description" placeholder="Наприклад: Великий розмір">
        </label>
        <label class="catalog-admin-field">
          <span>Ціна, грн</span>
          <input type="number" min="0" step="0.01" class="catalog-gradation-price" placeholder="Наприклад: 150">
        </label>
        <label class="catalog-admin-field">
          <span>SKU (артикул)</span>
          <input type="text" class="catalog-gradation-sku" placeholder="Наприклад: ACC-BLK-L-001">
        </label>
        <button type="button" class="btn ghost remove-gradation" title="Видалити цю градацію">✕ Видалити</button>
      </div>
    `;
    container.appendChild(gradationItem);
    catalogAdminHasUnsavedChanges = true;
    return;
  }

  const removeGradationBtn = target.closest('.remove-gradation');
  if (removeGradationBtn instanceof HTMLButtonElement) {
    event.preventDefault();
    const gradationItem = removeGradationBtn.closest('[data-catalog-gradation-item]');
    if (gradationItem instanceof HTMLElement) {
      gradationItem.remove();
      catalogAdminHasUnsavedChanges = true;
    }
    return;
  }
});

catalogAdminList?.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLSelectElement)) return;

  const card = target.closest('.catalog-admin-card');
  if (!card) return;

  if (target.closest('[data-noncoffee-card]')) {
    catalogAdminHasUnsavedChanges = true;
    return;
  }

  if (target.matches('[data-catalog-field-search]')) {
    filterCatalogCardFields(card, target.value);
    return;
  }

  if (target.matches('[data-catalog-text-field]') || target.matches('[data-catalog-price-field]')) {
    const wrapper = target.closest('[data-catalog-field-wrapper]');
    if (wrapper instanceof HTMLElement) {
      wrapper.dataset.catalogFieldValue = target.value;
    }

    const searchInput = card.querySelector('[data-catalog-field-search]');
    if (searchInput instanceof HTMLInputElement) {
      filterCatalogCardFields(card, searchInput.value);
    }

    catalogAdminHasUnsavedChanges = true;
    return;
  }

  if (target.matches('[data-catalog-availability]') || target.matches('[data-catalog-stock]')) {
    catalogAdminHasUnsavedChanges = true;
  }
});

catalogAdminList?.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;

  if (target.matches('[data-card-field="category"]')) {
    const slot = target.closest('[data-noncoffee-card]')?.querySelector('[data-noncoffee-slot]');
    const currentRoot = slot?.querySelector('[data-noncoffee-fields]');
    if (slot instanceof HTMLElement && currentRoot instanceof HTMLElement && currentRoot.dataset.noncoffeeGroup !== target.value) {
      mountNonCoffeeFields(slot, target.value, collectNonCoffeeDraft(currentRoot));
    }
    catalogAdminHasUnsavedChanges = true;
    return;
  }

  if (!target.matches('[data-catalog-text-field]')) return;

  const card = target.closest('.catalog-admin-card');
  if (!card) return;

  const wrapper = target.closest('[data-catalog-field-wrapper]');
  if (wrapper instanceof HTMLElement) {
    wrapper.dataset.catalogFieldValue = target.value;
  }

  const searchInput = card.querySelector('[data-catalog-field-search]');
  if (searchInput instanceof HTMLInputElement) {
    filterCatalogCardFields(card, searchInput.value);
  }

  if (target.getAttribute('data-catalog-text-field') === 'category') {
    const accessoriesSection = card.querySelector('[data-catalog-accessories-section]');
    if (accessoriesSection instanceof HTMLElement) {
      if (target.value === 'accessories') {
        accessoriesSection.hidden = false;
      } else {
        accessoriesSection.hidden = true;
      }
    }
  }

  catalogAdminHasUnsavedChanges = true;
});

profileList?.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'account-profile-form') return;
  event.preventDefault();
  await saveProfile(form);
});

setAuthMode(getInitialAuthMode());
init();