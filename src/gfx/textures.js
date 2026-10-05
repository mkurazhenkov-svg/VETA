// Вся графика игры рисуется кодом в фирменной палитре (пиксель-арт). Файлов-картинок нет.
import { PixelArt, rng } from './PixelArt.js';
import { BRAND, SHADE, SKIN } from '../palette.js';
import { HERO_W, HERO_H, HERO_FRAMES, drawHeroFrame, composeHeroFrame } from './heroRig.js';

const K = BRAND.black;
const W = BRAND.white;
const G = BRAND.gray;

// Номера кадров в тайлсете уровня.
export const T = {
  TOP: 1,
  TOP2: 2,
  FILL: 3,
  FILL2: 4,
  PLANK: 5,
  CRATE: 6,
  WALL: 7,
  WALL2: 8,
  // декор (без столкновений)
  COLUMN: 9,
  REBAR: 10,
  PIPE_V: 11,
  PIPE_H: 12,
  PUDDLE: 13,
  POST: 14,
  SCAFFOLD: 15,
  WINDOW: 16,
  LAMP: 17,
  CEIL: 18,
  BRACE: 19,
  CABLE: 20,
};
export const SOLID_TILES = [T.TOP, T.TOP2, T.FILL, T.FILL2, T.CRATE, T.WALL, T.WALL2, T.CEIL];

function canvasTex(scene, key, w, h) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.createCanvas(key, w, h);
}

/** Набор кадров одного размера в одну текстуру (кадры с номерами 0..n-1). */
export function sheet(scene, key, fw, fh, arts) {
  const tex = canvasTex(scene, key, fw * arts.length, fh);
  arts.forEach((a, i) => {
    a.drawTo(tex.context, i * fw, 0);
    tex.add(i, 0, i * fw, 0, fw, fh);
  });
  tex.refresh();
  return tex;
}

export function single(scene, key, art) {
  const tex = canvasTex(scene, key, art.w, art.h);
  art.drawTo(tex.context, 0, 0);
  tex.refresh();
  return tex;
}

function outlined(p, c = K) {
  return p.outline(c);
}

// ---------------------------------------------------------------- тайлы

function speckle(p, r, colors, n, x0 = 0, y0 = 0, w = 16, h = 16) {
  for (let i = 0; i < n; i++) p.set(x0 + Math.floor(r() * w), y0 + Math.floor(r() * h), colors[Math.floor(r() * colors.length)]);
}

const STYLES = {
  1: {
    // Котлован: бетонная плита и грунт основания
    top(p, r, v) {
      p.rect(0, 0, 16, 16, SHADE.grayDark);
      speckle(p, r, [SHADE.grayMid, SHADE.blackLight], 22, 0, 4, 16, 12);
      p.rect(0, 0, 16, 3, G);
      p.rect(0, 3, 16, 1, SHADE.grayMid);
      p.rect(0, 4, 16, 1, SHADE.blackLight);
      if (v) speckle(p, r, [W], 3, 0, 0, 16, 2);
    },
    fill(p, r, v) {
      p.rect(0, 0, 16, 16, SHADE.blackLight);
      speckle(p, r, [SHADE.blackMid, SHADE.grayDark], v ? 26 : 18);
    },
    wall(p, r) {
      p.rect(0, 0, 16, 16, SHADE.grayMid);
      p.rect(0, 0, 16, 1, G);
      p.rect(0, 15, 16, 1, SHADE.grayDark);
      speckle(p, r, [SHADE.grayDark], 10);
    },
  },
  2: {
    // Каркас: монолитный бетон
    top(p, r, v) {
      p.rect(0, 0, 16, 16, SHADE.grayMid);
      speckle(p, r, [SHADE.grayDark, G], 18, 0, 3, 16, 13);
      p.rect(0, 0, 16, 2, G);
      p.rect(0, 2, 16, 1, W);
      p.rect(0, 15, 16, 1, SHADE.grayDark);
      if (v) p.rect(5, 6, 1, 4, SHADE.grayDark);
    },
    fill(p, r, v) {
      p.rect(0, 0, 16, 16, SHADE.grayDark);
      speckle(p, r, [SHADE.grayMid, SHADE.blackLight], v ? 20 : 14);
      if (v) p.circle(8, 8, 1, SHADE.blackLight);
    },
    wall(p, r) {
      p.rect(0, 0, 16, 16, SHADE.grayMid);
      p.rect(0, 0, 1, 16, G);
      p.rect(15, 0, 1, 16, SHADE.grayDark);
      speckle(p, r, [SHADE.grayDark], 8);
    },
  },
  3: {
    // Отделка: плитка на полу, стяжка, гипсокартон
    top(p, r, v) {
      p.rect(0, 0, 16, 16, SHADE.grayMid);
      speckle(p, r, [SHADE.grayDark], 10, 0, 5, 16, 11);
      p.rect(0, 0, 16, 4, v ? G : W);
      p.rect(0, 0, 16, 1, W);
      p.rect(v ? 0 : 8, 0, 1, 4, SHADE.grayMid);
      p.rect(0, 4, 16, 1, SHADE.grayDark);
    },
    fill(p, r, v) {
      p.rect(0, 0, 16, 16, SHADE.grayDark);
      speckle(p, r, [SHADE.grayMid, SHADE.blackLight], v ? 16 : 10);
    },
    wall(p, r, v) {
      // гипсокартон / плитка санузла
      if (v) {
        p.rect(0, 0, 16, 16, W);
        p.rect(0, 7, 16, 1, SHADE.grayMid);
        p.rect(0, 15, 16, 1, SHADE.grayMid);
        p.rect(7, 0, 1, 7, SHADE.grayMid);
        p.rect(15, 8, 1, 7, SHADE.grayMid);
        p.rect(0, 3, 16, 1, SHADE.blueLighter);
      } else {
        p.rect(0, 0, 16, 16, G);
        p.rect(15, 0, 1, 16, SHADE.grayMid);
        p.set(3, 4, SHADE.grayMid);
        p.set(3, 12, SHADE.grayMid);
        p.set(12, 4, SHADE.grayMid);
        p.set(12, 12, SHADE.grayMid);
      }
    },
  },
};

function plank(p) {
  p.rect(0, 0, 16, 5, BRAND.blue);
  p.rect(0, 0, 16, 1, SHADE.blueLighter);
  p.rect(0, 4, 16, 1, SHADE.blueDark);
  p.set(2, 2, SHADE.blueDark);
  p.set(13, 2, SHADE.blueDark);
  p.rect(7, 1, 1, 3, SHADE.blueMid);
}

function crate(p, style) {
  if (style === 3) {
    // коробки с плиткой
    p.rect(0, 0, 16, 16, SHADE.grayMid);
    p.rect(1, 1, 14, 14, G);
    p.rect(1, 6, 14, 2, BRAND.blue);
    p.rect(0, 0, 16, 1, SHADE.grayDark);
    p.rect(0, 15, 16, 1, SHADE.grayDark);
    p.rect(0, 0, 1, 16, SHADE.grayDark);
    p.rect(15, 0, 1, 16, SHADE.grayDark);
    return;
  }
  // щит опалубки
  p.rect(0, 0, 16, 16, BRAND.blue);
  p.rect(2, 2, 12, 12, SHADE.blueLight);
  p.line(2, 13, 13, 2, BRAND.blue, 2);
  p.rect(0, 0, 16, 1, SHADE.blueLighter);
  p.rect(0, 15, 16, 1, SHADE.blueDark);
  p.rect(15, 0, 1, 16, SHADE.blueDark);
  p.set(1, 1, W);
  p.set(14, 14, SHADE.blueDark);
}

function ceil(p, r) {
  p.rect(0, 0, 16, 16, SHADE.grayMid);
  speckle(p, r, [SHADE.grayDark], 8);
  p.rect(0, 14, 16, 2, SHADE.grayDark);
  p.rect(0, 15, 16, 1, SHADE.blackLight);
}

function column(p, style) {
  const c1 = style === 3 ? G : SHADE.grayMid;
  p.rect(2, 0, 12, 16, c1);
  p.rect(2, 0, 2, 16, style === 3 ? W : G);
  p.rect(12, 0, 2, 16, SHADE.grayDark);
  if (style !== 3) {
    p.set(7, 4, SHADE.grayDark);
    p.set(9, 11, SHADE.grayDark);
  }
}

function decorTiles(p, idx, style, r) {
  switch (idx) {
    case T.COLUMN:
      column(p, style);
      break;
    case T.REBAR:
      [3, 8, 13].forEach((x, i) => {
        p.rect(x, 2 + i, 1, 14 - i, SHADE.blackLight);
        p.set(x, 2 + i, SHADE.grayDark);
      });
      p.rect(2, 9, 13, 1, SHADE.blackMid);
      break;
    case T.PIPE_V:
      p.rect(5, 0, 6, 16, SHADE.grayMid);
      p.rect(5, 0, 2, 16, W);
      p.rect(10, 0, 1, 16, SHADE.grayDark);
      p.rect(4, 6, 8, 2, SHADE.grayDark);
      break;
    case T.PIPE_H:
      p.rect(0, 5, 16, 6, SHADE.grayMid);
      p.rect(0, 5, 16, 2, W);
      p.rect(0, 10, 16, 1, SHADE.grayDark);
      p.rect(7, 4, 2, 8, SHADE.grayDark);
      break;
    case T.PUDDLE:
      p.rect(2, 14, 12, 2, SHADE.blueLight);
      p.rect(4, 14, 5, 1, SHADE.blueLighter);
      p.rect(1, 15, 1, 1, SHADE.blueLight);
      p.rect(14, 15, 1, 1, SHADE.blueLight);
      break;
    case T.POST:
      p.rect(6, 0, 4, 16, SHADE.blackLight);
      p.rect(6, 0, 1, 16, SHADE.grayDark);
      break;
    case T.SCAFFOLD:
      p.rect(0, 0, 2, 16, SHADE.blueLight);
      p.rect(14, 0, 2, 16, SHADE.blueLight);
      p.line(1, 15, 14, 1, SHADE.blueDark, 1);
      p.rect(0, 0, 16, 1, SHADE.blueLight);
      break;
    case T.WINDOW:
      p.rect(1, 1, 14, 14, SHADE.grayMid);
      p.rect(2, 2, 12, 12, SHADE.blueNight);
      p.rect(7, 2, 2, 12, SHADE.grayMid);
      p.rect(2, 7, 12, 1, SHADE.grayMid);
      p.set(4, 4, W);
      p.set(11, 10, SHADE.blueLighter);
      p.line(3, 13, 6, 9, SHADE.blueDusk, 1);
      break;
    case T.LAMP:
      p.rect(7, 0, 2, 6, SHADE.blackLight);
      p.rect(3, 6, 10, 3, SHADE.blackMid);
      p.rect(4, 9, 8, 1, W);
      break;
    case T.BRACE:
      p.line(0, 15, 15, 0, SHADE.blackLight, 1);
      p.line(0, 0, 15, 15, SHADE.blackLight, 1);
      break;
    case T.CABLE:
      p.rect(7, 0, 1, 16, SHADE.blackMid);
      break;
    default:
      break;
  }
}

/** Тайлсет уровня: 8×3 кадра по 16×16. */
export function makeTileset(scene, style) {
  const key = `tiles-${style}`;
  const tex = canvasTex(scene, key, 16 * 8, 16 * 3);
  const r = rng(style * 977);
  const S = STYLES[style];
  for (let idx = 1; idx < 24; idx++) {
    const p = new PixelArt(16, 16);
    switch (idx) {
      case T.TOP:
        S.top(p, r, false);
        break;
      case T.TOP2:
        S.top(p, r, true);
        break;
      case T.FILL:
        S.fill(p, r, false);
        break;
      case T.FILL2:
        S.fill(p, r, true);
        break;
      case T.PLANK:
        plank(p);
        break;
      case T.CRATE:
        crate(p, style);
        break;
      case T.WALL:
        S.wall(p, r, false);
        break;
      case T.WALL2:
        S.wall(p, r, true);
        break;
      case T.CEIL:
        ceil(p, r);
        break;
      default:
        decorTiles(p, idx, style, r);
    }
    p.drawTo(tex.context, (idx % 8) * 16, Math.floor(idx / 8) * 16);
    tex.add(idx, 0, (idx % 8) * 16, Math.floor(idx / 8) * 16, 16, 16);
  }
  tex.refresh();
  return key;
}

/** Один кадр тайлсета как отдельная картинка (для дефектов, которые «прикидываются» отделкой). */
export function tileArt(style, idx) {
  const p = new PixelArt(16, 16);
  const r = rng(style * 977 + idx);
  const S = STYLES[style];
  if (idx === T.TOP) S.top(p, r, false);
  else if (idx === T.FILL) S.fill(p, r, false);
  else if (idx === T.WALL) S.wall(p, r, false);
  else if (idx === T.WALL2) S.wall(p, r, true);
  else if (idx === T.CEIL) ceil(p, r);
  else decorTiles(p, idx, style, r);
  return p;
}

// ---------------------------------------------------------------- герой

export function makeHero(scene) {
  const arts = HERO_FRAMES.map((name) => composeHeroFrame(drawHeroFrame(name), null));
  sheet(scene, 'hero', HERO_W, HERO_H, arts);
}

// ---------------------------------------------------------------- овцы и волки

function wool(p, cx, cy, bob, shade = true) {
  const blobs = [
    [cx - 6, cy - 2, 3.4],
    [cx - 2, cy - 4, 3.6],
    [cx + 3, cy - 4, 3.6],
    [cx + 7, cy - 1, 3.2],
    [cx - 7, cy + 2, 3],
    [cx + 6, cy + 3, 3],
    [cx, cy + 1, 5.5],
  ];
  p.ellipse(cx, cy, 8.5, 5, W);
  blobs.forEach(([x, y, r]) => p.circle(x, y + bob, r, W));
  if (shade) {
    for (let x = cx - 9; x <= cx + 9; x++) {
      for (let y = cy + 2; y <= cy + 9; y++) {
        if (p.get(x, y) === W && p.get(x, y + 1) === -1) p.set(x, y, G);
      }
    }
    p.set(cx - 3, cy - 5 + bob, G);
    p.set(cx + 2, cy - 6 + bob, G);
  }
}

function sheepArt({ frame = 0, helmet = false, wolf = false, papers = 0, happy = false }) {
  const p = new PixelArt(28, 22);
  const bob = frame === 1 ? -1 : 0;
  // ноги
  const legs = frame === 1 ? [7, 10, 15, 18] : [6, 9, 16, 19];
  legs.forEach((x) => p.rect(x, 16, 2, 5, K));
  // хвост волка торчит из-под шкуры
  if (wolf) {
    p.line(1, 15, 4, 11, SHADE.blackLight, 3);
    p.rect(0, 15, 2, 2, SHADE.grayDark);
    p.set(1, 17, SHADE.grayDark);
  }
  wool(p, 12, 11 + bob, 0);
  // голова
  const hx = 21;
  const hy = 8 + bob;
  if (wolf) {
    // волчьи уши сквозь шерсть
    p.rect(hx - 1, hy - 5, 2, 3, SHADE.grayDark);
    p.rect(hx + 3, hy - 5, 2, 3, SHADE.grayDark);
  }
  p.ellipse(hx + 2, hy + 1, 3.4, 3.8, SHADE.blackSoft);
  p.rect(hx + 3, hy + 2, 3, 2, SHADE.blackSoft);
  p.rect(hx - 2, hy - 1, 2, 2, SHADE.blackSoft); // ухо
  p.set(hx + 3, hy, happy ? SHADE.grayMid : W);
  p.set(hx + 4, hy, wolf ? BRAND.red : K);
  if (happy) p.set(hx + 4, hy, SHADE.grayMid);
  // чёлка
  p.circle(hx + 1, hy - 2, 2, W);
  if (helmet) {
    p.ellipse(hx + 2, hy - 3, 3.5, 2, BRAND.blue);
    p.rect(hx - 1, hy - 2, 7, 1, SHADE.blueDark);
    p.set(hx + 1, hy - 4, SHADE.blueLighter);
  }
  if (papers) {
    const py = papers === 2 ? 4 : 9;
    p.rect(19, py, 7, 8, W);
    p.rect(20, py + 2, 5, 1, SHADE.grayMid);
    p.rect(20, py + 4, 5, 1, SHADE.grayMid);
    p.rect(20, py + 6, 3, 1, SHADE.grayMid);
  }
  return outlined(p);
}

function wolfArt({ frame = 0, kind = 'sub' }) {
  const p = new PixelArt(28, 22);
  const run = frame === 3;
  const shock = frame === 2;
  const bob = frame === 1 ? -1 : 0;
  const by = run ? 13 : 12;
  // ноги
  let legs;
  if (run) legs = [[3, 2], [8, 0], [15, 2], [20, 0]];
  else legs = frame === 1 ? [[6, 0], [9, 0], [15, 0], [18, 0]] : [[5, 0], [10, 0], [14, 0], [19, 0]];
  legs.forEach(([x, l]) => p.rect(x, 16 - l + (run ? 1 : 0), 2, 5 + l - (run ? 1 : 0), SHADE.blackLight));
  // хвост
  p.line(1, by - 1, 4, by + 2, SHADE.blackLight, 3);
  p.set(0, by - 2, SHADE.grayDark);
  // тело
  p.ellipse(12, by + bob, 9, 4.6, SHADE.grayDark);
  p.ellipse(12, by + 2 + bob, 6, 2.2, G); // светлое брюхо
  // голова
  const hx = 20;
  const hy = (run ? 9 : 7) + bob;
  p.ellipse(hx + 1, hy + 1, 4.4, 3.8, SHADE.grayDark);
  p.rect(hx + 3, hy + 1, 5, 3, SHADE.grayDark); // морда
  p.rect(hx + 3, hy + 3, 5, 1, G);
  p.set(hx + 7, hy + 1, K); // нос
  // уши
  if (shock) {
    p.rect(hx - 3, hy - 2, 3, 2, SHADE.blackLight);
  } else {
    p.rect(hx - 2, hy - 4, 2, 3, SHADE.blackLight);
    p.rect(hx + 1, hy - 5, 2, 3, SHADE.blackLight);
  }
  // глаз
  if (shock) {
    p.rect(hx + 1, hy - 1, 3, 3, W);
    p.set(hx + 2, hy, K);
    p.rect(hx + 5, hy + 3, 2, 2, K); // открытый рот
  } else {
    p.rect(hx + 1, hy, 2, 2, W);
    p.set(hx + 2, hy, K);
    p.rect(hx, hy - 1, 3, 1, K); // хмурая бровь
  }
  if (kind === 'sub') {
    // синий шейный платок субподрядчика
    p.rect(hx - 2, hy + 4, 4, 2, BRAND.blue);
  } else if (kind === 'est') {
    // очки сметчика и кипа бумаг
    p.rect(hx, hy - 1, 4, 1, W);
    p.rect(hx, hy - 1, 1, 3, W);
    p.rect(hx + 3, hy - 1, 1, 3, W);
    const py = frame === 1 ? 2 : 8;
    p.rect(18, py, 7, 8, W);
    p.rect(19, py + 2, 5, 1, SHADE.grayMid);
    p.rect(19, py + 4, 5, 1, SHADE.grayMid);
  }
  return outlined(p);
}

function hiderArt(style, frame) {
  const p = new PixelArt(18, 32);
  // хвост торчит из-за панелей
  const ty = frame === 1 ? 26 : 27;
  p.line(13, ty + 3, 17, ty - 1, SHADE.blackLight, 3);
  p.set(17, ty - 2, SHADE.grayDark);
  p.set(16, ty - 2, SHADE.grayDark);
  if (style === 3) {
    // листы гипсокартона
    p.rect(1, 0, 14, 32, G);
    p.rect(1, 0, 14, 1, W);
    p.rect(8, 0, 1, 32, SHADE.grayMid);
    p.rect(3, 2, 10, 1, W);
    p.rect(1, 31, 14, 1, SHADE.grayDark);
    p.set(4, 10, SHADE.grayMid);
    p.set(11, 22, SHADE.grayMid);
  } else {
    // прислонённые щиты опалубки
    p.rect(1, 2, 13, 30, BRAND.blue);
    p.rect(3, 4, 9, 26, SHADE.blueLight);
    p.line(3, 29, 11, 5, BRAND.blue, 2);
    p.rect(1, 2, 13, 1, SHADE.blueLighter);
    p.rect(4, 0, 12, 3, SHADE.blueDark);
    p.rect(14, 4, 2, 28, SHADE.blueDark);
  }
  return outlined(p);
}

export function makeCreatures(scene) {
  sheet(scene, 'sheep', 28, 22, [
    sheepArt({ frame: 0, helmet: true }),
    sheepArt({ frame: 1, helmet: true }),
    sheepArt({ frame: 0, helmet: true, happy: true }),
  ]);
  sheet(scene, 'wolfskin', 28, 22, [sheepArt({ frame: 0, wolf: true }), sheepArt({ frame: 1, wolf: true })]);
  sheet(scene, 'estskin', 28, 22, [
    sheepArt({ frame: 0, wolf: true, papers: 1 }),
    sheepArt({ frame: 1, wolf: true, papers: 2 }),
  ]);
  sheet(scene, 'wolf', 28, 22, [0, 1, 2, 3].map((f) => wolfArt({ frame: f, kind: 'sub' })));
  sheet(scene, 'est', 28, 22, [0, 1, 2, 3].map((f) => wolfArt({ frame: f, kind: 'est' })));
  sheet(scene, 'hider-1', 18, 32, [hiderArt(1, 0), hiderArt(1, 1)]);
  sheet(scene, 'hider-3', 18, 32, [hiderArt(3, 0), hiderArt(3, 1)]);
}

// ---------------------------------------------------------------- босс

function bossArt(frame) {
  const exposed = frame >= 3;
  const p = new PixelArt(60, 68);
  const lean = frame === 2 ? 2 : 0;
  const bob = frame === 5 ? -1 : 0;
  // ноги и ботинки
  const legC = exposed ? SHADE.blackSoft : W;
  const ls = frame === 5 ? [[18, 0], [34, 2]] : [[20, 0], [32, 0]];
  ls.forEach(([x, l]) => {
    p.rect(x, 50 - l, 8, 14, legC);
    p.rect(x - 1, 63 - l, 11, 4, K);
  });
  // хвост
  p.line(8, 44, 4, 34, SHADE.blackLight, 5);
  p.circle(4, 33, 3, SHADE.grayDark);
  // торс
  if (exposed) {
    p.ellipse(28 + lean, 38 + bob, 16, 14, SHADE.grayDark); // шерсть
    p.rect(19 + lean, 26 + bob, 18, 24, G); // рубашка
    p.rect(26 + lean, 27 + bob, 4, 18, BRAND.blue); // галстук
    p.rect(27 + lean, 45 + bob, 2, 2, BRAND.blue);
    p.rect(19 + lean, 26 + bob, 2, 24, SHADE.grayMid);
    p.rect(35 + lean, 26 + bob, 2, 24, SHADE.grayMid);
  } else {
    // костюм из овечьей шерсти
    p.ellipse(28 + lean, 39 + bob, 17, 15, W);
    [
      [14, 30, 5],
      [22, 26, 5],
      [32, 25, 5],
      [41, 30, 5],
      [13, 44, 5],
      [43, 45, 5],
      [28, 52, 6],
    ].forEach(([x, y, r]) => p.circle(x + lean, y + bob, r, W));
    for (let x = 8; x < 52; x++)
      for (let y = 30; y < 60; y++) if (p.get(x, y) === W && p.get(x, y + 1) === -1) p.set(x, y, G);
    p.rect(26 + lean, 28 + bob, 4, 14, BRAND.blue); // галстук
    p.rect(23 + lean, 27 + bob, 10, 2, G); // воротник
  }
  // руки
  const armC = exposed ? SHADE.grayDark : W;
  if (frame === 1) {
    p.line(42, 32, 52, 16, armC, 6);
    p.circle(53, 14, 3, SHADE.grayDark);
  } else {
    p.line(42 + lean, 32 + bob, 48 + lean, 46 + bob, armC, 6);
    p.circle(49 + lean, 48 + bob, 3, SHADE.grayDark);
  }
  p.line(14 + lean, 32 + bob, 10 + lean, 46 + bob, armC, 6);
  // голова
  const hx = 30 + lean;
  const hy = 14 + bob + (frame === 2 ? 2 : 0);
  p.ellipse(hx, hy, 10, 9, SHADE.grayDark);
  p.rect(hx + 4, hy + 1, 12, 7, SHADE.grayDark); // морда
  p.rect(hx + 4, hy + 6, 12, 2, G);
  p.rect(hx + 14, hy + 1, 3, 3, K); // нос
  // уши
  p.rect(hx - 8, hy - 13, 4, 7, SHADE.blackLight);
  p.rect(hx - 1, hy - 14, 4, 7, SHADE.blackLight);
  p.set(hx - 7, hy - 11, G);
  p.set(hx, hy - 12, G);
  // глаза
  if (frame === 2 || frame === 4) {
    p.line(hx + 1, hy - 3, hx + 5, hy + 1, K, 1);
    p.line(hx + 1, hy + 1, hx + 5, hy - 3, K, 1);
  } else {
    p.rect(hx + 1, hy - 3, 5, 4, W);
    p.rect(hx + 4, hy - 2, 2, 2, K);
    p.line(hx, hy - 5, hx + 7, hy - 3, K, 1); // бровь
  }
  // ухмылка с зубами
  p.rect(hx + 6, hy + 8, 9, 1, K);
  if (frame !== 4) {
    p.set(hx + 8, hy + 7, W);
    p.set(hx + 12, hy + 7, W);
  }
  return outlined(p);
}

export function makeBoss(scene) {
  sheet(scene, 'boss', 60, 68, [0, 1, 2, 3, 4, 5].map(bossArt));
  // щит «Заключение-пустышка»: бумага с пустой печатью
  const s = new PixelArt(26, 38);
  s.rect(1, 1, 24, 36, W);
  s.rect(1, 1, 24, 4, SHADE.grayMid);
  for (let y = 9; y < 22; y += 3) s.rect(4, y, 18, 1, SHADE.grayMid);
  s.circle(13, 29, 5, BRAND.blue);
  s.circle(13, 29, 3, W);
  s.rect(18, 1, 7, 7, G); // загнутый угол
  s.line(18, 1, 24, 7, SHADE.grayMid, 1);
  single(scene, 'shield', outlined(s));
}

// ---------------------------------------------------------------- предметы

function docArt(variant) {
  const p = new PixelArt(14, 16);
  const paper = variant === 5 ? SHADE.blueLight : W;
  p.rect(1, 1, 12, 14, paper);
  p.rect(9, 1, 4, 4, variant === 5 ? BRAND.blue : G); // загнутый угол
  p.line(9, 1, 12, 4, SHADE.grayMid, 1);
  const line = variant === 5 ? W : SHADE.grayMid;
  switch (variant) {
    case 1: // нотариальный: печать
      p.rect(3, 4, 6, 1, line);
      p.rect(3, 6, 7, 1, line);
      p.circle(7, 11, 2.4, BRAND.blue);
      p.set(7, 11, W);
      break;
    case 2: // фото
      p.rect(3, 4, 8, 7, SHADE.blueDark);
      p.rect(4, 8, 3, 3, SHADE.blueLighter);
      p.set(9, 5, W);
      p.rect(3, 12, 6, 1, line);
      break;
    case 3: // форма КС: таблица
      p.rect(3, 4, 8, 8, SHADE.grayMid);
      p.rect(4, 5, 6, 6, W);
      p.rect(4, 7, 6, 1, SHADE.grayMid);
      p.rect(6, 5, 1, 6, SHADE.grayMid);
      break;
    case 4: // письмо
      p.rect(3, 5, 8, 6, G);
      p.line(3, 5, 7, 8, SHADE.grayMid, 1);
      p.line(10, 5, 7, 8, SHADE.grayMid, 1);
      p.rect(3, 12, 5, 1, line);
      break;
    case 5: // исполнительная схема (синька)
      p.rect(3, 5, 7, 6, line);
      p.rect(4, 6, 5, 4, paper);
      p.rect(6, 6, 1, 4, line);
      break;
    case 6: // журнал работ — книжка
      p.rect(1, 1, 12, 14, BRAND.blue);
      p.rect(1, 1, 2, 14, SHADE.blueDark);
      p.rect(5, 4, 6, 3, W);
      p.rect(5, 9, 6, 1, SHADE.blueLighter);
      break;
    default:
      p.rect(3, 4, 6, 1, line);
      p.rect(3, 6, 8, 1, line);
      p.rect(3, 8, 8, 1, line);
      p.rect(3, 10, 5, 1, line);
      p.rect(3, 12, 3, 1, BRAND.blue); // подпись
  }
  return outlined(p);
}
export const DOC_VARIANT = { act: 0, scheme: 5, journal: 6, contract: 0, ks2: 3, ks3: 3, letters: 4, photos: 2, notary: 1 };

function checkArt(w, h, color = BRAND.red, thick = 2) {
  const p = new PixelArt(w, h);
  const mx = Math.round(w * 0.38);
  p.line(1, Math.round(h * 0.55), mx, h - 2, color, thick);
  p.line(mx, h - 2, w - 2, 1, color, thick);
  return p;
}

function helmetIcon(empty) {
  const p = new PixelArt(16, 12);
  if (empty) {
    p.ellipse(8, 7, 6, 5, SHADE.blackLight);
    p.rect(0, 7, 16, 5, -1);
    p.rect(1, 8, 14, 2, SHADE.blackLight);
    return p.outline(SHADE.blackSoft);
  }
  p.ellipse(8, 7, 6, 5, W);
  p.rect(0, 8, 16, 4, -1);
  p.rect(1, 8, 14, 2, G);
  p.rect(1, 10, 14, 1, SHADE.grayMid);
  p.rect(7, 2, 2, 6, G);
  p.rect(4, 4, 2, 2, W);
  p.rect(10, 5, 3, 2, BRAND.blue);
  return outlined(p);
}

function checkpointArt(frame) {
  const p = new PixelArt(18, 48);
  p.rect(3, 4, 2, 41, frame === 0 ? SHADE.grayDark : SHADE.grayMid); // шест
  p.rect(1, 44, 6, 3, K);
  p.rect(2, 2, 4, 3, frame === 0 ? SHADE.grayDark : BRAND.red);
  if (frame === 0) {
    // флажок опущен
    p.rect(5, 26, 11, 9, SHADE.grayMid);
    p.line(7, 30, 9, 32, W, 1);
    p.line(9, 32, 13, 27, W, 1);
  } else {
    const wave = frame === 2 ? 1 : 0;
    p.rect(5, 5, 12, 10, BRAND.red);
    p.rect(16, 5 + wave, 1, 10, BRAND.red);
    p.rect(5, 14, 12, 1, SHADE.redDark);
    p.line(7, 9, 9, 11, W, 1);
    p.line(9, 11, 14, 6, W, 1);
  }
  return outlined(p);
}

function gateArt() {
  const p = new PixelArt(72, 84);
  // фронтон
  for (let i = 0; i < 12; i++) p.rect(4 + i * 2.6, 12 - i, 64 - i * 5.2, 1, G);
  p.rect(2, 12, 68, 4, W);
  p.rect(2, 16, 68, 2, SHADE.grayMid);
  p.rect(30, 4, 12, 6, BRAND.blueDeep); // герб-плашка
  p.line(32, 7, 35, 9, BRAND.red, 1);
  p.line(35, 9, 40, 5, BRAND.red, 1);
  // колонны
  [4, 58].forEach((x) => {
    p.rect(x, 18, 10, 60, G);
    p.rect(x, 18, 2, 60, W);
    p.rect(x + 8, 18, 2, 60, SHADE.grayMid);
    p.rect(x + 4, 20, 1, 56, SHADE.grayMid);
    p.rect(x - 1, 18, 12, 3, W);
    p.rect(x - 1, 76, 12, 4, SHADE.grayMid);
  });
  // проём
  p.rect(14, 18, 44, 4, SHADE.grayDark);
  p.rect(14, 22, 44, 58, SHADE.blackSoft);
  // ступени
  p.rect(0, 80, 72, 2, SHADE.grayMid);
  p.rect(0, 82, 72, 2, SHADE.grayDark);
  return outlined(p);
}

function gateDoorArt() {
  const p = new PixelArt(22, 58);
  p.rect(0, 0, 22, 58, BRAND.blueDeep);
  p.rect(2, 2, 18, 25, SHADE.blueDusk);
  p.rect(2, 30, 18, 26, SHADE.blueDusk);
  p.rect(2, 2, 18, 1, SHADE.blueDeepLight);
  p.rect(2, 30, 18, 1, SHADE.blueDeepLight);
  p.rect(17, 28, 3, 3, G); // ручка
  return outlined(p);
}

function personArt(kind, frame) {
  const p = new PixelArt(22, 46);
  const suit = kind === 'lawyer' ? SHADE.blueDark : BRAND.blueDeep;
  // ноги
  p.rect(7, 34, 3, 10, SHADE.blackSoft);
  p.rect(12, 34, 3, 10, SHADE.blackSoft);
  p.rect(6, 43, 5, 3, K);
  p.rect(11, 43, 5, 3, K);
  // торс
  p.rect(5, 18, 12, 17, suit);
  p.rect(9, 18, 4, 9, W);
  p.rect(10, 19, 2, 7, kind === 'lawyer' ? BRAND.red : BRAND.blue); // галстук
  p.rect(4, 19, 2, 12, suit);
  p.rect(16, 19, 2, 12, suit);
  p.rect(4, 31, 2, 2, SKIN[1]);
  // папка у юриста
  if (kind === 'lawyer') {
    const fy = frame === 1 ? 22 : 25;
    p.rect(15, fy, 6, 9, BRAND.blue);
    p.rect(16, fy + 1, 4, 1, SHADE.blueLighter);
  } else p.rect(16, 31, 2, 2, SKIN[1]);
  // голова
  p.ellipse(11, 11, 5, 6, SKIN[1]);
  p.rect(6, 4, 10, 4, kind === 'lawyer' ? SHADE.blackSoft : SHADE.grayDark); // волосы
  p.rect(6, 4, 2, 7, kind === 'lawyer' ? SHADE.blackSoft : SHADE.grayDark);
  p.rect(12, 10, 2, 2, K);
  if (frame === 1) p.rect(12, 10, 2, 1, SKIN[2]);
  p.rect(12, 14, 3, 1, SKIN[3]);
  if (kind === 'client') {
    p.rect(11, 9, 5, 1, K); // очки
    p.rect(11, 9, 1, 3, K);
    p.rect(15, 9, 1, 3, K);
  }
  return outlined(p);
}

function portraitArt(kind) {
  const p = new PixelArt(32, 32);
  p.rect(0, 0, 32, 32, kind === 'hero' ? BRAND.blue : kind === 'lawyer' ? SHADE.blueDusk : SHADE.blueDeepLight);
  const suit = kind === 'hero' ? BRAND.blueDeep : kind === 'lawyer' ? SHADE.blueDark : BRAND.blueDeep;
  // плечи
  p.ellipse(16, 32, 14, 7, kind === 'hero' ? BRAND.blue : suit);
  if (kind === 'hero') {
    p.ellipse(16, 32, 14, 7, SHADE.blueLight);
    p.rect(3, 29, 26, 1, W);
    p.rect(14, 25, 4, 7, BRAND.blueDeep);
  } else {
    p.rect(13, 25, 6, 7, W);
    p.rect(15, 26, 2, 6, kind === 'lawyer' ? BRAND.red : BRAND.blue);
  }
  // шея и голова
  p.rect(13, 21, 6, 5, SKIN[2]);
  p.ellipse(16, 15, 8, 9, SKIN[1]);
  p.rect(9, 12, 14, 1, SKIN[0]);
  // уши
  p.rect(7, 14, 2, 4, SKIN[2]);
  p.rect(23, 14, 2, 4, SKIN[2]);
  // глаза, брови
  p.rect(11, 14, 3, 2, K);
  p.rect(18, 14, 3, 2, K);
  p.set(11, 14, W);
  p.set(18, 14, W);
  p.rect(10, 12, 4, 1, SHADE.blackSoft);
  p.rect(18, 12, 4, 1, SHADE.blackSoft);
  p.rect(15, 16, 2, 3, SKIN[2]);
  p.rect(13, 20, 6, 1, SKIN[3]);
  if (kind === 'hero') {
    // каска
    p.ellipse(16, 7, 10, 6, W);
    p.rect(5, 8, 22, 3, W);
    p.rect(4, 10, 24, 2, G);
    p.rect(15, 1, 3, 9, G);
    p.rect(20, 5, 4, 2, BRAND.blue);
    p.rect(12, 21, 8, 1, SKIN[2]); // щетина
  } else if (kind === 'client') {
    p.rect(8, 5, 16, 5, SHADE.grayDark);
    p.rect(8, 5, 3, 8, SHADE.grayDark);
    p.rect(10, 13, 12, 1, K); // очки
    p.rect(10, 13, 1, 4, K);
    p.rect(14, 13, 1, 4, K);
    p.rect(17, 13, 1, 4, K);
    p.rect(21, 13, 1, 4, K);
  } else {
    p.rect(8, 4, 16, 6, SHADE.blackSoft);
    p.rect(7, 6, 3, 10, SHADE.blackSoft);
    p.rect(22, 6, 3, 10, SHADE.blackSoft);
  }
  const out = new PixelArt(32, 32);
  out.blit(p);
  return out;
}

function projectileArt(kind) {
  const p = new PixelArt(12, 12);
  if (kind === 0) {
    // «пухлая смета»: раздутая пачка бумаги
    p.ellipse(6, 6, 5, 4.5, W);
    p.rect(3, 4, 6, 1, SHADE.grayMid);
    p.rect(3, 6, 6, 1, SHADE.grayMid);
    p.rect(3, 8, 4, 1, SHADE.grayMid);
    p.rect(8, 7, 2, 2, BRAND.red); // «+%»
  } else {
    // свёрнутый акт
    p.rect(1, 3, 10, 6, W);
    p.rect(1, 3, 2, 6, G);
    p.rect(9, 3, 2, 6, G);
    p.rect(5, 3, 2, 6, BRAND.blue);
  }
  return outlined(p);
}

function particle(c, w, h, round) {
  const p = new PixelArt(w, h);
  if (round) p.ellipse((w - 1) / 2, (h - 1) / 2, (w - 1) / 2, (h - 1) / 2, c);
  else p.rect(0, 0, w, h, c);
  return p;
}

function hookArt() {
  const p = new PixelArt(48, 18);
  // строп от крюка к краям поддона
  p.line(24, 4, 3, 11, SHADE.blackMid, 1);
  p.line(24, 4, 44, 11, SHADE.blackMid, 1);
  // крюк
  p.rect(21, 0, 6, 4, BRAND.red);
  p.rect(23, 4, 2, 3, SHADE.blackMid);
  // поддон (платформа)
  p.rect(0, 12, 48, 6, SHADE.blueDark);
  p.rect(0, 12, 48, 1, SHADE.blueLighter);
  p.rect(0, 17, 48, 1, K);
  for (let x = 4; x < 48; x += 8) p.rect(x, 14, 3, 2, SHADE.blueNight);
  return p;
}

function liftArt() {
  const p = new PixelArt(48, 70);
  // клеть
  p.rect(0, 0, 48, 3, SHADE.blackLight);
  p.rect(0, 0, 2, 64, SHADE.blackLight);
  p.rect(46, 0, 2, 64, SHADE.blackLight);
  for (let y = 10; y < 62; y += 10) {
    p.rect(2, y, 1, 1, SHADE.grayDark);
    p.rect(45, y, 1, 1, SHADE.grayDark);
  }
  p.line(2, 62, 22, 3, SHADE.blackMid, 1);
  p.line(46, 62, 26, 3, SHADE.blackMid, 1);
  // площадка
  p.rect(0, 64, 48, 6, BRAND.blue);
  p.rect(0, 64, 48, 1, SHADE.blueLighter);
  p.rect(0, 69, 48, 1, K);
  p.rect(20, 66, 8, 2, BRAND.red); // кнопка/знак
  return p;
}

function estwallArt(stamp) {
  const p = new PixelArt(16, 16);
  p.rect(0, 0, 16, 16, W);
  for (let y = 2; y < 16; y += 3) p.rect(1, y, 14, 1, SHADE.grayMid);
  p.rect(0, 0, 1, 16, G);
  p.rect(15, 0, 1, 16, SHADE.grayMid);
  p.rect(0, 15, 16, 1, SHADE.grayMid);
  if (stamp) {
    // красный штамп «%»
    p.rect(4, 4, 8, 8, BRAND.red);
    p.rect(5, 5, 6, 6, W);
    p.set(6, 6, BRAND.red);
    p.set(9, 9, BRAND.red);
    p.line(9, 6, 6, 9, BRAND.red, 1);
  }
  return p;
}

export function makeItems(scene) {
  sheet(scene, 'doc', 14, 16, [0, 1, 2, 3, 4, 5, 6].map(docArt));
  const empty = new PixelArt(14, 16);
  empty.rect(1, 1, 12, 14, SHADE.blueDark);
  empty.rect(9, 1, 4, 4, -1);
  empty.outline(SHADE.blueLight);
  single(scene, 'docEmpty', empty);
  single(scene, 'check', checkArt(12, 10));
  single(scene, 'checkBig', checkArt(24, 18, BRAND.red, 3));
  single(scene, 'checkWhite', checkArt(12, 10, W));
  single(scene, 'helm', helmetIcon(false));
  single(scene, 'helmEmpty', helmetIcon(true));
  sheet(scene, 'cp', 18, 48, [0, 1, 2].map(checkpointArt));
  single(scene, 'gate', gateArt());
  single(scene, 'gateDoor', gateDoorArt());
  sheet(scene, 'lawyer', 22, 46, [personArt('lawyer', 0), personArt('lawyer', 1)]);
  sheet(scene, 'client', 22, 46, [personArt('client', 0), personArt('client', 1)]);
  single(scene, 'pt-hero', portraitArt('hero'));
  single(scene, 'pt-client', portraitArt('client'));
  single(scene, 'pt-lawyer', portraitArt('lawyer'));
  sheet(scene, 'proj', 12, 12, [projectileArt(0), projectileArt(1)]);
  single(scene, 'drip', particle(SHADE.blueLighter, 3, 5, true));
  single(scene, 'wool', outlined(particle(W, 5, 5, true), G));
  single(scene, 'paperBit', particle(W, 4, 3));
  single(scene, 'dust', particle(SHADE.grayMid, 3, 3, true));
  single(scene, 'spark', particle(BRAND.red, 2, 2));
  single(scene, 'sparkW', particle(W, 2, 2));
  single(scene, 'hook', hookArt());
  single(scene, 'lift', liftArt());
  sheet(scene, 'estwall', 16, 16, [estwallArt(false), estwallArt(true)]);
  // вода
  const wtr = new PixelArt(16, 16);
  wtr.rect(0, 0, 16, 16, BRAND.blue);
  wtr.rect(3, 5, 4, 1, SHADE.blueLight);
  wtr.rect(10, 11, 4, 1, SHADE.blueLight);
  single(scene, 'water', wtr);
  const wtop = new PixelArt(16, 4);
  wtop.rect(0, 1, 16, 3, SHADE.blueLight);
  wtop.rect(0, 0, 5, 1, SHADE.blueLighter);
  wtop.rect(8, 0, 5, 1, SHADE.blueLighter);
  wtop.rect(5, 1, 3, 1, W);
  single(scene, 'waterTop', wtop);
  // сигнальная лента вокруг найденного дефекта
  const tape = new PixelArt(16, 3);
  for (let x = 0; x < 16; x++) tape.rect(x, 0, 1, 3, Math.floor(x / 4) % 2 ? W : BRAND.red);
  single(scene, 'tape', tape);
}

// ---------------------------------------------------------------- дефекты

function defectArt(kind, style) {
  let p;
  switch (kind) {
    case 'void':
    case 'screed': {
      p = tileArt(style, T.TOP);
      const top = style === 3 ? 5 : 5;
      p.rect(1, top, 14, 10, SHADE.blackSoft);
      p.ellipse(8, top + 6, 6, 3, K);
      p.set(3, top + 8, SHADE.grayDark);
      p.set(12, top + 7, SHADE.grayDark);
      p.set(6, top + 9, SHADE.blackLight);
      p.line(2, top, 6, top + 2, SHADE.blackLight, 1);
      break;
    }
    case 'noproof':
    case 'bath': {
      p = tileArt(style, kind === 'bath' ? T.WALL2 : T.FILL);
      p.ellipse(8, 9, 6, 5, SHADE.blueDark);
      p.ellipse(8, 8, 4, 3, SHADE.blueMid);
      p.rect(7, 13, 2, 3, SHADE.blueLight);
      p.set(5, 6, SHADE.blueLighter);
      break;
    }
    case 'crack': {
      p = tileArt(style, T.COLUMN);
      p.line(9, 0, 6, 5, K, 1);
      p.line(6, 5, 9, 9, K, 1);
      p.line(9, 9, 6, 15, K, 1);
      p.set(8, 6, SHADE.blackLight);
      break;
    }
    case 'rebar': {
      p = tileArt(style, T.FILL);
      p.rect(2, 6, 12, 5, SHADE.blackSoft);
      p.rect(1, 7, 14, 1, SHADE.grayDark);
      p.rect(1, 9, 14, 1, SHADE.grayDark);
      p.rect(5, 6, 1, 5, SHADE.grayMid);
      p.rect(10, 6, 1, 5, SHADE.grayMid);
      break;
    }
    case 'tilt': {
      p = new PixelArt(16, 16);
      p.line(3, 15, 7, 0, SHADE.grayMid, 6);
      p.line(1, 15, 5, 0, G, 2);
      for (let y = 0; y < 16; y += 4) p.rect(13, y, 1, 2, BRAND.red); // отвес
      break;
    }
    case 'pipe': {
      p = tileArt(style, T.PIPE_V);
      p.rect(4, 6, 8, 3, SHADE.blackLight); // разошедшийся стык
      p.rect(11, 7, 3, 1, SHADE.blueLighter);
      p.rect(13, 8, 2, 1, SHADE.blueLight);
      p.rect(1, 8, 3, 1, SHADE.blueLighter);
      break;
    }
    default:
      p = new PixelArt(16, 16);
  }
  return p;
}

export const DEFECT_KINDS = {
  void: { label: 'defect.void', base: T.TOP, collapse: true },
  noproof: { label: 'defect.noproof', base: T.FILL, drip: true },
  crack: { label: 'defect.crack', base: T.COLUMN, decor: true },
  rebar: { label: 'defect.rebar', base: T.FILL },
  tilt: { label: 'defect.tilt', base: T.COLUMN, decor: true },
  pipe: { label: 'defect.pipe', base: T.PIPE_V, decor: true, drip: true },
  screed: { label: 'defect.screed', base: T.TOP, collapse: true },
  bath: { label: 'defect.bath', base: T.WALL2, drip: true },
};

export function makeDefects(scene, style) {
  for (const kind of Object.keys(DEFECT_KINDS)) single(scene, `def-${kind}-${style}`, defectArt(kind, style));
}

/** Едва заметный признак скрытого дефекта: волосяная трещинка. Рисуется поверх отделки. */
export function makeTell(scene) {
  const p = new PixelArt(16, 16);
  p.set(6, 6, SHADE.blackLight);
  p.set(7, 7, SHADE.blackLight);
  p.set(7, 8, SHADE.blackLight);
  p.set(8, 9, SHADE.blackLight);
  p.set(10, 5, SHADE.grayDark);
  single(scene, 'tell', p);
}

// ---------------------------------------------------------------- фоны

function skyArt(style) {
  const h = 272;
  const p = new PixelArt(8, h);
  const bands =
    style === 3
      ? [SHADE.blueNight, SHADE.blueDusk, BRAND.blueDeep]
      : [SHADE.blueNight, SHADE.blueDusk, BRAND.blueDeep, SHADE.blueDeepLight];
  const bh = h / bands.length;
  for (let y = 0; y < h; y++) {
    const i = Math.min(bands.length - 1, Math.floor(y / bh));
    let c = bands[i];
    // дизеринг на стыке полос
    const into = y - i * bh;
    if (i > 0 && into < 6 && (y + (into % 2)) % 2 === 0) c = bands[i - 1];
    p.rect(0, y, 8, 1, c);
  }
  return p;
}

function cityArt(seed) {
  const w = 512;
  const h = 140;
  const p = new PixelArt(w, h);
  const r = rng(seed);
  let x = 0;
  while (x < w) {
    const bw = 18 + Math.floor(r() * 34);
    const bh = 30 + Math.floor(r() * 80);
    p.rect(x, h - bh, bw, bh, SHADE.blueDusk);
    p.rect(x, h - bh, 1, bh, SHADE.blueNight);
    for (let wy = h - bh + 5; wy < h - 4; wy += 6)
      for (let wx = x + 3; wx < x + bw - 3; wx += 5) {
        const v = r();
        if (v < 0.18) p.rect(wx, wy, 2, 2, SHADE.blueLight);
        else if (v < 0.22) p.rect(wx, wy, 2, 2, G);
      }
    if (r() < 0.25) p.rect(x + Math.floor(bw / 2), h - bh - 8, 1, 8, SHADE.blueDusk);
    x += bw + Math.floor(r() * 6);
  }
  return p;
}

function craneArt(seed, withFrames) {
  const w = 640;
  const h = 200;
  const p = new PixelArt(w, h);
  const r = rng(seed);
  const C = SHADE.blueNight;
  // башенные краны
  [80, 360].forEach((cx, i) => {
    const top = 20 + i * 18;
    p.rect(cx, top, 6, h - top, C);
    for (let y = top; y < h; y += 8) p.line(cx, y, cx + 5, y + 8, SHADE.blueDusk, 1);
    p.rect(cx - 60, top, 170, 4, C);
    for (let x = cx - 60; x < cx + 110; x += 8) p.line(x, top, x + 4, top + 4, SHADE.blueDusk, 1);
    p.rect(cx - 56, top + 4, 18, 10, C); // противовес
    p.rect(cx - 1, top - 14, 8, 14, C);
    p.line(cx + 3, top - 14, cx + 100, top, C, 1);
    p.line(cx + 3, top - 14, cx - 50, top, C, 1);
    p.rect(cx + 70 + i * 10, top + 4, 1, 40 + i * 30, C); // трос
    p.rect(cx + 68 + i * 10, top + 44 + i * 30, 5, 4, BRAND.red); // крюк
    p.set(cx + 3, top - 15, BRAND.red); // огонёк
  });
  if (withFrames) {
    // монолитные каркасы домов
    [200, 480].forEach((bx) => {
      const floors = 5 + Math.floor(r() * 3);
      for (let f = 0; f < floors; f++) {
        const y = h - (f + 1) * 22;
        p.rect(bx, y, 110, 3, SHADE.blueDusk);
        for (let c = 0; c < 5; c++) p.rect(bx + 4 + c * 25, y + 3, 4, 19, SHADE.blueDusk);
      }
    });
  }
  return p;
}

function interiorArt() {
  const w = 192;
  const h = 272;
  const p = new PixelArt(w, h);
  p.rect(0, 0, w, h, SHADE.grayDark);
  // панели стены
  for (let x = 0; x < w; x += 48) p.rect(x, 0, 1, h, SHADE.blackLight);
  p.rect(0, 200, w, 72, SHADE.grayMid);
  p.rect(0, 200, w, 2, G);
  // окна с вечерним небом
  [24, 120].forEach((x) => {
    p.rect(x, 60, 48, 90, SHADE.grayMid);
    p.rect(x + 3, 63, 42, 84, SHADE.blueNight);
    p.rect(x + 3, 120, 42, 27, SHADE.blueDusk);
    p.rect(x + 23, 63, 2, 84, SHADE.grayMid);
    p.rect(x + 3, 103, 42, 2, SHADE.grayMid);
    p.set(x + 10, 70, W);
    p.set(x + 33, 80, SHADE.blueLighter);
    p.rect(x + 6, 132, 10, 15, SHADE.blueNight);
    p.rect(x + 30, 126, 12, 21, SHADE.blueNight);
  });
  return p;
}

export function makeBackgrounds(scene) {
  for (const s of [1, 2, 3]) single(scene, `sky-${s}`, skyArt(s));
  single(scene, 'city', cityArt(7));
  single(scene, 'cranes', craneArt(11, false));
  single(scene, 'frames', craneArt(13, true));
  single(scene, 'interior', interiorArt());
}
