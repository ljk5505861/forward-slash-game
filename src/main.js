import Phaser from 'phaser';
import gameConfig from './config/gameConfig.js';
import './styles.css';

const preventGesture = (event) => event.preventDefault();

const createDebugStatusBar = () => {
  const existingBar = document.getElementById('debug-status-bar');
  const bar = existingBar || document.createElement('div');

  bar.id = 'debug-status-bar';
  bar.style.position = 'fixed';
  bar.style.top = '0';
  bar.style.left = '0';
  bar.style.zIndex = '100000';
  bar.style.padding = '8px 12px';
  bar.style.background = 'rgba(0, 150, 60, 0.92)';
  bar.style.color = '#ffffff';
  bar.style.fontFamily = 'Arial, sans-serif';
  bar.style.fontSize = '16px';
  bar.style.fontWeight = 'bold';
  bar.style.lineHeight = '1.2';
  bar.style.pointerEvents = 'none';
  bar.textContent = 'JS 已启动';

  if (!existingBar) {
    document.body.prepend(bar);
  }

  return bar;
};

const debugStatusBar = createDebugStatusBar();

const updateDebugStatus = (message) => {
  debugStatusBar.textContent = message;
};

window.updateGameDebugStatus = updateDebugStatus;

const formatErrorLocation = (filename, lineno, colno) => {
  if (!filename) {
    return '未知文件位置';
  }

  const line = lineno ? `:${lineno}` : '';
  const column = colno ? `:${colno}` : '';
  return `${filename}${line}${column}`;
};

const getErrorDetails = (error) => {
  if (!error) {
    return { name: 'Error', message: '未知错误' };
  }

  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || String(error),
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
};

const showGlobalError = ({ name, message, location }) => {
  const existingPanel = document.getElementById('global-error-panel');
  const panel = existingPanel || document.createElement('div');

  panel.id = 'global-error-panel';
  panel.style.position = 'fixed';
  panel.style.top = '0';
  panel.style.left = '0';
  panel.style.right = '0';
  panel.style.zIndex = '99999';
  panel.style.padding = '12px 14px';
  panel.style.background = 'rgba(190, 0, 0, 0.94)';
  panel.style.color = '#ffffff';
  panel.style.fontFamily = 'Arial, sans-serif';
  panel.style.fontSize = '16px';
  panel.style.lineHeight = '1.35';
  panel.style.whiteSpace = 'pre-wrap';
  panel.textContent = `错误名称：${name}\n错误信息：${message}\n文件位置：${location || '未知文件位置'}`;

  if (!existingPanel) {
    document.body.prepend(panel);
  }
};

window.addEventListener('error', (event) => {
  const details = getErrorDetails(event.error);
  showGlobalError({
    ...details,
    message: details.message || event.message || '未知错误',
    location: formatErrorLocation(event.filename, event.lineno, event.colno),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const details = getErrorDetails(event.reason);
  showGlobalError({
    ...details,
    location: details.name === 'Error' && event.reason?.stack ? event.reason.stack.split('\n')[1]?.trim() : 'Promise rejection',
  });
});

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

const game = new Phaser.Game(gameConfig);
updateDebugStatus('Phaser 已创建');

const gameScene = game.scene.getScene('GameScene');
if (gameScene) {
  gameScene.events.once(Phaser.Scenes.Events.START, () => updateDebugStatus('GameScene 已启动'));
  gameScene.events.once(Phaser.Scenes.Events.CREATE, () => updateDebugStatus('场景创建完成'));
}
