import { useState } from 'preact/hooks';
import { content } from '../content';
import type { PhotoKind } from '../content/schemas';
import { PHOTO_KINDS } from '../content/schemas';
import { dispatch, modal, modalArg, openModal, prefs, say, setPrefs, state, isPracticum } from '../store/game';
import { closeModal, openItem, scene } from './controller';
import { KIND_RANGE, KIND_TITLE, photoTarget } from '../domain/photo-judge';
import { dist, formatArshin, inNoFlash } from '../domain/geometry';
import { factText, platesLeft, sceneOf, evidenceDef, personName } from '../domain/queries';
import { renderPlate } from '../scene/photo-render';
import { sfx } from '../audio/sound';
import { oldToModern } from '../domain/orthography';
import { formatClock } from '../domain/clock';
import { Notebook, Theories } from './Notebook';
import { CaseFolder } from './CaseFolder';
import { ExhibitFinale } from './Debrief';

export function Modal(props: { title: string; children: any; wide?: boolean; onClose?: () => void }) {
  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && (props.onClose ?? closeModal)()}>
      <div class={`modal${props.wide ? ' wide' : ''}`} role="dialog" aria-label={props.title}>
        <header>
          <h2>{props.title}</h2>
          <button class="x" onClick={props.onClose ?? closeModal} aria-label="Закрыть">
            ✕
          </button>
        </header>
        <div class="modal-body">{props.children}</div>
      </div>
    </div>
  );
}

const lampOnly = () => new Set(content.evidence.filter((e) => e.visibility.via === 'lamp').map((e) => e.id));

const DEFECT_TEXT: Record<string, string> = {
  dark: 'темно — кадр почти чёрный',
  smear: 'долгая выдержка — смаз',
  smoke: 'дым от магния',
  far: 'слишком далеко',
  near: 'слишком близко — нерезко',
  no_scale: 'без масштабной линейки',
  wrong_kind: 'этот вид съёмки здесь не годится',
  moved: 'предмет уже сдвинут с места',
};

function PhotoDialog() {
  const s = state.value;
  const loc = s.location!;
  const sc = sceneOf(content, loc)!;
  const initial = modalArg.value?.target as string | undefined;
  const targets = [
    ...sc.photoTargets.map((p) => ({ id: p.id, title: p.title })),
    ...content.evidence
      .filter((e) => e.location === loc && e.kind !== 'container' && e.variants.includes(s.settings.variant) && (s.evidence[e.id].detected || e.visibility.via === 'look'))
      .map((e) => ({ id: e.id, title: `${e.num}. ${e.title}` })),
  ];
  const [target, setTarget] = useState(initial ?? targets[0]?.id);
  const [kind, setKind] = useState<PhotoKind>(initial ? 'node' : 'overview');
  const [scale, setScale] = useState(true);
  const [mag, setMag] = useState(false);
  const tgt = target ? photoTarget(content, sc, target) : null;
  const tripod = s.tripod && s.tripod.loc === loc ? s.tripod.pos : null;
  const d = tripod && tgt ? dist(tripod, tgt.pos) : null;
  const left = platesLeft(s, content, loc);
  const chem = mag && tripod && tgt && (inNoFlash(sc, tripod) || inNoFlash(sc, tgt.pos));
  const shoot = () => {
    if (!target) return;
    const evs = dispatch({ type: 'photo', target, kind, scale, magnesium: mag });
    const ev = evs[0];
    if (!ev) return;
    if (ev.type === 'photo.refused') {
      say('npc', ev.reason === 'chemicals' ? 'Магний у реактивов жечь не стану, ваше высокоблагородие. Рванёт или потравимся — и пластинку загубим.' : ev.reason === 'no_plates' ? 'Пластинки кончились. Дальше — словами и карандашом.' : 'Треногу бы сперва поставить.', 'photographer');
      closeModal();
      return;
    }
    if (ev.type === 'photo.taken') {
      sfx(mag ? 'magnesium' : 'shutter');
      const rec = state.value.photos[state.value.photos.length - 1];
      const url = renderPlate(content, rec, lampOnly());
      const tt = targets.find((x) => x.id === target)?.title ?? target;
      const issues = ev.defects.map((x) => DEFECT_TEXT[x]).filter(Boolean);
      say('plate', `Пластинка № ${ev.plate}: ${KIND_TITLE[kind]} — ${tt}${issues.length ? ` (${issues.join('; ')})` : ''}`, undefined, { img: url });
      const verdict = rec.ok ? (issues.length ? 'Сойдёт, хоть и не первый сорт.' : 'Хороший кадр.') : 'Испорчена пластинка, ваше высокоблагородие.';
      say('npc', verdict, 'photographer');
      if (mag) say('system', 'После вспышки подвал затянуло дымом — минут десять снимать не стоит.');
    }
    closeModal();
    if (initial && evidenceDef(content, initial)) openItem(initial, true);
  };
  return (
    <Modal title="Фотопластинка">
      <p class="muted">
        Пластинок осталось: <b>{left}</b>. Тренога: {tripod ? 'стоит' : <b>не поставлена</b>}.{' '}
        {!tripod && (
          <button
            onClick={() => {
              const p = scene.playerPos();
              dispatch({ type: 'tripod', pos: p });
              scene.setTripod(p);
            }}
          >
            Поставить, где стою
          </button>
        )}
      </p>
      <label>
        Что снимать
        <select value={target} onChange={(e) => setTarget((e.target as HTMLSelectElement).value)}>
          {targets.map((t) => (
            <option value={t.id}>{t.title}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Вид съёмки</legend>
        {PHOTO_KINDS.map((k) => (
          <label class="radio">
            <input type="radio" checked={kind === k} onChange={() => setKind(k)} /> {KIND_TITLE[k]}{' '}
            <span class="muted">
              ({KIND_RANGE[k][0]}–{KIND_RANGE[k][1]} арш.)
            </span>
          </label>
        ))}
      </fieldset>
      <label class="check">
        <input type="checkbox" checked={scale} onChange={() => setScale(!scale)} /> Положить масштабную линейку
      </label>
      <label class="check">
        <input type="checkbox" checked={mag} onChange={() => setMag(!mag)} /> Жечь магний
      </label>
      {d != null && (
        <p class="muted">
          От треноги до предмета: {formatArshin(d)}. {s.lamp ? 'Лампа стоит на полу — косой свет.' : ''}
        </p>
      )}
      {chem && <p class="warn">Фотограф: «Рядом реактивы — магний не зажгу».</p>}
      <div class="row">
        <button class="primary" disabled={!tripod || left <= 0} onClick={shoot}>
          Снять (5 мин)
        </button>
        <button onClick={closeModal}>Отмена</button>
      </div>
    </Modal>
  );
}

function CollectDialog() {
  const s = state.value;
  const id = modalArg.value?.id as string;
  const ev = evidenceDef(content, id)!;
  const practicum = isPracticum.value;
  const [method, setMethod] = useState('');
  const [pack, setPack] = useState('');
  const [steps, setSteps] = useState<boolean[]>(content.packaging.sealSteps.map(() => false));
  const [hint, setHint] = useState(false);
  const sealed = steps.every(Boolean);
  const go = () => {
    const evs = dispatch({ type: 'collect', id, method, pack, sealed });
    const p = evs.find((e) => e.type === 'evidence.packaged');
    if (p && p.type === 'evidence.packaged') {
      sfx('seal');
      const r = state.value.evidence[id];
      say('system', `Изъято: ${ev.title}. ${r.condition === 'intact' ? 'Предмет цел.' : r.condition === 'degraded' ? 'Предмет повреждён.' : 'Предмет утрачен.'}`);
      if (r.condition !== 'intact') {
        for (const rule of content.packaging.rules)
          if (ev.materials.includes(rule.material)) {
            const mHit = rule.methodNotIn ? !rule.methodNotIn.includes(method) : rule.methodIn ? rule.methodIn.includes(method) : false;
            const pHit = rule.packNotIn ? !rule.packNotIn.includes(pack) : false;
            if (mHit || pHit) say('system', rule.text);
          }
      }
      if (ev.collection.gives) say('narr', ev.collection.gives);
    }
    closeModal();
    openItem(id, true);
  };
  return (
    <Modal title={`Изъятие: ${ev.title}`} wide>
      <div class="cols">
        <fieldset>
          <legend>1. Способ изъятия</legend>
          {content.packaging.methods.map((m) => (
            <label class={`radio${hint && ev.collection.methods.includes(m.id) ? ' good' : ''}`} title={m.text}>
              <input type="radio" checked={method === m.id} onChange={() => setMethod(m.id)} /> {m.title}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>2. Упаковка</legend>
          {content.packaging.packs.map((p) => (
            <label class={`radio${hint && ev.collection.packs.includes(p.id) ? ' good' : ''}`}>
              <input type="radio" checked={pack === p.id} onChange={() => setPack(p.id)} /> {p.title}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>3. Опечатать</legend>
          {content.packaging.sealSteps.map((st, i) => (
            <label class="check">
              <input type="checkbox" checked={steps[i]} onChange={() => setSteps(steps.map((v, k) => (k === i ? !v : v)))} /> {st}
            </label>
          ))}
          {practicum && (
            <p class={s.witnesses.present.length < 2 ? 'warn' : 'muted'}>
              Подписи понятых: {s.witnesses.present.length ? s.witnesses.present.map((w) => personName(content, w)).join(', ') : 'понятых нет'}
            </p>
          )}
        </fieldset>
      </div>
      {!practicum && (
        <p>
          <button onClick={() => setHint(true)}>Подсказка: как правильно?</button> {hint && <span class="muted">{ev.collection.hint}</span>}
        </p>
      )}
      <div class="row">
        <button class="primary" disabled={!method || !pack} onClick={go}>
          Изъять ({method === 'plaster_cast' ? 20 : 6} мин)
        </button>
        <button onClick={closeModal}>Отмена</button>
      </div>
    </Modal>
  );
}

function NoteDialog() {
  const [text, setText] = useState('');
  const about = modalArg.value?.about as string | undefined;
  return (
    <Modal title="Записать в книжку">
      <textarea rows={5} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Что видите — без выводов. Например: «На валике остатки зеленоватой краски»." />
      <div class="row">
        <button
          class="primary"
          disabled={!text.trim()}
          onClick={() => {
            dispatch({ type: 'note', text: text.trim(), about });
            say('system', `Записано: «${text.trim()}»`);
            closeModal();
          }}
        >
          Записать
        </button>
      </div>
    </Modal>
  );
}

export function TelegramDialog() {
  const s = state.value;
  const tg = content.case.telegram;
  const [dest, setDest] = useState(tg.destinations[0].id);
  const [steamer, setSteamer] = useState(false);
  const known = tg.descriptionFacts.filter((f) => s.facts[f]);
  const [desc, setDesc] = useState<string[]>([]);
  const [text, setText] = useState('');
  if (s.telegram)
    return (
      <Modal title="Телеграмма">
        <p>
          Отправлена в {formatClock(s.telegram.t)}: {tg.destinations.find((d) => d.id === s.telegram!.destination)?.title}.
        </p>
        <p class="doc-old">{s.telegram.text}</p>
      </Modal>
    );
  const compose = () =>
    `${tg.destinations.find((d) => d.id === dest)?.title.split(' — ')[0].toUpperCase()}. ПРОШУ ЗАДЕРЖАТЬ ${steamer ? 'НА ПАРОХОДЕ «ВОЛЖАНИН» ' : ''}${desc.map((f) => factText(s, content, f)).join(' ')} ${text} СУДЕБНЫЙ СЛЕДОВАТЕЛЬ`.replace(/\s+/g, ' ');
  return (
    <Modal title="Телеграмма о розыске" wide>
      <p class="muted">Жаров снесёт на телеграф (10 мин). Сейчас {formatClock(s.clock)}.</p>
      <label>
        Куда
        <select value={dest} onChange={(e) => setDest((e.target as HTMLSelectElement).value)}>
          {tg.destinations.map((d) => (
            <option value={d.id}>{d.title}</option>
          ))}
        </select>
      </label>
      <label class="check">
        <input type="checkbox" disabled={!s.facts[tg.steamerFact]} checked={steamer} onChange={() => setSteamer(!steamer)} /> Указать пароход и рейс{' '}
        {!s.facts[tg.steamerFact] && <span class="muted">(неизвестны)</span>}
      </label>
      <fieldset>
        <legend>Приметы и основания</legend>
        {known.length === 0 && <p class="muted">В книжке пока нет примет.</p>}
        {known.map((f) => (
          <label class="check">
            <input type="checkbox" checked={desc.includes(f)} onChange={() => setDesc(desc.includes(f) ? desc.filter((x) => x !== f) : [...desc, f])} /> {factText(s, content, f)}
          </label>
        ))}
      </fieldset>
      <textarea rows={2} placeholder="Дополнить своими словами" value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
      <p class="doc-old">{compose()}</p>
      <div class="row">
        <button
          class="primary"
          onClick={() => {
            dispatch({ type: 'telegram', destination: dest, steamer, description: desc, text: compose() });
            say('system', 'Жаров уходит на телеграф с бланком.');
            closeModal();
          }}
        >
          Отправить
        </button>
      </div>
    </Modal>
  );
}

function SettingsDialog() {
  const p = prefs.value;
  return (
    <Modal title="Настройки">
      <label>
        Размер текста: {Math.round(p.textScale * 100)}%
        <input type="range" min={1} max={1.6} step={0.1} value={p.textScale} onInput={(e) => setPrefs({ textScale: Number((e.target as HTMLInputElement).value) })} />
      </label>
      <label class="check">
        <input type="checkbox" checked={p.contrast} onChange={() => setPrefs({ contrast: !p.contrast })} /> Контрастная колонка текста
      </label>
      <label class="check">
        <input type="checkbox" checked={p.sound} onChange={() => setPrefs({ sound: !p.sound })} /> Звук
      </label>
      <label class="check">
        <input type="checkbox" checked={!p.timePressure} onChange={() => setPrefs({ timePressure: !p.timePressure })} /> Отключить давление временем (для новой сессии)
      </label>
      <p class="muted">Клавиатура: 1–9 — выбор реплики; Q / E — перебор предметов и людей на сцене, Enter — подойти; Esc — закрыть окно.</p>
    </Modal>
  );
}

function QrDialog() {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const s = state.value;
  return (
    <Modal title="Код с витрины музея">
      <p class="muted">У витрин музея есть таблички с кодами. Они открывают архивные документы — с ними расследовать легче.</p>
      <div class="row">
        <input value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} placeholder="например, DD-1913" />
        <button
          class="primary"
          onClick={() => {
            const evs = dispatch({ type: 'qr', code });
            const q = content.qr.codes.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
            if (!q) return setMsg('Такого кода нет.');
            setMsg(evs.length ? `Открыт документ: ${q.title}` : 'Этот документ уже открыт.');
            openModal('doc', { id: q.document });
          }}
        >
          Открыть
        </button>
      </div>
      {msg && <p>{msg}</p>}
      {s.qr.length > 0 && (
        <ul>
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
        </ul>
      )}
    </Modal>
  );
}

export function DocViewer({ id }: { id: string }) {
  const doc = content.documents[id];
  const [modern, setModern] = useState(false);
  if (!doc) return null;
  return (
    <Modal title={modern ? oldToModern(doc.title) : doc.title} wide>
      <button onClick={() => setModern(!modern)}>{modern ? 'Как в 1913 году' : 'В современной орфографии'}</button>
      <pre class={modern ? 'doc-modern' : 'doc-old'}>{modern ? oldToModern(doc.old) : doc.old}</pre>
    </Modal>
  );
}

function Portfolio() {
  return (
    <Modal title="Портфель следователя" wide>
      <table class="tbl">
        <thead>
          <tr>
            <th>Средство (1913)</th>
            <th>Задача</th>
            <th>Ограничение в игре</th>
            <th>Сегодня</th>
          </tr>
        </thead>
        <tbody>
          {content.tools.tools.map((t) => (
            <tr>
              <td>{t.title}</td>
              <td>{t.task}</td>
              <td>{t.limit}</td>
              <td>{t.today}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="muted">Документы дела:</p>
      <ul>
        <li>
          <a href="#" onClick={(e) => (e.preventDefault(), openModal('doc', { id: 'doc_case_cover' }))}>
            Обложка дела из фондов музея
          </a>
        </li>
      </ul>
    </Modal>
  );
}

export function Dialogs() {
  switch (modal.value) {
    case 'photo':
      return <PhotoDialog />;
    case 'collect':
      return <CollectDialog />;
    case 'note':
      return <NoteDialog />;
    case 'telegram':
      return <TelegramDialog />;
    case 'settings':
      return <SettingsDialog />;
    case 'qr':
      return <QrDialog />;
    case 'doc':
      return <DocViewer id={modalArg.value?.id} />;
    case 'portfolio':
      return <Portfolio />;
    case 'notebook':
      return <Notebook />;
    case 'theories':
      return <Theories />;
    case 'folder':
      return <CaseFolder />;
    case 'finale':
      return <ExhibitFinale />;
    default:
      return null;
  }
}
