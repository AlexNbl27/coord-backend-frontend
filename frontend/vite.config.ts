import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy vers l'API Films Node.js
      '/api/movies': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy vers l'API Billetterie SSE Spring Boot
      '/api/slots': {
        target: 'http://localhost:8086',
        changeOrigin: true,
        ws: true, // Important pour Server-Sent Events
      },
    },
  },
});
