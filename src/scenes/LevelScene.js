// Сцена уровня: одна на все три уровня, карта и объекты берутся из src/levels/levels.js.
import Phaser from 'phaser';
import { BALANCE, DEBUG } from '../config.js';
import { BRAND, SHADE } from '../brand.js';
import { t, has } from '../content.js';
import { bus } from '../bus.js';
import { touch, resetTouch, isTouchDevice } from '../input.js';
import { session, prefs, clone, docsOfLevel, maxHealth, DOCS } from '../state.js';
import { sfx } from '../audio/sfx.js';
import { track } from '../analytics.js';
import { LEVELS } from '../levels/levels.js';
import { SOLID, DECOR } from '../levels/LevelGrid.js';
import { T, SOLID_TILES } from '../gfx/textures.js';
import { Hero } from '../objects/Hero.js';
import { Wolf, Sheep } from '../objects/Wolf.js';
import { Doc } from '../objects/Doc.js';
import { Checkpoint } from '../objects/Checkpoint.js';
import { Defect } from '../objects/Defect.js';
import { CourtGate } from '../objects/CourtGate.js';
import { MovingPlatform } from '../objects/Platform.js';
import { EstimateWall } from '../objects/EstimateWall.js';
import { Npc } from '../objects/Npc.js';
import { Boss } from '../objects/Boss.js';
import { burst, popText, Bubble } from '../ui/world.js';

const PROJ_GRAVITY = 400; // снаряды летят по более пологой дуге

const DECOR_INDEX = {
  c: T.COLUMN,
  r: T.REBAR,
  '|': T.PIPE_V,
  '-': T.PIPE_H,
  '~': T.PUDDLE,
  i: T.POST,
  s: T.SCAFFOLD,
  o: T.WINDOW,
  l: T.LAMP,
  x: T.BRACE,
  ':': T.CABLE,
};

export class LevelScene extends Phaser.Scene {
  constructor() {
    super('Level');
  }

  init(data) {
    this.levelId = data.level || session.run.level || 1;
    this.snapshot = data.snapshot || null; // рестарт с чекпоинта
    this.levelStart = data.levelStart || null; // состояние на начало уровня (для «начать заново»)
  }

  create() {
    if (this.snapshot) session.run = clone(this.snapshot.run);
    const run = session.run;
    if (!this.snapshot) {
      run.level = this.levelId;
      run.levelTimeMs = 0;
      run.cps = [];
      this.levelStart = clone(run);
      prefs.saveRun(run);
      track('level_start', { level: this.levelId });
    }
    this.run = run;
    this.completing = false;
    this.paused = false;
    this.pendingAction = null;
    this.hintsShown = new Set(this.snapshot?.hints || []);

    const def = LEVELS[this.levelId]();
    this.def = def;
    const g = def.grid;
    this.grid = g;
    this.W = g.w * 16;
    this.H = g.h * 16;
    this.style = def.style;

    this.physics.world.setBounds(0, -400, this.W, this.H + 1000);
    this.physics.world.checkCollision.up = false;
    this.physics.world.checkCollision.down = false;

    this.buildBackground(def);
    this.buildTiles(g);

    this.solids = this.physics.add.staticGroup();
    this.wolfGroup = this.physics.add.group();
    this.sheepGroup = this.physics.add.group();
    this.platforms = this.physics.add.group({ allowGravity: false, immovable: true });
    this.projectiles = this.physics.add.group();
    this.drips = this.physics.add.group();

    this.wolves = [];
    this.sheep = [];
    this.docs = [];
    this.cps = [];
    this.defects = [];
    this.walls = [];
    this.npcs = [];
    this.hints = [];
    this.movers = [];
    this.gate = null;
    this.boss = null;
    this.arena = null;
    this.summoned = [];

    this.buildObjects(g);

    // герой
    let start = this.startPos;
    const cpId = this.snapshot?.cpId;
    if (cpId) {
      const cp = this.cps.find((c) => c.id === cpId);
      if (cp) start = { x: cp.x + 14, y: cp.y };
    }
    this.hero = new Hero(this, start.x, start.y, maxHealth(run));
    this.hero.body.setCollideWorldBounds(true);
    this.lastSafe = { x: start.x, y: start.y };

    this.setupColliders();
    this.setupCamera();
    this.setupInput();
    if (def.water) this.setupWater();

    // счётчики «сколько всего» для финального экрана
    run.totals = run.totals || {};
    run.totals[this.levelId] = {
      wolves: g.objects.filter((o) => ['wolf', 'est', 'hider'].includes(o.type)).length + (this.boss ? 3 : 0),
      defects: this.defects.length,
    };
    // лёгкий режим: для босса хватит документов с прошлых уровней + двух обычных с этого
    if (this.levelId === 3 && !this.snapshot) run.easyBossNeed = Math.min(run.bossNeed, run.docs.length + 2);

    // интерфейс поверх уровня
    this.scene.stop('HUD');
    this.scene.launch('HUD', { level: this.levelId });
    this.scene.bringToTop('HUD');
    this.events.once('shutdown', () => this.cleanup());

    this.time.delayedCall(60, () => {
      this.emitHud();
      if (!this.snapshot) bus.emit('hud:banner', t('level.label', { n: this.levelId }), t(`level.${this.levelId}`));
    });

    this.cameras.main.fadeIn(350, 1, 55, 107);
    if (DEBUG) this.setupDebug();
  }

  // ------------------------------------------------------------------ построение

  buildBackground(def) {
    const sky = this.add.image(480, 270, `sky-${def.style}`).setScrollFactor(0).setDisplaySize(500, 290).setDepth(-20);
    sky.setOrigin(0.5);
    this.parallax = [];
    if (def.style === 3) {
      const wall = this.add.tileSprite(480, 270, 500, 290, 'interior').setScrollFactor(0).setDepth(-15);
      this.parallax.push({ obj: wall, fx: 0.5, fy: 0.3, baseY: 270 });
    } else {
      const layers = def.bg;
      const far = this.add.tileSprite(480, 350, 500, 140, layers[0]).setOrigin(0.5, 1).setScrollFactor(0).setDepth(-18);
      const mid = this.add.tileSprite(480, 372, 500, 200, layers[1]).setOrigin(0.5, 1).setScrollFactor(0).setDepth(-16);
      this.parallax.push({ obj: far, fx: 0.12, fy: 0.08, baseY: 350 }, { obj: mid, fx: 0.3, fy: 0.18, baseY: 372 });
    }
  }

  tileIndex(g, x, y) {
    const ch = g.tiles[y][x];
    const hash = (x * 7 + y * 13) % 5 === 0;
    switch (ch) {
      case '#': {
        const above = y > 0 ? g.tiles[y - 1][x] : '.';
        if (SOLID.has(above) && above !== 'f') return hash ? T.FILL2 : T.FILL;
        return hash ? T.TOP2 : T.TOP;
      }
      case '=':
        return T.PLANK;
      case 'f':
        return T.CRATE;
      case 'b':
        return T.WALL;
      case 'B':
        return T.WALL2;
      case 'C':
        return T.CEIL;
      default:
        return -1;
    }
  }

  buildTiles(g) {
    const data = g.tiles.map((row, y) => row.map((_, x) => this.tileIndex(g, x, y)));
    const map = this.make.tilemap({ data, tileWidth: 16, tileHeight: 16 });
    const ts = map.addTilesetImage('tiles', `tiles-${this.style}`, 16, 16, 0, 0);
    this.layer = map.createLayer(0, ts, 0, 0).setDepth(5);
    this.layer.setCollision(SOLID_TILES);
    this.layer.forEachTile((tile) => {
      if (tile.index === T.PLANK) tile.setCollision(false, false, true, false);
    });

    // Пустые клетки внутри земли (ямы, проёмы) закрашиваем тёмным, чтобы сквозь землю не просвечивало небо.
    const solidAt = (x, y) => SOLID.has(g.tiles[y][x]);
    const underground = (x, y) => {
      let l = false;
      let r = false;
      for (let k = 1; k <= 8 && x - k >= 0; k++) if (solidAt(x - k, y)) { l = true; break; }
      for (let k = 1; k <= 8 && x + k < g.w; k++) if (solidAt(x + k, y)) { r = true; break; }
      return l && r && (y === 0 || !this.def.ceiling || y > 1);
    };
    const ddata = g.decor.map((row, y) =>
      row.map((ch, x) => {
        if (DECOR.has(ch)) return DECOR_INDEX[ch];
        if (!solidAt(x, y) && g.tiles[y][x] === '.' && this.groundBelowSurface(g, x, y) && underground(x, y)) return T.CAVITY;
        return -1;
      }),
    );
    const dmap = this.make.tilemap({ data: ddata, tileWidth: 16, tileHeight: 16 });
    const dts = dmap.addTilesetImage('tiles', `tiles-${this.style}`, 16, 16, 0, 0);
    this.decorLayer = dmap.createLayer(0, dts, 0, 0).setDepth(3);
  }

  /** Клетка ниже поверхности земли по соседству (а не в воздухе над платформами). */
  groundBelowSurface(g, x, y) {
    for (const dx of [-1, 1]) {
      for (let k = 1; k <= 8; k++) {
        const xx = x + dx * k;
        if (xx < 0 || xx >= g.w) break;
        if (SOLID.has(g.tiles[y][xx])) {
          // сосед — часть массива земли: над ним (в той же колонке) тоже грунт или это верх земли
          const top = g.tiles.findIndex((row) => SOLID.has(row[xx]));
          if (top <= y && g.tiles.slice(y).every((row) => SOLID.has(row[xx]))) return true;
          break;
        }
      }
    }
    return false;
  }

  buildObjects(g) {
    const run = this.run;
    const L = this.levelId;
    let n = 0;
    for (const o of g.objects) {
      const id = `L${L}-${o.type}-${n++}`;
      const px = o.x * 16 + 8;
      const py = (o.y + 1) * 16; // «ноги» стоят на нижней кромке клетки
      switch (o.type) {
        case 'start':
          this.startPos = { x: px, y: py };
          break;
        case 'doc':
          if (!run.docs.includes(o.id)) this.docs.push(new Doc(this, px, py - 10, o.id));
          break;
        case 'cp':
          this.cps.push(new Checkpoint(this, px, py, id, (run.cps || []).includes(id)));
          break;
        case 'sheep': {
          const s = new Sheep(this, px, py, id, run.checkedSheep.includes(id));
          this.sheepGroup.add(s);
          s.setup();
          this.sheep.push(s);
          break;
        }
        case 'wolf':
        case 'est':
        case 'hider': {
          if (run.wolves.includes(id)) break;
          const kind = o.type === 'wolf' ? 'sub' : o.type;
          const w = new Wolf(this, px, py, kind, id, { style: o.style || this.style });
          this.wolfGroup.add(w);
          w.setup();
          this.wolves.push(w);
          break;
        }
        case 'defect': {
          const frames = [];
          for (let j = 0; j < o.h; j++) {
            frames.push([]);
            for (let i = 0; i < o.w; i++) frames[j].push(T.TOP);
          }
          const d = new Defect(this, o, id, this.style, frames, run.defects.includes(id));
          this.defects.push(d);
          if (run.defects.includes(id) && o.stopsWater) this.waterStoppedAtStart = true;
          break;
        }
        case 'estwall':
          this.walls.push(new EstimateWall(this, o.x, o.y, o.h, id));
          break;
        case 'gate':
          this.gate = new CourtGate(this, o.x * 16 + 36, py);
          break;
        case 'lawyer':
          this.npcs.push(new Npc(this, px, py, 'lawyer', o.line));
          break;
        case 'hook': {
          const w = o.w * 16;
          const p = new MovingPlatform(this, 'hook', {
            ax: o.x0 * 16 + w / 2,
            ay: o.y * 16,
            bx: o.x1 * 16 + w / 2,
            by: (o.yTo ?? o.y) * 16,
            speed: o.speed,
            phase: o.phase,
          });
          this.platforms.add(p);
          p.setup();
          this.movers.push(p);
          break;
        }
        case 'lift': {
          const w = o.w * 16;
          const p = new MovingPlatform(this, 'lift', {
            ax: o.x * 16 + w / 2,
            ay: o.yBottom * 16,
            bx: o.x * 16 + w / 2,
            by: o.yTop * 16,
            speed: o.speed,
            pause: 1200,
          });
          this.platforms.add(p);
          p.setup();
          this.movers.push(p);
          break;
        }
        case 'hint':
          this.hints.push({ x: o.x * 16, key: o.key, minY: o.minY });
          break;
        case 'arena':
          this.arena = { trigger: o.x * 16, x0: o.x0 * 16, x1: (o.x1 + 1) * 16 };
          break;
        case 'boss':
          this.boss = new Boss(this, px, py);
          this.physics.add.existing(this.boss);
          this.boss.setup();
          break;
        default:
          break;
      }
    }
    if (this.arena) {
      // заслонка на входе в арену
      this.barrier = this.solids.create(this.arena.x0 - 8, 7 * 16, 'tiles-3', T.WALL);
      this.barrier.setDisplaySize(12, 13 * 16).refreshBody();
      this.barrier.body.enable = false;
      this.barrier.setVisible(false).setDepth(12);
    }
  }

  setupColliders() {
    const hero = this.hero;
    this.physics.add.collider(hero, this.layer);
    this.physics.add.collider(hero, this.solids, (h, s) => {
      if (s.defect && h.body.touching.down && h.body.bottom <= s.body.top + 2) s.defect.startCollapse();
    });
    this.physics.add.collider(hero, this.platforms, (h, p) => {
      if (h.body.touching.down && h.body.bottom <= p.body.top + 3) h.ride = p;
    });
    for (const grp of [this.wolfGroup, this.sheepGroup]) {
      this.physics.add.collider(grp, this.layer);
      this.physics.add.collider(grp, this.solids);
    }
    if (this.boss) this.physics.add.collider(this.boss, this.layer);
    const kill = (p) => {
      burst(this, p.x, p.y, p.texture.key === 'drip' ? 'drip' : 'paperBit', 4, { speed: 40, life: 400 });
      if (p.texture.key === 'drip') sfx.drip();
      p.destroy();
    };
    this.physics.add.collider(this.projectiles, this.layer, kill);
    this.physics.add.collider(this.projectiles, this.solids, kill);
    this.physics.add.collider(this.drips, this.layer, kill);
    this.physics.add.collider(this.drips, this.solids, kill);

    this.physics.add.overlap(hero, this.wolfGroup, (h, w) => this.heroTouchWolf(w));
    this.physics.add.overlap(hero, this.projectiles, (h, p) => {
      if (hero.hurt(p.x)) burst(this, p.x, p.y, 'paperBit', 6);
      p.destroy();
    });
    this.physics.add.overlap(hero, this.drips, (h, d) => {
      hero.hurt(d.x);
      d.destroy();
    });
    if (this.boss) this.physics.add.overlap(hero, this.boss, () => this.heroTouchBoss());
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.W, this.H);
    cam.setZoom(2);
    cam.roundPixels = true;
    cam.startFollow(this.hero, true, 0.14, 0.14);
    cam.setFollowOffset(0, 26);
    cam.setDeadzone(36, 24);
    cam.setBackgroundColor(SHADE.blueNight);
  }

  setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,X,J,E,ENTER,ESC,P');
    this.prevTouch = { jump: false, beam: false, action: false };
    kb.on('keydown-ESC', () => this.pauseGame());
    kb.on('keydown-P', () => this.pauseGame());
    // в браузере пробел и стрелки не должны прокручивать страницу
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    this.onBusPause = () => this.pauseGame();
    this.onBusAction = () => this.doAction();
    bus.on('pause', this.onBusPause);
    bus.on('action', this.onBusAction);
  }

  readInput() {
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    const jumpKey = k.SPACE.isDown || k.W.isDown || k.UP.isDown;
    const beamKey = k.X.isDown || k.J.isDown;
    const input = {
      left: k.LEFT.isDown || k.A.isDown || touch.left,
      right: k.RIGHT.isDown || k.D.isDown || touch.right,
      jump: jumpKey || touch.jump,
      beam: beamKey || touch.beam,
      jumpPressed: JD(k.SPACE) || JD(k.W) || JD(k.UP) || (touch.jump && !this.prevTouch.jump),
      beamPressed: JD(k.X) || JD(k.J) || (touch.beam && !this.prevTouch.beam),
      actionPressed: JD(k.E) || JD(k.ENTER),
    };
    this.prevTouch.jump = touch.jump;
    this.prevTouch.beam = touch.beam;
    return input;
  }

  setupWater() {
    const cap = 15 * 16 - 12;
    this.water = {
      y: this.H + 10,
      cap,
      startAt: this.time.now + BALANCE.waterDelayMs,
      stopped: !!this.waterStoppedAtStart,
      warned: false,
      nextHurt: 0,
    };
    this.waterBody = this.add.tileSprite(0, this.water.y, this.W, 200, 'water').setOrigin(0, 0).setDepth(26).setAlpha(0.62);
    this.waterTop = this.add.tileSprite(0, this.water.y - 2, this.W, 4, 'waterTop').setOrigin(0, 0).setDepth(26).setAlpha(0.9);
  }

  // ------------------------------------------------------------------ игровой цикл

  update(time, delta) {
    const dt = Math.min(delta, 50);
    const hero = this.hero;
    if (!this.completing) this.run.levelTimeMs += dt;

    // движущиеся платформы везут стоящего на них героя
    const ride = hero.ride;
    hero.ride = null;
    for (const p of this.movers) {
      const d = p.step(dt);
      if (ride === p) {
        hero.x += d.dx;
        hero.y += d.dy;
      }
    }

    const input = this.readInput();
    if (input.actionPressed) this.doAction();
    if (this.water) this.updateWater(time, dt);
    hero.update(time, dt, input);

    for (const w of this.wolves) if (w.active) w.update(time, dt);
    this.wolves = this.wolves.filter((w) => w.active);
    for (const s of this.sheep) s.update(time);
    if (this.boss) this.boss.update(time);
    for (const n of this.npcs) n.update(hero);

    // предметы и триггеры
    const hb = hero.body;
    const heroRect = new Phaser.Geom.Rectangle(hb.x, hb.y, hb.width, hb.height);
    for (const d of this.docs) {
      if (!d.taken && Phaser.Geom.Rectangle.Overlaps(heroRect, d.bounds())) this.collectDoc(d);
    }
    for (const cp of this.cps) {
      if (!cp.active2 && Math.abs(hero.x - cp.x) < 14 && Math.abs(hero.y - cp.y) < 30) this.activateCheckpoint(cp);
    }
    for (const h of this.hints) {
      if (!this.hintsShown.has(h.key) && hero.x >= h.x && (h.minY === undefined || hero.y >= h.minY * 16)) {
        this.hintsShown.add(h.key);
        this.showHint(h.key);
      }
    }
    if (this.gate) this.updateGate();
    if (this.arena && !this.arenaIn && hero.x > this.arena.trigger && !this.boss.phase.startsWith('def')) this.enterArena();

    // проекты (снаряды) живут недолго
    for (const p of this.projectiles.getChildren()) if (time - p.born > 5000 || p.y > this.H + 60) p.destroy();
    for (const d of this.drips.getChildren()) if (d.y > this.H + 60) d.destroy();

    // падение в проём
    if (hero.y > this.H + 40 && !hero.dead) this.heroFell();
    // запоминаем безопасную точку
    if (hero.onGround && !ride && this.isGroundAt(hero.x - 6, hero.y + 2, true) && this.isGroundAt(hero.x + 6, hero.y + 2, true)) {
      this.lastSafe.x = hero.x;
      this.lastSafe.y = hero.y;
    }

    // параллакс фона
    const cam = this.cameras.main;
    for (const l of this.parallax) {
      l.obj.tilePositionX = cam.scrollX * l.fx;
      if (l.fy) l.obj.y = l.baseY - (cam.scrollY - (this.H - 270)) * l.fy;
    }
  }

  /** Твёрдый тайл в точке (доски не считаются). */
  isSolidAt(px, py) {
    const tile = this.layer.getTileAtWorldXY(px, py);
    return !!(tile && tile.collides && tile.index !== T.PLANK);
  }

  isGroundAt(px, py, tilesOnly = false) {
    const tile = this.layer.getTileAtWorldXY(px, py);
    if (tile && tile.collideUp) return true;
    if (tilesOnly) return false;
    for (const s of this.solids.getChildren()) {
      if (s.body && s.body.enable && s.body.hitTest(px, py)) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ луч нивелира

  fireBeam(hero) {
    const o = hero.beamOrigin();
    const dir = hero.facing;
    const range = BALANCE.beamRangeTiles * 16;
    sfx.beam();

    // где луч упирается в стену
    let dist = range;
    for (let d = 0; d <= range; d += 3) {
      const tile = this.layer.getTileAtWorldXY(o.x + dir * d, o.y);
      if (tile && tile.collides && tile.index !== T.PLANK) {
        dist = d + 2;
        break;
      }
    }
    const lineRect = (r, top = 14, bottom = 14) => {
      const near = dir > 0 ? r.x - o.x : o.x - (r.x + r.width);
      const far = dir > 0 ? r.x + r.width - o.x : o.x - r.x;
      const vert = r.y < o.y + bottom && r.y + r.height > o.y - top;
      return vert && far > -10 ? Math.max(0, near) : null;
    };
    const bodyRect = (b) => ({ x: b.x, y: b.y, width: b.width, height: b.height });

    // кандидаты: стены из смет, босс, волки, овцы
    const hits = [];
    for (const w of this.walls) if (w.alive) {
      const d = lineRect({ x: w.rect.x, y: w.rect.y, width: w.rect.w, height: w.rect.h }, 30, 30);
      if (d !== null) hits.push({ d, kind: 'wall', obj: w });
    }
    if (this.boss && this.boss.phase !== 'defeated') {
      const r = bodyRect(this.boss.body);
      if (this.boss.hasShield) {
        r.x -= 12;
        r.width += 24;
      }
      const d = lineRect(r, 20, 20);
      if (d !== null) hits.push({ d, kind: 'boss', obj: this.boss });
    }
    for (const w of this.wolves) if (w.state !== 'gone') {
      const d = lineRect(bodyRect(w.body), 16, 16);
      if (d !== null) hits.push({ d, kind: 'wolf', obj: w });
    }
    for (const s of this.sheep) {
      const d = lineRect(bodyRect(s.body), 16, 16);
      if (d !== null) hits.push({ d, kind: 'sheep', obj: s });
    }
    hits.sort((a, b) => a.d - b.d);
    const first = hits.find((h) => h.d <= dist);
    if (first) {
      dist = Math.max(4, first.d + 4);
      this.beamHit(first);
    }

    // летящие сметы луч «разбирает»
    for (const p of this.projectiles.getChildren()) {
      const d = lineRect({ x: p.x - 6, y: p.y - 6, width: 12, height: 12 }, 10, 10);
      if (d !== null && d <= dist) {
        burst(this, p.x, p.y, 'paperBit', 5);
        p.destroy();
      }
    }

    // скрытые дефекты: луч — это сканирующая плоскость, захватывает пол и стены рядом
    const x0 = Math.min(hero.x, o.x + dir * (dist + 6));
    const x1 = Math.max(hero.x, o.x + dir * (dist + 6));
    const scan = new Phaser.Geom.Rectangle(x0, o.y - 48, x1 - x0, 82);
    for (const d of this.defects) {
      if (!d.revealed && !d.collapsed && Phaser.Geom.Rectangle.Overlaps(scan, d.rect)) d.reveal(true);
    }

    this.drawBeam(o, dir, dist);
  }

  beamHit(h) {
    const run = this.run;
    switch (h.kind) {
      case 'wall':
        h.obj.destroyWall();
        break;
      case 'boss':
        h.obj.onBeam();
        break;
      case 'wolf':
        h.obj.onBeam();
        break;
      case 'sheep':
        if (h.obj.onBeam()) {
          run.falseSusp += 1;
          run.checkedSheep.push(h.obj.id);
          this.toast(t('toast.clean'), null, 'info');
        }
        break;
      default:
        break;
    }
  }

  drawBeam(o, dir, dist) {
    const g = this.add.graphics().setDepth(50);
    const ex = o.x + dir * dist;
    // сканирующая плоскость
    g.fillStyle(BRAND.red, 0.12);
    g.fillTriangle(o.x, o.y, ex, o.y - 12, ex, o.y + 12);
    g.fillStyle(BRAND.red, 1).fillRect(Math.min(o.x, ex), o.y - 1, Math.abs(ex - o.x), 2);
    g.fillStyle(SHADE.redLight, 1).fillRect(Math.min(o.x, ex), o.y - 0.5, Math.abs(ex - o.x), 1);
    g.fillStyle(BRAND.white, 1).fillRect(ex - 1, o.y - 1, 2, 2);
    this.tweens.add({ targets: g, alpha: 0, duration: 200, delay: 60, onComplete: () => g.destroy() });
    burst(this, ex, o.y, 'spark', 3, { speed: 30, life: 250, gravity: 0 });
  }

  // ------------------------------------------------------------------ контакты

  heroTouchWolf(w) {
    const hero = this.hero;
    if (!w.active2 || hero.dead || hero.won) return;
    const hb = hero.body;
    const wb = w.body;
    if (hb.velocity.y > 10 && hb.bottom <= wb.top + 9) {
      const defeated = w.stomp();
      hero.bounce(defeated && (this.keys.SPACE.isDown || touch.jump));
      if (!defeated) hero.body.velocity.x = (hero.x < w.x ? -1 : 1) * 80;
      return;
    }
    if (w.state === 'exposed') hero.hurt(w.x);
    else {
      hero.shove(w.x);
      if (w.kind !== 'est') w.dir = w.x < hero.x ? -1 : 1;
    }
  }

  heroTouchBoss() {
    const hero = this.hero;
    const b = this.boss;
    if (hero.dead || hero.won || b.phase === 'defeated' || b.phase === 'wait') return;
    const hb = hero.body;
    if (hb.velocity.y > 10 && hb.bottom <= b.body.top + 12) {
      if (b.stomp()) hero.bounce(true);
      else {
        hero.bounce();
        hero.body.velocity.x = (hero.x < b.x ? -1 : 1) * 160;
      }
      return;
    }
    if (b.phase === 'skin' || b.phase === 'exposed') hero.hurt(b.x);
    else {
      hero.shove(b.x);
      hero.body.velocity.x = (hero.x < b.x ? -1 : 1) * 200;
    }
  }

  // ------------------------------------------------------------------ события игры

  addScore(n, x, y) {
    this.run.score += n;
    if (x !== undefined) popText(this, x, y, `+${n}`, BRAND.white);
    bus.emit('hud:score', this.run.score);
  }

  emitHud() {
    bus.emit('hud:health', this.hero.health, this.hero.maxHealth);
    bus.emit('hud:docs', this.run.docs, null);
    bus.emit('hud:score', this.run.score);
  }

  toast(title, sub = null, kind = 'info', ms) {
    bus.emit('hud:toast', title, sub, kind, ms);
  }

  showHint(key) {
    const touchMode = isTouchDevice();
    const k = touchMode && has(`${key}.touch`) ? `${key}.touch` : has(`${key}.kb`) ? `${key}.kb` : key;
    bus.emit('hud:hint', t(k));
  }

  collectDoc(d) {
    d.take();
    const run = this.run;
    if (!run.docs.includes(d.id)) run.docs.push(d.id);
    sfx.doc();
    burst(this, d.x, d.y, 'sparkW', 10, { speed: 60 });
    this.addScore(BALANCE.score.doc, d.x, d.y - 14);
    bus.emit('hud:docs', run.docs, d.id);
    this.toast(t(`doc.${d.id}.name`), t(`doc.${d.id}.hint`), 'doc', BALANCE.docHintMs);
    track('doc', { id: d.id });
  }

  activateCheckpoint(cp) {
    if (!cp.activate()) return;
    const run = this.run;
    run.cps = run.cps || [];
    if (!run.cps.includes(cp.id)) run.cps.push(cp.id);
    this.cpSnapshot = { run: clone(run), cpId: cp.id };
    this.lastCp = cp;
    this.toast(t('toast.checkpoint'), null, 'ok', 1600);
  }

  onWolfDefeated(w) {
    this.run.wolves.push(w.id);
    this.addScore(BALANCE.score.wolf, w.x, w.y - 26);
  }

  onDefectFound(d, byBeam) {
    if (!this.run.defects.includes(d.id)) this.run.defects.push(d.id);
    if (byBeam) {
      this.addScore(BALANCE.score.defect, d.rect.centerX, d.rect.y - 30);
      this.toast(t('toast.defect'), t(d.meta.label), 'ok', 2200);
    } else {
      this.toast(t('toast.defectFeet'), t(d.meta.label), 'warn', 2600);
    }
    if (d.def.stopsWater) this.stopWater();
  }

  onWallDestroyed() {
    this.toast(t('toast.estwall'), null, 'ok', 1600);
  }

  onHeroHurt() {
    bus.emit('hud:health', this.hero.health, this.hero.maxHealth);
    if (this.hero.health <= 0) this.heroDead();
  }

  heroFell() {
    const hero = this.hero;
    sfx.fall();
    if (this.def.safePits) {
      hero.setPosition(this.lastSafe.x, this.lastSafe.y - 2);
      hero.body.reset(hero.x, hero.y);
      return;
    }
    this.toast(t('toast.fall'), null, 'warn', 1400);
    hero.hurt(undefined, { force: true, knock: false });
    if (hero.health > 0) {
      hero.setPosition(this.lastSafe.x, this.lastSafe.y - 2);
      hero.body.reset(hero.x, hero.y);
      hero.body.setVelocity(0, 0);
      this.cameras.main.flash(200, 2, 79, 153);
    }
  }

  heroDead() {
    const hero = this.hero;
    if (hero.dead) return;
    hero.dead = true;
    hero.locked = true;
    this.toast(t('toast.noHelmets'), null, 'warn', 2000);
    track('death', { level: this.levelId });
    this.time.delayedCall(1300, () => {
      this.cameras.main.fadeOut(400, 1, 55, 107);
      this.cameras.main.once('camerafadeoutcomplete', () => this.restartFromCheckpoint());
    });
  }

  restartFromCheckpoint() {
    const snap = this.cpSnapshot || { run: this.levelStart, cpId: null };
    this.scene.restart({ level: this.levelId, snapshot: { ...snap, hints: [...this.hintsShown] }, levelStart: this.levelStart });
  }

  /** «Начать уровень заново» из паузы. */
  restartLevel() {
    session.run = clone(this.levelStart);
    this.scene.restart({ level: this.levelId, snapshot: null, levelStart: null });
  }

  updateGate() {
    const rule = BALANCE.gates[this.levelId] || { scope: 'level', need: 0 };
    let need = this.run.easy ? 0 : rule.need;
    const have = rule.scope === 'level' ? docsOfLevel(this.run, this.levelId) : this.run.docs.length;
    this.gate.update(this.hero, need, have, rule.scope);
  }

  completeLevel() {
    if (this.completing) return;
    this.completing = true;
    const hero = this.hero;
    hero.locked = true;
    hero.won = true;
    hero.body.setVelocity(0, hero.body.velocity.y);
    sfx.victory();
    const run = this.run;
    const secs = Math.round(run.levelTimeMs / 1000);
    const bonus = Math.max(0, (BALANCE.parTime[this.levelId] - secs) * BALANCE.timeBonusPerSec);
    run.score += bonus;
    run.totalTimeMs += run.levelTimeMs;
    run.level = this.levelId + 1;
    prefs.saveRun(run);
    track('level_complete', { level: this.levelId, secs });
    this.time.delayedCall(1700, () => {
      this.cameras.main.fadeOut(450, 1, 55, 107);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('HUD');
        this.scene.start('Tip', { after: this.levelId, secs, bonus });
      });
    });
  }

  // ------------------------------------------------------------------ вода (уровень 3)

  updateWater(time, dt) {
    const w = this.water;
    const hero = this.hero;
    if (w.stopped) {
      if (w.y < this.H + 10) w.y += (8 * dt) / 1000;
    } else if (time > w.startAt) {
      if (!w.warned) {
        w.warned = true;
        sfx.water();
        bus.emit('hud:hint', t('hint.l3.water'));
      }
      if (w.y > w.cap) w.y -= (BALANCE.waterSpeed * dt) / 1000;
    }
    this.waterBody.y = w.y;
    this.waterTop.y = w.y - 2;
    this.waterTop.tilePositionX += dt * 0.01;
    const inWater = hero.y > w.y + 3 && !hero.dead;
    hero.speedMul = inWater ? 0.6 : 1;
    hero.jumpMul = inWater ? 0.88 : 1;
    if (inWater) {
      if (!w.wasIn) {
        w.wasIn = true;
        sfx.splash();
        w.nextHurt = time + 1500;
      }
      if (time > w.nextHurt) {
        w.nextHurt = time + 2500;
        if (hero.hurt(undefined, { knock: false })) this.toast(t('toast.water'), t('hint.l3.water'), 'warn', 1800);
      }
    } else w.wasIn = false;
  }

  stopWater() {
    if (!this.water || this.water.stopped) return;
    this.water.stopped = true;
    bus.emit('hud:hint', t('hint.l3.waterStopped'));
  }

  // ------------------------------------------------------------------ арена босса

  enterArena() {
    this.arenaIn = true;
    const cam = this.cameras.main;
    cam.setBounds(this.arena.x0, 0, this.arena.x1 - this.arena.x0, this.H);
    this.barrier.body.enable = true;
    this.barrier.setVisible(true);
    this.hero.body.velocity.x = 0;
    if (!this.run.bossTipShown) {
      this.run.bossTipShown = true;
      this.hero.locked = true;
      this.time.delayedCall(400, () => {
        this.scene.pause();
        this.scene.launch('Tip', { mode: 'boss' });
        this.scene.bringToTop('Tip');
      });
      this.events.once('resume', () => {
        this.hero.locked = false;
        this.bossIntro();
      });
    } else this.bossIntro();
  }

  bossIntro() {
    const b = this.boss;
    if (b.phase === 'wait') {
      b.phase = 'intro';
      b.say('boss.intro', 2600);
      this.time.delayedCall(2600, () => b.startPhase1());
    } else if (b.phase === 'p2wait') {
      this.time.delayedCall(600, () => this.bossDocCheck());
    }
  }

  summonSubs() {
    const xs = [this.arena.x0 + 90, this.arena.x0 + 260];
    this.summoned = xs.map((x, i) => {
      const w = new Wolf(this, x, 40, 'sub', `L3-summon-${i}`, { range: [this.arena.x0 + 20, this.arena.x1 - 60] });
      this.wolfGroup.add(w);
      w.setup();
      this.wolves.push(w);
      burst(this, x, 40, 'wool', 6);
      return w;
    });
  }

  subsCleared() {
    return this.summoned.length > 0 && this.summoned.every((w) => w.state === 'gone');
  }

  bossDocCheck() {
    const run = this.run;
    const need = run.easy ? Math.min(run.bossNeed, run.easyBossNeed ?? run.bossNeed) : run.bossNeed;
    const have = run.docs.length;
    if (have >= need) {
      new Bubble(this, this.hero, t('boss.docsOk'), { duration: 2600, name: t('who.hero') });
      this.pendingAction = () => {
        bus.emit('hud:action', null);
        this.boss.breakShield();
      };
      bus.emit('hud:action', t('boss.petition'));
    } else {
      new Bubble(this, this.hero, t('boss.noDocs'), { duration: 3000, name: t('who.hero') });
      this.toast(t('boss.needDocs', { need, have }), null, 'warn', 3000);
      this.hero.locked = true;
      this.time.delayedCall(3000, () => {
        const cam = this.cameras.main;
        cam.fadeOut(350, 1, 55, 107);
        cam.once('camerafadeoutcomplete', () => this.leaveArena());
      });
    }
  }

  /** Неполный пакет: возвращаемся к последнему чекпоинту, уровень не сбрасывается. */
  leaveArena() {
    const cam = this.cameras.main;
    this.arenaIn = false;
    this.barrier.body.enable = false;
    this.barrier.setVisible(false);
    cam.setBounds(0, 0, this.W, this.H);
    const cp = this.lastCp;
    const pos = cp ? { x: cp.x + 14, y: cp.y } : this.startPos;
    this.hero.setPosition(pos.x, pos.y - 2);
    this.hero.body.reset(this.hero.x, this.hero.y);
    this.hero.locked = false;
    cam.fadeIn(350, 1, 55, 107);
  }

  doAction() {
    if (!this.pendingAction) return;
    const fn = this.pendingAction;
    this.pendingAction = null;
    fn();
  }

  onBossDefeated(b) {
    const run = this.run;
    run.bossDefeated = true;
    run.wolves.push('boss');
    this.addScore(BALANCE.score.boss, b.x, b.y - 80);
    track('boss_defeated');
    this.time.delayedCall(1500, () => {
      const hero = this.hero;
      hero.won = true;
      hero.locked = true;
      sfx.victory();
      new Bubble(this, hero, t('final.hero'), { duration: 5000, name: t('who.hero'), width: 190 });
      this.time.delayedCall(5000, () => this.finishGame());
    });
  }

  finishGame() {
    if (this.completing) return;
    this.completing = true;
    const run = this.run;
    const secs = Math.round(run.levelTimeMs / 1000);
    const bonus = Math.max(0, (BALANCE.parTime[this.levelId] - secs) * BALANCE.timeBonusPerSec);
    run.score += bonus;
    run.totalTimeMs += run.levelTimeMs;
    prefs.clearRun();
    this.cameras.main.fadeOut(600, 1, 55, 107);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('HUD');
      this.scene.start('Final', { bonus });
    });
  }

  // ------------------------------------------------------------------ снаряды

  /** Горизонтальная скорость, чтобы снаряд с вертикальной скоростью vy попал в точку (tx, ty). */
  aimVx(sx, sy, tx, ty, vy, maxVx = 260) {
    const g = PROJ_GRAVITY;
    const disc = vy * vy + 2 * g * (ty - sy);
    const tt = disc > 0 ? (-vy + Math.sqrt(disc)) / g : 1;
    return Phaser.Math.Clamp((tx - sx) / Math.max(0.3, tt), -maxVx, maxVx);
  }

  spawnProjectile(x, y, vx, vy, frame) {
    const p = this.projectiles.create(x, y, 'proj', frame);
    p.body.setSize(9, 9);
    p.body.setGravityY(PROJ_GRAVITY - 900);
    p.setVelocity(vx, vy);
    p.setAngularVelocity(vx > 0 ? 360 : -360);
    p.setDepth(35);
    p.born = this.time.now;
    return p;
  }

  spawnDrip(x, y) {
    if (Math.abs(x - this.hero.x) > 400) return;
    const d = this.drips.create(x, y, 'drip');
    d.body.setSize(3, 5);
    d.body.setMaxVelocityY(260);
    d.setDepth(11);
    return d;
  }

  // ------------------------------------------------------------------ пауза

  pauseGame() {
    if (this.completing || this.hero?.dead || !this.scene.isActive()) return;
    resetTouch();
    this.scene.pause();
    this.scene.launch('Pause');
    this.scene.bringToTop('Pause');
  }

  cleanup() {
    bus.off('pause', this.onBusPause);
    bus.off('action', this.onBusAction);
    resetTouch();
  }

  // ------------------------------------------------------------------ отладка (?debug)

  setupDebug() {
    const kb = this.input.keyboard;
    kb.on('keydown-K', () => {
      DOCS.forEach((d) => {
        if (d.level <= this.levelId && !this.run.docs.includes(d.id)) this.run.docs.push(d.id);
      });
      this.emitHud();
    });
    kb.on('keydown-L', () => this.completeLevel());
    kb.on('keydown-T', () => {
      const x = this.arena ? this.arena.x0 - 40 : this.W - 200;
      this.hero.setPosition(x, 100);
      this.hero.body.reset(x, 100);
    });
    this.fps = this.add.text(4, 4, '', { fontSize: '10px', color: '#fff' }).setScrollFactor(0).setDepth(999);
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.fps.setText(`${Math.round(this.game.loop.actualFps)} fps`) });
    window.__level = this;
  }
}
