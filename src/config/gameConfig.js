import Phaser from 'phaser';
import GameScene from '../scenes/GameScene.js';

export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

const gameConfig = {
  type: Phaser.CANVAS,
  parent: 'game-container',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: '#8fd3ff',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1800 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
  },
  scene: [GameScene],
};

export default gameConfig;
