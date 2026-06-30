import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv } from './lib/local-env.mjs';

const env = loadLocalEnv();
const supabaseUrl = String(env.SUPABASE_URL || env.SB_URL || env.PROJECT_URL || env.VITE_SUPABASE_URL || '').trim();
const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.SB_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing project URL or service role key in env (SUPABASE_URL/SB_URL/PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY/SB_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY).');
  process.exit(1);
}

const productsPath = path.resolve('products.json');
const rawProducts = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

if (!Array.isArray(rawProducts)) {
  throw new Error('products.json must contain an array of products.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const toText = (value) => (value === undefined || value === null ? null : String(value));
const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const catalogRows = rawProducts.map((product) => ({
  product_id: String(product.id || '').trim(),
  name: toText(product.name) || '',
  description: toText(product.description),
  image: toText(product.image) || '',
  alt: toText(product.alt),
  category: toText(product.category) || 'espresso',
  price: toNumber(product.price) ?? 0,
  weight: toText(product.weight),
  country: toText(product.country),
  region: toText(product.region),
  origin: toText(product.origin),
  processing: toText(product.processing),
  farm: toText(product.farm),
  variety: toText(product.variety),
  altitude: toText(product.altitude),
  score: toNumber(product.score),
  featured: Boolean(product.featured),
  gift_image: toText(product.gift_image),
  gift_alt: toText(product.gift_alt),
  raw_data: product,
})).filter((product) => product.product_id && product.name && product.image);

const stateRows = catalogRows.map((product) => ({ product_id: product.product_id }));

const { error: catalogError } = await supabase
  .from('product_catalog_items')
  .upsert(catalogRows, { onConflict: 'product_id' });

if (catalogError) {
  throw catalogError;
}

const { error: stateError } = await supabase
  .from('product_catalog_state')
  .upsert(stateRows, { onConflict: 'product_id', ignoreDuplicates: true });

if (stateError) {
  throw stateError;
}

console.log(`Synced ${catalogRows.length} products into Supabase.`);