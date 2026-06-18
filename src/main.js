import Phaser from 'phaser';
import gameConfig from './config/gameConfig.js';
import './styles.css';

const preventGesture = (event) => event.preventDefault();

document.addEventListener('gesturestart', preventGesture, { passive: false });
document.addEventListener('gesturechange', preventGesture, { passive: false });
document.addEventListener('gestureend', preventGesture, { passive: false });
document.addEventListener('touchmove', preventGesture, { passive: false });

let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  },
  { passive: false },
);

window.addEventListener('contextmenu', preventGesture);

new Phaser.Game(gameConfig);
