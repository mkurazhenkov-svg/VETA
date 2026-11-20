// Интерфейс поверх 3D: HUD, меню действий, мастер изъятия, опыление, диалоги, планшет.
import { h, modal, fmtTime } from './dom.js';
import { portraitSVG } from './portrait.js';
import { PHOTO_KINDS } from '../domain/photo-judge.js';
import { evaluate } from '../domain/evaluate.js';
import { rng } from '../domain/store.js';

const KIND_KEYS = ['orienting', 'overview', 'node', 'detail'];

export function createSceneUI({ root, C, store, g3d, clock, mode, onFinish }) {
  const S = () => store.state;
  const has = (id) => S().items.includes(id);
  const thumbs = {};
  const rand = rng(20261120);
  const E = Object.fromEntries(C.EVIDENCE.map((e) => [e.id, e]));
  let open = null; // текущий модальный элемент
  let photoKind = 'overview';
  let target = null;
  let lastViolations = 0;
  const hintsShown = new Set();
  let batteryLevel = 100;
  let battWarn = false;

  const dispatch = (ev, cost = 0) => {
    if (cost) clock.spend(cost);
    const st = store.dispatch({ t: +clock.now().toFixed(2), ...ev });
    if (mode === 'training' && ['player.zone', 'evidence.collected', 'dialogue.choice', 'dialogue.present', 'door.opened', 'powder.applied', 'evidence.flagged', 'evidence.touched'].includes(ev.type)) liveCheck();
    return st;
  };
  function liveCheck() {
    const r = evaluate(store.log, C);
    const live = r.violations.filter((v) => !['R_CHANGES_UNKNOWN', 'R_NO_INTRO', 'R_NOT_PRESENTED'].includes(v.ruleId));
    for (const v of live.slice(lastViolations)) toast(`⚠ ${v.title}${v.detail ? ' — ' + v.detail : ''}`, v.severity === 'critical' ? 'crit' : 'bad', 6500);
    lastViolations = Math.max(lastViolations, live.length);
  }

  // ---------- HUD ----------
  const info = h('div', { class: 'hud-info' });
  const status = h('div', { class: 'hud-status' });
  const cross = h('div', { class: 'crosshair' });
  const targetLbl = h('div', { class: 'target' });
  const hint = h('div', { class: 'hud-hint' });
  const toasts = h('div', { class: 'toasts' });
  const keysBar = h('div', { class: 'keys' }, 'E действие · F фото · L фонарь · U УФ · C присесть · B мостки · V видео · G перчатки · N планшет · Tab чемодан');
  const viewfinder = h('div', { class: 'viewfinder hidden' },
    h('div', { class: 'vf-grid' }), h('div', { class: 'vf-corner tl' }), h('div', { class: 'vf-corner tr' }), h('div', { class: 'vf-corner bl' }), h('div', { class: 'vf-corner br' }),
    h('div', { class: 'vf-info' }));
  const flashFx = h('div', { class: 'flashfx' });
  const hud = h('div', { class: 'hud' }, info, status, cross, targetLbl, hint, toasts, keysBar, viewfinder, flashFx);
  root.append(hud);

  function toast(text, kind = 'info', ms = 4200) {
    const t = h('div', { class: 'toast ' + kind }, text);
    toasts.prepend(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 500);
  }
  function mentor(id, text) {
    if (mode !== 'training' || hintsShown.has(id)) return;
    hintsShown.add(id);
    hint.innerHTML = '';
    hint.append(h('b', {}, 'Наставник: '), text);
    hint.classList.add('show');
    clearTimeout(mentor.tm);
    mentor.tm = setTimeout(() => hint.classList.remove('show'), 11000);
  }

  function renderHud() {
    const st = S();
    const zone = C.ZONES.find((z) => z.id === st.zone)?.name ?? '';
    info.innerHTML = '';
    info.append(
      h('div', { class: 'clock' }, fmtTime(clock.now())),
      h('div', {}, zone),
      h('div', { class: 'ppe' },
        h('span', { class: st.ppe.gloves ? 'on' : '' }, `🧤 перчатки${has('gloves') ? ` (${st.glovesLeft})` : ' —'}`),
        h('span', { class: st.ppe.shoecovers ? 'on' : '' }, 'бахилы'),
        h('span', { class: st.ppe.mask ? 'on' : '' }, 'маска')));
    status.innerHTML = '';
    status.append(
      h('div', { class: 'rec' + (st.video.on ? ' on' : '') }, st.video.on ? '● REC' : '○ видео', has('video') ? ` ${Math.round(batteryLevel)}%` : ' нет'),
      h('div', { class: g3d.tools.flashlight ? 'on' : '' }, '🔦 фонарь', has('flashlight') ? '' : ' —'),
      h('div', { class: g3d.tools.uv ? 'on uv' : '' }, '◎ УФ', has('uv') ? '' : ' —'),
      h('div', {}, `▦ мостки: ${st.bridgesLeft}`),
      st.decisions.witnesses === 'yes' ? h('div', { class: 'on' }, '👥 понятые') : '');
    if (g3d.tools.photo) {
      viewfinder.querySelector('.vf-info').innerHTML = `<b>${PHOTO_KINDS[photoKind]}</b> · ${Math.round(g3d.tools.focal)} мм · 1 ориент. · 2 обзорн. · 3 узловая · 4 детальная · колесо — зум · клик/Пробел — снимок · F — выход`;
    }
  }

  // ---------- Наведение ----------
  g3d.setClock(() => clock.now());
  const onTarget = (t) => {
    target = t;
    if (!t) { targetLbl.textContent = ''; cross.classList.remove('hot'); return; }
    cross.classList.add('hot');
    if (t.kind === 'evidence') {
      const st = S().evidence[t.id];
      targetLbl.textContent = `${E[t.id].title}${st.marker ? ` · №${st.marker}` : ''}${st.collected ? ' · изъято' : ''} — [E]`;
    } else if (t.kind === 'npc') targetLbl.textContent = `${C.NPCS[t.id].name} — [E] поговорить`;
    else if (t.kind === 'door') targetLbl.textContent = 'Балконная дверь — [E]';
  };

  // ---------- Модальные окна ----------
  function openModal(content, cls = '') {
    if (open) { open.back.remove(); open = null; }
    g3d.setPaused(true);
    if (g3d.tools.photo) togglePhoto();
    const m = modal(content, { cls });
    open = m;
    return m;
  }
  function closeModal() {
    if (!open) return;
    open.back.remove();
    open = null;
    g3d.setPaused(false);
    g3d.lock();
    renderHud();
  }
  const btn = (label, fn, cls = '') => h('button', { class: 'btn ' + cls, onclick: fn }, label);

  // ---------- Действия с уликой ----------
  function evidenceMenu(id) {
    const e = E[id];
    const st = S().evidence[id];
    const acts = [];
    acts.push(['Осмотреть', () => inspect(id)]);
    if (e.inspect.touch) acts.push(['Проверить на ощупь', () => touch(id)]);
    if (!st.collected || st.collected.noTouch) {
      if (has('markers') && !st.marker && e.kind !== 'false') acts.push(['Поставить номерной указатель', () => { dispatch({ type: 'marker.placed', id }, C.COSTS.marker); g3d.addMarker(id, S().evidence[id].marker); toast(`Указатель № ${S().evidence[id].marker}`); closeModal(); }]);
      if (has('scales') && !st.scale && e.kind !== 'false') acts.push(['Положить масштабную линейку', () => { dispatch({ type: 'scale.placed', id }, C.COSTS.scale); g3d.addScale(id); closeModal(); }]);
      if (has('tape') && !st.measured && e.kind !== 'false') acts.push(['Измерить и привязать к ориентирам (рулетка)', () => measure(id)]);
      if (e.latent && !st.powder) acts.push(['Обработать дактилоскопическим порошком…', () => powderPick(id)]);
      if (id === 'ev05_stain' && has('blood_test') && !st.bloodTest) acts.push(['Предварительная проба на кровь', () => { dispatch({ type: 'evidence.touched', id, gloves: S().ppe.gloves, test: true }, C.COSTS.blood_test); info2('Проба положительная. Результат ориентирующий — это не вывод о природе вещества; реагент может повлиять на последующее исследование.'); }]);
      if (e.collect && !st.collected) acts.push(['Изъять…', () => collectWizard(id)]);
      if (!st.flagged && !st.collected) acts.push(['Отнести к следам посторонних лиц…', () => flagPick(id)]);
    }
    openModal(h('div', { class: 'menu' },
      h('h3', {}, e.title, st.marker ? h('span', { class: 'num' }, `№ ${st.marker}`) : null),
      h('div', { class: 'chips' }, statusChips(id)),
      acts.map(([l, fn], i) => h('button', { class: 'menu-item', onclick: fn }, h('kbd', {}, i + 1), l)),
      h('button', { class: 'menu-item ghost', onclick: closeModal }, h('kbd', {}, 'Esc'), 'Отмена')), 'radial');
    open.keys = acts.map((a) => a[1]);
  }
  function statusChips(id) {
    const st = S().evidence[id];
    const c = [];
    for (const k of KIND_KEYS) if (st.photos[k]) c.push(h('span', { class: 'chip ok' }, '📷 ' + PHOTO_KINDS[k].toLowerCase()));
    if (st.scale) c.push(h('span', { class: 'chip' }, 'масштаб'));
    if (st.measured) c.push(h('span', { class: 'chip' }, 'привязан'));
    if (st.powder) c.push(h('span', { class: 'chip' }, 'порошок: ' + st.powder.result));
    if (st.collected) c.push(h('span', { class: 'chip ok' }, st.collected.noTouch ? 'зафиксирован' : 'изъят'));
    if (st.flagged) c.push(h('span', { class: 'chip' }, 'посторонний: ' + C.ORIGINS[st.flagged]));
    if (st.damaged) c.push(h('span', { class: 'chip bad' }, 'повреждён'));
    if (st.contaminated) c.push(h('span', { class: 'chip bad' }, 'загрязнён'));
    return c;
  }
  function info2(text, title = '') {
    openModal(h('div', { class: 'panel' }, title ? h('h3', {}, title) : null, h('p', {}, text), btn('Понятно', closeModal)));
  }
  function inspect(id) {
    const e = E[id];
    const st = S().evidence[id];
    const full = e.inspect.touch ? false : e.inspect.needs ? has(e.inspect.needs) : true;
    let text = full ? e.inspect.text : e.inspect.textWithout ?? e.inspect.text;
    if (id === 'ev02_snow' && st.damaged) text = 'Снег на балконе затоптан — в том числе вашими следами. Исходное состояние утрачено.';
    const before = S().facts.length;
    dispatch({ type: 'evidence.inspected', id, full }, C.COSTS.inspect);
    const newFacts = S().facts.slice(before).map((f) => C.FACTS[f].text);
    openModal(h('div', { class: 'panel inspect' },
      h('h3', {}, e.title),
      h('p', {}, text),
      e.kind === 'false' && !st.flagged ? h('p', { class: 'fine' }, 'Похоже на следы посторонних? Происхождение устанавливают по объяснениям — затем отметьте через меню.') : null,
      newFacts.length ? h('div', { class: 'newfacts' }, h('b', {}, 'В блокнот: '), newFacts.join('; ')) : null,
      btn('Закрыть', closeModal)));
  }
  function touch(id) {
    const gloves = S().ppe.gloves;
    dispatch({ type: 'evidence.touched', id, gloves }, C.COSTS.inspect);
    dispatch({ type: 'evidence.inspected', id, full: gloves });
    info2(gloves ? E[id].inspect.text : 'Вы коснулись чашки голой рукой — на ней теперь ваши следы.', E[id].title);
  }
  function measure(id) {
    const refs = g3d.measure(id).map((r) => ({ lm: r.lm, name: r.name, d: +(r.d + (rand() - 0.5) * 0.01).toFixed(3) }));
    const dims = id === 'ev08_dust' ? '32×24 см' : E[id].size.filter((v) => v > 0.011).map((v) => Math.round(v * 100)).join('×') + ' см';
    dispatch({ type: 'measure.done', id, refs, dims }, C.COSTS.measure);
    info2(`Размеры: ${dims}. Привязки (метод засечек): ${refs.map((r) => `${(r.d * 100).toFixed(1)} см до «${r.name}»`).join('; ')}.`, 'Рулетка');
  }
  function flagPick(id) {
    openModal(h('div', { class: 'menu' }, h('h3', {}, 'Происхождение следа'),
      Object.entries(C.ORIGINS).map(([k, v]) => h('button', { class: 'menu-item', onclick: () => { dispatch({ type: 'evidence.flagged', id, origin: k }); toast(`Отмечено: ${v}`); closeModal(); } }, v)),
      h('button', { class: 'menu-item ghost', onclick: closeModal }, 'Отмена')));
  }

  // Опыление: мини-игра «держи кисть, отпусти в зелёной зоне»
  function powderPick(id) {
    const powders = ['powder_dark', 'powder_light', 'powder_magnetic'].filter(has);
    if (!powders.length) return info2('В чемодане нет дактилоскопических порошков.');
    openModal(h('div', { class: 'menu' }, h('h3', {}, 'Выбор порошка'),
      h('p', { class: 'fine' }, `Поверхность: ${C.SURFACES[E[id].surface].name}.`),
      powders.map((p) => h('button', { class: 'menu-item', onclick: () => dustGame(id, p) }, C.EQUIPMENT.find((x) => x.id === p).name)),
      h('button', { class: 'menu-item ghost', onclick: closeModal }, 'Отмена')));
  }
  function dustGame(id, powder) {
    let v = 0, holding = false, done = false, raf;
    const fill = h('div', { class: 'dg-fill' });
    const bar = h('div', { class: 'dg-bar' }, h('div', { class: 'dg-zone' }), fill);
    const tip = h('p', {}, 'Зажмите кнопку мыши или Пробел — кисть наносит порошок. Отпустите, когда заполнение в зелёной зоне. Передозировка смазывает узор.');
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const q = Math.max(0, 1 - Math.abs(v - 0.7) / 0.35);
      const res = C.SURFACES[E[id].surface][powder];
      const quality = +(q * (res === 'excellent' ? 1 : res === 'weak' ? 0.5 : 0)).toFixed(2);
      const name = C.EQUIPMENT.find((x) => x.id === powder).name;
      dispatch({ type: 'powder.applied', id, powder, powderName: name, quality, result: res }, C.COSTS.powder);
      const msg = res === 'none' ? 'Порошок не проявил след на этой поверхности.' : `След проявлен: пригодность ${Math.round(quality * 100)} %${res === 'weak' ? ' (порошок плохо подходит к поверхности)' : ''}. Сфотографируйте его с масштабом до копирования на плёнку.`;
      setTimeout(() => info2(msg, 'Результат опыления'), 250);
    };
    const loop = () => {
      if (holding) v = Math.min(1.1, v + 0.008);
      fill.style.width = Math.min(100, v * 100) + '%';
      fill.className = 'dg-fill' + (v > 0.85 ? ' over' : v > 0.55 ? ' good' : '');
      if (v >= 1.1) finish(); else raf = requestAnimationFrame(loop);
    };
    const down = (e) => { if (e.type === 'keydown' && e.code !== 'Space') return; holding = true; e.preventDefault?.(); };
    const up = (e) => { if (e.type === 'keyup' && e.code !== 'Space') return; if (holding) { holding = false; finish(); } };
    const pad = h('div', { class: 'dg-pad', onmousedown: down, onmouseup: up }, 'кисть');
    const m = openModal(h('div', { class: 'panel dust' }, h('h3', {}, 'Опыление'), tip, bar, pad));
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const oldClose = m.back.remove.bind(m.back);
    m.back.remove = () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); cancelAnimationFrame(raf); oldClose(); };
    raf = requestAnimationFrame(loop);
  }

  // Мастер изъятия: способ → упаковка → оформление
  function collectWizard(id) {
    const e = E[id];
    const st = S();
    const missing = (m) => {
      const out = [];
      for (const n of m.needs ?? []) {
        if (n === 'gloves') { if (!st.ppe.gloves) out.push('наденьте перчатки (G)'); }
        else if (n === 'mask') { if (!st.ppe.mask) out.push('наденьте маску'); }
        else if (!has(n)) out.push('нет: ' + C.EQUIPMENT.find((x) => x.id === n).name.toLowerCase());
      }
      if (m.needsPowder && !st.evidence[id].powder) out.push('сначала обработайте порошком');
      if (m.id === 'faraday_on' && !st.team.includes('specialist')) out.push('в группе нет специалиста');
      return out;
    };
    const step1 = () => openModal(h('div', { class: 'menu wide' }, h('h3', {}, `Изъятие: ${e.title}`), h('div', { class: 'step' }, 'Шаг 1 из 3 · Способ'),
      e.collect.methods.map((m) => {
        const miss = missing(m);
        return h('button', { class: 'menu-item', disabled: miss.length ? true : null, onclick: () => (m.id === 'record' || m.id === 'photo_only') ? finish(m, null, {}) : step2(m) },
          m.label, miss.length ? h('small', {}, ' — ' + miss.join(', ')) : null);
      }),
      h('button', { class: 'menu-item ghost', onclick: closeModal }, 'Отмена')));
    const step2 = (m) => openModal(h('div', { class: 'menu wide' }, h('h3', {}, `Изъятие: ${e.title}`), h('div', { class: 'step' }, 'Шаг 2 из 3 · Упаковка'),
      Object.entries(C.PACKS).map(([pid, p]) => h('button', { class: 'menu-item', disabled: has(p.needs) ? null : true, onclick: () => step3(m, pid) }, p.label, has(p.needs) ? null : h('small', {}, ' — нет в чемодане'))),
      h('button', { class: 'menu-item ghost', onclick: step1 }, '← Назад')));
    const step3 = (m, pid) => {
      const L = { what: false, where: false, when: false, kusp: false, sign: false, seal: false };
      const names = { what: 'Что изъято', where: 'Где обнаружено', when: 'Дата и время', kusp: `По материалу ${C.CASE.kusp}`, sign: 'Подписи участников', seal: 'Оттиск печати' };
      openModal(h('div', { class: 'menu wide' }, h('h3', {}, `Изъятие: ${e.title}`), h('div', { class: 'step' }, 'Шаг 3 из 3 · Пояснительная надпись'),
        h('div', { class: 'label-card' }, Object.entries(names).map(([k, v]) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', onchange: (ev) => (L[k] = ev.target.checked) }), v))),
        btn('Опечатать и внести в реестр', () => finish(m, pid, L), 'primary'),
        h('button', { class: 'menu-item ghost', onclick: () => step2(m) }, '← Назад')));
    };
    const finish = (m, pid, label) => {
      const noTouch = m.id === 'record' || m.id === 'photo_only';
      dispatch({ type: 'evidence.collected', id, method: m.id, pack: pid, label, gloves: S().ppe.gloves, mask: S().ppe.mask, noTouch }, noTouch ? 1 : m.id.startsWith('swab') ? C.COSTS.swab : m.id === 'film' || m.id === 'gel' ? C.COSTS.lift : C.COSTS.collect);
      if (!noTouch) g3d.removeEvidence(id);
      toast(noTouch ? `${e.title}: зафиксировано без изъятия` : `${e.title}: изъято и упаковано`, 'good');
      closeModal();
    };
    step1();
  }

  function doorMenu() {
    openModal(h('div', { class: 'menu' }, h('h3', {}, 'Балконная дверь'),
      h('button', { class: 'menu-item', onclick: () => info2('Стекло в верхней части двери разбито, по краям рамы — фрагменты. Шпингалет в положении «открыто», дверь прикрыта. Через проём видны балкон и снег.', 'Балконная дверь') }, 'Осмотреть'),
      h('button', { class: 'menu-item', onclick: () => { dispatch({ type: 'door.opened', id: 'balcony' }); g3d.openBalconyDoor(); toast('Дверь открыта'); closeModal(); } }, 'Открыть дверь'),
      h('button', { class: 'menu-item ghost', onclick: closeModal }, 'Отмена')));
  }

  // ---------- Диалог-комикс ----------
  function dialogue(npcId) {
    const npc = C.NPCS[npcId];
    if (!S().npcs[npcId].met) dispatch({ type: 'dialogue.start', npc: npcId }, npc.phone ? C.COSTS.call : 0);
    let say = S().npcs[npcId].closed ? { text: 'Я не буду с вами разговаривать.', emotion: 'irritation' } : npc.intro;
    const portrait = h('div', { class: 'portrait' });
    const bubble = h('div', { class: 'bubble' });
    const emo = h('div', { class: 'emo' });
    const choicesBox = h('div', { class: 'choices' });
    const factsAtStart = S().facts.length;
    const render = () => {
      const ns = S().npcs[npcId];
      const ec = C.EMOTIONS[say.emotion];
      portrait.innerHTML = portraitSVG(npc, say.emotion, ec.color);
      bubble.textContent = say.text;
      emo.textContent = ec.label;
      emo.style.background = ec.color;
      choicesBox.innerHTML = '';
      if (!ns.closed) {
        const avail = npc.choices.filter((c) => !ns.used.includes(c.id) && (!c.after || ns.used.includes(c.after)));
        avail.forEach((c, i) => choicesBox.append(h('button', { class: 'choice', onclick: () => choose(c) }, h('kbd', {}, i + 1), c.text)));
        if (Object.keys(npc.present).length || true) choicesBox.append(h('button', { class: 'choice present', onclick: present }, h('kbd', {}, 'P'), 'Предъявить факт из блокнота…'));
        open.keys = avail.map((c) => () => choose(c));
      }
      choicesBox.append(h('button', { class: 'choice end', onclick: endTalk }, h('kbd', {}, 'Esc'), npc.phone ? 'Завершить звонок' : 'Завершить опрос'));
    };
    const choose = (c) => {
      const low = c.minTrust && S().npcs[npcId].trust < c.minTrust;
      dispatch({ type: 'dialogue.choice', npc: npcId, choice: c.id, tags: c.tags }, C.COSTS.dialogue);
      say = { text: low ? c.replyLow : c.reply, emotion: c.emotion };
      if (c.id === 'pose') g3d.victimMarker();
      render();
    };
    const present = () => {
      const facts = S().facts;
      const list = h('div', { class: 'present-list' }, facts.map((f) => h('button', { class: 'choice', onclick: () => {
        dispatch({ type: 'dialogue.present', npc: npcId, fact: f }, C.COSTS.dialogue);
        const p = npc.present[f];
        say = p ? { text: p.reply, emotion: p.emotion ?? 'neutral' } : { text: 'Не знаю, о чём вы. Мне нечего добавить.', emotion: 'neutral' };
        list.remove(); render();
      } }, C.FACTS[f].text)), facts.length ? null : h('p', {}, 'В блокноте пока нет фактов.'));
      choicesBox.innerHTML = '';
      choicesBox.append(list, h('button', { class: 'choice end', onclick: () => { list.remove(); render(); } }, '← Назад'));
    };
    const endTalk = () => {
      const got = S().facts.slice(factsAtStart).filter((f) => C.FACTS[f].src !== 'осмотр');
      if (!got.length || npc.phone) return closeModal();
      openModal(h('div', { class: 'panel' }, h('h3', {}, `Объяснение: ${npc.name}`),
        h('p', { class: 'fine' }, 'Черновик собран из ответов. В полной версии его можно редактировать; если в тексте есть то, чего человек не говорил, он откажется подписывать.'),
        h('ul', {}, got.map((f) => h('li', { class: C.FACTS[f].tainted ? 'tainted' : '' }, C.FACTS[f].text.replace(/^⚠ /, '')))),
        btn('Дать прочитать и подписать', () => { toast(`${npc.name}: объяснение подписано`, 'good'); closeModal(); }, 'primary')));
    };
    openModal(h('div', { class: 'comic' },
      h('div', { class: 'comic-left' }, portrait, emo),
      h('div', { class: 'comic-right' }, h('div', { class: 'who' }, h('b', {}, npc.name), h('span', {}, npc.role)), bubble, choicesBox)), 'dialog');
    open.onEsc = endTalk;
    render();
  }

  // ---------- Планшет ----------
  function tablet(tab = 'prep') {
    const st = S();
    const tabs = { prep: 'Подготовка', facts: 'Блокнот', photos: 'Снимки', reg: 'Изъятое', end: 'Завершить' };
    const body = h('div', { class: 'tab-body' });
    const nav = h('div', { class: 'tabs' }, Object.entries(tabs).map(([k, v]) => h('button', { class: 'tab' + (k === tab ? ' on' : ''), onclick: () => tablet(k) }, v)));
    if (tab === 'prep') {
      const radio = (key, opts) => opts.map((o) => h('label', { class: 'chk' + (o.draft ? ' draft' : '') },
        h('input', { type: 'radio', name: key, checked: st.decisions[key] === o.id, onchange: () => { dispatch({ type: 'procedure.decision', key, value: o.id }); tablet('prep'); } }),
        h('span', {}, o.label)));
      const guard = st.decisions.dutyGuard === 'yes' || st.decisions.guard === 'yes';
      body.append(
        h('h4', {}, '1. Основание осмотра жилища'),
        h('div', { class: 'opts' }, radio('basis', C.DWELLING_BASIS)),
        h('p', { class: 'fine' }, 'Хозяин госпитализирован, других проживающих нет. Правильный ответ — черновик, утверждает кафедра.'),
        h('h4', {}, '2. Понятые или техническая фиксация'),
        h('div', { class: 'opts' }, radio('witnesses', [{ id: 'yes', label: 'Пригласить двух понятых (соседи с 3-го этажа)' }, { id: 'no', label: 'Без понятых — обязательна непрерывная видеофиксация (ч. 1.1 ст. 170 УПК)' }])),
        h('h4', {}, '3. Видеозапись'),
        h('div', { class: 'row' },
          btn(st.video.on ? '■ Остановить запись' : '● Начать запись', () => { toggleVideo(); tablet('prep'); }, has('video') ? '' : 'disabled'),
          btn('Вступительное слово', () => { dispatch({ type: 'procedure.decision', key: 'intro', value: 'yes' }, 1); toast('На запись: дата, время, место, участники, технические средства'); tablet('prep'); }, st.video.on && st.decisions.intro !== 'yes' ? '' : 'disabled')),
        h('h4', {}, '4. Средства защиты'),
        h('div', { class: 'row' },
          ['gloves', 'shoecovers', 'mask'].map((it) => btn(`${st.ppe[it] ? '✓ ' : ''}${{ gloves: 'Перчатки', shoecovers: 'Бахилы', mask: 'Маска' }[it]}`, () => { putOn(it); tablet('prep'); }, has(it) ? '' : 'disabled'))),
        h('h4', {}, '5. Охрана места'),
        h('p', {}, guard ? '✓ Охрана обеспечена.' : 'Охрана не обеспечена — распорядитесь через участкового Белова (на площадке).'),
        h('h4', {}, '6. Связь и поручения'),
        h('div', { class: 'row' },
          btn('📞 Позвонить фельдшеру СМП', () => dialogue('orlova')),
          st.team.includes('operative') ? btn(st.sceneEvents.includes('canvass') ? '✓ Обход проведён' : 'Поручить оперуполномоченному поквартирный обход', () => { if (!st.sceneEvents.includes('canvass')) { dispatch({ type: 'scene.event', key: 'canvass' }, 2); toast('Оперуполномоченный: результаты обхода — в блокноте', 'good'); } tablet('prep'); }) : null));
    }
    if (tab === 'facts') body.append(st.facts.length ? h('ul', { class: 'facts' }, st.facts.map((f) => h('li', { class: C.FACTS[f].tainted ? 'tainted' : '' }, h('span', { class: 'src' }, C.FACTS[f].src), C.FACTS[f].text))) : h('p', {}, 'Пока пусто. Осматривайте объекты и опрашивайте людей.'));
    if (tab === 'photos') body.append(st.photos.length ? h('div', { class: 'gallery' }, st.photos.map((p, i) => h('figure', { class: p.ok ? 'ok' : 'bad' },
      h('img', { src: thumbs[p.photoId] }), h('figcaption', {}, h('b', {}, `${i + 1}. ${PHOTO_KINDS[p.declaredKind]}`), ` · ${Math.round(p.focal)} мм`,
        h('br'), p.ok ? '✓ ' + p.credits.map((c) => c.id === '_scene' ? 'место происшествия' : E[c.id].title).join(', ') : '✗ ' + (p.issues[0] ?? ''))))) : h('p', {}, 'Снимков нет. Фотоаппарат — клавиша F.'));
    if (tab === 'reg') {
      const items = C.EVIDENCE.filter((e) => st.evidence[e.id].collected);
      body.append(items.length ? h('table', { class: 'reg' }, h('tr', {}, h('th', {}, '№'), h('th', {}, 'Объект'), h('th', {}, 'Способ'), h('th', {}, 'Упаковка'), h('th', {}, 'Время')),
        items.map((e) => { const c = st.evidence[e.id].collected; return h('tr', {}, h('td', {}, st.evidence[e.id].marker || '—'), h('td', {}, e.title), h('td', {}, e.collect.methods.find((m) => m.id === c.method)?.label), h('td', {}, c.pack ? C.PACKS[c.pack].label : '—'), h('td', {}, fmtTime(c.t))); }))
        : h('p', {}, 'Ничего не изъято.'));
    }
    if (tab === 'end') body.append(
      h('p', {}, 'Завершить осмотр и перейти к документам: фототаблица, протокол, версии и назначение исследований. Вернуться на место будет нельзя.'),
      btn('Завершить осмотр →', () => { closeModal(); g3d.setPaused(true); destroy(); onFinish(thumbs); }, 'primary'));
    openModal(h('div', { class: 'tablet' }, h('div', { class: 'tablet-head' }, h('b', {}, 'Планшет следователя'), h('span', {}, `${C.CASE.address} · ${fmtTime(clock.now())}`)), nav, body, h('div', { class: 'tablet-foot' }, btn('Закрыть (N)', closeModal))), 'big');
  }

  function suitcase() {
    const items = C.EQUIPMENT.filter((e) => has(e.id));
    openModal(h('div', { class: 'tablet' }, h('div', { class: 'tablet-head' }, h('b', {}, 'Криминалистический чемодан')),
      h('div', { class: 'equip small' }, items.map((e) => h('div', { class: 'eq on' }, h('b', {}, e.name), h('small', {}, e.desc)))),
      h('div', { class: 'tablet-foot' }, btn('Закрыть (Tab)', closeModal))), 'big');
  }

  // ---------- Инструменты ----------
  function putOn(it) {
    if (!has(it)) return toast('Этого нет в чемодане', 'bad');
    if (it === 'gloves' && S().glovesLeft <= 0) return toast('Перчатки закончились', 'bad');
    dispatch({ type: 'ppe.put_on', item: it }, C.COSTS.gloves);
    toast(it === 'gloves' ? `Новая пара перчаток (осталось ${S().glovesLeft})` : 'Надето');
  }
  function toggleVideo() {
    if (!has('video')) return toast('Видеокамеры нет в чемодане', 'bad');
    const on = !S().video.on;
    if (on && batteryLevel <= 0) {
      if (S().video.spare) { dispatch({ type: 'video.spare_used' }, 1); batteryLevel = 100; battWarn = false; toast('Установлен запасной аккумулятор'); }
      else return toast('Аккумулятор разряжен, запасного нет', 'bad');
    }
    dispatch({ type: 'video.toggled', on });
    toast(on ? '● Запись началась' : 'Запись остановлена', on ? 'good' : 'info');
    if (on && S().decisions.intro !== 'yes') mentor('intro', 'В начале записи сделайте «вступительное слово» — в планшете (N).');
  }
  function togglePhoto() {
    if (!has('camera')) return toast('Фотоаппарата нет в чемодане', 'bad');
    g3d.setPhoto(!g3d.tools.photo);
    viewfinder.classList.toggle('hidden', !g3d.tools.photo);
    cross.classList.toggle('hidden', g3d.tools.photo);
  }
  function shoot() {
    const { meta, thumb } = g3d.capturePhoto(photoKind);
    const photoId = 'ph' + (S().photos.length + 1);
    thumbs[photoId] = thumb;
    dispatch({ type: 'photo.taken', photoId, ...meta }, C.COSTS.photo);
    flashFx.classList.remove('go'); void flashFx.offsetWidth; flashFx.classList.add('go');
    const p = S().photos.at(-1);
    if (p.ok) toast(`📷 ${PHOTO_KINDS[p.declaredKind]}: засчитано — ${p.credits.map((c) => c.id === '_scene' ? 'место происшествия' : E[c.id].title).slice(0, 4).join(', ')}${p.issues.length ? ' (' + p.issues[0] + ')' : ''}`, 'good', 5000);
    else toast(`📷 ${PHOTO_KINDS[p.declaredKind]}: не засчитано. ${p.issues[0] ?? ''}`, 'bad', 6000);
  }

  // ---------- Клавиши ----------
  const onKey = (e) => {
    if (open) {
      if (e.code === 'Escape') { e.preventDefault(); open.onEsc ? open.onEsc() : closeModal(); return; }
      if ((e.code === 'KeyN' && open.el.querySelector('.tablet')) || (e.code === 'Tab' && open.el.querySelector('.tablet'))) { e.preventDefault(); closeModal(); return; }
      const d = /^Digit([1-9])$/.exec(e.code);
      if (d && open.keys?.[+d[1] - 1]) { e.preventDefault(); open.keys[+d[1] - 1](); }
      if (e.code === 'KeyP' && open.el.querySelector('.present')) open.el.querySelector('.present').click();
      return;
    }
    if (g3d.paused) return;
    if (g3d.tools.photo) {
      const d = /^Digit([1-4])$/.exec(e.code);
      if (d) { photoKind = KIND_KEYS[+d[1] - 1]; renderHud(); return; }
      if (e.code === 'Space') { e.preventDefault(); shoot(); return; }
    }
    switch (e.code) {
      case 'KeyE':
        if (!target) break;
        if (target.kind === 'evidence') evidenceMenu(target.id);
        else if (target.kind === 'npc') dialogue(target.id);
        else if (target.kind === 'door') doorMenu();
        break;
      case 'KeyF': togglePhoto(); break;
      case 'KeyL': if (has('flashlight')) { g3d.tools.flashlight = !g3d.tools.flashlight; g3d.tools.uv = false; } else toast('Фонаря нет в чемодане', 'bad'); break;
      case 'KeyU': if (has('uv')) { g3d.tools.uv = !g3d.tools.uv; g3d.tools.flashlight = false; } else toast('УФ-осветителя нет в чемодане', 'bad'); break;
      case 'KeyB':
        if (S().bridgesLeft <= 0) { toast(has('bridges') ? 'Мостки закончились' : 'Мостков нет в чемодане', 'bad'); break; }
        dispatch({ type: 'bridge.placed', rect: g3d.placeBridge() }, C.COSTS.bridge);
        toast(`Мостки установлены (осталось ${S().bridgesLeft})`);
        break;
      case 'KeyV': toggleVideo(); break;
      case 'KeyG': putOn('gloves'); break;
      case 'KeyN': tablet(); break;
      case 'Tab': e.preventDefault(); suitcase(); break;
      case 'Escape': pauseMenu(); break;
      default: break;
    }
    renderHud();
  };
  const onMouse = (e) => { if (!open && g3d.tools.photo && document.pointerLockElement && e.button === 0) shoot(); };
  window.addEventListener('keydown', onKey);
  document.addEventListener('mousedown', onMouse);
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !open && !g3d.paused) pauseMenu(); });

  function pauseMenu() {
    if (open) return;
    openModal(h('div', { class: 'panel' }, h('h3', {}, 'Пауза'),
      h('p', {}, 'Щёлкните «Продолжить», чтобы вернуть управление мышью.'),
      h('label', { class: 'chk' }, 'Угол обзора (FOV): ', h('input', { type: 'range', min: 55, max: 95, value: g3d.tools.normalFov, oninput: (e) => g3d.setFov(+e.target.value) })),
      h('div', { class: 'row' }, btn('Продолжить', closeModal, 'primary'), btn('Планшет', () => tablet()))));
  }

  // ---------- Таймер сцены ----------
  let tickAcc = 0;
  const timer = setInterval(() => {
    const st = S();
    const t = clock.now();
    if (!g3d.paused) clock.tick(0.25);
    // аккумулятор видеокамеры: ~40 игровых минут
    if (st.video.on) {
      batteryLevel = Math.max(0, batteryLevel - (0.25 / C.REAL_SEC_PER_GAME_MIN) * 2.5 * (g3d.paused ? 0 : 1));
      if (batteryLevel < 20 && !battWarn) { battWarn = true; toast(`Заряд видеокамеры ${Math.round(batteryLevel)} %${st.video.spare ? ' — есть запасной аккумулятор' : ''}`, 'bad'); }
      if (batteryLevel <= 0) { dispatch({ type: 'video.battery', level: 0 }); toast('Видеокамера разрядилась — запись остановлена! (V — сменить аккумулятор)', 'crit', 7000); }
    }
    if (t >= C.CASE.neighborIntrudesAt && !st.sceneEvents.includes('neighbor_intruded') && st.decisions.dutyGuard !== 'yes' && st.decisions.guard !== 'yes' && !st.sceneEvents.includes('neighbor_checked')) {
      dispatch({ type: 'scene.event', key: 'neighbor_intruded' });
      g3d.moveNpc('sosedka', 1.5, 0.6);
      toast('Соседка зашла в прихожую «посмотреть, как там»! Место не охраняется.', 'crit', 7000);
      setTimeout(() => g3d.moveNpc('sosedka', -0.15, -2.55), 15000);
    }
    if (t >= C.CASE.kirillArrivesAt && !st.sceneEvents.includes('kirill_arrived')) {
      dispatch({ type: 'scene.event', key: 'kirill_arrived' });
      g3d.showNpc('kirill');
      toast('На площадку поднялся племянник потерпевшего — Кирилл Ланской', 'info', 7000);
      mentor('kirill', 'Приехал племянник. Начните с разъяснения прав (ст. 51 Конституции), задавайте открытые вопросы, противоречия фиксируйте предъявлением фактов — без давления.');
    }
    // подсказки наставника
    const P = g3d.P;
    const near = (x, z, r) => Math.hypot(P.x - x, P.z - z) < r;
    if (near(1.45, -0.3, 0.7) && !st.entered && (!st.decisions.basis || !st.decisions.witnesses || !st.ppe.gloves)) mentor('door', 'Стоп на пороге: основание осмотра жилища, понятые/видео, перчатки и бахилы — в планшете (N). Изменения обстановки спросите у участкового. Ориентирующий кадр — отсюда, с площадки (F, затем 1).');
    if (st.zone === 'hall') mentor('hall', 'Статическая стадия: ничего не трогайте. Сначала обзорные кадры (F → 2), затем номерные указатели и узловая/детальная съёмка с масштабом.');
    if (near(0.76, 2.0, 1.6) && !st.evidence.ev04_shoeprint.detected) mentor('shoe', 'Осторожно у тумбы. Присядьте (C) и посветите фонарём (L) вдоль пола с 2–3 метров — косой свет выявляет следы обуви. Shift — осторожный шаг.');
    if (near(2.8, 0.9, 1.4) && !st.evidence.ev11_receipt.detected) mentor('receipt', 'Осмотрите низкие точки: под вешалкой темно — присядьте и посветите.');
    if (near(3.0, 8.0, 1.4)) mentor('balc', 'Шпингалет и стекло — вероятные места следов рук: УФ-осветитель (U) вплотную, фото, порошок, фото, плёнка. Дверь не открывайте до обработки. Снег на балконе снимите через проём; выход — только по мосткам (B).');
    if (near(5.4, 5.9, 1.3) && !st.evidence.ev08_dust.detected) mentor('dust', 'Полки стеллажа в пыли? Посветите фонарём вдоль полки.');
    if ((tickAcc += 0.25) >= 1) { tickAcc = 0; renderHud(); }
  }, 250);

  function destroy() {
    clearInterval(timer);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('mousedown', onMouse);
    hud.remove();
  }

  renderHud();
  mentor('start', 'Вы на лестничной площадке. Поговорите с участковым Беловым (E) — выясните, что изменилось до вашего прибытия, и распорядитесь об охране. Затем подготовка в планшете (N).');
  return { onTarget, toast };
}
