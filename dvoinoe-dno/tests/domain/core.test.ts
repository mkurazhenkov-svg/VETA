import { describe, expect, it } from 'vitest';
import { Sim, content } from '../helpers';
import { replay } from '../../src/domain/state';
import { chance2d6, previewCheck } from '../../src/domain/checks';
import { judgePackaging } from '../../src/domain/packaging';
import { CHECKS } from '../../src/domain/rules-engine';
import { oldToModern, modernToOld } from '../../src/domain/orthography';

describe('журнал', () => {
  it('восстанавливает идентичное состояние, включая броски', () => {
    const s = new Sim();
    s.do({ type: 'travel', to: 'bank' });
    s.do({ type: 'check', skill: 'observ', dc: 9, key: 'k1', repeatable: true });
    s.do({ type: 'check', skill: 'craft', dc: 11, key: 'k2', repeatable: false });
    s.do({ type: 'travel', to: 'yard' });
    s.do({ type: 'fact', id: 'f_dvornik_two_men', source: 'mitrofan' });
    const r = replay(s.c, JSON.parse(JSON.stringify(s.journal)));
    expect(r).toEqual(s.state);
  });
  it('время идёт от действий', () => {
    const s = new Sim();
    const t0 = s.state.clock;
    s.do({ type: 'travel', to: 'bank' });
    s.do({ type: 'travel', to: 'yard' });
    expect(s.state.clock).toBe(t0 + 30);
  });
});

describe('проверки 2д6', () => {
  it('шанс совпадает с перебором (с правилами 2 и 12)', () => {
    for (let skill = 0; skill <= 6; skill++)
      for (let dc = 4; dc <= 16; dc++) {
        let ok = 0;
        for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if ((a === 6 && b === 6) || (!(a === 1 && b === 1) && a + b + skill >= dc)) ok++;
        expect(chance2d6(skill, dc)).toBeCloseTo(ok / 36, 6);
      }
  });
  it('режим «без случайности»: исход по навыку, шанс 0 или 1', () => {
    const s = new Sim('practicum', { noRandom: true });
    const p = previewCheck(s.state, s.c, 'chancery', 11, 'x', false); // навык 4: 4+7=11
    expect(p.chance).toBe(1);
    s.do({ type: 'check', skill: 'chancery', dc: 11, key: 'x', repeatable: false });
    expect(s.state.checks['x'].ok).toBe(true);
    s.do({ type: 'check', skill: 'craft', dc: 11, key: 'y', repeatable: false }); // 1+7 < 11
    expect(s.state.checks['y'].ok).toBe(false);
  });
  it('повторяемая проверка — только после нового факта; одноразовая — никогда', () => {
    const s = new Sim('practicum', { noRandom: true });
    s.do({ type: 'check', skill: 'craft', dc: 12, key: 'r', repeatable: true });
    expect(previewCheck(s.state, s.c, 'craft', 12, 'r', true).available).toBe(false);
    s.do({ type: 'fact', id: 'f_bank_paper', source: 'cashier' });
    expect(previewCheck(s.state, s.c, 'craft', 12, 'r', true).available).toBe(true);
    s.do({ type: 'check', skill: 'craft', dc: 12, key: 'o', repeatable: false });
    s.do({ type: 'fact', id: 'f_bank_grid', source: 'cashier' });
    expect(previewCheck(s.state, s.c, 'craft', 12, 'o', false).available).toBe(false);
  });
});

describe('упаковка', () => {
  const c = content();
  const ev = (id: string) => c.evidence.find((e) => e.id === id)!;
  it('полусгоревшие оттиски рассыпаются без жёсткой подложки', () => {
    expect(judgePackaging(c, ev('ev03_burnt_proofs'), 'by_hand', 'envelope').outcome).toBe('destroyed');
    expect(judgePackaging(c, ev('ev03_burnt_proofs'), 'rigid_board_glass', 'flat_box').outcome).toBe('intact');
  });
  it('негативы без перекладок царапаются', () => {
    expect(judgePackaging(c, ev('ev04_negatives'), 'by_edges', 'envelope').outcome).toBe('degraded');
  });
  it('предмет со следами пальцев, взятый за поверхность, теряет следы', () => {
    expect(judgePackaging(c, ev('ev06_prints'), 'by_hand', 'crate').outcome).toBe('destroyed');
  });
});

describe('фотопластинки', () => {
  it('детальный кадр без масштаба не засчитывается как detail_scaled', async () => {
    const { docStatus } = await import('../../src/domain/queries');
    const s = new Sim();
    s.do({ type: 'travel', to: 'cellar' });
    s.goTo('ev05_sample');
    s.tripodNear('ev05_sample', 0.8);
    s.do({ type: 'photo', target: 'ev05_sample', kind: 'detail', scale: false, magnesium: false });
    expect(docStatus(s.state, s.c, 'ev05_sample').complete).toBe(false);
    s.do({ type: 'photo', target: 'ev05_sample', kind: 'detail', scale: true, magnesium: false });
    expect(docStatus(s.state, s.c, 'ev05_sample').complete).toBe(true);
  });
  it('фотограф не жжёт магний у реактивов, пластинка не тратится', () => {
    const s = new Sim();
    s.do({ type: 'travel', to: 'cellar' });
    s.tripodNear('ev10_bottles', 1.0);
    const evs = s.do({ type: 'photo', target: 'ev10_bottles', kind: 'node', scale: false, magnesium: true });
    expect(evs[0].type).toBe('photo.refused');
    expect(s.state.platesUsed['cellar'] ?? 0).toBe(0);
  });
  it('пластинки кончаются', () => {
    const s = new Sim('practicum', { platesOverride: 2 });
    s.do({ type: 'travel', to: 'cellar' });
    s.do({ type: 'tripod', pos: [1.6, 0.8] });
    for (let i = 0; i < 3; i++) s.do({ type: 'photo', target: 'PT_room', kind: 'orienting', scale: false, magnesium: false });
    expect(s.state.platesUsed['cellar']).toBe(2);
    expect(s.journal.at(-1)!.type).toBe('photo.refused');
  });
});

describe('опрос и время', () => {
  it('наводящий вопрос загрязняет показания дворника', () => {
    const s = new Sim();
    s.do({ type: 'travel', to: 'yard' });
    s.do({ type: 'choice', npc: 'mitrofan', knot: 'mitrofan', tags: ['leading'], text: 'Это ведь фотограф?' });
    s.do({ type: 'fact', id: 'f_dvornik_two_men', source: 'mitrofan' });
    expect(s.state.facts['f_dvornik_two_men'].unreliable).toBe(true);
  });
  it('дождь смывает несфотографированные следы во дворе по таймеру', () => {
    const s = new Sim();
    s.do({ type: 'travel', to: 'yard' });
    s.do({ type: 'spend', minutes: 200, reason: 'test' });
    expect(s.state.timelineDone).toContain('rain');
    expect(s.state.evidence['ev_y1_footprints'].condition).toBe('destroyed');
  });
  it('лавочник-понятой уходит в 11:00, если не уговорить', () => {
    const s = new Sim();
    s.do({ type: 'travel', to: 'yard' });
    s.do({ type: 'witnesses', chosen: ['sychev', 'ershov'] });
    s.do({ type: 'spend', minutes: 150, reason: 'test' });
    expect(s.state.witnesses.present).toEqual(['ershov']);
  });
  it('принятая версия усложняет проверку на противоречащий факт (туннельное зрение)', () => {
    const s = new Sim();
    s.do({ type: 'fact', id: 'f_tools_as', source: 'evidence' });
    const before = previewCheck(s.state, s.c, 'craft', 9, 'k', false, 'f_tools_planted');
    s.do({ type: 'theoryThink', id: 'th_engraver' });
    const after = previewCheck(s.state, s.c, 'craft', 9, 'k', false, 'f_tools_planted');
    expect(after.dc).toBe(before.dc + 2);
  });
});

describe('«идеальный обход»: ключевые улики находятся без бросков', () => {
  for (const variant of ['truth_main', 'truth_landlord', 'truth_guest'] as const) {
    it(variant, () => {
      const s = new Sim('practicum', { variant }, 'syn_gravera');
      const c = s.c;
      s.do({ type: 'travel', to: 'cellar' });
      // все улики подвала: осмотреться в каждом секторе, лампа у каждого скрытого, обыскать контейнеры
      const scene = c.scenes['cellar'];
      for (const sec of scene.sectors) {
        const p = sec.poly[0];
        s.do({ type: 'move', to: [p[0] + 0.5, p[1] + 0.5], sector: sec.id, threshold: false });
        s.do({ type: 'look' });
      }
      s.do({ type: 'lamp', on: true });
      s.do({ type: 'lampReveal', ids: scene.hidden.map((h) => h.id) });
      for (const e of c.evidence.filter((e) => e.location === 'cellar' && e.kind === 'container')) {
        s.do({ type: 'examine', id: e.id });
        if (e.searchMinutes) s.do({ type: 'search', id: e.id });
      }
      const keys = c.evidence.filter((e) => e.location === 'cellar' && e.key && e.variants.includes(variant));
      for (const e of keys) {
        s.do({ type: 'examine', id: e.id, lupa: true });
        expect(s.state.evidence[e.id].examined, e.id).toBe(true);
      }
      expect(s.journal.some((e) => e.type === 'check.rolled')).toBe(false);
    });
  }
});

describe('контент', () => {
  it('у каждого правила есть функция проверки', () => {
    for (const r of content().rules.rules) expect(CHECKS[r.check], r.id).toBeTypeOf('function');
  });
});

describe('орфография', () => {
  it('дореформенная → современная', () => {
    expect(oldToModern('Дѣло о фальшивыхъ кредитныхъ билетахъ двадцатипятирублеваго достоинства')).toBe(
      'Дело о фальшивых кредитных билетах двадцатипятирублевого достоинства',
    );
  });
  it('превью протокола «как в 1913 году»', () => {
    expect(modernToOld('Следователь осмотрел место')).toBe('Слѣдователь осмотрѣлъ мѣсто');
  });
});
