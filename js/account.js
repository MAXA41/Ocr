import { supabase, isSupabaseConfigured } from './supabase-client.js';

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
const authSecondary = document.querySelector('#account-auth-secondary');
const confirmationHint = document.querySelector('#account-confirmation-hint');
const resendConfirmationButton = document.querySelector('#account-resend-confirmation');
const authNameField = document.querySelector('[data-auth-name-field]');
const authPasswordField = document.querySelector('[data-auth-password-field]');
const authConfirmField = document.querySelector('[data-auth-confirm-field]');
const passwordRules = document.querySelector('#account-password-rules');
const passwordRuleItems = document.querySelectorAll('[data-password-rule]');
const userEmail = document.querySelector('#account-user-email');
const signOutButton = document.querySelector('#account-signout');
const dashboard = document.querySelector('#account-dashboard');
const profileList = document.querySelector('#account-profile-list');
const discountCard = document.querySelector('#account-discount-card');
const ordersRoot = document.querySelector('#account-orders');
const fullNameInput = authForm?.querySelector('input[name="fullName"]') || null;
const passwordInput = authForm?.querySelector('input[name="password"]') || null;
const passwordConfirmInput = authForm?.querySelector('input[name="passwordConfirm"]') || null;
let pendingConfirmationEmail = '';

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

const buildEmailRedirectUrl = () => {
  const configuredUrl = String(import.meta.env.VITE_AUTH_REDIRECT_URL || '').trim();
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
  if (authNameField) authNameField.hidden = !isRegisterMode;
  if (authPasswordField) authPasswordField.hidden = !(isLoginMode || isRegisterMode);
  if (authConfirmField) authConfirmField.hidden = !isRegisterMode;
  if (passwordRules) passwordRules.hidden = !isRegisterMode;
  if (passwordInput) {
    passwordInput.required = isLoginMode || isRegisterMode;
    passwordInput.autocomplete = isRegisterMode ? 'new-password' : 'current-password';
  }
  if (passwordConfirmInput) passwordConfirmInput.required = isRegisterMode;
  hideSecondaryAuthActions();

  if (!isRegisterMode) {
    if (passwordConfirmInput) passwordConfirmInput.value = '';
    renderPasswordChecks('');
  }
};

const renderProfile = (profile) => {
  if (!profileList) return;

  const items = [
    ['Email', profile?.email || 'Не вказано'],
    ['Імʼя', profile?.full_name || 'Не вказано'],
    ['Телефон', profile?.phone || 'Не вказано'],
    ['Місто', profile?.default_city || 'Не вказано'],
    ['Доставка', profile?.default_delivery_method || 'Не вказано'],
    ['Деталі доставки', profile?.default_delivery_details || 'Не вказано'],
  ];

  profileList.innerHTML = items
    .map(([label, value]) => `
      <div class="account-stat-row">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>`)
    .join('');
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

const setSignedInState = (session) => {
  const isSignedIn = Boolean(session?.user);
  if (dashboard) dashboard.hidden = !isSignedIn;
  if (authForm) authForm.hidden = isSignedIn;
  if (authState) authState.hidden = !isSignedIn;
  if (userEmail) userEmail.textContent = session?.user?.email || '';
  if (!isSignedIn) {
    renderProfile(null);
    renderDiscountState(null);
    renderOrders([]);
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

  const { data } = await supabase.auth.getSession();
  setSignedInState(data.session);
  if (data.session) {
    await syncProfile(data.session);
    await loadDashboard(data.session);
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    setSignedInState(session);
    if (session) {
      hideSecondaryAuthActions();
      await syncProfile(session);
      setAuthStatus('Вхід підтверджено.', 'success');
      await loadDashboard(session);
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
  if (!email) {
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
    const passwordConfirm = String(formData.get('passwordConfirm') || '');
    const checks = renderPasswordChecks(password);

    if (!isPasswordValid(checks)) {
      setAuthStatus('Пароль не відповідає вимогам для реєстрації.', 'error');
      return;
    }

    if (password !== passwordConfirm) {
      setAuthStatus('Паролі не збігаються.', 'error');
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
});

signOutButton?.addEventListener('click', async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  setAuthStatus('Ви вийшли з кабінету.', 'neutral');
});

setAuthMode('login');
init();