import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 8130, strictPort: true },
  preview: { port: 8130, strictPort: true },
  build: {
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
