// Реплика с портретом: для комикса-вступления и карточек «Совет эксперта».
import { BRAND, textStyle, CornerFrame } from '../brand.js';
import { sfx } from '../audio/sfx.js';

/** Портрет 96×96: фото Терентьева (если есть) или нарисованный. */
export function portrait(scene, x, y, who, size = 96) {
  const key = who === 'hero' && scene.textures.exists('pt-hero-photo') ? 'pt-hero-photo' : `pt-${who}`;
  const frameBg = scene.add.rectangle(x, y, size + 8, size + 8, BRAND.white);
  const img = scene.add.image(x, y, key).setDisplaySize(size, size);
  img.baseKey = key;
  img.talkKey = scene.textures.exists(`${key}-talk`) ? `${key}-talk` : key;
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
  const pt = portrait(scene, 20 + ps / 2 + 4, h / 2, who, ps);
  c.add(pt);
  c.portrait = pt[1];
  const tx = 20 + ps + 26;
  const nameT = scene.add.text(tx, 22, name, textStyle('head', 16, BRAND.red));
  const body = scene.add.text(tx, 46, text, textStyle('bold', size, BRAND.white, { wordWrap: { width: w - tx - 24, useAdvancedWrap: true }, lineSpacing: 4 }));
  c.add([nameT, body]);
  c.bg = bg;
  c.body = body;
  // Перенос строк считаем заранее, чтобы при побуквенной печати слова не прыгали между строками.
  c.fullText = body.getWrappedText(text).join('\n');
  body.setWordWrapWidth(null);
  body.setText(c.fullText);
  return c;
}

/**
 * Побуквенная печать реплики «как на Денди»: текст появляется по буквам с писком,
 * у портрета открывается и закрывается рот. Возвращает управление: finish() — допечатать сразу.
 */
export function typeText(scene, panel, { cps = 30, onDone } = {}) {
  const full = panel.fullText;
  const img = panel.portrait;
  let n = 0;
  let done = false;
  panel.body.setText('');
  const stop = () => {
    if (done) return;
    done = true;
    timer.remove();
    mouth.remove();
    panel.body.setText(full);
    img.setTexture(img.baseKey);
    onDone?.();
  };
  const timer = scene.time.addEvent({
    delay: 1000 / cps,
    loop: true,
    callback: () => {
      n += 1;
      panel.body.setText(full.slice(0, n));
      const ch = full[n - 1];
      if (n % 2 === 0 && ch && ch.trim()) sfx.blip();
      if (n >= full.length) stop();
    },
  });
  let open = false;
  const mouth = scene.time.addEvent({
    delay: 120,
    loop: true,
    callback: () => {
      // на паузах (пробелы, знаки препинания) рот закрывается
      const ch = full[n - 1] || ' ';
      open = /[.,!?…—\s]/.test(ch) ? false : !open;
      img.setTexture(open ? img.talkKey : img.baseKey);
    },
  });
  return { finish: stop, get done() { return done; } };
}

