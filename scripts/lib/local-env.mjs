import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DEFAULT_ENV_PATH = path.resolve('.env.local');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const values = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) continue;

    values[key] = value;
  }

  return values;
}

function readWindowsUserEnv() {
  if (process.platform !== 'win32') return {};

  try {
    const output = execFileSync('reg', ['query', 'HKCU\\Environment'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const values = {};
    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('HKEY_')) continue;

      const match = line.match(/^([^\s]+)\s+REG_\w+\s+(.*)$/);
      if (!match) continue;

      const [, key, value] = match;
      values[key] = value;
    }

    return values;
  } catch {
    return {};
  }
}

export function loadLocalEnv(filePath = DEFAULT_ENV_PATH) {
  const fileEnv = readEnvFile(filePath);
  const userEnv = readWindowsUserEnv();

  return {
    ...fileEnv,
    ...userEnv,
    ...process.env,
  };
}