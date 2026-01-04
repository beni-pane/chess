import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/chess/', // Esto asegura que los assets se busquen en /chess/assets/
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});