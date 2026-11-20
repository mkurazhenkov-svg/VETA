// Журнал событий — единственный источник истины. Состояние строится редьюсером из журнала.
// Здесь нет three.js, DOM и Math.random.
import { judgePhoto } from './photo-judge.js';

export function initialState(C) {
  const evidence = {};
  for (const e of C.EVIDENCE) {
    evidence[e.id] = {
      detected: !e.visibility, photos: {}, marker: 0, scale: false, measured: null, powder: null,
      collected: null, damaged: false, contaminated: false, flagged: null, inspected: false, touched: false, photoAfterPowder: false,
    };
  }
  const npcs = {};
  for (const [id, n] of Object.entries(C.NPCS)) npcs[id] = { trust: n.trust, used: [], closed: false, rights: false, met: false };
  return {
    t: 0, items: [], team: [], decisions: {}, ppe: { gloves: false, shoecovers: false, mask: false },
    glovesLeft: 0, glovePairDna: null, zone: 'landing', entered: false,
    evidence, facts: [], photos: [], markerNext: 1, bridgesLeft: 0, bridges: [],
    video: { on: false, since: null, intervals: [], battery: 100, spare: false },
    npcs, sceneEvents: [], doorOpen: false, protocol: null, finished: false, toasts: [],
  };
}

const addFacts = (s, ids = []) => {
  for (const f of ids) if (!s.facts.includes(f)) s.facts.push(f);
};

export function reduce(state, ev, C) {
  if (ev.type === 'player.track') return state;
  const s = structuredClone(state);
  s.t = ev.t ?? s.t;
  switch (ev.type) {
    case 'prologue.done':
      s.items = ev.items;
      s.team = ev.team;
      s.decisions.dutyGuard = ev.dutyGuard ? 'yes' : 'no';
      s.glovesLeft = ev.items.includes('gloves') ? 5 : 0;
      s.bridgesLeft = ev.items.includes('bridges') ? 4 : 0;
      s.video.spare = ev.items.includes('battery');
      break;
    case 'procedure.decision':
      s.decisions[ev.key] = ev.value;
      break;
    case 'ppe.put_on':
      if (ev.item === 'gloves') {
        if (s.glovesLeft <= 0) break;
        s.glovesLeft -= 1;
        s.glovePairDna = null;
      }
      s.ppe[ev.item] = true;
      break;
    case 'player.zone':
      s.zone = ev.zone;
      if (C.APARTMENT_ZONES.includes(ev.zone)) s.entered = true;
      break;
    case 'player.stepped': {
      const fz = C.FRAGILE_ZONES.find((z) => z.id === ev.zone);
      for (const id of fz?.evidence ?? []) if (!s.evidence[id].collected) s.evidence[id].damaged = true;
      break;
    }
    case 'bridge.placed':
      if (s.bridgesLeft > 0) { s.bridgesLeft -= 1; s.bridges.push(ev.rect); }
      break;
    case 'evidence.detected':
      s.evidence[ev.id].detected = true;
      break;
    case 'evidence.inspected': {
      const e = C.EVIDENCE.find((x) => x.id === ev.id);
      const st = s.evidence[ev.id];
      st.inspected = true;
      if (ev.full && !(st.damaged && e.id === 'ev02_snow')) addFacts(s, e.inspect.facts);
      break;
    }
    case 'evidence.touched':
      s.evidence[ev.id].touched = true;
      if (!ev.gloves) s.evidence[ev.id].contaminated = true;
      break;
    case 'photo.taken': {
      const res = judgePhoto(ev, C.PHOTO_RULES);
      s.photos.push({ ...ev, credits: res.credits, issues: res.issues, ok: res.ok });
      for (const c of res.credits) {
        if (c.id === '_scene') continue;
        const st = s.evidence[c.id];
        if (!st || st.collected) continue;
        st.photos[c.kind] = (st.photos[c.kind] ?? 0) + 1;
        if (st.powder && c.kind === 'detail') st.photoAfterPowder = true;
        if (c.id === 'ev02_snow' && !st.damaged) addFacts(s, ['f_snow_intact']);
      }
      break;
    }
    case 'marker.placed':
      s.evidence[ev.id].marker = s.markerNext++;
      break;
    case 'scale.placed':
      s.evidence[ev.id].scale = true;
      break;
    case 'measure.done':
      s.evidence[ev.id].measured = { refs: ev.refs, dims: ev.dims };
      break;
    case 'powder.applied': {
      const st = s.evidence[ev.id];
      st.powder = { powder: ev.powder, quality: ev.quality, result: ev.result };
      st.photoAfterPowder = false;
      break;
    }
    case 'evidence.collected': {
      const st = s.evidence[ev.id];
      st.collected = { method: ev.method, pack: ev.pack, label: ev.label, t: ev.t, noTouch: !!ev.noTouch };
      const e = C.EVIDENCE.find((x) => x.id === ev.id);
      if (!ev.gloves && !ev.noTouch) st.contaminated = true;
      if (e.dna) s.glovePairDna = ev.id;
      break;
    }
    case 'evidence.flagged':
      s.evidence[ev.id].flagged = ev.origin;
      break;
    case 'door.opened':
      s.doorOpen = true;
      for (const id of ['ev10_prints']) {
        const st = s.evidence[id];
        if (!st.collected && !st.photos.detail) st.damaged = true;
      }
      break;
    case 'video.toggled':
      if (ev.on && !s.video.on && s.video.battery > 0) { s.video.on = true; s.video.since = ev.t; }
      else if (!ev.on && s.video.on) { s.video.on = false; s.video.intervals.push([s.video.since, ev.t]); s.video.since = null; }
      break;
    case 'video.battery':
      s.video.battery = ev.level;
      if (ev.level <= 0 && s.video.on) { s.video.on = false; s.video.intervals.push([s.video.since, ev.t]); s.video.since = null; }
      break;
    case 'video.spare_used':
      s.video.spare = false;
      s.video.battery = 100;
      break;
    case 'dialogue.start':
      s.npcs[ev.npc].met = true;
      break;
    case 'dialogue.choice': {
      const npc = C.NPCS[ev.npc];
      const ch = npc.choices.find((c) => c.id === ev.choice);
      const ns = s.npcs[ev.npc];
      if (!ch || ns.closed) break;
      ns.used.push(ch.id);
      const low = ch.minTrust && ns.trust < ch.minTrust;
      if (!low) addFacts(s, ch.facts);
      if (ch.tags.includes('rights')) ns.rights = true;
      ns.trust = Math.max(0, Math.min(100, ns.trust + (ch.trust ?? 0) + (ch.tags.includes('open') ? 3 : 0)));
      if (ch.close) ns.closed = true;
      if (ch.decision) s.decisions[ch.decision.key] = ch.decision.value;
      if (low) ns.used.pop(); // можно вернуться к вопросу, когда доверие вырастет
      break;
    }
    case 'dialogue.present': {
      const p = C.NPCS[ev.npc].present[ev.fact];
      if (p) addFacts(s, p.facts);
      break;
    }
    case 'scene.event':
      s.sceneEvents.push(ev.key);
      if (ev.key === 'canvass') addFacts(s, ['f_door_to_door']);
      break;
    case 'protocol.submitted':
      s.protocol = ev.doc;
      s.finished = true;
      break;
    default:
      break;
  }
  return s;
}

export function replay(log, C) {
  return log.reduce((s, ev) => reduce(s, ev, C), initialState(C));
}

export function createStore(C) {
  const log = [];
  let state = initialState(C);
  const subs = new Set();
  return {
    get state() { return state; },
    get log() { return log; },
    dispatch(ev) {
      log.push(ev);
      state = reduce(state, ev, C);
      for (const fn of subs) fn(state, ev);
      return state;
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

// Детерминированный генератор случайных чисел (mulberry32) — для погрешностей измерений.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Контрольная сумма журнала (FNV-1a) — чтобы ручная правка файла обнаруживалась.
export function checksum(log) {
  const str = JSON.stringify(log);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
