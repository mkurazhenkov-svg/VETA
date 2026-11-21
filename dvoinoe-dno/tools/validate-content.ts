// pnpm validate: проверяет весь контент (zod-схемы, перекрёстные ссылки, компиляция Ink).
import { loadContent, ContentError } from '../src/content/load-node.ts';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
try {
  const c = loadContent(root);
  const evs = c.evidence.filter((e) => e.kind === 'evidence').length;
  const fts = c.evidence.filter((e) => e.kind === 'false_trace').length;
  console.log(`Контент в порядке: ${evs} улик, ${fts} ложных следа, ${c.facts.length} фактов, ${c.theories.length} версий, ` +
    `${Object.keys(c.scenes).length} сцен, ${c.rules.rules.length} правил, Ink ${Math.round(c.ink.length / 1024)} КБ.`);
} catch (e) {
  if (e instanceof ContentError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
