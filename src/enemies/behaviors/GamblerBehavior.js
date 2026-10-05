import { GAMBLER_TUNING as CARD } from '../../config/enemies.js';

const alive = e => e?.active && !e.isDefeated;
// Entry into a circular hit area, so a long frame still picks the first impact.
const hitFraction = (target,from,to) => {
  const dx=to.x-from.x,dy=to.y-from.y,fx=from.x-target.x,fy=from.y-target.y;
  const a=dx*dx+dy*dy,c=fx*fx+fy*fy-CARD.cardRadius*CARD.cardRadius;
  if(c<=0)return 0;
  if(!a)return null;
  const b=2*(fx*dx+fy*dy),d=b*b-4*a*c;
  if(d<0)return null;
  const u=(-b-Math.sqrt(d))/(2*a);
  return u>=0&&u<=1?u:null;
};

// Normal-mode ranged elite; each fourth released card replaces its direct hit.
export default class GamblerBehavior {
  constructor(scene,enemy,helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    this.state='idle'; this.nextThrow=0; this.until=0; this.cardsThrown=0;
    this.card=null; this.impact=null; this.flashUntil=0;
    this.graphics=scene.add.graphics().setDepth(23);
  }
  hand() { return {x:this.e.x-this.e.width*0.4,y:this.e.y-12}; }
  nextIsExplosive() { return (this.cardsThrown+1)%CARD.explosiveEvery===0; }
  throwCard(t) {
    const e=this.e,target=this.h.chooseTarget(this.scene,e,e.attackRange);
    if(!target?.isAlive?.()||this.card)return false;
    const from=this.hand(),dx=target.x-from.x,dy=target.y-from.y,length=Math.hypot(dx,dy)||1;
    const to={x:from.x+dx/length*e.attackRange,y:from.y+dy/length*e.attackRange};
    const explosive=this.nextIsExplosive(); this.cardsThrown=(this.cardsThrown+1)%CARD.explosiveEvery;
    this.card={from,to,p:{...from},started:t,damage:e.damage,explosive};
    this.nextThrow=t+this.h.getEnemyAttackDelay(e,e.attackIntervalMs,t);
    return true;
  }
  explode(point,damage,t) {
    this.impact=point; this.flashUntil=t+CARD.flash;
    const e=this.e,targets=this.scene.combatSystem.getAttackableTargets(e);
    for(const target of targets) {
      // Prior hits can synchronously kill the caster/another target or end the run.
      if(!alive(e)||!this.graphics)return;
      if(target.isAlive?.()&&Math.hypot(target.x-point.x,target.y-point.y)<=CARD.explosionRadius)
        this.h.targetDamage(this.scene,target,e,Math.max(1,Math.round(damage*CARD.explosionDamageMultiplier)),
          {source:'gamblerExplosion',attackType:'bomb',singleTarget:false,dodgeable:false,knockbackDistance:0});
    }
  }
  advanceCard(t) {
    const card=this.card;
    if(!card)return;
    const u=Math.max(0,Math.min(1,(t-card.started)/CARD.flight)),previous=card.p;
    const point={x:card.from.x+(card.to.x-card.from.x)*u,y:card.from.y+(card.to.y-card.from.y)*u};
    const hits=this.scene.combatSystem.getAttackableTargets(this.e).filter(v=>v.isAlive?.())
      .map(target=>({target,u:hitFraction(target,previous,point)})).filter(v=>v.u!==null).sort((a,b)=>a.u-b.u);
    if(hits.length||u>=1) {
      this.card=null; // Remove before any damage callback; never direct hit + explosion.
      const first=hits[0],impact=first?{x:previous.x+(point.x-previous.x)*first.u,y:previous.y+(point.y-previous.y)*first.u}:point;
      if(card.explosive)this.explode(impact,card.damage,t);
      else if(first)this.h.targetDamage(this.scene,first.target,this.e,card.damage,
        {source:'gamblerCard',attackType:'projectile',knockbackDistance:0});
    } else card.p=point;
  }
  update(t) {
    if(!alive(this.e)||!this.graphics)return;
    this.advanceCard(t); if(!alive(this.e)||!this.graphics)return;
    const e=this.e,s=this.scene;
    if(this.state==='idle') {
      this.h.approach(s,e,e.attackRange);
      if(t>=this.nextThrow&&!this.card&&this.h.chooseTarget(s,e,e.attackRange)?.isAlive?.()) {
        this.state='windup'; this.until=t+(this.nextIsExplosive()?CARD.explosiveWindup:CARD.windup);
        e.body?.setVelocityX?.(0);
      }
    } else {
      e.body?.setVelocityX?.(0);
      if(t>=this.until) { this.state='idle'; this.throwCard(t); }
    }
    this.syncVisual();
  }
  syncVisual() {
    const g=this.graphics,e=this.e;
    if(!g)return;
    g.clear(); if(!alive(e))return;
    const hand=this.hand(),charged=this.state==='windup'&&this.nextIsExplosive();
    g.lineStyle(3,charged?0xff706c:0xe7dfd5,1).strokeRect(hand.x-8,hand.y-22,18,26)
      .strokeRect(hand.x-2,hand.y-16,18,26);
    if(this.card) {
      const p=this.card.p,color=this.card.explosive?0xff706c:0xe7dfd5;
      g.lineStyle(3,color,1).strokeRect(p.x-9,p.y-13,18,26)
        .lineBetween(p.x,p.y-5,p.x-4,p.y).lineBetween(p.x-4,p.y,p.x,p.y+5)
        .lineBetween(p.x,p.y+5,p.x+4,p.y).lineBetween(p.x+4,p.y,p.x,p.y-5);
    }
    if(this.impact&&(this.scene.getGameplayTime?.()||0)<this.flashUntil)
      g.lineStyle(5,0xff8b65,0.9).strokeCircle(this.impact.x,this.impact.y,CARD.explosionRadius);
  }
  interrupt() {
    this.card=null; this.impact=null; this.flashUntil=0;
    if(this.state==='windup')this.state='idle'; // No release means no count or cooldown.
    this.syncVisual();
  }
  onRecycle() { this.interrupt(); this.state='idle'; this.nextThrow=0; this.until=0; this.graphics?.clear(); }
  shiftTimers(delta,after) {
    for(const key of ['nextThrow','until','flashUntil'])if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
    if(this.card)this.card.started+=delta;
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() { this.card=null; this.impact=null; this.graphics?.destroy(); this.graphics=null; this.state='idle'; }
}
