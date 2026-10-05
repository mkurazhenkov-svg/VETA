// Тексты берутся только из content/ru.json.
import ru from '../content/ru.json';

/** Текст по ключу. Подстановки: t('final.of', { x: 1, y: 9 }). */
export function t(key, vars) {
  const entry = ru[key];
  if (!entry) {
    console.warn('Нет текста для ключа', key);
    return key;
  }
  let s = entry.text;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function has(key) {
  return Object.prototype.hasOwnProperty.call(ru, key);
}
