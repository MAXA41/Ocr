// Add this to site.js - new function to handle product variants

// Fetch variants for a product
const fetchProductVariants = async (productId) => {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load product variants:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('Error fetching variants:', e);
    return [];
  }
};

// Render variant buttons based on variant type
const renderVariantButtons = (variants, variantType) => {
  if (!variants || variants.length === 0) return '';

  const variantsByValue = new Map();
  variants.forEach(v => {
    const value = v.variant_values?.[variantType];
    if (value) {
      variantsByValue.set(value, v);
    }
  });

  if (variantsByValue.size <= 1) return ''; // Don't show buttons if only one variant

  let html = `<div class="product-variants-section">
    <p class="variant-label">${variantType === 'color' ? '🎨 Колір' : '📏 Розмір'}:</p>
    <div class="variant-buttons">`;

  variantsByValue.forEach((variant, value) => {
    const isColor = variantType === 'color';
    const buttonClass = `variant-btn ${isColor ? 'color-btn' : 'size-btn'}`;
    
    if (isColor) {
      html += `
        <button 
          class="${buttonClass}" 
          data-variant-id="${variant.id}"
          data-variant-value="${value}"
          title="${value}"
          style="background-color: ${value}; border: 2px solid #ccc;"
        ></button>`;
    } else {
      html += `
        <button 
          class="${buttonClass}" 
          data-variant-id="${variant.id}"
          data-variant-value="${value}"
        >${value}</button>`;
    }
  });

  html += '</div></div>';
  return html;
};

// Updated renderProductDetail to include variants
const renderProductDetailWithVariants = async (product, allProducts) => {
  if (!productDetailRoot) return;

  const copy = getProductPageCopy(product);
  const availability = getAvailabilityPresentation(product);
  const canBuy = isProductAvailableForPurchase(product);
  const productCode = formatProductCode(product);
  const tasteNotes = copy.tasteNotes;
  const specs = buildProductSpecs(product, copy);
  document.title = `${product.name} | Odesa Coffee Roasters`;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', `${product.name} від Odesa Coffee Roasters: ${product.description}`);
  }

  // Load variants
  const variants = await fetchProductVariants(product.id);
  let variantMarkup = '';
  let selectedVariant = null;

  if (variants.length > 0) {
    selectedVariant = variants[0];
    
    // Determine what type of variants these are (color or size)
    const hasColorVariant = variants.some(v => v.variant_values?.color);
    const hasSizeVariant = variants.some(v => v.variant_values?.size);
    
    if (hasColorVariant) {
      variantMarkup = renderVariantButtons(variants, 'color');
    } else if (hasSizeVariant) {
      variantMarkup = renderVariantButtons(variants, 'size');
    }
  }

  const productImage = selectedVariant?.image_url || product.image;
  const productAlt = selectedVariant?.image_alt || product.alt;
  const variantPrice = selectedVariant?.price || product.price;

  const productMediaMarkup = product.giftImage
    ? `
        <div class="product-detail-media-stack">
          <figure class="product-detail-media" id="main-product-image">
            <img src="${productImage}" alt="${productAlt}">
            <figcaption>Основне пакування</figcaption>
          </figure>
          <figure class="product-detail-media gift-variant">
            <img src="${product.giftImage}" alt="${product.giftAlt || 'Подарункове пакування'}">
            <figcaption>Подарункове пакування</figcaption>
          </figure>
        </div>`
    : `
        <div class="product-detail-media" id="main-product-image">
          <img src="${productImage}" alt="${productAlt}">
        </div>`;

  productDetailRoot.innerHTML = `
    <section class="hero product-hero">
      <div class="container">
        <article class="product-showcase-card">
          <div class="product-detail-grid">
            <div class="product-showcase-media">${productMediaMarkup}</div>
            <div class="hero-copy product-detail-copy product-showcase-copy">
              <div class="product-showcase-head">
                <p class="product-code">Код товару: ${productCode}</p>
                <div>
                  <p class="eyebrow">${copy.eyebrow}</p>
                  <h1>${product.name}</h1>
                </div>
              </div>
              <div class="product-spec-card">
                <div class="product-spec-list">
                  ${specs.map(([label, value]) => `
                    <div class="product-spec-row">
                      <span>${label}:</span>
                      <strong>${value}</strong>
                    </div>
                  `).join('')}
                </div>
              </div>
              ${variantMarkup}
              <div class="product-detail-price-row product-showcase-actions">
                ${getProductVolumeMarkup(product)}
                <span class="product-detail-price" data-product-price>${variantPrice} грн</span>
                <button class="btn primary product-buy" data-id="${product.id}" data-name="${product.name}" data-category="${product.category}" data-price="${variantPrice}" data-weight="${(getVolumeSelectionConfig(product)[0] || { weightLabel: product.weight || '' }).weightLabel || product.weight || ''}" data-available="${String(canBuy)}" type="button" ${canBuy ? '' : 'disabled'}>${canBuy ? 'Додати до кошика' : availability.buttonLabel}</button>
              </div>
            </div>
          </div>
          <div class="product-showcase-foot">
            <div class="product-taste-line">
              <span>Смак:</span>
              <p>${tasteNotes}</p>
            </div>
            <div class="product-showcase-side">
              <p class="product-availability product-availability-${availability.tone}">${availability.detail}</p>
              <div class="hero-actions product-showcase-links">
                <a class="btn ghost" href="${product.category}.html">Назад до категорії</a>
                <a class="btn light" href="index.html#products">До хітів продажу</a>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
    <section class="section">
      <div class="container product-info-grid">
        <article class="coffee-card product-info-card">
          <p class="eyebrow">Що в чашці</p>
          <h2>Смаковий профіль</h2>
          <p>${copy.cupProfile}</p>
        </article>
        <article class="coffee-card product-info-card">
          <p class="eyebrow">Походження</p>
          <h2>${product.origin || 'Лот у процесі оновлення'}</h2>
          <p>Спосіб обробки: ${product.processing || 'уточнюємо найближчим оновленням каталогу'}.</p>
        </article>
        <article class="coffee-card product-info-card">
          <p class="eyebrow">Як заварювати</p>
          <h2>${copy.guideTitle}</h2>
          <p>${copy.brewGuideText}</p>
        </article>
        <article class="coffee-card product-info-card">
          <p class="eyebrow">Кому підійде</p>
          <h2>Для щоденного меню</h2>
          <p>${copy.audienceText}</p>
        </article>
      </div>
    </section>`;

  if (relatedGrid) {
    const relatedProducts = allProducts
      .filter((item) => item.category === product.category && item.id !== product.id)
      .filter((item) => isProductVisibleInCatalog(item))
      .slice(0, 3);

    relatedGrid.innerHTML = relatedProducts.length > 0
      ? relatedProducts.map((item) => renderProductCard(item, false)).join('')
      : '';
  }

  // Attach variant change handlers
  if (variants.length > 0) {
    const variantButtons = productDetailRoot.querySelectorAll('.variant-btn');
    variantButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const variantId = btn.dataset.variantId;
        const clickedVariant = variants.find(v => v.id === variantId);
        
        if (clickedVariant) {
          // Update selected state
          variantButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          // Update product image
          const imgElement = productDetailRoot.querySelector('#main-product-image img');
          if (imgElement && clickedVariant.image_url) {
            imgElement.src = clickedVariant.image_url;
            imgElement.alt = clickedVariant.image_alt || productAlt;
          }
          
          // Update price
          const priceElement = productDetailRoot.querySelector('[data-product-price]');
          if (priceElement) {
            priceElement.textContent = `${clickedVariant.price || product.price} грн`;
          }
          
          // Update buy button data
          const buyBtn = productDetailRoot.querySelector('.product-buy');
          if (buyBtn) {
            buyBtn.dataset.price = clickedVariant.price || product.price;
          }
        }
      });
    });
    
    // Mark first variant as active
    if (variantButtons.length > 0) {
      variantButtons[0].classList.add('active');
    }
  }

  attachBuyHandlers();
};

// Add CSS for variant buttons
const injectVariantStyles = () => {
  if (document.querySelector('#variant-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'variant-styles';
  style.textContent = `
    .product-variants-section {
      margin: 20px 0;
      padding: 15px 0;
      border-top: 1px solid #e0e0e0;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .variant-label {
      font-weight: 600;
      margin-bottom: 10px;
      color: #333;
      font-size: 14px;
    }
    
    .variant-buttons {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .variant-btn {
      padding: 10px 16px;
      border: 2px solid #ddd;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    
    .size-btn {
      min-width: 50px;
      text-align: center;
    }
    
    .color-btn {
      width: 45px;
      height: 45px;
      padding: 0;
      border-radius: 8px;
    }
    
    .variant-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .variant-btn.active {
      border-color: #667eea;
      background: #667eea;
      color: white;
    }
    
    .color-btn.active {
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
    }
  `;
  
  document.head.appendChild(style);
};

// Initialize on page load
injectVariantStyles();

// Replace the old renderProductDetail with the new one that supports variants
// Keep the old function name but use the new implementation
const originalRenderProductDetail = renderProductDetail;
const renderProductDetail = renderProductDetailWithVariants;
