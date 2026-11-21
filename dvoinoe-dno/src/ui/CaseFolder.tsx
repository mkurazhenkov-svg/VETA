import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { content } from '../content';
import type { Role } from '../content/schemas';
import type { CaseFolder as Folder } from '../domain/events';
import { dispatch, openModal, screen, state } from '../store/game';
import { lsGet, lsSet } from '../store/save';
import { Modal } from './dialogs';
import { PlanEditor, Phototable } from './Notebook';
import { findConclusions, protocolLine } from '../domain/protocol-check';
import { modernToOld } from '../domain/orthography';
import { formatClock } from '../domain/clock';
import { factText, personName } from '../domain/queries';
import { ink } from './controller';

export const ROLE_TITLES: Record<Role, string> = {
  none: 'не причастен',
  organizer: 'организатор',
  maker: 'изготовитель',
  seller: 'сбытчик',
  concealer: 'укрыватель',
  patron: 'покровитель',
};

const empty: Folder = { protocol: { include: [], extra: '' }, examination: [], accusation: {}, theories: [] };
export const draft = signal<Folder>(lsGet('dd.folder', empty));
function setDraft(f: Folder) {
  draft.value = f;
  lsSet('dd.folder', f);
}
export function resetDraft() {
  setDraft({ ...empty, protocol: { include: [], extra: '' } });
}

export function protocolText(f: Folder, s = state.value) {
  const head = `ПРОТОКОЛ ОСМОТРА\n${content.case.date}, г. Нижний Новгород. Судебный следователь произвёл осмотр подвального помещения «Фотографии и переплётной И. Ветлугина». Понятые: ${s.witnesses.chosen.map((w) => personName(content, w)).join(', ') || 'не приглашены'}.`;
  const lines = f.protocol.include.map((id) => protocolLine(s, content, id)).filter(Boolean);
  return [head, ...lines, f.protocol.extra.trim()].filter(Boolean).join('\n');
}

export function CaseFolder() {
  const s = state.value;
  const f = draft.value;
  const [tab, setTab] = useState<'protocol' | 'inventory' | 'plan' | 'photos' | 'exam' | 'telegram' | 'persons' | 'submit'>('protocol');
  const [old, setOld] = useState(false);
  const candidates = content.evidence.filter((e) => (e.kind === 'evidence' || e.kind === 'false_trace' || e.kind === 'container') && s.evidence[e.id]?.examined && e.variants.includes(s.settings.variant));
  const collected = content.evidence.filter((e) => s.evidence[e.id]?.collected);
  const conclusions = findConclusions(f.protocol.extra, content.rules.protocolConclusionWords);
  const inChamber = s.location === 'chamber';
  const toggleInc = (id: string) =>
    setDraft({ ...f, protocol: { ...f.protocol, include: f.protocol.include.includes(id) ? f.protocol.include.filter((x) => x !== id) : [...f.protocol.include, id] } });
  const exObjs = content.case.examination.objects.filter((o) => s.evidence[o.evidence]?.collected);
  const setExam = (evidence: string, patch: Partial<Folder['examination'][number]>) => {
    const cur = f.examination.find((x) => x.evidence === evidence) ?? { evidence, addressee: '', questions: [] };
    setDraft({ ...f, examination: [...f.examination.filter((x) => x.evidence !== evidence), { ...cur, ...patch }] });
  };
  return (
    <Modal title="Папка дела" wide>
      <div class="tabs">
        {(
          [
            ['protocol', 'Протокол осмотра'],
            ['inventory', 'Опись изъятого'],
            ['plan', 'План'],
            ['photos', 'Фототаблица'],
            ['exam', 'Отношение об исследовании'],
            ['telegram', 'Телеграмма'],
            ['persons', 'Версии и участники'],
            ['submit', 'Сдать дело'],
          ] as const
        ).map(([id, t]) => (
          <button class={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'protocol' && (
        <div class="cols">
          <div>
            <p class="muted">Строки протокола собираются из ваших записей. Отметьте, что внести, и допишите своими словами — без выводов.</p>
            <button onClick={() => setDraft({ ...f, protocol: { ...f.protocol, include: candidates.map((e) => e.id) } })}>Внести всё осмотренное</button>
            <ul class="inc">
              {candidates.map((e) => (
                <li>
                  <label class="check">
                    <input type="checkbox" checked={f.protocol.include.includes(e.id)} onChange={() => toggleInc(e.id)} /> {e.num}. {e.title}
                    {s.evidence[e.id].collected && <span class="tiny"> (изъято)</span>}
                  </label>
                </li>
              ))}
            </ul>
            <textarea rows={6} value={f.protocol.extra} placeholder="Описательная часть своими словами: что видно, где, в каком состоянии." onInput={(e) => setDraft({ ...f, protocol: { ...f.protocol, extra: (e.target as HTMLTextAreaElement).value } })} />
            {conclusions.length > 0 && <p class="warn">В описательной части есть выводы: {conclusions.join(', ')}… Протокол описывает, а выводы делает экспертиза.</p>}
          </div>
          <div>
            <button onClick={() => setOld(!old)}>{old ? 'Современная орфография' : 'Как документ 1913 года'}</button>
            <pre class={old ? 'doc-old' : 'doc-modern'}>{old ? modernToOld(protocolText(f)) : protocolText(f)}</pre>
          </div>
        </div>
      )}
      {tab === 'inventory' && (
        <table class="tbl">
          <thead>
            <tr>
              <th>№</th>
              <th>Что изъято</th>
              <th>Способ</th>
              <th>Упаковка</th>
              <th>Опечатано</th>
              <th>Подписи понятых</th>
              <th>Состояние</th>
            </tr>
          </thead>
          <tbody>
            {collected.map((e) => {
              const es = s.evidence[e.id];
              return (
                <tr>
                  <td>{e.num}</td>
                  <td>{e.protocolName}</td>
                  <td>{content.packaging.methods.find((m) => m.id === es.method)?.title}</td>
                  <td>{content.packaging.packs.find((m) => m.id === es.pack)?.title}</td>
                  <td>{es.sealed ? 'да' : <b class="warn">нет</b>}</td>
                  <td>{es.signedBy?.length ? es.signedBy.map((w) => personName(content, w)).join(', ') : <b class="warn">нет</b>}</td>
                  <td>{es.condition === 'intact' ? 'цел' : es.condition === 'degraded' ? 'повреждён' : 'утрачен'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {tab === 'plan' && <PlanEditor />}
      {tab === 'photos' && <Phototable />}
      {tab === 'exam' && (
        <div>
          <p class="muted">В Нижнем своего кабинета научно-судебной экспертизы нет. Решите, куда и с какими вопросами направить объекты. Эксперту — вопросы о предметах, а не о виновных.</p>
          {exObjs.length === 0 && <p class="muted">Изъятых объектов для исследования пока нет.</p>}
          {exObjs.map((o) => {
            const ev = content.evidence.find((e) => e.id === o.evidence)!;
            const cur = f.examination.find((x) => x.evidence === o.evidence);
            return (
              <fieldset>
                <legend>
                  {ev.num}. {ev.title}
                </legend>
                <label>
                  Куда направить
                  <select value={cur?.addressee ?? ''} onChange={(e) => setExam(o.evidence, { addressee: (e.target as HTMLSelectElement).value })}>
                    <option value="">— не направлять —</option>
                    {content.case.examination.addressees.map((a) => (
                      <option value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </label>
                {content.case.examination.questions
                  .filter((q) => q.for.includes('*') || q.for.includes(o.evidence))
                  .map((q) => (
                    <label class="check">
                      <input
                        type="checkbox"
                        checked={cur?.questions.includes(q.id) ?? false}
                        onChange={() => {
                          const qs = cur?.questions ?? [];
                          setExam(o.evidence, { questions: qs.includes(q.id) ? qs.filter((x) => x !== q.id) : [...qs, q.id] });
                        }}
                      />{' '}
                      {q.text}
                    </label>
                  ))}
              </fieldset>
            );
          })}
          <p class="tiny">Маршруты объектов — черновик: {content.case.examination.addressees.map((a) => `${a.title}: ${a.status}`).join('; ')}.</p>
        </div>
      )}
      {tab === 'telegram' && (
        <div>
          {s.telegram ? (
            <p>
              Телеграмма отправлена в {formatClock(s.telegram.t)}: <span class="doc-old">{s.telegram.text}</span>
            </p>
          ) : (
            <p>
              Телеграмма не отправлена. Срок — до {content.case.telegram.deadline}. <button onClick={() => openModal('telegram')}>Составить</button>
            </p>
          )}
        </div>
      )}
      {tab === 'persons' && (
        <div class="cols">
          <div>
            <h3>Участники</h3>
            {content.case.persons
              .filter((p) => p.accusable)
              .map((p) => (
                <label class="persons">
                  <span>{p.name}</span>
                  <select value={f.accusation[p.id] ?? 'none'} onChange={(e) => setDraft({ ...f, accusation: { ...f.accusation, [p.id]: (e.target as HTMLSelectElement).value as Role } })}>
                    {(Object.keys(ROLE_TITLES) as Role[]).map((r) => (
                      <option value={r}>{ROLE_TITLES[r]}</option>
                    ))}
                  </select>
                </label>
              ))}
          </div>
          <div>
            <h3>Версия, которую вы поддерживаете</h3>
            {content.theories
              .filter((t) => s.theories[t.id])
              .map((t) => (
                <label class="check">
                  <input type="checkbox" checked={f.theories.includes(t.id)} onChange={() => setDraft({ ...f, theories: f.theories.includes(t.id) ? f.theories.filter((x) => x !== t.id) : [...f.theories, t.id] })} /> {t.title}
                  <span class="tiny"> — за: {t.supports.filter((x) => s.facts[x]).map((x) => factText(s, content, x).slice(0, 40) + '…').join('; ') || 'нет фактов'}</span>
                </label>
              ))}
          </div>
        </div>
      )}
      {tab === 'submit' && (
        <div>
          {!inChamber && <p class="warn">Сдать дело можно в камере судебного следователя (карта города → «Камера следователя»).</p>}
          <p>Сейчас {formatClock(s.clock)}. Изъято предметов: {collected.length}. Снимков: {s.photos.length}. Фактов в книжке: {s.factOrder.length}.</p>
          <p class="muted">После сдачи дела — разбор: что вы нашли, где ошиблись и как то же делают сегодня.</p>
          <button
            class="primary"
            disabled={!inChamber}
            onClick={() => {
              dispatch({ type: 'submit', folder: f });
              ink.stop();
              screen.value = 'debrief';
            }}
          >
            Сдать дело
          </button>
        </div>
      )}
    </Modal>
  );
}
