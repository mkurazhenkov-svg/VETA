// Общая «шина» событий между уровнем и интерфейсом (HUD).
import Phaser from 'phaser';

export const bus = new Phaser.Events.EventEmitter();
