import { useState } from 'preact/hooks';
import { content } from '../content';
import { dispatch, isPracticum, openModal, say, state } from '../store/game';
import { Modal } from './dialogs';
import { factText, sceneOf } from '../domain/queries';
import { formatClock } from '../domain/clock';
import { KIND_TITLE } from '../domain/photo-judge';
import { renderPlate } from '../scene/photo-render';
import { checkPlan } from '../domain/protocol-check';
import { formatArshin } from '../domain/geometry';
import { skillTitle } from '../ink/runtime-adapter';
import type { Vec2 } from '../domain/geometry';

const KIND_NAMES: Record<string, string> = {
  bank: 'Касса Госбанка',
  evidence: 'Осмотр',
  testimony: 'Показания',
  document: 'Документы',
  inference: 'Выводы',
  archive: 'Архив музея',
};

const lampOnly = () => new Set(content.evidence.filter((e) => e.visibility.via === 'lamp').map((e) => e.id));

export function Phototable({ printable = false }: { printable?: boolean }) {
  const s = state.value;
  if (!s.photos.length) return <p class="muted">Снимков пока нет.</p>;
  return (
    <div class={`phototable${printable ? ' print' : ''}`}>
      {s.photos.map((p) => {
        const ev = content.evidence.find((e) => e.id === p.target);
        const pt = Object.values(content.scenes).flatMap((sc) => sc.photoTargets).find((x) => x.id === p.target);
        const cap = `№ ${p.plate} · ${KIND_TITLE[p.kind]} · ${ev ? `${ev.num}. ${ev.title}` : pt?.title ?? p.target}${p.scale ? ' · с масштабом' : ''} · ${formatClock(p.t)}${p.ok ? '' : ' · брак'}`;
        return (
          <figure>
            <img src={renderPlate(content, p, lampOnly())} alt={cap} />
            <figcaption>{cap}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/** План от руки: контур подвала, ориентиры, стрелка севера, точки съёмки; номера улик перетаскиваются. */
export function PlanEditor({ loc = 'cellar', readOnly = false }: { loc?: string; readOnly?: boolean }) {
  const s = state.value;
  const sc = sceneOf(content, loc);
  const [drag, setDrag] = useState<string | null>(null);
  if (!sc) return null;
  const pts = sc.room.floor;
  const maxX = Math.max(...pts.map((p) => p[0]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const k = 36;
  const W = maxX * k + 160;
  const H = maxY * k + 60;
  const ox = 20;
  const oy = 20;
  const evs = content.evidence.filter((e) => e.location === loc && e.kind === 'evidence' && s.evidence[e.id]?.detected && e.variants.includes(s.settings.variant));
  const checks = checkPlan(s, content, loc);
  const toPlan = (p: Vec2) => [ox + p[0] * k, oy + p[1] * k];
  const onDrop = (e: PointerEvent) => {
    if (!drag || readOnly) return;
    const svg = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = ((e.clientX - svg.left) / svg.width) * W;
    const y = ((e.clientY - svg.top) / svg.height) * H;
    const wx = (x - ox) / k;
    const wy = (y - oy) / k;
    if (wx >= 0 && wy >= 0 && wx <= maxX && wy <= maxY) dispatch({ type: 'plan', id: drag, pos: [Math.round(wx * 10) / 10, Math.round(wy * 10) / 10] });
    setDrag(null);
  };
  const north = (sc.north * Math.PI) / 180;
  return (
    <div class="plan">
      <svg viewBox={`0 0 ${W} ${H}`} onPointerUp={onDrop} onPointerLeave={() => setDrag(null)} style={{ touchAction: 'none' }}>
        <rect x={0} y={0} width={W} height={H} fill="#efe6cf" />
        <polygon points={pts.map((p) => toPlan(p as Vec2).join(',')).join(' ')} fill="none" stroke="#3a2a1a" stroke-width={2.5} />
        {sc.sectors.map((z) => (
          <polygon points={z.poly.map((p) => toPlan(p as Vec2).join(',')).join(' ')} fill="none" stroke="#a89878" stroke-dasharray="4 4" />
        ))}
        {sc.landmarks.map((l) => {
          const [x, y] = toPlan(l.pos);
          return (
            <g>
              <rect x={x - 6} y={y - 6} width={12} height={12} fill="#6a4a2a" />
              <text x={x + 9} y={y + 4} font-size={12} fill="#3a2a1a">
                {l.title}
              </text>
            </g>
          );
        })}
        {s.photos
          .filter((p) => p.loc === loc && p.tripod)
          .map((p) => {
            const [x, y] = toPlan(p.tripod!);
            return (
              <g>
                <circle cx={x} cy={y} r={4} fill="none" stroke="#7a3a2a" />
                <text x={x + 5} y={y - 4} font-size={9} fill="#7a3a2a">
                  ф{p.plate}
                </text>
              </g>
            );
          })}
        <g transform={`translate(${W - 50},50)`}>
          <line x1={0} y1={0} x2={Math.sin(north) * 26} y2={-Math.cos(north) * 26} stroke="#3a2a1a" stroke-width={2} />
          <text x={Math.sin(north) * 34 - 4} y={-Math.cos(north) * 34 + 4} font-size={13}>
            С
          </text>
        </g>
        {evs.map((e, i) => {
          const es = s.evidence[e.id];
          const pos = es.plan ? toPlan(es.plan) : [maxX * k + 60 + (i % 2) * 40, oy + 14 + Math.floor(i / 2) * 30];
          const ch = checks.find((c) => c.id === e.id);
          return (
            <g style={{ cursor: readOnly ? 'default' : 'grab' }} onPointerDown={() => !readOnly && setDrag(e.id)}>
              <circle cx={pos[0]} cy={pos[1]} r={11} fill={drag === e.id ? '#c9a45a' : ch?.bound ? '#7a2a1a' : '#9a7a5a'} />
              <text x={pos[0]} y={pos[1] + 4} font-size={11} text-anchor="middle" fill="#fff">
                {e.num}
              </text>
            </g>
          );
        })}
      </svg>
      {!readOnly && (
        <p class="muted">
          Перетащите номера улик на план. Тёмно-красный номер — есть привязка к двум ориентирам (измерения). По привязкам место находки должно восстанавливаться.
        </p>
      )}
      <ul class="plan-list">
        {evs.map((e) => {
          const es = s.evidence[e.id];
          const ms = Object.entries(es.measured);
          return (
            <li>
              {e.num}. {e.title}: {ms.length ? ms.map(([l, a]) => `${sc.landmarks.find((x) => x.id === l)?.title} — ${formatArshin(a)}`).join('; ') : <span class="muted">не измерено</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Notebook() {
  const s = state.value;
  const [tab, setTab] = useState<'facts' | 'notes' | 'photos' | 'plan' | 'docs' | 'zharov'>('facts');
  const groups: Record<string, string[]> = {};
  for (const id of s.factOrder) {
    const f = content.facts.find((x) => x.id === id);
    if (!f) continue;
    (groups[f.kind] ??= []).push(id);
  }
  return (
    <Modal title="Записная книжка" wide>
      <div class="tabs">
        {(
          [
            ['facts', 'Факты'],
            ['notes', 'Записи'],
            ['photos', 'Фототаблица'],
            ['plan', 'План подвала'],
            ['docs', 'Документы'],
          ] as const
        ).map(([id, t]) => (
          <button class={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'facts' &&
        (s.factOrder.length === 0 ? (
          <p class="muted">Пока пусто.</p>
        ) : (
          Object.entries(groups).map(([k, ids]) => (
            <section>
              <h3>{KIND_NAMES[k] ?? k}</h3>
              <ul class="facts">
                {ids.map((id) => (
                  <li class={s.facts[id].unreliable ? 'unreliable' : ''}>
                    <span class="t">{formatClock(s.facts[id].t)}</span> {factText(s, content, id)}
                    {s.facts[id].unreliable && <span class="tiny"> — ненадёжно: наводящий вопрос или давление</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))
        ))}
      {tab === 'notes' && (
        <>
          <button onClick={() => openModal('note')}>Новая запись</button>
          <ul class="facts">
            {s.notes.map((n) => (
              <li>
                <span class="t">{formatClock(n.t)}</span> {n.text}
              </li>
            ))}
          </ul>
        </>
      )}
      {tab === 'photos' && <Phototable />}
      {tab === 'plan' && <PlanEditor />}
      {tab === 'docs' && (
        <ul>
          <li>
            <a href="#" onClick={(e) => (e.preventDefault(), openModal('doc', { id: 'doc_case_cover' }))}>
              Обложка дела
            </a>
          </li>
          {s.qr.map((c) => {
            const q = content.qr.codes.find((x) => x.code === c)!;
            return (
              <li>
                <a href="#" onClick={(e) => (e.preventDefault(), openModal('doc', { id: q.document }))}>
                  {q.title}
                </a>
              </li>
            );
          })}
          {isPracticum.value && s.facts['f_skobtsov_card'] && (
            <li>
              <a href="#" onClick={(e) => (e.preventDefault(), openModal('doc', { id: 'doc_police_circular' }))}>
                Циркуляр сыскного отделения
              </a>
            </li>
          )}
        </ul>
      )}
    </Modal>
  );
}

export function Theories() {
  const s = state.value;
  const list = content.theories.filter((t) => s.theories[t.id]);
  return (
    <Modal title="Картотека версий" wide>
      <p class="muted">
        «Обдумать» версию — потратить время. Обдуманная версия усиливает связанные голоса, но даёт туннельное зрение: то, что ей противоречит, замечается хуже.
      </p>
      {list.length === 0 && <p class="muted">Версий пока нет — они рождаются из фактов.</p>}
      <div class="cards">
        {list.map((t) => {
          const st = s.theories[t.id];
          const pro = t.supports.filter((f) => s.facts[f]);
          const contra = t.contradicts.filter((f) => s.facts[f]);
          return (
            <article class={`card ${st}`}>
              <h3>{t.title}</h3>
              <p>{t.text}</p>
              <p class="tiny">
                Голос: {skillTitle(t.voice)} · {st === 'internalized' ? 'обдумана' : st === 'discarded' ? 'отброшена' : 'не обдумана'}
              </p>
              {pro.length > 0 && (
                <div>
                  <b>За:</b>
                  <ul>
                    {pro.map((f) => (
                      <li>{factText(s, content, f)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {contra.length > 0 && (
                <div>
                  <b>Против:</b>
                  <ul>
                    {contra.map((f) => (
                      <li>{factText(s, content, f)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div class="row">
                {st === 'revealed' && (
                  <button
                    onClick={() => {
                      dispatch({ type: 'theoryThink', id: t.id });
                      say('voice', `Вы обдумываете: «${t.title}».`, t.voice);
                    }}
                  >
                    Обдумать ({t.thinkMinutes} мин)
                  </button>
                )}
                {st !== 'discarded' && <button onClick={() => dispatch({ type: 'theoryDiscard', id: t.id })}>Отбросить</button>}
              </div>
            </article>
          );
        })}
      </div>
    </Modal>
  );
}
