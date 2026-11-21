// Фотопластинка собирается из данных: кадрирование живописного фона по положению треноги (обзорные, узловые)
// или крупный план улики (детальные) + линейка, сепия, зерно, виньетка и дефекты (смаз, темнота, дым магния).
import type { Content, SceneDef } from '../content/schemas';
import type { PhotoRec } from '../domain/state';
import { photoTarget } from '../domain/photo-judge';
import { hash, prng, toScreen } from './iso';
import { hex, makeCanvas, paintBackground, paintPoly, paintProp, rgba, shade } from './painter';

const sceneCache = new Map<string, HTMLCanvasElement>();
const plateCache = new Map<string, string>();

/** Полная «картина» сцены без людей: фон + предметы. */
export function scenePainting(s: SceneDef, lampOnly: Set<string>): HTMLCanvasElement {
  const key = s.id;
  const hit = sceneCache.get(key);
  if (hit) return hit;
  const base = paintBackground(s, { lampOnly });
  const c = makeCanvas(base.width, base.height);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(base, 0, 0);
  const props = [...s.props].sort((a, b) => a.pos[0] + a.pos[1] + (a.z ?? 0) - (b.pos[0] + b.pos[1] + (b.z ?? 0)));
  for (const p of props) {
    const sp = paintProp(s, p);
    ctx.drawImage(sp.canvas, sp.x, sp.y);
  }
  sceneCache.set(key, c);
  return c;
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: string, color: string, W: number, H: number, r: () => number, lit: boolean) {
  const col = hex(color);
  const cx = W / 2;
  const cy = H / 2;
  ctx.save();
  switch (icon) {
    case 'bills':
    case 'bill':
    case 'sheet':
    case 'negative': {
      const n = icon === 'bills' ? 4 : 1;
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.translate(cx + i * 6 - 10, cy + i * 5 - 8);
        ctx.rotate((r() - 0.5) * 0.1);
        const bw = W * 0.62;
        const bh = H * 0.42;
        const paper = icon === 'negative' ? hex('#2a3434') : shade(col, 0.35);
        paintPoly(ctx, r, [[-bw / 2, -bh / 2], [bw / 2, -bh / 2], [bw / 2, bh / 2], [-bw / 2, bh / 2]], paper, { angles: [0, 1.57], density: 4, len: 8, width: 3, jitter: 0.1 });
        ctx.strokeStyle = icon === 'negative' ? 'rgba(220,230,220,0.6)' : rgba(shade(col, -0.4), 0.85);
        ctx.lineWidth = 2;
        ctx.strokeRect(-bw / 2 + 8, -bh / 2 + 8, bw - 16, bh - 16);
        for (let k = 0; k < 14; k++) {
          ctx.beginPath();
          ctx.arc(-bw / 2 + 18 + (k % 7) * ((bw - 36) / 6), k < 7 ? -bh / 2 + 14 : bh / 2 - 14, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (icon !== 'sheet' || i === 0) {
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = 'bold 20px "Old Standard TT", serif';
          ctx.textAlign = 'center';
          ctx.fillText('25', 0, 8);
          ctx.font = '12px "Old Standard TT", serif';
          ctx.fillText('ВТ № 027413', 0, bh / 2 - 26);
        }
        ctx.restore();
      }
      break;
    }
    case 'press':
      ctx.fillStyle = '#2a2826';
      ctx.fillRect(cx - W * 0.4, cy - 10, W * 0.8, 40);
      ctx.fillStyle = 'rgba(80,110,70,1)';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 20, W * 0.3, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'stone':
      paintPoly(ctx, r, [[W * 0.15, H * 0.2], [W * 0.85, H * 0.2], [W * 0.85, H * 0.8], [W * 0.15, H * 0.8]], hex('#8c8a82'), { angles: [0.2, 1.8], density: 4, len: 14, width: 5 });
      if (lit) {
        ctx.strokeStyle = 'rgba(40,50,40,0.8)';
        ctx.lineWidth = 2;
        for (let k = 0; k < 10; k++) {
          ctx.beginPath();
          ctx.arc(cx + Math.cos(k) * 40, cy + Math.sin(k) * 25, 12, k, k + 4);
          ctx.stroke();
        }
      }
      break;
    case 'burnt':
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = rgba(shade(hex('#c8b890'), -r() * 0.6), 0.95);
        ctx.beginPath();
        const x = cx + (r() - 0.5) * W * 0.5;
        const y = cy + (r() - 0.5) * H * 0.4;
        for (let a = 0; a < 7; a++) {
          const rr = 30 + r() * 30;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,10,5,0.9)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,20,10,0.9)';
      ctx.font = '16px "Old Standard TT", serif';
      ctx.fillText('…7413', cx + 10, cy + 10);
      break;
    case 'fingerprint':
      ctx.strokeStyle = 'rgba(50,90,50,0.9)';
      ctx.lineWidth = 2;
      for (let k = 1; k < 12; k++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, k * 5, k * 7, 0.2, 0.3, Math.PI * 2 - 0.3);
        ctx.stroke();
      }
      break;
    case 'footprints':
    case 'paws':
      ctx.fillStyle = rgba(shade(col, -0.3), 0.9);
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.ellipse(cx - 50 + k * 90, cy + (k ? -10 : 10), 40, 16, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - 100 + k * 90, cy + (k ? -10 : 10), 18, 13, 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'book':
    case 'ticket':
      paintPoly(ctx, r, [[W * 0.22, H * 0.15], [W * 0.78, H * 0.15], [W * 0.78, H * 0.85], [W * 0.22, H * 0.85]], icon === 'book' ? hex('#d8cfb4') : hex('#c8b47a'), { angles: [0], density: 4, len: 10, width: 3 });
      ctx.fillStyle = 'rgba(40,30,20,0.85)';
      ctx.font = '13px "Old Standard TT", serif';
      for (let k = 0; k < 7; k++) ctx.fillText(icon === 'book' ? `М.р. ${10 + k} — ${3 + k}` : k === 0 ? '«Волжанинъ»' : '────────', W * 0.28, H * 0.25 + k * 18);
      break;
    case 'bottles':
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = 'rgba(40,55,40,0.95)';
        ctx.fillRect(W * 0.2 + k * W * 0.16, H * 0.25, W * 0.1, H * 0.5);
        ctx.fillStyle = 'rgba(230,220,190,0.95)';
        ctx.fillRect(W * 0.2 + k * W * 0.16, H * 0.45, W * 0.1, H * 0.12);
      }
      break;
    case 'tools':
      for (let k = 0; k < 6; k++) {
        ctx.save();
        ctx.translate(W * 0.2 + k * W * 0.12, cy);
        ctx.rotate(0.15);
        ctx.fillStyle = '#6a4a2a';
        ctx.beginPath();
        ctx.ellipse(0, -30, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9a9a9a';
        ctx.fillRect(-2, -16, 4, 60);
        ctx.fillStyle = 'rgba(30,20,10,0.9)';
        ctx.font = '9px serif';
        ctx.fillText('А.С.', -8, -28);
        ctx.restore();
      }
      break;
    default:
      paintPoly(ctx, r, [[W * 0.25, H * 0.25], [W * 0.75, H * 0.25], [W * 0.75, H * 0.75], [W * 0.25, H * 0.75]], col, { angles: [0.3, 1.9], density: 4, len: 14, width: 6 });
  }
  ctx.restore();
}

function sepiaGrain(ctx: CanvasRenderingContext2D, W: number, H: number, r: () => number, quality: number) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const n = (r() - 0.5) * 38 * (1.3 - quality * 0.5);
    d[i] = Math.min(255, g * 1.07 + 22 + n);
    d[i + 1] = Math.min(255, g * 0.92 + 10 + n);
    d[i + 2] = Math.min(255, g * 0.72 + n);
  }
  ctx.putImageData(img, 0, 0);
  const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(30,18,8,0.7)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

export function renderPlate(content: Content, photo: PhotoRec, lampOnly: Set<string>): string {
  const key = `${photo.loc}:${photo.plate}:${photo.t}`;
  const hit = plateCache.get(key);
  if (hit) return hit;
  const W = 360;
  const H = 270;
  const out = makeCanvas(W, H);
  const ctx = out.getContext('2d')!;
  const r = prng(hash(key));
  const loc = content.case.locations.find((l) => l.id === photo.loc);
  const scene = loc?.scene ? content.scenes[loc.scene] : null;
  const target = scene ? photoTarget(content, scene, photo.target) : null;
  const ev = content.evidence.find((e) => e.id === photo.target);
  if (photo.kind === 'detail' && ev) {
    paintPoly(ctx, r, [[0, 0], [W, 0], [W, H], [0, H]], hex('#6a5a48'), { angles: [0.4, 2], density: 3, len: 20, width: 8, jitter: 0.2 });
    drawIcon(ctx, ev.documentation.closeup.icon, ev.documentation.closeup.color, W, H, r, true);
  } else if (scene && target) {
    const painting = scenePainting(scene, lampOnly);
    const z = ev ? 0.6 : 0.3;
    const c = toScreen(scene, target.pos[0], target.pos[1], z);
    const span = photo.kind === 'orienting' ? 1400 : photo.kind === 'overview' ? 760 : 340;
    const sw = Math.min(painting.width, span * Math.max(0.6, Math.min(1.6, photo.distanceArshin / (photo.kind === 'node' ? 2.2 : 5))));
    const sh = (sw * H) / W;
    ctx.fillStyle = '#3a2e22';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(painting, c[0] - sw / 2, c[1] - sh / 2, sw, sh, 0, 0, W, H);
  }
  // дефекты
  const def = new Set(photo.defects);
  if (def.has('smear')) {
    const copy = makeCanvas(W, H);
    copy.getContext('2d')!.drawImage(out, 0, 0);
    ctx.globalAlpha = 0.25;
    for (let k = 1; k <= 4; k++) ctx.drawImage(copy, k * 3, k);
    ctx.globalAlpha = 1;
  }
  if (def.has('far') || def.has('near')) {
    const small = makeCanvas(W / (def.has('near') ? 8 : 4), H / (def.has('near') ? 8 : 4));
    small.getContext('2d')!.drawImage(out, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, W, H);
  }
  if (photo.scale && (photo.kind === 'detail' || photo.kind === 'node')) {
    ctx.fillStyle = '#efe6d0';
    ctx.fillRect(20, H - 34, 200, 16);
    for (let k = 0; k < 10; k++) {
      ctx.fillStyle = k % 2 ? '#efe6d0' : '#1a1410';
      ctx.fillRect(20 + k * 20, H - 34, 20, 8);
    }
    ctx.fillStyle = '#1a1410';
    ctx.font = '10px "PT Serif", serif';
    ctx.fillText('вершки', 160, H - 21);
  }
  if (def.has('dark')) {
    ctx.fillStyle = 'rgba(5,4,3,0.72)';
    ctx.fillRect(0, 0, W, H);
  }
  if (def.has('smoke')) {
    for (let k = 0; k < 30; k++) {
      const g = ctx.createRadialGradient(r() * W, r() * H, 5, r() * W, r() * H, 60 + r() * 80);
      g.addColorStop(0, 'rgba(240,240,235,0.35)');
      g.addColorStop(1, 'rgba(240,240,235,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
  if (photo.magnesium) {
    ctx.fillStyle = 'rgba(255,255,250,0.12)';
    ctx.fillRect(0, 0, W, H);
  }
  sepiaGrain(ctx, W, H, r, photo.quality);
  // рамка пластинки и номер
  const fin = makeCanvas(W + 24, H + 44);
  const f = fin.getContext('2d')!;
  f.fillStyle = '#e9dfc6';
  f.fillRect(0, 0, fin.width, fin.height);
  f.drawImage(out, 12, 12);
  f.strokeStyle = 'rgba(60,40,20,0.5)';
  f.strokeRect(12, 12, W, H);
  f.fillStyle = '#3a2a1a';
  f.font = 'italic 16px "Old Standard TT", serif';
  f.fillText(`№ ${photo.plate}`, 14, H + 34);
  const url = fin.toDataURL('image/jpeg', 0.82);
  plateCache.set(key, url);
  return url;
}
