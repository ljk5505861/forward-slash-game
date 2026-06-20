import { DESIGN_WIDTH } from '../config/gameConfig.js';

export default class TargetingSystem {
  constructor(scene){ this.scene=scene; }
  valid(e){ return !!(e?.active && !e.isDefeated && e.hp > 0); }
  isEnemyInCombatViewport(enemy, padding = 60){
    if(!this.valid(enemy)) return false;
    const camera=this.scene.cameras?.main;
    const left=camera?.scrollX ?? 0;
    const width=camera?.width ?? DESIGN_WIDTH;
    const half=(enemy.body?.width || enemy.width || 0)/2;
    return enemy.x + half >= left - padding && enemy.x - half <= left + width + padding;
  }
  all({ includeOffscreen=false, padding=60 }={}){
    return this.scene.enemies.filter((e)=>this.valid(e) && (includeOffscreen || this.isEnemyInCombatViewport(e,padding)));
  }
  nearestAhead(range=Infinity){ const px=this.scene.player.x; return this.all().filter(e=>e.x >= px - 20 && e.x - px <= range).sort((a,b)=>a.x-b.x)[0] || null; }
  random(){ const a=this.all(); return a.length ? a[Math.floor(Math.random()*a.length)] : null; }
  aroundPlayer(radius){ return this.all().filter(e=>Math.abs(e.x-this.scene.player.x)<=radius); }
}
