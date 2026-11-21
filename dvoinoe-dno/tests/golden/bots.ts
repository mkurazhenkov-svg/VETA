// Сценарии-боты для «золотых журналов». Они действуют через те же команды, что и интерфейс;
// разговоры Ink заменены их результатом: выбор реплики с тегами + факт.
import { Sim } from '../helpers';
import type { VariantId } from '../../src/content/schemas';
import type { CaseFolder } from '../../src/domain/events';
import { hotspotPos } from '../../src/domain/geometry';

function talk(s: Sim, npc: string, tags: string[], facts: string[] = []) {
  s.do({ type: 'choice', npc, knot: npc, tags, text: tags.join(' ') });
  for (const f of facts) s.do({ type: 'fact', id: f, source: npc });
}

/** Сфотографировать улику: тренога рядом, нужный вид, при темноте — лампа или магний. */
function shoot(s: Sim, id: string, kind: 'node' | 'detail' | 'overview', lampOk = true) {
  const d = kind === 'detail' ? 0.8 : kind === 'node' ? 2.0 : 4;
  s.tripodNear(id, d);
  s.do({ type: 'lamp', on: lampOk });
  const evs = s.do({ type: 'photo', target: id, kind, scale: true, magnesium: false });
  const p = s.state.photos.at(-1);
  if (!evs.length || !p || !p.ok || p.target !== id) {
    // темно — магний (если не у реактивов)
    s.do({ type: 'photo', target: id, kind, scale: true, magnesium: true });
    s.do({ type: 'spend', minutes: 10, reason: 'дым' });
  }
}

export function excellent(variant: VariantId = 'truth_main') {
  const s = new Sim('practicum', { variant, noRandom: true }, 'pravoved');
  const c = s.c;
  s.do({ type: 'travel', to: 'museum' });
  s.do({ type: 'travel', to: 'bank' });
  talk(s, 'cashier', ['open'], ['f_bank_changer']);
  talk(s, 'cashier', ['clarify'], ['f_bank_paper']);
  talk(s, 'cashier', ['clarify'], ['f_bank_grid']);
  talk(s, 'cashier', ['clarify'], ['f_bank_color']);
  talk(s, 'cashier', ['clarify'], ['f_bank_numbers']);
  s.do({ type: 'examine', id: 'ev_bank_fakes' });
  s.do({ type: 'collect', id: 'ev_bank_fakes', method: 'by_edges', pack: 'envelope', sealed: true });

  s.do({ type: 'travel', to: 'yard' });
  talk(s, 'ershov', ['open']);
  talk(s, 'sychev', ['open']);
  s.do({ type: 'witnesses', chosen: ['ershov', 'sychev'] });
  talk(s, 'sychev', ['open']);
  s.do({ type: 'flag', id: 'sychev_stays', value: true });
  talk(s, 'pyzhov', ['open'], ['f_pyzhov_changes']);
  talk(s, 'mitrofan', ['open'], ['f_dvornik_two_men']);
  talk(s, 'mitrofan', ['clarify'], ['f_dvornik_time']);
  talk(s, 'mitrofan', ['clarify'], ['f_dvornik_pyzhov_bundle']);
  if (variant === 'truth_landlord') talk(s, 'pyzhov', ['present'], ['f_pyzhov_papers_hidden', 'f_pyzhov_papers', 'f_sublet_letter']);
  else talk(s, 'pyzhov', ['clarify'], variant === 'truth_guest' ? ['f_pyzhov_papers', 'f_mokhov_rent'] : ['f_pyzhov_papers']);
  // следы во дворе: осмотр, снимок, слепок — до дождя
  s.do({ type: 'move', to: [9.5, 3.3], sector: 'mud' });
  s.do({ type: 'examine', id: 'ev_y1_footprints' });
  s.do({ type: 'tripod', pos: [9.5, 2.6] });
  s.do({ type: 'photo', target: 'ev_y1_footprints', kind: 'detail', scale: true, magnesium: false });
  s.do({ type: 'collect', id: 'ev_y1_footprints', method: 'plaster_cast', pack: 'crate', sealed: true });
  s.do({ type: 'examine', id: 'ev_y2_wrapper' });
  s.do({ type: 'collect', id: 'ev_y2_wrapper', method: 'by_edges', pack: 'envelope', sealed: true });
  talk(s, 'kukushkina', ['open'], ['f_kukushkina_lie']);
  talk(s, 'kukushkina', ['present'], []);
  talk(s, 'kukushkina', ['present'], variant === 'truth_landlord' ? ['f_kukushkina_admits', 'f_pyzhov_visits'] : ['f_kukushkina_admits']);

  // подвал: с порога — общий вид, потом по секторам
  s.do({ type: 'travel', to: 'cellar' });
  s.do({ type: 'describeRoom' });
  s.do({ type: 'tripod', pos: [1.6, 0.8] });
  s.do({ type: 'photo', target: 'PT_room', kind: 'orienting', scale: false, magnesium: true });
  s.do({ type: 'spend', minutes: 10, reason: 'дым' });
  s.do({ type: 'lamp', on: true });
  s.do({ type: 'lampReveal', ids: ['ev07_shoeprints'] });
  const scene = c.scenes.cellar;
  for (const sec of scene.sectors) {
    const p = sec.poly[0];
    s.do({ type: 'move', to: [p[0] + 0.6, p[1] + 0.6], sector: sec.id, threshold: false });
    s.do({ type: 'look' });
  }
  s.do({ type: 'lampReveal', ids: ['ev02_stone', 'L4_paws'] });
  for (const cont of ['c_coat', 'c_drawer', 'c_boards']) {
    s.do({ type: 'examine', id: cont });
    if (cont === 'c_boards') s.do({ type: 'search', id: cont });
  }
  const order = ['ev07_shoeprints', 'ev01_press', 'ev06_prints', 'ev02_stone', 'ev03_burnt_proofs', 'ev12_ash', 'ev10_bottles', 'ev05_sample', 'ev11_tools', 'ev08_notebook', 'ev04_negatives', 'ev13_sheet', 'ev09_receipt'];
  const plates: Record<string, 'node' | 'detail'> = { ev01_press: 'node', ev06_prints: 'detail', ev02_stone: 'detail', ev03_burnt_proofs: 'detail', ev05_sample: 'detail', ev04_negatives: 'node', ev13_sheet: 'node', ev07_shoeprints: 'detail', ev10_bottles: 'node', ev11_tools: 'detail', ev08_notebook: 'node' };
  for (const id of order) {
    if (!s.c.evidence.find((e) => e.id === id)!.variants.includes(variant)) continue;
    s.goTo(id);
    s.do({ type: 'examine', id, lupa: true });
    if (plates[id]) shoot(s, id, plates[id]);
    s.do({ type: 'measure', target: id, landmark: 'stove' });
    s.do({ type: 'measure', target: id, landmark: 'window' });
    const pos = hotspotPos(scene, s.c.evidence.find((e) => e.id === id)!.hotspot)!;
    s.do({ type: 'plan', id, pos: [pos[0] + 0.3, pos[1] - 0.2] });
  }
  const pack: Record<string, [string, string]> = {
    ev01_press: ['paint_sample', 'seal_in_place'],
    ev06_prints: ['whole_object', 'crate'],
    ev02_stone: ['whole_object', 'wrap_paper'],
    ev03_burnt_proofs: ['rigid_board_glass', 'flat_box'],
    ev10_bottles: ['whole_object', 'corked_crate'],
    ev05_sample: ['by_edges', 'envelope'],
    ev11_tools: ['by_edges', 'box_separators'],
    ev08_notebook: ['no_marks', 'envelope'],
    ev04_negatives: ['by_edges', 'box_separators'],
    ev13_sheet: ['by_edges', 'flat_box'],
    ev09_receipt: ['copy_text', 'envelope'],
  };
  // лавочник ушёл — пригласить постороннего с улицы
  if (s.state.witnesses.present.length < 2) {
    s.do({ type: 'choice', npc: 'zharov', knot: 'zharov_cellar', tags: ['min:15'], text: 'Приведите постороннего' });
    s.do({ type: 'witnesses', chosen: [...s.state.witnesses.present, 'nosov'], reason: 'invited' });
  }
  for (const [id, [m, p]] of Object.entries(pack)) s.do({ type: 'collect', id, method: m, pack: p, sealed: true });
  s.do({ type: 'origin', id: 'L1_props', origin: 'studio' });
  s.do({ type: 'origin', id: 'L2_firemen', origin: 'firemen' });
  s.do({ type: 'origin', id: 'L3_handprint', origin: 'pyzhov' });
  s.do({ type: 'origin', id: 'L4_paws', origin: 'cat' });
  // телеграмма — сразу, как известен пароход
  if (variant !== 'truth_landlord')
    s.do({ type: 'telegram', destination: 'kozmodemyansk', steamer: true, description: ['f_dvornik_two_men'], text: 'КОЗЬМОДЕМЬЯНСК. ПРОШУ ЗАДЕРЖАТЬ…' });
  s.do({ type: 'fact', id: 'f_skobtsov_card', source: 'zharov' });
  s.do({ type: 'fact', id: 'f_skobtsov_whereabouts', source: 'zharov' });

  s.do({ type: 'travel', to: 'shop' });
  talk(s, 'gurov', ['open'], ['f_gurov_story']);
  talk(s, 'gurov', ['clarify'], ['f_gurov_ledger']);
  talk(s, 'gurov', ['present'], ['f_gurov_admits']);
  s.do({ type: 'travel', to: 'pharmacy' });
  talk(s, 'provizor', ['open']);
  talk(s, 'provizor', ['clarify'], ['f_pharmacy_book']);
  s.do({ type: 'travel', to: 'flophouse' });
  if (variant === 'truth_guest') {
    s.do({ type: 'flag', id: 'keeper_alibi', value: true });
    talk(s, 'skobtsov', ['clarify'], ['f_skobtsov_alibi']);
  } else {
    talk(s, 'skobtsov', ['present']);
    talk(s, 'skobtsov', ['present'], ['f_skobtsov_confession']);
  }
  s.do({ type: 'travel', to: 'chamber' });
  talk(s, 'zharov', ['open'], [variant === 'truth_guest' ? 'f_prints_nomatch' : 'f_prints_match']);
  // версии: обдумать верную, отбросить ложную
  const trueTh = { truth_main: 'th_photographer', truth_landlord: 'th_okolotochny', truth_guest: 'th_guest' }[variant];
  if (s.state.theories[trueTh] === 'revealed') s.do({ type: 'theoryThink', id: trueTh });
  if (s.state.theories['th_dvornik']) s.do({ type: 'theoryDiscard', id: 'th_dvornik' });
  if (s.state.theories['th_changer'] === 'revealed') s.do({ type: 'theoryThink', id: 'th_changer' });
  const v = c.case.variants.find((x) => x.id === variant)!;
  const collected = Object.entries(s.state.evidence).filter(([, e]) => e.collected).map(([id]) => id);
  const examined = c.evidence.filter((e) => s.state.evidence[e.id].examined).map((e) => e.id);
  const folder: CaseFolder = {
    protocol: { include: [...new Set([...collected, ...examined])], extra: 'В подвале у стены ручной пресс, на валике остатки зеленоватой краски; в печи обгоревшие листы с печатным изображением.' },
    examination: c.case.examination.objects.map((o) => ({
      evidence: o.evidence,
      addressee: o.correct[0],
      questions: c.case.examination.questions.filter((q) => q.good && (q.for.includes(o.evidence) || q.for.includes('*'))).map((q) => q.id),
    })),
    accusation: { ...v.roles } as CaseFolder['accusation'],
    theories: [trueTh, 'th_changer', 'th_landlady'].filter((t) => s.state.theories[t]),
  };
  s.do({ type: 'submit', folder });
  return s;
}

/** Туннельное зрение: «гастролёр», но следователь поверил штихелям «А. С.» и обвиняет Скобцова. */
export function tunnel() {
  const s = new Sim('practicum', { variant: 'truth_guest', noRandom: true }, 'syn_gravera');
  s.do({ type: 'travel', to: 'bank' });
  talk(s, 'cashier', ['open'], ['f_bank_changer']);
  talk(s, 'cashier', ['clarify'], ['f_bank_numbers']);
  s.do({ type: 'travel', to: 'yard' });
  s.do({ type: 'witnesses', chosen: ['ershov', 'sychev'] });
  talk(s, 'pyzhov', ['open'], ['f_pyzhov_changes']);
  talk(s, 'mitrofan', ['open'], ['f_dvornik_two_men']);
  s.do({ type: 'travel', to: 'cellar' });
  s.do({ type: 'describeRoom' });
  for (const cont of ['c_drawer', 'c_coat']) s.do({ type: 'examine', id: cont });
  for (const id of ['ev11_tools', 'ev01_press', 'ev06_prints', 'ev03_burnt_proofs', 'ev05_sample', 'ev09_receipt']) {
    s.goTo(id);
    s.do({ type: 'examine', id });
  }
  s.do({ type: 'fact', id: 'f_skobtsov_card', source: 'zharov' });
  s.do({ type: 'theoryThink', id: 'th_engraver' }); // принял версию — туннель
  s.tripodNear('ev06_prints', 0.8);
  s.do({ type: 'photo', target: 'ev06_prints', kind: 'detail', scale: true, magnesium: true });
  s.do({ type: 'collect', id: 'ev06_prints', method: 'whole_object', pack: 'crate', sealed: true });
  s.do({ type: 'collect', id: 'ev11_tools', method: 'by_edges', pack: 'box_separators', sealed: true });
  s.do({ type: 'travel', to: 'chamber' });
  s.do({
    type: 'submit',
    folder: {
      protocol: { include: ['ev06_prints', 'ev11_tools'], extra: 'Мастерская Скобцова: штихели его, следы пальцев на прессе.' },
      examination: [{ evidence: 'ev06_prints', addressee: 'sysk', questions: ['q_prints', 'q_guilty'] }],
      accusation: { skobtsov: 'maker', gurov: 'seller' },
      theories: ['th_engraver'],
    },
  });
  return s;
}

/** Процессуальный провал: без понятых, руками до снимка, угрозы свидетелям. */
export function failure() {
  const s = new Sim('practicum', { variant: 'truth_main' }, 'starozhil');
  s.do({ type: 'travel', to: 'yard' });
  s.do({ type: 'choice', npc: 'mitrofan', knot: 'mitrofan', tags: ['threat', 'voice:instinct', 'shortcut'], text: 'Говори!' });
  s.do({ type: 'fact', id: 'f_dvornik_two_men', source: 'mitrofan' });
  s.do({ type: 'travel', to: 'cellar' });
  s.do({ type: 'move', to: [6, 4], sector: 'atelier', fragileHit: 'ev07_shoeprints', threshold: false });
  for (const id of ['ev03_burnt_proofs', 'ev06_prints', 'ev01_press']) s.do({ type: 'pickUp', id });
  s.do({ type: 'collect', id: 'ev03_burnt_proofs', method: 'by_hand', pack: 'envelope', sealed: false });
  s.do({ type: 'examine', id: 'ev06_prints' });
  s.do({ type: 'collect', id: 'ev06_prints', method: 'by_hand', pack: 'envelope', sealed: false });
  s.do({ type: 'travel', to: 'chamber' });
  s.do({
    type: 'submit',
    folder: { protocol: { include: [], extra: 'Найдены фальшивые билеты, очевидно, работа фотографа.' }, examination: [], accusation: { vetlugin: 'maker', mitrofan: 'seller' }, theories: [] },
  });
  return s;
}
