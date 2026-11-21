// Оценка снимка на фотопластинку. Кадр не рендерится камерой: качество считается по данным сцены.
import type { Content, PhotoKind, SceneDef } from '../content/schemas';
import type { PhotoDefect } from './events';
import { dist, hotspotPos, inNoFlash, lightAt, type Vec2 } from './geometry';
import type { GameState } from './state';

export const KIND_RANGE: Record<PhotoKind, [number, number]> = {
  orienting: [5, 40],
  overview: [2.5, 9],
  node: [1.1, 3.6],
  detail: [0.25, 1.4],
};

export const KIND_TITLE: Record<PhotoKind, string> = {
  orienting: 'ориентирующая',
  overview: 'обзорная',
  node: 'узловая',
  detail: 'детальная',
};

export interface PhotoTargetInfo {
  id: string;
  pos: Vec2;
  kinds: PhotoKind[];
  evidence?: string;
}

export function photoTarget(content: Content, scene: SceneDef, target: string): PhotoTargetInfo | null {
  const pt = scene.photoTargets.find((p) => p.id === target);
  if (pt) return { id: pt.id, pos: pt.pos, kinds: pt.kinds };
  const ev = content.evidence.find((e) => e.id === target);
  if (ev) {
    const pos = hotspotPos(scene, ev.hotspot);
    if (pos) return { id: ev.id, pos, kinds: ['overview', 'node', 'detail'], evidence: ev.id };
  }
  return null;
}

export interface PhotoJudgement {
  refused?: 'chemicals';
  quality: number;
  defects: PhotoDefect['id'][];
  distance: number;
  light: number;
}

export function judgePhoto(
  state: GameState,
  content: Content,
  scene: SceneDef,
  tripod: Vec2,
  target: PhotoTargetInfo,
  kind: PhotoKind,
  scale: boolean,
  magnesium: boolean,
  t: number,
): PhotoJudgement {
  const d = dist(tripod, target.pos);
  const light0 = lightAt(scene, target.pos);
  if (magnesium && (inNoFlash(scene, tripod) || inNoFlash(scene, target.pos)))
    return { refused: 'chemicals', quality: 0, defects: [], distance: d, light: light0 };
  const defects: PhotoDefect['id'][] = [];
  let q = 1;
  if (!target.kinds.includes(kind)) {
    defects.push('wrong_kind');
    q *= 0.5;
  }
  const [lo, hi] = KIND_RANGE[kind];
  if (d < lo) {
    defects.push('near');
    q *= Math.max(0.3, 1 - (lo - d) / lo);
  } else if (d > hi) {
    defects.push('far');
    q *= Math.max(0.25, 1 - (d - hi) / (hi * 1.2));
  }
  // керосиновая лампа у треноги даёт косой свет на близкий предмет
  const lampBoost = state.lamp && d < 2.5 ? 0.3 : 0;
  const light = magnesium ? Math.max(light0, 0.95) : Math.min(1, light0 + lampBoost);
  if (light < 0.35) {
    defects.push('dark');
    q *= 0.35;
  } else if (light < 0.55) {
    defects.push('smear'); // долгая выдержка — смаз
    q *= 0.75;
  }
  if (t < state.smokeUntil) {
    defects.push('smoke');
    q *= 0.5;
  }
  if (kind === 'detail' && !scale) defects.push('no_scale');
  if (target.evidence) {
    const e = state.evidence[target.evidence];
    if (e && (e.moved || e.collected)) defects.push('moved');
  }
  return { quality: Math.round(q * 100) / 100, defects, distance: Math.round(d * 100) / 100, light };
}

/** Какие требования к фиксации улики выполнены хорошими снимками. */
export function documentationStatus(state: GameState, evidenceId: string, required: string[]) {
  const photos = state.photos.filter((p) => p.target === evidenceId && p.ok && p.inSitu);
  const has = (req: string) => {
    if (req === 'detail_scaled') return photos.some((p) => p.kind === 'detail' && p.scale);
    return photos.some((p) => p.kind === req);
  };
  const done = required.filter(has);
  return { done, missing: required.filter((r) => !done.includes(r)), complete: done.length === required.length };
}
