// Состояние экранных кнопок (на телефоне). Уровень читает его вместе с клавиатурой.
export const touch = { left: false, right: false, jump: false, beam: false, action: false };

export function resetTouch() {
  for (const k of Object.keys(touch)) touch[k] = false;
}

export function isTouchDevice() {
  try {
    return (
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      ('ontouchstart' in window && navigator.maxTouchPoints > 0)
    );
  } catch {
    return false;
  }
}
