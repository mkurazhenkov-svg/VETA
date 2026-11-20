// Эпилог «Кабинет»: фототаблица → протокол → версии и исследования.
import { h, fmtTime } from './dom.js';
import { PHOTO_KINDS } from '../domain/photo-judge.js';

export function epilogue(root, { C, store, thumbs, clock, onSubmit }) {
  const st = store.state;
  const E = Object.fromEntries(C.EVIDENCE.map((e) => [e.id, e]));
  const el = h('div', { class: 'screen office' });
  root.append(el);

  // порядок по времени первого взаимодействия
  const firstSeen = {};
  for (const ev of store.log) if (ev.id && E[ev.id] && firstSeen[ev.id] === undefined && ['evidence.inspected', 'marker.placed', 'evidence.collected'].includes(ev.type)) firstSeen[ev.id] = ev.t;
  for (const p of st.photos) for (const c of p.credits) if (E[c.id] && firstSeen[c.id] === undefined) firstSeen[c.id] = p.t;

  const doc = {
    photoOrder: st.photos.map((p) => p.photoId),
    blocks: Object.keys(firstSeen).sort((a, b) => firstSeen[a] - firstSeen[b]).map((evId) => ({ evId, wording: 'neutral', on: true })),
    changesIncluded: false, freeText: '', presented: false, hypothesis: null, hypFacts: [], exams: {},
  };
  // порядок вариантов формулировки перемешан, чтобы не подсказывать
  const flip = Object.fromEntries(doc.blocks.map((b, i) => [b.evId, i % 2 === 1]));

  const stepper = h('div', { class: 'stepper' });
  const body = h('div', { class: 'office-body' });
  el.append(h('div', { class: 'office-head' }, h('div', { class: 'kicker' }, `Эпилог · Кабинет · ${fmtTime(clock.now())}`), h('h2', {}, 'Документы по материалу ' + C.CASE.kusp), stepper), body);

  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  let step = 0;
  const steps = ['Фототаблица', 'Протокол осмотра', 'Версии и исследования'];
  function go(n) {
    step = n;
    stepper.innerHTML = '';
    steps.forEach((s, i) => stepper.append(h('span', { class: 'st' + (i === step ? ' on' : i < step ? ' done' : '') }, `${i + 1}. ${s}`)));
    body.innerHTML = '';
    [photoTable, protocol, versions][step]();
    window.scrollTo(0, 0);
  }

  function photoTable() {
    const list = h('div', { class: 'ptable' });
    const render = () => {
      list.innerHTML = '';
      doc.photoOrder.forEach((pid, i) => {
        const p = st.photos.find((x) => x.photoId === pid);
        list.append(h('div', { class: 'prow' + (p.ok ? '' : ' bad') },
          h('div', { class: 'pnum' }, `Фото ${i + 1}`),
          h('img', { src: thumbs[pid] }),
          h('div', { class: 'pcap' }, h('b', {}, PHOTO_KINDS[p.declaredKind] + ' снимок'), h('br'),
            p.credits.length ? p.credits.map((c) => (c.id === '_scene' ? 'Подъезд и вход в кв. 7' : E[c.id].title)).slice(0, 3).join('; ') : h('i', {}, 'Кадр не засчитан: ' + (p.issues[0] ?? '')),
            h('br'), h('small', {}, `${fmtTime(p.t)} · ${Math.round(p.focal)} мм`)),
          h('div', { class: 'pbtns' },
            h('button', { class: 'btn sm', onclick: () => { move(doc.photoOrder, i, -1); render(); } }, '↑'),
            h('button', { class: 'btn sm', onclick: () => { move(doc.photoOrder, i, 1); render(); } }, '↓'),
            h('button', { class: 'btn sm', title: 'Исключить из фототаблицы', onclick: () => { doc.photoOrder.splice(i, 1); render(); } }, '✕'))));
      });
      if (!doc.photoOrder.length) list.append(h('p', {}, 'Снимков нет — фототаблица пуста.'));
    };
    render();
    body.append(h('p', { class: 'fine' }, 'Упорядочьте снимки и исключите брак. Принцип — от общего к частному: ориентирующие → обзорные → узловые → детальные.'), list,
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => go(1) }, 'Далее: протокол →')));
  }

  function protocol() {
    const startT = store.log.find((e) => e.type === 'player.zone' && C.APARTMENT_ZONES.includes(e.zone))?.t;
    const team = ['следователь', ...st.team.map((t) => ({ specialist: 'специалист-криминалист', operative: 'оперуполномоченный', k9: 'кинолог' }[t]))];
    const tech = ['camera', 'video', 'flashlight', 'uv', 'magnifier', 'tape', 'scales', 'markers'].filter((i) => st.items.includes(i)).map((i) => C.EQUIPMENT.find((e) => e.id === i).name.toLowerCase());
    const changes = ['f_officer_route', 'f_officer_bath', 'f_medics_left', 'f_neigh_touched'].filter((f) => st.facts.includes(f)).map((f) => C.FACTS[f].text);
    const blocksBox = h('div', { class: 'blocks' });
    const renderBlocks = () => {
      blocksBox.innerHTML = '';
      doc.blocks.forEach((b, i) => {
        const e = E[b.evId];
        const es = st.evidence[b.evId];
        const tail = [
          es.measured ? `Привязка: ${es.measured.refs.map((r) => `${(r.d * 100).toFixed(1)} см до ${r.name}`).join(', ')}.` : '',
          es.marker ? `Обозначен указателем № ${es.marker}.` : '',
          es.collected && !es.collected.noTouch ? `Изъят: ${e.collect.methods.find((m) => m.id === es.collected.method)?.label.toLowerCase()}; упакован: ${es.collected.pack ? C.PACKS[es.collected.pack].label.toLowerCase() : '—'}.` : '',
        ].filter(Boolean).join(' ');
        const opts = [['neutral', e.protocol.neutral]];
        if (e.protocol.conclusion) opts.push(['conclusion', e.protocol.conclusion]);
        if (flip[b.evId]) opts.reverse();
        blocksBox.append(h('div', { class: 'block' + (b.on ? '' : ' off') },
          h('div', { class: 'bhead' },
            h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: b.on, onchange: (ev) => { b.on = ev.target.checked; renderBlocks(); } }), h('b', {}, e.title)),
            h('span', {}, h('button', { class: 'btn sm', onclick: () => { move(doc.blocks, i, -1); renderBlocks(); } }, '↑'), h('button', { class: 'btn sm', onclick: () => { move(doc.blocks, i, 1); renderBlocks(); } }, '↓'))),
          opts.length > 1
            ? opts.map(([k, txt]) => h('label', { class: 'chk wording' }, h('input', { type: 'radio', name: 'w_' + b.evId, checked: b.wording === k, onchange: () => (b.wording = k) }), txt))
            : h('p', {}, opts[0][1]),
          tail ? h('p', { class: 'tail' }, tail) : null));
      });
      if (!doc.blocks.length) blocksBox.append(h('p', {}, 'Вы не осмотрели ни одного объекта.'));
    };
    renderBlocks();
    body.append(
      h('div', { class: 'proto-paper' },
        h('h3', {}, 'ПРОТОКОЛ осмотра места происшествия'),
        h('p', {}, `г. Нижнереченск, ${C.CASE.date}. Осмотр начат в ${startT ? fmtTime(startT) : '—'}, окончен в ${fmtTime(clock.now())}.`),
        h('p', {}, `Место: ${C.CASE.address}. Участники: ${team.join(', ')}. ${st.decisions.witnesses === 'yes' ? 'С участием двух понятых.' : 'Без участия понятых, с применением видеозаписи (ч. 1.1 ст. 170 УПК РФ).'}`),
        h('p', {}, `Применялись: ${tech.join(', ') || '—'}. Освещение искусственное.`),
        h('h4', {}, 'Изменения обстановки до начала осмотра'),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', onchange: (e) => (doc.changesIncluded = e.target.checked) }), changes.length ? `Отразить: ${changes.join('; ')}.` : 'Сведений об изменениях обстановки не получено.'),
        h('h4', {}, 'Описательная часть'),
        h('p', { class: 'fine' }, 'Включите описанные объекты, расположите в порядке осмотра, выберите формулировку. Протокол описывает, а не оценивает.'),
        blocksBox,
        h('h4', {}, 'Дополнительные сведения (свободный текст)'),
        h('textarea', { rows: 3, placeholder: 'Например: окна закрыты, на подоконнике…', oninput: (e) => (doc.freeText = e.target.value) }),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', onchange: (e) => (doc.presented = e.target.checked) }), 'Всё обнаруженное и изъятое предъявлено участникам осмотра; протокол прочитан, замечаний не поступило; подписи.')),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go(0) }, '← Фототаблица'), h('button', { class: 'btn primary', onclick: () => go(2) }, 'Далее: версии →')));
  }

  function versions() {
    const collected = C.EVIDENCE.filter((e) => st.evidence[e.id].collected && !st.evidence[e.id].collected.noTouch);
    body.append(
      h('h3', {}, 'Основная версия'),
      h('div', { class: 'opts' }, C.HYPOTHESES.map((hy) => h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'hyp', checked: doc.hypothesis === hy.id, onchange: () => (doc.hypothesis = hy.id) }), hy.text))),
      h('h3', {}, 'Факты в обоснование версии'),
      h('div', { class: 'opts cols' }, st.facts.map((f) => h('label', { class: 'chk' + (C.FACTS[f].tainted ? ' tainted' : '') }, h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? doc.hypFacts.push(f) : doc.hypFacts.splice(doc.hypFacts.indexOf(f), 1); } }), h('span', { class: 'src' }, C.FACTS[f].src), C.FACTS[f].text))),
      h('h3', {}, 'Направление объектов на исследование'),
      collected.length ? h('table', { class: 'reg exams' }, collected.map((e) => h('tr', {}, h('td', {}, e.title),
        h('td', {}, Object.entries(C.EXAMS).map(([k, v]) => h('label', { class: 'chk inline' }, h('input', { type: 'checkbox', onchange: (ev) => { const a = (doc.exams[e.id] ??= []); ev.target.checked ? a.push(k) : a.splice(a.indexOf(k), 1); } }), v)))))) : h('p', {}, 'Изъятых объектов нет.'),
      h('p', { class: 'fine' }, 'Соответствие «объект → вид исследования» — черновик, утверждает кафедра.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go(1) }, '← Протокол'),
        h('button', { class: 'btn primary big', onclick: () => {
          const out = { ...doc, blocks: doc.blocks.filter((b) => b.on).map(({ evId, wording }) => ({ evId, wording })) };
          el.remove();
          onSubmit(out);
        } }, 'Сдать материал руководителю')));
  }
  go(0);
}
