import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';

const GROUND_Y = Math.round(DESIGN_HEIGHT * 0.72);
const PLAYER_SCREEN_X = Math.round(DESIGN_WIDTH * 0.3);
const PLAYER_SPEED = 260;
const WORLD_WIDTH = 12000;
const ATTACK_BUTTON_RADIUS = 72;
const SAFE_AREA_MARGIN = 34;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, DESIGN_HEIGHT);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, DESIGN_HEIGHT);

    this.createBackground();
    this.createGround();
    this.createPlayerTexture();
    this.createPlayer();
    this.createHud();

    const cameraOffsetX = DESIGN_WIDTH / 2 - PLAYER_SCREEN_X;
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, cameraOffsetX, 0);
  }

  update() {
    this.player.setVelocityX(PLAYER_SPEED);
    this.positionAttackButton();
  }

  createBackground() {
    const sky = this.add.graphics().setScrollFactor(0);
    sky.fillGradientStyle(0x8fd3ff, 0x8fd3ff, 0xdff7ff, 0xdff7ff, 1, 1, 1, 1);
    sky.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

    for (let x = 120; x < WORLD_WIDTH; x += 520) {
      const cloud = this.add.graphics();
      const cloudY = 180 + ((x / 13) % 130);
      cloud.fillStyle(0xffffff, 0.72);
      cloud.fillCircle(x, cloudY + 20, 42);
      cloud.fillCircle(x + 48, cloudY, 54);
      cloud.fillCircle(x + 104, cloudY + 24, 38);
      cloud.fillRoundedRect(x - 18, cloudY + 24, 150, 32, 16);
      cloud.setScrollFactor(0.35);
    }

    const hills = this.add.graphics();
    hills.fillStyle(0x7bcf8a, 1);
    hills.beginPath();
    hills.moveTo(0, GROUND_Y);
    for (let x = 0; x <= WORLD_WIDTH; x += 240) {
      hills.lineTo(x + 120, GROUND_Y - 220 + Math.sin(x * 0.002) * 45);
      hills.lineTo(x + 240, GROUND_Y);
    }
    hills.closePath();
    hills.fillPath();
    hills.setScrollFactor(0.55);
  }

  createGround() {
    const groundGraphics = this.add.graphics();
    groundGraphics.fillStyle(0x2fa84f, 1);
    groundGraphics.fillRect(0, GROUND_Y, WORLD_WIDTH, DESIGN_HEIGHT - GROUND_Y);
    groundGraphics.fillStyle(0x19743a, 1);
    groundGraphics.fillRect(0, GROUND_Y + 42, WORLD_WIDTH, DESIGN_HEIGHT - GROUND_Y - 42);

    groundGraphics.lineStyle(4, 0x52c96b, 0.8);
    for (let x = 0; x < WORLD_WIDTH; x += 80) {
      groundGraphics.lineBetween(x, GROUND_Y + 12, x + 44, GROUND_Y + 12);
    }

    this.ground = this.add.rectangle(
      WORLD_WIDTH / 2,
      GROUND_Y + (DESIGN_HEIGHT - GROUND_Y) / 2,
      WORLD_WIDTH,
      DESIGN_HEIGHT - GROUND_Y,
      0x000000,
      0,
    );
    this.physics.add.existing(this.ground, true);
  }

  createPlayerTexture() {
    if (this.textures.exists('runner')) {
      return;
    }

    const playerShape = this.make.graphics({ x: 0, y: 0, add: false });
    playerShape.fillStyle(0x1687ff, 1);
    playerShape.fillRoundedRect(18, 44, 56, 70, 14);
    playerShape.fillStyle(0x0b4fb3, 1);
    playerShape.fillCircle(46, 22, 25);
    playerShape.fillStyle(0xffffff, 1);
    playerShape.fillCircle(55, 16, 5);
    playerShape.lineStyle(8, 0x0b4fb3, 1);
    playerShape.lineBetween(22, 102, 10, 130);
    playerShape.lineBetween(70, 102, 82, 130);
    playerShape.generateTexture('runner', 92, 136);
    playerShape.destroy();
  }

  createPlayer() {
    this.player = this.physics.add.image(PLAYER_SCREEN_X, GROUND_Y, 'runner');
    this.player.setOrigin(0.5, 1);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(56, 112);
    this.player.body.setOffset(18, 20);
    this.player.body.setAllowGravity(true);
    this.physics.add.collider(this.player, this.ground);
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
  }

  positionAttackButton() {
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
}
