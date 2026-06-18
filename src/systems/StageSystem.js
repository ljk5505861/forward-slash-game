import { STAGES } from '../config/stages.js';
import { ENEMIES } from '../config/enemies.js';
import { CombatEvents, RunStates } from '../core/CombatEvents.js';
import createEnemy, { syncEnemyUi } from '../entities/createEnemy.js';
export default class StageSystem { constructor(scene){ this.scene=scene; this.stage=STAGES[0]; this.eliteSpawned=false; this.bossSpawned=false; } start(){ this.stage.waves.forEach(w=>this.spawn(w.enemyId,w.x)); this.spawn(this.stage.elite.enemyId,this.stage.elite.x); this.eliteSpawned=true; this.scene.hud?.setStage(this.stage.name); }
  spawn(id,x){ const e=createEnemy(this.scene, ENEMIES[id], x, this.scene.balance.groundTopY); this.scene.enemies.push(e); return e; }
  update(){ this.scene.enemies.forEach(syncEnemyUi); if(!this.bossSpawned && this.eliteSpawned && !this.scene.enemies.some(e=>e.isElite) && this.scene.player.x>this.stage.elite.x-220){ const b=this.spawn(this.stage.boss.enemyId,this.stage.boss.x); this.bossSpawned=true; this.scene.runState=RunStates.BOSS; this.scene.eventBus.emit(CombatEvents.BOSS_SPAWNED,{ enemy:b }); this.scene.hud?.setStatus('Boss 出现：训练场守卫'); } }
}
