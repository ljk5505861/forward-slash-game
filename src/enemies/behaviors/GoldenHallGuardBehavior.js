import { GOLDEN_HALL_GUARD_TUNING as SPEAR } from '../../config/enemies.js';

const alive = e => e?.active && !e.isDefeated;

// Normal-mode spear elite. The third released thrust replaces the ordinary hit.
export default class GoldenHallGuardBehavior {
  constructor(scene, enemy, helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    this.state='idle'; this.nextAttack=0; this.until=0; this.thrusts=0;
    this.effectUntil=0; this.direction=-1; this.heavy=false;
    this.graphics=scene.add.graphics().setDepth(23);
  }
  nextIsHeavy() { return (this.thrusts+1)%SPEAR.heavyEvery===0; }
  strike(t) {
    const e=this.e,target=this.h.chooseTarget(this.scene,e,e.attackRange);
    if(!target?.isAlive?.()||Math.hypot(e.x-target.x,e.y-target.y)>e.attackRange) {
      this.state='idle'; this.until=0; return; // No release: no count or attack interval consumed.
    }
    this.direction=Math.sign(target.x-e.x)||this.direction;
    this.thrusts=(this.thrusts+1)%SPEAR.heavyEvery;
    this.nextAttack=t+this.h.getEnemyAttackDelay(e,e.attackIntervalMs,t);
    this.state='recovery'; this.until=t+(this.heavy?SPEAR.heavyRecovery:SPEAR.recovery);
    this.effectUntil=t+SPEAR.effectMs;
    // Commit state before damage: reflected damage can destroy the caster/scene.
    this.h.targetDamage(this.scene,target,e,Math.max(1,Math.round(e.damage*(this.heavy?SPEAR.heavyDamageMultiplier:1))),
      {source:this.heavy?'goldenGuardHeavyThrust':'goldenGuardThrust',attackType:'melee',knockbackDistance:0});
  }
  update(t) {
    if(!alive(this.e)||!this.graphics)return;
    const e=this.e,s=this.scene;
    if(this.state==='recovery'&&t>=this.until)this.state='idle';
    if(this.state==='idle') {
      this.h.approach(s,e,e.attackRange);
      const target=this.h.chooseTarget(s,e,e.attackRange);
      if(t>=this.nextAttack&&target?.isAlive?.()) {
        this.direction=Math.sign(target.x-e.x)||this.direction;
        this.heavy=this.nextIsHeavy(); this.state='windup';
        this.until=t+(this.heavy?SPEAR.heavyWindup:SPEAR.windup);
        e.body?.setVelocityX?.(0);
      }
    } else {
      e.body?.setVelocityX?.(0);
      if(this.state==='windup'&&t>=this.until)this.strike(t);
    }
    this.syncVisual();
  }
  syncVisual() {
    const g=this.graphics,e=this.e;
    if(!g)return;
    g.clear(); if(!alive(e))return;
    const wind=this.state==='windup',dir=this.direction;
    const extended=(this.scene.getGameplayTime?.()||0)<this.effectUntil;
    const handX=e.x+dir*(wind?-6:22),y=e.y-14;
    const tipX=extended?e.x+dir*e.attackRange:handX+dir*(wind?88:116);
    const color=wind&&this.heavy?0xffed9a:0xdac57c;
    g.lineStyle(5,0x89663b,1).lineBetween(handX-dir*30,y,tipX,y);
    g.lineStyle(4,color,1).lineBetween(tipX-dir*18,y-9,tipX,y)
      .lineBetween(tipX,y,tipX-dir*18,y+9);
    g.lineStyle(3,0xffd36a,1).lineBetween(e.x-18,e.y-48,e.x-12,e.y-62)
      .lineBetween(e.x-12,e.y-62,e.x,e.y-54).lineBetween(e.x,e.y-54,e.x+12,e.y-62)
      .lineBetween(e.x+12,e.y-62,e.x+18,e.y-48);
    if(extended)g.lineStyle(this.heavy?6:3,this.heavy?0xffe1a0:0xebe4cf,0.9)
      .lineBetween(e.x+dir*42,y,tipX,y);
  }
  interrupt() {
    this.effectUntil=0;
    if(this.state==='windup'){ this.state='idle'; this.until=0; }
    this.syncVisual();
  }
  onRecycle() {
    this.state='idle'; this.nextAttack=0; this.until=0; this.effectUntil=0;
    this.graphics?.clear(); // Keep the two-light/one-heavy count across re-entry.
  }
  shiftTimers(delta,after) {
    for(const key of ['nextAttack','until','effectUntil'])
      if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() { this.graphics?.destroy(); this.graphics=null; this.state='idle'; this.effectUntil=0; }
}
