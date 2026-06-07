import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadLocalEnv } from './lib/local-env.mjs';

const require = createRequire(import.meta.url);

function getN8nCommand() {
  const candidates = [
    {
      command: path.resolve('.tools/n8n-runtime-1x/node_modules/.bin/n8n.cmd'),
      runtimeRoot: path.resolve('.tools/n8n-runtime-1x'),
    },
    {
      command: path.resolve('.tools/n8n-runtime-1x/node_modules/.bin/n8n'),
      runtimeRoot: path.resolve('.tools/n8n-runtime-1x'),
    },
    {
      command: path.resolve('.tools/n8n-runtime/node_modules/.bin/n8n.cmd'),
      runtimeRoot: path.resolve('.tools/n8n-runtime'),
    },
    {
      command: path.resolve('.tools/n8n-runtime/node_modules/.bin/n8n'),
      runtimeRoot: path.resolve('.tools/n8n-runtime'),
    },
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate.command)) {
      return { command: candidate.command, args: ['start'], runtimeRoot: candidate.runtimeRoot };
    }
  }

  return { command: 'npx', args: ['--yes', 'n8n', 'start'], runtimeRoot: null };
}

async function ensureLegacyUserRoleCompatibility(runtimeRoot) {
  const databasePath = path.resolve('.n8n-local/.n8n/database.sqlite');

  if (!runtimeRoot || !existsSync(databasePath)) {
    return;
  }

  const sqlite3 = require(path.join(runtimeRoot, 'node_modules/sqlite3'));

  await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath, (error) => {
      if (error) {
        reject(error);
      }
    });

    db.serialize(() => {
      db.all('PRAGMA table_info("user")', (schemaError, columns) => {
        if (schemaError) {
          db.close(() => reject(schemaError));
          return;
        }

        const hasRole = columns.some((column) => column.name === 'role');
        const hasRoleSlug = columns.some((column) => column.name === 'roleSlug');

        if (hasRole || !hasRoleSlug) {
          db.close((closeError) => (closeError ? reject(closeError) : resolve()));
          return;
        }

        db.run('ALTER TABLE "user" ADD COLUMN "role" varchar(128)', (alterError) => {
          if (alterError) {
            db.close(() => reject(alterError));
            return;
          }

          db.run('UPDATE "user" SET "role" = COALESCE("role", "roleSlug", ?)', ['global:member'], (updateError) => {
            if (updateError) {
              db.close(() => reject(updateError));
              return;
            }

            db.close((closeError) => (closeError ? reject(closeError) : resolve()));
          });
        });
      });
    });
  });
}

async function main() {
  const localEnv = loadLocalEnv();
  const n8nCommand = getN8nCommand();

  await ensureLegacyUserRoleCompatibility(n8nCommand.runtimeRoot);

  const child = spawn(n8nCommand.command, n8nCommand.args, {
    shell: true,
    stdio: 'inherit',
    env: {
      ...localEnv,
      CODE_ENABLE_STDOUT: 'true',
      N8N_USER_FOLDER: path.resolve('.n8n-local'),
      N8N_SECURE_COOKIE: 'false',
      N8N_BLOCK_ENV_ACCESS_IN_NODE: 'false',
      N8N_RUNNERS_ENABLED: 'false',
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