// Титул и пролог «Дежурная часть».
import { h } from './dom.js';

export function titleScreen(root, onStart) {
  let mode = 'training';
  const modeBtn = (id, label, desc) => h('label', { class: 'mode' },
    h('input', { type: 'radio', name: 'mode', value: id, checked: id === mode, onchange: () => (mode = id) }),
    h('b', {}, label), h('span', {}, desc));
  const el = h('div', { class: 'screen title' },
    h('div', { class: 'title-card' },
      h('div', { class: 'kicker' }, 'Учебный симулятор · демо-прототип'),
      h('h1', {}, 'Первый осмотр'),
      h('h2', {}, 'Дело на Заречной · Эпизод 1 «Квартира»'),
      h('p', { class: 'lead' }, 'Вы — следователь. Проведите осмотр места происшествия, получите объяснения, зафиксируйте и изымите следы, составьте протокол. Оценивается не «кто виноват», а насколько процессуально и тактически грамотно собраны доказательства.'),
      h('div', { class: 'modes' },
        modeBtn('training', 'Обучение', 'подсказки наставника'),
        modeBtn('exam', 'Экзамен', 'без подсказок')),
      h('button', { class: 'btn big', onclick: () => { el.remove(); onStart(mode); } }, 'Начать дежурство'),
      h('div', { class: 'controls' },
        h('b', {}, 'Управление: '),
        'WASD — ходьба · мышь — обзор · Shift — осторожный шаг · C — присесть · E — действие с объектом · F — фотоаппарат · L — фонарь · U — УФ-осветитель · B — мостки · V — видеозапись · G — сменить перчатки · N — планшет · Tab — чемодан · Esc — пауза'),
      h('p', { class: 'fine' }, 'Город, люди и события вымышлены. Нормы и методики — черновик, требуют утверждения кафедрой.')));
  root.append(el);
}

export function prologueScreen(root, C, onDone) {
  const sel = new Set(['gloves', 'shoecovers', 'camera', 'flashlight']);
  const team = new Set(['specialist']);
  let dutyGuard = false;
  const used = () => [...sel].reduce((a, id) => a + C.EQUIPMENT.find((e) => e.id === id).slots, 0);
  const counter = h('div', { class: 'cap' });
  const list = h('div', { class: 'equip' });

  function renderList() {
    list.innerHTML = '';
    const groups = [...new Set(C.EQUIPMENT.map((e) => e.group))];
    for (const g of groups) {
      list.append(h('div', { class: 'eq-group' }, g));
      for (const e of C.EQUIPMENT.filter((x) => x.group === g)) {
        const viaSpec = e.specialist && team.has('specialist');
        const on = sel.has(e.id);
        list.append(h('button', {
          class: 'eq' + (on ? ' on' : '') + (viaSpec ? ' spec' : ''),
          title: e.desc,
          onclick: () => {
            if (viaSpec) return;
            if (on) sel.delete(e.id);
            else if (used() + e.slots <= C.SUITCASE_CAPACITY) sel.add(e.id);
            renderList();
          },
        }, h('span', { class: 'slots' }, '▮'.repeat(e.slots)), h('b', {}, e.name), h('small', {}, viaSpec ? 'в чемодане специалиста' : e.desc)));
      }
    }
    const u = used();
    counter.textContent = `Мест в чемодане: ${u} / ${C.SUITCASE_CAPACITY}`;
    counter.className = 'cap' + (u >= C.SUITCASE_CAPACITY ? ' full' : '');
  }

  const teamBox = h('div', { class: 'team' }, C.TEAM_OPTIONS.map((t) => h('label', { class: 'chk' },
    h('input', { type: 'checkbox', checked: team.has(t.id), onchange: (e) => { e.target.checked ? team.add(t.id) : team.delete(t.id); renderList(); } }),
    h('b', {}, t.name), h('small', {}, t.desc))));

  const el = h('div', { class: 'screen prologue' },
    h('div', { class: 'pro-left' },
      h('div', { class: 'kicker' }, 'Пролог · Дежурная часть · 07:45'),
      h('h2', {}, 'Сообщение о происшествии'),
      h('div', { class: 'report' }, h('div', { class: 'stamp' }, C.CASE.kusp), C.CASE.report),
      h('h3', {}, 'Указание дежурному'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', onchange: (e) => (dutyGuard = e.target.checked) }),
        h('b', {}, 'Поручить участковому до прибытия СОГ обеспечить охрану места происшествия'), h('small', {}, 'никого не впускать, ничего не трогать')),
      h('h3', {}, 'Состав следственно-оперативной группы'),
      teamBox,
      h('button', { class: 'btn big', onclick: () => { el.remove(); onDone({ items: [...sel, ...(team.has('specialist') ? C.SPECIALIST_KIT : [])], team: [...team], dutyGuard }); } }, 'Выезд на место →')),
    h('div', { class: 'pro-right' },
      h('h2', {}, 'Криминалистический чемодан'),
      h('p', { class: 'fine' }, 'Забытое оборудование на месте будет недоступно. Наведите на предмет, чтобы прочитать назначение.'),
      counter, list));
  renderList();
  root.append(el);
}
