// Редактор сцен (?editor, только dev-сборка): проходимые зоны, хотспоты, сектора, ориентиры, хрупкие зоны и выходы
// поверх фона. Перетаскивайте точки; «Скачать scene.json» — положить файл в content/cases/.../scenes/<id>/.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { content } from '../content';
import type { SceneDef } from '../content/schemas';
import { toScreen, toWorld, type Vec2 } from '../scene/iso';
import { scenePainting } from '../scene/photo-render';
import { download } from '../store/save';

type Layer = 'walkable' | 'sectors' | 'hotspots' | 'landmarks' | 'fragile' | 'exits' | 'props' | 'npcs';
const LAYERS: Layer[] = ['walkable', 'sectors', 'hotspots', 'landmarks', 'fragile', 'exits', 'props', 'npcs'];

export function Editor() {
  const ids = Object.keys(content.scenes);
  const [id, setId] = useState(ids.includes('cellar') ? 'cellar' : ids[0]);
  const [sc, setSc] = useState<SceneDef>(() => structuredClone(content.scenes[id]));
  const [on, setOn] = useState<Record<Layer, boolean>>({ walkable: true, sectors: true, hotspots: true, landmarks: true, fragile: true, exits: true, props: false, npcs: true });
  const [drag, setDrag] = useState<((w: Vec2) => void) | null>(null);
  const [info, setInfo] = useState('');
  const img = useRef<HTMLCanvasElement>(null);
  useEffect(() => setSc(structuredClone(content.scenes[id])), [id]);
  const painting = useMemo(() => scenePainting(content.scenes[id], new Set()), [id]);
  useEffect(() => {
    const c = img.current;
    if (!c) return;
    c.width = painting.width;
    c.height = painting.height;
    c.getContext('2d')!.drawImage(painting, 0, 0);
  }, [painting]);
  const P = (p: Vec2, z = 0) => toScreen(sc, p[0], p[1], z);
  const poly = (pts: Vec2[]) => pts.map((p) => P(p).join(',')).join(' ');
  const mutate = (fn: (s: SceneDef) => void) => {
    const n = structuredClone(sc);
    fn(n);
    setSc(n);
  };
  const handle = (p: Vec2, set: (w: Vec2) => void, color: string, label?: string) => {
    const [x, y] = P(p);
    return (
      <g onPointerDown={(e) => (e.stopPropagation(), setDrag(() => set), setInfo(label ?? `${p[0].toFixed(2)}, ${p[1].toFixed(2)}`))}>
        <circle cx={x} cy={y} r={7} fill={color} stroke="#000" style={{ cursor: 'move' }} />
        {label && (
          <text x={x + 9} y={y - 6} font-size={14} fill="#fff" stroke="#000" stroke-width={0.6}>
            {label}
          </text>
        )}
      </g>
    );
  };
  const round = (w: Vec2): Vec2 => [Math.round(w[0] * 20) / 20, Math.round(w[1] * 20) / 20];
  return (
    <div class="editor">
      <aside>
        <h2>Редактор сцен</h2>
        <select value={id} onChange={(e) => setId((e.target as HTMLSelectElement).value)}>
          {ids.map((x) => (
            <option>{x}</option>
          ))}
        </select>
        {LAYERS.map((l) => (
          <label class="check">
            <input type="checkbox" checked={on[l]} onChange={() => setOn({ ...on, [l]: !on[l] })} /> {l}
          </label>
        ))}
        <p class="tiny">{info}</p>
        <button onClick={() => download('scene.json', JSON.stringify(sc, null, 1))}>Скачать scene.json</button>
        <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(sc, null, 1))}>Копировать JSON</button>
        <p class="tiny">Координаты — в аршинах мира. Перетаскивайте точки. Сетка привязки — 1/20 аршина.</p>
      </aside>
      <div class="editor-stage">
        <canvas ref={img} />
        <svg
          viewBox={`0 0 ${sc.canvas[0]} ${sc.canvas[1]}`}
          onPointerMove={(e) => {
            if (!drag) return;
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * sc.canvas[0];
            const y = ((e.clientY - r.top) / r.height) * sc.canvas[1];
            const w = round(toWorld(sc, x, y));
            drag(w);
            setInfo(`${w[0]}, ${w[1]}`);
          }}
          onPointerUp={() => setDrag(null)}
        >
          {on.walkable && sc.walkable.map((pl, i) => <g><polygon points={poly(pl as Vec2[])} fill="rgba(80,200,120,0.15)" stroke="#5c8" />{pl.map((p, k) => handle(p as Vec2, (w) => mutate((s) => (s.walkable[i][k] = w)), '#5c8'))}</g>)}
          {on.sectors && sc.sectors.map((z, i) => <g><polygon points={poly(z.poly as Vec2[])} fill="none" stroke="#fc6" stroke-dasharray="6 4" />{z.poly.map((p, k) => handle(p as Vec2, (w) => mutate((s) => (s.sectors[i].poly[k] = w)), '#fc6', k === 0 ? z.title : undefined))}</g>)}
          {on.fragile && sc.fragile.map((z, i) => <g><polygon points={poly(z.poly as Vec2[])} fill="rgba(255,60,60,0.2)" stroke="#f55" />{z.poly.map((p, k) => handle(p as Vec2, (w) => mutate((s) => (s.fragile[i].poly[k] = w)), '#f55'))}</g>)}
          {on.hotspots &&
            sc.hotspots.map((h, i) => (
              <g>
                {handle(h.approach, (w) => mutate((s) => (s.hotspots[i].approach = w)), '#6cf', `${h.id} (подход)`)}
                {h.pos && handle(h.pos, (w) => mutate((s) => (s.hotspots[i].pos = w)), '#39f', h.id)}
              </g>
            ))}
          {on.landmarks && sc.landmarks.map((l, i) => handle(l.pos, (w) => mutate((s) => (s.landmarks[i].pos = w)), '#c6f', l.title))}
          {on.exits && sc.exits.map((x, i) => handle(x.pos, (w) => mutate((s) => (s.exits[i].pos = w)), '#fff', x.label))}
          {on.npcs && sc.npcs.map((n, i) => handle(n.pos, (w) => mutate((s) => (s.npcs[i].pos = w)), '#f9c', n.id))}
          {on.props && sc.props.map((p, i) => handle(p.pos, (w) => mutate((s) => (s.props[i].pos = w)), '#ddd', p.id))}
          {handle(sc.spawn, (w) => mutate((s) => (s.spawn = w)), '#ff0', 'spawn')}
        </svg>
      </div>
    </div>
  );
}
