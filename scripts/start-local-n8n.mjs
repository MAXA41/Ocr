import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadLocalEnv } from './lib/local-env.mjs';

async function main() {
  const localEnv = loadLocalEnv();
  const child = spawn('npx', ['--yes', 'n8n', 'start'], {
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