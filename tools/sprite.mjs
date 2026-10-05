// npm run sprite: обновляет шаблон тела и запускает Python-скрипт с фото.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exp = spawnSync(process.execPath, [path.join(root, 'tools/export_hero_template.mjs')], { stdio: 'inherit' });
if (exp.status !== 0) process.exit(exp.status ?? 1);

const script = path.join(root, 'tools/make_sprite.py');
const args = process.argv.slice(2);
for (const py of ['python3', 'python', 'py']) {
  const r = spawnSync(py, [script, ...args], { stdio: 'inherit' });
  if (r.error && r.error.code === 'ENOENT') continue;
  process.exit(r.status ?? 0);
}
console.log('Python не найден. Установите Python 3 с python.org и библиотеку Pillow (pip install pillow).');
console.log('Без этого игра работает с обезличенным героем «Прораб».');
