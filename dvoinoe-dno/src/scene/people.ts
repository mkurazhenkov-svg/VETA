// Люди: погрудные портреты для колонки диалога и фигуры для сцены.
// Живописная светотень (свет слева сверху), черты лица, возраст, борода, одежда эпохи, настроение.
import { hash, prng } from './iso';

type RGB = [number, number, number];
type Ctx = CanvasRenderingContext2D;

export interface Look {
  coat: string;
  skin: string;
  hat: string;
  hair: string;
  beard?: 'none' | 'mustache' | 'full' | 'stubble' | 'sideburns';
  age?: 'young' | 'mid' | 'old';
  build?: 'thin' | 'normal' | 'stout';
  dress?: 'gentleman' | 'uniform' | 'worker' | 'apron' | 'woman' | 'robe' | 'vest' | 'merchant' | 'modern';
  glasses?: boolean;
  eyes?: string;
}

const hex = (c: string): RGB => {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const shade = (c: RGB, f: number): RGB =>
  f >= 0 ? [c[0] + (255 - c[0]) * f, c[1] + (255 - c[1]) * f, c[2] + (255 - c[2]) * f] : [c[0] * (1 + f), c[1] * (1 + f), c[2] * (1 + f)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
}

/** Мазки поверх формы (внутри текущего клипа). */
function strokes(ctx: Ctx, r: () => number, x0: number, y0: number, w: number, h: number, base: RGB, n: number, len: number, width: number, jitter: number, angle: number, alpha = 0.35) {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w;
    const y = y0 + r() * h;
    const a = angle + (r() - 0.5) * 0.7;
    const l = len * (0.5 + r());
    ctx.strokeStyle = rgba(shade(base, (r() - 0.5) * 2 * jitter), alpha * (0.5 + r() * 0.7));
    ctx.lineWidth = width * (0.6 + r() * 0.8);
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * l * 0.5, y - Math.sin(a) * l * 0.5);
    ctx.quadraticCurveTo(x + (r() - 0.5) * l * 0.3, y + (r() - 0.5) * l * 0.3, x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5);
    ctx.stroke();
  }
}

/** Заливка текущего пути с объёмом: свет слева сверху, тень справа снизу. */
function volumeFill(ctx: Ctx, base: RGB, x0: number, y0: number, x1: number, y1: number, light = 0.18, dark = -0.35) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, rgba(shade(base, light)));
  g.addColorStop(0.45, rgba(base));
  g.addColorStop(1, rgba(shade(base, dark)));
  ctx.fillStyle = g;
  ctx.fill();
}

// =====================================================================================
//                                       ПОРТРЕТ
// =====================================================================================

/** Погрудный живописный портрет; mood: calm | tense | broken. */
export function paintPortrait(look: Look, mood: string, seedKey: string, size = 220): HTMLCanvasElement {
  const S = 2; // рисуем в двойном разрешении — мягче края
  const W = size * S;
  const H = Math.round(size * 1.15) * S;
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d')!;
  const r = prng(hash(seedKey + ':portrait'));
  const age = look.age ?? 'mid';
  const build = look.build ?? 'normal';
  const dress = look.dress ?? 'gentleman';
  const woman = dress === 'woman' || look.hat === 'kerchief' || seedKey === 'museum_keeper';
  const broken = mood === 'broken';
  const tense = mood === 'tense';
  let skin = hex(look.skin);
  if (broken) skin = mix(skin, [190, 190, 185], 0.18);
  if (age === 'old') skin = mix(skin, [200, 180, 170], 0.1);
  const coat = hex(look.coat);
  const hair = hex(look.hair);
  const eyeCol = hex(look.eyes ?? '#4a3a2a');

  // ---- фон: тёплый полумрак и пятно света за головой
  ctx.fillStyle = rgba(broken ? [44, 40, 44] : tense ? [58, 42, 32] : [50, 44, 34]);
  ctx.fillRect(0, 0, W, H);
  strokes(ctx, r, 0, 0, W, H, broken ? [60, 56, 62] : [74, 60, 44], 260, 70 * S, 18 * S, 0.3, 0.6, 0.3);
  const glow = ctx.createRadialGradient(W * 0.38, H * 0.36, 10, W * 0.42, H * 0.4, W * 0.62);
  glow.addColorStop(0, 'rgba(230,190,130,0.35)');
  glow.addColorStop(1, 'rgba(230,190,130,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const cx = W * 0.5;
  const headY = H * 0.4;
  const headW = W * (build === 'stout' ? 0.26 : build === 'thin' ? 0.225 : 0.243);
  const headH = H * 0.245;
  const shoulderW = W * (build === 'stout' ? 0.5 : build === 'thin' ? 0.4 : 0.45);

  // ---- плечи и одежда
  const neckTop = headY + headH * 0.75;
  const shY = H * 0.84;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW - W * 0.08, H);
  ctx.bezierCurveTo(cx - shoulderW - W * 0.05, shY + H * 0.02, cx - shoulderW * 0.9, shY - H * 0.06, cx - W * 0.1, shY - H * 0.09);
  ctx.lineTo(cx + W * 0.1, shY - H * 0.09);
  ctx.bezierCurveTo(cx + shoulderW * 0.9, shY - H * 0.06, cx + shoulderW + W * 0.05, shY + H * 0.02, cx + shoulderW + W * 0.08, H);
  ctx.closePath();
  volumeFill(ctx, coat, cx - shoulderW, shY - H * 0.1, cx + shoulderW, H, 0.22, -0.4);
  ctx.clip();
  strokes(ctx, r, 0, shY - H * 0.12, W, H * 0.4, coat, 220, 26 * S, 7 * S, 0.22, 1.35);
  // складки ткани
  ctx.strokeStyle = rgba(shade(coat, -0.45), 0.5);
  ctx.lineWidth = 2 * S;
  for (let i = 0; i < 4; i++) {
    const x = cx + (r() - 0.5) * shoulderW * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 30, H - 50 * S, x + (r() - 0.5) * 40, shY);
    ctx.stroke();
  }
  // детали костюма
  const shirt: RGB = [226, 220, 204];
  const vY = shY - H * 0.1;
  const drawV = (col: RGB, depth: number, wide: number) => {
    ctx.beginPath();
    ctx.moveTo(cx - W * wide, vY);
    ctx.lineTo(cx, vY + H * depth);
    ctx.lineTo(cx + W * wide, vY);
    ctx.closePath();
    volumeFill(ctx, col, cx - W * wide, vY, cx + W * wide, vY + H * depth, 0.1, -0.2);
  };
  if (dress === 'gentleman' || dress === 'modern') {
    drawV(shirt, 0.17, 0.085);
    // галстук
    ctx.fillStyle = rgba(dress === 'modern' ? [90, 70, 80] : shade(coat, -0.5));
    ctx.beginPath();
    ctx.moveTo(cx - 6 * S, vY + 10 * S);
    ctx.lineTo(cx + 6 * S, vY + 10 * S);
    ctx.lineTo(cx + 9 * S, vY + H * 0.15);
    ctx.lineTo(cx, vY + H * 0.17);
    ctx.lineTo(cx - 9 * S, vY + H * 0.15);
    ctx.closePath();
    ctx.fill();
    // лацканы
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sgn * W * 0.09, vY - 4);
      ctx.lineTo(cx + sgn * W * 0.02, vY + H * 0.18);
      ctx.lineTo(cx + sgn * W * 0.15, vY + H * 0.08);
      ctx.closePath();
      volumeFill(ctx, shade(coat, sgn < 0 ? 0.1 : -0.2), cx - W * 0.15, vY, cx + W * 0.15, vY + H * 0.2);
      ctx.strokeStyle = rgba(shade(coat, -0.55), 0.7);
      ctx.lineWidth = 1.5 * S;
      ctx.stroke();
    }
  } else if (dress === 'uniform') {
    // стоячий воротник, ряд пуговиц, погоны
    ctx.fillStyle = rgba(shade(coat, -0.25));
    ctx.fillRect(cx - W * 0.1, vY - 6 * S, W * 0.2, 16 * S);
    ctx.strokeStyle = 'rgba(190,160,80,0.9)';
    ctx.lineWidth = 2 * S;
    ctx.strokeRect(cx - W * 0.1, vY - 6 * S, W * 0.2, 16 * S);
    for (let i = 0; i < 4; i++) {
      const g = ctx.createRadialGradient(cx - 2 * S, vY + 26 * S + i * 22 * S - 2 * S, 1, cx, vY + 26 * S + i * 22 * S, 5 * S);
      g.addColorStop(0, '#f6e2a0');
      g.addColorStop(1, '#8a6a2a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, vY + 26 * S + i * 22 * S, 4.5 * S, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(180,150,80,0.85)';
    for (const sgn of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + sgn * shoulderW * 0.72, shY - H * 0.02);
      ctx.rotate(sgn * 0.25);
      ctx.fillRect(-18 * S, -5 * S, 36 * S, 10 * S);
      ctx.restore();
    }
  } else if (dress === 'worker' || dress === 'apron') {
    // косоворотка с застёжкой сбоку
    const shirtCol: RGB = dress === 'apron' ? [176, 160, 132] : [150, 70, 60];
    drawV(shirtCol, 0.12, 0.09);
    ctx.strokeStyle = rgba(shade(shirtCol, -0.4), 0.8);
    ctx.lineWidth = 1.5 * S;
    ctx.beginPath();
    ctx.moveTo(cx + W * 0.03, vY + 4 * S);
    ctx.lineTo(cx + W * 0.035, vY + H * 0.1);
    ctx.stroke();
    if (dress === 'apron') {
      const ap: RGB = [196, 182, 150];
      ctx.beginPath();
      ctx.rect(cx - W * 0.17, vY + H * 0.1, W * 0.34, H);
      volumeFill(ctx, ap, cx - W * 0.17, vY, cx + W * 0.17, H);
      ctx.strokeStyle = rgba(shade(ap, -0.3), 0.8);
      ctx.lineWidth = 4 * S;
      ctx.beginPath();
      ctx.moveTo(cx - W * 0.15, vY + H * 0.1);
      ctx.lineTo(cx - W * 0.09, vY);
      ctx.moveTo(cx + W * 0.15, vY + H * 0.1);
      ctx.lineTo(cx + W * 0.09, vY);
      ctx.stroke();
      if (seedKey === 'mitrofan') {
        // бляха дворника
        const g = ctx.createRadialGradient(cx - W * 0.1, vY + H * 0.15, 2, cx - W * 0.09, vY + H * 0.16, 14 * S);
        g.addColorStop(0, '#f2dc9a');
        g.addColorStop(1, '#7a5a20');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx - W * 0.09, vY + H * 0.16, 11 * S, 14 * S, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (dress === 'woman') {
    // шаль на плечах
    const shawl = shade(coat, 0.18);
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW, shY);
    ctx.quadraticCurveTo(cx, shY + H * 0.22, cx + shoulderW, shY);
    ctx.lineTo(cx + shoulderW * 0.7, shY - H * 0.07);
    ctx.quadraticCurveTo(cx, vY + H * 0.05, cx - shoulderW * 0.7, shY - H * 0.07);
    ctx.closePath();
    volumeFill(ctx, shawl, cx - shoulderW, shY - H * 0.08, cx + shoulderW, shY + H * 0.2);
    ctx.strokeStyle = rgba(shade(shawl, -0.4), 0.5);
    ctx.lineWidth = 1.2 * S;
    for (let i = 0; i < 14; i++) {
      const x = cx - shoulderW * 0.9 + (i / 13) * shoulderW * 1.8;
      ctx.beginPath();
      ctx.moveTo(x, shY - 4 * S);
      ctx.lineTo(x + 6 * S, shY + H * 0.12);
      ctx.stroke();
    }
  } else if (dress === 'robe') {
    drawV([216, 208, 192], 0.16, 0.1);
    ctx.fillStyle = 'rgba(80,60,40,0.9)';
    ctx.beginPath();
    ctx.arc(cx, vY + 10 * S, 6 * S, 0, Math.PI * 2);
    ctx.fill();
  } else if (dress === 'vest') {
    // рубаха с жилетом
    ctx.beginPath();
    ctx.rect(cx - W * 0.13, vY, W * 0.26, H);
    volumeFill(ctx, [214, 206, 188], cx - W * 0.13, vY, cx + W * 0.13, H);
    const vest = shade(coat, -0.15);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sgn * W * 0.13, vY);
      ctx.lineTo(cx + sgn * W * 0.01, vY + H * 0.14);
      ctx.lineTo(cx + sgn * W * 0.01, H);
      ctx.lineTo(cx + sgn * W * 0.2, H);
      ctx.closePath();
      volumeFill(ctx, vest, cx - W * 0.2, vY, cx + W * 0.2, H);
    }
    ctx.strokeStyle = 'rgba(200,170,90,0.9)';
    ctx.lineWidth = 1.5 * S;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.08, vY + H * 0.17);
    ctx.quadraticCurveTo(cx, vY + H * 0.21, cx + W * 0.09, vY + H * 0.17);
    ctx.stroke();
  } else if (dress === 'merchant') {
    // поддёвка с высоким воротом
    ctx.fillStyle = rgba(shade(coat, -0.3));
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.12, vY - 8 * S);
    ctx.lineTo(cx + W * 0.12, vY - 8 * S);
    ctx.lineTo(cx + W * 0.08, vY + 14 * S);
    ctx.lineTo(cx - W * 0.08, vY + 14 * S);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,170,90,0.9)';
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.16, vY + H * 0.16);
    ctx.quadraticCurveTo(cx, vY + H * 0.22, cx + W * 0.16, vY + H * 0.16);
    ctx.stroke();
  }
  ctx.restore();

  // ---- шея
  ctx.beginPath();
  ctx.moveTo(cx - headW * 0.42, neckTop - 10 * S);
  ctx.lineTo(cx - headW * 0.46, shY - H * 0.07);
  ctx.quadraticCurveTo(cx, shY - H * 0.05, cx + headW * 0.46, shY - H * 0.07);
  ctx.lineTo(cx + headW * 0.42, neckTop - 10 * S);
  ctx.closePath();
  volumeFill(ctx, shade(skin, -0.12), cx - headW * 0.5, neckTop, cx + headW * 0.5, shY, 0.05, -0.35);
  // тень от подбородка
  const ns = ctx.createLinearGradient(0, neckTop, 0, neckTop + 40 * S);
  ns.addColorStop(0, 'rgba(40,20,10,0.45)');
  ns.addColorStop(1, 'rgba(40,20,10,0)');
  ctx.fillStyle = ns;
  ctx.fillRect(cx - headW * 0.5, neckTop - 6 * S, headW, 46 * S);
  if (dress !== 'woman' && dress !== 'uniform' && dress !== 'merchant') {
    // воротник рубашки
    ctx.fillStyle = rgba([232, 226, 210]);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sgn * headW * 0.48, shY - H * 0.1);
      ctx.lineTo(cx + sgn * 4 * S, shY - H * 0.045);
      ctx.lineTo(cx + sgn * headW * 0.6, shY - H * 0.05);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- уши
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + sgn * headW * 0.98, headY + headH * 0.05, headW * 0.13, headH * 0.2, sgn * 0.15, 0, Math.PI * 2);
    volumeFill(ctx, shade(skin, sgn < 0 ? -0.02 : -0.2), cx - headW, headY - headH * 0.2, cx + headW, headY + headH * 0.3);
    ctx.strokeStyle = rgba(shade(skin, -0.4), 0.6);
    ctx.lineWidth = 1.5 * S;
    ctx.beginPath();
    ctx.ellipse(cx + sgn * headW * 0.99, headY + headH * 0.05, headW * 0.06, headH * 0.11, sgn * 0.15, -1, 2);
    ctx.stroke();
  }

  // ---- голова: череп + сужение к подбородку
  const jaw = build === 'stout' ? 0.78 : build === 'thin' ? 0.6 : 0.68;
  const headPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx, headY - headH);
    ctx.bezierCurveTo(cx + headW * 1.05, headY - headH, cx + headW * 1.02, headY - headH * 0.1, cx + headW * 0.95, headY + headH * 0.2);
    ctx.bezierCurveTo(cx + headW * 0.88, headY + headH * 0.62, cx + headW * jaw * 0.7, headY + headH * 0.95, cx, headY + headH * 1.02);
    ctx.bezierCurveTo(cx - headW * jaw * 0.7, headY + headH * 0.95, cx - headW * 0.88, headY + headH * 0.62, cx - headW * 0.95, headY + headH * 0.2);
    ctx.bezierCurveTo(cx - headW * 1.02, headY - headH * 0.1, cx - headW * 1.05, headY - headH, cx, headY - headH);
    ctx.closePath();
  };
  ctx.save();
  headPath();
  ctx.fillStyle = rgba(skin);
  ctx.fill();
  ctx.clip();
  // объём: свет слева сверху
  const lg = ctx.createRadialGradient(cx - headW * 0.45, headY - headH * 0.45, headW * 0.1, cx - headW * 0.1, headY, headW * 1.6);
  lg.addColorStop(0, rgba(shade(skin, 0.28), 0.9));
  lg.addColorStop(0.5, rgba(skin, 0));
  lg.addColorStop(1, rgba(shade(skin, -0.45), 0.85));
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);
  // румянец
  for (const sgn of [-1, 1]) {
    const bl = ctx.createRadialGradient(cx + sgn * headW * 0.5, headY + headH * 0.25, 2, cx + sgn * headW * 0.5, headY + headH * 0.25, headW * 0.42);
    bl.addColorStop(0, `rgba(196,86,66,${broken ? 0.06 : age === 'young' ? 0.22 : 0.15})`);
    bl.addColorStop(1, 'rgba(196,86,66,0)');
    ctx.fillStyle = bl;
    ctx.fillRect(0, 0, W, H);
  }
  // глазные впадины
  for (const sgn of [-1, 1]) {
    const so = ctx.createRadialGradient(cx + sgn * headW * 0.4, headY - headH * 0.02, 2, cx + sgn * headW * 0.4, headY, headW * 0.36);
    so.addColorStop(0, `rgba(70,35,20,${broken || age === 'old' ? 0.42 : 0.28})`);
    so.addColorStop(1, 'rgba(70,35,20,0)');
    ctx.fillStyle = so;
    ctx.fillRect(0, 0, W, H);
  }
  strokes(ctx, r, cx - headW, headY - headH, headW * 2, headH * 2.1, skin, 260, 12 * S, 4 * S, 0.11, 1.5, 0.28);
  // морщины
  if (age === 'old' || broken) {
    ctx.strokeStyle = rgba(shade(skin, -0.4), age === 'old' ? 0.45 : 0.25);
    ctx.lineWidth = 1.4 * S;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - headW * 0.45, headY - headH * (0.55 - i * 0.09));
      ctx.quadraticCurveTo(cx, headY - headH * (0.6 - i * 0.09), cx + headW * 0.45, headY - headH * (0.55 - i * 0.09));
      ctx.stroke();
    }
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sgn * headW * 0.22, headY + headH * 0.3);
      ctx.quadraticCurveTo(cx + sgn * headW * 0.38, headY + headH * 0.5, cx + sgn * headW * 0.3, headY + headH * 0.68);
      ctx.stroke();
    }
  }
  // щетина
  if (look.beard === 'stubble') {
    ctx.fillStyle = rgba(shade(hair, -0.35), 0.13);
    for (let i = 0; i < 1600; i++) {
      const a = r() * Math.PI;
      const rr = 0.55 + r() * 0.45;
      ctx.fillRect(cx + Math.cos(a) * headW * rr * 0.85, headY + headH * 0.35 + Math.sin(a) * headH * 0.62 * rr, 1.1 * S, 1.1 * S);
    }
  }
  ctx.restore();

  // ---- глаза
  const eyeY = headY - headH * 0.02;
  const eyeDX = headW * 0.4;
  const open = broken ? 0.55 : tense ? 0.72 : 1;
  const look_down = broken ? 3 * S : 0;
  const look_side = tense ? 2 * S : 0;
  for (const sgn of [-1, 1]) {
    const ex = cx + sgn * eyeDX;
    const ew = headW * 0.24;
    const eh = headH * 0.085 * open;
    // белок
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ex - ew, eyeY);
    ctx.quadraticCurveTo(ex, eyeY - eh * 2.1, ex + ew, eyeY);
    ctx.quadraticCurveTo(ex, eyeY + eh * 1.5, ex - ew, eyeY);
    ctx.closePath();
    ctx.fillStyle = rgba(mix([236, 228, 214], skin, 0.25));
    ctx.fill();
    ctx.clip();
    // радужка и зрачок
    const ir = headW * 0.105;
    const ix = ex + look_side;
    const iy = eyeY - eh * 0.2 + look_down;
    const ig = ctx.createRadialGradient(ix, iy, 1, ix, iy, ir);
    ig.addColorStop(0, rgba(shade(eyeCol, 0.35)));
    ig.addColorStop(0.7, rgba(eyeCol));
    ig.addColorStop(1, rgba(shade(eyeCol, -0.5)));
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.arc(ix, iy, ir, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,6,4,0.95)';
    ctx.beginPath();
    ctx.arc(ix, iy, ir * 0.45, 0, Math.PI * 2);
    ctx.fill();
    // тень века на глазном яблоке
    const lid = ctx.createLinearGradient(0, eyeY - eh * 2, 0, eyeY + eh);
    lid.addColorStop(0, 'rgba(60,30,20,0.55)');
    lid.addColorStop(0.5, 'rgba(60,30,20,0)');
    ctx.fillStyle = lid;
    ctx.fillRect(ex - ew, eyeY - eh * 2.2, ew * 2, eh * 3.6);
    ctx.restore();
    // блик
    ctx.fillStyle = 'rgba(255,255,250,0.9)';
    ctx.beginPath();
    ctx.arc(ex + look_side - headW * 0.04, eyeY - eh * 0.6 + look_down, 1.8 * S, 0, Math.PI * 2);
    ctx.fill();
    // верхнее веко
    ctx.strokeStyle = rgba(shade(skin, -0.62), 0.95);
    ctx.lineWidth = 2.4 * S;
    ctx.beginPath();
    ctx.moveTo(ex - ew * 1.05, eyeY + 1);
    ctx.quadraticCurveTo(ex, eyeY - eh * 2.15, ex + ew * 1.05, eyeY);
    ctx.stroke();
    // складка века
    ctx.strokeStyle = rgba(shade(skin, -0.35), 0.5);
    ctx.lineWidth = 1.4 * S;
    ctx.beginPath();
    ctx.moveTo(ex - ew * 0.9, eyeY - eh * 1.2);
    ctx.quadraticCurveTo(ex, eyeY - eh * 2.9 - (broken ? 2 * S : 0), ex + ew * 0.95, eyeY - eh * 1.3);
    ctx.stroke();
    // нижнее веко / мешки
    ctx.strokeStyle = rgba(shade(skin, -0.3), age === 'old' || broken ? 0.55 : 0.3);
    ctx.beginPath();
    ctx.moveTo(ex - ew * 0.8, eyeY + eh * 1.1);
    ctx.quadraticCurveTo(ex, eyeY + eh * 2.2, ex + ew * 0.8, eyeY + eh * 1.1);
    ctx.stroke();
  }

  // ---- брови
  const browCol = shade(hair, -0.25);
  ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    const inner = cx + sgn * headW * 0.16;
    const outer = cx + sgn * headW * 0.68;
    const by = eyeY - headH * 0.2;
    const innerDy = tense ? headH * 0.06 : broken ? -headH * 0.07 : 0;
    const outerDy = broken ? headH * 0.03 : 0;
    for (let k = 0; k < 7; k++) {
      ctx.strokeStyle = rgba(shade(browCol, (r() - 0.5) * 0.3), 0.75);
      ctx.lineWidth = (3.4 - k * 0.25) * S;
      ctx.beginPath();
      ctx.moveTo(inner, by + innerDy + (r() - 0.5) * 3);
      ctx.quadraticCurveTo((inner + outer) / 2, by - headH * 0.06 + (r() - 0.5) * 3, outer, by + outerDy + headH * 0.02);
      ctx.stroke();
    }
  }
  // складка между бровями от напряжения
  if (tense) {
    ctx.strokeStyle = rgba(shade(skin, -0.45), 0.6);
    ctx.lineWidth = 1.6 * S;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sgn * 4 * S, eyeY - headH * 0.22);
      ctx.lineTo(cx + sgn * 5 * S, eyeY - headH * 0.11);
      ctx.stroke();
    }
  }

  // ---- нос
  const noseTip = headY + headH * 0.36;
  ctx.strokeStyle = rgba(shade(skin, -0.42), 0.6);
  ctx.lineWidth = 2.2 * S;
  ctx.beginPath();
  ctx.moveTo(cx + headW * 0.1, eyeY + headH * 0.02);
  ctx.quadraticCurveTo(cx + headW * 0.15, headY + headH * 0.22, cx + headW * 0.17, noseTip - 4 * S);
  ctx.stroke();
  const nb = ctx.createRadialGradient(cx - headW * 0.02, noseTip - 6 * S, 1, cx, noseTip, headW * 0.2);
  nb.addColorStop(0, rgba(shade(skin, 0.25), 0.8));
  nb.addColorStop(1, rgba(skin, 0));
  ctx.fillStyle = nb;
  ctx.beginPath();
  ctx.arc(cx, noseTip, headW * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(shade(skin, -0.55), 0.8);
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + sgn * headW * 0.085, noseTip + 4 * S, headW * 0.045, headW * 0.025, sgn * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(shade(skin, -0.38), 0.55);
  ctx.lineWidth = 1.6 * S;
  ctx.beginPath();
  ctx.arc(cx, noseTip - 2 * S, headW * 0.15, 0.3, Math.PI - 0.3);
  ctx.stroke();

  // ---- рот
  const mouthY = headY + headH * 0.58;
  const mw = headW * (woman ? 0.3 : 0.34);
  const corner = broken ? 5 * S : tense ? 1 * S : -2 * S;
  const lipCol = mix(skin, [160, 70, 60], woman ? 0.45 : 0.3);
  ctx.fillStyle = rgba(shade(lipCol, -0.15));
  ctx.beginPath();
  ctx.moveTo(cx - mw, mouthY + corner);
  ctx.quadraticCurveTo(cx - mw * 0.4, mouthY - 6 * S, cx, mouthY - 3 * S);
  ctx.quadraticCurveTo(cx + mw * 0.4, mouthY - 6 * S, cx + mw, mouthY + corner);
  ctx.quadraticCurveTo(cx, mouthY + (tense ? 1 : 2) * S, cx - mw, mouthY + corner);
  ctx.fill();
  ctx.fillStyle = rgba(shade(lipCol, 0.12));
  ctx.beginPath();
  ctx.moveTo(cx - mw * 0.85, mouthY + corner * 0.8);
  ctx.quadraticCurveTo(cx, mouthY + (tense ? 7 : 11) * S, cx + mw * 0.85, mouthY + corner * 0.8);
  ctx.quadraticCurveTo(cx, mouthY + 2 * S, cx - mw * 0.85, mouthY + corner * 0.8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,25,20,0.85)';
  ctx.lineWidth = 1.8 * S;
  ctx.beginPath();
  ctx.moveTo(cx - mw, mouthY + corner);
  ctx.quadraticCurveTo(cx, mouthY + (broken ? 4 : 2) * S, cx + mw, mouthY + corner);
  ctx.stroke();
  // тень под нижней губой
  const ch = ctx.createRadialGradient(cx, mouthY + 16 * S, 1, cx, mouthY + 16 * S, mw);
  ch.addColorStop(0, rgba(shade(skin, -0.4), 0.35));
  ch.addColorStop(1, rgba(skin, 0));
  ctx.fillStyle = ch;
  ctx.fillRect(cx - mw, mouthY + 6 * S, mw * 2, 22 * S);

  // ---- волосы на голове
  const hatless = look.hat === 'none';
  ctx.save();
  if (!woman || seedKey === 'museum_keeper') {
    ctx.beginPath();
    if (age === 'old' && !woman && hatless) {
      // залысины: волосы только по бокам и на затылке
      for (const sgn of [-1, 1]) {
        ctx.moveTo(cx + sgn * headW * 1.0, headY + headH * 0.05);
        ctx.quadraticCurveTo(cx + sgn * headW * 1.1, headY - headH * 0.6, cx + sgn * headW * 0.55, headY - headH * 0.85);
        ctx.quadraticCurveTo(cx + sgn * headW * 0.8, headY - headH * 0.3, cx + sgn * headW * 0.92, headY + headH * 0.05);
      }
    } else {
      ctx.moveTo(cx - headW * 1.0, headY + headH * 0.05);
      ctx.bezierCurveTo(cx - headW * 1.15, headY - headH * 0.9, cx - headW * 0.3, headY - headH * 1.22, cx + headW * 0.2, headY - headH * 1.1);
      ctx.bezierCurveTo(cx + headW * 1.0, headY - headH * 1.05, cx + headW * 1.18, headY - headH * 0.6, cx + headW * 1.0, headY + headH * 0.05);
      ctx.bezierCurveTo(cx + headW * 0.95, headY - headH * 0.4, cx + headW * 0.6, headY - headH * 0.65, cx + headW * 0.1, headY - headH * 0.62);
      ctx.bezierCurveTo(cx - headW * 0.5, headY - headH * 0.7, cx - headW * 0.92, headY - headH * 0.4, cx - headW * 1.0, headY + headH * 0.05);
    }
    volumeFill(ctx, hair, cx - headW, headY - headH * 1.2, cx + headW, headY, 0.2, -0.35);
    ctx.clip();
    strokes(ctx, r, cx - headW * 1.2, headY - headH * 1.3, headW * 2.4, headH * 1.4, hair, 160, 18 * S, 3 * S, 0.25, -0.4, 0.5);
    if (age === 'old') strokes(ctx, r, cx - headW * 1.2, headY - headH * 1.3, headW * 2.4, headH * 1.4, [200, 196, 188], 60, 16 * S, 2 * S, 0.1, -0.4, 0.4);
  }
  ctx.restore();

  // ---- борода и усы
  const beardCol = hair;
  if (look.beard === 'full') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - headW * 0.95, headY + headH * 0.1);
    ctx.bezierCurveTo(cx - headW * 0.95, headY + headH * 1.0, cx - headW * 0.5, headY + headH * 1.45, cx, headY + headH * 1.5);
    ctx.bezierCurveTo(cx + headW * 0.5, headY + headH * 1.45, cx + headW * 0.95, headY + headH * 1.0, cx + headW * 0.95, headY + headH * 0.1);
    ctx.bezierCurveTo(cx + headW * 0.75, headY + headH * 0.55, cx + headW * 0.45, headY + headH * 0.45, cx + mw * 1.1, mouthY - 2 * S);
    ctx.quadraticCurveTo(cx, mouthY + 22 * S, cx - mw * 1.1, mouthY - 2 * S);
    ctx.bezierCurveTo(cx - headW * 0.45, headY + headH * 0.45, cx - headW * 0.75, headY + headH * 0.55, cx - headW * 0.95, headY + headH * 0.1);
    ctx.closePath();
    volumeFill(ctx, beardCol, cx - headW, headY, cx + headW, headY + headH * 1.5, 0.15, -0.4);
    ctx.clip();
    strokes(ctx, r, cx - headW, headY, headW * 2, headH * 1.6, beardCol, 220, 16 * S, 2.6 * S, 0.3, 1.5, 0.55);
    ctx.restore();
  }
  if (look.beard === 'mustache' || look.beard === 'full') {
    for (const sgn of [-1, 1]) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, noseTip + 8 * S);
      ctx.quadraticCurveTo(cx + sgn * mw * 0.9, noseTip + 4 * S, cx + sgn * mw * 1.5, mouthY + (seedKey === 'zharov' ? 8 : 2) * S);
      ctx.quadraticCurveTo(cx + sgn * mw * 0.8, mouthY - 1 * S, cx, mouthY - 4 * S);
      ctx.closePath();
      volumeFill(ctx, shade(beardCol, -0.05), cx - mw, noseTip, cx + mw, mouthY, 0.15, -0.35);
      ctx.clip();
      strokes(ctx, r, cx - mw * 1.6, noseTip, mw * 3.2, mouthY - noseTip + 10 * S, beardCol, 60, 10 * S, 2 * S, 0.3, sgn > 0 ? 0.3 : 2.8, 0.6);
      ctx.restore();
    }
  }
  if (look.beard === 'sideburns') {
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sgn * headW * 0.92, headY - headH * 0.2);
      ctx.quadraticCurveTo(cx + sgn * headW * 0.98, headY + headH * 0.6, cx + sgn * headW * 0.55, headY + headH * 0.75);
      ctx.quadraticCurveTo(cx + sgn * headW * 0.7, headY + headH * 0.3, cx + sgn * headW * 0.78, headY - headH * 0.2);
      ctx.closePath();
      volumeFill(ctx, hair, cx - headW, headY, cx + headW, headY + headH, 0.15, -0.3);
    }
  }

  // ---- очки (пенсне)
  if (look.glasses) {
    ctx.strokeStyle = 'rgba(40,32,24,0.9)';
    ctx.lineWidth = 1.8 * S;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + sgn * eyeDX, eyeY, headW * 0.28, headH * 0.13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(cx - eyeDX + headW * 0.28, eyeY);
    ctx.quadraticCurveTo(cx, eyeY - 6 * S, cx + eyeDX - headW * 0.28, eyeY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,240,0.7)';
    ctx.beginPath();
    ctx.arc(cx - eyeDX - headW * 0.1, eyeY - 4 * S, 5 * S, 3.5, 4.5);
    ctx.stroke();
  }

  // ---- головной убор
  const hatTop = headY - headH * 0.62;
  if (look.hat === 'bowler') {
    ctx.beginPath();
    ctx.ellipse(cx, hatTop + 4 * S, headW * 1.42, headH * 0.17, 0, 0, Math.PI * 2);
    volumeFill(ctx, [26, 23, 21], cx - headW * 1.4, hatTop - 10, cx + headW * 1.4, hatTop + 20, 0.3, -0.3);
    ctx.beginPath();
    ctx.moveTo(cx - headW * 0.98, hatTop + 2 * S);
    ctx.bezierCurveTo(cx - headW * 1.02, hatTop - headH * 0.85, cx + headW * 1.02, hatTop - headH * 0.85, cx + headW * 0.98, hatTop + 2 * S);
    ctx.closePath();
    volumeFill(ctx, [30, 27, 25], cx - headW, hatTop - headH * 0.8, cx + headW, hatTop, 0.32, -0.3);
    ctx.fillStyle = 'rgba(70,60,50,0.9)';
    ctx.fillRect(cx - headW * 0.97, hatTop - 10 * S, headW * 1.94, 9 * S);
    ctx.strokeStyle = 'rgba(255,240,220,0.25)';
    ctx.lineWidth = 3 * S;
    ctx.beginPath();
    ctx.arc(cx - headW * 0.2, hatTop - headH * 0.2, headW * 0.55, 3.6, 4.4);
    ctx.stroke();
  } else if (look.hat === 'cap') {
    const capCol: RGB = look.dress === 'uniform' ? [36, 44, 58] : [32, 32, 34];
    ctx.beginPath();
    ctx.moveTo(cx - headW * 1.02, hatTop + 8 * S);
    ctx.bezierCurveTo(cx - headW * 1.1, hatTop - headH * 0.55, cx + headW * 1.15, hatTop - headH * 0.6, cx + headW * 1.05, hatTop + 8 * S);
    ctx.closePath();
    volumeFill(ctx, capCol, cx - headW, hatTop - headH * 0.6, cx + headW, hatTop + 8, 0.25, -0.35);
    if (look.dress === 'uniform') {
      ctx.fillStyle = 'rgba(160,40,40,0.95)';
      ctx.fillRect(cx - headW * 1.0, hatTop - 4 * S, headW * 2.02, 9 * S);
      const g = ctx.createRadialGradient(cx - 2, hatTop - 14 * S, 1, cx, hatTop - 12 * S, 8 * S);
      g.addColorStop(0, '#f6e2a0');
      g.addColorStop(1, '#8a6a2a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, hatTop - 14 * S, 6 * S, 0, Math.PI * 2);
      ctx.fill();
    }
    // козырёк
    ctx.beginPath();
    ctx.moveTo(cx - headW * 0.95, hatTop + 8 * S);
    ctx.quadraticCurveTo(cx, hatTop + 30 * S, cx + headW * 0.98, hatTop + 8 * S);
    ctx.quadraticCurveTo(cx, hatTop + 14 * S, cx - headW * 0.95, hatTop + 8 * S);
    ctx.fillStyle = 'rgba(14,12,12,0.98)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.moveTo(cx - headW * 0.6, hatTop + 16 * S);
    ctx.quadraticCurveTo(cx, hatTop + 25 * S, cx + headW * 0.4, hatTop + 18 * S);
    ctx.stroke();
  } else if (look.hat === 'kerchief') {
    const kc = shade(coat, 0.28);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - headW * 1.12, headY + headH * 0.75);
    ctx.bezierCurveTo(cx - headW * 1.35, headY - headH * 1.3, cx + headW * 1.35, headY - headH * 1.3, cx + headW * 1.12, headY + headH * 0.75);
    ctx.lineTo(cx + headW * 0.82, headY + headH * 0.7);
    ctx.bezierCurveTo(cx + headW * 1.0, headY - headH * 0.5, cx - headW * 1.0, headY - headH * 0.5, cx - headW * 0.82, headY + headH * 0.7);
    ctx.closePath();
    volumeFill(ctx, kc, cx - headW * 1.3, headY - headH * 1.2, cx + headW * 1.3, headY + headH, 0.22, -0.4);
    ctx.clip();
    strokes(ctx, r, cx - headW * 1.4, headY - headH * 1.3, headW * 2.8, headH * 2.2, kc, 120, 18 * S, 4 * S, 0.22, 0.9, 0.45);
    // узор-горошек
    ctx.fillStyle = rgba(shade(kc, 0.4), 0.5);
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(cx + (r() - 0.5) * headW * 2.4, headY - headH * 1.0 + r() * headH * 1.7, 2.2 * S, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // узел под подбородком
    ctx.beginPath();
    ctx.ellipse(cx, headY + headH * 1.08, headW * 0.18, headH * 0.1, 0, 0, Math.PI * 2);
    volumeFill(ctx, kc, cx - 20, headY + headH, cx + 20, headY + headH * 1.2);
  }

  // ---- общий живописный слой, свет и виньетка
  strokes(ctx, r, 0, 0, W, H, [120, 100, 80], 90, 40 * S, 8 * S, 0.3, 0.8, 0.05);
  const v = ctx.createRadialGradient(W * 0.48, H * 0.45, W * 0.3, W / 2, H / 2, W * 0.82);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,6,2,0.62)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  if (broken) {
    ctx.fillStyle = 'rgba(60,70,90,0.12)';
    ctx.fillRect(0, 0, W, H);
  }
  // зерно
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  const out = canvas(size, Math.round(size * 1.15));
  const octx = out.getContext('2d')!;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(cv, 0, 0, out.width, out.height);
  return out;
}

// =====================================================================================
//                                        ФИГУРА
// =====================================================================================

/**
 * Фигура в рост (~2.4 аршина). frame 0 — стоит, 1..4 — фазы шага; back — вид со спины.
 * Возвращает холст и точку ступней. Смотрит вправо-вниз; влево — зеркалить спрайт.
 */
export function paintFigure(look: Look, k: number, frame: number, seedKey: string, back = false): { canvas: HTMLCanvasElement; foot: [number, number] } {
  const S = 2;
  const Hh = 2.45 * k * S;
  const Ww = Hh * 0.62;
  const cv = canvas(Ww + 24 * S, Hh + 26 * S);
  const ctx = cv.getContext('2d')!;
  const r = prng(hash(seedKey + ':fig'));
  const cx = cv.width / 2;
  const foot = Hh + 16 * S;
  const build = look.build ?? 'normal';
  const dress = look.dress ?? 'gentleman';
  const woman = dress === 'woman' || look.hat === 'kerchief' || seedKey === 'museum_keeper';
  const wide = build === 'stout' ? 1.15 : build === 'thin' ? 0.9 : 1;
  const coat = hex(look.coat);
  const skin = hex(look.skin);
  const hair = hex(look.hair);
  const trousers = dress === 'robe' ? shade(coat, -0.5) : shade(coat, -0.35);
  // frame 0 — стоит; 1..4 — фазы шага
  const walking = frame > 0;
  const phase = ((frame - 1) % 4) * (Math.PI / 2);
  const swing = walking ? Math.sin(phase + Math.PI / 4) * 1.2 : 0;
  const bob = walking ? Math.abs(Math.cos(phase + Math.PI / 4)) * 2 * S : 0;

  // тень
  const sh = ctx.createRadialGradient(cx, foot, 2, cx, foot, Ww * 0.42);
  sh.addColorStop(0, 'rgba(0,0,0,0.45)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(cx, foot, Ww * 0.42, Ww * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  const hipY = foot - Hh * 0.45 - bob;
  const shoulderY = foot - Hh * 0.79 - bob;
  const shoulderW = Ww * 0.24 * wide;
  const waistW = Ww * (build === 'stout' ? 0.25 : 0.19);

  // ---- ноги
  const legLen = foot - hipY;
  const drawLeg = (side: -1 | 1, ang: number, dark: number) => {
    const hx = cx + side * waistW * 0.45;
    const kx = hx + Math.sin(ang) * legLen * 0.5;
    const ky = hipY + Math.cos(ang) * legLen * 0.5;
    const fx = hx + Math.sin(ang * 0.6) * legLen * 0.95 + (back ? 0 : 3 * S);
    const fy = Math.min(foot - 3 * S, hipY + legLen - (walking ? Math.max(0, -Math.cos(ang * 2)) * 4 * S : 0));
    ctx.strokeStyle = rgba(shade(trousers, dark));
    ctx.lineCap = 'round';
    ctx.lineWidth = Ww * 0.12 * wide;
    ctx.beginPath();
    ctx.moveTo(hx, hipY);
    ctx.quadraticCurveTo(kx, ky, fx, fy - 6 * S);
    ctx.stroke();
    // сапог/ботинок
    ctx.fillStyle = rgba(shade([28, 22, 18], dark));
    ctx.beginPath();
    ctx.ellipse(fx + (back ? -2 : 5) * S, fy - 2 * S, Ww * 0.09, Ww * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(fx + (back ? -4 : 7) * S, fy - 4 * S, Ww * 0.035, Ww * 0.015, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  if (!woman) {
    drawLeg(1, -swing * 0.42, -0.25); // дальняя нога темнее
    drawLeg(-1, swing * 0.42, 0);
  }

  // ---- корпус
  const hemY = woman ? foot - 6 * S : dress === 'gentleman' || dress === 'robe' || dress === 'merchant' ? hipY + legLen * 0.42 : hipY + legLen * 0.08;
  const hemW = woman ? Ww * 0.36 : dress === 'gentleman' || dress === 'merchant' ? Ww * 0.26 * wide : waistW * 1.15;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW * 0.55, shoulderY - 4 * S);
  ctx.quadraticCurveTo(cx - shoulderW * 1.05, shoulderY - 2 * S, cx - shoulderW, shoulderY + 10 * S);
  ctx.quadraticCurveTo(cx - waistW * 1.05, hipY - legLen * 0.15, cx - waistW, hipY);
  ctx.lineTo(cx - hemW - (walking ? swing * 3 * S : 0), hemY);
  ctx.quadraticCurveTo(cx, hemY + 4 * S, cx + hemW - (walking ? swing * 3 * S : 0), hemY);
  ctx.lineTo(cx + waistW, hipY);
  ctx.quadraticCurveTo(cx + waistW * 1.05, hipY - legLen * 0.15, cx + shoulderW, shoulderY + 10 * S);
  ctx.quadraticCurveTo(cx + shoulderW * 1.05, shoulderY - 2 * S, cx + shoulderW * 0.55, shoulderY - 4 * S);
  ctx.closePath();
  volumeFill(ctx, coat, cx - shoulderW, shoulderY, cx + shoulderW * 1.2, hemY, 0.22, -0.42);
  ctx.clip();
  strokes(ctx, r, cx - Ww * 0.5, shoulderY - 6 * S, Ww, hemY - shoulderY + 10 * S, coat, 120, 10 * S, 3.5 * S, 0.22, 1.5, 0.4);
  if (!back) {
    // перед: рубашка, лацканы, пуговицы, фартук
    if (dress === 'gentleman' || dress === 'modern') {
      ctx.fillStyle = 'rgba(228,222,206,0.95)';
      ctx.beginPath();
      ctx.moveTo(cx - Ww * 0.06 + 2 * S, shoulderY - 2 * S);
      ctx.lineTo(cx + 2 * S, shoulderY + Hh * 0.12);
      ctx.lineTo(cx + Ww * 0.08 + 2 * S, shoulderY - 2 * S);
      ctx.fill();
      ctx.fillStyle = rgba(shade(coat, -0.55));
      ctx.fillRect(cx, shoulderY + 2 * S, 3 * S, Hh * 0.08);
    }
    if (dress === 'uniform' || dress === 'vest' || dress === 'merchant') {
      ctx.fillStyle = dress === 'uniform' ? '#e2c26a' : 'rgba(30,24,20,0.9)';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(cx + 2 * S, shoulderY + 10 * S + i * (hipY - shoulderY) * 0.2, 1.8 * S, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (dress === 'uniform') {
      ctx.fillStyle = 'rgba(40,30,20,0.9)';
      ctx.fillRect(cx - waistW, hipY - 6 * S, waistW * 2, 5 * S);
      ctx.fillStyle = '#c8a850';
      ctx.fillRect(cx - 4 * S, hipY - 6 * S, 8 * S, 5 * S);
    }
    if (dress === 'apron') {
      ctx.beginPath();
      ctx.rect(cx - waistW * 0.75, shoulderY + Hh * 0.08, waistW * 1.5, hemY);
      volumeFill(ctx, [196, 182, 150], cx - waistW, shoulderY, cx + waistW, hemY);
    }
    if (dress === 'robe') {
      ctx.fillStyle = 'rgba(230,224,210,0.9)';
      ctx.fillRect(cx - waistW, shoulderY, waistW * 2, hemY - shoulderY);
    }
    if (dress === 'woman') {
      // фартук и шаль
      ctx.beginPath();
      ctx.rect(cx - Ww * 0.14, hipY - 4 * S, Ww * 0.28, hemY - hipY);
      volumeFill(ctx, shade(coat, 0.35), cx - Ww * 0.14, hipY, cx + Ww * 0.14, hemY, 0.1, -0.25);
      ctx.beginPath();
      ctx.moveTo(cx - shoulderW * 1.05, shoulderY + 4 * S);
      ctx.quadraticCurveTo(cx, shoulderY + Hh * 0.22, cx + shoulderW * 1.05, shoulderY + 4 * S);
      ctx.lineTo(cx + shoulderW * 0.5, shoulderY - 4 * S);
      ctx.lineTo(cx - shoulderW * 0.5, shoulderY - 4 * S);
      ctx.closePath();
      volumeFill(ctx, shade(coat, 0.18), cx - shoulderW, shoulderY, cx + shoulderW, shoulderY + Hh * 0.2);
    }
  } else {
    // спина: шов и складки
    ctx.strokeStyle = rgba(shade(coat, -0.5), 0.6);
    ctx.lineWidth = 1.5 * S;
    ctx.beginPath();
    ctx.moveTo(cx, shoulderY);
    ctx.lineTo(cx, hemY);
    ctx.stroke();
  }
  ctx.restore();

  // ---- руки
  const drawArm = (side: -1 | 1, ang: number, dark: number) => {
    const sx = cx + side * shoulderW * 0.9;
    const sy = shoulderY + 8 * S;
    const len = Hh * 0.34;
    const ex = sx + Math.sin(ang) * len * 0.5 + side * 2 * S;
    const ey = sy + Math.cos(ang) * len * 0.5;
    const hx = sx + Math.sin(ang * 1.3) * len + side * 3 * S;
    const hy = sy + Math.cos(ang) * len;
    ctx.strokeStyle = rgba(shade(coat, -0.1 + dark));
    ctx.lineCap = 'round';
    ctx.lineWidth = Ww * 0.105 * wide;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(ex, ey, hx, hy - 4 * S);
    ctx.stroke();
    ctx.strokeStyle = rgba(shade(coat, 0.2 + dark), 0.4);
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.moveTo(sx - side * 3 * S, sy);
    ctx.quadraticCurveTo(ex - side * 3 * S, ey, hx - side * 2 * S, hy - 6 * S);
    ctx.stroke();
    const hg = ctx.createRadialGradient(hx - 2 * S, hy - 2 * S, 1, hx, hy, Ww * 0.06);
    hg.addColorStop(0, rgba(shade(skin, 0.15 + dark)));
    hg.addColorStop(1, rgba(shade(skin, -0.3 + dark)));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(hx, hy, Ww * 0.05, Ww * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drawArm(1, swing * 0.35, -0.2);
  drawArm(-1, -swing * 0.35, 0);

  // ---- шея и голова
  const headR = Hh * 0.068;
  const hy = shoulderY - headR * 1.15;
  const hx = cx + (back ? 0 : 2 * S);
  ctx.fillStyle = rgba(shade(skin, -0.2));
  ctx.fillRect(hx - headR * 0.4, hy + headR * 0.6, headR * 0.8, headR * 0.7);
  if (dress !== 'woman' && dress !== 'uniform' && !back) {
    ctx.fillStyle = 'rgba(230,224,208,0.95)';
    ctx.fillRect(hx - headR * 0.55, hy + headR * 1.05, headR * 1.1, headR * 0.28);
  }
  ctx.beginPath();
  ctx.ellipse(hx, hy, headR * 0.86, headR, 0, 0, Math.PI * 2);
  const hg = ctx.createRadialGradient(hx - headR * 0.4, hy - headR * 0.4, 1, hx, hy, headR * 1.3);
  hg.addColorStop(0, rgba(shade(skin, 0.22)));
  hg.addColorStop(0.6, rgba(skin));
  hg.addColorStop(1, rgba(shade(skin, -0.4)));
  ctx.fillStyle = hg;
  ctx.fill();
  if (!back) {
    // ухо, глаза, нос, рот
    ctx.fillStyle = rgba(shade(skin, -0.15));
    ctx.beginPath();
    ctx.ellipse(hx - headR * 0.7, hy + headR * 0.1, headR * 0.16, headR * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,12,8,0.95)';
    for (const ex of [0.05, 0.5]) {
      ctx.beginPath();
      ctx.ellipse(hx + headR * ex, hy - headR * 0.05, headR * 0.09, headR * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(shade(hair, -0.3), 0.9);
    ctx.lineWidth = 1.6 * S;
    for (const ex of [0.05, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(hx + headR * (ex - 0.14), hy - headR * 0.25);
      ctx.lineTo(hx + headR * (ex + 0.14), hy - headR * 0.27);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(shade(skin, -0.45), 0.8);
    ctx.beginPath();
    ctx.moveTo(hx + headR * 0.32, hy);
    ctx.lineTo(hx + headR * 0.42, hy + headR * 0.3);
    ctx.lineTo(hx + headR * 0.3, hy + headR * 0.33);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110,40,30,0.8)';
    ctx.beginPath();
    ctx.moveTo(hx + headR * 0.12, hy + headR * 0.55);
    ctx.lineTo(hx + headR * 0.46, hy + headR * 0.53);
    ctx.stroke();
    if (look.beard === 'full') {
      ctx.beginPath();
      ctx.moveTo(hx - headR * 0.75, hy + headR * 0.05);
      ctx.quadraticCurveTo(hx - headR * 0.6, hy + headR * 1.35, hx + headR * 0.2, hy + headR * 1.25);
      ctx.quadraticCurveTo(hx + headR * 0.8, hy + headR * 1.0, hx + headR * 0.82, hy + headR * 0.3);
      ctx.quadraticCurveTo(hx + headR * 0.3, hy + headR * 0.75, hx - headR * 0.75, hy + headR * 0.05);
      volumeFill(ctx, hair, hx - headR, hy, hx + headR, hy + headR * 1.3, 0.15, -0.35);
    }
    if (look.beard === 'mustache' || look.beard === 'full') {
      ctx.strokeStyle = rgba(shade(hair, -0.1));
      ctx.lineWidth = 3 * S;
      ctx.beginPath();
      ctx.moveTo(hx + headR * 0.0, hy + headR * 0.48);
      ctx.quadraticCurveTo(hx + headR * 0.3, hy + headR * 0.36, hx + headR * 0.62, hy + headR * 0.5);
      ctx.stroke();
    }
    if (look.glasses) {
      ctx.strokeStyle = 'rgba(30,24,20,0.9)';
      ctx.lineWidth = 1.2 * S;
      for (const ex of [0.05, 0.5]) {
        ctx.beginPath();
        ctx.arc(hx + headR * ex, hy - headR * 0.05, headR * 0.17, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  // волосы
  if (look.hat === 'none' || back) {
    ctx.beginPath();
    if (back) ctx.ellipse(hx, hy - headR * 0.05, headR * 0.88, headR * 0.98, 0, Math.PI * 1.05, Math.PI * 1.95 + 0.9);
    else ctx.ellipse(hx - headR * 0.08, hy - headR * 0.35, headR * 0.9, headR * 0.7, 0, Math.PI * 0.95, Math.PI * 2.05);
    volumeFill(ctx, hair, hx - headR, hy - headR, hx + headR, hy + headR * 0.5, 0.2, -0.35);
  }
  // головной убор
  if (look.hat === 'bowler') {
    ctx.beginPath();
    ctx.ellipse(hx, hy - headR * 0.55, headR * 1.3, headR * 0.26, -0.05, 0, Math.PI * 2);
    volumeFill(ctx, [24, 22, 20], hx - headR, hy - headR, hx + headR, hy - headR * 0.3, 0.3, -0.3);
    ctx.beginPath();
    ctx.ellipse(hx, hy - headR * 0.75, headR * 0.82, headR * 0.72, 0, Math.PI, 0);
    volumeFill(ctx, [30, 27, 25], hx - headR, hy - headR * 1.5, hx + headR, hy - headR * 0.6, 0.3, -0.3);
  } else if (look.hat === 'cap') {
    ctx.beginPath();
    ctx.ellipse(hx - headR * 0.05, hy - headR * 0.55, headR * 0.98, headR * 0.5, 0, Math.PI, 0);
    volumeFill(ctx, look.dress === 'uniform' ? [36, 44, 58] : [32, 32, 34], hx - headR, hy - headR * 1.1, hx + headR, hy - headR * 0.5, 0.25, -0.3);
    if (look.dress === 'uniform') {
      ctx.fillStyle = 'rgba(160,40,40,0.95)';
      ctx.fillRect(hx - headR * 1.0, hy - headR * 0.68, headR * 1.95, headR * 0.16);
    }
    if (!back) {
      ctx.fillStyle = 'rgba(12,10,10,1)';
      ctx.beginPath();
      ctx.ellipse(hx + headR * 0.55, hy - headR * 0.5, headR * 0.6, headR * 0.16, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look.hat === 'kerchief') {
    const kc = shade(coat, 0.28);
    ctx.beginPath();
    ctx.moveTo(hx - headR * 1.0, hy + headR * 0.9);
    ctx.bezierCurveTo(hx - headR * 1.3, hy - headR * 1.6, hx + headR * 1.3, hy - headR * 1.6, hx + headR * 1.0, hy + headR * 0.9);
    if (!back) ctx.bezierCurveTo(hx + headR * 0.9, hy - headR * 0.4, hx - headR * 0.8, hy - headR * 0.5, hx - headR * 1.0, hy + headR * 0.9);
    ctx.closePath();
    volumeFill(ctx, kc, hx - headR, hy - headR, hx + headR, hy + headR, 0.22, -0.35);
  }
  // контровой свет слева
  ctx.globalCompositeOperation = 'source-atop';
  const rim = ctx.createLinearGradient(cx - Ww * 0.4, 0, cx - Ww * 0.1, 0);
  rim.addColorStop(0, 'rgba(255,225,170,0.22)');
  rim.addColorStop(1, 'rgba(255,225,170,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, cv.width, foot - 6 * S);
  ctx.globalCompositeOperation = 'source-over';

  const out = canvas(cv.width / S, cv.height / S);
  const octx = out.getContext('2d')!;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(cv, 0, 0, out.width, out.height);
  return { canvas: out, foot: [cx / S, foot / S] };
}
