import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';

const GROUND_Y = Math.round(DESIGN_HEIGHT * 0.72);
const PLAYER_SCREEN_X = Math.round(DESIGN_WIDTH * 0.3);
const PLAYER_SPEED = 260;
const WORLD_WIDTH = 12000;
const ATTACK_BUTTON_RADIUS = 72;
const SAFE_AREA_MARGIN = 34;
const PLAYER_WIDTH = 56;
const PLAYER_HEIGHT = 112;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.initStage = '尚未开始';
  }

  create() {
    try {
      this.runInitStage('设置世界边界', () => {
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, DESIGN_HEIGHT);
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, DESIGN_HEIGHT);
      });

      this.runInitStage('创建纯色背景', () => this.createBackground());
      this.runInitStage('创建 HUD', () => this.createHud());
      this.runInitStage('创建可见地面', () => this.createVisibleGround());
      this.runInitStage('创建物理地面', () => this.createPhysicsGround());
      this.runInitStage('创建简单角色', () => this.createPlayer());
      this.runInitStage('启动相机跟随', () => this.startCameraFollow());
      this.runInitStage('添加装饰云朵', () => this.createClouds());
    } catch (error) {
      this.showInitError(error);
      throw error;
    }
  }

  update() {
    if (!this.player?.body) {
      return;
    }

    this.player.setVelocityX(PLAYER_SPEED);
  }

  runInitStage(stageName, callback) {
    this.initStage = stageName;
    callback();
  }

  createBackground() {
    this.add
      .rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 0x8fd3ff, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0);
  }

  createHud() {
    this.add
      .text(DESIGN_WIDTH / 2, 42, '第一阶段：自动前进原型', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '34px',
        color: '#14324a',
        stroke: '#ffffff',
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.attackTip = this.add
      .text(DESIGN_WIDTH / 2, 128, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        backgroundColor: 'rgba(20, 50, 74, 0.72)',
        padding: { left: 18, right: 18, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setVisible(false);

    this.attackButton = this.add
      .circle(0, 0, ATTACK_BUTTON_RADIUS, 0xff6b35, 0.88)
      .setStrokeStyle(6, 0xffffff, 0.95)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    this.attackLabel = this.add
      .text(0, 0, '攻击', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.positionAttackButton();
    this.attackButton.on('pointerdown', () => this.showAttackTip());
    this.scale.on('resize', () => this.positionAttackButton());
  }

  createVisibleGround() {
    const groundHeight = DESIGN_HEIGHT - GROUND_Y;

    this.add
      .rectangle(0, GROUND_Y, DESIGN_WIDTH, groundHeight, 0x2fa84f, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0);

    this.add
      .rectangle(0, GROUND_Y + 42, DESIGN_WIDTH, groundHeight - 42, 0x19743a, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0);
  }

  createPhysicsGround() {
    this.ground = this.add.rectangle(
      WORLD_WIDTH / 2,
      GROUND_Y + 20,
      WORLD_WIDTH,
      40,
      0x000000,
      0,
    );
    this.physics.add.existing(this.ground, true);
    this.ground.body.checkCollision.down = false;
    this.ground.body.checkCollision.left = false;
    this.ground.body.checkCollision.right = false;
  }

  createPlayer() {
    this.player = this.add.rectangle(
      PLAYER_SCREEN_X,
      GROUND_Y - PLAYER_HEIGHT / 2,
      PLAYER_WIDTH,
      PLAYER_HEIGHT,
      0x1687ff,
      1,
    );
    this.player.setStrokeStyle(6, 0x0b4fb3, 1);
    this.physics.add.existing(this.player);

    this.player.body.setCollideWorldBounds(true);
    this.player.body.setAllowGravity(true);
    this.player.body.setSize(PLAYER_WIDTH, PLAYER_HEIGHT, false);
    this.physics.add.collider(this.player, this.ground);
  }

  startCameraFollow() {
    const cameraOffsetX = DESIGN_WIDTH / 2 - PLAYER_SCREEN_X;
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, cameraOffsetX, 0);
  }

  createClouds() {
    const cloudPositions = [
      { x: 180, y: 190 },
      { x: 520, y: 250 },
      { x: 920, y: 170 },
    ];

    cloudPositions.forEach(({ x, y }) => {
      const cloud = this.add.container(x, y).setScrollFactor(0.25);
      cloud.add(this.add.circle(0, 20, 36, 0xffffff, 0.68));
      cloud.add(this.add.circle(42, 0, 46, 0xffffff, 0.68));
      cloud.add(this.add.circle(90, 24, 32, 0xffffff, 0.68));
      cloud.add(this.add.rectangle(36, 30, 128, 28, 0xffffff, 0.68));
    });
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

  showAttackTip() {
    this.attackTip.setText('攻击提示：本阶段暂不造成伤害').setVisible(true);
    this.tweens.killTweensOf(this.attackTip);
    this.attackTip.setAlpha(1);
    this.tweens.add({
      targets: this.attackTip,
      alpha: 0,
      delay: 550,
      duration: 450,
      onComplete: () => this.attackTip.setVisible(false),
    });
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
