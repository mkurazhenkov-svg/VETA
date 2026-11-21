import { join } from 'node:path';
import { loadContent } from '../src/content/load-node.ts';
import type { Content, SkillId } from '../src/content/schemas';
import { perform, type Intent } from '../src/domain/commands';
import { initialState, reduce, type GameState } from '../src/domain/state';
import type { GameEvent, Mode, Settings } from '../src/domain/events';
import { DEFAULT_SETTINGS } from '../src/domain/state';
import { hotspotPos } from '../src/domain/geometry';

let cached: Content | null = null;
export function content(): Content {
  if (!cached) cached = loadContent(join(import.meta.dirname, '..', 'content'));
  return cached;
}

export class Sim {
  c = content();
  state: GameState = initialState(this.c);
  journal: GameEvent[] = [];
  constructor(mode: Mode = 'practicum', settings: Partial<Settings> = {}, archetype = 'pravoved', seed = 42) {
    const arch = this.c.skills.archetypes.find((a) => a.id === archetype)!;
    this.do({ type: 'start', mode, settings: { ...DEFAULT_SETTINGS, ...settings }, archetype, skills: arch.skills as Record<SkillId, number>, seed });
  }
  do(intent: Intent): GameEvent[] {
    const evs = perform(this.state, this.c, intent);
    for (const e of evs) {
      this.journal.push(e);
      this.state = reduce(this.state, e);
    }
    return evs;
  }
  /** Подойти к хотспоту улики (как сделала бы сцена). */
  goTo(evId: string) {
    const ev = this.c.evidence.find((e) => e.id === evId)!;
    const scene = this.c.scenes[ev.location === 'cellar' ? 'cellar' : ev.location];
    const h = scene.hotspots.find((x) => x.id === ev.hotspot)!;
    this.do({ type: 'move', to: h.approach, sector: ev.sector, threshold: false });
    return { scene, pos: hotspotPos(scene, ev.hotspot)! };
  }
  /** Поставить треногу на расстоянии d от предмета (по направлению к точке подхода). */
  tripodNear(evId: string, d: number) {
    const ev = this.c.evidence.find((e) => e.id === evId)!;
    const scene = this.c.scenes[ev.location];
    const h = scene.hotspots.find((x) => x.id === ev.hotspot)!;
    const p = hotspotPos(scene, ev.hotspot)!;
    const dx = h.approach[0] - p[0], dy = h.approach[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    this.do({ type: 'tripod', pos: [p[0] + (dx / len) * d, p[1] + (dy / len) * d] });
  }
}
