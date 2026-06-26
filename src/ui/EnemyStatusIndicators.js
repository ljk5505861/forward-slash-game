import { CombatEvents } from '../core/CombatEvents.js';
import { StatusEffects } from '../systems/StatusEffectSystem.js';

export class EnemyStatusIndicators {
  constructor(scene) {
    this.scene = scene;
    this.entries = new Map();
    this.unsubs = [
      scene.eventBus.on(CombatEvents.STATUS_APPLIED, payload => this.onStatusChanged(payload)),
      scene.eventBus.on(CombatEvents.STATUS_STACK_CHANGED, payload => this.onStatusChanged(payload)),
      scene.eventBus.on(CombatEvents.STATUS_REMOVED, payload => this.onStatusChanged(payload)),
      scene.eventBus.on(CombatEvents.ENEMY_KILLED, payload => this.clear(payload.enemy)),
    ];
  }

  onStatusChanged({ target, type } = {}) {
    if (type !== StatusEffects.BURN || !target || target === this.scene.playerData) return;
    this.updateBurn(target);
  }

  ensure(target) {
    let entry = this.entries.get(target);
    if (entry) return entry;
    const container = this.scene.add.container(target.x, target.y).setDepth(26);
    const iconPlaceholder = this.scene.add.rectangle(0, 0, 14, 14, 0xff6b24, 0.0).setStrokeStyle(1, 0xffb15a, 0.35);
    const stackText = this.scene.add.text(18, 0, '', { fontFamily:'Arial', fontSize:'15px', color:'#ffb15a', stroke:'#000', strokeThickness:3 }).setOrigin(0, 0.5);
    container.add([iconPlaceholder, stackText]);
    entry = { StatusIndicatorContainer: container, BurnIndicator: { IconPlaceholder: iconPlaceholder, StackText: stackText } };
    this.entries.set(target, entry);
    return entry;
  }

  updateBurn(target) {
    const stacks = this.scene.statusEffects?.getStackCount?.(target, StatusEffects.BURN) || 0;
    if (stacks <= 0 || target.isDefeated || !target.active) { this.clear(target); return; }
    const entry = this.ensure(target);
    entry.BurnIndicator.StackText.setText(String(stacks));
    this.position(target, entry);
  }

  position(target, entry = this.entries.get(target)) {
    if (!entry) return;
    const x = target.x - target.width / 2 - 2;
    const y = target.y - target.height / 2 - 34;
    entry.StatusIndicatorContainer.setPosition(x, y);
  }

  update() {
    this.entries.forEach((entry, target) => {
      if (!target?.active || target.isDefeated || !this.scene.targeting?.valid?.(target)) { this.clear(target); return; }
      this.updateBurn(target);
    });
  }

  clear(target) {
    const entry = this.entries.get(target);
    if (!entry) return;
    entry.StatusIndicatorContainer.destroy();
    this.entries.delete(target);
  }

  destroy() {
    this.unsubs.forEach(off => off?.());
    this.entries.forEach(entry => entry.StatusIndicatorContainer.destroy());
    this.entries.clear();
  }
}
