// Процедурная «живопись» плейсхолдеров: крупный мазок, фактура холста, края растворяются в грунт.
// Всё строится из scene.json, поэтому замена на арт художника (base/fore/hidden/light.webp) не требует правок кода.
import type { PropDef, SceneDef } from '../content/schemas';
import { boxCorners, convexHull, hash, prng, toScreen, type Vec2 } from './iso';

type RGB = [number, number, number];
export function hex(c: string): RGB {
  const s = c.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((x) => x + x).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(c: RGB, a = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}
export function shade(c: RGB, f: number): RGB {
  return f >= 0 ? [c[0] + (255 - c[0]) * f, c[1] + (255 - c[1]) * f, c[2] + (255 - c[2]) * f] : [c[0] * (1 + f), c[1] * (1 + f), c[2] * (1 + f)];
}
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Мазок: чуть изогнутая линия с круглым концом. */
function brush(ctx: CanvasRenderingContext2D, r: () => number, x: number, y: number, ang: number, len: number, w: number, col: RGB, a: number) {
  const dx = Math.cos(ang) * len;
  const dy = Math.sin(ang) * len;
  const bend = (r() - 0.5) * len * 0.25;
  ctx.strokeStyle = rgba(col, a);
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - dx / 2, y - dy / 2);
  ctx.quadraticCurveTo(x - Math.sin(ang) * bend, y + Math.cos(ang) * bend, x + dx / 2, y + dy / 2);
  ctx.stroke();
}

function polyPath(ctx: CanvasRenderingContext2D, pts: Vec2[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
}

function bbox(pts: Vec2[]) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Живописная заливка многоугольника: плоский тон + мазки вдоль заданных направлений. */
export function paintPoly(
  ctx: CanvasRenderingContext2D,
  r: () => number,
  pts: Vec2[],
  col: RGB,
  opts: { angles: number[]; density?: number; len?: number; width?: number; jitter?: number; alpha?: number; edge?: RGB | null } = { angles: [0] },
) {
  const { angles, density = 1, len = 26, width = 7, jitter = 0.12, alpha = 0.42, edge = null } = opts;
  ctx.save();
  polyPath(ctx, pts);
  ctx.fillStyle = rgba(col);
  ctx.fill();
  ctx.clip();
  const b = bbox(pts);
  const area = (b.x1 - b.x0) * (b.y1 - b.y0);
  const n = Math.min(4000, Math.floor((area / 260) * density));
  for (let i = 0; i < n; i++) {
    const x = b.x0 + r() * (b.x1 - b.x0);
    const y = b.y0 + r() * (b.y1 - b.y0);
    const f = (r() - 0.5) * 2 * jitter;
    const ang = angles[Math.floor(r() * angles.length)] + (r() - 0.5) * 0.35;
    brush(ctx, r, x, y, ang, len * (0.5 + r()), width * (0.6 + r() * 0.8), shade(col, f), alpha * (0.5 + r() * 0.6));
  }
  ctx.restore();
  if (edge) {
    ctx.save();
    polyPath(ctx, pts);
    ctx.strokeStyle = rgba(edge, 0.55);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }
}

/** Фактура холста: мелкая сетка и шум. */
function canvasTexture(ctx: CanvasRenderingContext2D, r: () => number, w: number, h: number, base: RGB) {
  ctx.fillStyle = rgba(base);
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.07;
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = rgba(shade(base, r() > 0.5 ? -0.15 : 0.1));
    ctx.fillRect(0, y, w, 1);
  }
  for (let x = 0; x < w; x += 3) {
    ctx.fillStyle = rgba(shade(base, r() > 0.5 ? -0.12 : 0.08));
    ctx.fillRect(x, 0, 1, h);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < (w * h) / 900; i++) brush(ctx, r, r() * w, r() * h, r() * Math.PI, 10 + r() * 30, 3 + r() * 6, shade(base, (r() - 0.5) * 0.12), 0.18);
}

const ISO_A = Math.atan2(0.5, 0.866); // направление оси x мира на экране
const ISO_B = Math.PI - ISO_A; // направление оси y

/** Основной фон сцены: грунт, пол, стены, свет. Края растворяются в недописанный грунт. */
export function paintBackground(s: SceneDef, marks: { lampOnly: Set<string> }): HTMLCanvasElement {
  const [W, H] = s.canvas;
  const r = prng(hash(s.id + ':bg'));
  const out = makeCanvas(W, H);
  const octx = out.getContext('2d')!;
  canvasTexture(octx, r, W, H, hex(s.palette.grunt));

  const paint = makeCanvas(W, H);
  const ctx = paint.getContext('2d')!;
  const pal = s.palette;
  // подмалёвок: земля вокруг
  ctx.fillStyle = rgba(hex(pal.ground));
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) brush(ctx, r, r() * W, r() * H, r() * Math.PI, 40 + r() * 60, 10 + r() * 18, shade(hex(pal.ground), (r() - 0.5) * 0.3), 0.25);

  // пол
  const floor = s.room.floor.map((p) => toScreen(s, p[0], p[1]));
  paintPoly(ctx, r, floor, hex(pal.floor), { angles: [ISO_A, ISO_B], density: 1.6, len: 30, width: 9, jitter: s.room.outdoor ? 0.22 : 0.14 });
  if (!s.room.outdoor) {
    // швы плит/половиц вдоль оси x
    ctx.save();
    polyPath(ctx, floor);
    ctx.clip();
    ctx.strokeStyle = rgba(shade(hex(pal.floor), -0.35), 0.25);
    ctx.lineWidth = 1.2;
    const maxY = Math.max(...s.room.floor.map((p) => p[1]));
    const maxX = Math.max(...s.room.floor.map((p) => p[0]));
    for (let y = 1; y < maxY; y += 1) {
      const a = toScreen(s, 0, y);
      const b = toScreen(s, maxX, y + (r() - 0.5) * 0.1);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // пятна, мусор, солома на полу
  {
    const fx = s.room.floor.map((p) => p[0]);
    const fy = s.room.floor.map((p) => p[1]);
    const X = Math.max(...fx);
    const Y = Math.max(...fy);
    ctx.save();
    polyPath(ctx, floor);
    ctx.clip();
    for (let i = 0; i < 9; i++) {
      const c = toScreen(s, r() * X, r() * Y);
      const rr = 30 + r() * 70;
      ctx.save();
      ctx.translate(c[0], c[1]);
      ctx.scale(1, 0.5);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, rr);
      g.addColorStop(0, 'rgba(20,16,10,0.22)');
      g.addColorStop(1, 'rgba(20,16,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-rr, -rr, rr * 2, rr * 2);
      ctx.restore();
    }
    for (let i = 0; i < 220; i++) {
      const c = toScreen(s, r() * X, r() * Y);
      if (s.room.outdoor || r() < 0.4) {
        ctx.strokeStyle = r() < 0.5 ? 'rgba(200,170,90,0.35)' : 'rgba(60,50,35,0.4)';
        ctx.lineWidth = 1;
        const a = r() * Math.PI;
        ctx.beginPath();
        ctx.moveTo(c[0], c[1]);
        ctx.lineTo(c[0] + Math.cos(a) * 8, c[1] + Math.sin(a) * 4);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(30,24,18,${0.25 + r() * 0.3})`;
        ctx.fillRect(c[0], c[1], 2 + r() * 3, 1.5 + r() * 2);
      }
    }
    ctx.restore();
  }

  // тени от предметов на полу
  for (const p of s.props) {
    if (p.walkable || ['flat', 'line', 'rug', 'papers', 'lamp', 'frame', 'poster', 'clock', 'pipe', 'broom'].includes(p.shape)) continue;
    const z0 = p.z ?? 0;
    if (z0 > 0.5) continue;
    const c = toScreen(s, p.pos[0] + 0.25, p.pos[1] + 0.3);
    const rx = ((p.size[0] + p.size[1]) * 0.55 * s.pxPerArshin) / 1.6;
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,6,0.32)';
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], rx, rx * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // стены
  for (const w of s.room.walls) {
    const a0 = toScreen(s, w.from[0], w.from[1]);
    const a1 = toScreen(s, w.to[0], w.to[1]);
    const b1 = toScreen(s, w.to[0], w.to[1], w.h);
    const b0 = toScreen(s, w.from[0], w.from[1], w.h);
    const alongX = w.from[1] === w.to[1];
    const wc = alongX ? hex(pal.wall) : hex(pal.wallDark);
    paintPoly(ctx, r, [a0, a1, b1, b0], wc, { angles: [Math.PI / 2, alongX ? ISO_A : ISO_B], density: 1.3, len: 24, width: 8, jitter: 0.14 });
    // сырость у пола
    ctx.save();
    polyPath(ctx, [a0, a1, b1, b0]);
    ctx.clip();
    const g = ctx.createLinearGradient(0, a0[1], 0, a0[1] - w.h * s.pxPerArshin * 0.6);
    g.addColorStop(0, 'rgba(20,24,18,0.45)');
    g.addColorStop(1, 'rgba(20,24,18,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const along = (t: number, z: number): Vec2 => {
      const len = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]);
      const ux = (w.to[0] - w.from[0]) / len;
      const uy = (w.to[1] - w.from[1]) / len;
      return toScreen(s, w.from[0] + ux * t, w.from[1] + uy * t, z);
    };
    if (w.window) {
      const { at, w: ww, h: wh, z } = w.window;
      const quad = [along(at - ww / 2, z), along(at + ww / 2, z), along(at + ww / 2, z + wh), along(at - ww / 2, z + wh)];
      const glow = s.room.outdoor ? hex('#5a6a7a') : hex('#b8c8d8');
      paintPoly(ctx, r, quad, glow, { angles: [Math.PI / 2], density: 2, len: 12, width: 5, jitter: 0.2 });
      ctx.strokeStyle = 'rgba(30,26,22,0.8)';
      ctx.lineWidth = 3;
      polyPath(ctx, quad);
      ctx.stroke();
      for (let i = 1; i < 4; i++) {
        const t = at - ww / 2 + (ww * i) / 4;
        const p0 = along(t, z);
        const p1 = along(t, z + wh);
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }
      // световое пятно от окна на полу
      if (!s.room.outdoor) {
        const fl = along(at, 0);
        const g2 = ctx.createRadialGradient(fl[0], fl[1] + 60, 10, fl[0], fl[1] + 60, 220);
        g2.addColorStop(0, 'rgba(190,205,225,0.28)');
        g2.addColorStop(1, 'rgba(190,205,225,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, W, H);
      }
    }
    // износ: облупленная штукатурка с кирпичом, трещины, подтёки
    {
      const len = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]);
      ctx.save();
      polyPath(ctx, [a0, a1, b1, b0]);
      ctx.clip();
      const wear = s.wear ?? 0.5;
      const patches = Math.round((len / 4) * wear * 1.6);
      for (let i = 0; i < patches; i++) {
        const t0 = 0.6 + r() * (len - 2.2);
        const z1 = 0.3 + r() * (w.h - 1.4);
        const pw = 0.7 + r() * 1.1;
        const ph = 0.4 + r() * 0.7;
        const quad = [along(t0, z1), along(t0 + pw, z1 + (r() - 0.5) * 0.2), along(t0 + pw * 0.9, z1 + ph), along(t0 + 0.1, z1 + ph * 0.9)];
        const brick = mix(wc, shade(hex('#8a5038'), alongX ? 0 : -0.2), 0.55);
        paintPoly(ctx, r, quad, brick, { angles: [alongX ? ISO_A : ISO_B], density: 3, len: 8, width: 4, jitter: 0.2 });
        ctx.strokeStyle = 'rgba(200,180,150,0.45)';
        ctx.lineWidth = 1;
        for (let rz = 0; rz < ph; rz += 0.14) {
          const pa = along(t0, z1 + rz);
          const pb = along(t0 + pw, z1 + rz);
          ctx.beginPath();
          ctx.moveTo(pa[0], pa[1]);
          ctx.lineTo(pb[0], pb[1]);
          ctx.stroke();
        }
        ctx.strokeStyle = rgba(shade(wc, -0.5), 0.6);
        ctx.lineWidth = 1.5;
        polyPath(ctx, quad);
        ctx.stroke();
      }
      // трещины
      ctx.strokeStyle = rgba(shade(wc, -0.55), 0.55);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < Math.round(patches * 0.8 + wear * 2); i++) {
        let t = r() * len;
        let z = w.h * (0.5 + r() * 0.5);
        ctx.beginPath();
        let p0 = along(t, z);
        ctx.moveTo(p0[0], p0[1]);
        for (let k = 0; k < 6; k++) {
          t += (r() - 0.5) * 0.5;
          z -= 0.15 + r() * 0.3;
          p0 = along(t, Math.max(0, z));
          ctx.lineTo(p0[0], p0[1]);
        }
        ctx.stroke();
      }
      // подтёки сырости
      for (let i = 0; i < patches; i++) {
        const c = along(r() * len, w.h * (0.6 + r() * 0.35));
        const g = ctx.createLinearGradient(c[0], c[1], c[0], c[1] + 120);
        g.addColorStop(0, `rgba(40,36,24,${0.08 + wear * 0.18})`);
        g.addColorStop(1, 'rgba(40,36,24,0)');
        ctx.fillStyle = g;
        ctx.fillRect(c[0] - 14 - r() * 10, c[1], 28 + r() * 20, 120);
      }
      // плинтус
      if (!s.room.outdoor) {
        ctx.strokeStyle = rgba(shade(wc, -0.45), 0.9);
        ctx.lineWidth = 5;
        const pa = along(0, 0.12);
        const pb = along(len, 0.12);
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (w.door) {
      const { at, w: dw, h: dh } = w.door;
      const quad = [along(at - dw / 2, 0), along(at + dw / 2, 0), along(at + dw / 2, dh), along(at - dw / 2, dh)];
      paintPoly(ctx, r, quad, hex('#1c1714'), { angles: [Math.PI / 2], density: 1.5, len: 16, width: 6, jitter: 0.25 });
    }
  }

  // свет: тёплые и холодные пятна источников
  for (const src of s.light.sources) {
    const c = toScreen(s, src.pos[0], src.pos[1]);
    const col = hex(src.color ?? '#e0b070');
    const g = ctx.createRadialGradient(c[0], c[1], 5, c[0], c[1], src.radius * s.pxPerArshin * 0.9);
    g.addColorStop(0, rgba(col, 0.22 * src.power));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // видимые следы (не только под лампой) — прямо в фон
  const marksCanvas = paintMarks(s, (id) => !marks.lampOnly.has(id));
  ctx.drawImage(marksCanvas, 0, 0);

  // маска: живопись растворяется к краям холста
  const mask = makeCanvas(W, H);
  const mctx = mask.getContext('2d')!;
  const cx = W / 2;
  const cy = H / 2;
  mctx.save();
  mctx.translate(cx, cy);
  mctx.scale(1, H / W);
  const g = mctx.createRadialGradient(0, 0, W * 0.36, 0, 0, W * 0.56);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.9)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  mctx.fillStyle = g;
  mctx.fillRect(-W, -W, W * 2, W * 2);
  mctx.restore();
  // рваный край — мелкими мазками только в узкой полосе у края
  mctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 520; i++) {
    const side = Math.floor(r() * 4);
    const t = r();
    const band = 40 + r() * 50;
    const x = side === 0 ? t * W : side === 1 ? W - r() * band : side === 2 ? t * W : r() * band;
    const y = side === 0 ? r() * band * 0.7 : side === 1 ? t * H : side === 2 ? H - r() * band * 0.7 : t * H;
    brush(mctx, r, x, y, r() * Math.PI, 18 + r() * 34, 5 + r() * 9, [0, 0, 0], 0.22 + r() * 0.2);
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  octx.drawImage(paint, 0, 0);
  return out;
}

/** Следы и метки из scene.hidden (следы обуви, орнамент, лапы…). */
export function paintMarks(s: SceneDef, filter: (id: string) => boolean): HTMLCanvasElement {
  const [W, H] = s.canvas;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d')!;
  for (const m of s.hidden) {
    if (!filter(m.id)) continue;
    const r = prng(hash(m.id));
    const col = hex(m.color ?? '#1a1612');
    const z = m.z ?? 0;
    if (m.shape === 'footprints' || m.shape === 'paws') {
      const to = m.to ?? m.from;
      const len = Math.hypot(to[0] - m.from[0], to[1] - m.from[1]);
      const step = m.shape === 'paws' ? 0.28 : 0.42;
      const n = Math.max(2, Math.floor(len / step));
      const ux = (to[0] - m.from[0]) / len;
      const uy = (to[1] - m.from[1]) / len;
      for (let pair = 0; pair < (m.shape === 'paws' ? 1 : 2); pair++) {
        const off = m.shape === 'paws' ? 0 : pair === 0 ? -0.22 : 0.22;
        for (let i = 0; i < n; i++) {
          const side = i % 2 ? 1 : -1;
          const wx = m.from[0] + ux * i * step - uy * (off + side * 0.08) + (r() - 0.5) * 0.04;
          const wy = m.from[1] + uy * i * step + ux * (off + side * 0.08) + (r() - 0.5) * 0.04;
          const p = toScreen(s, wx, wy, z);
          ctx.save();
          ctx.translate(p[0], p[1]);
          ctx.rotate(Math.atan2(uy * 0.5 + ux * 0.5, ux * 0.866 - uy * 0.866));
          ctx.fillStyle = rgba(col, 0.6 + r() * 0.3);
          if (m.shape === 'paws') {
            for (let k = 0; k < 4; k++) {
              ctx.beginPath();
              ctx.ellipse(-3 + k * 2.2, (k % 3 === 0 ? 0 : -2.5), 1.8, 1.4, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            const big = pair === 1;
            ctx.beginPath();
            ctx.ellipse(0, 0, big ? 9 : 7, big ? 4.2 : 3.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(-10, 0, big ? 4.5 : 3.2, big ? 3.6 : 2.6, 0, 0, Math.PI * 2);
            ctx.fill();
            if (big) {
              ctx.strokeStyle = rgba(shade(col, 0.4), 0.8);
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.arc(-10, 0, 3, -1.2, 1.2);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }
    } else if (m.shape === 'ornament') {
      const p = toScreen(s, m.from[0], m.from[1], z);
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.scale(1, 0.55);
      ctx.strokeStyle = rgba(col, 0.85);
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 9; k++) {
        ctx.beginPath();
        const a0 = (k / 9) * Math.PI * 2;
        ctx.arc(Math.cos(a0) * 16, Math.sin(a0) * 16, 7, a0, a0 + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.strokeRect(-26, -16, 52, 32);
      ctx.restore();
    } else if (m.shape === 'contour' || m.shape === 'handprint') {
      const p = toScreen(s, m.from[0], m.from[1], z);
      ctx.strokeStyle = rgba(col, 0.7);
      ctx.lineWidth = 2;
      ctx.strokeRect(p[0] - 18, p[1] - 8, 36, 16);
    }
  }
  return c;
}

export interface PropSprite {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  hull: Vec2[]; // силуэт в экранных координатах
}

/** Отрисовка одного предмета в собственный холст (для сортировки по глубине). */
export function paintProp(s: SceneDef, p: PropDef): PropSprite {
  const [w, d, h] = p.size;
  const z0 = p.z ?? 0;
  const cs = boxCorners(s, p.pos[0], p.pos[1], w, d, z0, Math.max(h, 0.01));
  const all = Object.values(cs);
  const extra = p.shape === 'stove' ? [toScreen(s, p.pos[0] + w * 0.25, p.pos[1] - d * 0.25, z0 + h + 1.4)] : [];
  const hull = convexHull([...all, ...extra]);
  const b = bbox([...all, ...extra]);
  const pad = 14;
  const cv = makeCanvas(b.x1 - b.x0 + pad * 2, b.y1 - b.y0 + pad * 2);
  const ctx = cv.getContext('2d')!;
  ctx.translate(-b.x0 + pad, -b.y0 + pad);
  const r = prng(hash(s.id + p.id));
  const col = hex(p.color);
  const sharp = p.detail ? 0.08 : 0.16;
  const edge = p.detail ? shade(col, -0.55) : null;
  const top = (c: typeof cs) => [c['t-1-1'], c['t1-1'], c['t11'], c['t-11']];
  const faceX = (c: typeof cs) => [c['b1-1'], c['b11'], c['t11'], c['t1-1']]; // грань x=+
  const faceY = (c: typeof cs) => [c['b-11'], c['b11'], c['t11'], c['t-11']]; // грань y=+
  const drawBox = (c: typeof cs, colr: RGB, dens = 1) => {
    paintPoly(ctx, r, faceX(c), shade(colr, -0.28), { angles: [Math.PI / 2, ISO_B], density: dens, len: 14, width: 5, jitter: sharp, edge });
    paintPoly(ctx, r, faceY(c), shade(colr, -0.12), { angles: [Math.PI / 2, ISO_A], density: dens, len: 14, width: 5, jitter: sharp, edge });
    paintPoly(ctx, r, top(c), shade(colr, 0.12), { angles: [ISO_A, ISO_B], density: dens, len: 14, width: 5, jitter: sharp, edge });
  };
  const sub = (cx: number, cy: number, sw: number, sd: number, sz: number, sh: number) => boxCorners(s, cx, cy, sw, sd, sz, sh);

  switch (p.shape) {
    case 'flat': {
      paintPoly(ctx, r, top(cs), col, { angles: [ISO_A, ISO_B], density: 2, len: 10, width: 4, jitter: sharp + 0.05, edge });
      break;
    }
    case 'panel':
    case 'box':
    case 'counter':
      drawBox(cs, col);
      if (p.shape === 'counter') {
        const t = sub(p.pos[0], p.pos[1], w, d * 1.05, z0 + h * 0.92, h * 0.08);
        drawBox(t, shade(col, 0.2));
      }
      break;
    case 'shelf': {
      drawBox(cs, col);
      // полки на лицевой грани и предметы на них
      const face = Math.abs(w) > Math.abs(d) ? faceY(cs) : faceX(cs);
      ctx.strokeStyle = rgba(shade(col, -0.5), 0.9);
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        const a = [face[0][0] + (face[3][0] - face[0][0]) * t, face[0][1] + (face[3][1] - face[0][1]) * t];
        const bb = [face[1][0] + (face[2][0] - face[1][0]) * t, face[1][1] + (face[2][1] - face[1][1]) * t];
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(bb[0], bb[1]);
        ctx.stroke();
        for (let k = 0; k < 6; k++) {
          const u = 0.08 + r() * 0.84;
          const x = a[0] + (bb[0] - a[0]) * u;
          const y = a[1] + (bb[1] - a[1]) * u;
          ctx.fillStyle = rgba(shade(mix(col, [200, 180, 140], r() * 0.6), (r() - 0.5) * 0.4), 0.9);
          ctx.fillRect(x - 3, y - 10 - r() * 8, 5 + r() * 5, 10 + r() * 6);
        }
      }
      break;
    }
    case 'press': {
      const base = sub(p.pos[0], p.pos[1], w, d, z0, h * 0.35);
      drawBox(base, shade(col, 0.25));
      const postA = sub(p.pos[0] - w * 0.38, p.pos[1], w * 0.12, d * 0.5, z0 + h * 0.35, h * 0.6);
      const postB = sub(p.pos[0] + w * 0.38, p.pos[1], w * 0.12, d * 0.5, z0 + h * 0.35, h * 0.6);
      drawBox(postA, col, 0.6);
      drawBox(postB, col, 0.6);
      const beam = sub(p.pos[0], p.pos[1], w * 0.9, d * 0.5, z0 + h * 0.88, h * 0.12);
      drawBox(beam, col, 0.6);
      const platen = sub(p.pos[0], p.pos[1], w * 0.55, d * 0.7, z0 + h * 0.5, h * 0.08);
      drawBox(platen, shade(col, 0.15), 0.6);
      // валик с зеленоватой краской
      const roll = toScreen(s, p.pos[0] + w * 0.15, p.pos[1] + d * 0.45, z0 + h * 0.38);
      ctx.fillStyle = 'rgba(80,110,70,0.95)';
      ctx.beginPath();
      ctx.ellipse(roll[0], roll[1], 22, 7, -0.5, 0, Math.PI * 2);
      ctx.fill();
      // рычаг
      const hub = toScreen(s, p.pos[0] + w * 0.45, p.pos[1], z0 + h * 0.75);
      ctx.strokeStyle = rgba(shade(hex('#6a4a2a'), 0), 1);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(hub[0], hub[1]);
      ctx.lineTo(hub[0] + 46, hub[1] + 16);
      ctx.stroke();
      break;
    }
    case 'stove': {
      drawBox(cs, col, 1.3);
      // кирпичная кладка
      ctx.save();
      for (const f of [faceX(cs), faceY(cs)]) {
        polyPath(ctx, f);
        ctx.clip();
      }
      ctx.restore();
      const fy = faceY(cs);
      const mouth: Vec2[] = [0.35, 0.65].flatMap((u) => [0.12, 0.4].map((v) => [fy[0][0] + (fy[1][0] - fy[0][0]) * u, fy[0][1] + (fy[1][1] - fy[0][1]) * u - (fy[0][1] - fy[3][1]) * v] as Vec2));
      ctx.fillStyle = 'rgba(15,10,8,0.95)';
      polyPath(ctx, [mouth[0], mouth[2], mouth[3], mouth[1]]);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,80,30,0.35)';
      polyPath(ctx, [mouth[0], mouth[2], mouth[3], mouth[1]]);
      ctx.fill();
      const chim = sub(p.pos[0] + w * 0.25, p.pos[1] - d * 0.25, w * 0.3, d * 0.3, z0 + h, 1.4);
      drawBox(chim, shade(col, -0.1), 0.8);
      break;
    }
    case 'cyl': {
      const c0 = toScreen(s, p.pos[0], p.pos[1], z0);
      const c1 = toScreen(s, p.pos[0], p.pos[1], z0 + h);
      const rx = (w * s.pxPerArshin) / 2;
      ctx.fillStyle = rgba(shade(col, -0.2));
      ctx.beginPath();
      ctx.ellipse(c0[0], c0[1], rx, rx * 0.5, 0, 0, Math.PI);
      ctx.lineTo(c1[0] - rx, c1[1]);
      ctx.ellipse(c1[0], c1[1], rx, rx * 0.5, 0, Math.PI, 0, true);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 60; i++) brush(ctx, r, c0[0] + (r() - 0.5) * rx * 1.8, c1[1] + r() * (c0[1] - c1[1]), Math.PI / 2, 14, 5, shade(col, (r() - 0.5) * 0.3), 0.4);
      ctx.fillStyle = rgba(shade(col, 0.15));
      ctx.beginPath();
      ctx.ellipse(c1[0], c1[1], rx, rx * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bottles': {
      for (let i = 0; i < 6; i++) {
        const bx = p.pos[0] - w / 2 + (w * (i + 0.5)) / 6;
        const b0 = toScreen(s, bx, p.pos[1], z0);
        const bh = (h * (0.7 + r() * 0.4) * s.pxPerArshin);
        ctx.fillStyle = rgba(shade(col, (r() - 0.5) * 0.3), 0.95);
        ctx.fillRect(b0[0] - 6, b0[1] - bh, 12, bh);
        ctx.fillRect(b0[0] - 2.5, b0[1] - bh - 8, 5, 8);
        ctx.fillStyle = 'rgba(230,220,190,0.9)';
        ctx.fillRect(b0[0] - 5, b0[1] - bh * 0.6, 10, bh * 0.25);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(b0[0] - 4, b0[1] - bh + 3, 2, bh - 6);
      }
      break;
    }
    case 'coat': {
      const tp = toScreen(s, p.pos[0], p.pos[1], z0 + h);
      const bt = toScreen(s, p.pos[0], p.pos[1], z0);
      const hw = (w * s.pxPerArshin) / 2;
      ctx.fillStyle = rgba(col);
      ctx.beginPath();
      ctx.moveTo(tp[0] - hw * 0.4, tp[1]);
      ctx.lineTo(tp[0] + hw * 0.4, tp[1]);
      ctx.lineTo(bt[0] + hw, bt[1]);
      ctx.lineTo(bt[0] - hw, bt[1]);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 70; i++) brush(ctx, r, tp[0] + (r() - 0.5) * hw * 1.6, tp[1] + r() * (bt[1] - tp[1]), Math.PI / 2 + (r() - 0.5) * 0.3, 18, 5, shade(col, (r() - 0.5) * 0.4), 0.45);
      ctx.strokeStyle = 'rgba(160,150,140,0.5)';
      ctx.beginPath();
      ctx.moveTo(tp[0], tp[1] + 6);
      ctx.lineTo(bt[0], bt[1]);
      ctx.stroke();
      ctx.fillStyle = '#8a7a60';
      ctx.fillRect(tp[0] - 2, tp[1] - 8, 4, 8);
      break;
    }
    case 'line': {
      const a = toScreen(s, p.pos[0] - w / 2, p.pos[1], h);
      const bb = toScreen(s, p.pos[0] + w / 2, p.pos[1], h);
      ctx.strokeStyle = rgba(col, 0.9);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo((a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2 + 10, bb[0], bb[1]);
      ctx.stroke();
      break;
    }
    case 'bunk': {
      const lower = sub(p.pos[0], p.pos[1], w, d, z0 + 0.4, 0.15);
      const upper = sub(p.pos[0], p.pos[1], w, d, z0 + 1.5, 0.15);
      for (const lx of [-0.48, 0.48]) for (const ly of [-0.45, 0.45]) drawBox(sub(p.pos[0] + lx * w, p.pos[1] + ly * d, 0.12, 0.12, z0, h), shade(col, -0.2), 0.3);
      drawBox(lower, col);
      drawBox(upper, col);
      // свёртки и тулупы
      for (let i = 0; i < 6; i++) {
        const q = toScreen(s, p.pos[0] + (r() - 0.5) * w * 0.9, p.pos[1] + (r() - 0.5) * d * 0.7, z0 + (r() > 0.5 ? 1.65 : 0.55));
        ctx.fillStyle = rgba(shade(hex('#5a5048'), (r() - 0.5) * 0.4), 0.95);
        ctx.beginPath();
        ctx.ellipse(q[0], q[1], 16 + r() * 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'cat': {
      const c0 = toScreen(s, p.pos[0], p.pos[1], z0);
      ctx.fillStyle = rgba(col);
      ctx.beginPath();
      ctx.ellipse(c0[0], c0[1] - 8, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c0[0] + 14, c0[1] - 14, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(c0[0] + 10, c0[1] - 19);
      ctx.lineTo(c0[0] + 12, c0[1] - 27);
      ctx.lineTo(c0[0] + 16, c0[1] - 20);
      ctx.moveTo(c0[0] + 16, c0[1] - 20);
      ctx.lineTo(c0[0] + 20, c0[1] - 26);
      ctx.lineTo(c0[0] + 21, c0[1] - 17);
      ctx.fill();
      ctx.strokeStyle = rgba(col);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(c0[0] - 16, c0[1] - 6);
      ctx.quadraticCurveTo(c0[0] - 26, c0[1] + 2, c0[0] - 10, c0[1] + 2);
      ctx.stroke();
      break;
    }
    case 'table':
    case 'stool': {
      const legs = p.shape === 'stool' ? [[-0.3, -0.3], [0.3, -0.3], [0, 0.35]] : [[-0.42, -0.4], [0.42, -0.4], [-0.42, 0.4], [0.42, 0.4]];
      for (const [lx, ly] of legs) drawBox(sub(p.pos[0] + lx * w, p.pos[1] + ly * d, 0.09, 0.09, z0, h * 0.92), shade(col, -0.25), 0.3);
      drawBox(sub(p.pos[0], p.pos[1], w, d, z0 + h * 0.9, h * 0.1), col);
      if (p.shape === 'table') {
        // мелочи на столе
        for (let i = 0; i < 3; i++) {
          const q = toScreen(s, p.pos[0] + (r() - 0.5) * w * 0.7, p.pos[1] + (r() - 0.5) * d * 0.6, z0 + h);
          ctx.fillStyle = rgba(shade(hex('#d8ccb0'), (r() - 0.5) * 0.3), 0.95);
          ctx.beginPath();
          ctx.ellipse(q[0], q[1], 8 + r() * 6, 4, r(), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'chair': {
      for (const [lx, ly] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) drawBox(sub(p.pos[0] + lx * w, p.pos[1] + ly * d, 0.06, 0.06, z0, h * 0.45), shade(col, -0.2), 0.3);
      drawBox(sub(p.pos[0], p.pos[1], w, d, z0 + h * 0.42, h * 0.06), col, 0.6);
      drawBox(sub(p.pos[0], p.pos[1] - d * 0.45, w, d * 0.1, z0 + h * 0.48, h * 0.52), shade(col, -0.05), 0.6);
      break;
    }
    case 'crate': {
      drawBox(cs, col);
      ctx.strokeStyle = rgba(shade(col, -0.5), 0.8);
      ctx.lineWidth = 1.5;
      for (const f of [faceX(cs), faceY(cs)]) {
        for (let i = 1; i < 4; i++) {
          const t = i / 4;
          ctx.beginPath();
          ctx.moveTo(f[0][0] + (f[3][0] - f[0][0]) * t, f[0][1] + (f[3][1] - f[0][1]) * t);
          ctx.lineTo(f[1][0] + (f[2][0] - f[1][0]) * t, f[1][1] + (f[2][1] - f[1][1]) * t);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(f[0][0], f[0][1]);
        ctx.lineTo(f[2][0], f[2][1]);
        ctx.stroke();
      }
      break;
    }
    case 'sack': {
      const c0 = toScreen(s, p.pos[0], p.pos[1], z0);
      const rx = (w * s.pxPerArshin) / 2;
      const hh = h * s.pxPerArshin;
      ctx.beginPath();
      ctx.moveTo(c0[0] - rx, c0[1]);
      ctx.bezierCurveTo(c0[0] - rx * 1.2, c0[1] - hh * 0.7, c0[0] - rx * 0.4, c0[1] - hh, c0[0], c0[1] - hh * 1.05);
      ctx.bezierCurveTo(c0[0] + rx * 0.4, c0[1] - hh, c0[0] + rx * 1.2, c0[1] - hh * 0.7, c0[0] + rx, c0[1]);
      ctx.quadraticCurveTo(c0[0], c0[1] + rx * 0.5, c0[0] - rx, c0[1]);
      ctx.fillStyle = rgba(col);
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let i = 0; i < 70; i++) brush(ctx, r, c0[0] + (r() - 0.5) * rx * 2, c0[1] - r() * hh, 1.2 + (r() - 0.5), 14, 5, shade(col, (r() - 0.5) * 0.35), 0.4);
      const g = ctx.createLinearGradient(c0[0] - rx, 0, c0[0] + rx, 0);
      g.addColorStop(0, 'rgba(255,240,210,0.15)');
      g.addColorStop(1, 'rgba(20,10,0,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(c0[0] - rx * 1.3, c0[1] - hh * 1.1, rx * 2.6, hh * 1.3);
      ctx.restore();
      ctx.strokeStyle = 'rgba(60,40,20,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c0[0] - 5, c0[1] - hh * 0.9);
      ctx.lineTo(c0[0] + 5, c0[1] - hh * 0.92);
      ctx.stroke();
      break;
    }
    case 'bucket': {
      const c0 = toScreen(s, p.pos[0], p.pos[1], z0);
      const c1 = toScreen(s, p.pos[0], p.pos[1], z0 + h);
      const rx0 = (w * s.pxPerArshin) / 2.4;
      const rx1 = (w * s.pxPerArshin) / 2;
      ctx.fillStyle = rgba(shade(col, -0.15));
      ctx.beginPath();
      ctx.moveTo(c0[0] - rx0, c0[1]);
      ctx.lineTo(c1[0] - rx1, c1[1]);
      ctx.lineTo(c1[0] + rx1, c1[1]);
      ctx.lineTo(c0[0] + rx0, c0[1]);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(shade(col, -0.55));
      ctx.beginPath();
      ctx.ellipse(c1[0], c1[1], rx1, rx1 * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(shade(col, 0.3), 0.8);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(c1[0], c1[1] - rx1 * 0.3, rx1, rx1 * 1.1, 0, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case 'lamp': {
      // висячая керосиновая лампа: шнур от свода, стекло со светом
      const top = toScreen(s, p.pos[0], p.pos[1], z0 + h);
      const c = toScreen(s, p.pos[0], p.pos[1], z0);
      ctx.strokeStyle = 'rgba(30,24,18,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(top[0], top[1]);
      ctx.lineTo(c[0], c[1] - 18);
      ctx.stroke();
      const g = ctx.createRadialGradient(c[0], c[1], 2, c[0], c[1], 46);
      g.addColorStop(0, 'rgba(255,214,140,0.55)');
      g.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c[0] - 50, c[1] - 50, 100, 100);
      ctx.fillStyle = rgba(col);
      ctx.beginPath();
      ctx.ellipse(c[0], c[1] - 16, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,236,190,0.9)';
      ctx.beginPath();
      ctx.ellipse(c[0], c[1] - 4, 6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(shade(col, -0.2));
      ctx.fillRect(c[0] - 8, c[1] + 4, 16, 7);
      break;
    }
    case 'frame':
    case 'poster':
    case 'clock': {
      const alongX = w >= d;
      const face = alongX ? faceY(cs) : faceX(cs);
      paintPoly(ctx, r, face, p.shape === 'frame' ? hex('#6a4a24') : col, { angles: [Math.PI / 2], density: 2, len: 8, width: 3, jitter: 0.12, edge: shade(col, -0.6) });
      const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const ins = 0.14;
      const inner: Vec2[] = [
        lerp(lerp(face[0], face[1], ins), lerp(face[3], face[2], ins), ins),
        lerp(lerp(face[0], face[1], 1 - ins), lerp(face[3], face[2], 1 - ins), ins),
        lerp(lerp(face[0], face[1], 1 - ins), lerp(face[3], face[2], 1 - ins), 1 - ins),
        lerp(lerp(face[0], face[1], ins), lerp(face[3], face[2], ins), 1 - ins),
      ];
      if (p.shape === 'frame') {
        paintPoly(ctx, r, inner, col, { angles: [0.2, 1.5], density: 6, len: 8, width: 3, jitter: 0.35 });
      } else if (p.shape === 'poster') {
        paintPoly(ctx, r, inner, hex('#d8ceb0'), { angles: [0], density: 4, len: 6, width: 2, jitter: 0.08 });
        ctx.strokeStyle = 'rgba(50,30,20,0.75)';
        ctx.lineWidth = 2;
        for (let i = 1; i < 6; i++) {
          const a = lerp(inner[0], inner[3], i / 6);
          const b = lerp(inner[1], inner[2], i / 6);
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(a[0] + (b[0] - a[0]) * (i === 1 ? 0.9 : 0.4 + r() * 0.5), a[1] + (b[1] - a[1]) * (i === 1 ? 0.9 : 0.4 + r() * 0.5));
          ctx.stroke();
        }
      } else {
        const c = lerp(lerp(face[0], face[2], 0.5), lerp(face[1], face[3], 0.5), 0.5);
        ctx.fillStyle = '#e8dfc8';
        ctx.beginPath();
        ctx.ellipse(c[0], c[1] - 6, 12, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a2018';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c[0], c[1] - 6);
        ctx.lineTo(c[0], c[1] - 16);
        ctx.moveTo(c[0], c[1] - 6);
        ctx.lineTo(c[0] + 7, c[1] - 3);
        ctx.stroke();
        ctx.strokeStyle = '#b8902a';
        ctx.beginPath();
        ctx.moveTo(c[0], c[1] + 8);
        ctx.lineTo(c[0], c[1] + 26);
        ctx.stroke();
        ctx.fillStyle = '#c9a040';
        ctx.beginPath();
        ctx.arc(c[0], c[1] + 28, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'rug': {
      const t = top(cs);
      paintPoly(ctx, r, t, col, { angles: [ISO_A, ISO_B], density: 3, len: 10, width: 4, jitter: 0.18 });
      const lerp = (a: Vec2, b: Vec2, k2: number): Vec2 => [a[0] + (b[0] - a[0]) * k2, a[1] + (b[1] - a[1]) * k2];
      const c = [lerp(t[0], t[2], 0.12), lerp(t[1], t[3], 0.12), lerp(t[2], t[0], 0.12), lerp(t[3], t[1], 0.12)];
      ctx.strokeStyle = rgba(shade(col, 0.4), 0.8);
      ctx.lineWidth = 3;
      polyPath(ctx, [c[0], c[1], c[2], c[3]]);
      ctx.stroke();
      break;
    }
    case 'pipe': {
      const c0 = toScreen(s, p.pos[0], p.pos[1], z0);
      const c1 = toScreen(s, p.pos[0], p.pos[1], z0 + h);
      const g = ctx.createLinearGradient(c0[0] - 6, 0, c0[0] + 6, 0);
      g.addColorStop(0, rgba(shade(col, 0.3)));
      g.addColorStop(1, rgba(shade(col, -0.5)));
      ctx.fillStyle = g;
      ctx.fillRect(c0[0] - 5, c1[1], 10, c0[1] - c1[1]);
      ctx.fillStyle = rgba(shade(col, -0.3));
      for (let i = 1; i < 4; i++) ctx.fillRect(c0[0] - 7, c1[1] + ((c0[1] - c1[1]) * i) / 4, 14, 4);
      break;
    }
    case 'papers': {
      for (let i = 0; i < 7; i++) {
        const q = toScreen(s, p.pos[0] + (r() - 0.5) * w, p.pos[1] + (r() - 0.5) * d, z0 + 0.01);
        ctx.save();
        ctx.translate(q[0], q[1]);
        ctx.rotate((r() - 0.5) * 1.2);
        ctx.scale(1, 0.55);
        ctx.fillStyle = rgba(shade(col, (r() - 0.5) * 0.25), 0.95);
        ctx.fillRect(-11, -14, 22, 28);
        ctx.strokeStyle = 'rgba(60,40,20,0.35)';
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(-8, -9 + k * 6);
          ctx.lineTo(7, -9 + k * 6);
          ctx.stroke();
        }
        ctx.restore();
      }
      break;
    }
    case 'broom': {
      const a = toScreen(s, p.pos[0], p.pos[1], z0 + h);
      const b = toScreen(s, p.pos[0] + 0.3, p.pos[1], z0);
      ctx.strokeStyle = 'rgba(110,80,40,1)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1] - 16);
      ctx.stroke();
      ctx.strokeStyle = rgba(col, 0.9);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.moveTo(b[0], b[1] - 18);
        ctx.lineTo(b[0] + (i - 7) * 1.6, b[1]);
        ctx.stroke();
      }
      break;
    }
    case 'window':
      break;
  }
  return { canvas: cv, x: b.x0 - pad, y: b.y0 - pad, hull };
}

// ---------------- Люди ----------------
// Портреты и фигуры — в people.ts.
export { paintFigure, paintPortrait, type Look } from './people';
