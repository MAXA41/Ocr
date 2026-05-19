import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { loadLocalEnv } from './lib/local-env.mjs';
const HOST_PATTERN = /https:\/\/([a-z0-9]+\.lhr\.life)/ig;

function getConfig() {
  const merged = loadLocalEnv();
  const token = merged.N8N_TELEGRAM_BOT_TOKEN || merged.TELEGRAM_BOT_TOKEN || '';
  const webhookPath = merged.N8N_TELEGRAM_ADMIN_WEBHOOK_PATH || 'ocr-telegram-admin';

  if (!token) {
    throw new Error('Missing N8N_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN in environment or .env.local');
  }

  return { token, webhookPath };
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

async function probeHost(host, webhookPath) {
  const rootUrl = `https://${host}/`;
  const webhookUrl = `https://${host}/webhook/${webhookPath}`;

  const rootResponse = await fetch(rootUrl, { method: 'HEAD' });
  if (!rootResponse.ok) {
    throw new Error(`Root probe failed with ${rootResponse.status}`);
  }

  const webhookResponse = await fetch(webhookUrl, { method: 'GET' });
  if (webhookResponse.status !== 404) {
    throw new Error(`Webhook probe expected 404, got ${webhookResponse.status}`);
  }

  return `https://${host}`;
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

async function main() {
  const { token, webhookPath } = getConfig();
  const seenHosts = new Set();
  let activeHost = '';
  let bindingInFlight = false;

  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-R', '80:127.0.0.1:5678',
    'nokey@localhost.run',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const handleLine = async (line) => {
    if (!line) return;
    console.log(line);

    const matches = [...line.matchAll(HOST_PATTERN)].map((match) => match[1]);
    for (const host of matches) {
      if (seenHosts.has(host) || bindingInFlight) continue;
      seenHosts.add(host);
      bindingInFlight = true;

      try {
        const baseUrl = await probeHost(host, webhookPath);
        if (baseUrl !== activeHost) {
          activeHost = baseUrl;
          await bindWebhook(token, webhookPath, baseUrl);
        }
      } catch (error) {
        console.error(`[telegram-tunnel] skip ${host}: ${error.message}`);
      } finally {
        bindingInFlight = false;
      }
    }
  };

  const stdoutReader = readline.createInterface({ input: ssh.stdout });
  const stderrReader = readline.createInterface({ input: ssh.stderr });
  stdoutReader.on('line', (line) => { void handleLine(line); });
  stderrReader.on('line', (line) => { void handleLine(line); });

  ssh.on('exit', (code) => {
    console.error(`[telegram-tunnel] localhost.run exited with code ${code ?? 0}`);
    process.exit(code ?? 1);
  });

  process.on('SIGINT', () => ssh.kill('SIGINT'));
  process.on('SIGTERM', () => ssh.kill('SIGTERM'));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});