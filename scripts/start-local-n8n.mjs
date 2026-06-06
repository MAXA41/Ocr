import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { loadLocalEnv } from './lib/local-env.mjs';

function getN8nCommand() {
  const candidates = [
    path.resolve('.tools/n8n-runtime-1x/node_modules/.bin/n8n.cmd'),
    path.resolve('.tools/n8n-runtime-1x/node_modules/.bin/n8n'),
    path.resolve('.tools/n8n-runtime/node_modules/.bin/n8n.cmd'),
    path.resolve('.tools/n8n-runtime/node_modules/.bin/n8n'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { command: candidate, args: ['start'] };
    }
  }

  return { command: 'npx', args: ['--yes', 'n8n', 'start'] };
}

async function main() {
  const localEnv = loadLocalEnv();
  const n8nCommand = getN8nCommand();
  const child = spawn(n8nCommand.command, n8nCommand.args, {
    shell: true,
    stdio: 'inherit',
    env: {
      ...localEnv,
      N8N_USER_FOLDER: path.resolve('.n8n-local'),
      N8N_SECURE_COOKIE: 'false',
    },
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});