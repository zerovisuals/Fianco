import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// COOP/COEP make SharedArrayBuffer available for the multithreaded Stockfish WASM build.
export default defineConfig({
  root: 'app',
  plugins: [react()],
  server: { port: 5180, headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  preview: { port: 5180, headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  build: { outDir: '../dist', emptyOutDir: true },
});
