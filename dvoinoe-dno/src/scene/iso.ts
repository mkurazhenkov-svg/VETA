// Изометрическая проекция: мир в аршинах (x, y, z) → экран фона (пиксели холста сцены).
import type { SceneDef } from '../content/schemas';

export const COS = 0.866;
export const SIN = 0.5;
export type Vec2 = [number, number];

export function toScreen(s: SceneDef, x: number, y: number, z = 0): Vec2 {
  const k = s.pxPerArshin;
  return [s.origin[0] + (x - y) * COS * k, s.origin[1] + (x + y) * SIN * k - z * k];
}

export function toWorld(s: SceneDef, sx: number, sy: number, z = 0): Vec2 {
  const k = s.pxPerArshin;
  const a = (sx - s.origin[0]) / (COS * k); // x - y
  const b = (sy - s.origin[1] + z * k) / (SIN * k); // x + y
  return [(a + b) / 2, (b - a) / 2];
}

/** Восемь вершин бокса: основание и верх. */
export function boxCorners(s: SceneDef, cx: number, cy: number, w: number, d: number, z0: number, h: number) {
  const pts: Record<string, Vec2> = {};
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      pts[`b${sx}${sy}`] = toScreen(s, cx + (sx * w) / 2, cy + (sy * d) / 2, z0);
      pts[`t${sx}${sy}`] = toScreen(s, cx + (sx * w) / 2, cy + (sy * d) / 2, z0 + h);
    }
  return pts;
}

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Детерминированный ГСЧ для живописи (не путать с доменным rng). */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pointInPoly(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function convexHull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
