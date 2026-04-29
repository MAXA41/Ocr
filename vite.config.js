import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        account: resolve(__dirname, 'account.html'),
        delivery: resolve(__dirname, 'delivery.html'),
        decaf: resolve(__dirname, 'decaf.html'),
        drips: resolve(__dirname, 'drips.html'),
        espresso: resolve(__dirname, 'espresso.html'),
        filter: resolve(__dirname, 'filter.html'),
        product: resolve(__dirname, 'product.html'),
      },
    },
  },
});