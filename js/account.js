import { supabase, isSupabaseConfigured } from './supabase-client.js?v=2';
import { normalizeCatalogState } from './catalog-state.js';

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
const fullNameInput = authForm?.querySelector('input[name="fullName"]') || null;
const passwordInput = authForm?.querySelector('input[name="password"]') || null;
const recoveryPasswordInput = authForm?.querySelector('input[name="recoveryPassword"]') || null;
const emailInput = authForm?.querySelector('input[name="email"]') || null;
let pendingConfirmationEmail = '';
let currentSession = null;
let currentProfile = null;
let catalogAdminRows = [];
const editableCatalogTextFields = ['name', 'description', 'origin', 'processing', 'alt', 'weight', 'taste', 'cup_profile', 'brew_guide', 'audience'];
const catalogTextFieldColumnMap = {
  name: 'name_override',
  description: 'description_override',
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
};

const catalogCategoryOrder = ['espresso', 'filter', 'drips', 'decaf'];

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

const buildCatalogAdminRows = (products, stateRows) => {
  const stateById = new Map((stateRows || []).map((row) => [row.product_id, normalizeCatalogState(row)]));
  const textOverridesById = new Map((stateRows?.textOverrides || []).map((row) => [row.product_id, row]));

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

    return {
      ...textAdjustedProduct,
      state,
      availableNow,
      baseText,
      textOverrides,
    };
  });
};

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

            return `
              <details class="catalog-admin-card" data-product-id="${row.id}" data-tone="${tone}">
                <summary class="catalog-admin-card-summary">
                  <div class="catalog-admin-summary">
                    <div class="catalog-admin-media">
                      <img src="${row.image}" alt="${row.alt}">
                    </div>
                    <div class="catalog-admin-copy">
                      <p class="eyebrow">${row.category || 'Каталог'}</p>
                      <h3>${row.name}</h3>
                      <p>${row.description}</p>
                      <div class="product-meta">
                        ${row.origin ? `<span>${row.origin}</span>` : ''}
                        ${row.processing ? `<span>${row.processing}</span>` : ''}
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
                </summary>
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
                    <label class="catalog-admin-toggle">
                      <input type="checkbox" data-catalog-availability ${row.state.isAvailable ? 'checked' : ''}>
                      <span>Показувати в продажу</span>
                    </label>
                    <label class="catalog-admin-field">
                      <span>Заведено на склад, шт.</span>
                      <input type="number" min="0" step="1" value="${stockValue}" data-catalog-stock placeholder="Порожньо = без ліміту">
                    </label>
                    <div class="catalog-admin-text-grid">
                      <label class="catalog-admin-field">
                        <span>Назва картки</span>
                        <input type="text" data-catalog-text-field="name" value="${escapeHtml(row.name)}">
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide">
                        <span>Опис картки</span>
                        <textarea rows="3" data-catalog-text-field="description">${escapeHtml(row.description || '')}</textarea>
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide">
                        <span>Смак</span>
                        <textarea rows="2" data-catalog-text-field="taste" placeholder="Що відчувається в ароматиці та післясмаку">${escapeHtml(flavorHint)}</textarea>
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide">
                        <span>Що в чашці</span>
                        <textarea rows="2" data-catalog-text-field="cup_profile" placeholder="Щільність, кислотність, солодкість, тіло">${escapeHtml(cupHint)}</textarea>
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide">
                        <span>Як заварювати</span>
                        <textarea rows="3" data-catalog-text-field="brew_guide" placeholder="Рецепт, температура, помел, пропорції">${escapeHtml(brewHint)}</textarea>
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide">
                        <span>Кому підійде</span>
                        <textarea rows="2" data-catalog-text-field="audience" placeholder="Для кого цей лот">${escapeHtml(audienceHint)}</textarea>
                      </label>
                      <label class="catalog-admin-field">
                        <span>Походження</span>
                        <input type="text" data-catalog-text-field="origin" value="${escapeHtml(row.origin || '')}">
                      </label>
                      <label class="catalog-admin-field">
                        <span>Обробка</span>
                        <input type="text" data-catalog-text-field="processing" value="${escapeHtml(row.processing || '')}">
                      </label>
                      <label class="catalog-admin-field">
                        <span>Вага</span>
                        <input type="text" data-catalog-text-field="weight" value="${escapeHtml(row.weight || '')}">
                      </label>
                      <label class="catalog-admin-field catalog-admin-field-wide">
                        <span>Alt для фото</span>
                        <textarea rows="2" data-catalog-text-field="alt">${escapeHtml(row.alt || '')}</textarea>
                      </label>
                    </div>
                    <button class="btn light" type="button" data-catalog-save>Зберегти</button>
                  </div>
                  <p class="form-status" data-catalog-row-status></p>
                </div>
              </details>`;
          }).join('')}
        </div>
      </details>`;
  }).join('');
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

  const [products, stateResponse, textOverrideResponse] = await Promise.all([
    fetch('products.json').then((response) => response.json()),
    supabase
      .from('product_catalog_state')
      .select('product_id, is_available, stock_quantity, sold_quantity, updated_at')
      .order('product_id', { ascending: true }),
    supabase
      .from('product_text_overrides')
      .select('product_id, name_override, description_override, origin_override, processing_override, alt_override, weight_override, taste_override, cup_profile_override, brew_guide_override, audience_override, is_active, updated_at')
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

  const stateWithTextRows = stateResponse.data || [];
  stateWithTextRows.textOverrides = textOverrideRows;
  catalogAdminRows = buildCatalogAdminRows(products, stateWithTextRows);
  renderCatalogAdminList();
  if (!textOverrideResponse.error) {
    setCatalogAdminStatus('Каталог готовий до редагування.', 'success');
  }
};

const saveCatalogRow = async (card) => {
  if (!supabase || !currentSession?.user || !card) return;

  const productId = card.dataset.productId;
  const availabilityField = card.querySelector('[data-catalog-availability]');
  const stockField = card.querySelector('[data-catalog-stock]');
  const rowStatus = card.querySelector('[data-catalog-row-status]');
  const saveButton = card.querySelector('[data-catalog-save]');
  const row = catalogAdminRows.find((item) => item.id === productId);

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
  const textPatch = {};

  textInputs.forEach((input) => {
    if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) return;
    const field = input.dataset.catalogTextField;
    if (!field || !editableCatalogTextFields.includes(field)) return;

    const nextValue = String(input.value ?? '').trim();
    const baseValue = String(row.baseText?.[field] ?? '').trim();
    const currentOverrideValue = String(row.textOverrides?.[field] ?? '').trim();

    if (nextValue !== baseValue) {
      textPatch[field] = nextValue;
    } else if (currentOverrideValue) {
      textPatch[field] = null;
    }
  });

  const textOverridePayload = {
    product_id: productId,
    is_active: Object.keys(textPatch).length > 0,
    updated_by: currentSession.user.id,
    name_override: null,
    description_override: null,
    origin_override: null,
    processing_override: null,
    alt_override: null,
    weight_override: null,
    taste_override: null,
    cup_profile_override: null,
    brew_guide_override: null,
    audience_override: null,
  };

  Object.entries(textPatch).forEach(([field, value]) => {
    const column = catalogTextFieldColumnMap[field];
    if (!column) return;
    textOverridePayload[column] = value;
  });

  const [{ data, error }, textSaveResult] = await Promise.all([
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

  const nextState = normalizeCatalogState(data || { product_id: productId, is_available: availabilityField.checked, stock_quantity: stockQuantity, sold_quantity: row.state.soldQuantity });
  catalogAdminRows = catalogAdminRows.map((item) => item.id === productId
    ? {
      ...item,
      ...item.baseText,
      ...textPatch,
      state: nextState,
      availableNow: nextState.stockQuantity === null ? null : Math.max(nextState.stockQuantity - nextState.soldQuantity, 0),
      textOverrides: { ...textPatch },
    }
    : item);

  renderCatalogAdminList();
  setCatalogAdminStatus(`Оновлено товар: ${row.name}.`, 'success');
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

catalogAdminList?.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const saveButton = target.closest('[data-catalog-save]');
  if (!(saveButton instanceof HTMLButtonElement)) return;

  const card = saveButton.closest('.catalog-admin-card');
  if (!(card instanceof HTMLElement)) return;

  await saveCatalogRow(card);
});

profileList?.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'account-profile-form') return;
  event.preventDefault();
  await saveProfile(form);
});

setAuthMode(getInitialAuthMode());
init();