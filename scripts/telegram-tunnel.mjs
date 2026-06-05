import { spawn } from 'node:child_process';
import localtunnel from 'localtunnel';
import { loadLocalEnv } from './lib/local-env.mjs';

function getConfig() {
  const merged = loadLocalEnv();
  const token = merged.N8N_TELEGRAM_BOT_TOKEN || merged.TELEGRAM_BOT_TOKEN || '';
  const webhookPath = merged.N8N_TELEGRAM_ADMIN_WEBHOOK_PATH || 'ocr-telegram-admin';
  const orderWebhookPath = merged.N8N_ORDER_WEBHOOK_PATH || 'ocr-orders-supabase';
  const publicBaseUrl = String(merged.N8N_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  const cloudflareTunnelToken = String(merged.CLOUDFLARED_TUNNEL_TOKEN || '').trim();

  if (!token) {
    throw new Error('Missing N8N_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN in environment or .env.local');
  }

  return {
    token,
    webhookPath,
    orderWebhookPath,
    publicBaseUrl,
    cloudflareTunnelToken,
  };
}

async function callTelegram(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  if (!response.ok || json.ok === false) {
    throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  }

  return json;
}

async function probeBaseUrl(baseUrl, webhookPath, orderWebhookPath) {
  const requestHeaders = { 'bypass-tunnel-reminder': 'true' };
  const adminWebhookUrl = `${baseUrl}/webhook/${webhookPath}`;
  const orderWebhookUrl = `${baseUrl}/webhook/${orderWebhookPath}`;

  const adminResponse = await fetch(adminWebhookUrl, {
    method: 'GET',
    headers: requestHeaders,
  });

  if (![200, 400, 404, 405].includes(adminResponse.status)) {
    throw new Error(`Admin webhook probe failed with ${adminResponse.status}`);
  }

  const orderResponse = await fetch(orderWebhookUrl, {
    method: 'GET',
    headers: requestHeaders,
  });

  if (![200, 400, 404, 405].includes(orderResponse.status)) {
    throw new Error(`Order webhook probe failed with ${orderResponse.status}`);
  }

  return baseUrl;
}

async function bindWebhook(token, webhookPath, baseUrl) {
  const webhookUrl = `${baseUrl}/webhook/${webhookPath}`;
  const result = await callTelegram(token, 'setWebhook', {
    url: webhookUrl,
    drop_pending_updates: true,
  });
  console.log(`[telegram-tunnel] webhook -> ${webhookUrl}`);
  console.log(JSON.stringify(result, null, 2));
}

function startCloudflareNamedTunnel(token) {
  const child = spawn('npx', [
    '--yes',
    'cloudflared',
    'tunnel',
    '--no-autoupdate',
    'run',
    '--token',
    token,
  ], {
    stdio: 'inherit',
  });

  return child;
}

async function runWithCloudflareNamedTunnel({ token, webhookPath, orderWebhookPath, publicBaseUrl, cloudflareTunnelToken }) {
  if (!publicBaseUrl) {
    throw new Error('Missing N8N_PUBLIC_BASE_URL for stable cloudflared mode');
  }

  const child = startCloudflareNamedTunnel(cloudflareTunnelToken);
  const activeHost = await probeBaseUrl(publicBaseUrl, webhookPath, orderWebhookPath);

  console.log(`[telegram-tunnel] public url -> ${activeHost}`);
  await bindWebhook(token, webhookPath, activeHost);

  await new Promise((resolve, reject) => {
    const closeTunnel = () => child.kill('SIGTERM');

    child.on('exit', (code) => {
      if (code === 0 || code === null) {
        resolve();
        return;
      }

      reject(new Error(`[telegram-tunnel] cloudflared exited with code ${code}`));
    });

    process.on('SIGINT', closeTunnel);
    process.on('SIGTERM', closeTunnel);
  });
}

async function runWithLocalTunnel({ token, webhookPath, orderWebhookPath }) {
  const tunnel = await localtunnel({
    port: 5678,
    host: 'https://loca.lt',
  });
  const activeHost = await probeBaseUrl(tunnel.url, webhookPath, orderWebhookPath);

  console.log(`[telegram-tunnel] public url -> ${activeHost}`);
  await bindWebhook(token, webhookPath, activeHost);

  tunnel.on('request', (info) => {
    if (!info?.path) return;
    console.log(`[telegram-tunnel] ${info.method || 'GET'} ${info.path}`);
  });

  await new Promise((resolve, reject) => {
    let closed = false;

    const closeTunnel = () => {
      if (closed) return;
      closed = true;
      tunnel.close();
    };

    tunnel.on('close', () => {
      console.error('[telegram-tunnel] localtunnel closed');
      resolve();
    });

    tunnel.on('error', (error) => {
      reject(error);
    });

    process.on('SIGINT', closeTunnel);
    process.on('SIGTERM', closeTunnel);
  });
}

async function main() {
  const config = getConfig();

  if (config.cloudflareTunnelToken) {
    console.log('[telegram-tunnel] mode -> cloudflared named tunnel');
    await runWithCloudflareNamedTunnel(config);
    return;
  }

  console.log('[telegram-tunnel] mode -> localtunnel fallback');
  await runWithLocalTunnel(config);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});