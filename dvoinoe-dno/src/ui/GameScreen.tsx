import { useEffect, useRef } from 'preact/hooks';
import { content } from '../content';
import { choices, feed, highlight, isPracticum, modal, openModal, prefs, speaker, state, tool, type FeedEntry } from '../store/game';
import { scene, lookAround, describeRoom, toggleLamp, startTripodPlacement, talkZharov, ink } from './controller';
import { formatClock } from '../domain/clock';
import { platesLeft, platesLimit, locationDef, sceneOf } from '../domain/queries';
import { portraitUrl, nameOf } from './portraits';
import { skillTitle } from '../ink/runtime-adapter';
import { Dialogs } from './dialogs';

function SceneHost() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) scene.mount(ref.current);
  }, []);
  return <div class="scene-host" ref={ref} />;
}

function voiceColor(id: string) {
  return content.skills.skills.find((s) => s.id === id)?.color ?? '#ccc';
}

function Entry({ e }: { e: FeedEntry }) {
  switch (e.kind) {
    case 'npc':
      return (
        <p class="fe fe-npc">
          <span class="who">{nameOf(e.who!).toUpperCase()}</span> — {e.text}
        </p>
      );
    case 'zharov':
      return (
        <p class="fe fe-zharov">
          <span class="who">ЖАРОВ</span> — {e.text} <span class="tiny">(записал в книжечку)</span>
        </p>
      );
    case 'voice':
      return (
        <p class={`fe fe-voice${e.shortcut ? ' shortcut' : ''}`}>
          <span class="who" style={{ color: voiceColor(e.who!) }}>
            {skillTitle(e.who!).toUpperCase()}
          </span>{' '}
          — {e.text}
          {e.shortcut && <span class="tiny"> · короткий путь</span>}
        </p>
      );
    case 'echo':
      return <p class="fe fe-echo">— {e.text}</p>;
    case 'system':
      return <p class="fe fe-system">{e.text}</p>;
    case 'time':
      return <p class="fe fe-time">⏱ {e.text}</p>;
    case 'doc':
      return <p class="fe fe-doc">🏛 {e.text}</p>;
    case 'plate':
      return (
        <figure class="fe fe-plate">
          <img src={e.img} alt={e.text} />
          <figcaption>{e.text}</figcaption>
        </figure>
      );
    default:
      return <p class="fe fe-narr">{e.text}</p>;
  }
}

function TextColumn() {
  const ref = useRef<HTMLDivElement>(null);
  const list = feed.value;
  const ch = choices.value;
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [list.length, ch.length]);
  const sp = speaker.value;
  const portrait = sp ? portraitUrl(sp.who, sp.mood) : null;
  return (
    <aside class={`column${prefs.value.contrast ? ' contrast' : ''}`} aria-live="polite">
      {portrait && (
        <div class="portrait">
          <img src={portrait} alt={nameOf(sp!.who)} />
          <div class="portrait-name">{nameOf(sp!.who)}</div>
        </div>
      )}
      <div class="feed" ref={ref}>
        {list.length === 0 && <p class="fe fe-system">Кликните по полу — идти, по предмету — подойти и осмотреть, по человеку — заговорить.</p>}
        {list.slice(-160).map((e) => (
          <Entry key={e.id} e={e} />
        ))}
        {ch.length > 0 && (
          <ol class="choices">
            {ch.map((c, i) => (
              <li key={i}>
                <button class={`choice${c.tags?.some((t) => t === 'shortcut') ? ' shortcut' : ''}`} disabled={c.disabled} onClick={() => c.run()}>
                  <span class="num">{i + 1}.</span> {c.text}
                  {c.hint && <span class="hint"> [{c.hint}]</span>}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

function BottomPanel() {
  const s = state.value;
  const loc = s.location ?? '';
  const sc = sceneOf(content, loc);
  const practicum = isPracticum.value;
  const plates = platesLimit(s, content, loc);
  const lDef = locationDef(content, loc);
  const hasFollowers = !!sc?.followers;
  const atThreshold = !!sc?.threshold;
  return (
    <nav class="bottom" aria-label="Панель следователя">
      <div class="tools">
        {practicum && sc && <button onClick={lookAround} title="Показывает предметы в текущей части помещения (3 мин)">👁 Осмотреться</button>}
        {!practicum && sc && (
          <button class={highlight.value ? 'on' : ''} onClick={() => (highlight.value = !highlight.value)}>
            ✦ Подсказка
          </button>
        )}
        {atThreshold && !s.roomDescribed[loc] && <button onClick={describeRoom}>🚪 Описать с порога</button>}
        {sc && loc !== 'museum' && <button class={s.lamp ? 'on' : ''} onClick={toggleLamp}>🕯 Лампа</button>}
        {plates > 0 && (
          <button class={tool.value === 'tripod' ? 'on' : ''} onClick={startTripodPlacement}>
            📷 Тренога
          </button>
        )}
        {hasFollowers && <button onClick={talkZharov}>🧔 Жаров</button>}
        {loc === 'cellar' && <button onClick={() => ink.talk('photographer', 'photographer')}>🎞 Фотограф</button>}
      </div>
      <div class="status">
        {plates > 0 && (
          <span class="badge" title="Фотопластинки">
            🎞 {platesLeft(s, content, loc)}/{plates}
          </span>
        )}
        {practicum && (
          <span class="badge" title="Игровое время">
            🕰 {formatClock(s.clock)}
          </span>
        )}
        {practicum && hasFollowers && (
          <span class={`badge${s.witnesses.present.length < 2 ? ' warn' : ''}`} title="Понятые при вас">
            👥 {s.witnesses.present.length}/2
          </span>
        )}
        <button onClick={() => openModal('portfolio')}>💼 Портфель</button>
        <button onClick={() => openModal('notebook')}>📓 Книжка</button>
        {practicum && <button onClick={() => openModal('theories')}>🗂 Версии</button>}
        {practicum && <button onClick={() => openModal('folder')}>📁 Папка</button>}
        <button onClick={() => openModal('qr')} title="Код с витрины музея">▦ Код</button>
        <button onClick={() => openModal('settings')} aria-label="Настройки">⚙</button>
      </div>
      <div class="loc-title">{lDef?.title}</div>
    </nav>
  );
}

export function GameScreen() {
  return (
    <div class="game">
      <main class="stage">
        <SceneHost />
        {modal.value === null && tool.value === 'tripod' && <div class="stage-hint">Кликните по полу — поставить треногу</div>}
      </main>
      <TextColumn />
      <BottomPanel />
      <Dialogs />
    </div>
  );
}
