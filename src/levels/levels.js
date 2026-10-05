// Три уровня игры. Каждый — функция, которая строит карту через LevelGrid.
// Один экран ≈ 30 тайлов по ширине (камера показывает 480×270 точек мира).
import { LevelGrid } from './LevelGrid.js';

// ------------------------------------------------------------------ Уровень 1. Котлован
function level1() {
  const g = new LevelGrid(212, 18);
  // верх котлована → спуск на дно → подъём к воротам суда
  g.ground(0, 23, 11);
  g.ground(24, 26, 13);
  g.ground(27, 44, 14);
  g.ground(45, 48, 16); // учебная яма с дном — упасть насмерть нельзя
  g.ground(49, 73, 14);
  g.ground(74, 76, 16); // под «пустотой» неглубокая яма
  g.ground(77, 137, 14);
  g.ground(138, 140, 16);
  g.ground(141, 171, 14);
  g.ground(172, 175, 13);
  g.ground(176, 179, 12);
  g.ground(180, 211, 11);

  g.fill(18, 9, 19, 10, 'f'); // щиты опалубки — первый прыжок
  g.plat(52, 56, 11); // доска с первым документом
  g.fill(93, 12, 94, 13, 'f'); // ступеньки к плите
  g.fill(95, 10, 95, 13, 'f');
  g.fill(96, 9, 106, 9, '#'); // монолитная плита на стойках
  g.fill(97, 10, 97, 13, 'i');
  g.fill(105, 10, 105, 13, 'i');
  g.fill(118, 12, 120, 13, 'f'); // ступеньки без щели — чтобы не застрять
  g.fill(121, 10, 123, 13, 'f');
  g.plat(158, 161, 11);
  g.plat(164, 168, 8);

  // декор
  g.fill(33, 13, 34, 13, '~');
  g.fill(58, 13, 59, 13, '~');
  g.fill(88, 13, 89, 13, '~');
  g.fill(150, 13, 151, 13, '~');
  [40, 66, 112, 127, 145, 156].forEach((x) => g.put(x, 13, 'r'));
  g.fill(27, 4, 27, 13, ':'); // трос крана над котлованом
  g.fill(186, 4, 186, 10, ':');

  g.obj('start', 3, 10);
  g.obj('sheep', 10, 10);
  g.obj('wolf', 37, 13);
  g.obj('doc', 54, 10, { id: 'act' });
  g.obj('cp', 62, 13);
  g.defect('void', 74, 14, 3, 1);
  g.obj('wolf', 85, 13);
  g.defect('noproof', 101, 9, 1, 1);
  g.obj('doc', 103, 8, { id: 'scheme' });
  g.obj('hider', 114, 13, { style: 1 });
  g.obj('cp', 130, 13);
  g.defect('void', 138, 14, 3, 1);
  g.obj('sheep', 145, 13);
  g.obj('wolf', 152, 13);
  g.obj('doc', 166, 7, { id: 'journal' });
  g.obj('lawyer', 190, 10, { line: 'lawyer.gate1' });
  g.obj('gate', 197, 10);

  // обучающие подсказки (срабатывают, когда герой доходит до столбца x)
  g.obj('hint', 1, 0, { key: 'hint.l1.run' });
  g.obj('hint', 13, 0, { key: 'hint.l1.jump' });
  g.obj('hint', 25, 0, { key: 'hint.l1.beam' });
  g.obj('hint', 30, 0, { key: 'hint.l1.wolf' });
  g.obj('hint', 49, 0, { key: 'hint.l1.doc' });
  g.obj('hint', 59, 0, { key: 'hint.l1.checkpoint' });
  g.obj('hint', 68, 0, { key: 'hint.l1.defect' });
  g.obj('hint', 108, 0, { key: 'hint.l1.hider' });
  g.obj('hint', 182, 0, { key: 'hint.l1.gate' });

  return { id: 1, style: 1, grid: g, bg: ['city', 'cranes'], safePits: true };
}

// ------------------------------------------------------------------ Уровень 2. Каркас
function level2() {
  const g = new LevelGrid(232, 26);
  // A. первый этаж под перекрытием
  g.ground(0, 28, 21);
  g.fill(4, 12, 27, 12, '#');
  [6, 16, 26].forEach((x) => g.fill(x, 13, x, 20, 'c'));
  // B. проём с крюком крана
  // C.
  g.ground(36, 62, 21);
  g.fill(46, 18, 50, 20, '#');
  g.plat(54, 58, 17);
  // D. леса и перекрытие второго этажа; внизу — стена из смет
  g.ground(63, 70, 21);
  g.ground(75, 112, 21);
  g.plat(64, 68, 18);
  g.plat(69, 73, 15);
  g.plat(75, 79, 12);
  g.fill(80, 11, 108, 12, '#');
  [84, 94, 104].forEach((x) => g.fill(x, 13, x, 20, 'c'));
  g.fill(64, 19, 68, 20, 's');
  g.fill(69, 16, 73, 20, 's');
  g.fill(75, 13, 79, 20, 's');
  // леса справа: с земли обратно на перекрытие второго этажа
  g.plat(109, 112, 18);
  g.plat(109, 112, 15);
  g.plat(109, 112, 12);
  g.fill(109, 13, 112, 20, 's');
  // E. лифтовая клеть и высокое перекрытие
  g.ground(113, 115, 22);
  g.fill(116, 8, 146, 9, '#');
  g.fill(116, 10, 117, 25, '#');
  [124, 134, 144].forEach((x) => g.fill(x, 10, x, 25, 'c'));
  g.fill(127, 2, 133, 2, '#');
  g.fill(130, 3, 130, 7, 'c');
  g.fill(128, 3, 128, 7, 'x');
  // F. крюки над пропастью → площадка
  g.fill(172, 10, 188, 11, '#');
  [174, 186].forEach((x) => g.fill(x, 12, x, 25, 'c'));
  // G. земля у ворот
  g.ground(189, 231, 17);
  g.fill(194, 16, 195, 16, 'r');

  g.obj('start', 3, 20);
  g.obj('sheep', 9, 20);
  g.defect('crack', 16, 17, 1, 2);
  g.obj('wolf', 21, 20);
  g.obj('hook', 0, 0, { x0: 29, x1: 33, y: 19, w: 3, speed: 34 });
  g.obj('cp', 38, 20);
  g.obj('est', 48, 17);
  g.obj('doc', 56, 16, { id: 'contract' });
  g.obj('estwall', 84, 17, { h: 4 });
  g.defect('rebar', 92, 11, 1, 1);
  g.obj('sheep', 90, 10);
  g.obj('doc', 100, 10, { id: 'ks2' });
  g.obj('doc', 97, 20, { id: 'ks3' });
  g.obj('wolf', 101, 20);
  g.obj('lift', 0, 0, { x: 113, w: 3, yTop: 8, yBottom: 22, speed: 46 });
  g.obj('cp', 120, 7);
  g.defect('tilt', 130, 5, 1, 3);
  g.obj('wolf', 139, 7);
  g.obj('hook', 0, 0, { x0: 147, x1: 155, y: 9, w: 3, speed: 40 });
  g.obj('hook', 0, 0, { x0: 161, x1: 161, y: 7, yTo: 11, w: 3, speed: 30 });
  g.obj('hook', 0, 0, { x0: 165, x1: 169, y: 10, w: 3, speed: 36, phase: 0.5 });
  g.obj('est', 182, 9);
  g.obj('sheep', 203, 16);
  g.obj('lawyer', 213, 16, { line: 'lawyer.gate2' });
  g.obj('gate', 220, 16);

  g.obj('hint', 2, 0, { key: 'hint.l2.start' });
  g.obj('hint', 40, 0, { key: 'hint.l2.estimator' });
  g.obj('hint', 77, 0, { key: 'hint.l2.estwall', minY: 15 });
  g.obj('hint', 108, 0, { key: 'hint.l2.lift' });

  return { id: 2, style: 2, grid: g, bg: ['city', 'frames'] };
}

// ------------------------------------------------------------------ Уровень 3. Сдача объекта + босс
function level3() {
  const g = new LevelGrid(232, 17); // помещение видно целиком: от потолка до пола
  g.ground(0, 59, 15);
  g.ground(64, 74, 15);
  g.ground(78, 191, 15);
  g.fill(75, 15, 77, 15, '.'); // под «пустотой в стяжке» — подвал
  g.ground(192, 193, 14);
  g.ground(194, 231, 13); // арена босса — выше уровня воды
  // потолок (над шахтой с нотариальным протоколом — открыт)
  g.fill(0, 0, 139, 1, 'C');
  g.fill(159, 0, 231, 1, 'C');
  g.fill(231, 2, 231, 12, 'b');
  // перегородки с проёмами
  g.fill(16, 2, 16, 11, 'b');
  g.fill(52, 2, 57, 9, 'B');
  g.fill(55, 13, 57, 14, 'B');
  g.fill(112, 2, 112, 10, 'b');
  g.fill(132, 2, 133, 10, 'b');
  g.fill(176, 2, 176, 11, 'b');
  // трубы
  g.fill(30, 3, 55, 3, '-');
  g.fill(42, 4, 42, 14, '|');
  // стеллажи, коробки
  g.plat(47, 50, 11);
  g.fill(84, 13, 85, 14, 'f');
  g.fill(86, 12, 87, 14, 'f'); // лесенка из коробок
  g.fill(88, 11, 90, 14, 'f');
  g.fill(94, 13, 95, 14, 'f');
  g.plat(97, 104, 12);
  g.plat(115, 122, 12);
  g.fill(126, 13, 127, 14, 'f');
  g.plat(150, 152, 12);
  g.plat(145, 147, 9);
  g.plat(150, 153, 6);
  g.plat(164, 170, 12);
  g.fill(180, 13, 181, 14, 'f');
  // окна и светильники
  [6, 26, 66, 100, 120, 168, 186].forEach((x) => g.fill(x, 5, x, 6, 'o'));
  [10, 22, 36, 70, 92, 106, 124, 164, 182, 200, 212, 224].forEach((x) => g.put(x, 2, 'l'));

  g.obj('start', 3, 14);
  g.obj('sheep', 9, 14);
  g.obj('hider', 24, 14, { style: 3 });
  g.obj('cp', 32, 14);
  g.defect('pipe', 42, 12, 1, 2, { stopsWater: true });
  g.obj('doc', 49, 10, { id: 'letters' });
  g.defect('bath', 55, 13, 1, 2);
  g.obj('hider', 70, 14, { style: 3 });
  g.defect('screed', 75, 15, 3, 1);
  g.obj('doc', 89, 10, { id: 'photos' });
  g.obj('sheep', 101, 14);
  g.obj('hider', 108, 14, { style: 3 });
  g.obj('cp', 124, 14);
  g.obj('doc', 151, 5, { id: 'notary' });
  g.obj('sheep', 160, 14);
  g.obj('hider', 172, 14, { style: 3 });
  g.obj('lawyer', 186, 14, { line: 'lawyer.arena' });
  g.obj('cp', 190, 14);
  g.obj('arena', 197, 0, { x0: 194, x1: 231 });
  g.obj('boss', 222, 12);

  g.obj('hint', 2, 0, { key: 'hint.l3.start' });
  g.obj('hint', 138, 0, { key: 'hint.l3.notary' });

  return { id: 3, style: 3, grid: g, bg: ['interior'], water: true, ceiling: true };
}

export const LEVELS = { 1: level1, 2: level2, 3: level3 };
export const LEVEL_COUNT = 3;
