#!/usr/bin/env node
/**
 * Generate list of all images in images/ folder (recursive)
 * Output: public/images-list.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const imagesDir = path.join(projectRoot, 'images');
const outputFile = path.join(projectRoot, 'public', 'images-list.json');

const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];

function isImageFile(filename) {
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

function scanDirectory(dir, relativePath = '') {
  const images = [];
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      const relPath = relativePath ? `${relativePath}/${file}` : file;
      
      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        images.push(...scanDirectory(fullPath, relPath));
      } else if (isImageFile(file)) {
        // Add image file
        images.push(`images/${relPath}`.replace(/\\/g, '/'));
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error.message);
  }
  
  return images;
}

function scanFolders(dir, relativePath = '') {
  const folders = {};
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        const relPath = relativePath ? `${relativePath}/${file}` : file;
        // Get images in this folder
        const images = scanDirectory(fullPath, relPath);
        if (images.length > 0) {
          folders[relPath] = images.sort();
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error.message);
  }
  
  return folders;
}

// Scan all images
console.log(`Scanning ${imagesDir}...`);
const allImages = scanDirectory(imagesDir).sort();
const folderStructure = scanFolders(imagesDir);

// Create output
const output = {
  generated: new Date().toISOString(),
  totalCount: allImages.length,
  images: allImages,
  folders: folderStructure,
};

// Ensure public directory exists
const publicDir = path.join(projectRoot, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write JSON
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

console.log(`✅ Generated ${allImages.length} images from ${Object.keys(folderStructure).length} folders`);
console.log(`📄 Saved to: ${outputFile}`);

// Show folder structure
console.log('\nFolders:');
Object.keys(folderStructure).sort().forEach(folder => {
  console.log(`  📁 ${folder}/ (${folderStructure[folder].length} images)`);
});

// Also log some samples
console.log('\nFirst 10 images:');
allImages.slice(0, 10).forEach(img => console.log(`  - ${img}`));

if (allImages.length > 10) {
  console.log(`  ... and ${allImages.length - 10} more`);
}
