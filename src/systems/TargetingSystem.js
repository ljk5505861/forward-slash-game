const DESIGN_WIDTH = 720;

export const enemyHalfWidth = (enemy) => (enemy?.body?.width || enemy?.displayWidth || enemy?.width || 0) / 2;
export const viewportBounds = (camera) => {
  const left = camera?.worldView?.x ?? camera?.scrollX ?? 0;
  const width = camera?.worldView?.width ?? camera?.width ?? DESIGN_WIDTH;
  return { left, right: left + width, width };
};
export const isEnemyPartiallyInViewportBounds = (enemy, camera, padding = 60) => {
  const { left, right } = viewportBounds(camera);
  const half = enemyHalfWidth(enemy);
  return enemy.x + half >= left - padding && enemy.x - half <= right + padding;
};
export const isEnemyFullyInsideViewportBounds = (enemy, camera, padding = 0) => {
  const { left, right } = viewportBounds(camera);
  const half = enemyHalfWidth(enemy);
  return enemy.x - half >= left + padding && enemy.x + half <= right - padding;
};
export const shouldRecycleEnemyLeftBounds = (enemy, camera) => enemy.x + enemyHalfWidth(enemy) < viewportBounds(camera).left;
export const rightRespawnX = (enemy, camera, padding = 80, jitter = 0) => viewportBounds(camera).right + enemyHalfWidth(enemy) + padding + jitter;

export default class TargetingSystem {
  constructor(scene){ this.scene=scene; }
  valid(e){ return !!(e?.active && !e.isDefeated && e.hp > 0); }
  isEnemyInViewport(enemy, padding = 60){ return this.valid(enemy) && isEnemyPartiallyInViewportBounds(enemy,this.scene.cameras?.main,padding); }
  isEnemyInCombatViewport(enemy, padding = 60){ return this.isEnemyInViewport(enemy,padding); }
  isEnemyFullyInsideViewport(enemy, padding = this.scene.balance.enemies?.fullEntryPadding ?? 0){ return this.valid(enemy) && isEnemyFullyInsideViewportBounds(enemy,this.scene.cameras?.main,padding); }
  shouldRecycleEnemyLeft(enemy){ return this.valid(enemy) && shouldRecycleEnemyLeftBounds(enemy,this.scene.cameras?.main); }
  getEnemyRightRespawnX(enemy, padding = this.scene.balance.enemies?.respawnPadding ?? 80, jitter = 0){ return rightRespawnX(enemy,this.scene.cameras?.main,padding,jitter); }
  all({ includeOffscreen=false, includeEntering=false, padding=60 }={}){
    return this.scene.enemies.filter((e)=>this.valid(e) && (includeOffscreen || (includeEntering ? this.isEnemyInCombatViewport(e,padding) : this.isEnemyFullyInsideViewport(e))));
  }
  nearestAhead(range=Infinity, options={}){ const px=this.scene.player.x; return this.all(options).filter(e=>e.x >= px - 20 && e.x - px <= range).sort((a,b)=>a.x-b.x)[0] || null; }
  random(options={}){ const a=this.all(options); return a.length ? a[Math.floor(Math.random()*a.length)] : null; }
  aroundPlayer(radius, options={}){ return this.all(options).filter(e=>Math.abs(e.x-this.scene.player.x)<=radius); }
}
