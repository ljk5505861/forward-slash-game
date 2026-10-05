import { THUNDER_MAGE_TUNING as THUNDER } from '../../config/enemies.js';

const alive = e => e?.active && !e.isDefeated;
const segmentDistance = (p,a,b) => {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const u=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
};

// Normal-mode ranged elite: fixed trajectory bolt and fixed-position warned strike.
export default class ThunderMageBehavior {
  constructor(scene,enemy,helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    this.state='idle'; this.nextThunder=null; this.nextNormal=0;
    this.bolt=null; this.warning=null; this.impact=null; this.until=0; this.flashUntil=0;
    this.graphics=scene.add.graphics().setDepth(23);
  }
  hand() { return {x:this.e.x-this.e.width*0.4,y:this.e.y-12}; }
  delay(ms,t) { return this.h.getEnemyAttackDelay(this.e,ms,t); }
  shoot(t) {
    const target=this.h.chooseTarget(this.scene,this.e,this.e.attackRange);
    if(!target?.isAlive?.()||this.bolt)return false;
    const from=this.hand(),dx=target.x-from.x,dy=target.y-from.y,length=Math.hypot(dx,dy)||1;
    const to={x:from.x+dx/length*this.e.attackRange,y:from.y+dy/length*this.e.attackRange};
    this.bolt={from,to,p:{...from},started:t,damage:this.e.damage}; return true;
  }
  advanceBolt(t) {
    const bolt=this.bolt;
    if(!bolt)return;
    const u=Math.max(0,Math.min(1,(t-bolt.started)/THUNDER.flight)),previous=bolt.p;
    bolt.p={x:bolt.from.x+(bolt.to.x-bolt.from.x)*u,y:bolt.from.y+(bolt.to.y-bolt.from.y)*u};
    const targets=this.scene.combatSystem.getAttackableTargets(this.e)
      .filter(v=>v.isAlive?.()&&segmentDistance(v,previous,bolt.p)<=THUNDER.boltRadius)
      .sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y));
    if(targets.length) {
      const victim=targets[0]; this.bolt=null; // Remove before synchronous reflect/death callbacks.
      this.h.targetDamage(this.scene,victim,this.e,bolt.damage,
        {source:'thunderMageBolt',attackType:'projectile',knockbackDistance:0});
    } else if(u>=1)this.bolt=null;
  }
  strike(t) {
    const point=this.warning,e=this.e;
    this.warning=null; this.impact=point; this.flashUntil=t+THUNDER.flash;
    this.state='recovery'; this.until=t+THUNDER.recovery;
    this.nextThunder=this.until+this.delay(THUNDER.cooldown,t);
    this.nextNormal=this.until+this.delay(e.attackIntervalMs,t);
    const targets=this.scene.combatSystem.getAttackableTargets(e);
    for(const victim of targets) {
      // Earlier damage can kill the caster, another summon, or shut down the scene.
      if(!alive(e)||!this.graphics)return;
      if(victim.isAlive?.()&&Math.hypot(victim.x-point.x,victim.y-point.y)<=THUNDER.radius)
        this.h.targetDamage(this.scene,victim,e,Math.round(e.damage*THUNDER.damageMultiplier),
          {source:'thunderMageStrike',attackType:'ground',dodgeable:false,singleTarget:false,knockbackDistance:0});
    }
  }
  update(t) {
    if(!alive(this.e)||!this.graphics)return;
    this.advanceBolt(t); if(!alive(this.e)||!this.graphics)return;
    const e=this.e,s=this.scene;
    if(this.nextThunder===null)this.nextThunder=t+THUNDER.first;
    if(this.state==='recovery'&&t>=this.until)this.state='idle';
    if(this.state==='idle') {
      this.h.approach(s,e,e.attackRange);
      const target=this.h.chooseTarget(s,e,e.attackRange);
      if(t>=this.nextThunder&&target?.isAlive?.()&&!this.bolt) {
        this.state='windup'; this.warning={x:target.x,y:target.y};
        this.until=t+THUNDER.warning; e.body?.setVelocityX?.(0);
      } else if(t>=this.nextNormal&&this.shoot(t))this.nextNormal=t+this.delay(e.attackIntervalMs,t);
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
    const p=this.hand(),charged=this.state==='windup';
    g.lineStyle(5,0xa4bace,1).lineBetween(p.x,p.y+30,p.x-6,p.y-30);
    g.lineStyle(4,charged?0xffe078:0x93ddff,1).strokeCircle(p.x-6,p.y-36,8);
    if(this.bolt) {
      const b=this.bolt.p;
      g.lineStyle(4,0x9ce8ff,1).lineBetween(b.x+14,b.y-8,b.x,b.y)
        .lineBetween(b.x,b.y,b.x+7,b.y+4).lineBetween(b.x+7,b.y+4,b.x-14,b.y+10);
    }
    if(this.warning)g.lineStyle(4,0xffd665,0.9).strokeCircle(this.warning.x,this.warning.y,THUNDER.radius);
    if(this.impact&&(this.scene.getGameplayTime?.()||0)<this.flashUntil) {
      const {x,y}=this.impact;
      g.lineStyle(7,0xb5efff,1).lineBetween(x-12,y-190,x+12,y-95)
        .lineBetween(x+12,y-95,x-8,y-105).lineBetween(x-8,y-105,x,y);
      g.lineStyle(5,0xb5efff,0.95).strokeCircle(x,y,THUNDER.radius);
    }
  }
  interrupt() {
    this.bolt=null; this.warning=null; this.impact=null; this.flashUntil=0;
    if(this.state==='windup')this.state='idle'; // No strike released: do not spend full cooldown.
    this.syncVisual();
  }
  onRecycle() {
    this.interrupt(); this.state='idle'; this.nextThunder=null; this.nextNormal=0; this.until=0;
    this.graphics?.clear();
  }
  shiftTimers(delta,after) {
    for(const key of ['nextThunder','nextNormal','until','flashUntil'])
      if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
    if(this.bolt)this.bolt.started+=delta;
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() { this.bolt=null; this.warning=null; this.impact=null; this.state='idle'; this.graphics?.destroy(); this.graphics=null; }
}
