// Проверки навыков: 2д6 + навык против сложности. Шанс показывается до броска.
import type { Content, SkillId } from '../content/schemas';
import type { GameState } from './state';

export function effectiveSkill(state: GameState, content: Content, skill: SkillId): number {
  let v = state.skills[skill] ?? 0;
  for (const th of content.theories) if (state.theories[th.id] === 'internalized') v += th.bonus[skill] ?? 0;
  return v;
}

/** Туннельное зрение: принятая версия мешает заметить противоречащий ей факт (+2 к сложности). */
export function tunnelPenalty(state: GameState, content: Content, fact?: string): number {
  if (!fact) return 0;
  let p = 0;
  for (const th of content.theories) if (state.theories[th.id] === 'internalized' && th.contradicts.includes(fact)) p += 2;
  return p;
}

export function chance2d6(skill: number, dc: number): number {
  let ok = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b + skill >= dc) ok++;
  // 2 и 12 — всегда провал и всегда успех
  const twoAlwaysFail = 1 + 1 + skill >= dc ? 1 : 0;
  const twelveAlwaysOk = 6 + 6 + skill >= dc ? 0 : 1;
  return (ok - twoAlwaysFail + twelveAlwaysOk) / 36;
}

export interface CheckPreview {
  skill: SkillId;
  value: number;
  dc: number;
  chance: number; // 0..1
  available: boolean;
  reason?: 'done' | 'failed_wait_fact';
}

export function previewCheck(
  state: GameState,
  content: Content,
  skill: SkillId,
  baseDc: number,
  key: string,
  repeatable: boolean,
  fact?: string,
): CheckPreview {
  const value = effectiveSkill(state, content, skill);
  const dc = baseDc + tunnelPenalty(state, content, fact);
  const chance = state.settings.noRandom ? (value + 7 >= dc ? 1 : 0) : chance2d6(value, dc);
  const prev = state.checks[key];
  let available = true;
  let reason: CheckPreview['reason'];
  if (prev) {
    if (prev.ok) {
      available = false;
      reason = 'done';
    } else if (!repeatable) {
      available = false;
      reason = 'done';
    } else if (state.factOrder.length <= prev.factCount) {
      available = false;
      reason = 'failed_wait_fact';
    }
  }
  return { skill, value, dc, chance, available, reason };
}

/** Пассивная проверка — без броска: голос звучит, если навык + 6 ≥ сложности. */
export function passiveOk(state: GameState, content: Content, skill: SkillId, dc: number, fact?: string): boolean {
  return effectiveSkill(state, content, skill) + 6 >= dc + tunnelPenalty(state, content, fact);
}
