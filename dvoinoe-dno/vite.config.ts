import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadContent } from './src/content/load-node.ts';

const CONTENT = resolve(import.meta.dirname, 'content');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** virtual:content — весь контент, проверенный zod-схемами, с Ink, скомпилированным при сборке. */
function contentPlugin(): Plugin {
  const id = 'virtual:content';
  const resolved = '\0' + id;
  return {
    name: 'dvoinoe-dno-content',
    resolveId(src) {
      return src === id ? resolved : null;
    },
    load(src) {
      if (src !== resolved) return null;
      for (const f of walk(CONTENT)) this.addWatchFile(f);
      const content = loadContent(CONTENT); // ошибка валидации или Ink валит сборку
      return `export default ${JSON.stringify(content)};`;
    },
    handleHotUpdate(ctx) {
      if (ctx.file.startsWith(CONTENT)) {
        const mod = ctx.server.moduleGraph.getModuleById(resolved);
        if (mod) ctx.server.moduleGraph.invalidateModule(mod);
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

// Сборка в один файл dist/index.html (открывается двойным кликом, без сети) + sw.js и manifest для киоска.
export default defineConfig({
  base: './',
  plugins: [contentPlugin(), preact(), viteSingleFile()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 6000,
    reportCompressedSize: false,
  },
  server: { host: true },
  test: {
    include: ['tests/domain/**/*.test.ts', 'tests/golden/**/*.test.ts'],
  },
} as any);
