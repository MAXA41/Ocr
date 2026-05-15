import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const IMAGE_DIR = path.resolve('images');
const OUTPUT_WIDTH = 731;
const OUTPUT_HEIGHT = 638;
const MAX_INNER_WIDTH = 620;
const MAX_INNER_HEIGHT = 560;
const BACKGROUND_THRESHOLD = 238;

const SOURCE_FILES = [
  'Colombia-CastiloTolima_E.jpg',
  'Colombia-Manos_Juntas_E.jpg',
  'Colombia-Manos_Juntas_F.jpg',
  'Colombia-Risalda_decaf_F.jpg',
  'Colombia_OMBLIGON_F.jpg',
  'Ethiopia-Guji_Hambella_F.jpg',
  'Kenya-AB-Muthunzuuni_F.jpg',
  'Rwanda-Gitoki_E.jpg',
  'Rwanda-Gitoki_F.jpg',
  'Rwanda-Tropic-Coffee_E.jpg',
  'Rwanda-Tropic-Coffee_F.jpg',
  'RwandaNyamasasa_E.jpg',
  'RwandaNyamasasa_F.jpg',
];

function isNearWhite(r, g, b) {
  return r >= BACKGROUND_THRESHOLD && g >= BACKGROUND_THRESHOLD && b >= BACKGROUND_THRESHOLD;
}

function edgeConnectedBackgroundMask(data, width, height) {
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const index = y * width + x;
    if (visited[index]) return;
    visited[index] = 1;

    const offset = index * 3;
    if (!isNearWhite(data[offset], data[offset + 1], data[offset + 2])) return;

    mask[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length > 0) {
    const index = queue.shift();
    const x = index % width;
    const y = Math.floor(index / width);

    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return mask;
}

function findOpaqueBounds(alpha, width, height) {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = alpha[y * width + x];
      if (value === 0) continue;

      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right === -1) {
    return { left: 0, top: 0, width, height };
  }

  const padding = 8;
  return {
    left: Math.max(0, left - padding),
    top: Math.max(0, top - padding),
    width: Math.min(width - Math.max(0, left - padding), right - left + 1 + padding * 2),
    height: Math.min(height - Math.max(0, top - padding), bottom - top + 1 + padding * 2),
  };
}

async function convertFile(fileName) {
  const sourcePath = path.join(IMAGE_DIR, fileName);
  const targetPath = path.join(IMAGE_DIR, `${path.parse(fileName).name}.webp`);

  const { data, info } = await sharp(sourcePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const backgroundMask = edgeConnectedBackgroundMask(data, info.width, info.height);
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let index = 0; index < info.width * info.height; index += 1) {
    const srcOffset = index * 3;
    const destOffset = index * 4;
    rgba[destOffset] = data[srcOffset];
    rgba[destOffset + 1] = data[srcOffset + 1];
    rgba[destOffset + 2] = data[srcOffset + 2];
    rgba[destOffset + 3] = backgroundMask[index] ? 0 : 255;
  }

  const bounds = findOpaqueBounds(rgba.filter((_, i) => i % 4 === 3), info.width, info.height);

  const cropped = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(bounds)
    .resize({
      width: MAX_INNER_WIDTH,
      height: MAX_INNER_HEIGHT,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cropped, gravity: 'center' }])
    .webp({ quality: 92 })
    .toFile(targetPath);

  return targetPath;
}

async function main() {
  for (const fileName of SOURCE_FILES) {
    if (!fs.existsSync(path.join(IMAGE_DIR, fileName))) {
      console.warn(`Skip missing file: ${fileName}`);
      continue;
    }

    const targetPath = await convertFile(fileName);
    console.log(`Converted ${fileName} -> ${path.basename(targetPath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});