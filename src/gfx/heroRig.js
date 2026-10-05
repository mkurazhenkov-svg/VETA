// Шаблон тела героя «Терентьев-прораб», 32×48 px, смотрит вправо.
// Из этого же шаблона скрипт tools/make_sprite.py собирает спрайтшит с головой из фото.
// Слои кадра: body (тело), helmet (каска поверх лица), face — прямоугольник, куда ставится лицо.
import { PixelArt } from './PixelArt.js';
import { BRAND, SHADE, SKIN } from '../palette.js';

export const HERO_W = 32;
export const HERO_H = 48;

// Кадры: idle 2, бег 6, прыжок 2, выстрел 2, урон 1, победа 2.
export const HERO_FRAMES = [
  'idle0', 'idle1',
  'run0', 'run1', 'run2', 'run3', 'run4', 'run5',
  'jump0', 'jump1',
  'shoot0', 'shoot1',
  'hurt',
  'win0', 'win1',
];
export const HERO_ANIMS = {
  idle: [0, 1],
  run: [2, 3, 4, 5, 6, 7],
  jumpUp: [8],
  jumpDown: [9],
  shoot: [10, 11],
  hurt: [12],
  win: [13, 14],
};

const C = {
  out: BRAND.black,
  helmet: BRAND.white,
  helmetShade: BRAND.gray,
  helmetDark: SHADE.grayMid,
  shirt: BRAND.blueDeep,
  shirtDark: SHADE.blueNight,
  vest: BRAND.blue,
  vestLight: SHADE.blueLight,
  stripe: BRAND.white,
  pants: SHADE.blackSoft,
  pantsLight: SHADE.blackMid,
  boot: BRAND.black,
  tablet: SHADE.grayMid,
  paper: BRAND.white,
  device: SHADE.blackMid,
  laser: BRAND.red,
  badge: BRAND.red,
  skin: SKIN[1],
  skinLight: SKIN[0],
  skinShade: SKIN[2],
  skinDark: SKIN[3],
};

// Лицо: прямоугольник под каской. Верхние строки закрывает каска.
export const FACE = { x: 10, y: 7, w: 12, h: 14 };

const POSES = {
  idle0: { bob: 0, legs: [[13, 0], [19, 0]], arm: 'down' },
  idle1: { bob: 1, legs: [[13, 0], [19, 0]], arm: 'down' },
  run0: { bob: 0, legs: [[9, 2], [21, 0]], arm: 'run', swing: 1 },
  run1: { bob: -1, legs: [[11, 0], [20, 1]], arm: 'run', swing: 0 },
  run2: { bob: 0, legs: [[16, 3], [17, 0]], arm: 'run', swing: -1 },
  run3: { bob: 0, legs: [[21, 0], [9, 2]], arm: 'run', swing: -1 },
  run4: { bob: -1, legs: [[20, 1], [11, 0]], arm: 'run', swing: 0 },
  run5: { bob: 0, legs: [[17, 0], [16, 3]], arm: 'run', swing: 1 },
  jump0: { bob: -1, legs: [[11, 4], [21, 1]], arm: 'up', tuck: true },
  jump1: { bob: 0, legs: [[12, 1], [20, 3]], arm: 'run', swing: 1 },
  shoot0: { bob: 0, legs: [[12, 0], [20, 0]], arm: 'aim' },
  shoot1: { bob: 0, legs: [[12, 0], [20, 0]], arm: 'aim', flash: true },
  hurt: { bob: 1, legs: [[11, 0], [18, 1]], arm: 'hurt', lean: -1 },
  win0: { bob: 0, legs: [[12, 0], [20, 0]], arm: 'win' },
  win1: { bob: -1, legs: [[12, 0], [20, 0]], arm: 'win2' },
};

function drawLeg(p, hipX, hipY, footX, lift, color) {
  const footY = 44 - lift;
  // штанина (3 px)
  p.line(hipX, hipY, footX, footY - 1, color, 3);
  p.line(hipX + 1, hipY, footX + 1, footY - 1, C.pantsLight, 1);
  // ботинок
  p.rect(footX - 1, footY, 5, 3, C.boot);
}

/** Рисует один кадр: возвращает { body, helmet, generic } (generic — обезличенное лицо). */
export function drawHeroFrame(name) {
  const pose = POSES[name];
  const body = new PixelArt(HERO_W, HERO_H);
  const helmet = new PixelArt(HERO_W, HERO_H);
  const b = pose.bob;
  const lean = pose.lean || 0;

  // --- ноги ---
  const hipY = 33 + b;
  const [back, front] = pose.legs;
  drawLeg(body, back[0], hipY, back[0] + (pose.tuck ? 1 : 0), back[1], C.pants);
  drawLeg(body, front[0] - 1, hipY, front[0] - 1, front[1], C.pants);

  // --- задняя рука с планшетом под мышкой ---
  const ty = 22 + b;
  body.rect(8 + lean, ty + 1, 5, 9, C.tablet); // планшет
  body.rect(9 + lean, ty + 2, 3, 6, C.paper);
  body.rect(9 + lean, ty + 3, 3, 1, SHADE.grayMid);
  body.rect(9 + lean, ty + 5, 3, 1, SHADE.grayMid);
  body.rect(10 + lean, ty, 2, 2, C.device); // зажим

  // --- торс: рубашка и жилет ---
  const tx = 10 + lean;
  body.rect(tx, 21 + b, 12, 13, C.shirt);
  body.rect(tx + 1, 21 + b, 10, 12, C.vest); // жилет
  body.rect(tx + 5, 21 + b, 2, 12, C.shirt); // молния/рубашка
  body.rect(tx + 1, 21 + b, 10, 1, C.vestLight);
  // светоотражающие полосы
  body.rect(tx + 1, 26 + b, 4, 1, C.stripe);
  body.rect(tx + 7, 26 + b, 4, 1, C.stripe);
  body.rect(tx + 1, 30 + b, 4, 1, C.stripe);
  body.rect(tx + 7, 30 + b, 4, 1, C.stripe);
  // красная «галочка» на груди — знак «проверено экспертом»
  body.set(tx + 8, 23 + b, C.badge);
  body.set(tx + 9, 24 + b, C.badge);
  body.set(tx + 10, 23 + b, C.badge);
  body.set(tx + 10, 22 + b, C.badge);
  // ремень
  body.rect(tx, 33 + b, 12, 1, C.out);

  // шея
  body.rect(14 + lean, 20 + b, 4, 1, C.skinShade);

  // --- передняя рука с лазерным нивелиром ---
  const sx = 19 + lean; // плечо
  const sy = 23 + b;
  // Поднятая рука рисуется поверх лица (в верхнем слое), опущенная — в слое тела.
  const arm = ['win', 'win2', 'up', 'hurt'].includes(pose.arm) ? helmet : body;
  let hand;
  switch (pose.arm) {
    case 'aim':
      arm.line(sx, sy, sx + 6, sy + 2, C.shirt, 3);
      hand = [sx + 7, sy + 2];
      break;
    case 'up':
      arm.line(sx, sy, sx + 6, sy - 4, C.shirt, 3);
      hand = [sx + 7, sy - 5];
      break;
    case 'win':
      arm.line(sx, sy, sx + 5, sy - 7, C.shirt, 3);
      hand = [sx + 6, sy - 9];
      break;
    case 'win2':
      arm.line(sx, sy, sx + 6, sy - 8, C.shirt, 3);
      hand = [sx + 7, sy - 10];
      break;
    case 'hurt':
      arm.line(sx, sy, sx + 5, sy - 3, C.shirt, 3);
      hand = [sx + 6, sy - 4];
      break;
    case 'run': {
      const s = pose.swing || 0;
      arm.line(sx, sy, sx + 2 + s * 2, sy + 6, C.shirt, 3);
      hand = [sx + 3 + s * 2, sy + 7];
      break;
    }
    default:
      arm.line(sx, sy, sx + 2, sy + 7, C.shirt, 3);
      hand = [sx + 2, sy + 8];
  }
  // кисть
  arm.rect(hand[0] - 1, hand[1] - 1, 3, 3, C.skin);
  // нивелир: корпус + красное окно
  if (pose.arm === 'win' || pose.arm === 'win2') {
    arm.rect(hand[0] - 2, hand[1] - 4, 5, 3, C.device);
    arm.set(hand[0] + 2, hand[1] - 3, C.laser);
  } else {
    arm.rect(hand[0], hand[1] - 2, 5, 3, C.device);
    arm.set(hand[0] + 4, hand[1] - 1, C.laser);
    if (pose.flash) {
      arm.set(hand[0] + 5, hand[1] - 1, C.laser);
      arm.set(hand[0] + 5, hand[1] - 2, SHADE.redLight);
      arm.set(hand[0] + 5, hand[1], SHADE.redLight);
    }
  }

  // --- голова (обезличенный вариант — рисуем отдельно) ---
  const hy = FACE.y + b;
  const hx = FACE.x + lean;
  const generic = new PixelArt(HERO_W, HERO_H);
  generic.ellipse(hx + 5.5, hy + 7, 5.5, 6.6, C.skin);
  generic.rect(hx + 1, hy + 4, 10, 1, C.skinLight);
  // уши
  generic.rect(hx - 1, hy + 7, 1, 3, C.skinShade);
  generic.rect(hx + 12, hy + 7, 1, 3, C.skinShade);
  // брови, глаза
  generic.rect(hx + 3, hy + 6, 2, 1, SHADE.blackMid);
  generic.rect(hx + 8, hy + 6, 2, 1, SHADE.blackMid);
  generic.rect(hx + 3, hy + 8, 2, 2, C.out);
  generic.rect(hx + 8, hy + 8, 2, 2, C.out);
  generic.set(hx + 3, hy + 8, BRAND.white);
  generic.set(hx + 8, hy + 8, BRAND.white);
  // нос, улыбка
  generic.rect(hx + 6, hy + 10, 1, 2, C.skinShade);
  generic.rect(hx + 4, hy + 13, 4, 1, C.skinDark);
  generic.set(hx + 8, hy + 12, C.skinDark);
  // щетина/подбородок
  generic.rect(hx + 3, hy + 14, 6, 1, C.skinShade);

  // --- каска (поверх лица) ---
  const cy = 2 + b;
  helmet.ellipse(16 + lean, cy + 5, 7, 5, C.helmet);
  helmet.rect(8 + lean, cy + 5, 17, 3, C.helmet); // обрезаем низ эллипса полями
  helmet.rect(7 + lean, cy + 7, 19, 2, C.helmetShade); // поля каски
  helmet.rect(7 + lean, cy + 8, 19, 1, C.helmetDark);
  helmet.rect(15 + lean, cy, 3, 7, C.helmetShade); // ребро жёсткости
  helmet.rect(12 + lean, cy + 2, 2, 2, BRAND.white);
  helmet.rect(19 + lean, cy + 4, 4, 2, BRAND.blue); // фирменная синяя наклейка
  // купол не должен вылезать ниже полей каски — иначе на лбу появляется белое пятно
  for (let y = cy + 9; y < cy + 14; y++) for (let x = 0; x < HERO_W; x++) if (helmet.get(x, y) === C.helmet) helmet.set(x, y, -1);
  return { body, helmet, generic, face: { x: hx, y: hy, w: FACE.w, h: FACE.h } };
}

/** Собирает кадр целиком. face — PixelArt FACE.w×FACE.h или null (тогда обезличенное лицо). */
export function composeHeroFrame(parts, face) {
  const out = new PixelArt(HERO_W, HERO_H);
  out.blit(parts.body);
  if (face) out.blit(face, parts.face.x, parts.face.y);
  else out.blit(parts.generic);
  out.blit(parts.helmet);
  out.outline(C.out);
  return out;
}

/** Палитра для шаблона: символ → цвет. */
export function templatePalette() {
  const colors = [...new Set([...Object.values(C), ...Object.values(BRAND), ...Object.values(SHADE), ...SKIN])];
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const pal = {};
  colors.forEach((c, i) => (pal[chars[i]] = '#' + c.toString(16).padStart(6, '0')));
  return pal;
}
