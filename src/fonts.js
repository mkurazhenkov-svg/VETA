// Встраивание шрифтов прямо в файл игры (без интернета).
// Сейчас: Manrope (замена фирменного Museo Sans Cyrl) и Pixelify Sans для счётчиков. Оба — OFL.
// Чтобы поставить фирменный шрифт, достаточно добавить его файлы в список FACES ниже
// и поменять имя в FONT_MAIN (src/brand.js).
import manrope500c from '@fontsource/manrope/files/manrope-cyrillic-500-normal.woff2?inline';
import manrope500l from '@fontsource/manrope/files/manrope-latin-500-normal.woff2?inline';
import manrope700c from '@fontsource/manrope/files/manrope-cyrillic-700-normal.woff2?inline';
import manrope700l from '@fontsource/manrope/files/manrope-latin-700-normal.woff2?inline';
import manrope800c from '@fontsource/manrope/files/manrope-cyrillic-800-normal.woff2?inline';
import manrope800l from '@fontsource/manrope/files/manrope-latin-800-normal.woff2?inline';
import pixel500c from '@fontsource/pixelify-sans/files/pixelify-sans-cyrillic-500-normal.woff2?inline';
import pixel500l from '@fontsource/pixelify-sans/files/pixelify-sans-latin-500-normal.woff2?inline';
import pixel700c from '@fontsource/pixelify-sans/files/pixelify-sans-cyrillic-700-normal.woff2?inline';
import pixel700l from '@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2?inline';

const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const LAT =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

const FACES = [
  ['Manrope', '500', manrope500c, CYR],
  ['Manrope', '500', manrope500l, LAT],
  ['Manrope', '700', manrope700c, CYR],
  ['Manrope', '700', manrope700l, LAT],
  ['Manrope', '800', manrope800c, CYR],
  ['Manrope', '800', manrope800l, LAT],
  ['Pixelify Sans', '500', pixel500c, CYR],
  ['Pixelify Sans', '500', pixel500l, LAT],
  ['Pixelify Sans', '700', pixel700c, CYR],
  ['Pixelify Sans', '700', pixel700l, LAT],
];

export async function loadFonts() {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  const jobs = FACES.map(async ([family, weight, url, range]) => {
    try {
      const face = new FontFace(family, `url(${url}) format('woff2')`, { weight, unicodeRange: range });
      await face.load();
      document.fonts.add(face);
    } catch (err) {
      console.warn('Шрифт не загрузился, используется системный:', family, weight, err);
    }
  });
  // Не ждём дольше 3 секунд: игра должна запуститься в любом случае.
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 3000))]);
}
