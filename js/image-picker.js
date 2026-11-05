const rootFolderValue = '__root__';

let imageCatalog = null;
let imageCatalogPromise = null;

const escapeAttribute = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const emptyImageCatalog = () => ({ images: [], folders: {}, rootImages: [] });

const normalizeImageCatalog = (data) => {
  const images = Array.isArray(data?.images) ? data.images : [];
  const folders = data?.folders && typeof data.folders === 'object' ? data.folders : {};
  return {
    images,
    folders,
    // images/<file> without a subfolder
    rootImages: images.filter((imagePath) => imagePath.split('/').length === 2),
  };
};

export const loadImageCatalog = () => {
  if (!imageCatalogPromise) {
    imageCatalogPromise = fetch('/images-list.json', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`images-list.json: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        imageCatalog = normalizeImageCatalog(data);
        return imageCatalog;
      })
      .catch((error) => {
        console.error('Failed to load images list', error);
        imageCatalogPromise = null;
        return emptyImageCatalog();
      });
  }

  return imageCatalogPromise;
};

const getFolderImages = (catalog, folderValue) => {
  if (!folderValue) return catalog.images;
  if (folderValue === rootFolderValue) return catalog.rootImages;
  return catalog.folders[folderValue] || [];
};

// The deepest folder that contains the image, so an existing value opens in its own folder.
const detectFolder = (catalog, imagePath) => {
  if (!imagePath) return '';
  const matches = Object.keys(catalog.folders).filter((folder) => catalog.folders[folder].includes(imagePath));
  if (matches.length > 0) {
    return matches.sort((left, right) => right.length - left.length)[0];
  }
  return catalog.rootImages.includes(imagePath) ? rootFolderValue : '';
};

const getFileLabel = (imagePath, folderValue) => {
  const prefix = folderValue && folderValue !== rootFolderValue ? `images/${folderValue}/` : 'images/';
  return imagePath.startsWith(prefix) ? imagePath.slice(prefix.length) : imagePath;
};

export const buildImagePickerMarkup = ({ value = '', inputAttrs = '' } = {}) => `
  <div class="image-picker" data-image-picker>
    <div class="image-picker-selects">
      <select class="image-picker-folder" data-image-folder aria-label="Папка з фото">
        <option value="">📁 Усі фото</option>
      </select>
      <select class="image-picker-file" data-image-file aria-label="Фото з папки">
        <option value="">— обрати фото —</option>
      </select>
    </div>
    <div class="image-picker-main">
      <input type="text" class="image-picker-input" data-image-input ${inputAttrs} value="${escapeAttribute(value)}" placeholder="images/... або https://...">
      <img class="image-picker-preview" data-image-preview alt="" hidden>
    </div>
  </div>`;

const fillFileSelect = (picker, catalog, folderValue, selectedValue = '') => {
  const fileSelect = picker.querySelector('[data-image-file]');
  if (!(fileSelect instanceof HTMLSelectElement)) return;

  const fragment = document.createDocumentFragment();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— обрати фото —';
  fragment.append(placeholder);

  getFolderImages(catalog, folderValue).forEach((imagePath) => {
    const option = document.createElement('option');
    option.value = imagePath;
    option.textContent = getFileLabel(imagePath, folderValue);
    fragment.append(option);
  });

  fileSelect.replaceChildren(fragment);
  fileSelect.value = [...fileSelect.options].some((option) => option.value === selectedValue) ? selectedValue : '';
};

const updatePreview = (picker) => {
  const input = picker.querySelector('[data-image-input]');
  const preview = picker.querySelector('[data-image-preview]');
  if (!(input instanceof HTMLInputElement) || !(preview instanceof HTMLImageElement)) return;

  const value = input.value.trim().replace(/\\/g, '/');
  if (!/^(\/?images\/|https?:\/\/)/i.test(value)) {
    preview.hidden = true;
    preview.removeAttribute('src');
    return;
  }

  preview.onerror = () => { preview.hidden = true; };
  preview.onload = () => { preview.hidden = false; };
  preview.setAttribute('src', value);
};

const setupPicker = (picker, catalog) => {
  const folderSelect = picker.querySelector('[data-image-folder]');
  const input = picker.querySelector('[data-image-input]');
  if (!(folderSelect instanceof HTMLSelectElement) || !(input instanceof HTMLInputElement)) return;

  const fragment = document.createDocumentFragment();
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = '📁 Усі фото';
  fragment.append(allOption);

  if (catalog.rootImages.length > 0) {
    const rootOption = document.createElement('option');
    rootOption.value = rootFolderValue;
    rootOption.textContent = '📁 images/ (без підпапки)';
    fragment.append(rootOption);
  }

  Object.keys(catalog.folders).sort((left, right) => left.localeCompare(right, 'uk')).forEach((folder) => {
    const option = document.createElement('option');
    option.value = folder;
    option.textContent = `📁 ${folder}/`;
    fragment.append(option);
  });

  folderSelect.replaceChildren(fragment);

  const currentValue = input.value.trim().replace(/\\/g, '/');
  const folderValue = detectFolder(catalog, currentValue);
  folderSelect.value = folderValue;
  fillFileSelect(picker, catalog, folderValue, currentValue);
  updatePreview(picker);
  picker.dataset.pickerReady = 'true';
};

// Call after inserting picker markup; safe to call repeatedly on the same root.
export const hydrateImagePickers = async (root = document) => {
  const pickers = [...root.querySelectorAll('[data-image-picker]:not([data-picker-ready])')];
  if (pickers.length === 0) return;

  const catalog = await loadImageCatalog();
  pickers.forEach((picker) => {
    if (picker.isConnected && !picker.dataset.pickerReady) setupPicker(picker, catalog);
  });
};

// Re-syncs selects and preview with the input value, e.g. after form.reset().
export const syncImagePickers = (root = document) => {
  if (!imageCatalog) return;
  root.querySelectorAll('[data-image-picker][data-picker-ready]').forEach((picker) => setupPicker(picker, imageCatalog));
};

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !imageCatalog) return;

  const picker = target.closest('[data-image-picker]');
  if (!picker) return;

  if (target.matches('[data-image-folder]')) {
    const input = picker.querySelector('[data-image-input]');
    fillFileSelect(picker, imageCatalog, target.value, input instanceof HTMLInputElement ? input.value.trim() : '');
    return;
  }

  if (target.matches('[data-image-file]')) {
    const input = picker.querySelector('[data-image-input]');
    if (!(input instanceof HTMLInputElement) || !target.value) return;
    input.value = target.value;
    updatePreview(picker);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches('[data-image-input]')) return;

  const picker = target.closest('[data-image-picker]');
  if (!picker) return;

  updatePreview(picker);
  const fileSelect = picker.querySelector('[data-image-file]');
  if (fileSelect instanceof HTMLSelectElement) {
    const value = target.value.trim();
    fileSelect.value = [...fileSelect.options].some((option) => option.value === value) ? value : '';
  }
});
