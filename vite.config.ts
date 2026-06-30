import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Use an array for allowed hosts to be more specific
      allowedHosts: [
        'tricking-sherry-guy.ngrok-free.dev',
        '.ngrok-free.dev'
      ],
      host: true, 
      port: 3000,
      strictPort: true,

      // HMR settings (leave as is)
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});