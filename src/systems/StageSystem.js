import { STAGES } from '../config/stages.js';
import { ENEMIES } from '../config/enemies.js';
import { TUNING } from '../config/tuning.js';
import { CombatEvents, RunStates } from '../core/CombatEvents.js';
import createEnemy, { syncEnemyUi } from '../entities/createEnemy.js';

export default class StageSystem {
  constructor(scene){ this.scene=scene; this.stage=STAGES[0]; this.phaseIndex=0; this.spawnedPhases=new Set(); this.finalBossSpawned=false; this.midBossKilled=false; this.restTriggered=false; }
  start(){ this.scene.physics.world.setBounds(0,0,this.stage.worldWidth,this.scene.scale.height); this.scene.cameras.main.setBounds(0,0,this.stage.worldWidth,this.scene.scale.height); this.scene.hud?.setStage(this.stage.name); this.enterPhase(0); }
  phase(){ return this.stage.phases[this.phaseIndex]; }
  tunedEnemy(id){ const base=ENEMIES[id]; const key=base.kind; return { ...base, hp:Math.round(base.hp*(TUNING.difficulty[`${key}HpMultiplier`]||1)), damage:Math.round(base.damage*(TUNING.difficulty[`${key}DamageMultiplier`]||1)), xp:base.xp }; }
  spawn(id,x){ const e=createEnemy(this.scene, this.tunedEnemy(id), x, this.scene.balance.groundTopY); this.scene.enemies.push(e); this.scene.enemyBehaviors?.attach(e); return e; }
  enterPhase(i){ if(i>=this.stage.phases.length) return; this.phaseIndex=i; const p=this.phase(); this.scene.hud?.setStage(p.name); if(this.spawnedPhases.has(p.id)) return; this.spawnedPhases.add(p.id); p.waves?.forEach(([id,x])=>this.spawn(id,x)); if(p.id==='midBoss'){ const b=this.spawn(p.boss.enemyId,p.boss.x); this.scene.runStats?.startMidBossFight?.(); this.scene.eventBus.emit(CombatEvents.BOSS_SPAWNED,{ enemy:b, bossType:'mid' }); this.scene.hud?.setStatus('中途 Boss 出现：铁甲暴君'); } if(p.id==='finalBoss') this.spawnFinalBoss(); }
  update(time){ if(this.scene.isGameplayPaused?.()) return; this.scene.enemyBehaviors?.update(time); this.separateEnemies(); this.scene.enemies.forEach(syncEnemyUi); const p=this.phase(); if(!p) return; if(p.id==='early' && !this.scene.enemies.some(e=>!e.isDefeated)) this.enterPhase(1); else if(p.id==='mixed' && !this.scene.enemies.some(e=>!e.isDefeated)) this.enterPhase(2); else if(p.id==='midBoss' && this.midBossKilled) this.enterPhase(3); else if(p.id==='late' && !this.scene.enemies.some(e=>!e.isDefeated)) this.triggerRestPoint(); }
  onMidBossKilled(){ this.midBossKilled=true; }
  triggerRestPoint(){ if(this.restTriggered) return; this.restTriggered=true; this.phaseIndex=4; this.clearEnemies(); this.scene.showRestPoint?.(); }
  spawnFinalBoss(){ if(this.finalBossSpawned) return; this.finalBossSpawned=true; const p=this.stage.phases.find(x=>x.id==='finalBoss'); const b=this.spawn(p.boss.enemyId,p.boss.x); this.scene.runState=RunStates.BOSS; this.scene.eventBus.emit(CombatEvents.BOSS_SPAWNED,{ enemy:b, bossType:'final' }); this.scene.hud?.setStatus('最终 Boss 出现：训练场守卫'); }
  clearEnemies(){ this.scene.enemies.forEach(e=>{ this.scene.enemyBehaviors?.destroyEnemy(e); this.scene.statusEffects?.clearTarget(e); [e.hpBarBg,e.hpBar,e.nameText,e].forEach(o=>o?.destroy()); }); this.scene.enemies=[]; this.scene.currentTarget=null; }
  separateEnemies(){ const enemies=this.scene.enemies.filter(e=>!e.isDefeated&&e.active); for(let i=0;i<enemies.length;i+=1){ for(let j=i+1;j<enemies.length;j+=1){ const a=enemies[i],b=enemies[j],min=((a.body?.width||a.width)/2)+((b.body?.width||b.width)/2)+8,dx=b.x-a.x,overlap=min-Math.abs(dx); if(overlap>0){ const dir=dx>=0?1:-1,shift=Math.min(overlap/2,10); if(!a.isBoss)a.x-=dir*shift; if(!b.isBoss)b.x+=dir*shift; } } } }
}
