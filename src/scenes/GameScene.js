import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';

const GROUND_Y = Math.round(DESIGN_HEIGHT * 0.72);
const ATTACK_BUTTON_RADIUS = 72;
const SAFE_AREA_MARGIN = 34;
const PLAYER_WIDTH = 56;
const PLAYER_HEIGHT = 112;

const updateDebugStatus = (message) => {
  window.updateGameDebugStatus?.(message);
};

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.initStage = '尚未开始';
  }

  create() {
    updateDebugStatus('场景开始创建');

    this.add
      .text(20, 20, 'SCENE OK', {
        fontSize: '40px',
        color: '#ff0000',
      })
      .setScrollFactor(0)
      .setDepth(99999);

    try {
      this.runInitStage('创建纯色背景', () => this.createBackground());
      this.runInitStage('创建 HUD', () => this.createHud());
      this.runInitStage('创建可见地面', () => this.createVisibleGround());
      this.runInitStage('创建普通矩形玩家', () => this.createPlayer());
      updateDebugStatus('场景创建完成');
    } catch (error) {
      this.showInitError(error);
      throw error;
    }
  }

  update() {}

  runInitStage(stageName, callback) {
    this.initStage = stageName;
    callback();
  }

  createBackground() {
    this.add
      .rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 0x8fd3ff, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(0);
  }

  createHud() {
    this.add
      .text(DESIGN_WIDTH / 2, 42, '第一阶段：最小渲染测试', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '34px',
        color: '#14324a',
        stroke: '#ffffff',
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.attackButton = this.add
      .circle(0, 0, ATTACK_BUTTON_RADIUS, 0xff6b35, 0.88)
      .setStrokeStyle(6, 0xffffff, 0.95)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(1000);

    this.attackLabel = this.add
      .text(0, 0, '攻击', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    this.positionAttackButton();
    this.scale.on('resize', () => this.positionAttackButton());
  }

  createVisibleGround() {
    const groundHeight = DESIGN_HEIGHT - GROUND_Y;

    this.add
      .rectangle(0, GROUND_Y, DESIGN_WIDTH, groundHeight, 0x2fa84f, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(10);
  }

  createPlayer() {
    this.player = this.add
      .rectangle(
        Math.round(DESIGN_WIDTH * 0.3),
        GROUND_Y - PLAYER_HEIGHT / 2,
        PLAYER_WIDTH,
        PLAYER_HEIGHT,
        0x1687ff,
        1,
      )
      .setDepth(20);
    this.player.setStrokeStyle(6, 0x0b4fb3, 1);
  }

  positionAttackButton() {
    if (!this.attackButton || !this.attackLabel) {
      return;
    }

    const x = DESIGN_WIDTH - ATTACK_BUTTON_RADIUS - SAFE_AREA_MARGIN;
    const y = DESIGN_HEIGHT - ATTACK_BUTTON_RADIUS - SAFE_AREA_MARGIN;
    this.attackButton.setPosition(x, y);
    this.attackLabel.setPosition(x, y);
  }

  showInitError(error) {
    const message = `初始化失败：${this.initStage}\n${error.name || 'Error'}: ${error.message || String(error)}`;

    this.add
      .text(24, 220, message, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        backgroundColor: 'rgba(190, 0, 0, 0.92)',
        padding: { left: 18, right: 18, top: 14, bottom: 14 },
        wordWrap: { width: DESIGN_WIDTH - 48 },
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(10000);
  }
}
