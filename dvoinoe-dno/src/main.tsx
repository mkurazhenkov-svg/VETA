import { render } from 'preact';
import '@fontsource/pt-serif/cyrillic-400.css';
import '@fontsource/pt-serif/cyrillic-700.css';
import '@fontsource/pt-serif/cyrillic-400-italic.css';
import '@fontsource/pt-serif/latin-400.css';
import '@fontsource/old-standard-tt/cyrillic-400.css';
import '@fontsource/old-standard-tt/cyrillic-ext-400.css';
import '@fontsource/old-standard-tt/cyrillic-400-italic.css';
import './ui/styles.css';
import { App } from './ui/App';
import * as store from './store/game';
import * as ctl from './ui/controller';
import { content } from './content';
import { portraitUrl } from './ui/portraits';
import { scenePainting } from './scene/photo-render';
import { MusicPlayer, PIECES } from './audio/music';

// Хук для e2e-тестов и отладки: только чтение состояния и те же команды, что у интерфейса.
(window as any).__dd = {
  store,
  ctl,
  content,
  portraitUrl,
  music: { MusicPlayer, PIECES },
  art: (id: string) => scenePainting(content.scenes[id], new Set()).toDataURL('image/png'),
};

// Service Worker — только при раздаче по http(s) (киоск, сайт музея). Из файла открывается и без него.
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !import.meta.env.DEV) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

document.fonts?.ready.finally(() => render(<App />, document.getElementById('app')!));
