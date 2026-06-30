import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Updated to use Render URLs instead of dead ngrok
      allowedHosts: [
        'wing-artisan-bot.onrender.com',
        '.onrender.com',
        'localhost'
      ],
      host: true,
      port: 3000,
      strictPort: true,

      // HMR settings
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});