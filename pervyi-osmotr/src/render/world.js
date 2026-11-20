// Процедурная сцена: подъезд и квартира № 7. Toon-материалы + контурная обводка.
// Имена узлов: EV_ — улики, LM_ — ориентиры, COL_ — коллизии (как в пайплайне GLB из ТЗ).
import * as THREE from 'three';
import * as TX from './textures.js';
import { zoneAt } from '../content/layout.js';

const grad = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;

const matCache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(Object.keys(opts));
  if (!opts.map && !opts.transparent && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: grad, ...opts });
  if (!opts.map && !opts.transparent) matCache.set(key, m);
  return m;
}
function decalMat(map, opts = {}) {
  const m = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, ...opts });
  m.userData.outlineParameters = { visible: false };
  return m;
}

export function buildWorld(C) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b2333');
  scene.fog = new THREE.Fog('#1b2333', 14, 30);
  const colliders = []; // {x1,z1,x2,z2, id?}
  const occluders = [];
  const evidence = {};
  const npcs = {};
  const doors = {};

  const box = (w, h, d, color, x, y, z, { parent = scene, collide = false, mat, name } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat ?? toon(color));
    m.position.set(x, y, z);
    if (name) m.name = name;
    parent.add(m);
    if (collide) colliders.push({ x1: x - w / 2, z1: z - d / 2, x2: x + w / 2, z2: z + d / 2, name });
    return m;
  };
  const cyl = (r, h, color, x, y, z, parent = scene, seg = 14) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), toon(color));
    m.position.set(x, y, z); parent.add(m); return m;
  };
  const plane = (w, d, mat, x, y, z, rotX = -Math.PI / 2, parent = scene) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = rotX; m.position.set(x, y, z); parent.add(m); return m;
  };

  // ---------- Полы и потолки ----------
  const floors = [
    { r: [-0.6, -3.2, 3.6, 0], m: toon('#7d7f7a') },
    { r: [0, 0, 3, 4], m: toon('#ffffff', { map: TX.linoleum() }) },
    { r: [-1.8, 0, 0, 4], m: toon('#ffffff', { map: TX.tiles('#cfdcdf') }) },
    { r: [3, 0, 6.2, 4], m: toon('#ffffff', { map: TX.linoleum() }) },
    { r: [-1.8, 4, 6.2, 8.6], m: toon('#ffffff', { map: TX.parquet() }) },
    { r: [1.2, 8.6, 5.2, 9.8], m: toon('#8b8f94') },
  ];
  for (const f of floors) {
    const [x1, z1, x2, z2] = f.r;
    plane(x2 - x1, z2 - z1, f.m, (x1 + x2) / 2, 0, (z1 + z2) / 2).name = 'SURF_floor';
    if (f.r[3] <= 8.6) plane(x2 - x1, z2 - z1, toon('#e9e6df'), (x1 + x2) / 2, C.CEILING, (z1 + z2) / 2, Math.PI / 2);
  }

  // ---------- Стены ----------
  const T = 0.12;
  const M = {
    landingLow: toon('#5d8a6a'), landingHigh: toon('#d6d9d2'),
    paper: toon('#ffffff', { map: TX.wallpaper() }), tile: toon('#ffffff', { map: TX.tiles('#e8efe4') }),
    bathTile: toon('#ffffff', { map: TX.tiles('#cfe0e6') }), outside: toon('#9aa1a8'),
  };
  const faceMat = (zone, low) => zone === 'landing' ? (low ? M.landingLow : M.landingHigh)
    : zone === 'kitchen' ? M.tile : zone === 'bath' ? M.bathTile : zone === 'outside' || zone === 'balcony' ? M.outside : M.paper;
  const cuts = { z: [...new Set(C.ZONES.flatMap((zn) => [zn.rect[0], zn.rect[2]]))], x: [...new Set(C.ZONES.flatMap((zn) => [zn.rect[1], zn.rect[3]]))] };
  function wallSeg(axis, at, a, b, y1 = 0, y2 = C.CEILING) {
    if (b - a < 0.01) return;
    const inner = cuts[axis].filter((c) => c > a + 0.01 && c < b - 0.01).sort((p, q) => p - q);
    if (inner.length) {
      let cur = a;
      for (const c of inner) { wallSeg(axis, at, cur, c, y1, y2); cur = c; }
      wallSeg(axis, at, cur, b, y1, y2);
      return;
    }
    const len = b - a, mid = (a + b) / 2;
    const zp = axis === 'z' ? zoneAt(mid, at + 0.2) : zoneAt(at + 0.2, mid);
    const zm = axis === 'z' ? zoneAt(mid, at - 0.2) : zoneAt(at - 0.2, mid);
    const parts = y1 < 1.4 && y2 > 1.4 ? [[y1, 1.4, true], [1.4, y2, false]] : [[y1, y2, y2 <= 1.4]];
    for (const [yy1, yy2, low] of parts) {
      const hh = yy2 - yy1;
      const pm = faceMat(zp, low), mm = faceMat(zm, low);
      // порядок граней BoxGeometry: +x, -x, +y, -y, +z, -z
      const mats = axis === 'z' ? [pm, pm, pm, pm, pm, mm] : [pm, mm, pm, pm, pm, pm];
      const geo = axis === 'z' ? new THREE.BoxGeometry(len, hh, T) : new THREE.BoxGeometry(T, hh, len);
      const m = new THREE.Mesh(geo, mats);
      if (axis === 'z') m.position.set(mid, yy1 + hh / 2, at); else m.position.set(at, yy1 + hh / 2, mid);
      scene.add(m);
      occluders.push(m);
    }
    if (y1 < 1) colliders.push(axis === 'z' ? { x1: a, z1: at - T / 2, x2: b, z2: at + T / 2 } : { x1: at - T / 2, z1: a, x2: at + T / 2, z2: b });
  }
  for (const w of C.WALLS) {
    let cur = w.from;
    const gaps = [...w.gaps].sort((p, q) => p[0] - q[0]);
    for (const [g1, g2] of gaps) {
      wallSeg(w.axis, w.at, cur, g1);
      wallSeg(w.axis, w.at, g1, g2, 2.1, C.CEILING);
      cur = g2;
    }
    if (w.window) {
      const [a, b] = w.window;
      wallSeg(w.axis, w.at, cur, a);
      wallSeg(w.axis, w.at, a, b, 0, 0.9);
      wallSeg(w.axis, w.at, a, b, 2.1, C.CEILING);
      const glass = plane(b - a, 1.2, new THREE.MeshBasicMaterial({ color: '#8fb3d9', transparent: true, opacity: 0.35 }), (a + b) / 2, 1.5, w.at, 0);
      glass.userData.noOcclude = true;
      cur = b;
    }
    wallSeg(w.axis, w.at, cur, w.to);
  }
  // ограждение балкона
  for (const r of C.RAILINGS) {
    const len = r.to - r.from, mid = (r.from + r.to) / 2;
    if (r.axis === 'z') { box(len, 1.0, 0.1, '#6e747a', mid, 0.5, r.at, { collide: true }); box(len, 0.06, 0.16, '#f4f7fb', mid, 1.03, r.at); }
    else { box(0.1, 1.0, len, '#6e747a', r.at, 0.5, mid, { collide: true }); box(0.16, 0.06, len, '#f4f7fb', r.at, 1.03, mid); }
  }
  // улица за балконом
  box(30, 0.1, 20, '#dfe6ee', 3, -6, 20);
  for (let i = 0; i < 6; i++) box(0.3, 4 + (i % 3), 0.3, '#3a2d25', -4 + i * 3.2, -4, 14 + (i % 2) * 2);
  box(14, 9, 0.5, '#7b8794', 3, -2, 26);

  // ---------- Подъезд ----------
  const nb = box(0.06, 2.05, 0.9, '#7a3f2a', -0.53, 1.02, -2.0);
  nb.name = 'door_neighbor';
  box(0.03, 0.03, 0.12, '#d4af37', -0.49, 1.0, -1.7); // дверь соседки
  for (let i = 0; i < 5; i++) box(1.6, 0.16, 0.3, '#9a9c97', 2.6, -0.08 - i * 0.16, -3.05 + i * 0.0); // ступени (декор)
  box(1.2, 0.5, 0.2, '#5f6b7a', 2.8, 1.6, -3.08); // почтовые ящики
  box(0.06, 1.0, 0.06, '#333', 1.9, 0.5, -1.9, { collide: false });
  // входная дверь — приоткрыта наружу
  const entry = new THREE.Group();
  entry.position.set(1.0, 0, 0);
  box(0.06, 2.05, 0.9, '#5a3424', 0.03, 1.025, -0.45, { parent: entry });
  scene.add(entry);
  colliders.push({ x1: 0.97, z1: -0.92, x2: 1.09, z2: 0 });
  doors.entry = { group: entry, box: new THREE.Box3(new THREE.Vector3(1.0, 0, -0.05), new THREE.Vector3(1.9, 2.0, 0.05)) };

  // ---------- Прихожая ----------
  box(0.45, 0.8, 0.8, '#7b5b3e', 0.225, 0.4, 2.7, { collide: true, name: 'тумба' });
  box(0.03, 0.9, 0.6, '#c6d4e1', 0.03, 1.5, 2.7); // зеркало
  box(0.25, 1.7, 1.0, '#6b4b33', 2.85, 0.85, 0.9, { collide: false }).scale.set(0.4, 1, 1); // вешалка-стойка
  box(0.12, 0.05, 1.0, '#4a3322', 2.9, 1.75, 0.9);
  box(0.2, 0.9, 0.5, '#2f3e53', 2.85, 1.3, 0.75); // куртка
  box(0.35, 0.18, 0.4, '#2a2a2a', 2.75, 0.09, 1.25); // обувь хозяина
  box(0.9, 0.01, 0.6, '#7b2d3b', 1.75, 0.005, 3.25); // коврик (сдвинут)
  box(0.05, 0.1, 0.07, '#f2f2f2', 0.94, 1.1, 0.12); // выключатель

  // ---------- Санузел ----------
  box(1.7, 0.6, 0.75, '#f4f7f8', -0.95, 0.3, 3.55, { collide: true }); // ванна
  box(0.5, 0.15, 0.4, '#f4f7f8', -1.2, 0.85, 0.5, { collide: false });
  box(0.12, 0.85, 0.12, '#f4f7f8', -1.2, 0.42, 0.5, { collide: true });
  box(0.4, 0.4, 0.55, '#f4f7f8', -1.45, 0.2, 2.0, { collide: true }); // унитаз

  // ---------- Кухня ----------
  box(1.0, 0.04, 0.7, '#c9b38c', 4.8, 0.75, 2.5); // стол
  for (const [x, z] of [[4.35, 2.2], [5.25, 2.2], [4.35, 2.8], [5.25, 2.8]]) box(0.05, 0.75, 0.05, '#6b5a43', x, 0.37, z);
  colliders.push({ x1: 4.3, z1: 2.15, x2: 5.3, z2: 2.85 });
  box(0.4, 0.45, 0.4, '#6b5a43', 4.0, 0.45, 3.1, { collide: true });
  box(0.6, 0.9, 2.2, '#e8e4da', 5.9, 0.45, 1.2, { collide: true }); // тумбы
  box(0.62, 0.04, 2.22, '#8e7b62', 5.9, 0.91, 1.2);
  box(0.6, 1.8, 0.6, '#f0f0f0', 5.9, 0.9, 3.5, { collide: true }); // холодильник
  box(0.6, 0.85, 0.6, '#d9d9d9', 3.35, 0.43, 0.4, { collide: true }); // плита
  box(0.55, 0.6, 0.35, '#e8e4da', 5.95, 1.8, 1.2); // навесной шкаф

  // ---------- Комната ----------
  box(2.0, 0.45, 0.85, '#556b5d', 3.5, 0.23, 4.5, { collide: true }); box(2.0, 0.5, 0.2, '#4d6255', 3.5, 0.65, 4.15); // диван
  box(0.9, 0.04, 0.55, '#7b5b3e', 3.4, 0.44, 5.7); for (const [x, z] of [[3.0, 5.5], [3.8, 5.5], [3.0, 5.9], [3.8, 5.9]]) box(0.04, 0.44, 0.04, '#4a3322', x, 0.22, z);
  colliders.push({ x1: 2.95, z1: 5.42, x2: 3.85, z2: 5.98 });
  // стеллаж с полками и стеклянными дверцами
  box(0.05, 2.0, 2.2, '#6d4c33', 6.15, 1.0, 5.9);
  box(0.4, 2.0, 0.04, '#6d4c33', 6.0, 1.0, 4.8);
  box(0.4, 2.0, 0.04, '#6d4c33', 6.0, 1.0, 7.0);
  colliders.push({ x1: 5.78, z1: 4.78, x2: 6.2, z2: 7.02, name: 'стеллаж' });
  for (const y of [0.4, 0.8, 1.2, 1.6]) box(0.38, 0.02, 2.15, '#8a6748', 5.98, y, 5.9);
  for (let i = 0; i < 9; i++) box(0.22, 0.25 + (i % 3) * 0.04, 0.05, ['#8d2f2f', '#2f4f8d', '#3d6b3d'][i % 3], 6.0, 0.55, 5.0 + i * 0.12);
  const glassMat = new THREE.MeshBasicMaterial({ color: '#bcd7ea', transparent: true, opacity: 0.18, depthWrite: false });
  glassMat.userData.outlineParameters = { visible: false };
  const g1 = plane(2.1, 1.1, glassMat, 5.79, 1.45, 5.9, 0); g1.rotation.y = -Math.PI / 2; g1.userData.noOcclude = true;
  box(0.4, 0.04, 2.2, '#6d4c33', 6.0, 2.0, 5.9);
  // стол, стул, ковёр, телевизор
  box(0.8, 0.04, 1.3, '#7b5b3e', -1.35, 0.76, 7.15, { collide: true });
  box(0.45, 0.45, 0.45, '#3f3f46', -0.6, 0.23, 7.15, { collide: true });
  box(3.0, 0.01, 2.0, '#8a3b3b', 2.0, 0.003, 6.6);
  box(1.4, 0.5, 0.45, '#3b3b3b', -1.5, 0.25, 5.0, { collide: true }); box(0.06, 0.6, 1.0, '#111', -1.5, 0.85, 5.0);
  // балконная дверь (закрыта, стекло разбито)
  const bd = new THREE.Group();
  bd.position.set(2.6, 0, 8.6);
  box(0.8, 0.1, 0.05, '#e8e8e8', 0.4, 0.05, 0, { parent: bd });
  box(0.8, 0.1, 0.05, '#e8e8e8', 0.4, 2.05, 0, { parent: bd });
  box(0.1, 2.1, 0.05, '#e8e8e8', 0.05, 1.05, 0, { parent: bd });
  box(0.1, 2.1, 0.05, '#e8e8e8', 0.75, 1.05, 0, { parent: bd });
  box(0.8, 0.45, 0.05, '#e8e8e8', 0.4, 0.3, 0, { parent: bd });
  box(0.6, 0.04, 0.05, '#e8e8e8', 0.4, 1.3, 0, { parent: bd });
  box(0.06, 0.12, 0.04, '#d8d8d8', 0.1, 1.15, -0.04, { parent: bd }); // шпингалет
  const shardMat = new THREE.MeshBasicMaterial({ color: '#cfe6f5', transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  shardMat.userData.outlineParameters = { visible: false };
  for (const [x, y, s] of [[0.15, 1.9, 0.18], [0.65, 1.95, 0.15], [0.12, 0.62, 0.1], [0.68, 0.7, 0.12], [0.6, 1.25, 0.08]]) {
    const tri = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.6, 3), shardMat);
    tri.position.set(x, y, 0); tri.rotation.z = x < 0.4 ? -1.2 : 1.2; tri.scale.z = 0.05; tri.userData.noOcclude = true; bd.add(tri);
  }
  bd.traverse((o) => { if (o.isMesh) o.userData.door = 'balcony'; });
  scene.add(bd);
  const bdCol = { x1: 2.6, z1: 8.55, x2: 3.4, z2: 8.65, name: 'balcony_door' };
  colliders.push(bdCol);
  doors.balcony = { group: bd, collider: bdCol, open: false };

  // ---------- Улики ----------
  for (const e of C.EVIDENCE) evidence[e.id] = buildEvidence(e);

  function buildEvidence(e) {
    const g = new THREE.Group();
    g.name = 'EV_' + e.id;
    const [x, y, z] = e.pos;
    g.position.set(x, y, z);
    scene.add(g);
    const hidden = [];
    const add = (m, hide = true) => { g.add(m); if (hide && e.visibility) hidden.push(m); return m; };
    const flat = (w, d, map, opts) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), decalMat(map, opts)); m.rotation.x = -Math.PI / 2; return m; };
    switch (e.model) {
      case 'glass': {
        const mat = new THREE.MeshBasicMaterial({ color: '#d7eefa', transparent: true, opacity: 0.75 });
        for (let i = 0; i < 26; i++) {
          const s = 0.02 + ((i * 37) % 7) * 0.008;
          const m = new THREE.Mesh(new THREE.ConeGeometry(s, s * 0.3, 3), mat);
          const a = i * 2.4, r = 0.05 + ((i * 13) % 10) * 0.032;
          m.position.set(Math.cos(a) * r * 1.3, 0, -0.25 + Math.abs(Math.sin(a)) * r);
          m.rotation.y = a; add(m, false);
        }
        break;
      }
      case 'snow': {
        const s = new THREE.Mesh(new THREE.BoxGeometry(e.size[0], e.size[1], e.size[2]), toon('#f6f9fc', { emissive: '#5a6270' }));
        add(s, false);
        box(4.0, 0.05, 0.16, '#f6f9fc', 0, 1.0, 0.6, { parent: g });
        g.userData.snow = s;
        break;
      }
      case 'lock': {
        add(box(0.05, 0.16, 0.08, '#b9a46a', 0, 0, 0, { parent: g }), false);
        add(cyl(0.015, 0.03, '#d0c28a', 0.03, 0.03, 0, g), false).rotation.z = Math.PI / 2;
        break;
      }
      case 'shoeprint': {
        add(flat(e.size[0] * 1.15, e.size[2], TX.shoeprint()));
        break;
      }
      case 'stain': {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), decalMat(TX.stain()));
        m.rotation.y = Math.PI / 2; add(m, false);
        break;
      }
      case 'butt': {
        add(cyl(0.065, 0.012, '#f2f2f2', 0, -0.02, 0, g, 18), false);
        const b = add(cyl(0.006, 0.035, '#e8e2d0', 0.01, -0.006, 0, g, 8), false); b.rotation.z = Math.PI / 2;
        add(cyl(0.0062, 0.012, '#d4892a', 0.03, -0.006, 0, g, 8), false).rotation.z = Math.PI / 2;
        break;
      }
      case 'cups': {
        add(box(0.3, 0.02, 0.18, '#9aa3ab', 0, -0.06, 0, { parent: g }), false);
        add(cyl(0.04, 0.08, '#f4f4f4', -0.07, 0, 0, g), false);
        add(cyl(0.04, 0.08, '#e6eef8', 0.07, 0, 0, g), false);
        break;
      }
      case 'dust': {
        add(flat(e.size[0] * 1.6, e.size[2] * 1.3, TX.dustShelf()));
        break;
      }
      case 'valuables': {
        add(box(0.2, 0.08, 0.15, '#7a2e2e', 0, 0, -0.18, { parent: g }), false);
        add(box(0.16, 0.02, 0.1, '#6a9c5a', 0, 0.05, -0.18, { parent: g }), false);
        add(box(0.35, 0.02, 0.25, '#30343a', 0, -0.03, 0.15, { parent: g }), false);
        break;
      }
      case 'prints': {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), decalMat(TX.fingerprints(), { color: '#ffffff' }));
        m.rotation.y = Math.atan2(e.normal[0], e.normal[2]);
        add(m);
        g.userData.printMat = m.material;
        break;
      }
      case 'receipt': {
        add(flat(e.size[0], e.size[2], TX.receipt()));
        break;
      }
      case 'phone': {
        add(box(0.075, 0.01, 0.155, '#111', 0, 0, 0, { parent: g }), false);
        add(flat(0.065, 0.135, TX.phoneScreen()), false).position.y = 0.006;
        break;
      }
      case 'bandage': {
        add(box(0.12, 0.02, 0.07, '#f4f4f4', 0, 0, 0, { parent: g }), false);
        add(box(0.09, 0.015, 0.05, '#5aa0d8', 0.1, 0, 0.06, { parent: g }), false);
        add(box(0.09, 0.015, 0.05, '#5aa0d8', 0.06, 0, 0.1, { parent: g }), false).rotation.y = 0.7;
        break;
      }
      case 'boots': {
        add(flat(1.0, 1.0, TX.footprints()), false).rotation.z = 0.4;
        break;
      }
      case 'water': {
        add(flat(0.35, 0.25, null, { color: '#7fc4ff', opacity: 0.45 }), false);
        add(flat(0.4, 0.3, null, { color: '#7fc4ff', opacity: 0.35 }), false).position.set(0.1, -0.85, 0.35);
        break;
      }
      default: break;
    }
    // невидимый хит-бокс для наведения
    const hs = e.size.map((v) => Math.max(v, 0.12));
    const hit = new THREE.Mesh(new THREE.BoxGeometry(...hs), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.evId = e.id;
    g.add(hit);
    for (const m of hidden) { m.material.opacity = 0; m.visible = false; }
    return { def: e, group: g, hit, hidden, center: new THREE.Vector3(x, y, z), normal: new THREE.Vector3(...e.normal) };
  }

  // ---------- Персонажи ----------
  function buildNpc(id, x, z, rotY, visible = true) {
    const n = C.NPCS[id];
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const female = id === 'sosedka' || id === 'orlova';
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 4, 10), toon(n.color));
    body.position.y = 0.75; g.add(body);
    if (female) { const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 12), toon(n.color)); skirt.position.y = 0.45; g.add(skirt); }
    if (id === 'belov') { const cap = cyl(0.17, 0.08, '#24324a', 0, 1.78, 0, g); cap.scale.set(1, 1, 1.15); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), toon('#e8c2a0'));
    head.position.y = 1.55; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(n.hair));
    hair.position.y = 1.58; g.add(hair);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), toon('#111')); eye.position.set(s * 0.055, 1.57, 0.135); g.add(eye); }
    if (id === 'kirill') { for (const s of [-1, 1]) box(0.11, 0.08, 0.28, '#e9e9e9', s * 0.1, 0.04, 0.04, { parent: g }); }
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.label(n.short, n.role.split(',')[0]), depthTest: false }));
    spr.scale.set(1.1, 0.27, 1); spr.position.y = 2.05; g.add(spr);
    g.traverse((o) => { if (o.isMesh) o.userData.npc = id; });
    g.visible = visible;
    scene.add(g);
    const col = { x1: x - 0.25, z1: z - 0.25, x2: x + 0.25, z2: z + 0.25, name: 'npc_' + id, off: !visible };
    colliders.push(col);
    npcs[id] = { group: g, col };
  }
  buildNpc('belov', 3.05, -1.2, -Math.PI / 2);
  buildNpc('sosedka', -0.15, -2.55, Math.PI / 3);
  buildNpc('kirill', 2.2, -2.75, -0.3, false);

  // ---------- Свет ----------
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#4a4035', 1.2));
  const pl = (x, y, z, c, i) => { const l = new THREE.PointLight(c, i, 9, 1.2); l.position.set(x, y, z); scene.add(l); const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: c })); b.position.set(x, y + 0.08, z); scene.add(b); return l; };
  const lamps = [pl(1.5, 2.45, -1.6, '#d8f0ff', 3), pl(1.5, 2.45, 2.0, '#ffe2b5', 3), pl(-0.9, 2.45, 2, '#ffffff', 1.6), pl(4.6, 2.45, 2, '#fff1d6', 2.4), pl(2.2, 2.45, 6.3, '#ffe9c4', 3.2)];
  const street = new THREE.PointLight('#cfe0ff', 4, 6, 1); street.position.set(3.2, 2.2, 9.6); scene.add(street);
  const sun = new THREE.DirectionalLight('#9fb4d6', 0.9);
  sun.position.set(2, 6, 14); scene.add(sun);

  return { scene, colliders, occluders, evidence, npcs, doors, lamps, decalMat, box, plane };
}
