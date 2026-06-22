const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export default class PlayerHealthBar {
  constructor(scene, { x = 18, y = 192, width = 260, height = 16 } = {}) {
    this.scene = scene;
    this.maxWidth = width;
    this.bg = scene.add.rectangle(x, y, width, height, 0x250d14, 0.88)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(2000)
      .setStrokeStyle(2, 0xffffff, 0.35);
    this.fill = scene.add.rectangle(x, y, width, height, 0xe84d5b, 0.95)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(2001);
    this.update();
  }

  ratio() {
    const data = this.scene.playerData || {};
    const maxHp = Number(data.maxHp) || 0;
    if (maxHp <= 0) return 0;
    return clamp01((Number(data.hp) || 0) / maxHp);
  }

  update() {
    const width = this.maxWidth * this.ratio();
    this.fill.setDisplaySize(width, this.fill.displayHeight ?? this.fill.height);
    return width;
  }

  destroy() {
    [this.bg, this.fill].forEach(x => x?.destroy());
  }
}
