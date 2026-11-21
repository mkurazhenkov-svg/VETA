// Слой сцены: PixiJS. Сцена только сообщает факты (дошёл, кликнул, лампа здесь) — решения принимает домен.
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { SceneDef } from '../content/schemas';
import { toScreen, toWorld, pointInPoly, hash, prng, type Vec2 } from './iso';
import { NavGrid } from './navmesh';
import { sceneArt, loadImage } from './art';
import { hex, makeCanvas, paintBackground, paintFigure, paintMarks, paintProp, rgba, type Look } from './painter';

export interface SceneCallbacks {
  onArrive(to: Vec2, sector: string | null, fragileHit: string | undefined, threshold: boolean | undefined): void;
  onHotspot(id: string): void;
  onNpc(id: string, knot: string): void;
  onExit(id: string, to: string): void;
  onTripod(pos: Vec2): void;
  onLamp(pos: Vec2, revealed: string[]): void;
  onHover?(label: string | null): void;
}

export interface LoadOptions {
  people: Record<string, Look>;
  playerLook: Look;
  followers: string[];
  npcVisible: (id: string) => boolean;
  lampOnly: Set<string>;
  activeHotspots: Set<string>;
  startPos?: Vec2;
}

interface Actor {
  id: string;
  look: Look;
  pos: Vec2;
  path: Vec2[];
  sprite: Sprite;
  frames: Texture[];
  foot: Vec2;
  phase: number;
  npcKnot?: string;
  follower?: boolean;
  back: boolean;
  breath: number;
}

interface Drawable {
  obj: Container;
  box: [number, number, number, number]; // x0,y0,x1,y1 в мире
  z: number;
  actor?: Actor;
}

const SPEED = 3.2; // аршин в секунду
const LAMP_R = 2.4;

export class SceneView {
  app = new Application();
  private world = new Container();
  private layer = new Container();
  private overlay = new Container();
  private ui = new Container();
  private scene: SceneDef | null = null;
  private nav: NavGrid | null = null;
  private drawables: Drawable[] = [];
  private actors: Actor[] = [];
  private player: Actor | null = null;
  private cb: SceneCallbacks;
  private hullByProp: Record<string, Vec2[]> = {};
  private baseCanvas: HTMLCanvasElement | null = null;
  private hiddenCanvas: HTMLCanvasElement | null = null;
  private dark = makeCanvas(400, 250);
  private darkTex: Texture | null = null;
  private lampCanvas = makeCanvas(800, 500);
  private lampTex: Texture | null = null;
  private lampPos: Vec2 | null = null;
  private tripodG = new Graphics();
  private highlightG = new Graphics();
  private focusG = new Graphics();
  private hoverText: Text | null = null;
  private opts: LoadOptions | null = null;
  private tool: 'walk' | 'tripod' = 'walk';
  private highlight: string[] = [];
  private time = 0;
  private trail: Vec2[] = [];
  private focusIdx = -1;
  private mounted = false;
  private needSort = true;
  private onArrival: (() => void) | null = null;
  ready: Promise<void>;
  private resolveReady!: () => void;

  constructor(cb: SceneCallbacks) {
    this.cb = cb;
    this.ready = new Promise((r) => (this.resolveReady = r));
  }

  async mount(el: HTMLElement) {
    if (this.mounted) {
      el.appendChild(this.app.canvas);
      this.app.resizeTo = el;
      return;
    }
    this.mounted = true;
    await this.app.init({ background: '#d8ccb4', resizeTo: el, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1) });
    el.appendChild(this.app.canvas);
    this.app.canvas.setAttribute('aria-label', 'Сцена');
    this.layer.sortableChildren = true;
    this.world.addChild(this.layer, this.overlay, this.ui);
    this.overlay.addChild(this.highlightG, this.tripodG, this.focusG);
    this.app.stage.addChild(this.world);
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointertap', (e) => {
      const p = this.world.toLocal(e.global);
      this.click(p.x, p.y);
    });
    this.app.stage.on('pointermove', (e) => {
      const p = this.world.toLocal(e.global);
      this.hover(p.x, p.y);
    });
    this.app.ticker.add((t) => this.tick(t.deltaMS / 1000));
    this.resolveReady();
  }

  getBaseCanvas() {
    return this.baseCanvas;
  }
  getScene() {
    return this.scene;
  }

  load(scene: SceneDef, opts: LoadOptions) {
    this.scene = scene;
    this.opts = opts;
    this.layer.removeChildren();
    this.ui.removeChildren();
    this.drawables = [];
    this.actors = [];
    this.hullByProp = {};
    this.lampPos = null;
    this.tripodG.clear();
    this.focusIdx = -1;
    this.trail = [];
    this.nav = new NavGrid(scene);

    this.baseCanvas = paintBackground(scene, { lampOnly: opts.lampOnly });
    this.app.renderer.background.color = scene.palette.grunt;
    (this.app.canvas.parentElement as HTMLElement | null)?.style.setProperty('background', scene.palette.grunt);
    const bg = new Sprite(Texture.from(this.baseCanvas));
    bg.zIndex = -100000;
    this.layer.addChild(bg);
    const art = sceneArt(scene.id, 'base');
    if (art)
      loadImage(art).then((img) => {
        if (this.scene !== scene) return;
        const c = makeCanvas(scene.canvas[0], scene.canvas[1]);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        this.baseCanvas = c;
        bg.texture = Texture.from(c);
      });

    for (const p of scene.props) {
      const ps = paintProp(scene, p);
      const sp = new Sprite(Texture.from(ps.canvas));
      sp.position.set(ps.x, ps.y);
      this.layer.addChild(sp);
      this.hullByProp[p.id] = ps.hull;
      const flat = p.shape === 'flat' && (p.z ?? 0) < 0.1;
      this.drawables.push({
        obj: sp,
        box: [p.pos[0] - p.size[0] / 2, p.pos[1] - p.size[1] / 2, p.pos[0] + p.size[0] / 2, p.pos[1] + p.size[1] / 2],
        z: (p.z ?? 0) + (flat ? -50 : 0),
      });
    }

    // скрытый слой (виден только в круге света лампы)
    this.hiddenCanvas = paintMarks(scene, (id) => opts.lampOnly.has(id));
    const hiddenArt = sceneArt(scene.id, 'hidden');
    if (hiddenArt)
      loadImage(hiddenArt).then((img) => {
        const c = makeCanvas(scene.canvas[0], scene.canvas[1]);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        this.hiddenCanvas = c;
      });
    const lctx = this.lampCanvas.getContext('2d')!;
    lctx.clearRect(0, 0, 800, 500);
    this.lampTex = Texture.from(this.lampCanvas);
    const lampSprite = new Sprite(this.lampTex);
    lampSprite.scale.set(scene.canvas[0] / 800, scene.canvas[1] / 500);
    lampSprite.zIndex = -90000;
    this.layer.addChild(lampSprite);

    // люди
    const start = opts.startPos ?? scene.spawn;
    this.player = this.makeActor('player', opts.playerLook, start, true);
    for (const n of scene.npcs) {
      if (!opts.npcVisible(n.id)) continue;
      const look = opts.people[n.person ?? n.id];
      if (!look) continue;
      const a = this.makeActor(n.id, look, n.pos);
      a.npcKnot = n.knot;
    }
    this.setFollowers(opts.followers);

    // свет и тень
    this.darkTex = Texture.from(this.dark);
    const darkSprite = new Sprite(this.darkTex);
    darkSprite.scale.set(scene.canvas[0] / 400, scene.canvas[1] / 250);
    this.ui.addChild(darkSprite);
    // таблички выходов
    for (const x of scene.exits) {
      const p = toScreen(scene, x.pos[0], x.pos[1], 0.2);
      const t = new Text({ text: `⟶ ${x.label}`, style: { fontFamily: 'PT Serif, serif', fontSize: 22, fill: '#f3e6c8', stroke: { color: '#1a1410', width: 4 } } });
      t.anchor.set(0.5, 1);
      t.position.set(p[0], p[1] - 8);
      t.alpha = 0.85;
      this.ui.addChild(t);
    }
    this.hoverText = new Text({ text: '', style: { fontFamily: 'PT Serif, serif', fontSize: 22, fill: '#fff4dc', stroke: { color: '#120e0a', width: 4 } } });
    this.hoverText.anchor.set(0.5, 1);
    this.ui.addChild(this.hoverText);
    this.renderDarkness();
    this.layout();
    this.needSort = true;
  }

  private makeActor(id: string, look: Look, pos: Vec2, isPlayer = false): Actor {
    const k = this.scene!.pxPerArshin;
    // стоит + 4 фазы шага × (лицом / спиной)
    const figs = [false, true].flatMap((back) => [0, 1, 2, 3, 4].map((f) => paintFigure(look, k, f, id, back)));
    const f0 = figs[0];
    const sprite = new Sprite(Texture.from(f0.canvas));
    sprite.anchor.set(f0.foot[0] / f0.canvas.width, f0.foot[1] / f0.canvas.height);
    this.layer.addChild(sprite);
    const a: Actor = { id, look, pos: [...pos] as Vec2, path: [], sprite, frames: figs.map((f) => Texture.from(f.canvas)), foot: f0.foot, phase: 0, back: false, breath: (hash(id) % 100) / 16 };
    this.actors.push(a);
    this.drawables.push({ obj: sprite, box: [pos[0] - 0.2, pos[1] - 0.2, pos[0] + 0.2, pos[1] + 0.2], z: 0, actor: a });
    if (isPlayer) a.sprite.label = 'player';
    this.placeActor(a);
    return a;
  }

  setFollowers(ids: string[]) {
    if (!this.scene || !this.opts || !this.player) return;
    // удалить ушедших
    for (const a of [...this.actors]) {
      if (a.follower && !ids.includes(a.id)) {
        this.layer.removeChild(a.sprite);
        this.actors = this.actors.filter((x) => x !== a);
        this.drawables = this.drawables.filter((d) => d.actor !== a);
      }
    }
    ids.forEach((id, i) => {
      if (this.actors.some((a) => a.id === id)) return;
      const look = this.opts!.people[id];
      if (!look) return;
      const p = this.nav?.nearest([this.player!.pos[0] - 0.8 - i * 0.5, this.player!.pos[1] + 0.6 + (i % 2) * 0.5]) ?? this.player!.pos;
      const a = this.makeActor(id, look, p);
      a.follower = true;
      a.npcKnot = id === 'zharov' ? 'zharov_cellar' : id === 'photographer' ? 'photographer' : id;
    });
    this.needSort = true;
  }

  setActiveHotspots(ids: Set<string>) {
    if (this.opts) this.opts.activeHotspots = ids;
  }
  setTool(t: 'walk' | 'tripod') {
    this.tool = t;
    this.app.canvas.style.cursor = t === 'tripod' ? 'crosshair' : 'default';
  }
  setHighlight(ids: string[]) {
    this.highlight = ids;
  }
  setTripod(pos: Vec2 | null) {
    this.tripodG.clear();
    if (!pos || !this.scene) return;
    const c = toScreen(this.scene, pos[0], pos[1]);
    const k = this.scene.pxPerArshin;
    const top: Vec2 = [c[0], c[1] - k * 1.6];
    for (const [dx, dy] of [[-0.35, 0.1], [0.3, 0.15], [0, -0.3]]) {
      const f = toScreen(this.scene, pos[0] + dx, pos[1] + dy);
      this.tripodG.moveTo(top[0], top[1]).lineTo(f[0], f[1]);
    }
    this.tripodG.stroke({ width: 3, color: 0x2a2018 });
    this.tripodG.rect(top[0] - 18, top[1] - 26, 36, 26).fill({ color: 0x3a2a1e }).stroke({ width: 2, color: 0x120c08 });
    this.tripodG.circle(top[0] + 12, top[1] - 13, 7).fill({ color: 0x1a1a1a });
  }
  setLamp(pos: Vec2 | null) {
    this.lampPos = pos;
    this.renderLamp();
    this.renderDarkness();
    if (pos && this.scene) {
      const revealed = this.scene.hidden
        .filter((h) => this.opts?.lampOnly.has(h.id))
        .filter((h) => {
          const pts = [h.from, h.to ?? h.from, [(h.from[0] + (h.to ?? h.from)[0]) / 2, (h.from[1] + (h.to ?? h.from)[1]) / 2] as Vec2];
          return pts.some((q) => Math.hypot(q[0] - pos[0], q[1] - pos[1]) <= LAMP_R);
        })
        .map((h) => h.id);
      this.cb.onLamp(pos, revealed);
    }
  }
  playerPos(): Vec2 {
    return this.player ? [...this.player.pos] as Vec2 : [0, 0];
  }

  /** Подойти к точке; по прибытии — колбэк. */
  walkTo(target: Vec2, then?: () => void) {
    if (!this.player || !this.nav) return;
    const path = this.nav.findPath(this.player.pos, target);
    if (!path) return;
    this.player.path = path.slice(1);
    this.onArrival = () => {
      const s = this.scene!;
      const end = this.player!.pos;
      let fragile: string | undefined;
      for (let i = 0; i < path.length - 1 && !fragile; i++) {
        const a = path[i];
        const b = path[i + 1];
        const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1);
        for (let k = 0; k <= n && !fragile; k++) {
          const q: Vec2 = [a[0] + ((b[0] - a[0]) * k) / Math.max(1, n), a[1] + ((b[1] - a[1]) * k) / Math.max(1, n)];
          const z = s.fragile.find((f) => pointInPoly(q, f.poly));
          if (z) fragile = z.evidence;
        }
      }
      const sector = s.sectors.find((x) => pointInPoly(end, x.poly))?.id ?? null;
      const threshold = s.threshold ? pointInPoly(end, s.threshold) : undefined;
      this.cb.onArrive([...end] as Vec2, sector, fragile, threshold);
      then?.();
    };
    if (this.player.path.length === 0) {
      const f = this.onArrival;
      this.onArrival = null;
      f();
    }
  }

  // --------- ввод ---------
  private interactables() {
    const s = this.scene;
    if (!s || !this.opts) return [];
    const out: { kind: 'hotspot' | 'npc' | 'exit'; id: string; label: string; screen: Vec2; approach: Vec2; knot?: string; to?: string }[] = [];
    for (const a of this.actors) {
      if (!a.npcKnot) continue;
      const name = a.id;
      out.push({ kind: 'npc', id: a.id, label: name, screen: toScreen(s, a.pos[0], a.pos[1], 1.3), approach: a.pos, knot: a.npcKnot });
    }
    for (const h of s.hotspots) {
      if (!this.opts.activeHotspots.has(h.id)) continue;
      const p = h.pos ?? s.props.find((x) => x.id === h.prop)?.pos ?? h.approach;
      const prop = s.props.find((x) => x.id === h.prop);
      out.push({ kind: 'hotspot', id: h.id, label: h.label, screen: toScreen(s, p[0], p[1], (h.z ?? prop?.z ?? 0) + (prop ? prop.size[2] / 2 : 0)), approach: h.approach });
    }
    for (const x of s.exits) out.push({ kind: 'exit', id: x.id, label: x.label, screen: toScreen(s, x.pos[0], x.pos[1]), approach: x.pos, to: x.to });
    return out;
  }

  private hitTest(x: number, y: number) {
    const s = this.scene;
    if (!s || !this.opts) return null;
    // люди
    for (const a of [...this.actors].reverse()) {
      if (!a.npcKnot) continue;
      const b = a.sprite.getBounds();
      const lp = this.world.toLocal({ x: b.x, y: b.y });
      const lp2 = this.world.toLocal({ x: b.x + b.width, y: b.y + b.height });
      if (x >= lp.x && x <= lp2.x && y >= lp.y && y <= lp2.y) return { kind: 'npc' as const, id: a.id, knot: a.npcKnot, approach: a.pos };
    }
    // хотспоты: силуэт предмета или окружность на полу
    let best: { kind: 'hotspot'; id: string; approach: Vec2; depth: number } | null = null;
    for (const h of s.hotspots) {
      if (!this.opts.activeHotspots.has(h.id)) continue;
      let hit = false;
      let depth = 0;
      if (h.prop && this.hullByProp[h.prop]) {
        hit = pointInPoly([x, y], this.hullByProp[h.prop]);
        const pr = s.props.find((p) => p.id === h.prop)!;
        depth = pr.pos[0] + pr.pos[1] + (pr.z ?? 0);
      } else if (h.pos) {
        const c = toScreen(s, h.pos[0], h.pos[1], h.z ?? 0);
        const rr = (h.r ?? 0.6) * s.pxPerArshin;
        hit = ((x - c[0]) / rr) ** 2 + ((y - c[1]) / (rr * 0.55)) ** 2 <= 1;
        depth = h.pos[0] + h.pos[1] - 100;
      }
      if (hit && (!best || depth > best.depth)) best = { kind: 'hotspot', id: h.id, approach: h.approach, depth };
    }
    if (best) return best;
    for (const ex of s.exits) {
      const c = toScreen(s, ex.pos[0], ex.pos[1]);
      if (Math.hypot(x - c[0], (y - c[1]) * 1.8) < s.pxPerArshin * 0.9) return { kind: 'exit' as const, id: ex.id, to: ex.to, approach: ex.pos };
      const lc = toScreen(s, ex.pos[0], ex.pos[1], 0.2);
      if (Math.abs(x - lc[0]) < 120 && y < lc[1] && y > lc[1] - 36) return { kind: 'exit' as const, id: ex.id, to: ex.to, approach: ex.pos };
    }
    return null;
  }

  private click(x: number, y: number) {
    const s = this.scene;
    if (!s || !this.player || !this.nav) return;
    const hit = this.hitTest(x, y);
    if (this.tool === 'tripod' && (!hit || hit.kind !== 'exit')) {
      const w = toWorld(s, x, y);
      const p = this.nav.walkable(w) ? w : this.nav.nearest(w);
      if (!p) return;
      this.walkTo(p, () => {
        this.setTripod(p);
        this.cb.onTripod(p);
      });
      return;
    }
    if (hit?.kind === 'npc') {
      const a = this.actors.find((q) => q.id === hit.id)!;
      const near = this.nav.nearest([a.pos[0] + 0.9, a.pos[1] + 0.6]) ?? a.pos;
      this.walkTo(near, () => this.cb.onNpc(hit.id, hit.knot!));
      return;
    }
    if (hit?.kind === 'hotspot') {
      this.walkTo(hit.approach, () => this.cb.onHotspot(hit.id));
      return;
    }
    if (hit?.kind === 'exit') {
      this.walkTo(hit.approach, () => this.cb.onExit(hit.id, hit.to!));
      return;
    }
    const w = toWorld(s, x, y);
    const p = this.nav.walkable(w) ? w : this.nav.nearest(w);
    if (p) this.walkTo(p);
  }

  private hover(x: number, y: number) {
    if (!this.hoverText || !this.scene) return;
    const hit = this.hitTest(x, y);
    let label: string | null = null;
    if (hit?.kind === 'hotspot') label = this.scene.hotspots.find((h) => h.id === hit.id)?.label ?? null;
    else if (hit?.kind === 'npc') label = this.labelFor?.(hit.id) ?? null;
    else if (hit?.kind === 'exit') label = this.scene.exits.find((e) => e.id === hit.id)?.label ?? null;
    this.hoverText.text = label ?? '';
    this.hoverText.position.set(x, y - 14);
    this.app.canvas.style.cursor = this.tool === 'tripod' ? 'crosshair' : label ? 'pointer' : 'default';
    this.cb.onHover?.(label);
  }
  labelFor: ((npcId: string) => string) | null = null;

  /** Клавиатура: перебор интерактивных объектов и активация. */
  focusStep(dir: 1 | -1) {
    const list = this.interactables();
    if (!list.length) return null;
    this.focusIdx = (this.focusIdx + dir + list.length) % list.length;
    const it = list[this.focusIdx];
    this.focusG.clear();
    this.focusG.circle(it.screen[0], it.screen[1], 30).stroke({ width: 4, color: 0xf3d58a, alpha: 0.95 });
    return it.kind === 'npc' ? this.labelFor?.(it.id) ?? it.id : it.label;
  }
  activateFocus() {
    const list = this.interactables();
    const it = list[this.focusIdx];
    if (!it || !this.nav) return;
    this.focusG.clear();
    if (it.kind === 'npc') {
      const near = this.nav.nearest([it.approach[0] + 0.9, it.approach[1] + 0.6]) ?? it.approach;
      this.walkTo(near, () => this.cb.onNpc(it.id, it.knot!));
    } else if (it.kind === 'hotspot') this.walkTo(it.approach, () => this.cb.onHotspot(it.id));
    else this.walkTo(it.approach, () => this.cb.onExit(it.id, it.to!));
  }

  // --------- кадр ---------
  private tick(dt: number) {
    if (!this.scene) return;
    this.time += dt;
    this.layout();
    const s = this.scene;
    let moved = false;
    for (const a of this.actors) {
      if (a.follower && this.player) {
        const target = this.trail[Math.max(0, this.trail.length - 1 - (this.actors.filter((x) => x.follower).indexOf(a) + 1) * 14)];
        if (target && Math.hypot(target[0] - this.player.pos[0], target[1] - this.player.pos[1]) > 0.6 && Math.hypot(a.pos[0] - this.player.pos[0], a.pos[1] - this.player.pos[1]) > 1.3) {
          a.path = [target];
        } else a.path = [];
      }
      if (a.path.length) {
        const tgt = a.path[0];
        const dx = tgt[0] - a.pos[0];
        const dy = tgt[1] - a.pos[1];
        const d = Math.hypot(dx, dy);
        const step = SPEED * dt * (a.follower ? 0.95 : 1);
        if (d <= step) {
          a.pos = [...tgt] as Vec2;
          a.path.shift();
        } else {
          a.pos = [a.pos[0] + (dx / d) * step, a.pos[1] + (dy / d) * step];
        }
        a.phase += dt * 8;
        const sdx = dx - dy; // экранное направление по x
        const sdy = dx + dy; // экранное направление по y
        if (Math.abs(sdy) > 0.02) a.back = sdy < 0;
        a.sprite.texture = a.frames[(a.back ? 5 : 0) + 1 + (Math.floor(a.phase) % 4)];
        if (Math.abs(sdx) > 0.01) a.sprite.scale.x = sdx < 0 ? -1 : 1;
        a.sprite.scale.y = 1;
        this.placeActor(a);
        moved = true;
        if (a === this.player) {
          this.trail.push([...a.pos] as Vec2);
          if (this.trail.length > 400) this.trail.shift();
          if (!a.path.length && this.onArrival) {
            const f = this.onArrival;
            this.onArrival = null;
            f();
          }
        }
      } else {
        const idle = a.frames[a.back ? 5 : 0];
        if (a.sprite.texture !== idle) a.sprite.texture = idle;
        // дыхание и лёгкое покачивание в покое
        a.sprite.scale.y = 1 + Math.sin(this.time * 1.9 + a.breath) * 0.012;
        a.sprite.skew.x = Math.sin(this.time * 0.6 + a.breath) * 0.012;
      }
    }
    if (moved || this.needSort) this.sortDepth();
    this.needSort = false;
    // подсветка (режим «Экспозиция»)
    this.highlightG.clear();
    if (this.highlight.length) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
      for (const id of this.highlight) {
        const h = s.hotspots.find((x) => x.id === id);
        if (!h) continue;
        const prop = s.props.find((p) => p.id === h.prop);
        const p = h.pos ?? prop?.pos ?? h.approach;
        const c = toScreen(s, p[0], p[1], (h.z ?? prop?.z ?? 0) + (prop ? prop.size[2] * 0.5 : 0));
        this.highlightG.ellipse(c[0], c[1], 34 + pulse * 8, 20 + pulse * 5).stroke({ width: 3, color: 0xf6d27a, alpha: 0.5 + pulse * 0.4 });
      }
    }
    if (s.light.sources.some((x) => x.flicker) && Math.floor(this.time * 8) % 2 === 0) this.renderDarkness();
  }

  private placeActor(a: Actor) {
    const p = toScreen(this.scene!, a.pos[0], a.pos[1]);
    a.sprite.position.set(p[0], p[1]);
    const d = this.drawables.find((x) => x.actor === a);
    if (d) d.box = [a.pos[0] - 0.2, a.pos[1] - 0.2, a.pos[0] + 0.2, a.pos[1] + 0.2];
  }

  /** Сортировка по глубине: A перед B, если A целиком «ближе» по x или по y (линии глубины по основаниям). */
  private sortDepth() {
    const ds = this.drawables;
    const front = (a: Drawable, b: Drawable) => {
      const eps = 0.02;
      if (a.box[0] >= b.box[2] - eps || a.box[1] >= b.box[3] - eps) return true;
      if (b.box[0] >= a.box[2] - eps || b.box[1] >= a.box[3] - eps) return false;
      if (a.z !== b.z) return a.z > b.z;
      return a.box[0] + a.box[1] + a.box[2] + a.box[3] > b.box[0] + b.box[1] + b.box[2] + b.box[3];
    };
    // топологическая сортировка (n небольшое)
    const n = ds.length;
    const indeg = new Array(n).fill(0);
    const adj: number[][] = ds.map(() => []);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (front(ds[i], ds[j]) && !front(ds[j], ds[i])) {
          adj[j].push(i);
          indeg[i]++;
        }
      }
    const order: number[] = [];
    const q: number[] = [];
    for (let i = 0; i < n; i++) if (!indeg[i]) q.push(i);
    q.sort((a, b) => ds[a].z - ds[b].z);
    while (q.length) {
      const i = q.shift()!;
      order.push(i);
      for (const j of adj[i]) if (--indeg[j] === 0) q.push(j);
    }
    for (let i = 0; i < n; i++) if (!order.includes(i)) order.push(i);
    order.forEach((idx, k) => (ds[idx].obj.zIndex = k + (ds[idx].z <= -50 ? -50000 : 0)));
  }

  private layout() {
    if (!this.scene) return;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const [W, H] = this.scene.canvas;
    // «cover», если обрезка небольшая (края холста и так растворяются в грунт), иначе «contain»
    const kc = Math.max(sw / W, sh / H);
    const kf = Math.min(sw / W, sh / H);
    const k = kc / kf < 1.32 ? kc : kf;
    this.world.scale.set(k);
    this.world.position.set((sw - W * k) / 2, (sh - H * k) / 2);
  }

  private renderDarkness() {
    const s = this.scene;
    if (!s) return;
    const ctx = this.dark.getContext('2d')!;
    const [W, H] = s.canvas;
    const sx = 400 / W;
    const sy = 250 / H;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, 400, 250);
    const dark = Math.max(0, (1 - s.light.ambient) * 0.82);
    const tint = hex(s.light.tint);
    ctx.fillStyle = rgba([tint[0] * 0.3, tint[1] * 0.3, tint[2] * 0.35], dark);
    ctx.fillRect(0, 0, 400, 250);
    ctx.globalCompositeOperation = 'destination-out';
    const r = prng(hash(String(Math.floor(this.time * 8))));
    const cut = (wx: number, wy: number, rad: number, power: number) => {
      const c = toScreen(s, wx, wy);
      const rx = rad * s.pxPerArshin * 0.95 * sx;
      ctx.save();
      ctx.translate(c[0] * sx, c[1] * sy);
      ctx.scale(1, 0.62);
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
      g.addColorStop(0, `rgba(0,0,0,${Math.min(1, power * 1.6)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    for (const src of s.light.sources) cut(src.pos[0], src.pos[1], src.radius, src.power * (src.flicker ? 0.9 + r() * 0.2 : 1));
    if (this.lampPos) cut(this.lampPos[0], this.lampPos[1], LAMP_R + 0.6, 0.9);
    ctx.globalCompositeOperation = 'source-over';
    this.darkTex?.source.update();
  }

  private renderLamp() {
    const s = this.scene;
    const ctx = this.lampCanvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, 800, 500);
    if (s && this.lampPos && this.hiddenCanvas) {
      ctx.drawImage(this.hiddenCanvas, 0, 0, 800, 500);
      ctx.globalCompositeOperation = 'destination-in';
      const c = toScreen(s, this.lampPos[0], this.lampPos[1]);
      const sx = 800 / s.canvas[0];
      const rx = LAMP_R * s.pxPerArshin * sx;
      ctx.save();
      ctx.translate(c[0] * sx, c[1] * sx);
      ctx.scale(1, 0.6);
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      // тёплое пятно лампы
      ctx.save();
      ctx.translate(c[0] * sx, c[1] * sx);
      ctx.scale(1, 0.6);
      const g2 = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
      g2.addColorStop(0, 'rgba(255,210,140,0.32)');
      g2.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    this.lampTex?.source.update();
  }

  /** Снимок сцены (для фотопластинок обзорных видов): кадрирование нарисованного фона. */
  snapshot(): HTMLCanvasElement | null {
    if (!this.baseCanvas) return null;
    try {
      return this.app.renderer.extract.canvas({ target: this.layer }) as HTMLCanvasElement;
    } catch {
      return this.baseCanvas;
    }
  }
}
