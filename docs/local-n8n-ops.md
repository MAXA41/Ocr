# Local n8n Ops

This project currently runs Telegram admin automation from the local n8n instance in `.n8n-local`.

## Current Source Of Truth

- Telegram admin workflow: `.local-n8n/telegram-admin-personalized.json`
- Completion workflow: `.local-n8n/complete-order-personalized.json`
- Orders intake workflow: `.local-n8n/orders-personalized.json`
- Local runtime database: `.n8n-local/.n8n/database.sqlite`
- Public frontend config: `.env.local`
- Local secret template: `.env.example`
- Preferred secret source for n8n ops: user-level environment variables

## Start Local n8n

Run from the repo root:

```bash
npm run n8n:start:local
```

What it does:

- loads optional values from `.env.local`
- lets OS-level environment variables override file values
- starts n8n with `.n8n-local` as the user folder
- keeps `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` so Code nodes can read `$env`

For local ops, keep secrets out of `.env.local` when possible and store them in user-level environment variables instead.

Expected local editor URL:

```text
http://localhost:5678
```

## Expose Local n8n Publicly

Preferred local fallback is now the automated tunnel bootstrap:

```bash
npm run telegram:tunnel:start
```

What it does:

- opens `localhost.run`
- watches emitted hostnames
- probes candidates automatically
- binds Telegram webhook to the first live hostname that reaches local n8n

The process must remain running while Telegram webhook delivery is needed.

Manual fallback still exists if needed:

```bash
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:127.0.0.1:5678 nokey@localhost.run
```

If you ever need to probe a hostname manually, the healthy pattern is:

- `200` on `/`
- `404` on `/webhook/ocr-telegram-admin` for `GET`

Example probe:

```bash
curl -I -s https://<host>.lhr.life/ | head -n 5
curl -I -s https://<host>.lhr.life/webhook/ocr-telegram-admin | head -n 5
```

## Sync Telegram Webhook

The repo now includes a webhook helper script that reads the bot token from user env first and falls back to `.env.local`.

Show current webhook:

```bash
npm run telegram:webhook:info
```

Automatic bootstrap and bind in one step:

```bash
npm run telegram:tunnel:start
```

Bind Telegram to a public base URL:

```bash
npm run telegram:webhook:set -- https://<host>.lhr.life
```

Or pass the full webhook URL:

```bash
npm run telegram:webhook:set -- https://<host>.lhr.life/webhook/ocr-telegram-admin
```

Delete webhook and drop pending updates:

```bash
npm run telegram:webhook:delete
```

## Quick Validation

After restarting n8n and rebinding the webhook, validate these commands in the Telegram group:

- `/orders`
- `/complete 6`

Expected responses in the current working state:

- `/orders` -> `Зараз немає відкритих замовлень.`
- `/complete 6` -> `Готово. Замовлення: #6. Результат: Замовлення вже завершено`

## Important Notes

- `localhost.run` hostnames are temporary and can expire without warning.
- Imported n8n `If` nodes were unreliable for Telegram command routing; the working admin workflow uses code-node pass-through routing instead.
- The active Telegram bot is `OrcOrdersBot` with id `8637802328`.
- If a Code node suddenly fails with `access to env vars denied`, verify `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` is present in the n8n runtime environment.
