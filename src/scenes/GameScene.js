import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';

const GROUND_Y = 610;
const PLAYER_SPEED = 260;
const WORLD_WIDTH = 12000;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, DESIGN_HEIGHT);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, DESIGN_HEIGHT);

    this.createBackground();
    this.createGround();
    this.createPlayer();
    this.createHud();

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, -260, 120);
  }

  update() {
    this.player.setVelocityX(PLAYER_SPEED);
    this.attackButton.setPosition(DESIGN_WIDTH - 130, DESIGN_HEIGHT - 120);
    this.attackLabel.setPosition(this.attackButton.x, this.attackButton.y);
  }

  createBackground() {
    const sky = this.add.graphics().setScrollFactor(0);
    sky.fillGradientStyle(0x8fd3ff, 0x8fd3ff, 0xdff7ff, 0xdff7ff, 1);
    sky.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

    for (let x = 120; x < WORLD_WIDTH; x += 520) {
      const cloud = this.add.graphics();
      cloud.fillStyle(0xffffff, 0.72);
      cloud.fillCircle(x, 150 + ((x / 13) % 90), 42);
      cloud.fillCircle(x + 48, 130 + ((x / 17) % 60), 54);
      cloud.fillCircle(x + 104, 154 + ((x / 19) % 70), 38);
      cloud.fillRoundedRect(x - 18, 154 + ((x / 23) % 50), 150, 32, 16);
      cloud.setScrollFactor(0.35);
    }

    const hills = this.add.graphics();
    hills.fillStyle(0x7bcf8a, 1);
    hills.beginPath();
    hills.moveTo(0, GROUND_Y);
    for (let x = 0; x <= WORLD_WIDTH; x += 240) {
      hills.lineTo(x + 120, 440 + Math.sin(x * 0.002) * 35);
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
    groundGraphics.fillRect(0, GROUND_Y + 32, WORLD_WIDTH, DESIGN_HEIGHT - GROUND_Y - 32);

    for (let x = 0; x < WORLD_WIDTH; x += 80) {
      groundGraphics.lineStyle(3, 0x52c96b, 0.8);
      groundGraphics.lineBetween(x, GROUND_Y + 8, x + 44, GROUND_Y + 8);
    }

    this.ground = this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y + 45, WORLD_WIDTH, 90, 0x000000, 0);
    this.physics.add.existing(this.ground, true);
  }

  createPlayer() {
    const playerShape = this.add.graphics();
    playerShape.fillStyle(0x1687ff, 1);
    playerShape.fillRoundedRect(-28, -70, 56, 70, 14);
    playerShape.fillStyle(0x0b4fb3, 1);
    playerShape.fillCircle(0, -92, 25);
    playerShape.fillStyle(0xffffff, 1);
    playerShape.fillCircle(9, -98, 5);
    playerShape.lineStyle(8, 0x0b4fb3, 1);
    playerShape.lineBetween(-24, -12, -36, 16);
    playerShape.lineBetween(24, -12, 36, 16);

    this.player = this.physics.add.existing(playerShape, false);
    this.player.setPosition(160, GROUND_Y);
    this.player.body.setSize(56, 96);
    this.player.body.setOffset(-28, -96);
    this.player.body.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.ground);
  }

  createHud() {
    this.add
      .text(DESIGN_WIDTH / 2, 34, '第一阶段：自动前进原型', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '34px',
        color: '#14324a',
        stroke: '#ffffff',
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.attackTip = this.add
      .text(DESIGN_WIDTH / 2, 110, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        backgroundColor: 'rgba(20, 50, 74, 0.72)',
        padding: { left: 18, right: 18, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setVisible(false);

    this.attackButton = this.add.circle(DESIGN_WIDTH - 130, DESIGN_HEIGHT - 120, 72, 0xff6b35, 0.88)
      .setStrokeStyle(6, 0xffffff, 0.95)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    this.attackLabel = this.add
      .text(this.attackButton.x, this.attackButton.y, '攻击', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.attackButton.on('pointerdown', () => this.showAttackTip());
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
