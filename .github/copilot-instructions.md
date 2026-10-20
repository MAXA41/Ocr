# Copilot Instructions

## Build, test, and lint

- Install dependencies with `npm ci`.
- Run the local Vite server with `npm run dev`.
- Build with `npm run build`; serve that build locally with `npm run preview`.
- Lint JavaScript and HTML with `npm run lint`.
- There is no configured test runner or single-test command. `npm run check` currently invokes `npm run test`, but no `test` script is defined.
- Format a specific file with `npx prettier --write path/to/file`. `npm run format` formats the entire repository.

## Architecture

- This is a static, multi-page storefront, not a client-side routed SPA. Root HTML pages provide page structure; `js/site.js` implements shared catalog, product, cart, checkout, and price-request behavior. `js/account.js` owns account, order-history, and catalog-admin behavior. Both use `js/supabase-client.js`; catalog availability helpers are in `js/catalog-state.js`.
- `products.json` is the local catalog and fallback. The browser can overlay catalog data and availability from Supabase's `product_catalog_public` view. `scripts/sync-products-to-supabase.mjs` seeds/updates the Supabase catalog from `products.json`.
- Orders use configurable browser-side delivery integrations (Web3Forms and an n8n webhook). Mono card payments are created by the `mono-create-invoice` Supabase Edge Function; `mono-payment-webhook` records payment updates and notifies n8n. Supabase schema and deployment steps are documented in [docs/supabase-setup.md](../docs/supabase-setup.md) and [docs/mono-supabase-deploy.md](../docs/mono-supabase-deploy.md); order-flow details are in [docs/n8n-order-flow.md](../docs/n8n-order-flow.md).
- Local Vite builds use `vite.config.js`. GitHub Pages deployment is separately defined in [workflows/deploy-pages.yml](workflows/deploy-pages.yml): it generates `public/env.js` and copies the root HTML and static assets into `dist` rather than running `vite build`. Keep both paths in mind when adding a page or changing deployment inputs.

## Repository-specific conventions

- Browser pages load `/env.js` before their JavaScript module. `npm run public-env:build` generates this runtime configuration from environment variables; the Pages workflow supplies its public values from GitHub Actions variables.
- Treat all `VITE_*` values and generated `public/env.js` as public browser data. Never put privileged Supabase keys, the Mono merchant token, or other server credentials in frontend code or public runtime configuration. Keep backend credentials in Supabase secrets or server/local environment configuration.
- Keep the product catalog's source data in `products.json`; when changing the live Supabase catalog, use `npm run supabase:sync-products` after the required Supabase schema is applied. See [docs/supabase-setup.md](../docs/supabase-setup.md).
- Shared page behavior belongs in the existing shared modules rather than being forked into individual pages. Preserve the separation between storefront behavior (`js/site.js`) and account/admin behavior (`js/account.js`).
