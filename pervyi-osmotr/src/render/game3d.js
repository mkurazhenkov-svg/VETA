// Рендер, FPS-контроллер, инструменты. Рендер только сообщает факты в домен через dispatch,
// решения (засчитан ли кадр, повреждён ли след) принимает domain/.
import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { buildWorld, toon } from './world.js';
import * as TX from './textures.js';
import { zoneAt } from '../content/layout.js';

const EYE = 1.6, CROUCH = 0.95, R = 0.22;

export function createGame3D({ container, C, store, onTarget, onToast }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  const effect = new OutlineEffect(renderer, { defaultThickness: 0.006, defaultColor: [0.06, 0.06, 0.09], defaultAlpha: 0.9 });

  const W = buildWorld(C);
  const { scene } = W;
  scene.traverse((o) => {
    const m = o.material;
    if (!m || Array.isArray(m)) return;
    if (o.isSprite || m.transparent || m.visible === false) m.userData.outlineParameters = { visible: false };
  });

  const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.03, 60);
  scene.add(camera);
  const flash = new THREE.SpotLight('#fff6e0', 0, 9, 0.32, 0.45, 1.2);
  flash.position.set(0.15, -0.1, 0);
  flash.target.position.set(0, 0, -1);
  camera.add(flash, flash.target);

  const P = { x: C.SPAWN.pos[0], z: C.SPAWN.pos[1], yaw: C.SPAWN.yaw, pitch: 0, eye: EYE, crouch: false, slow: false };
  const keys = new Set();
  const tools = { flashlight: false, uv: false, photo: false, focal: 24, normalFov: 70 };
  let paused = true;
  let lastZone = 'landing';
  const inFragile = new Set();
  let trackTimer = 0;
  const track = [];

  // ---------- Ввод ----------
  const canvas = renderer.domElement;
  canvas.addEventListener('click', () => { if (!paused && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas || paused) return;
    const k = tools.photo ? 0.0012 * (24 / tools.focal) ** 0.5 : 0.0022;
    P.yaw -= e.movementX * k;
    P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch - e.movementY * k));
  });
  canvas.addEventListener('wheel', (e) => {
    if (!tools.photo) return;
    tools.focal = Math.max(24, Math.min(105, tools.focal - Math.sign(e.deltaY) * 6));
    applyFov();
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('keydown', (e) => { keys.add(e.code); });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('resize', () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  });

  function applyFov() {
    // вертикальный угол для полнокадрового эквивалента (высота кадра 24 мм)
    camera.fov = tools.photo ? THREE.MathUtils.radToDeg(2 * Math.atan(12 / tools.focal)) * 1.25 : tools.normalFov;
    camera.updateProjectionMatrix();
  }

  // ---------- Коллизии ----------
  function collide(nx, nz) {
    for (let it = 0; it < 3; it++) {
      for (const c of W.colliders) {
        if (c.off) continue;
        const cx = Math.max(c.x1, Math.min(nx, c.x2));
        const cz = Math.max(c.z1, Math.min(nz, c.z2));
        const dx = nx - cx, dz = nz - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 0.0001;
          if (d2 === 0) { nx += R; continue; }
          nx = cx + (dx / d) * R;
          nz = cz + (dz / d) * R;
        }
      }
    }
    return [nx, nz];
  }

  // ---------- Наведение ----------
  const ray = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  function skipHit(o, st) {
    if (o.isSprite) return true;
    if (o.userData.evId) {
      const es = st.evidence[o.userData.evId];
      return !es.detected || (es.collected && !es.collected.noTouch);
    }
    if (o.userData.noOcclude) return true;
    if (o.userData.npc) return !W.npcs[o.userData.npc].group.visible;
    const m = o.material;
    return !Array.isArray(m) && m && (m.transparent || m.visible === false);
  }
  function pick() {
    ray.setFromCamera(center, camera);
    ray.far = 3.2;
    const st = store.state;
    for (const h of ray.intersectObjects(scene.children, true)) {
      const o = h.object;
      if (skipHit(o, st)) continue;
      if (o.userData.evId) return h.distance < 2.6 ? { kind: 'evidence', id: o.userData.evId, dist: h.distance } : null;
      if (o.userData.npc) return { kind: 'npc', id: o.userData.npc, dist: h.distance };
      if (o.userData.door) return h.distance < 2.6 && !W.doors.balcony.open ? { kind: 'door', id: o.userData.door, dist: h.distance } : null;
      return null;
    }
    return null;
  }
  function occluded(from, to, evId) {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    ray.set(from, dir.normalize());
    ray.far = dist;
    const st = store.state;
    for (const h of ray.intersectObjects(scene.children, true)) {
      const o = h.object;
      if (o.userData.evId === evId) return false;
      if (skipHit(o, st) || o.userData.npc) continue;
      return h.distance < dist - 0.06;
    }
    return false;
  }

  // ---------- Скрытые следы ----------
  const tmp = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  function hiddenCheck() {
    const st = store.state;
    camera.getWorldDirection(fwd);
    for (const ev of Object.values(W.evidence)) {
      const e = ev.def;
      if (!e.visibility) continue;
      const es = st.evidence[e.id];
      tmp.copy(ev.center).sub(camera.position);
      const dist = tmp.length();
      tmp.normalize();
      const inCone = tmp.dot(fwd) > Math.cos(THREE.MathUtils.degToRad(24));
      const elev = THREE.MathUtils.radToDeg(Math.asin(Math.abs(tmp.dot(ev.normal))));
      let cond = false, via = '';
      if (e.visibility === 'oblique') { cond = tools.flashlight && inCone && dist < 3 && elev < 27; via = 'oblique_light'; }
      if (e.visibility === 'low_flash') { cond = tools.flashlight && inCone && dist < 2.5 && P.eye < 1.2; via = 'flashlight_low'; }
      if (e.visibility === 'latent') {
        cond = (tools.uv && inCone && dist < 1.8) || (tools.flashlight && inCone && dist < 0.9 && elev < 40);
        via = tools.uv ? 'uv' : 'oblique_light';
      }
      if (cond && !es.detected) {
        store.dispatch({ t: now(), type: 'evidence.detected', id: e.id, via });
        onToast?.(`Выявлено: ${e.title}`, 'good');
      }
      const show = es.detected || cond;
      let op = show ? 1 : 0;
      if (e.latent) {
        const pm = ev.group.userData.printMat;
        if (es.powder) { op = es.powder.result === 'none' ? 0.15 : es.powder.quality * (es.powder.result === 'weak' ? 0.5 : 0.95); pm.color.set(es.powder.powder === 'powder_dark' ? '#1a1a1a' : '#f2f2f2'); }
        else if (tools.uv && cond) { op = 1; pm.color.set('#7ff7ff'); }
        else { op = show ? 0.35 : 0; pm.color.set('#e6f2ff'); }
      }
      for (const m of ev.hidden) { m.visible = op > 0; m.material.opacity = op; }
    }
  }

  // ---------- Хрупкие зоны ----------
  function fragileCheck() {
    const st = store.state;
    for (const fz of C.FRAGILE_ZONES) {
      const [x1, z1, x2, z2] = fz.rect;
      const inside = P.x > x1 && P.x < x2 && P.z > z1 && P.z < z2;
      const onBridge = st.bridges.some(([a, b, c, d]) => P.x > a && P.x < c && P.z > b && P.z < d);
      if (inside && !onBridge && !inFragile.has(fz.id)) {
        inFragile.add(fz.id);
        const already = fz.evidence.every((id) => st.evidence[id].damaged || st.evidence[id].collected);
        store.dispatch({ t: now(), type: 'player.stepped', zone: fz.id, onBridge: false });
        addFootprints(P.x, P.z, fz.id === 'FZ_balcony' ? 'rgba(120,130,150,0.8)' : 'rgba(60,45,35,0.6)');
        if (!already) onToast?.(fz.msg, 'bad');
        if (fz.id === 'FZ_balcony') W.evidence.ev02_snow.group.userData.snow.material = toon('#d5dbe3');
      }
      if (!inside || onBridge) inFragile.delete(fz.id);
    }
  }
  function addFootprints(x, z, color) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), W.decalMat(TX.footprints(color, 4)));
    m.rotation.x = -Math.PI / 2; m.rotation.z = P.yaw;
    m.position.set(x, x > 1.2 && z > 8.6 ? 0.125 : 0.008, z);
    scene.add(m);
  }

  // ---------- Цикл ----------
  let clockFn = () => 0;
  const now = () => clockFn();
  let prevT = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    const tNow = performance.now();
    const dt = Math.min(0.05, (tNow - prevT) / 1000);
    prevT = tNow;
    if (!paused) {
      P.crouch = keys.has('KeyC') || keys.has('ControlLeft');
      P.slow = keys.has('ShiftLeft') || keys.has('ShiftRight');
      P.eye += ((P.crouch ? CROUCH : EYE) - P.eye) * Math.min(1, dt * 10);
      const sp = P.crouch ? 0.9 : P.slow ? 1.0 : 2.1;
      let mx = 0, mz = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      if (mx || mz) {
        const l = Math.hypot(mx, mz);
        mx /= l; mz /= l;
        const s = Math.sin(P.yaw), c = Math.cos(P.yaw);
        const dx = (mx * c + mz * s) * sp * dt;
        const dz = (-mx * s + mz * c) * sp * dt;
        [P.x, P.z] = collide(P.x + dx, P.z + dz);
      }
      const zn = zoneAt(P.x, P.z);
      if (zn !== lastZone && zn !== 'outside') {
        lastZone = zn;
        store.dispatch({ t: now(), type: 'player.zone', zone: zn });
      }
      fragileCheck();
      trackTimer += dt;
      if (trackTimer > 1.5) {
        trackTimer = 0;
        const last = track[track.length - 1];
        if (!last || Math.hypot(last[0] - P.x, last[1] - P.z) > 0.2) {
          track.push([+P.x.toFixed(2), +P.z.toFixed(2)]);
          store.dispatch({ t: now(), type: 'player.track', x: +P.x.toFixed(2), z: +P.z.toFixed(2) });
        }
      }
    }
    const onBalc = P.x > 1.2 && P.z > 8.6 && store.state.bridges.some(([a, b, c, d]) => P.x > a && P.x < c && P.z > b && P.z < d);
    camera.position.set(P.x, P.eye + (onBalc ? 0.12 : 0), P.z);
    camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
    flash.intensity = tools.flashlight || tools.uv ? 9 : 0;
    flash.color.set(tools.uv ? '#7a3cff' : '#fff6e0');
    const dim = tools.uv ? 0.25 : 1;
    W.lamps.forEach((l, i) => { l.intensity = [3, 3, 1.6, 2.4, 3.2][i] * dim; });
    hiddenCheck();
    if (!paused) onTarget?.(pick());
    effect.render(scene, camera);
  }

  // ---------- Фотосъёмка ----------
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 320; thumbCanvas.height = 200;
  function capturePhoto(kind) {
    effect.render(scene, camera);
    const g = thumbCanvas.getContext('2d');
    const src = renderer.domElement;
    const ar = 320 / 200, sar = src.width / src.height;
    let sw = src.width, sh = src.height, sx = 0, sy = 0;
    if (sar > ar) { sw = sh * ar; sx = (src.width - sw) / 2; } else { sh = sw / ar; sy = (src.height - sh) / 2; }
    g.drawImage(src, sx, sy, sw, sh, 0, 0, 320, 200);
    const thumb = thumbCanvas.toDataURL('image/jpeg', 0.8);

    const st = store.state;
    camera.getWorldDirection(fwd);
    const visible = [];
    for (const ev of Object.values(W.evidence)) {
      const e = ev.def;
      const es = st.evidence[e.id];
      if (!es.detected || (es.collected && !es.collected.noTouch)) continue;
      const share = frameShare(ev.center, e.size);
      if (share <= 0) continue;
      const samples = [ev.center.clone(), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ev.center.clone().add(new THREE.Vector3(a * e.size[0] * 0.35, e.size[1] * 0.4, b * e.size[2] * 0.35)))];
      if (samples.every((p) => occluded(camera.position, p, e.id))) continue;
      const axis = THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, fwd.dot(ev.normal.clone().negate())))));
      const pc = ev.center.clone().project(camera);
      visible.push({ id: e.id, centerDist: +Math.hypot(pc.x, pc.y).toFixed(3), frameShare: +share.toFixed(4), axisAngleDeg: +axis.toFixed(1), dist: +camera.position.distanceTo(ev.center).toFixed(2), hasScale: es.scale, hasMarker: es.marker > 0 });
    }
    const entryShare = frameShare(new THREE.Vector3(1.45, 1.0, 0), [0.9, 2.0, 0.1]);
    const meta = {
      declaredKind: kind, focal: tools.focal, camZone: zoneAt(P.x, P.z), seesEntry: entryShare > 0.03,
      visible, cam: { x: +P.x.toFixed(2), y: +P.eye.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3) },
    };
    return { meta, thumb };
  }
  function frameShare(c, size) {
    const v = new THREE.Vector3();
    let minX = 1, minY = 1, maxX = -1, maxY = -1, any = false;
    const camInv = camera.matrixWorldInverse;
    const cc = c.clone().applyMatrix4(camInv);
    if (cc.z > -0.05) return 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      v.set(c.x + sx * Math.max(size[0], 0.02) / 2, c.y + sy * Math.max(size[1], 0.01) / 2, c.z + sz * Math.max(size[2], 0.02) / 2);
      const vc = v.clone().applyMatrix4(camInv);
      if (vc.z > -0.02) continue;
      v.project(camera);
      any = true;
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    if (!any) return 0;
    const x1 = Math.max(-1, minX), x2 = Math.min(1, maxX), y1 = Math.max(-1, minY), y2 = Math.min(1, maxY);
    if (x2 <= x1 || y2 <= y1) return 0;
    return ((x2 - x1) * (y2 - y1)) / 4;
  }

  // ---------- Предметы инструментов ----------
  function surfaceOffset(e) {
    const n = new THREE.Vector3(...e.normal);
    const side = Math.abs(n.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0).cross(n).normalize();
    return { n, side };
  }
  function addMarker(id, num) {
    const ev = W.evidence[id];
    const { n, side } = surfaceOffset(ev.def);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.035), new THREE.MeshToonMaterial({ map: TX.markerNum(num) }));
    const p = ev.center.clone().addScaledVector(side, Math.max(ev.def.size[0], ev.def.size[2]) / 2 + 0.07);
    if (Math.abs(n.y) > 0.5) p.y += 0.025; else { p.addScaledVector(n, 0.03); p.y = ev.center.y - ev.def.size[1] / 2 - 0.04; }
    m.position.copy(p);
    m.lookAt(camera.position.x, p.y, camera.position.z);
    scene.add(m);
  }
  function addScale(id) {
    const ev = W.evidence[id];
    const { n, side } = surfaceOffset(ev.def);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.025), W.decalMat(TX.ruler(), { transparent: false }));
    const p = ev.center.clone();
    if (Math.abs(n.y) > 0.5) {
      m.rotation.x = -Math.PI / 2;
      p.z += ev.def.size[2] / 2 + 0.03; p.y += 0.004;
    } else {
      m.rotation.y = Math.atan2(n.x, n.z);
      p.addScaledVector(n, 0.012); p.y -= ev.def.size[1] / 2 + 0.03;
    }
    m.position.copy(p);
    scene.add(m);
    void side;
  }
  function removeEvidence(id) {
    const ev = W.evidence[id];
    ev.group.traverse((o) => { if (o.isMesh && o !== ev.hit) o.visible = false; });
    ev.hidden.length = 0;
  }
  function placeBridge() {
    const s = Math.sin(P.yaw), c = Math.cos(P.yaw);
    const cx = P.x - s * 0.6, cz = P.z - c * 0.6;
    const rect = [cx - 0.4, cz - 0.4, cx + 0.4, cz + 0.4];
    const y = cx > 1.2 && cz > 8.6 ? 0.12 : 0.06;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.8), toon('#9aa4ad'));
    m.position.set(cx, y, cz);
    scene.add(m);
    for (const [a, b] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, y, 0.03), toon('#5d6670'));
      leg.position.set(cx + a, y / 2, cz + b); scene.add(leg);
    }
    return rect.map((v) => +v.toFixed(2));
  }
  function openBalconyDoor() {
    const d = W.doors.balcony;
    d.open = true;
    d.group.rotation.y = Math.PI / 2;
    d.collider.x1 = 2.55; d.collider.x2 = 2.65; d.collider.z1 = 7.8; d.collider.z2 = 8.6;
  }
  function showNpc(id, pos) {
    const n = W.npcs[id];
    n.group.visible = true;
    n.col.off = false;
    if (pos) {
      n.group.position.set(pos[0], 0, pos[1]);
      Object.assign(n.col, { x1: pos[0] - 0.25, z1: pos[1] - 0.25, x2: pos[0] + 0.25, z2: pos[1] + 0.25 });
    }
  }
  function victimMarker() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    const g = cv.getContext('2d');
    g.strokeStyle = '#f2f2f2'; g.lineWidth = 6; g.setLineDash([12, 8]);
    g.beginPath(); g.arc(64, 30, 22, 0, 7); g.moveTo(64, 52); g.lineTo(64, 160); g.moveTo(20, 80); g.lineTo(108, 80); g.moveTo(64, 160); g.lineTo(34, 240); g.moveTo(64, 160); g.lineTo(94, 240); g.stroke();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), W.decalMat(new THREE.CanvasTexture(cv)));
    m.rotation.x = -Math.PI / 2;
    m.position.set(1.55, 0.01, 2.2);
    m.rotation.z = Math.PI / 2 + 0.3;
    scene.add(m);
  }

  frame();

  return {
    renderer, camera, P, tools, W, track,
    setClock(fn) { clockFn = fn; },
    setPaused(v) {
      paused = v;
      if (v && document.pointerLockElement) document.exitPointerLock();
      keys.clear();
    },
    get paused() { return paused; },
    lock() { canvas.requestPointerLock?.(); },
    setPhoto(on) { tools.photo = on; applyFov(); },
    setFov(f) { tools.normalFov = f; applyFov(); },
    capturePhoto, addMarker, addScale, removeEvidence, placeBridge, openBalconyDoor, showNpc, victimMarker,
    moveNpc(id, x, z) { const n = W.npcs[id]; n.group.position.set(x, 0, z); Object.assign(n.col, { x1: x - 0.25, z1: z - 0.25, x2: x + 0.25, z2: z + 0.25 }); },
    measure(id) {
      const e = W.evidence[id].def;
      const [x, , z] = e.pos;
      return C.LANDMARKS.map((lm) => ({ lm: lm.id, name: lm.name, d: Math.hypot(lm.pos[0] - x, lm.pos[1] - z) }))
        .sort((a, b) => a.d - b.d).slice(0, 2);
    },
  };
}
