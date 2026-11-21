// Проверка протокола: описательный язык, привязки, согласование с описью и снимками.
import type { Content } from '../content/schemas';
import { formatArshin } from './geometry';
import { KIND_TITLE } from './photo-judge';
import { evidenceDef, sceneOf, activeEvidence } from './queries';
import type { GameState } from './state';
import { dist } from './geometry';

/** Ищет в тексте слова-выводы («фальшивый», «очевидно», «преступник»…). Возвращает найденные корни. */
export function findConclusions(text: string, words: string[]): string[] {
  const low = text.toLowerCase().replace(/ё/g, 'е');
  return words.filter((w) => low.includes(w.toLowerCase()));
}

/** Строка протокола об улике: описание + привязки к ориентирам + снимки + изъятие. */
export function protocolLine(state: GameState, content: Content, id: string): string {
  const ev = evidenceDef(content, id);
  if (!ev) return '';
  const es = state.evidence[id];
  const scene = sceneOf(content, ev.location);
  const parts: string[] = [];
  parts.push(`${ev.num}. ${ev.protocol}`);
  const ms = Object.entries(es.measured);
  if (ms.length && scene) {
    const bind = ms
      .map(([lm, a]) => `от ${scene.landmarks.find((l) => l.id === lm)?.title.toLowerCase() ?? lm} — ${formatArshin(a)}`)
      .join(', ');
    parts.push(`Расстояние ${bind}.`);
  }
  const photos = state.photos.filter((p) => p.target === id);
  if (photos.length) parts.push(`Сфотографировано: ${photos.map((p) => `пластинка № ${p.plate} (${KIND_TITLE[p.kind]}${p.scale ? ', с масштабной линейкой' : ''})`).join('; ')}.`);
  if (es.collected) {
    const m = content.packaging.methods.find((x) => x.id === es.method)?.title ?? es.method ?? '';
    const pk = content.packaging.packs.find((x) => x.id === es.pack)?.title ?? es.pack ?? '';
    parts.push(`Изъято (${m.toLowerCase()}), упаковано: ${pk.toLowerCase()}${es.sealed ? ', перевязано шпагатом, опечатано сургучной печатью следователя' : ''}${es.signedBy?.length ? ', снабжено подписями понятых' : ''}.`);
  } else if (ev.collection.collectable === false && ev.kind !== 'container') {
    parts.push('Оставлено на месте.');
  }
  if (es.origin && ev.origin) {
    const o = ev.origin.options.find((x) => x.id === es.origin)?.title;
    if (o) parts.push(`Происхождение: ${o.toLowerCase()}.`);
  }
  return parts.join(' ');
}

export interface PlanCheck {
  id: string;
  bound: boolean; // есть привязка к двум неподвижным ориентирам
  placed: boolean;
  accurate: boolean; // отметка на плане в пределах допуска
  error: number;
}

/** Можно ли по привязкам найти место находки: 2 ориентира + отметка на плане с допуском. */
export function checkPlan(state: GameState, content: Content, loc = 'cellar', tolerance = 1.2): PlanCheck[] {
  const scene = sceneOf(content, loc);
  if (!scene) return [];
  return activeEvidence(state, content, loc)
    .filter((e) => e.kind === 'evidence' && state.evidence[e.id]?.detected)
    .map((e) => {
      const es = state.evidence[e.id];
      const h = scene.hotspots.find((x) => x.id === e.hotspot);
      const prop = scene.props.find((p) => p.id === h?.prop);
      const truth = h?.pos ?? prop?.pos ?? h?.approach ?? [0, 0];
      const err = es.plan ? dist(es.plan, truth as [number, number]) : Infinity;
      return {
        id: e.id,
        bound: Object.keys(es.measured).length >= 2,
        placed: !!es.plan,
        accurate: err <= tolerance,
        error: err,
      };
    });
}
