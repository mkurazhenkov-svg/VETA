// Выгружает шаблон тела героя в assets/sprites/hero_template.json.
// Этот файл читает tools/make_sprite.py, чтобы наложить голову из фото на тело.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_W, HERO_H, HERO_FRAMES, HERO_ANIMS, drawHeroFrame, templatePalette } from '../src/gfx/heroRig.js';
import { BRAND, SHADE, SKIN } from '../src/palette.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pal = templatePalette();
const rev = Object.fromEntries(Object.entries(pal).map(([ch, hex]) => [parseInt(hex.slice(1), 16), ch]));

function rows(p) {
  const out = [];
  for (let y = 0; y < p.h; y++) {
    let s = '';
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      s += c === -1 ? '.' : rev[c];
    }
    out.push(s);
  }
  return out;
}

const tpl = {
  _readme: 'Шаблон тела героя. Генерируется командой npm run sprite из src/gfx/heroRig.js. Руками не править.',
  frameWidth: HERO_W,
  frameHeight: HERO_H,
  frames: HERO_FRAMES,
  anims: HERO_ANIMS,
  palette: pal,
  outline: '#' + BRAND.black.toString(16).padStart(6, '0'),
  quantize: {
    brand: [...Object.values(BRAND), ...Object.values(SHADE)].map((c) => '#' + c.toString(16).padStart(6, '0')),
    skin: SKIN.map((c) => '#' + c.toString(16).padStart(6, '0')),
  },
  face: [],
  body: [],
  helmet: [],
  generic: [],
};
for (const name of HERO_FRAMES) {
  const parts = drawHeroFrame(name);
  tpl.face.push(parts.face);
  tpl.body.push(rows(parts.body));
  tpl.helmet.push(rows(parts.helmet));
  tpl.generic.push(rows(parts.generic));
}
const out = path.join(root, 'assets/sprites/hero_template.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(tpl, null, 1) + '\n');
console.log('Шаблон героя сохранён:', path.relative(root, out));
