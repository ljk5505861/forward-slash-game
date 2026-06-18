import Phaser from 'phaser';
export default class EventBus {
  constructor() { this.emitter = new Phaser.Events.EventEmitter(); }
  on(event, fn, ctx) { this.emitter.on(event, fn, ctx); return () => this.off(event, fn, ctx); }
  once(event, fn, ctx) { this.emitter.once(event, fn, ctx); return () => this.off(event, fn, ctx); }
  off(event, fn, ctx) { this.emitter.off(event, fn, ctx); }
  emit(event, payload = {}) { this.emitter.emit(event, payload); }
  destroy() { this.emitter.removeAllListeners(); }
}
