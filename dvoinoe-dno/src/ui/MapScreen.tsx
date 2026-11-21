import { content } from '../content';
import { state, isPracticum } from '../store/game';
import { travel } from './controller';
import { canEnter, travelMinutes } from '../domain/commands';
import { formatClock } from '../domain/clock';
import { choices } from '../store/game';
import { Dialogs } from './dialogs';
import { openModal } from '../store/game';

/** Стилизованная карта Нижнего: Волга, Ока, ярмарка на левом берегу, Кремль и Миллионка — на правом. */
export function MapScreen() {
  const s = state.value;
  const locs = content.case.locations.filter((l) => l.onMap);
  const ch = choices.value;
  return (
    <div class="map-screen">
      <svg viewBox="0 0 900 480" class="city-map" role="img" aria-label="Карта Нижнего Новгорода">
        <defs>
          <filter id="rough">
            <feTurbulence baseFrequency="0.035" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="6" />
          </filter>
        </defs>
        <rect width="900" height="480" fill="#e2d5b6" />
        <path d="M0,120 C200,150 380,100 520,150 C640,190 760,150 900,170 L900,230 C760,215 650,250 520,215 C380,170 220,220 0,190 Z" fill="#8fa3a8" filter="url(#rough)" opacity="0.9" />
        <path d="M330,480 C350,400 380,330 430,260 C470,210 500,190 520,180 L560,195 C530,215 500,240 470,290 C430,350 410,420 400,480 Z" fill="#8fa3a8" filter="url(#rough)" opacity="0.9" />
        <text x="90" y="160" font-size="22" fill="#4a5a60" font-style="italic">
          Волга
        </text>
        <text x="365" y="430" font-size="20" fill="#4a5a60" font-style="italic" transform="rotate(-60 365 430)">
          Ока
        </text>
        <path d="M150,250 L320,250 L320,350 L150,350 Z" fill="#d4c094" stroke="#8a6a3a" stroke-dasharray="5 3" />
        <text x="160" y="270" font-size="15" fill="#6a4a2a">
          Ярмарка (Канавино)
        </text>
        <path d="M690,140 L820,140 L840,230 L700,240 Z" fill="#c9a77a" stroke="#7a4a2a" />
        <text x="712" y="160" font-size="15" fill="#5a3020">
          Кремль
        </text>
        <path d="M560,300 L760,300 L760,420 L560,420 Z" fill="#c8b48e" stroke="#7a5a3a" stroke-dasharray="3 3" />
        <text x="572" y="318" font-size="14" fill="#5a3a20">
          Нижний базар · Миллионка
        </text>
        <line x1="400" y1="250" x2="540" y2="285" stroke="#5a3a20" stroke-width="5" />
        <text x="410" y="240" font-size="12" fill="#5a3a20">
          плашкоутный мост
        </text>
        {locs.map((l) => {
          const ok = canEnter(s, content, l.id);
          const here = s.location === l.id;
          const mins = travelMinutes(content, s.location, l.id);
          return (
            <g class={`pin${ok ? '' : ' locked'}${here ? ' here' : ''}`} onClick={() => ok && !ch.length && travel(l.id)} tabIndex={0} role="button" aria-label={l.title}>
              <circle cx={l.mapPos[0]} cy={l.mapPos[1]} r={14} />
              <text x={l.mapPos[0] + 18} y={l.mapPos[1] + 5} font-size="15">
                {l.short}
                {isPracticum.value && ok && !here ? ` · ${mins} мин` : ''}
                {!ok ? ' · нужна зацепка' : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <aside class="map-side">
        <h2>Куда ехать?</h2>
        {isPracticum.value && <p>Сейчас {formatClock(s.clock)}. Извозчик довезёт.</p>}
        <ul>
          {locs.map((l) => (
            <li class={canEnter(s, content, l.id) ? '' : 'muted'}>
              <b>{l.title}</b> — {l.text}
            </li>
          ))}
        </ul>
        {ch.length > 0 && (
          <ol class="choices">
            {ch.map((c, i) => (
              <li>
                <button class="choice" disabled={c.disabled} onClick={() => c.run()}>
                  <span class="num">{i + 1}.</span> {c.text}
                </button>
              </li>
            ))}
          </ol>
        )}
        <div class="row">
          <button onClick={() => openModal('notebook')}>📓 Книжка</button>
          {isPracticum.value && <button onClick={() => openModal('folder')}>📁 Папка</button>}
          {isPracticum.value && <button onClick={() => openModal('telegram')}>✉ Телеграмма</button>}
        </div>
      </aside>
      <MiniFeed />
      <Dialogs />
    </div>
  );
}

import { feed } from '../store/game';
function MiniFeed() {
  const last = feed.value.slice(-6);
  return (
    <div class="mini-feed">
      {last.map((e) => (
        <p class={`fe fe-${e.kind}`}>{e.text}</p>
      ))}
    </div>
  );
}
