import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/generated': 'http://localhost:3000',
      '/references': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
      '/cutouts': 'http://localhost:3000',
      '/crops': 'http://localhost:3000',
    }
  }
});
