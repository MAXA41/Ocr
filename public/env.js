window.__OCR_ENV__ = {
  VITE_ORDER_PROVIDER: 'web3forms',
  VITE_WEB3FORMS_ACCESS_KEY: '',
  VITE_ORDER_FALLBACK_WEBHOOK_URL: 'https://be2791f2b6ccf4.lhr.life/webhook/ocr-orders-supabase',
  VITE_ORDER_DUPLICATE_TO_WEBHOOK: 'true',
  VITE_ORDER_WEBHOOK_SHARED_SECRET: 'ocr_4f9b8d2c7a1e63f0c5b9a472de18f6c3a9e54b7d1c8f20ea6b3d91f472ac58e1',
  VITE_NOVA_POSHTA_API_KEY: '5d7e7680adca1bbc14e0f9e9ef86b750',
  VITE_SUPABASE_URL: 'https://sxxlotfbcblnjgcvxaqe.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_6Sqqk08Zt_txQFQJeacUhg_OPTpNLxf',
  VITE_AUTH_REDIRECT_URL: 'https://odesacoffeeroasters.info/account.html',
};

window.__OCR_CONFIG__ = {
  ...window.__OCR_CONFIG__,
  supabaseUrl: window.__OCR_ENV__.VITE_SUPABASE_URL,
  supabasePublishableKey: window.__OCR_ENV__.VITE_SUPABASE_PUBLISHABLE_KEY,
  authRedirectUrl: window.__OCR_ENV__.VITE_AUTH_REDIRECT_URL,
};
