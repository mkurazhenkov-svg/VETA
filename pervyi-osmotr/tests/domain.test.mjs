// Золотые журналы: «отличник», «туннельное зрение», «процессуальный провал».
import test from 'node:test';
import assert from 'node:assert/strict';
import { C } from '../src/content/index.js';
import { createStore, replay, checksum } from '../src/domain/store.js';
import { evaluate } from '../src/domain/evaluate.js';
import { judgePhoto } from '../src/domain/photo-judge.js';

const ALL_ITEMS = C.EQUIPMENT.filter((e) => !['scanner3d', 'drone', 'metal', 'plaster'].includes(e.id)).map((e) => e.id);
const LABEL = { what: 1, where: 1, when: 1, kusp: 1, sign: 1, seal: 1 };

function vis(id, share, extra = {}) {
  return { id, frameShare: share, axisAngleDeg: 5, dist: 1, hasScale: true, hasMarker: true, ...extra };
}

function excellentLog() {
  const L = [];
  let t = 485;
  const ev = (o) => L.push({ t: (t += 0.5), ...o });
  ev({ type: 'prologue.done', items: ALL_ITEMS, team: ['specialist', 'operative'], dutyGuard: true });
  ev({ type: 'dialogue.start', npc: 'belov' });
  for (const c of ['route', 'self', 'initial', 'guard']) ev({ type: 'dialogue.choice', npc: 'belov', choice: c });
  ev({ type: 'dialogue.start', npc: 'sosedka' });
  for (const c of ['rights', 'story', 'time', 'touch', 'keys', 'smoke', 'control']) ev({ type: 'dialogue.choice', npc: 'sosedka', choice: c });
  ev({ type: 'procedure.decision', key: 'basis', value: 'urgent_165' });
  ev({ type: 'procedure.decision', key: 'witnesses', value: 'no' });
  ev({ type: 'video.toggled', on: true });
  ev({ type: 'procedure.decision', key: 'intro', value: 'yes' });
  for (const i of ['gloves', 'shoecovers', 'mask']) ev({ type: 'ppe.put_on', item: i });
  ev({ type: 'photo.taken', photoId: 'p0', declaredKind: 'orienting', focal: 24, camZone: 'landing', seesEntry: true, visible: [] });
  ev({ type: 'player.zone', zone: 'hall' });
  const key = C.EVIDENCE.filter((e) => e.kind !== 'false');
  // Обзорные
  ev({ type: 'photo.taken', photoId: 'p1', declaredKind: 'overview', focal: 24, camZone: 'hall', visible: key.map((e) => vis(e.id, 0.01, { dist: 3 })) });
  for (const e of key) {
    if (e.visibility) ev({ type: 'evidence.detected', id: e.id, via: e.visibility });
    ev({ type: 'evidence.inspected', id: e.id, full: true });
    ev({ type: 'marker.placed', id: e.id });
    ev({ type: 'scale.placed', id: e.id });
    ev({ type: 'measure.done', id: e.id, refs: [], dims: '' });
    ev({ type: 'photo.taken', photoId: 'n' + e.id, declaredKind: 'node', focal: 35, camZone: e.zone, visible: [vis(e.id, 0.1)] });
    ev({ type: 'photo.taken', photoId: 'd' + e.id, declaredKind: 'detail', focal: 60, camZone: e.zone, visible: [vis(e.id, 0.5)] });
    if (e.latent) {
      ev({ type: 'powder.applied', id: e.id, powder: 'powder_light', quality: 0.9, result: 'excellent' });
      ev({ type: 'photo.taken', photoId: 'dd' + e.id, declaredKind: 'detail', focal: 60, camZone: e.zone, visible: [vis(e.id, 0.5)] });
    }
    if (e.mustCollect) {
      const m = e.collect.methods.find((x) => x.ok && !x.partial && !x.wet);
      const pack = Object.entries(e.collect.packs).find(([, ok]) => ok)[0];
      if (e.dna) ev({ type: 'ppe.put_on', item: 'gloves' });
      ev({ type: 'evidence.collected', id: e.id, method: m.id, pack, label: LABEL, gloves: true });
    }
  }
  for (const e of C.EVIDENCE.filter((x) => x.kind === 'false')) ev({ type: 'evidence.flagged', id: e.id, origin: e.origin });
  ev({ type: 'dialogue.start', npc: 'orlova' });
  for (const c of ['pose', 'changes', 'clothes', 'injury']) ev({ type: 'dialogue.choice', npc: 'orlova', choice: c });
  ev({ type: 'dialogue.start', npc: 'kirill' });
  for (const c of ['rights', 'story', 'evening', 'keys', 'smoke', 'size', 'shoes_ok']) ev({ type: 'dialogue.choice', npc: 'kirill', choice: c });
  ev({ type: 'dialogue.present', npc: 'kirill', fact: 'f_phone_call' });
  ev({ type: 'dialogue.present', npc: 'kirill', fact: 'f_receipt' });
  return L;
}

function submit(L, doc) {
  const s = replay(L, C);
  const photoOrder = [...s.photos].sort((a, b) => ['orienting', 'overview', 'node', 'detail'].indexOf(a.declaredKind) - ['orienting', 'overview', 'node', 'detail'].indexOf(b.declaredKind)).map((p) => p.photoId);
  const order = { landing: 0, hall: 1, bath: 2, kitchen: 3, room: 4, balcony: 5 };
  const blocks = C.EVIDENCE.filter((e) => s.evidence[e.id].inspected).sort((a, b) => order[a.zone] - order[b.zone]).map((e) => ({ evId: e.id, wording: 'neutral' }));
  const exams = Object.fromEntries(C.EVIDENCE.map((e) => [e.id, e.exams]));
  L.push({ t: 700, type: 'protocol.submitted', doc: { blocks, changesIncluded: true, freeText: '', photoOrder, hypothesis: 'hyp_staging', hypFacts: ['f_glass_outside', 'f_snow_intact', 'f_no_forced_entry', 'f_second_cup', 'f_phone_call', 'f_receipt'], exams, presented: true, ...doc } });
  return L;
}

test('фото: детальный кадр без масштаба не засчитывается', () => {
  const r = judgePhoto({ declaredKind: 'detail', focal: 60, camZone: 'hall', visible: [vis('ev04_shoeprint', 0.5, { hasScale: false })] }, C.PHOTO_RULES);
  assert.equal(r.ok, false);
  assert.match(r.issues[0], /масштаб/);
  const r2 = judgePhoto({ declaredKind: 'detail', focal: 60, camZone: 'hall', visible: [vis('ev04_shoeprint', 0.5)] }, C.PHOTO_RULES);
  assert.equal(r2.ok, true);
});

test('фото: угол оптической оси сверх допуска', () => {
  const r = judgePhoto({ declaredKind: 'detail', focal: 60, camZone: 'hall', visible: [vis('ev04_shoeprint', 0.5, { axisAngleDeg: 40 })] }, C.PHOTO_RULES);
  assert.equal(r.ok, false);
});

test('журнал воспроизводится детерминированно', () => {
  const L = submit(excellentLog(), {});
  const store = createStore(C);
  for (const ev of L) store.dispatch(ev);
  assert.deepEqual(replay(L, C), store.state);
  assert.equal(checksum(L), checksum(JSON.parse(JSON.stringify(L))));
});

test('золотой журнал «отличник» → исход А, 90+', () => {
  const r = evaluate(submit(excellentLog(), {}), C);
  assert.deepEqual(r.violations.map((v) => v.ruleId), []);
  assert.equal(r.outcome, 'A');
  assert.ok(r.total >= 90, `total=${r.total} ${JSON.stringify(r.scores)}`);
});

test('«туннельное зрение»: версия проникновения → исход В', () => {
  const r = evaluate(submit(excellentLog(), { hypothesis: 'hyp_burglary' }), C);
  assert.equal(r.outcome, 'V');
});

test('«процессуальный провал»: угроза и изъятие обуви → исход Г, потолок 59', () => {
  const L = excellentLog();
  L.push({ t: 650, type: 'dialogue.choice', npc: 'kirill', choice: 'seize' });
  const r = evaluate(submit(L, {}), C);
  assert.equal(r.outcome, 'G');
  assert.ok(r.total <= 59);
  assert.ok(r.violations.some((v) => v.ruleId === 'R_SEIZE_SHOES'));
});

test('наводящий вопрос загрязняет показания и пишется в нарушения', () => {
  const L = excellentLog();
  L.push({ t: 650, type: 'dialogue.choice', npc: 'sosedka', choice: 'lead' });
  const s = replay(L, C);
  assert.ok(s.facts.includes('f_neigh_leading'));
  const r = evaluate(submit(L, {}), C);
  assert.ok(r.violations.some((v) => v.ruleId === 'R_LEADING'));
});

test('шаг по балкону без мостков повреждает снег; влажный смыв в полиэтилене — нарушение упаковки', () => {
  const L = [
    { t: 1, type: 'prologue.done', items: ALL_ITEMS, team: [], dutyGuard: true },
    { t: 2, type: 'player.stepped', zone: 'FZ_balcony' },
    { t: 3, type: 'evidence.collected', id: 'ev05_stain', method: 'swab_wet', pack: 'pe_bag', label: LABEL, gloves: true },
  ];
  const s = replay(L, C);
  assert.equal(s.evidence.ev02_snow.damaged, true);
  const ids = evaluate(L, C).violations.map((v) => v.ruleId);
  assert.ok(ids.includes('R_FRAGILE'));
  assert.ok(ids.includes('R_PACKAGING'));
  assert.ok(ids.includes('R_TOUCH_BEFORE_PHOTO'));
});

test('без понятых и без видео при входе — критическое нарушение', () => {
  const L = [
    { t: 1, type: 'prologue.done', items: ALL_ITEMS, team: [], dutyGuard: true },
    { t: 2, type: 'procedure.decision', key: 'basis', value: 'urgent_165' },
    { t: 3, type: 'procedure.decision', key: 'witnesses', value: 'no' },
    { t: 4, type: 'player.zone', zone: 'hall' },
  ];
  const ids = evaluate(L, C).violations.map((v) => v.ruleId);
  assert.ok(ids.includes('R_NO_FIXATION'));
  assert.ok(ids.includes('R_NO_PPE'));
});
