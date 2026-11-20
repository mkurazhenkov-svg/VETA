import './ui/style.css';
import { C } from './content/index.js';
import { createStore } from './domain/store.js';
import { evaluate } from './domain/evaluate.js';
import { titleScreen, prologueScreen } from './ui/screens.js';
import { epilogue } from './ui/epilogue.js';
import { debrief } from './ui/debrief.js';

const root = document.getElementById('app');
const store = createStore(C);
window.__store = store; // для отладки и e2e

// Игровые часы: реальное время сцены + «стоимость» действий.
function createClock(startMin) {
  let real = 0, spent = 0;
  return {
    now: () => startMin + real / C.REAL_SEC_PER_GAME_MIN + spent,
    tick: (sec) => { real += sec; },
    spend: (min) => { spent += min; },
  };
}

titleScreen(root, (mode) => {
  store.dispatch({ t: C.CASE.startMin, type: 'session.start', mode, case: 'zarechnaya', variant: 'A' });
  prologueScreen(root, C, async (res) => {
    store.dispatch({ t: C.CASE.startMin + 10, type: 'prologue.done', ...res });
    const loading = document.createElement('div');
    loading.className = 'screen loading';
    loading.innerHTML = '<div><div class="kicker">08:05 · ул. Заречная, 14</div><h2>Прибытие на место…</h2><p>Щёлкните по сцене, чтобы управлять мышью.</p></div>';
    root.append(loading);
    const [{ createGame3D }, { createSceneUI }] = await Promise.all([import('./render/game3d.js'), import('./ui/scene-ui.js')]);
    const clock = createClock(C.CASE.arriveMin);
    const view = document.createElement('div');
    view.className = 'view';
    root.append(view);
    let ui = null;
    const g3d = createGame3D({ container: view, C, store, onTarget: (t) => ui?.onTarget(t), onToast: (m, k) => ui?.toast(m, k) });
    window.__g3d = g3d;
    loading.remove();
    ui = createSceneUI({
      root, C, store, g3d, clock, mode,
      onFinish: (thumbs) => {
        view.remove();
        g3d.renderer.dispose();
        epilogue(root, {
          C, store, thumbs, clock,
          onSubmit: (doc) => {
            store.dispatch({ t: +clock.now().toFixed(2), type: 'protocol.submitted', doc });
            const result = evaluate(store.log, C);
            debrief(root, { C, store, result, thumbs });
          },
        });
      },
    });
    g3d.setPaused(false);
  });
});
