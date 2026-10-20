import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import localtunnel from 'localtunnel';
import { loadLocalEnv } from './lib/local-env.mjs';

const defaultPublicBaseUrl = 'https://n8n.odesacoffeeroasters.info';

function getConfig() {
  const merged = loadLocalEnv();
  const token = merged.N8N_TELEGRAM_BOT_TOKEN || merged.TELEGRAM_BOT_TOKEN || '';
  const webhookPath = merged.N8N_TELEGRAM_ADMIN_WEBHOOK_PATH || 'ocr-telegram-admin';
  const publicBaseUrl = String(merged.N8N_PUBLIC_BASE_URL || defaultPublicBaseUrl).trim().replace(/\/$/, '');
  const cloudflareTunnelToken = String(merged.CLOUDFLARED_TUNNEL_TOKEN || '').trim();

  if (!token) {
    throw new Error('Missing N8N_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN in environment or .env.local');
  }

  return {
    token,
    webhookPath,
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

async function probeBaseUrl(baseUrl) {
  const requestHeaders = { 'bypass-tunnel-reminder': 'true' };
  const response = await fetch(`${baseUrl}/healthz`, {
    method: 'GET',
    headers: requestHeaders,
  });

  if (!response.ok) {
    throw new Error(`n8n health check failed with ${response.status}`);
  }

  return baseUrl;
}

async function waitForBaseUrl(baseUrl, attempts = 20, delayMs = 3000) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await probeBaseUrl(baseUrl);
    } catch (error) {
      lastError = error;
      console.log(`[telegram-tunnel] waiting for tunnel (${attempt}/${attempts}) -> ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
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
  const installedBinary =
    process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || '', 'cloudflared', 'cloudflared.exe')
      : '';
  const useInstalledBinary = Boolean(installedBinary) && existsSync(installedBinary);
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const command = useInstalledBinary ? installedBinary : npxCommand;
  const args = [
    ...(useInstalledBinary ? [] : ['--yes', 'cloudflared']),
    'tunnel',
    '--no-autoupdate',
    'run',
    '--token',
    token,
  ];
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: !useInstalledBinary && process.platform === 'win32',
  });

  return child;
}

async function runWithCloudflareNamedTunnel({ token, webhookPath, publicBaseUrl, cloudflareTunnelToken }) {
  if (!publicBaseUrl) {
    throw new Error('Missing N8N_PUBLIC_BASE_URL for stable cloudflared mode');
  }

  const child = startCloudflareNamedTunnel(cloudflareTunnelToken);
  const activeHost = await waitForBaseUrl(publicBaseUrl);

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

async function runWithLocalTunnel({ token, webhookPath }) {
  const tunnel = await localtunnel({
    port: 5678,
    host: 'https://loca.lt',
  });
  const activeHost = await probeBaseUrl(tunnel.url);

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