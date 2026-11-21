// pnpm placeholder-art: выгружает живописные плейсхолдеры всех сцен и портреты персонажей в docs/art-reference/ —
// подмалёвок и раскладка предметов для художника. Работает по собранному dist/index.html (сначала pnpm build).
// Готовый арт кладётся как content/cases/<дело>/scenes/<id>/base.webp — игра подхватит его без правок кода.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'art-reference');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + join(root, 'dist', 'index.html'));
await page.waitForFunction(() => (window as any).__dd);
const scenes: string[] = await page.evaluate(() => Object.keys((window as any).__dd.content.scenes));
for (const id of scenes) {
  const url: string = await page.evaluate((s) => (window as any).__dd.art(s), id);
  writeFileSync(join(out, `${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`docs/art-reference/${id}.png`);
}
const persons: string[] = await page.evaluate(() => (window as any).__dd.content.case.persons.map((p: any) => p.id));
for (const id of persons)
  for (const mood of ['calm', 'tense', 'broken']) {
    const url: string = await page.evaluate(([p, m]) => (window as any).__dd.portraitUrl(p, m), [id, mood]);
    writeFileSync(join(out, `portrait-${id}-${mood}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  }
console.log(`портреты: ${persons.length} × 3`);
await browser.close();
