import { loadLocalEnv } from './lib/local-env.mjs';

function getConfig() {
  const merged = loadLocalEnv();
  const token = merged.N8N_TELEGRAM_BOT_TOKEN || merged.TELEGRAM_BOT_TOKEN || '';
  const webhookPath = merged.N8N_TELEGRAM_ADMIN_WEBHOOK_PATH || 'ocr-telegram-admin';

  if (!token) {
    throw new Error('Missing N8N_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN in environment or .env.local');
  }

  return {
    token,
    webhookPath,
  };
}

function buildWebhookUrl(inputUrl, webhookPath) {
  const parsed = new URL(inputUrl);
  if (parsed.pathname.includes('/webhook/')) {
    return parsed.toString();
  }

  const normalizedPath = parsed.pathname.replace(/\/$/, '');
  parsed.pathname = `${normalizedPath}/webhook/${webhookPath}`.replace(/\/\//g, '/');
  return parsed.toString();
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

function printUsage() {
  console.log([
    'Usage:',
    '  node scripts/telegram-webhook.mjs info',
    '  node scripts/telegram-webhook.mjs set <base-url-or-webhook-url>',
    '  node scripts/telegram-webhook.mjs delete',
  ].join('\n'));
}

async function main() {
  const [command, inputUrl] = process.argv.slice(2);
  if (!command) {
    printUsage();
    process.exit(1);
  }

  const { token, webhookPath } = getConfig();

  if (command === 'info') {
    const result = await callTelegram(token, 'getWebhookInfo', {});
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'delete') {
    const result = await callTelegram(token, 'deleteWebhook', { drop_pending_updates: true });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'set') {
    if (!inputUrl) {
      throw new Error('Missing URL for set command');
    }

    const webhookUrl = buildWebhookUrl(inputUrl, webhookPath);
    const result = await callTelegram(token, 'setWebhook', {
      url: webhookUrl,
      drop_pending_updates: true,
    });

    console.log(JSON.stringify({ webhookUrl, ...result }, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});