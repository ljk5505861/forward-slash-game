import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';

const ATTACK_BUTTON_RADIUS = 72;
const SAFE_AREA_MARGIN = 34;

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

    try {
      this.runInitStage('设置相机背景色', () => this.createBackground());
      this.runInitStage('创建绿色地面', () => {
        this.add
          .rectangle(
            DESIGN_WIDTH / 2,
            1100,
            DESIGN_WIDTH,
            360,
            0x2fa84f,
            1,
          )
          .setDepth(10);
      });
      this.runInitStage('创建蓝色玩家', () => {
        this.player = this.add
          .rectangle(
            220,
            850,
            80,
            140,
            0x1687ff,
            1,
          )
          .setStrokeStyle(8, 0x0b4fb3, 1)
          .setDepth(20);
      });
      this.runInitStage('创建标题', () => this.createTitle());
      this.runInitStage('创建攻击按钮', () => this.createAttackButton());
      this.runInitStage('创建红色 SCENE OK', () => this.createSceneOkLabel());
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
    this.cameras.main.setBackgroundColor('#8fd3ff');
  }

  createTitle() {
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
  }

  createAttackButton() {
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

  createSceneOkLabel() {
    this.add
      .text(20, 20, 'SCENE OK', {
        fontSize: '40px',
        color: '#ff0000',
      })
      .setScrollFactor(0)
      .setDepth(99999);
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
