// Кнопки финального экрана: ссылка «Разобрать мой спор» и «Поделиться».
import { CTA_URL, CTA_UTM, SHARE_URL } from './config.js';

export function ctaUrl() {
  try {
    const u = new URL(CTA_URL);
    for (const [k, v] of Object.entries(CTA_UTM)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return CTA_URL;
  }
}

export function openUrl(url) {
  const w = window.open(url, '_blank', 'noopener');
  if (!w) window.location.href = url;
}

export function gameUrl() {
  const here = window.location.href.split('#')[0];
  return /^https?:/i.test(here) ? here : SHARE_URL;
}

/** Web Share API на телефоне; на компьютере — копируем ссылку. Возвращает 'shared' | 'copied' | 'failed'. */
export async function shareGame(title, text) {
  const url = gameUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok ? 'copied' : 'failed';
    } catch {
      return 'failed';
    }
  }
}
