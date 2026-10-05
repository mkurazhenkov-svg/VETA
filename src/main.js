// Точка входа: шрифты → игра Phaser.
import Phaser from 'phaser';
import { loadFonts } from './fonts.js';
import { DEBUG } from './config.js';
import { t } from './content.js';
import { unlockAudio } from './audio/sfx.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { HowToScene } from './scenes/HowToScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { LevelScene } from './scenes/LevelScene.js';
import { TipScene } from './scenes/TipScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { FinalScene } from './scenes/FinalScene.js';
import { HUDScene } from './ui/HUD.js';

async function start() {
  await loadFonts();
  const rot = document.getElementById('rotate-text');
  if (rot) rot.textContent = t('meta.rotate');

  const showBodies = DEBUG && new URLSearchParams(window.location.search).has('bodies');
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 540,
    backgroundColor: '#01376B',
    pixelArt: true,
    roundPixels: true,
    banner: false,
    disableContextMenu: true,
    audio: { noAudio: true }, // звук генерируется своим кодом (src/audio)
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4 },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 900 }, debug: showBodies, tileBias: 20 },
    },
    fps: { target: 60 },
    scene: [BootScene, TitleScene, HowToScene, IntroScene, LevelScene, HUDScene, TipScene, PauseScene, FinalScene],
  });

  // Браузеры включают звук только после действия игрока.
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, unlockAudio, { passive: true });
  if (DEBUG) window.__game = game;
}

start();
