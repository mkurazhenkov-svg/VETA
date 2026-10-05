// Фирменная палитра VETA (руководство по фирменному стилю, Flavita, 09.2019).
// Перед финальной сборкой сверить с актуальными файлами дизайнера (DECISIONS.md, открытый вопрос 1).
// Файл без зависимостей: его читают и игра, и скрипт генерации спрайта героя.

export const BRAND = {
  blueDeep: 0x024f99, // основной фон носителей: меню, экраны, небо (с затемнением)
  blue: 0x0c5eaa, // платформы, интерфейс, подсветка
  red: 0xe51a3c, // только «галочка» и акценты: чекпоинты, луч, урон, CTA
  black: 0x1a1a1a, // текст, контуры
  gray: 0xe5e5e4, // бетон, подложки, рамки на светлом
  white: 0xffffff, // текст на синем
};

// Производные оттенки (светлее/темнее базовых на 10–30 %). Только они допускаются в пиксель-арте.
export const SHADE = {
  blueNight: 0x01376b, // blueDeep −30 %: ночное небо
  blueDusk: 0x02447f, // blueDeep −15 %
  blueDeepLight: 0x2869a8, // blueDeep +15 %
  blueDark: 0x084277, // blue −30 %
  blueMid: 0x0a5499, // blue −10 %
  blueLight: 0x3d7ebb, // blue +20 %
  blueLighter: 0x558ec4, // blue +30 %
  redDark: 0xa0122a, // red −30 %
  redLight: 0xed5f77, // red +30 %
  grayLight: 0xcececd, // gray −10 %
  grayMid: 0xb7b7b6, // gray −20 %
  grayDark: 0xa0a09f, // gray −30 %
  blackSoft: 0x313131, // black +10 %
  blackMid: 0x484848, // black +20 %
  blackLight: 0x5f5f5f, // black +30 %
};

// Оттенки кожи — только для лиц (герой, NPC, портреты).
export const SKIN = [0xf3cdb0, 0xe0aa86, 0xc48663, 0x8f5a40];

export const ALL_COLORS = { ...BRAND, ...SHADE };

export function hex(color) {
  return '#' + color.toString(16).padStart(6, '0');
}

export function rgba(color, alpha) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
