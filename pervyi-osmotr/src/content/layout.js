// Геометрия квартиры № 7 (ул. Заречная, 14). 1 единица = 1 метр.
// x — на восток, z — на юг, y — вверх. Используется и 3D-сценой, и картой в разборе.

export const CEILING = 2.6;

// Стены: отрезок по оси с проёмами [from, to].
export const WALLS = [
  { axis: 'z', at: 0, from: -1.8, to: 6.2, gaps: [[1.0, 1.9]] }, // входная
  { axis: 'x', at: 0, from: 0, to: 4, gaps: [[1.2, 1.9]] }, // прихожая | санузел
  { axis: 'x', at: 3, from: 0, to: 4, gaps: [[2.5, 3.3]] }, // прихожая | кухня
  { axis: 'z', at: 4, from: -1.8, to: 6.2, gaps: [[0.9, 1.8]] }, // прихожая | комната
  { axis: 'x', at: -1.8, from: 0, to: 8.6, gaps: [] },
  { axis: 'x', at: 6.2, from: 0, to: 8.6, gaps: [] },
  { axis: 'z', at: 8.6, from: -1.8, to: 6.2, gaps: [[2.6, 3.4]], window: [3.9, 5.1] }, // балконная
  // лестничная площадка
  { axis: 'x', at: -0.6, from: -3.2, to: 0, gaps: [] },
  { axis: 'x', at: 3.6, from: -3.2, to: 0, gaps: [] },
  { axis: 'z', at: -3.2, from: -0.6, to: 3.6, gaps: [] },
];

// Ограждение балкона (низкое, но непроходимое).
export const RAILINGS = [
  { axis: 'z', at: 9.8, from: 1.2, to: 5.2 },
  { axis: 'x', at: 1.2, from: 8.6, to: 9.8 },
  { axis: 'x', at: 5.2, from: 8.6, to: 9.8 },
];

export const ZONES = [
  { id: 'landing', name: 'Лестничная площадка', rect: [-0.6, -3.2, 3.6, 0] },
  { id: 'hall', name: 'Прихожая', rect: [0, 0, 3, 4] },
  { id: 'bath', name: 'Санузел', rect: [-1.8, 0, 0, 4] },
  { id: 'kitchen', name: 'Кухня', rect: [3, 0, 6.2, 4] },
  { id: 'room', name: 'Комната', rect: [-1.8, 4, 6.2, 8.6] },
  { id: 'balcony', name: 'Балкон', rect: [1.2, 8.6, 5.2, 9.8] },
];
export const APARTMENT_ZONES = ['hall', 'bath', 'kitchen', 'room', 'balcony'];

// Хрупкие зоны: шаг без мостков повреждает связанные улики.
export const FRAGILE_ZONES = [
  { id: 'FZ_hall', rect: [0.5, 1.7, 1.02, 2.3], evidence: ['ev04_shoeprint'], msg: 'Вы наступили на участок пола со следом обуви!' },
  { id: 'FZ_balcony', rect: [1.2, 8.62, 5.2, 9.8], evidence: ['ev02_snow', 'ev01_glass'], msg: 'Вы вышли на балкон без мостков: снег затоптан, осколки сдвинуты.' },
];

// Неподвижные ориентиры для привязок (LM_).
export const LANDMARKS = [
  { id: 'LM_entry', name: 'левый косяк входной двери', pos: [1.0, 0] },
  { id: 'LM_bathdoor', name: 'косяк двери санузла', pos: [0, 1.2] },
  { id: 'LM_kitchendoor', name: 'косяк двери кухни', pos: [3, 2.5] },
  { id: 'LM_roomdoor', name: 'левый косяк двери в комнату', pos: [0.9, 4] },
  { id: 'LM_ne_room', name: 'северо-восточный угол комнаты', pos: [6.2, 4] },
  { id: 'LM_balcdoor', name: 'левый косяк балконной двери', pos: [2.6, 8.6] },
  { id: 'LM_se_room', name: 'юго-восточный угол комнаты', pos: [6.2, 8.6] },
  { id: 'LM_nw_kitchen', name: 'северо-восточный угол кухни', pos: [6.2, 0] },
];

export const SPAWN = { pos: [1.5, -2.3], yaw: Math.PI }; // смотрит на юг, на дверь

export function zoneAt(x, z) {
  for (const zn of ZONES) {
    const [x1, z1, x2, z2] = zn.rect;
    if (x >= x1 && x <= x2 && z >= z1 && z <= z2) return zn.id;
  }
  return 'outside';
}
