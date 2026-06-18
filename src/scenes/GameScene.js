import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';

const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = DESIGN_HEIGHT;
const PLAYER_START_X = 220;
const PLAYER_START_Y = 850;
const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 140;
const PLAYER_SPEED_X = 180;
const GROUND_TOP_Y = 920;
const GROUND_HEIGHT = 360;
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
      this.runInitStage('设置世界边界', () => this.configureWorldBounds());
      this.runInitStage('设置相机背景色', () => this.createBackground());
      this.runInitStage('创建重复路标', () => this.createRoadMarkers());
      this.runInitStage('创建绿色地面', () => this.createVisualGround());
      this.runInitStage('创建物理地面', () => this.createPhysicsGround());
      this.runInitStage('创建蓝色玩家', () => this.createPlayer());
      this.runInitStage('添加地面碰撞', () => this.createGroundCollider());
      this.runInitStage('设置相机跟随', () => this.configureCameraFollow());
      this.runInitStage('创建标题', () => this.createTitle());
      this.runInitStage('创建攻击按钮', () => this.createAttackButton());
      this.runInitStage('创建红色 SCENE OK', () => this.createSceneOkLabel());
      updateDebugStatus('场景创建完成');
    } catch (error) {
      this.showInitError(error);
      throw error;
    }
  }

  update() {
    if (!this.player?.body) {
      return;
    }

    this.player.body.setVelocityX(PLAYER_SPEED_X);
  }

  runInitStage(stageName, callback) {
    this.initStage = stageName;
    callback();
  }

  configureWorldBounds() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  createBackground() {
    this.cameras.main.setBackgroundColor('#8fd3ff');
  }

  createRoadMarkers() {
    for (let x = 400; x < WORLD_WIDTH; x += 400) {
      this.add
        .rectangle(x, GROUND_TOP_Y - 90, 12, 180, 0x777777, 0.75)
        .setDepth(5);

      this.add
        .text(x + 18, GROUND_TOP_Y - 170, String(x), {
          fontFamily: 'Arial, sans-serif',
          fontSize: '28px',
          color: '#555555',
          stroke: '#ffffff',
          strokeThickness: 4,
        })
        .setOrigin(0, 0.5)
        .setDepth(5);
    }
  }

  createVisualGround() {
    this.add
      .rectangle(
        WORLD_WIDTH / 2,
        GROUND_TOP_Y + GROUND_HEIGHT / 2,
        WORLD_WIDTH,
        GROUND_HEIGHT,
        0x2fa84f,
        1,
      )
      .setDepth(10);
  }

  createPhysicsGround() {
    this.physicsGround = this.add.rectangle(
      WORLD_WIDTH / 2,
      GROUND_TOP_Y + GROUND_HEIGHT / 2,
      WORLD_WIDTH,
      GROUND_HEIGHT,
      0x000000,
      0,
    );

    this.physics.add.existing(this.physicsGround, true);
  }

  createPlayer() {
    this.player = this.add
      .rectangle(
        PLAYER_START_X,
        PLAYER_START_Y,
        PLAYER_WIDTH,
        PLAYER_HEIGHT,
        0x1687ff,
        1,
      )
      .setStrokeStyle(8, 0x0b4fb3, 1)
      .setDepth(20);

    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setAllowGravity(true);
    this.player.body.setSize(PLAYER_WIDTH, PLAYER_HEIGHT);
  }

  createGroundCollider() {
    this.physics.add.collider(this.player, this.physicsGround);
  }

  configureCameraFollow() {
    this.cameras.main.startFollow(this.player, false, 1, 0, DESIGN_WIDTH * 0.2, 0);
  }

  createTitle() {
    this.add
      .text(DESIGN_WIDTH / 2, 42, '第一阶段：自动前进测试', {
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
      .text(20, 74, 'SCENE OK', {
        fontSize: '22px',
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
