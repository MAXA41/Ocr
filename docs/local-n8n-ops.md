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

Preferred stable mode is a named Cloudflare tunnel.

Set these user-level environment variables first:

```bash
CLOUDFLARED_TUNNEL_TOKEN=your_named_tunnel_token
N8N_PUBLIC_BASE_URL=https://n8n.your-domain.com
```

Then run:

```bash
npm run telegram:tunnel:start
```

What it does in stable mode:

- starts `cloudflared tunnel run --token ...`
- uses `N8N_PUBLIC_BASE_URL` as the canonical public hostname
- probes both Telegram and order webhook paths automatically
- binds Telegram webhook to the stable public hostname

If `CLOUDFLARED_TUNNEL_TOKEN` is missing, the script falls back to `localtunnel`.

Fallback mode:

```bash
npm run telegram:tunnel:start
```

What it does in fallback mode:

- opens `localtunnel`
- waits for the first public `https://...loca.lt` URL
- probes both Telegram and order webhook paths automatically
- binds Telegram webhook to the first live tunnel URL that reaches local n8n

The process must remain running while Telegram webhook delivery is needed.

Manual fallback still exists if needed:

```bash
npx --yes localtunnel --port 5678
```

If you ever need to probe a hostname manually, the healthy pattern is:

- `404` or `405` on `/webhook/ocr-telegram-admin` for `GET`
- `404` or `405` on `/webhook/ocr-orders-supabase` for `GET`

Example probe:

```bash
curl -I -s https://<host>.loca.lt/webhook/ocr-telegram-admin -H "bypass-tunnel-reminder: true" | head -n 5
curl -I -s https://<host>.loca.lt/webhook/ocr-orders-supabase -H "bypass-tunnel-reminder: true" | head -n 5
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
npm run telegram:webhook:set -- https://<host>.loca.lt
```

Or pass the full webhook URL:

```bash
npm run telegram:webhook:set -- https://<host>.loca.lt/webhook/ocr-telegram-admin
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

- Stable production-like setup should use Cloudflare named tunnels, not quick tunnels.
- `loca.lt` hostnames are temporary and can expire without warning.
- Some manual probes require the `bypass-tunnel-reminder: true` header to skip the LocalTunnel interstitial.
- Imported n8n `If` nodes were unreliable for Telegram command routing; the working admin workflow uses code-node pass-through routing instead.
- The active Telegram bot is `OrcOrdersBot` with id `8637802328`.
- If a Code node suddenly fails with `access to env vars denied`, verify `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` is present in the n8n runtime environment.

## GitHub Pages Runtime Config

The Pages deploy workflow now generates `public/env.js` from repository variables before build.

Set these GitHub repository variables for production:

- `VITE_ORDER_PROVIDER`
- `VITE_ORDER_FALLBACK_WEBHOOK_URL`
- `VITE_ORDER_DUPLICATE_TO_WEBHOOK`
- `VITE_ORDER_WEBHOOK_SHARED_SECRET`
- `VITE_NOVA_POSHTA_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_AUTH_REDIRECT_URL`

This keeps the checked-in `public/env.js` free of temporary tunnel URLs.
