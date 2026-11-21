// Чистая геометрия мира сцены (координаты — в аршинах).
import type { SceneDef } from '../content/schemas';

export type Vec2 = [number, number];

export const ARSHIN_CM = 71.12;
export const VERSHOK_CM = 4.445;

export function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
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

/** Аршины → «N арш. M верш.» */
export function formatArshin(a: number): string {
  const totalV = Math.round(a * 16);
  const ar = Math.floor(totalV / 16);
  const v = totalV % 16;
  if (ar === 0) return `${v} верш.`;
  if (v === 0) return `${ar} арш.`;
  return `${ar} арш. ${v} верш.`;
}
export function arshinToCm(a: number) {
  return Math.round(a * ARSHIN_CM);
}

export function sectorAt(scene: SceneDef, p: Vec2): string | null {
  for (const s of scene.sectors) if (pointInPoly(p, s.poly)) return s.id;
  return null;
}

/** Позиция хотспота в мире: центр предмета или явная точка. */
export function hotspotPos(scene: SceneDef, hotspotId: string): Vec2 | null {
  const h = scene.hotspots.find((x) => x.id === hotspotId);
  if (!h) return null;
  if (h.pos) return h.pos;
  const prop = scene.props.find((p) => p.id === h.prop);
  return prop ? prop.pos : h.approach;
}

/** Освещённость точки 0..1 по карте света сцены (окружающий свет + источники). */
export function lightAt(scene: SceneDef, p: Vec2): number {
  let l = scene.light.ambient;
  for (const s of scene.light.sources) {
    const d = dist(p, s.pos);
    if (d < s.radius) l += s.power * (1 - d / s.radius) ** 1.4;
  }
  return Math.max(0, Math.min(1, l));
}

export function inNoFlash(scene: SceneDef, p: Vec2): boolean {
  return scene.noFlash.some((z) => dist(z.center, p) <= z.r);
}
