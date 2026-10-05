import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Сборка в один файл dist/index.html: код, графика, шрифты и звук внутри.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2019',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
    reportCompressedSize: false,
  },
  server: { host: true },
});
