import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/gameConfig.js';

export default class ResultPanel {
  constructor(scene) {
    this.scene = scene;
    this.nodes = [];
  }

  get isOpen() {
    return this.nodes.some((node) => node?.active);
  }

  show(won) {
    this.hide();
    const overlay = this.scene.add.rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0x000000, 0.55)
      .setScrollFactor(0)
      .setDepth(3900);
    const text = this.scene.add.text(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, won ? '胜利！' : '失败，点击重新开始', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '46px',
      color: '#fff',
      backgroundColor: '#111',
      padding: { left: 24, right: 24, top: 18, bottom: 18 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(4000);
    this.nodes = [overlay, text];
  }

  hide() {
    this.nodes.forEach((node) => {
      node?.removeAllListeners?.();
      node?.destroy?.();
    });
    this.nodes = [];
  }
}
