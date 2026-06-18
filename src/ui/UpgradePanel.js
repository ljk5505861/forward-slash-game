import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';

const CHOICES = [
  { id: 'damage', label: '攻击 +8' },
  { id: 'health', label: '满血 +20' },
  { id: 'speed', label: '速度 +18' },
];

export default class UpgradePanel {
  constructor(scene, onSelect) {
    this.scene = scene;
    this.onSelect = onSelect;
    this.nodes = [];
  }

  get isOpen() {
    return this.nodes.some((node) => node?.active);
  }

  show() {
    this.hide();
    const overlay = this.scene.add.rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0x000000, 0.45)
      .setScrollFactor(0)
      .setDepth(2900);
    const title = this.scene.add.text(DESIGN_WIDTH / 2, 275, '升级！选择一项强化', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '36px',
      color: '#fff',
      backgroundColor: '#111',
      padding: { left: 24, right: 24, top: 14, bottom: 14 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(3000);
    this.nodes = [overlay, title, ...CHOICES.map((choice, index) => this.scene.add.text(DESIGN_WIDTH / 2, 390 + index * 115, choice.label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#fff',
      backgroundColor: '#203a74',
      padding: { left: 26, right: 26, top: 18, bottom: 18 },
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true }).setDepth(3000)
      .once('pointerdown', () => this.onSelect?.(choice.id)))];
  }

  hide() {
    this.nodes.forEach((node) => {
      node?.removeAllListeners?.();
      node?.destroy?.();
    });
    this.nodes = [];
  }
}
