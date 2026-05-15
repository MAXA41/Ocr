import { supabase, isSupabaseConfigured } from './supabase-client.js';

const integerOrNull = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
};

export const normalizeCatalogState = (record = {}) => {
  const isAvailable = record.is_available !== false;
  const stockQuantity = integerOrNull(record.stock_quantity);
  const soldQuantity = integerOrNull(record.sold_quantity) ?? 0;
  const explicitAvailable = integerOrNull(record.available_quantity);
  const availableQuantity = explicitAvailable ?? (stockQuantity === null ? null : Math.max(stockQuantity - soldQuantity, 0));
  const availabilityStatus = record.availability_status
    || (!isAvailable ? 'disabled' : availableQuantity !== null && availableQuantity <= 0 ? 'out_of_stock' : 'available');

  return {
    productId: String(record.product_id || '').trim(),
    isAvailable,
    stockQuantity,
    soldQuantity,
    availableQuantity,
    availabilityStatus,
    updatedAt: record.updated_at || null,
  };
};

export const getProductCatalogState = (product = {}) => normalizeCatalogState(product.catalogState || {});

export const isProductAvailableForPurchase = (product = {}) => {
  return getProductCatalogState(product).availabilityStatus === 'available';
};

export const getAvailabilityPresentation = (product = {}) => {
  const state = getProductCatalogState(product);

  if (state.availabilityStatus === 'disabled') {
    return {
      tone: 'disabled',
      label: 'Тимчасово не продається',
      detail: 'Лот залишається в каталозі, але зараз недоступний для замовлення.',
      buttonLabel: 'Не продається',
    };
  }

  if (state.availabilityStatus === 'out_of_stock') {
    return {
      tone: 'out',
      label: 'Немає в наявності',
      detail: 'Позиція тимчасово закінчилась. Можна повернутись до неї пізніше.',
      buttonLabel: 'Немає в наявності',
    };
  }

  if (state.availableQuantity !== null && state.availableQuantity <= 5) {
    return {
      tone: 'low',
      label: 'Малий залишок',
      detail: 'Лот доступний, але залишок уже невеликий.',
      buttonLabel: 'Купити',
    };
  }

  return {
    tone: 'available',
    label: 'Є в наявності',
    detail: 'Лот доступний для замовлення.',
    buttonLabel: 'Купити',
  };
};

export const fetchCatalogStateMap = async (productIds = []) => {
  if (!isSupabaseConfigured || !supabase) {
    return new Map();
  }

  let query = supabase
    .from('product_catalog_public')
    .select('product_id, is_available, available_quantity, availability_status, updated_at');

  if (Array.isArray(productIds) && productIds.length > 0) {
    query = query.in('product_id', productIds);
  }

  const { data, error } = await query;

  if (error) {
    const isMissingRelation = error.code === 'PGRST205' || String(error.message || '').includes('product_catalog_public');
    if (!isMissingRelation) {
      console.error('Failed to load product catalog state', error);
    }
    return new Map();
  }

  return new Map((data || []).map((row) => [row.product_id, normalizeCatalogState(row)]));
};

export const mergeProductsWithCatalogState = (products = [], stateMap = new Map()) => {
  return products.map((product) => ({
    ...product,
    catalogState: stateMap.get(product.id) || normalizeCatalogState({ product_id: product.id }),
  }));
};