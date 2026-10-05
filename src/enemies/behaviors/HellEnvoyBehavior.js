import { ENEMIES, HELL_ENVOY_TUNING as HELL } from '../../config/enemies.js';
import { RunStates } from '../../core/CombatEvents.js';

const alive = e => e?.active && !e.isDefeated;
const canSpawn = (scene,group) => scene.runMode==='normal' && !group?.closed &&
  ![RunStates.VICTORY,RunStates.DEFEAT].includes(scene.runState) && !!scene.stageSystem;
const members = (scene,group,id) => scene.enemies.filter(e=>alive(e)&&e.hellSummonGroup===group&&e.enemyId===id);

function spawnSummon(scene,group,id,x) {
  if(!canSpawn(scene,group))return null;
  const half=ENEMIES[id].width/2;
  const position=Math.max(half+8,Math.min(scene.balance.stageWorldWidth-half-8,x));
  const enemy=scene.stageSystem.spawn(id,position);
  if(enemy) {
    enemy.hellSummonGroup=group;
    // Delay the first contact hit; spawning must not inflict immediate damage.
    enemy.nextAttackAt=(scene.getGameplayTime?.()||0)+enemy.attackIntervalMs;
  }
  return enemy;
}

// Called only by combat death, never by scene teardown or minion removal.
export function splitHellHead(scene,enemy) {
  if(enemy?.enemyId!=='hell_head'||enemy.hellSplitDone)return;
  enemy.hellSplitDone=true;
  const group=enemy.hellSummonGroup;
  if(!group||!canSpawn(scene,group))return;
  const count=Math.min(2,HELL.smallCap-members(scene,group,'hell_small').length);
  for(let i=0;i<count;i++)spawnSummon(scene,group,'hell_small',enemy.x+(i===0?-20:20));
}

export default class HellEnvoyBehavior {
  constructor(scene,enemy,helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    // No reference back to the owner: surviving demons outlive its behavior.
    this.group={closed:false}; this.state='idle'; this.nextSummon=null;
    this.nextMelee=0; this.until=0;
    this.graphics=scene.add.graphics().setDepth(23);
  }
  hasRoom() {
    const heads=members(this.scene,this.group,'hell_head').length;
    const small=members(this.scene,this.group,'hell_small').length;
    // Reserve two local split slots per head, so a full pack pauses summoning.
    return heads<HELL.headCap && small+heads*2+2<=HELL.smallCap &&
      this.scene.stageSystem.activeEnemyCount()<this.scene.balance.enemyPopulation.hardCap;
  }
  update(t) {
    if(!alive(this.e)||!this.graphics)return;
    const e=this.e,s=this.scene;
    if(this.nextSummon===null)this.nextSummon=t+HELL.first;
    if(this.state==='recovery'&&t>=this.until)this.state='idle';
    if(this.state==='idle') {
      this.h.approach(s,e,e.attackRange,e.preferredRange);
      if(t>=this.nextSummon&&this.hasRoom()&&this.h.chooseAnyTarget(s,e,e.attackRange)) {
        this.state='windup'; this.until=t+HELL.windup; e.body?.setVelocityX?.(0);
      } else if(t>=this.nextMelee) {
        const target=this.h.chooseTarget(s,e,HELL.meleeRange);
        if(target?.isAlive?.()) {
          this.nextMelee=t+this.h.getEnemyAttackDelay(e,e.attackIntervalMs,t);
          this.h.targetDamage(s,target,e,e.damage,{source:'hellEnvoyMelee'});
        }
      }
    } else {
      e.body?.setVelocityX?.(0);
      if(this.state==='windup'&&t>=this.until) {
        const summoned=this.hasRoom()&&spawnSummon(s,this.group,'hell_head',e.x-68);
        this.state='recovery'; this.until=t+HELL.recovery;
        if(summoned)this.nextSummon=this.until+HELL.cooldown;
        this.nextMelee=this.until+this.h.getEnemyAttackDelay(e,e.attackIntervalMs,t);
      }
    }
    this.syncVisual();
  }
  syncVisual() {
    const g=this.graphics,e=this.e;
    if(!g)return;
    g.clear(); if(!alive(e))return;
    const x=e.x-24,y=e.y-12;
    g.lineStyle(5,0xb58b9c,1).lineBetween(x,y+34,x,y-34);
    g.lineStyle(4,this.state==='windup'?0xffb4aa:0xdd7583,1).strokeCircle(x,y-40,10);
    if(this.state==='windup')g.lineStyle(4,0xff867c,0.9).strokeCircle(e.x-68,e.y+20,28);
  }
  interrupt() { if(this.state==='windup')this.state='idle'; this.syncVisual(); }
  onRecycle() {
    this.state='idle'; this.nextSummon=null; this.nextMelee=0; this.until=0;
    this.graphics?.clear(); // Existing summons keep their owner-specific cap.
  }
  shiftTimers(delta,after) {
    for(const key of ['nextSummon','nextMelee','until'])
      if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() {
    if(this.group&&!this.e.isDefeated)this.group.closed=true;
    this.group=null; this.graphics?.destroy(); this.graphics=null; this.state='idle';
  }
}

// Demons use ordinary melee/knockback/movement, with only an attached face.
export class HellSummonBehavior {
  constructor(scene,enemy,helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    enemy.noGoldReward=true;
    this.graphics=scene.add.graphics().setDepth(23);
  }
  update() { this.h.approach(this.scene,this.e,this.e.attackRange); this.syncVisual(); }
  syncVisual() {
    const g=this.graphics,e=this.e;
    if(!g)return;
    g.clear(); if(!alive(e))return;
    const r=e.width/2-4,x=e.x,y=e.y-e.height*0.12;
    g.lineStyle(3,0xffd4b5,1).lineBetween(x-r*0.55,y-5,x-r*0.2,y-2)
      .lineBetween(x+r*0.2,y-2,x+r*0.55,y-5)
      .lineBetween(x-r*0.45,y+8,x+r*0.45,y+8)
      .lineBetween(x-r*0.25,y+8,x-r*0.25,y+14)
      .lineBetween(x+r*0.25,y+8,x+r*0.25,y+14);
  }
  onRecycle() { this.graphics?.clear(); }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() { delete this.e.hellSummonGroup; this.graphics?.destroy(); this.graphics=null; }
}
