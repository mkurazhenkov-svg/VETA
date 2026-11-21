import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { content } from '../content';
import type { SkillId } from '../content/schemas';
import { SKILLS } from '../content/schemas';
import {
  choices, closeAll, dispatch, hasSave, kiosk, modal, openModal, prefs, restoreSession, say, screen, setTeacherConfig, startSession, state, teacherConfig,
} from '../store/game';
import { GameScreen } from './GameScreen';
import { MapScreen } from './MapScreen';
import { Debrief, DebriefView, ExhibitResult } from './Debrief';
import { enterLocation, ink, scene, travel } from './controller';
import { setAmbient } from '../audio/sound';
import { lsGet, lsSet, verifyJournal, download, type JournalExport } from '../store/save';
import { replay } from '../domain/state';
import { scoreSession, OUTCOME_LETTER } from '../domain/scoring';
import { scenePainting } from '../scene/photo-render';
import { resetDraft } from './CaseFolder';
import { skillTitle } from '../ink/runtime-adapter';
import { Editor } from './Editor';

const params = new URLSearchParams(location.search);

// ---------- команды из Ink ----------
ink.onUi = (cmd) => {
  const s = state.value;
  if (cmd === 'start_case') {
    if (s.mode === 'exhibit') travel('cellar');
    else travel('bank');
  } else if (cmd === 'finale') openModal('finale');
  else if (cmd === 'map') screen.value = 'map';
  else if (cmd === 'folder') openModal('folder');
  else if (cmd === 'telegram') openModal('telegram');
};

function counters() {
  return lsGet('dd.kiosk.counters', { started: 0, finished: 0 });
}
function bump(k: 'started' | 'finished') {
  const c = counters();
  c[k]++;
  lsSet('dd.kiosk.counters', c);
}

function beginExhibit() {
  const a = content.skills.archetypes.find((x) => x.id === content.skills.defaultArchetype)!;
  resetDraft();
  startSession('exhibit', a.id, a.skills as Record<SkillId, number>);
  bump('started');
  travel('museum');
  applyQr();
}
function applyQr() {
  const qr = params.get('qr');
  if (qr) {
    const evs = dispatch({ type: 'qr', code: qr });
    if (evs.length) say('doc', 'Код с витрины открыл архивный документ — он в записной книжке.');
  }
}

function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const p = scenePainting(content.scenes['cellar'], new Set());
    c.width = p.width;
    c.height = p.height;
    c.getContext('2d')!.drawImage(p, 0, 0);
  }, []);
  return <canvas class="backdrop" ref={ref} aria-hidden="true" />;
}

function Title() {
  const [save, setSave] = useState(false);
  useEffect(() => {
    hasSave('practicum').then(setSave);
  }, []);
  return (
    <div class="title-screen">
      <Backdrop />
      <div class="title-box">
        <h1>{content.strings['game.title']}</h1>
        <h2>{content.strings['game.subtitle']}</h2>
        <p class="partners">{content.strings['game.partners']}</p>
        <div class="modes">
          <button class="mode" onClick={beginExhibit}>
            <b>{content.strings['menu.exhibit']}</b>
            <span>{content.strings['menu.exhibit.text']}</span>
          </button>
          <button class="mode" onClick={() => (screen.value = 'hero')}>
            <b>{content.strings['menu.practicum']}</b>
            <span>{content.strings['menu.practicum.text']}</span>
          </button>
        </div>
        <div class="row center">
          {save && (
            <button
              onClick={async () => {
                const r = await restoreSession('practicum');
                if (r?.inkState) ink.loadState(r.inkState);
                say('system', 'Следствие продолжается с того же места.');
                enterLocation(true);
              }}
            >
              {content.strings['menu.continue']}
            </button>
          )}
          <button onClick={() => (screen.value = 'teacher')}>{content.strings['menu.teacher']}</button>
          <button onClick={() => openModal('settings')}>{content.strings['menu.settings']}</button>
        </div>
        <p class="tiny">Люди, адреса и события вымышлены. Изображения денежных знаков стилизованы — игровой реквизит.</p>
      </div>
      <TitleDialogs />
    </div>
  );
}

import { Dialogs } from './dialogs';
function TitleDialogs() {
  return modal.value ? <Dialogs /> : null;
}

function Attract() {
  return (
    <div class="title-screen attract" onClick={beginExhibit} onTouchStart={beginExhibit}>
      <Backdrop />
      <div class="title-box">
        <h1>{content.strings['game.title']}</h1>
        <h2>{content.strings['game.subtitle']}</h2>
        <p class="touch">{content.strings['attract.touch']}</p>
      </div>
    </div>
  );
}

function Hero() {
  const [arch, setArch] = useState(content.skills.archetypes[0].id);
  const [free, setFree] = useState(false);
  const [name, setName] = useState('');
  const base = content.skills.archetypes.find((a) => a.id === arch)!;
  const [pts, setPts] = useState<Record<string, number>>(() => Object.fromEntries(SKILLS.map((s) => [s, 1])));
  const used = Object.values(pts).reduce((a, b) => a + b, 0);
  const left = content.skills.freePoints - used;
  const skills = free ? pts : (base.skills as Record<string, number>);
  return (
    <div class="hero-screen">
      <h1>{content.strings['hero.title']}</h1>
      <div class="archetypes">
        {content.skills.archetypes.map((a) => (
          <button class={`arch${!free && arch === a.id ? ' on' : ''}`} onClick={() => (setArch(a.id), setFree(false))}>
            <b>{a.title}</b>
            <span>{a.text}</span>
          </button>
        ))}
        <button class={`arch${free ? ' on' : ''}`} onClick={() => setFree(true)}>
          <b>{content.strings['hero.free']}</b>
          <span>
            {content.strings['hero.points']}: {left}
          </span>
        </button>
      </div>
      <div class="skills-grid">
        {content.skills.spheres.map((sp) => (
          <div class="sphere">
            <h3>{sp.title}</h3>
            {content.skills.skills
              .filter((s) => s.sphere === sp.id)
              .map((s) => (
                <div class="skill" title={`${s.gives}. Опасен: ${s.danger}`}>
                  <span class="sk-name" style={{ color: s.color }}>
                    {s.title}
                  </span>
                  {free ? (
                    <span class="stepper">
                      <button disabled={pts[s.id] <= 0} onClick={() => setPts({ ...pts, [s.id]: pts[s.id] - 1 })}>
                        −
                      </button>
                      <b>{pts[s.id]}</b>
                      <button disabled={left <= 0 || pts[s.id] >= 6} onClick={() => setPts({ ...pts, [s.id]: pts[s.id] + 1 })}>
                        +
                      </button>
                    </span>
                  ) : (
                    <b>{skills[s.id]}</b>
                  )}
                  <span class="tiny">
                    {s.gives}. <i>Опасен: {s.danger.toLowerCase()}</i>
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
      <label>
        ФИО для отчёта (по желанию, остаётся на этом компьютере)
        <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <div class="row">
        <button onClick={() => (screen.value = 'title')}>Назад</button>
        <button
          class="primary"
          disabled={free && left !== 0}
          onClick={() => {
            resetDraft();
            startSession('practicum', free ? 'free' : arch, skills as Record<SkillId, number>, name.trim());
            travel('museum');
            applyQr();
          }}
        >
          {content.strings['hero.start']}
        </button>
      </div>
    </div>
  );
}

function Teacher() {
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState('');
  const [logs, setLogs] = useState<{ name: string; data: JournalExport; valid: boolean }[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const tc = teacherConfig.value;
  const rows = useMemo(
    () =>
      logs.map((l) => {
        const st = replay(content, l.data.journal);
        const r = scoreSession(st, l.data.journal, content);
        return { ...l, st, r };
      }),
    [logs],
  );
  if (!ok)
    return (
      <div class="teacher">
        <h1>Режим преподавателя</h1>
        <label>
          PIN
          <input type="password" value={pin} onInput={(e) => setPin((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && pin === content.rules.teacher.pin && setOk(true)} />
        </label>
        <div class="row">
          <button onClick={() => (screen.value = 'title')}>Назад</button>
          <button class="primary" onClick={() => (pin === content.rules.teacher.pin ? setOk(true) : alert('Неверный PIN'))}>
            Войти
          </button>
        </div>
        <p class="tiny">PIN задаётся в content/rules/rules.yaml (teacher.pin).</p>
      </div>
    );
  if (open != null) return <DebriefView j={rows[open].data.journal} onClose={() => setOpen(null)} />;
  return (
    <div class="teacher">
      <h1>Режим преподавателя</h1>
      <section>
        <h2>Настройки практикума на этом компьютере</h2>
        <label>
          Вариант истины
          <select value={tc.variant} onChange={(e) => setTeacherConfig({ variant: (e.target as HTMLSelectElement).value as any })}>
            {content.case.variants.map((v) => (
              <option value={v.id}>
                {v.title} — {v.summary}
              </option>
            ))}
            <option value="random">Случайный</option>
          </select>
        </label>
        <label>
          Пластинок на подвал
          <input type="number" min={2} max={30} value={tc.plates ?? 12} onInput={(e) => setTeacherConfig({ plates: Number((e.target as HTMLInputElement).value) })} />
        </label>
        <label class="check">
          <input type="checkbox" checked={tc.noRandom} onChange={() => setTeacherConfig({ noRandom: !tc.noRandom })} /> «Без случайности»: исход проверок определяет значение навыка
        </label>
        <label class="check">
          <input type="checkbox" checked={tc.timePressure} onChange={() => setTeacherConfig({ timePressure: !tc.timePressure })} /> Давление временем (дождь, уход понятого, пароход)
        </label>
        <label class="check">
          <input type="checkbox" checked={tc.showReveal} onChange={() => setTeacherConfig({ showReveal: !tc.showReveal })} /> Показывать студентам «как было на самом деле»
        </label>
      </section>
      <section>
        <h2>Журналы студентов</h2>
        <input
          type="file"
          accept=".json"
          multiple
          onChange={async (e) => {
            const files = [...((e.target as HTMLInputElement).files ?? [])];
            const out = [];
            for (const f of files) {
              try {
                const data = JSON.parse(await f.text()) as JournalExport;
                out.push({ name: data.student || f.name, data, valid: verifyJournal(data) });
              } catch {
                alert(`Не удалось прочитать ${f.name}`);
              }
            }
            setLogs([...logs, ...out]);
          }}
        />
        {rows.length > 0 && (
          <>
            <table class="tbl">
              <thead>
                <tr>
                  <th>Студент</th>
                  <th>Вариант</th>
                  <th>Итог</th>
                  <th>Исход</th>
                  {rows[0].r.criteria.map((c) => (
                    <th>{c.title}</th>
                  ))}
                  <th>Крит. нарушения</th>
                  <th>Контрольная сумма</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((x, i) => (
                  <tr>
                    <td>{x.name}</td>
                    <td>{content.case.variants.find((v) => v.id === x.st.settings.variant)?.title}</td>
                    <td>
                      <b>{x.r.total}</b>
                    </td>
                    <td>{OUTCOME_LETTER[x.r.outcome]}</td>
                    {x.r.criteria.map((c) => (
                      <td>{c.score}</td>
                    ))}
                    <td>{x.r.violations.filter((v) => v.def.severity === 'critical').length}</td>
                    <td>{x.valid ? '✓' : <b class="warn">изменён!</b>}</td>
                    <td>
                      <button onClick={() => setOpen(i)}>Разбор</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Средний балл: {(rows.reduce((s, x) => s + x.r.total, 0) / rows.length).toFixed(1)}. Частые нарушения:{' '}
              {Object.entries(
                rows.flatMap((x) => x.r.violations.map((v) => v.def.title)).reduce<Record<string, number>>((m, t) => ((m[t] = (m[t] ?? 0) + 1), m), {}),
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([t, n]) => `${t} (${n})`)
                .join(', ')}
            </p>
            <button
              onClick={() =>
                download(
                  'svodka.csv',
                  ['Студент;Итог;Исход;' + rows[0].r.criteria.map((c) => c.title).join(';'), ...rows.map((x) => [x.name, x.r.total, OUTCOME_LETTER[x.r.outcome], ...x.r.criteria.map((c) => c.score)].join(';'))].join('\n'),
                  'text/csv',
                )
              }
            >
              Сводка по группе (CSV)
            </button>
          </>
        )}
      </section>
      <button onClick={() => (screen.value = 'title')}>В меню</button>
    </div>
  );
}

// ---------- киоск ----------
function KioskLayer() {
  const cfg = content.exhibits.kiosk;
  const [idle, setIdle] = useState(0);
  const [service, setService] = useState<'none' | 'pin' | 'menu'>('none');
  const [pin, setPin] = useState('');
  const taps = useRef<number[]>([]);
  useEffect(() => {
    const reset = () => setIdle(0);
    const ev = ['pointerdown', 'keydown', 'touchstart'];
    ev.forEach((e) => window.addEventListener(e, reset));
    const t = setInterval(() => setIdle((x) => x + 1), 1000);
    return () => {
      ev.forEach((e) => window.removeEventListener(e, reset));
      clearInterval(t);
    };
  }, []);
  useEffect(() => {
    if (screen.value !== 'attract' && idle >= cfg.idleSeconds) {
      setIdle(0);
      closeAll();
    }
  }, [idle]);
  const warn = screen.value !== 'attract' && idle >= cfg.idleSeconds - cfg.warnSeconds;
  const c = counters();
  return (
    <>
      <div
        class="service-corner"
        onPointerDown={() => {
          const now = performance.now();
          taps.current = [...taps.current.filter((x) => now - x < 3000), now];
          if (taps.current.length >= 5) {
            taps.current = [];
            setService('pin');
          }
        }}
      />
      {warn && (
        <div class="idle-warn">
          {content.strings['kiosk.idle']} {cfg.idleSeconds - idle} с. <button onClick={() => setIdle(0)}>Я здесь</button>
        </div>
      )}
      {service !== 'none' && (
        <div class="modal-back">
          <div class="modal">
            <h2>{content.strings['kiosk.service']}</h2>
            {service === 'pin' ? (
              <>
                <input type="password" value={pin} onInput={(e) => setPin((e.target as HTMLInputElement).value)} />
                <div class="row">
                  <button onClick={() => (pin === cfg.pin ? setService('menu') : setService('none'), setPin(''))}>OK</button>
                  <button onClick={() => setService('none')}>Отмена</button>
                </div>
              </>
            ) : (
              <>
                <p>
                  Сессий начато: {c.started}, доведено до конца: {c.finished}. Данные только локально, без персональных данных.
                </p>
                <div class="row">
                  <button onClick={() => (lsSet('dd.kiosk.counters', { started: 0, finished: 0 }), setService('none'))}>Обнулить счётчики</button>
                  <button onClick={() => document.exitFullscreen?.().catch(() => {})}>Выйти из полноэкранного</button>
                  <button onClick={() => location.reload()}>Перезапустить</button>
                  <button onClick={() => setService('none')}>Закрыть</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function App() {
  useEffect(() => {
    const mode = params.get('mode');
    if (params.has('kiosk')) {
      kiosk.value = true;
      screen.value = 'attract';
      const fs = () => document.documentElement.requestFullscreen?.().catch(() => {});
      window.addEventListener('pointerdown', fs, { once: true });
    } else if (mode === 'exhibit') beginExhibit();
    else if (mode === 'practicum') screen.value = 'hero';
    else if (mode === 'teacher') screen.value = 'teacher';
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') modal.value = null;
      if (modal.value) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const c = choices.value[n - 1];
        if (c && !c.disabled) {
          e.preventDefault();
          c.run();
        }
      }
      if (screen.value === 'game') {
        if (e.key === 'q' || e.key === 'й' || e.key === '[') {
          const l = scene.focusStep(-1);
          if (l) say('system', `Фокус: ${l}`);
        }
        if (e.key === 'e' || e.key === 'у' || e.key === ']') {
          const l = scene.focusStep(1);
          if (l) say('system', `Фокус: ${l}`);
        }
        if (e.key === 'Enter') scene.activateFocus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(prefs.value.textScale));
  }, [prefs.value.textScale]);
  useEffect(() => {
    if (screen.value === 'exhibit_result') bump('finished');
  }, [screen.value]);
  const s = state.value;
  useEffect(() => {
    setAmbient(screen.value === 'game' || screen.value === 'map' ? s.location : null);
  }, [s.location, screen.value]);

  if (params.has('editor') && import.meta.env.DEV) return <Editor />;
  let body;
  switch (screen.value) {
    case 'attract':
      body = <Attract />;
      break;
    case 'hero':
      body = <Hero />;
      break;
    case 'game':
      body = <GameScreen />;
      break;
    case 'map':
      body = <MapScreen />;
      break;
    case 'debrief':
      body = <Debrief />;
      break;
    case 'exhibit_result':
      body = <ExhibitResult />;
      break;
    case 'teacher':
      body = <Teacher />;
      break;
    default:
      body = <Title />;
  }
  return (
    <div class={`app${prefs.value.contrast ? ' contrast' : ''}`}>
      {body}
      {kiosk.value && <KioskLayer />}
    </div>
  );
}

export { skillTitle };
