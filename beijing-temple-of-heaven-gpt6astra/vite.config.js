import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { strictPort: true },
  preview: { strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
