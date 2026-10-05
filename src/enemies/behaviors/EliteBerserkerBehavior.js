import { ELITE_BERSERKER_TUNING as AXE } from '../../config/enemies.js';

const alive = e => e?.active && !e.isDefeated;

// Normal-mode melee elite. No charge, forced counter or control immunity.
export default class EliteBerserkerBehavior {
  constructor(scene, enemy, helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    this.state='idle'; this.nextCombo=null; this.nextMelee=0; this.swings=0;
    this.until=0; this.nextSlash=0; this.effectUntil=0; this.direction=-1;
    this.graphics=scene.add.graphics().setDepth(23);
  }
  delay(ms,t) { return this.h.getEnemyAttackDelay(this.e,ms,t); }
  recover(t) {
    this.state='recovery'; this.until=t+AXE.recovery;
    this.nextCombo=this.until+this.delay(AXE.cooldown,t);
    this.nextMelee=this.until+this.delay(this.e.attackIntervalMs,t);
  }
  slash(t,first=false) {
    // Re-select and range-check every strike. Leaving range can dodge later cuts.
    const target=this.h.chooseTarget(this.scene,this.e,AXE.range);
    const victim=target?.isAlive?.()&&Math.hypot(this.e.x-target.x,this.e.y-target.y)<=AXE.range?target:null;
    if(first&&!victim) { this.state='idle'; return; } // No strike released: cooldown stays available.
    if(victim)this.direction=Math.sign(victim.x-this.e.x)||this.direction;
    this.swings+=1; this.effectUntil=t+AXE.effectMs;
    this.nextSlash=t+AXE.slashGap;
    if(this.swings===3)this.recover(t);
    else this.state='combo';
    // Advance state before damage; reflect can synchronously destroy this behavior.
    if(victim)this.h.targetDamage(this.scene,victim,this.e,this.e.damage,
      {source:'eliteBerserkerSlash',attackType:'melee',knockbackDistance:0});
  }
  update(t) {
    if(!alive(this.e)||!this.graphics)return;
    const e=this.e,s=this.scene;
    if(this.nextCombo===null)this.nextCombo=t+AXE.first;
    if(this.state==='recovery'&&t>=this.until)this.state='idle';
    if(this.state==='idle') {
      this.h.approach(s,e,e.attackRange);
      const target=this.h.chooseTarget(s,e,AXE.range);
      if(t>=this.nextCombo&&target?.isAlive?.()) {
        this.state='windup'; this.until=t+AXE.windup; this.swings=0; e.body?.setVelocityX?.(0);
      } else if(t>=this.nextMelee) {
        const victim=this.h.chooseTarget(s,e,e.attackRange);
        if(victim?.isAlive?.()) {
          this.nextMelee=t+this.delay(e.attackIntervalMs,t);
          this.h.targetDamage(s,victim,e,e.damage,{source:'eliteBerserkerMelee',attackType:'melee',knockbackDistance:0});
        }
      }
    } else {
      e.body?.setVelocityX?.(0);
      if(this.state==='windup'&&t>=this.until)this.slash(t,true);
      else if(this.state==='combo'&&t>=this.nextSlash)this.slash(t);
    }
    this.syncVisual();
  }
  syncVisual() {
    const g=this.graphics,e=this.e;
    if(!g)return;
    g.clear(); if(!alive(e))return;
    const wind=this.state==='windup',y=e.y-(wind?30:6);
    for(const offset of [-24,24]) {
      const x=e.x+offset;
      g.lineStyle(5,0x775137,1).lineBetween(x,y+25,x,y-24);
      g.lineStyle(4,wind?0xffdc87:0xe0d6cd,1).strokeRect(x-12,y-27,24,17);
    }
    if((this.scene.getGameplayTime?.()||0)<this.effectUntil) {
      const dir=this.direction,x=e.x+dir*35,y=e.y-8;
      g.lineStyle(6,0xffb78f,0.95).lineBetween(x,y-38,x+dir*65,y)
        .lineBetween(x+dir*65,y,x,y+38);
    }
  }
  interrupt(t) {
    this.effectUntil=0;
    if(this.state==='windup')this.state='idle';
    else if(this.state==='combo')this.recover(t);
    this.syncVisual();
  }
  onRecycle() {
    this.state='idle'; this.nextCombo=null; this.nextMelee=0; this.swings=0;
    this.until=0; this.nextSlash=0; this.effectUntil=0; this.graphics?.clear();
  }
  shiftTimers(delta,after) {
    for(const key of ['nextCombo','nextMelee','until','nextSlash','effectUntil'])
      if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() { this.graphics?.destroy(); this.graphics=null; this.state='idle'; this.effectUntil=0; }
}
