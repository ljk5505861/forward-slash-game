import { STAGES } from '../config/stages.js';
import { ENEMIES } from '../config/enemies.js';
import { CombatEvents, RunStates } from '../core/CombatEvents.js';
import createEnemy, { syncEnemyUi } from '../entities/createEnemy.js';
export default class StageSystem { constructor(scene){ this.scene=scene; this.stage=STAGES[0]; this.eliteSpawned=false; this.bossSpawned=false; } start(){ this.stage.waves.forEach(w=>this.spawn(w.enemyId,w.x)); this.spawn(this.stage.elite.enemyId,this.stage.elite.x); this.eliteSpawned=true; this.scene.hud?.setStage(this.stage.name); }
  spawn(id,x){ const e=createEnemy(this.scene, ENEMIES[id], x, this.scene.balance.groundTopY); this.scene.physics.add.collider(this.scene.player,e); this.scene.enemies.push(e); return e; }
  update(){ this.separateEnemies(); this.scene.enemies.forEach(syncEnemyUi); if(!this.bossSpawned && this.eliteSpawned && !this.scene.enemies.some(e=>e.isElite) && this.scene.player.x>this.stage.elite.x-220){ const b=this.spawn(this.stage.boss.enemyId,this.stage.boss.x); this.bossSpawned=true; this.scene.runState=RunStates.BOSS; this.scene.eventBus.emit(CombatEvents.BOSS_SPAWNED,{ enemy:b }); this.scene.hud?.setStatus('Boss 出现：训练场守卫'); } }
  separateEnemies(){ const enemies=this.scene.enemies.filter(e=>e.active&&!e.isDefeated).sort((a,b)=>a.x-b.x); for(let i=1;i<enemies.length;i+=1){ const left=enemies[i-1]; const right=enemies[i]; const minGap=(left.width+right.width)*0.42; const gap=right.x-left.x; if(gap>0 && gap<minGap){ const push=(minGap-gap)/2; left.x-=push; right.x+=push; } } }
}
