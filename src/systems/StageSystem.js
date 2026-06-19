import { STAGES } from '../config/stages.js';
import { ENEMIES } from '../config/enemies.js';
import { TUNING } from '../config/tuning.js';
import { CombatEvents, RunStates } from '../core/CombatEvents.js';
import createEnemy, { syncEnemyUi } from '../entities/createEnemy.js';

export default class StageSystem {
  constructor(scene){ this.scene=scene; this.stage=STAGES[0]; this.eliteSpawned=false; this.bossSpawned=false; }
  start(){ this.stage.waves.forEach(w=>this.spawn(w.enemyId,w.x)); this.spawn(this.stage.elite.enemyId,this.stage.elite.x); this.eliteSpawned=true; this.scene.hud?.setStage(this.stage.name); }
  tunedEnemy(id){ const base=ENEMIES[id]; const key=base.kind; return { ...base, hp:Math.round(base.hp*(TUNING.difficulty[`${key}HpMultiplier`]||1)), damage:Math.round(base.damage*(TUNING.difficulty[`${key}DamageMultiplier`]||1)), xp:TUNING.xp[`${key}Enemy`] ?? base.xp }; }
  spawn(id,x){ const e=createEnemy(this.scene, this.tunedEnemy(id), x, this.scene.balance.groundTopY); this.scene.enemies.push(e); return e; }
  update(){ if(this.scene.isGameplayPaused?.()) return; this.separateEnemies(); this.scene.enemies.forEach(syncEnemyUi); if(!this.bossSpawned && this.eliteSpawned && !this.scene.enemies.some(e=>e.isElite) && this.scene.player.x>this.stage.elite.x-220){ const b=this.spawn(this.stage.boss.enemyId,this.stage.boss.x); this.bossSpawned=true; this.scene.runState=RunStates.BOSS; this.scene.eventBus.emit(CombatEvents.BOSS_SPAWNED,{ enemy:b }); this.scene.hud?.setStatus('Boss 出现：训练场守卫'); } }
  separateEnemies(){ const enemies=this.scene.enemies.filter(e=>!e.isDefeated&&e.active); for(let i=0;i<enemies.length;i+=1){ for(let j=i+1;j<enemies.length;j+=1){ const a=enemies[i]; const b=enemies[j]; const min=((a.body?.width||a.width)/2)+((b.body?.width||b.width)/2)+8; const dx=b.x-a.x; const overlap=min-Math.abs(dx); if(overlap>0){ const dir=dx>=0?1:-1; const shift=Math.min(overlap/2, 10); if(!a.isBoss) a.x-=dir*shift; if(!b.isBoss) b.x+=dir*shift; } } } }
}
