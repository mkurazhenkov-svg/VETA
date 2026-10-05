// Реплика с портретом: для комикса-вступления и карточек «Совет эксперта».
import { BRAND, textStyle, CornerFrame } from '../brand.js';

/** Портрет 96×96: фото Терентьева (если есть) или нарисованный. */
export function portrait(scene, x, y, who, size = 96) {
  const key = who === 'hero' && scene.textures.exists('pt-hero-photo') ? 'pt-hero-photo' : `pt-${who}`;
  const frameBg = scene.add.rectangle(x, y, size + 8, size + 8, BRAND.white);
  const img = scene.add.image(x, y, key).setDisplaySize(size, size);
  return [frameBg, img];
}

/**
 * Панель реплики: портрет слева, имя и текст справа, угловые рамки.
 * Возвращает контейнер.
 */
export function dialogPanel(scene, x, y, w, h, { who, name, text, size = 20 }) {
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, BRAND.blueDeep, 1).setOrigin(0);
  const frame = new CornerFrame(scene, 0, 0, w, h, { thickness: 5, length: 26 });
  c.add([bg, frame]);
  const ps = Math.min(96, h - 40);
  c.add(portrait(scene, 20 + ps / 2 + 4, h / 2, who, ps));
  const tx = 20 + ps + 26;
  const nameT = scene.add.text(tx, 22, name, textStyle('head', 16, BRAND.red));
  const body = scene.add.text(tx, 46, text, textStyle('bold', size, BRAND.white, { wordWrap: { width: w - tx - 24, useAdvancedWrap: true }, lineSpacing: 4 }));
  c.add([nameT, body]);
  c.bg = bg;
  return c;
}

