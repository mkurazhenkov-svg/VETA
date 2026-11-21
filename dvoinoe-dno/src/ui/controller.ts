// Связка сцены, домена, Ink и колонки текста: что показать при клике по предмету, человеку, выходу.
import { content } from '../content';
import type { Evidence } from '../content/schemas';
import { SceneView } from '../scene/pixi-app';
import type { Look } from '../scene/painter';
import { InkRunner } from '../ink/runtime-adapter';
import {
  choices, dispatch, highlight, modal, onEvents, openModal, say, screen, setInkStateGetter, speaker, state, tool, type Choice,
} from '../store/game';
import { activeEvidence, evidenceDescribe, evidenceLupa, isFixed, locationDef, personName, sceneOf, docStatus } from '../domain/queries';
import { formatArshin, arshinToCm } from '../domain/geometry';
import { KIND_TITLE } from '../domain/photo-judge';
import { sfx } from '../audio/sound';
import { canEnter } from '../domain/commands';

export const ink = new InkRunner();
setInkStateGetter(() => ink.saveState());

const people: Record<string, Look> = {};
for (const p of content.case.persons) people[p.id] = p.portrait;
const PLAYER: Look = { coat: '#232a3a', skin: '#d8b090', hat: 'cap', hair: '#3a2a20' };

export const scene = new SceneView({
  onArrive(to, sector, fragileHit, threshold) {
    dispatch({ type: 'move', to, sector, fragileHit, threshold });
  },
  onHotspot(id) {
    openHotspot(id);
  },
  onNpc(id, knot) {
    sfx('page');
    ink.talk(knot, id);
  },
  onExit(_id, to) {
    if (state.value.mode === 'exhibit' && state.value.location === 'cellar') {
      say('system', 'Пора сличить найденное с подделкой — в ярмарочную кассу Госбанка.');
      travel('bank');
      return;
    }
    if (to === 'map') {
      ink.stop();
      screen.value = 'map';
      return;
    }
    travel(to);
  },
  onTripod(pos) {
    dispatch({ type: 'tripod', pos });
    tool.value = 'walk';
    scene.setTool('walk');
    say('system', 'Фотограф ставит треногу. Выберите предмет и «Сфотографировать».');
    sfx('tripod');
  },
  onLamp(_pos, revealed) {
    const before = new Set(Object.entries(state.value.evidence).filter(([, e]) => e.detected).map(([id]) => id));
    dispatch({ type: 'lampReveal', ids: revealed });
    for (const id of revealed) {
      if (before.has(id)) continue;
      const ev = content.evidence.find((e) => e.id === id);
      if (ev?.lampText) say('narr', ev.lampText);
      else if (ev) say('narr', `В косом свете лампы проступает: ${ev.title.toLowerCase()}.`);
    }
    refreshScene();
  },
});
scene.labelFor = (id) => personName(content, id === 'zharov_chamber' ? 'zharov' : id === 'keeper' ? (state.value.location === 'museum' ? 'museum_keeper' : 'flop_keeper') : id);

export function travel(to: string) {
  if (!canEnter(state.value, content, to)) return;
  ink.stop();
  dispatch({ type: 'travel', to });
  enterLocation();
}

let loadedLoc: string | null = null;
export function enterLocation(force = false) {
  const s = state.value;
  const loc = locationDef(content, s.location);
  if (!loc) return;
  choices.value = [];
  speaker.value = null;
  if (!loc.scene) {
    // локация без сцены (аптека): разговор, потом карта
    screen.value = 'map';
    if (loc.enterKnot) {
      ink.onEnd = () => {
        ink.onEnd = () => {};
      };
      ink.talk(loc.enterKnot, 'provizor');
    }
    return;
  }
  screen.value = 'game';
  if (loadedLoc !== s.location || force) {
    loadedLoc = s.location;
    queueMicrotask(() => loadScene());
  }
  say('system', `${loc.title}. ${loc.text}`);
  if (loc.enterKnot) ink.talk(loc.enterKnot, '');
  if (s.mode === 'exhibit' && s.location === 'cellar' && s.witnesses.present.length === 0)
    dispatch({ type: 'witnesses', chosen: ['ershov', 'sychev'], reason: 'exhibit' });
}

export async function loadScene() {
  await scene.ready;
  const s = state.value;
  const sc = sceneOf(content, s.location);
  if (!sc) return;
  const lampOnly = new Set(content.evidence.filter((e) => e.visibility.via === 'lamp').map((e) => e.id));
  scene.load(sc, {
    people,
    playerLook: PLAYER,
    followers: followersFor(),
    npcVisible: (id) => !s.witnesses.present.includes(id),
    lampOnly,
    activeHotspots: activeHotspots(),
    startPos: s.pos[s.location!] ?? sc.spawn,
  });
  refreshScene();
}

function followersFor(): string[] {
  const s = state.value;
  const sc = sceneOf(content, s.location);
  if (!sc?.followers) return [];
  const f = ['zharov', ...s.witnesses.present];
  if (s.location === 'cellar') f.splice(1, 0, 'photographer');
  return f;
}

export function hotspotItems(hid: string): Evidence[] {
  const s = state.value;
  return activeEvidence(s, content, s.location ?? undefined).filter((e) => {
    if (e.hotspot !== hid) return false;
    const es = s.evidence[e.id];
    if (e.visibility.via === 'look') return true;
    return es.detected;
  });
}

function activeHotspots(): Set<string> {
  const sc = sceneOf(content, state.value.location);
  const out = new Set<string>();
  if (!sc) return out;
  for (const h of sc.hotspots) if (h.knot || h.action || hotspotItems(h.id).length) out.add(h.id);
  return out;
}

export function refreshScene() {
  const s = state.value;
  scene.setActiveHotspots(activeHotspots());
  scene.setFollowers(followersFor());
  scene.setTripod(s.tripod && s.tripod.loc === s.location ? s.tripod.pos : null);
  const sc = sceneOf(content, s.location);
  if (highlight.value && sc) {
    scene.setHighlight(sc.hotspots.filter((h) => hotspotItems(h.id).some((e) => !s.evidence[e.id].examined) || h.knot).map((h) => h.id));
  } else scene.setHighlight([]);
}

onEvents((evs) => {
  if (evs.some((e) => ['witnesses.changed', 'evidence.detected', 'tripod.placed', 'evidence.examined', 'evidence.packaged'].includes(e.type))) refreshScene();
});
highlight.subscribe(() => refreshScene());

// ---------------- предметы ----------------
export function openHotspot(hid: string) {
  const sc = sceneOf(content, state.value.location);
  const h = sc?.hotspots.find((x) => x.id === hid);
  if (!h) return;
  ink.stop();
  if (h.knot) {
    ink.talk(h.knot, '');
    return;
  }
  if (h.action === 'folder') {
    openModal('folder');
    return;
  }
  const items = hotspotItems(hid);
  if (items.length === 1) return openItem(items[0].id);
  say('narr', `${h.label}.`);
  choices.value = [
    ...items.map((e): Choice => ({ text: itemLabel(e), run: () => openItem(e.id) })),
    { text: 'Отойти', run: () => (choices.value = []) },
  ];
}

function itemLabel(e: Evidence) {
  const es = state.value.evidence[e.id];
  const mark = es.collected ? ' — изъято' : es.examined ? ' — осмотрено' : '';
  return `${e.title}${mark}`;
}

export function openItem(id: string, quiet = false) {
  const ev = content.evidence.find((e) => e.id === id);
  if (!ev) return;
  const s = state.value;
  const es = s.evidence[id];
  if (!quiet) {
    if (!es.detected && ev.visibility.via !== 'look') say('narr', ev.hiddenText ?? 'Ничего особенного.');
    else if (es.examined) say('narr', evidenceDescribe(s, ev));
    else say('narr', `${ev.title}. Можно осмотреть внимательнее.`);
  }
  const practicum = s.mode === 'practicum';
  const list: Choice[] = [];
  const back = () => openItem(id, true);
  if (!es.examined) list.push({ text: 'Осмотреть и описать', hint: `${ev.examineMinutes} мин`, run: () => {
    sfx('page');
    const evs = dispatch({ type: 'examine', id });
    if (evs.some((e) => e.type === 'evidence.examined')) say('narr', evidenceDescribe(state.value, ev));
    back();
  } });
  if (es.examined && ev.lupa && !es.lupa) list.push({ text: 'Осмотреть в лупу', hint: '3 мин', run: () => {
    dispatch({ type: 'examine', id, lupa: true });
    say('narr', evidenceLupa(state.value, ev) ?? '');
    back();
  } });
  if (ev.kind === 'container' && ev.searchMinutes && !es.searched && es.examined) list.push({ text: ev.searchLabel ?? 'Обыскать', run: () => {
    const evs = dispatch({ type: 'search', id });
    const found = evs.filter((e) => e.type === 'evidence.detected');
    say('narr', found.length ? 'За отставшей доской что-то есть.' : 'Ничего.');
    refreshScene();
    if (found.length) openItem((found[0] as any).id);
    else back();
  } });
  if (ev.kind === 'container' && es.examined) {
    for (const c of ev.reveals) {
      const child = content.evidence.find((e) => e.id === c);
      if (child && state.value.evidence[c]?.detected) list.push({ text: `→ ${child.title}`, run: () => openItem(c) });
    }
  }
  if (ev.kind !== 'container' && (es.detected || ev.visibility.via === 'look')) {
    const locDef = locationDef(content, s.location);
    if ((locDef?.plates ?? 0) > 0) {
      const st = docStatus(s, content, id);
      const need = ev.documentation.required.length ? ` · нужно: ${ev.documentation.required.map((r) => (r === 'detail_scaled' ? 'детальная с масштабом' : KIND_TITLE[r as keyof typeof KIND_TITLE])).join(', ')}${st.complete ? ' ✓' : ''}` : '';
      list.push({ text: 'Сфотографировать', hint: `тренога${s.tripod?.loc === s.location ? ' стоит' : ' не поставлена'}${need}`, run: () => openModal('photo', { target: id }) });
    }
    const sc = sceneOf(content, s.location);
    if (sc && sc.landmarks.length && ev.kind === 'evidence') list.push({ text: 'Измерить расстояние до ориентира', hint: Object.keys(es.measured).length ? `привязок: ${Object.keys(es.measured).length}` : undefined, run: () => measureMenu(id) });
    if (!es.collected && ev.kind === 'evidence') {
      list.push({ text: 'Тронуть', run: () => {
        const fixed = isFixed(state.value, content, id);
        dispatch({ type: 'touch', id });
        if (fixed) say('narr', 'Вы касаетесь предмета.');
        back();
      } });
      if (ev.collection.collectable) list.push({ text: 'Изъять и упаковать', run: () => openModal('collect', { id }) });
    }
    if (ev.origin && !es.origin) list.push({ text: 'Отметить происхождение следа', run: () => originMenu(id) });
    list.push({ text: 'Записать в книжку', run: () => openModal('note', { about: id }) });
  }
  if (!practicum && !es.examined) list.push({ text: 'Подсказка Жарова', run: () => {
    dispatch({ type: 'hint', about: id });
    say('zharov', ev.collection.hint || 'Осмотрите внимательнее, ваше высокоблагородие.', 'zharov');
  } });
  if (ev.museum.exhibit && es.examined) {
    const ex = content.exhibits.exhibits.find((x) => x.id === ev.museum.exhibit);
    if (ex) say('doc', `Это есть в музее: ${ex.title} — ${ex.hall}.${ex.confirmed ? '' : ' (черновик)'} ${ex.text}`);
  }
  list.push({ text: 'Отойти', run: () => (choices.value = []) });
  choices.value = list;
}

function measureMenu(id: string) {
  const sc = sceneOf(content, state.value.location);
  if (!sc) return;
  choices.value = [
    ...sc.landmarks.map((l): Choice => ({ text: `До ориентира: ${l.title.toLowerCase()}`, hint: state.value.evidence[id].measured[l.id] ? 'уже измерено' : '2 мин', run: () => {
      const evs = dispatch({ type: 'measure', target: id, landmark: l.id });
      const m = evs.find((e) => e.type === 'measure.taken');
      if (m && m.type === 'measure.taken') say('system', `Складной аршин: от «${l.title}» — ${formatArshin(m.arshin)} (≈ ${arshinToCm(m.arshin)} см).`);
      sfx('click');
      measureMenu(id);
    } })),
    { text: 'Готово', run: () => openItem(id, true) },
  ];
}

function originMenu(id: string) {
  const ev = content.evidence.find((e) => e.id === id)!;
  choices.value = [
    ...ev.origin!.options.map((o): Choice => ({ text: o.title, run: () => {
      const evs = dispatch({ type: 'origin', id, origin: o.id });
      const r = evs.find((e) => e.type === 'evidence.origin');
      if (r && r.type === 'evidence.origin') say('narr', state.value.mode === 'exhibit' ? (r.correct ? `Верно. ${ev.origin!.text}` : 'Подумайте ещё — Жаров качает головой.') : `Отмечено: ${o.title.toLowerCase()}.`);
      openItem(id, true);
    } })),
    { text: 'Назад', run: () => openItem(id, true) },
  ];
}

// ---------------- инструменты панели ----------------
export function lookAround() {
  const before = new Set(Object.entries(state.value.evidence).filter(([, e]) => e.detected).map(([id]) => id));
  dispatch({ type: 'look' });
  const found = Object.entries(state.value.evidence).filter(([id, e]) => e.detected && !before.has(id)).map(([id]) => content.evidence.find((x) => x.id === id)!);
  const sc = sceneOf(content, state.value.location);
  const sector = sc?.sectors.find((x) => x.id === state.value.sectorsLooked[state.value.location!]?.at(-1));
  if (found.length) say('narr', `${sector ? sector.title + ': ' : ''}вы замечаете — ${found.map((e) => e.title.toLowerCase()).join('; ')}.`);
  else say('narr', `${sector ? sector.title + ': ' : ''}ничего нового на виду.`);
  refreshScene();
}

export function describeRoom() {
  dispatch({ type: 'describeRoom' });
  dispatch({ type: 'fact', id: 'f_room_general', source: 'evidence' });
  say('narr', 'Вы стоите на пороге и диктуете: «Подвал сводчатый, размером около четырнадцати на десять аршин. Вход с лестницы со двора. Окно под сводом, во двор. В дальнем углу — печь, у стен — пресс, стол, шкаф, ширма…»');
}

export function toggleLamp() {
  const s = state.value;
  if (!s.lamp) {
    dispatch({ type: 'lamp', on: true });
    scene.setLamp(scene.playerPos());
    say('system', 'Вы ставите лампу на пол: свет ложится косо.');
    sfx('click');
  } else {
    const p = scene.playerPos();
    // если отошли — переставить лампу, иначе погасить
    dispatch({ type: 'lamp', on: false });
    scene.setLamp(null);
    if ((scene as any).lastLamp && Math.hypot(p[0] - (scene as any).lastLamp[0], p[1] - (scene as any).lastLamp[1]) > 1) {
      dispatch({ type: 'lamp', on: true });
      scene.setLamp(p);
    } else say('system', 'Лампа погашена.');
  }
  (scene as any).lastLamp = state.value.lamp ? scene.playerPos() : null;
}

export function startTripodPlacement() {
  tool.value = tool.value === 'tripod' ? 'walk' : 'tripod';
  scene.setTool(tool.value);
  if (tool.value === 'tripod') say('system', 'Кликните по полу, куда поставить треногу.');
}

export function talkZharov() {
  const loc = state.value.location;
  if (loc === 'chamber') ink.talk('zharov_chamber', 'zharov');
  else ink.talk('zharov_cellar', 'zharov');
}

export function closeModal() {
  modal.value = null;
}
