// Экран разбора: оценка, нарушения, карта пропущенного, лента сессии, раскрытие истины, экспорт.
import { h, fmtTime } from './dom.js';
import { OUTCOMES } from '../domain/evaluate.js';
import { checksum } from '../domain/store.js';

const CRIT = { procedure: 'Процессуальная корректность', completeness: 'Полнота выявления и изъятия', photo: 'Качество фиксации', interview: 'Опрос', protocol: 'Протокол и версии' };
const SEV = { critical: 'критическое', major: 'существенное', minor: 'незначительное' };
const STATUS = { ok: ['#3fb27f', 'изъят / зафиксирован верно'], partial: ['#e0b04c', 'частично'], found: ['#e0b04c', 'найден, не изъят'], flawed: ['#e07b39', 'изъят с нарушением'], contaminated: ['#e07b39', 'загрязнён'], damaged: ['#d9534f', 'повреждён'], missed: ['#8a8f98', 'не обнаружен'] };

export function debrief(root, { C, store, result: r, thumbs }) {
  const W = C.SCORE.weights;
  const o = OUTCOMES[r.outcome];
  const el = h('div', { class: 'screen debrief' });
  root.append(el);

  el.append(h('div', { class: 'deb-head outcome-' + r.outcome },
    h('div', { class: 'score' }, h('b', {}, r.total), h('span', {}, '/ 100')),
    h('div', {}, h('div', { class: 'kicker' }, 'Разбор · руководитель следственного органа'), h('h2', {}, o.title), h('p', {}, o.text),
      h('p', {}, h('b', {}, 'Отметка: '), r.grade, r.cap ? ` · оценка ограничена потолком ${r.cap} (${r.cap === C.SCORE.criticalCap ? 'критическое нарушение' : 'два существенных нарушения по одной улике'})` : ''))));

  el.append(h('section', {}, h('h3', {}, 'Критерии'),
    Object.entries(CRIT).map(([k, label]) => h('div', { class: 'crit' },
      h('span', { class: 'cl' }, label),
      h('div', { class: 'cbar' }, h('div', { style: { width: (r.scores[k] / W[k]) * 100 + '%' } })),
      h('span', { class: 'cv' }, `${r.scores[k].toFixed(1)} / ${W[k]}`)))));

  // карта
  el.append(h('section', {}, h('h3', {}, 'Карта осмотра'), mapSVG(C, store, r),
    h('div', { class: 'legend' }, Object.entries(STATUS).map(([, [c, l]]) => h('span', {}, h('i', { style: { background: c } }), l)),
      h('span', {}, h('i', { style: { background: '#4aa3ff' } }), 'ваш маршрут'), h('span', {}, h('i', { style: { background: '#f2c230' } }), 'точки съёмки'))));

  // лента
  el.append(h('section', {}, h('h3', {}, 'Лента сессии'), timeline(store.log, r), h('p', { class: 'fine' }, 'В полной версии клик по метке включает повтор момента в 3D. Журнал детерминирован: повтор восстанавливается из него целиком.')));

  // нарушения
  el.append(h('section', {}, h('h3', {}, `Нарушения (${r.violations.length})`),
    r.violations.length ? r.violations.map((v) => h('div', { class: 'vcard ' + v.severity },
      h('div', { class: 'vhead' }, h('b', {}, v.title), h('span', { class: 'sev' }, `${SEV[v.severity]} · −${v.penalty}`), h('span', { class: 'vt' }, fmtTime(v.t))),
      v.detail ? h('p', { class: 'vd' }, v.detail) : null,
      h('p', {}, h('b', {}, 'Как правильно: '), v.explain),
      h('p', { class: 'src' }, v.source))) : h('p', {}, 'Нарушений не выявлено.')));

  // протокол
  el.append(h('section', {}, h('h3', {}, 'Протокол и версии'), h('ul', {}, r.proto.notes.map((n) => h('li', {}, n)))));

  // фототаблица
  const photos = store.state.photos;
  el.append(h('section', {}, h('h3', {}, `Снимки (${photos.length})`), h('div', { class: 'gallery' }, photos.map((p) => h('figure', { class: p.ok ? 'ok' : 'bad' }, h('img', { src: thumbs[p.photoId] }), h('figcaption', {}, p.ok ? '✓ засчитан' : '✗ ' + (p.issues[0] ?? '')))))));

  // истина
  const truthBox = h('div', { class: 'truth hidden' }, C.TRUTH.map((t, i) => h('div', { class: 'tpanel', style: { animationDelay: i * 0.15 + 's' } }, h('div', { class: 'tt' }, t.time), h('p', {}, t.text))));
  const log = store.log;
  const sum = checksum(log);
  el.append(h('section', {}, h('h3', {}, 'Что произошло на самом деле'),
    h('p', { class: 'fine' }, 'Преподаватель может скрыть этот блок, чтобы вариант истины не разошёлся по группе.'),
    h('button', { class: 'btn', onclick: (e) => { truthBox.classList.remove('hidden'); e.target.remove(); } }, 'Раскрыть истину'), truthBox));

  el.append(h('div', { class: 'row end' },
    h('button', { class: 'btn', onclick: () => {
      const blob = new Blob([JSON.stringify({ app: 'pervyi-osmotr', version: '0.1.0', case: 'zarechnaya', variant: 'A', checksum: sum, result: { total: r.total, outcome: r.outcome, scores: r.scores, violations: r.violations.map((v) => v.ruleId) }, log }, null, 1)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `osmotr-zarechnaya-${sum}.json` });
      a.click();
    } }, 'Скачать журнал (JSON)'),
    h('button', { class: 'btn', onclick: () => window.print() }, 'Печать / PDF'),
    h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Пройти заново')),
    h('p', { class: 'fine' }, `Контрольная сумма журнала: ${sum} · событий: ${log.length}. Режим преподавателя пересчитывает оценку из журнала — ручная правка файла обнаружится.`));
}

function mapSVG(C, store, r) {
  const sx = (x) => (x + 1.9) * 60, sz = (z) => (z + 3.3) * 60;
  const parts = [];
  for (const zn of C.ZONES) {
    const [x1, z1, x2, z2] = zn.rect;
    parts.push(`<rect x="${sx(x1)}" y="${sz(z1)}" width="${(x2 - x1) * 60}" height="${(z2 - z1) * 60}" fill="${zn.id === 'balcony' ? '#e9eef4' : zn.id === 'landing' ? '#d8dcd6' : '#f6f1e7'}"/>`);
    parts.push(`<text x="${sx((x1 + x2) / 2)}" y="${sz(z1) + 16}" text-anchor="middle" class="zl">${zn.name}</text>`);
  }
  for (const w of C.WALLS) {
    let cur = w.from;
    for (const [g1, g2] of [...w.gaps, ...(w.window ? [w.window] : [])].sort((a, b) => a[0] - b[0])) { parts.push(seg(w, cur, g1)); cur = g2; }
    parts.push(seg(w, cur, w.to));
  }
  function seg(w, a, b) {
    return w.axis === 'z' ? `<line x1="${sx(a)}" y1="${sz(w.at)}" x2="${sx(b)}" y2="${sz(w.at)}" class="wl"/>` : `<line x1="${sx(w.at)}" y1="${sz(a)}" x2="${sx(w.at)}" y2="${sz(b)}" class="wl"/>`;
  }
  for (const fz of C.FRAGILE_ZONES) { const [x1, z1, x2, z2] = fz.rect; parts.push(`<rect x="${sx(x1)}" y="${sz(z1)}" width="${(x2 - x1) * 60}" height="${(z2 - z1) * 60}" fill="none" stroke="#d9534f" stroke-dasharray="4 3"/>`); }
  const track = store.log.filter((e) => e.type === 'player.track').map((e) => `${sx(e.x)},${sz(e.z)}`).join(' ');
  if (track) parts.push(`<polyline points="${track}" fill="none" stroke="#4aa3ff" stroke-width="2" stroke-opacity="0.7"/>`);
  for (const p of store.state.photos) {
    const { x, z, yaw } = p.cam;
    parts.push(`<circle cx="${sx(x)}" cy="${sz(z)}" r="3.5" fill="#f2c230" stroke="#333"/><line x1="${sx(x)}" y1="${sz(z)}" x2="${sx(x - Math.sin(yaw) * 0.35)}" y2="${sz(z - Math.cos(yaw) * 0.35)}" stroke="#b8860b" stroke-width="2"/>`);
  }
  for (const e of C.EVIDENCE) {
    const [c, l] = STATUS[r.evStatus[e.id]] ?? STATUS.missed;
    const label = e.kind === 'false' ? 'Л' : e.n;
    parts.push(`<g><title>${e.title}: ${l}</title><circle cx="${sx(e.pos[0])}" cy="${sz(e.pos[2])}" r="9" fill="${c}" stroke="#111" stroke-width="1.5"/><text x="${sx(e.pos[0])}" y="${sz(e.pos[2]) + 4}" text-anchor="middle" class="el">${label}</text></g>`);
  }
  const el = h('div', { class: 'map' });
  el.innerHTML = `<svg viewBox="0 0 ${8.4 * 60} ${13.4 * 60}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}<text x="12" y="20" class="zl">N ↑</text></svg>`;
  return el;
}

function timeline(log, r) {
  const evs = log.filter((e) => ['photo.taken', 'evidence.collected', 'evidence.detected', 'dialogue.choice', 'player.stepped', 'door.opened', 'scene.event'].includes(e.type));
  const t0 = log.find((e) => e.type !== 'prologue.done')?.t ?? 0;
  const t1 = Math.max(t0 + 1, ...log.map((e) => e.t ?? 0));
  const X = (t) => ((t - t0) / (t1 - t0)) * 100;
  const box = h('div', { class: 'timeline' });
  const color = { 'photo.taken': '#4aa3ff', 'evidence.collected': '#3fb27f', 'evidence.detected': '#a0e07a', 'dialogue.choice': '#b58fe0', 'scene.event': '#e0b04c' };
  const label = (e) => ({ 'photo.taken': 'снимок', 'evidence.collected': 'изъятие', 'evidence.detected': 'выявлен след', 'dialogue.choice': 'реплика', 'player.stepped': 'шаг по хрупкой зоне', 'door.opened': 'открыта дверь', 'scene.event': e.key }[e.type]);
  for (const e of evs) box.append(h('i', { class: 'tm', style: { left: X(e.t) + '%', background: color[e.type] ?? '#888' }, title: `${fmtTime(e.t)} — ${label(e)}` }));
  for (const v of r.violations) box.append(h('i', { class: 'tm v ' + v.severity, style: { left: Math.min(99.5, X(v.t)) + '%' }, title: `${fmtTime(v.t)} — ⚠ ${v.title}` }, '!'));
  box.append(h('span', { class: 't0' }, fmtTime(t0)), h('span', { class: 't1' }, fmtTime(t1)));
  return box;
}
