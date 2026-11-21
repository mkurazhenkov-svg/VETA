// Золотые журналы: эталонные прохождения дают ожидаемые баллы (±1) и исходы.
// Изменение оценки = обновить числа здесь и объяснить в CHANGELOG.md.
import { describe, expect, it } from 'vitest';
import { excellent, tunnel, failure } from './bots';
import { scoreSession } from '../../src/domain/scoring';
import { replay } from '../../src/domain/state';
import { Sim } from '../helpers';
import { cyrb53 } from '../../src/domain/checksum';

const score = (s: Sim) => scoreSession(s.state, s.journal, s.c);

describe('золотые журналы', () => {
  it('«отличник» (основной вариант): 97 ±1, исход А', () => {
    const r = score(excellent('truth_main'));
    expect(Math.abs(r.total - 97)).toBeLessThanOrEqual(1);
    expect(r.outcome).toBe('A');
  });
  it('«отличник» в вариантах «подставной хозяин» и «гастролёр»: исход А', () => {
    for (const v of ['truth_landlord', 'truth_guest'] as const) {
      const r = score(excellent(v));
      expect(r.outcome, v).toBe('A');
      expect(r.total, v).toBeGreaterThanOrEqual(90);
    }
  });
  it('«туннельное зрение»: 44 ±1, исход В (ложный след)', () => {
    const r = score(tunnel());
    expect(Math.abs(r.total - 44)).toBeLessThanOrEqual(1);
    expect(r.outcome).toBe('V');
  });
  it('«процессуальный провал»: потолок 59, исход Г', () => {
    const r = score(failure());
    expect(r.total).toBeLessThanOrEqual(59);
    expect(r.outcome).toBe('G');
    expect(r.violations.some((v) => v.def.severity === 'critical')).toBe(true);
  });
  it('оценка пересчитывается из журнала одинаково', () => {
    const s = excellent();
    const j = JSON.parse(JSON.stringify(s.journal));
    const st = replay(s.c, j);
    expect(scoreSession(st, j, s.c).total).toBe(score(s).total);
    expect(cyrb53(JSON.stringify(j))).toBe(cyrb53(JSON.stringify(s.journal)));
  });
  it('броски не влияют на оценку', () => {
    const run = (seed: number) => {
      const s = new Sim('practicum', {}, 'pravoved', seed);
      s.do({ type: 'travel', to: 'yard' });
      for (let i = 0; i < 6; i++) s.do({ type: 'check', skill: 'observ', dc: 9, key: `k${i}`, repeatable: false });
      s.do({ type: 'travel', to: 'chamber' });
      s.do({ type: 'submit', folder: { protocol: { include: [], extra: '' }, examination: [], accusation: {}, theories: [] } });
      return s;
    };
    const a = run(1);
    const b = run(987654);
    const rollsA = a.journal.filter((e) => e.type === 'check.rolled').map((e: any) => e.ok);
    const rollsB = b.journal.filter((e) => e.type === 'check.rolled').map((e: any) => e.ok);
    expect(rollsA).not.toEqual(rollsB);
    expect(score(a).total).toBe(score(b).total);
  });
});
