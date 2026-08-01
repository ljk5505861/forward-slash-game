export const GAME_SPEEDS = Object.freeze([1, 1.5, 2]);
export const DEFAULT_GAME_SPEED = 1;

export const normalizeGameSpeed = value => GAME_SPEEDS.includes(Number(value)) ? Number(value) : DEFAULT_GAME_SPEED;
export const nextGameSpeed = value => GAME_SPEEDS[(GAME_SPEEDS.indexOf(normalizeGameSpeed(value)) + 1) % GAME_SPEEDS.length];

export default class GameSpeedSystem {
  constructor(scene) {
    this.scene = scene;
    this.speed = DEFAULT_GAME_SPEED;
    this.gameplayTimeMs = 0;
    this.realActivePlayTimeMs = 0;
    this.speedChanges = [];
    const world = scene.physics?.world;
    this.physicsFrameTime = world?._frameTime ?? (1/60);
    this.physicsFrameTimeMs = world?._frameTimeMS ?? (1000/60);
    this.syncEngineClocks(false);
  }
  advance(realDeltaMs, paused = false) {
    const delta = Math.max(0, Number(realDeltaMs) || 0);
    this.syncEngineClocks(paused);
    if (!paused) {
      this.realActivePlayTimeMs += delta;
      this.gameplayTimeMs += delta * this.speed;
    }
    return this.gameplayTimeMs;
  }
  setSpeed(value) {
    const next = normalizeGameSpeed(value), previous = this.speed;
    if (next === previous) return next;
    this.speed = next;
    this.speedChanges.push({ from:previous, to:next, realActivePlayTimeMs:this.realActivePlayTimeMs, gameplayTimeMs:this.gameplayTimeMs });
    this.syncEngineClocks(this.scene.isGameplayPaused?.() ?? false);
    return next;
  }
  cycle() { return this.setSpeed(nextGameSpeed(this.speed)); }
  syncEngineClocks(paused) {
    const scale = paused ? 0 : this.speed;
    if (this.scene.time) this.scene.time.timeScale = scale;
    this.scene.tweens?.setGlobalTimeScale?.(scale);
    const world=this.scene.physics?.world;
    if(world){ world._frameTime=this.physicsFrameTime*(paused?0:this.speed); world._frameTimeMS=paused?Number.POSITIVE_INFINITY:this.physicsFrameTimeMs/this.speed; }
  }
  snapshot() { return { gameplayTimeMs:this.gameplayTimeMs, realActivePlayTimeMs:this.realActivePlayTimeMs, currentGameSpeed:this.speed, speedChanges:this.speedChanges.map(change=>({ ...change })) }; }
  destroy() { const world=this.scene.physics?.world; if(world){ world._frameTime=this.physicsFrameTime; world._frameTimeMS=this.physicsFrameTimeMs; } }
}
