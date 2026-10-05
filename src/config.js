// Настройки, которые можно менять без программиста: одна строка — одна настройка.

// Портрет А. Терентьева на герое. true — голова из фото (если фото обработано скриптом
// `npm run sprite`), false — обезличенный «Прораб». Если фото нет, игра сама берёт «Прораба».
export const USE_PORTRAIT = true;

// Кнопка «Разобрать мой спор» на финальном экране. Сейчас заглушка — сайт VETA.
// Заменить на лендинг, Telegram-бота или форму (открытый вопрос 5).
export const CTA_URL = 'https://www.veta.expert/';
export const CTA_UTM = { utm_source: 'game', utm_campaign: 'wolves' };

// Ссылка для кнопки «Поделиться», когда игра открыта из файла (а не с сайта).
export const SHARE_URL = 'https://www.veta.expert/';

// Контакты на финальном экране. Перед публикацией сверить.
export const CONTACTS = {
  phone: '8 800 775-04-99',
  phoneHref: 'tel:88007750499',
  site: 'www.veta.expert',
  siteUrl: 'https://www.veta.expert/',
};

// Баланс игры.
export const BALANCE = {
  health: 3, // касок в обычном режиме
  healthEasy: 5, // касок в лёгком режиме
  beamCooldownMs: 600, // перезарядка луча
  beamRangeTiles: 6, // длина луча в тайлах
  exposedMs: 3000, // сколько волк остаётся без шкуры
  docHintMs: 2000, // сколько секунд висит подсказка «зачем нужен документ»
  coyoteMs: 100, // прыжок «с запасом» после схода с края
  jumpBufferMs: 100, // буфер нажатия прыжка
  // Ворота суда: сколько документов нужно, чтобы пройти.
  gates: {
    1: { scope: 'level', need: 2 }, // уровень 1: 2 из 3 документов уровня
    2: { scope: 'total', need: 5 }, // уровень 2: всего в папке 5 из 6 (см. DECISIONS.md)
  },
  bossNeed: 7, // полный пакет для победы над боссом: 7 из 9
  waterDelayMs: 40000, // через сколько начинает подниматься вода на уровне 3
  waterSpeed: 2.2, // скорость подъёма воды, пикселей в секунду
  parTime: { 1: 150, 2: 190, 3: 220 }, // «нормативное» время уровня, сек — для бонуса за время
  timeBonusPerSec: 10,
  score: { wolf: 100, defect: 150, doc: 200, boss: 500 },
};

// Режим отладки: открыть игру с ?debug в адресе. В обычной игре ни на что не влияет.
export const DEBUG = (() => {
  try {
    return new URLSearchParams(window.location.search).has('debug');
  } catch {
    return false;
  }
})();
