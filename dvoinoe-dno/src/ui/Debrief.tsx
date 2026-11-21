import { useMemo, useState } from 'preact/hooks';
import { content } from '../content';
import { SKILLS } from '../content/schemas';
import type { GameEvent } from '../domain/events';
import { replay, type GameState } from '../domain/state';
import { scoreSession, exhibitSummary, OUTCOME_TITLES, OUTCOME_LETTER } from '../domain/scoring';
import { formatClock } from '../domain/clock';
import { activeEvidence, personName, variantDef, sceneOf } from '../domain/queries';
import { dispatch, journal, screen, state, closeAll } from '../store/game';
import { exportJournal, download } from '../store/save';
import { skillTitle } from '../ink/runtime-adapter';
import { Modal } from './dialogs';
import { ROLE_TITLES, protocolText, draft } from './CaseFolder';
import { PlanEditor, Phototable } from './Notebook';
import type { Vec2 } from '../domain/geometry';

function CellarMap({ st, j }: { st: GameState; j: GameEvent[] }) {
  const sc = sceneOf(content, 'cellar');
  if (!sc) return null;
  const k = 34;
  const maxX = 14;
  const maxY = 10;
  const route = j.filter((e): e is Extract<GameEvent, { type: 'player.moved' }> => e.type === 'player.moved' && e.loc === 'cellar').map((e) => e.to);
  const P = (p: Vec2) => `${10 + p[0] * k},${10 + p[1] * k}`;
  const evs = activeEvidence(st, content, 'cellar').filter((e) => e.kind !== 'container');
  return (
    <svg viewBox={`0 0 ${maxX * k + 20} ${maxY * k + 20}`} class="cellar-map">
      <rect width="100%" height="100%" fill="#efe6cf" />
      {sc.sectors.map((z) => {
        const seen = (st.sectorsVisited.cellar ?? []).includes(z.id) || (st.sectorsLooked.cellar ?? []).includes(z.id);
        return (
          <g>
            <polygon points={z.poly.map((p) => P(p as Vec2)).join(' ')} fill={seen ? 'rgba(120,160,110,0.15)' : 'rgba(180,80,60,0.15)'} stroke="#a89878" stroke-dasharray="4 3" />
            <text x={10 + z.poly[0][0] * k + 6} y={10 + z.poly[0][1] * k + 16} font-size={11} fill="#5a4a3a">
              {z.title}
            </text>
          </g>
        );
      })}
      {route.length > 1 && <polyline points={route.map((p) => P(p)).join(' ')} fill="none" stroke="#3a4a7a" stroke-width={2} opacity={0.7} />}
      {st.photos
        .filter((p) => p.loc === 'cellar' && p.tripod)
        .map((p) => (
          <text x={10 + p.tripod![0] * k} y={10 + p.tripod![1] * k} font-size={12} fill="#7a3a2a">
            📷
          </text>
        ))}
      {evs.map((e) => {
        const h = sc.hotspots.find((x) => x.id === e.hotspot)!;
        const p = h.pos ?? sc.props.find((x) => x.id === h.prop)?.pos ?? h.approach;
        const es = st.evidence[e.id];
        const col = es.examined ? (es.condition === 'intact' ? '#3a7a3a' : '#b07a2a') : '#b03a2a';
        return (
          <g>
            <circle cx={10 + p[0] * k} cy={10 + p[1] * k} r={10} fill={col} opacity={0.85} />
            <text x={10 + p[0] * k} y={10 + p[1] * k + 4} font-size={9} text-anchor="middle" fill="#fff">
              {e.num}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DebriefView({ j, onClose }: { j: GameEvent[]; onClose?: () => void }) {
  const st = useMemo(() => replay(content, j), [j]);
  const rep = useMemo(() => scoreSession(st, j, content), [st, j]);
  const v = variantDef(st, content);
  const [revealStep, setRevealStep] = useState(st.settings.showReveal ? 0 : -1);
  const [moment, setMoment] = useState<number | null>(null);
  const t0 = j[0]?.t ?? 0;
  const t1 = Math.max(st.clock, t0 + 1);
  const markers = j
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => ['photo.taken', 'evidence.packaged', 'evidence.examined', 'location.entered', 'dialogue.choice', 'timeline.fired', 'telegram.sent', 'evidence.condition'].includes(e.type));
  const momentState = moment != null ? replay(content, j.slice(0, moment + 1)) : null;
  const violationsAt = (i: number) => rep.violations.filter((x) => x.t === j[i]?.t && x.t > 0);
  const voices = SKILLS.map((sk) => ({ sk, ...st.voices[sk] })).filter((x) => x.suggested || x.followed);
  const tunnel = content.theories.filter((t) => st.theories[t.id] === 'internalized');
  const twins = content.evidence.filter((e) => e.museum.exhibit && st.evidence[e.id]?.examined);
  return (
    <div class="debrief">
      <header class="debrief-head">
        <div>
          <h1>Снова в музее. Разбор дела</h1>
          <p class="muted">
            Вариант истины: {v.title}. {st.settings.studentName && `Студент: ${st.settings.studentName}.`} Игровое время: {formatClock(t0)}–{formatClock(st.clock)}.
          </p>
        </div>
        <div class="score">
          <div class="big">{rep.total}</div>
          <div>
            из 100 · {rep.grade}
            {rep.capped && <div class="warn">потолок 59 — критическое нарушение</div>}
          </div>
          <div class={`outcome o-${rep.outcome}`}>
            Исход {OUTCOME_LETTER[rep.outcome]}: {OUTCOME_TITLES[rep.outcome]}
          </div>
        </div>
      </header>

      {revealStep >= 0 && revealStep < v.reveal.length && (
        <section class="reveal">
          <h2>Что случилось в подвале на самом деле</h2>
          <p class="reveal-text">{v.reveal[revealStep]}</p>
          <button onClick={() => setRevealStep(revealStep + 1)}>{revealStep + 1 < v.reveal.length ? 'Дальше' : 'К разбору'}</button>
        </section>
      )}

      <section>
        <h2>Оценка по критериям</h2>
        <div class="crit">
          {rep.criteria.map((c) => (
            <div class="crit-row">
              <div class="crit-title">
                {c.title} <b>{c.score}</b> / {c.max}
              </div>
              <div class="bar">
                <div style={{ width: `${(c.score / c.max) * 100}%` }} />
              </div>
              <ul class="tiny">
                {c.items.map((it) => (
                  <li>
                    {it.text}: {it.value > 0 ? '+' : ''}
                    {it.value}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p class="muted">Броски костей на оценку не влияют — только ваши решения. Преподаватель пересчитывает оценку из журнала.</p>
      </section>

      <section>
        <h2>Кто в деле</h2>
        <table class="tbl">
          <thead>
            <tr>
              <th>Лицо</th>
              <th>На самом деле</th>
              <th>Ваша папка</th>
              <th>Доказано</th>
            </tr>
          </thead>
          <tbody>
            {rep.persons.map((p) => (
              <tr class={p.accused === p.truth ? 'ok' : 'bad'}>
                <td>{personName(content, p.id)}</td>
                <td>{ROLE_TITLES[p.truth]}</td>
                <td>{ROLE_TITLES[p.accused]}</td>
                <td>{p.truth === 'none' ? '—' : p.proven ? 'да' : 'нет'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Связь подвала с подделками: {rep.workshopLinked ? 'доказана' : 'не доказана'}.{' '}
          {rep.telegramInTime !== null && <>Телеграмма о розыске: {rep.telegramInTime ? 'успела' : 'не успела или ушла не туда'}.</>}
        </p>
      </section>

      <section>
        <h2>Лента следствия</h2>
        <div class="timeline">
          {markers.map(({ e, i }) => (
            <button
              class={`tm tm-${e.type.split('.')[0]}${violationsAt(i).length ? ' bad' : ''}`}
              style={{ left: `${((e.t - t0) / (t1 - t0)) * 100}%` }}
              title={`${formatClock(e.t)} · ${e.type}`}
              onClick={() => setMoment(i)}
            />
          ))}
        </div>
        {momentState && moment != null && (
          <div class="moment">
            <b>{formatClock(j[moment].t)}</b> · {content.case.locations.find((l) => l.id === momentState.location)?.title ?? '—'} · {describeEvent(j[moment])}
            {violationsAt(moment).map((x) => (
              <p class="fe-zharov">
                <b>ЖАРОВ</b> — {x.def.zharov}
              </p>
            ))}
            <p class="tiny">
              Понятых при вас: {momentState.witnesses.present.length}; пластинок потрачено: {momentState.platesUsed.cellar ?? 0}; фактов: {momentState.factOrder.length}.
            </p>
          </div>
        )}
      </section>

      <section class="cols">
        <div>
          <h2>Карта подвала</h2>
          <CellarMap st={st} j={j} />
          <p class="tiny">Зелёный — найдено и сохранено, жёлтый — повреждено, красный — пропущено. Красные сектора не осмотрены. Синяя линия — ваш маршрут.</p>
        </div>
        <div>
          <h2>Кто вас вёл</h2>
          <ul>
            {voices.map((x) => (
              <li>
                <b>{skillTitle(x.sk)}</b>: высказывался {x.suggested} раз
                {x.shortcuts ? `, из них коротких путей — ${x.shortcuts}` : ''}; вы последовали {x.followed}
                {x.shortcutsFollowed ? `, коротким путём — ${x.shortcutsFollowed}` : ''}.
              </li>
            ))}
          </ul>
          {tunnel.length > 0 && (
            <p>
              Туннельное зрение давали версии: {tunnel.map((t) => `«${t.title}»`).join(', ')}. {tunnel.some((t) => !t.trueIn.includes(st.settings.variant)) ? 'Одна из них — ложная.' : ''}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2>Нарушения: как правильно в 1913 году и как сегодня</h2>
        {rep.violations.length === 0 && <p>Нарушений не найдено.</p>}
        <div class="cards">
          {rep.violations.map((x) => {
            const b = content.bridge.cards.find((c) => c.id === x.def.bridgeToday);
            const ev = x.ref ? content.evidence.find((e) => e.id === x.ref) : null;
            return (
              <article class={`card sev-${x.def.severity}`}>
                <h3>
                  {x.def.title} <span class="tiny">({x.def.severity === 'critical' ? 'критическое' : x.def.severity === 'major' ? 'существенное' : 'мелкое'})</span>
                </h3>
                <p>
                  {x.t ? `${formatClock(x.t)}. ` : ''}
                  {ev ? `${ev.num}. ${ev.title}. ` : x.ref && content.case.persons.find((p) => p.id === x.ref) ? `${personName(content, x.ref)}. ` : ''}
                  {x.detail && !ev ? `${x.detail}. ` : ''}
                  {x.def.explain}
                </p>
                <p>
                  <b>1913:</b> {x.def.right1913} <span class="tiny">{x.def.source1913}</span>
                </p>
                {b && (
                  <p>
                    <b>Сегодня ({b.norm}):</b> {b.text} {b.tech && <i>Техника: {b.tech}</i>} <span class="tiny">{b.status}</span>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section class="cols">
        <div>
          <h2>Ваша папка</h2>
          <pre class="doc-modern">{st.folder ? protocolTextFor(st) : 'Папка не сдана.'}</pre>
        </div>
        <div>
          <h2>Эталон кафедры (черновик)</h2>
          <ul>
            {v.reference.protocolPoints.map((p) => (
              <li>{p}</li>
            ))}
          </ul>
          <p>
            <b>Исследование:</b>
          </p>
          <ul>
            {Object.entries(v.reference.examination).map(([k, t]) => (
              <li>
                {content.evidence.find((e) => e.id === k)?.title}: {t}
              </li>
            ))}
          </ul>
          <p>
            <b>Телеграмма:</b> {v.reference.telegram}
          </p>
          <p class="tiny">TODO(кафедра): эталонную папку для каждого варианта пишет кафедра.</p>
        </div>
      </section>

      <section>
        <h2>Мост в сегодня</h2>
        {content.bridge.epilogue.map((p) => (
          <p class="teacher-voice">{p}</p>
        ))}
      </section>

      <section class="museum-link">
        <h2>В зале музея</h2>
        {twins.length ? (
          <ul>
            {twins.map((e) => {
              const ex = content.exhibits.exhibits.find((x) => x.id === e.museum.exhibit)!;
              return (
                <li>
                  {e.title} → <b>{ex.title}</b> ({ex.hall})
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="muted">Предметов-двойников вы пока не нашли.</p>
        )}
        <p>
          <b>{content.exhibits.promo.title}.</b> {content.exhibits.promo.text}
        </p>
      </section>

      <section class="print-only">
        <h2>Фототаблица</h2>
        <Phototable printable />
        <h2>План</h2>
        <PlanEditor readOnly />
      </section>

      <footer class="row no-print">
        <button onClick={() => window.print()}>Сохранить как PDF / печать</button>
        <button onClick={() => download(`dvoinoe-dno-${(st.settings.studentName || 'journal').replace(/\s+/g, '_')}.json`, JSON.stringify(exportJournal(j, st.settings.studentName), null, 1))}>Выгрузить журнал (JSON)</button>
        {onClose ? <button onClick={onClose}>Назад</button> : <button onClick={() => closeAll()}>В главное меню</button>}
      </footer>
    </div>
  );
}

function protocolTextFor(st: GameState) {
  return protocolText(st.folder ?? draft.value, st);
}

function describeEvent(e: GameEvent): string {
  switch (e.type) {
    case 'photo.taken':
      return `снимок № ${e.plate}`;
    case 'evidence.packaged':
      return `изъято: ${content.evidence.find((x) => x.id === e.id)?.title}`;
    case 'evidence.examined':
      return `осмотр: ${content.evidence.find((x) => x.id === e.id)?.title}`;
    case 'location.entered':
      return `переход: ${content.case.locations.find((l) => l.id === e.loc)?.title}`;
    case 'dialogue.choice':
      return `${personName(content, e.npc)}: «${e.text}»${e.tags.length ? ` [${e.tags.join(', ')}]` : ''}`;
    case 'timeline.fired':
      return content.case.timeline.find((x) => x.id === e.id)?.text ?? e.id;
    case 'telegram.sent':
      return 'телеграмма отправлена';
    case 'evidence.condition':
      return `${content.evidence.find((x) => x.id === e.id)?.title}: ${e.condition}`;
    default:
      return e.type;
  }
}

export function Debrief() {
  return <DebriefView j={journal.value} />;
}

// ---------------- «Экспозиция» ----------------
export function ExhibitFinale() {
  const s = state.value;
  const fin = content.case.exhibitFinale;
  const [signs, setSigns] = useState<string[]>([]);
  const [sus, setSus] = useState<string[]>([]);
  return (
    <Modal title="Сличение в кассе Госбанка" wide>
      <p>Кассир кладёт рядом фальшивую «четвертную». Какие из ваших находок совпадают с «почерком» подделки?</p>
      {fin.signs.map((x) => {
        const found = x.evidence.some((e) => s.evidence[e]?.examined);
        return (
          <label class={`check${found ? '' : ' muted'}`}>
            <input type="checkbox" disabled={!found} checked={signs.includes(x.id)} onChange={() => setSigns(signs.includes(x.id) ? signs.filter((y) => y !== x.id) : [...signs, x.id])} /> {x.text}
            {!found && <span class="tiny"> — этого вы в подвале не нашли</span>}
          </label>
        );
      })}
      <h3>Кто, по-вашему, в деле?</h3>
      <div class="suspects">
        {fin.suspects.map((id) => (
          <label class={`suspect${sus.includes(id) ? ' on' : ''}`}>
            <input type="checkbox" checked={sus.includes(id)} onChange={() => setSus(sus.includes(id) ? sus.filter((y) => y !== id) : [...sus, id])} />
            {personName(content, id)}
            <span class="tiny">{content.case.persons.find((p) => p.id === id)?.role}</span>
          </label>
        ))}
      </div>
      <div class="row">
        <button
          class="primary"
          onClick={() => {
            dispatch({ type: 'exhibitFinale', signs, suspects: sus });
            screen.value = 'exhibit_result';
          }}
        >
          Закрыть дело
        </button>
      </div>
    </Modal>
  );
}

export function ExhibitResult() {
  const s = state.value;
  const r = exhibitSummary(s, content);
  const ev = (id: string) => content.evidence.find((e) => e.id === id)!;
  const v = variantDef(s, content);
  return (
    <div class="debrief exhibit">
      <h1>Дело закрыто</h1>
      <p class="big-line">
        Найдено <b>{r.found.length}</b> из {r.total} улик подвала. Совпадений с подделкой: {r.signsCorrect} из {r.signsTotal}.
      </p>
      <p>{r.suspectsCorrect ? 'Вы верно назвали тех, кто в деле.' : 'С участниками вы ошиблись — или назвали не всех.'}</p>
      <section class="reveal">
        <h2>Как было на самом деле</h2>
        {v.reveal.map((p) => (
          <p>{p}</p>
        ))}
      </section>
      {r.missed.length > 0 && (
        <section>
          <h2>Что вы пропустили</h2>
          <ul>
            {r.missed.map((id) => (
              <li>
                <b>{ev(id).title}</b> — {ev(id).collection.hint || ev(id).describe.slice(0, 90) + '…'}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2>Следствие — это метод, а не озарение</h2>
        <p>Вы видели, как это работает: сначала смотреть и фиксировать, потом трогать; сличать находки с подделкой; связывать улики из разных мест.</p>
      </section>
      <section class="museum-link">
        <h2>Найдите в зале</h2>
        <ul>
          {content.exhibits.exhibits.map((x) => (
            <li>
              <b>{x.title}</b> — {x.hall}. {x.text}
            </li>
          ))}
        </ul>
        <p>
          <b>{content.exhibits.promo.title}.</b> {content.exhibits.promo.text}
        </p>
      </section>
      <button class="primary" onClick={() => closeAll()}>
        Новое следствие
      </button>
    </div>
  );
}
