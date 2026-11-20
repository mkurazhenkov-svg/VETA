// Процедурные текстуры на canvas — без внешних файлов.
import * as THREE from 'three';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function linoleum() {
  const t = canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#b89a6e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9c7f55'; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.strokeRect(i * 64 + 6, j * 64 + 6, 52, 52);
      g.fillStyle = (i + j) % 2 ? '#a88a5e' : '#c2a679';
      g.fillRect(i * 64 + 14, j * 64 + 14, 36, 36);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}

export function parquet() {
  const t = canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#8a5a36'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) for (let j = -1; j < 2; j++) {
      g.fillStyle = ['#8a5a36', '#7d5030', '#946240'][(i + j * 3) % 3];
      g.fillRect(i * 32, j * 128 + (i % 2) * 64, 32, 128);
      g.strokeStyle = '#5e3b22'; g.strokeRect(i * 32, j * 128 + (i % 2) * 64, 32, 128);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 3);
  return t;
}

export function tiles(color = '#dfe7ea') {
  const t = canvas(128, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9fb0b5'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}

export function wallpaper(base = '#d9cbb0', stripe = '#cbb894') {
  const t = canvas(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = stripe;
    for (let i = 0; i < 4; i++) g.fillRect(i * 32 + 12, 0, 6, h);
    g.fillStyle = 'rgba(140,90,60,0.25)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(i * 32 + 28, j * 32 + 16, 4, 0, 7); g.fill(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
  return t;
}

export function shoeprint() {
  return canvas(128, 300, (g, w, h) => {
    g.fillStyle = 'rgba(110,30,22,0.9)';
    g.beginPath();
    g.ellipse(64, 85, 50, 80, 0, 0, Math.PI * 2);
    g.ellipse(64, 235, 40, 58, 0, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = 6;
    for (let y = 20; y < 165; y += 14) { g.beginPath(); g.moveTo(18, y + 10); g.lineTo(64, y); g.lineTo(110, y + 10); g.stroke(); }
    g.beginPath(); g.arc(64, 235, 26, 0, 7); g.stroke();
    g.beginPath(); g.arc(64, 235, 12, 0, 7); g.stroke();
  });
}

export function fingerprints(color = '#ffffff') {
  return canvas(128, 128, (g) => {
    g.strokeStyle = color; g.lineWidth = 2;
    const fp = (cx, cy, r) => { for (let i = 3; i < r; i += 4) { g.beginPath(); g.ellipse(cx, cy, i * 0.75, i, 0.2, 0.3, Math.PI * 2 - 0.3); g.stroke(); } };
    fp(36, 50, 26); fp(84, 40, 24); fp(64, 96, 22);
  });
}

export function dustShelf() {
  return canvas(128, 160, (g, w, h) => {
    g.fillStyle = 'rgba(205,200,185,0.85)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(160,150,130,${Math.random() * 0.5})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.clearRect(16, 20, 96, 120);
  });
}

export function receipt() {
  return canvas(90, 140, (g, w, h) => {
    g.fillStyle = '#f4f1e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#333'; g.font = 'bold 11px sans-serif'; g.fillText('ГСК «МОТОР»', 8, 18);
    g.font = '9px sans-serif'; g.fillText('бокс № 47', 8, 34); g.fillText('19.11 20:40', 8, 48);
    for (let y = 62; y < 130; y += 10) g.fillRect(8, y, 60 + (y % 20), 2);
  });
}

export function phoneScreen() {
  return canvas(80, 160, (g, w, h) => {
    g.fillStyle = '#12233a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.fillText('08:12', 12, 36);
    g.fillStyle = '#d9534f'; g.fillRect(6, 60, 68, 34);
    g.fillStyle = '#fff'; g.font = '9px sans-serif'; g.fillText('Пропущенный', 10, 74); g.fillText('Кирюша 21:14', 10, 87);
  });
}

export function footprints(color = 'rgba(70,55,40,0.75)', n = 6) {
  return canvas(256, 256, (g) => {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = 40 + i * 34, y = 210 - i * 34 + (i % 2) * 20;
      g.save(); g.translate(x, y); g.rotate(-0.8);
      g.beginPath(); g.ellipse(0, 0, 9, 18, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(0, 24, 8, 10, 0, 0, 7); g.fill();
      g.restore();
    }
  });
}

export function stain() {
  return canvas(64, 64, (g) => {
    g.fillStyle = 'rgba(95,25,18,0.95)';
    [[30, 30, 12], [18, 44, 6], [44, 18, 5], [40, 46, 4]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
  });
}

export function label(text, sub = '') {
  const t = canvas(512, 128, (g, w, h) => {
    g.fillStyle = 'rgba(15,23,42,0.75)';
    g.beginPath(); g.roundRect(4, 14, w - 8, h - 28, 24); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 38px sans-serif'; g.fillText(text, w / 2, sub ? 62 : 78);
    if (sub) { g.font = '26px sans-serif'; g.fillStyle = '#cbd5e1'; g.fillText(sub, w / 2, 96); }
  });
  return t;
}

export function markerNum(n) {
  return canvas(64, 64, (g) => {
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#111'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText(String(n), 32, 46);
  });
}

export function ruler() {
  return canvas(256, 32, (g) => {
    g.fillStyle = '#f5f5f0'; g.fillRect(0, 0, 256, 32);
    g.fillStyle = '#111';
    for (let i = 0; i <= 100; i++) g.fillRect(i * 2.5, 0, 1, i % 10 === 0 ? 16 : i % 5 === 0 ? 11 : 6);
    for (let i = 0; i < 10; i += 2) { g.fillRect(i * 25, 24, 25, 8); }
  });
}
