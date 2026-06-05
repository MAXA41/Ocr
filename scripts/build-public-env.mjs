import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from './lib/local-env.mjs';

const outputPath = path.resolve('public/env.js');

function toJsString(value) {
  return JSON.stringify(String(value ?? ''));
}

function getPublicEnvValue(merged, key, fallback = '') {
  return String(merged[key] ?? fallback).trim();
}

function main() {
  const merged = loadLocalEnv();

  const publicEnv = {
    VITE_ORDER_PROVIDER: getPublicEnvValue(merged, 'VITE_ORDER_PROVIDER', 'web3forms'),
    VITE_WEB3FORMS_ACCESS_KEY: getPublicEnvValue(merged, 'VITE_WEB3FORMS_ACCESS_KEY'),
    VITE_ORDER_FALLBACK_WEBHOOK_URL: getPublicEnvValue(merged, 'VITE_ORDER_FALLBACK_WEBHOOK_URL'),
    VITE_ORDER_DUPLICATE_TO_WEBHOOK: getPublicEnvValue(merged, 'VITE_ORDER_DUPLICATE_TO_WEBHOOK', 'true'),
    VITE_ORDER_WEBHOOK_SHARED_SECRET: getPublicEnvValue(merged, 'VITE_ORDER_WEBHOOK_SHARED_SECRET'),
    VITE_NOVA_POSHTA_API_KEY: getPublicEnvValue(merged, 'VITE_NOVA_POSHTA_API_KEY'),
    VITE_SUPABASE_URL: getPublicEnvValue(merged, 'VITE_SUPABASE_URL'),
    VITE_SUPABASE_PUBLISHABLE_KEY: getPublicEnvValue(merged, 'VITE_SUPABASE_PUBLISHABLE_KEY'),
    VITE_AUTH_REDIRECT_URL: getPublicEnvValue(merged, 'VITE_AUTH_REDIRECT_URL'),
  };

  const contents = [
    'window.__OCR_ENV__ = {',
    ...Object.entries(publicEnv).map(([key, value]) => `  ${key}: ${toJsString(value)},`),
    '};',
    '',
    'window.__OCR_CONFIG__ = {',
    '  ...window.__OCR_CONFIG__,',
    '  supabaseUrl: window.__OCR_ENV__.VITE_SUPABASE_URL,',
    '  supabasePublishableKey: window.__OCR_ENV__.VITE_SUPABASE_PUBLISHABLE_KEY,',
    '  authRedirectUrl: window.__OCR_ENV__.VITE_AUTH_REDIRECT_URL,',
    '};',
    '',
  ].join('\n');

  fs.writeFileSync(outputPath, contents, 'utf8');
  console.log(`[build-public-env] wrote ${outputPath}`);
}

main();