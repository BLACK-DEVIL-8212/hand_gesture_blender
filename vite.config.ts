import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
    {
      name: 'copy-electron-files',
      closeBundle() {
        const srcDir = path.resolve(__dirname, 'electron');
        const destDir = path.resolve(__dirname, 'dist/electron');
        if (fs.existsSync(srcDir)) {
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.readdirSync(srcDir).forEach((file) => {
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
          });
        }
      },
    },
  ],
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    base: './',
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
