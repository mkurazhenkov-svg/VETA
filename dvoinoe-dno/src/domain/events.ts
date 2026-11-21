// События журнала. Журнал — единственный источник истины: состояние строится из него редьюсером.
import type { PhotoKind, SkillId, VariantId, Role } from '../content/schemas';
import type { Vec2 } from './geometry';

export type Mode = 'exhibit' | 'practicum';
export type Condition = 'intact' | 'degraded' | 'destroyed';

export interface Settings {
  variant: VariantId;
  platesOverride: number | null; // null — по данным дела
  noRandom: boolean;
  timePressure: boolean;
  showReveal: boolean;
  studentName: string;
}

export interface CaseFolder {
  protocol: { include: string[]; extra: string };
  examination: { evidence: string; addressee: string; questions: string[] }[];
  accusation: Record<string, Role>;
  theories: string[];
}

export interface PhotoDefect {
  id: 'dark' | 'smear' | 'smoke' | 'far' | 'near' | 'no_scale' | 'wrong_kind' | 'moved';
}

interface E<T extends string> {
  t: number; // игровое время события (минуты от полуночи)
  dt?: number; // сколько минут заняло действие
  type: T;
}

export type GameEvent =
  | (E<'session.started'> & { mode: Mode; settings: Settings; seed: number; archetype: string; skills: Record<SkillId, number> })
  | (E<'location.entered'> & { loc: string; from: string | null })
  | (E<'player.moved'> & { loc: string; to: Vec2; sector: string | null; fragileHit?: string; threshold?: boolean })
  | (E<'scene.looked'> & { loc: string; sector: string | null })
  | (E<'room.described'> & { loc: string })
  | (E<'evidence.detected'> & { id: string; via: 'look' | 'lamp' | 'check' | 'search' | 'inside' })
  | (E<'evidence.examined'> & { id: string; lupa: boolean; witnesses: string[] })
  | (E<'evidence.searched'> & { id: string })
  | (E<'lamp.toggled'> & { on: boolean })
  | (E<'tripod.placed'> & { loc: string; pos: Vec2 })
  | (E<'photo.taken'> & {
      plate: number;
      loc: string;
      target: string;
      kind: PhotoKind;
      distanceArshin: number;
      scale: boolean;
      magnesium: boolean;
      quality: number;
      defects: PhotoDefect['id'][];
      inSitu: boolean;
      witnesses: string[];
      tripod?: Vec2;
    })
  | (E<'photo.refused'> & { target: string; reason: 'no_plates' | 'chemicals' | 'no_tripod' })
  | (E<'measure.taken'> & { target: string; landmark: string; arshin: number })
  | (E<'evidence.touched'> & { id: string; fixed: boolean })
  | (E<'evidence.picked_up'> & { id: string; fixed: boolean })
  | (E<'evidence.condition'> & { id: string; condition: Condition; reason: string })
  | (E<'evidence.packaged'> & { id: string; method: string; pack: string; sealed: boolean; signedBy: string[]; outcome: Condition; described: boolean })
  | (E<'evidence.origin'> & { id: string; origin: string; correct: boolean })
  | (E<'note.written'> & { text: string; about?: string })
  | (E<'witnesses.changed'> & { present: string[]; chosen: string[]; reason: string })
  | (E<'check.rolled'> & { skill: SkillId; dc: number; roll: [number, number]; mod: number; ok: boolean; key: string; repeatable: boolean; noRandom: boolean })
  | (E<'dialogue.choice'> & { npc: string; knot: string; tags: string[]; text: string })
  | (E<'fact.learned'> & { id: string; source: string; unreliable: boolean })
  | (E<'trust.changed'> & { npc: string; delta: number })
  | (E<'time.spent'> & { reason: string })
  | (E<'flag.set'> & { id: string; value: boolean | number | string })
  | (E<'theory.revealed'> & { id: string })
  | (E<'theory.internalized'> & { id: string })
  | (E<'theory.discarded'> & { id: string })
  | (E<'voice.suggested'> & { voice: SkillId; key: string; shortcut: boolean })
  | (E<'timeline.fired'> & { id: string; effect: string })
  | (E<'museum.qr'> & { code: string })
  | (E<'telegram.sent'> & { destination: string; steamer: boolean; description: string[]; text: string })
  | (E<'plan.marked'> & { id: string; pos: Vec2 })
  | (E<'hint.used'> & { about: string })
  | (E<'exhibit.finale'> & { signs: string[]; suspects: string[] })
  | (E<'folder.submitted'> & { doc: CaseFolder });

export type EventType = GameEvent['type'];
export type EventOf<T extends EventType> = Extract<GameEvent, { type: T }>;
