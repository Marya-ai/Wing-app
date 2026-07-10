import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      // Sets '@' to point to the 'src' directory for cleaner imports
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    // ALLOWED HOSTS: Crucial for Render and Telegram Web App environments
    allowedHosts: [
      'wing-artisan-bot.onrender.com',
      '.onrender.com',
      'localhost',
      '127.0.0.1'
    ],
    // PROXY: This bridges your Frontend (3000) and Backend (5000)
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
    // HMR (Hot Module Replacement) settings
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true, // Helpful for OneDrive/Windows sync issues
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
});