import { SHARPSHOOTER_TUNING as SHOT } from '../../config/enemies.js';

const alive = e => e?.active && !e.isDefeated;
const segmentDistance = (p,a,b) => {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const u=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
};

// Normal-mode ranged elite. No forced movement or knockback immunity.
export default class SharpshooterBehavior {
  constructor(scene,enemy,helpers) {
    this.scene=scene;this.e=enemy;this.h=helpers;
    this.state='idle';this.nextBurst=null;this.nextNormal=0;this.arrows=[];this.shots=0;
    this.graphics=scene.add.graphics().setDepth(23);
  }
  hand() { return {x:this.e.x-this.e.width*0.4,y:this.e.y-12}; }
  delay(ms,t) { return this.h.getEnemyAttackDelay(this.e,ms,t); }
  shoot(t,burst=false) {
    const target=this.h.chooseTarget(this.scene,this.e,this.e.attackRange);
    if(!target?.isAlive?.())return false;
    const from=this.hand(),dx=target.x-from.x,dy=target.y-from.y,length=Math.hypot(dx,dy)||1;
    const to={x:from.x+dx/length*this.e.attackRange,y:from.y+dy/length*this.e.attackRange};
    this.arrows.push({from,to,p:{...from},started:t,burst,
      damage:Math.max(1,Math.round(this.e.damage*(burst?SHOT.burstDamageMultiplier:1)))});
    return true;
  }
  advanceArrows(t) {
    const flying=this.arrows;this.arrows=[];
    for(const arrow of flying) {
      if(!alive(this.e)||!this.graphics)return;
      const u=Math.max(0,Math.min(1,(t-arrow.started)/SHOT.flight)),previous=arrow.p;
      arrow.p={x:arrow.from.x+(arrow.to.x-arrow.from.x)*u,y:arrow.from.y+(arrow.to.y-arrow.from.y)*u};
      const targets=this.scene.combatSystem.getAttackableTargets(this.e)
        .filter(target=>target.isAlive?.()&&segmentDistance(target,previous,arrow.p)<=22)
        .sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y));
      if(targets.length) {
        const victim=targets[0]; // Arrow removed before synchronous reflect/death callbacks.
        this.h.targetDamage(this.scene,victim,this.e,arrow.damage,{source:arrow.burst?'sharpshooterBurst':'sharpshooterArrow',
          attackType:'projectile',knockbackDistance:0});
      } else if(u<1)this.arrows.push(arrow);
    }
  }
  recover(t) {
    this.state='recovery';this.until=t+SHOT.recovery;
    this.nextBurst=this.until+this.delay(SHOT.cooldown,t);
    this.nextNormal=this.until+this.delay(this.e.attackIntervalMs,t);
  }
  interrupt(t) {
    this.arrows=[];
    if(this.state==='burst')this.recover(t);
    else if(this.state==='windup')this.state='idle'; // No shot released: no spent skill cooldown.
    this.syncVisual();
  }
  update(t) {
    if(!alive(this.e)||!this.graphics)return;
    this.advanceArrows(t);
    if(!alive(this.e)||!this.graphics)return;
    const e=this.e,s=this.scene;
    if(this.nextBurst===null)this.nextBurst=t+SHOT.first;
    if(this.state==='recovery'&&t>=this.until)this.state='idle';
    if(this.state==='idle') {
      this.h.approach(s,e,e.attackRange);
      const target=this.h.chooseTarget(s,e,e.attackRange);
      if(t>=this.nextBurst&&target?.isAlive?.()&&!this.arrows.length) {
        this.state='windup';this.until=t+SHOT.windup;this.shots=0;e.body?.setVelocityX?.(0);
      } else if(t>=this.nextNormal&&this.shoot(t))this.nextNormal=t+this.delay(e.attackIntervalMs,t);
    } else {
      e.body?.setVelocityX?.(0);
      if(this.state==='windup'&&t>=this.until) {
        if(this.shoot(t,true)){this.state='burst';this.shots=1;this.nextShot=t+SHOT.shotGap;}
        else this.state='idle';
      } else if(this.state==='burst'&&t>=this.nextShot) {
        if(!this.shoot(t,true)){this.recover(t);}
        else {this.shots+=1;this.nextShot=t+SHOT.shotGap;if(this.shots===3)this.recover(t);}
      }
    }
    this.syncVisual();
  }
  syncVisual() {
    if(!this.graphics)return;
    const g=this.graphics;g.clear();if(!alive(this.e))return;
    const p=this.hand(),charged=this.state==='windup';
    g.lineStyle(5,charged?0xffd478:0xe7c493,1)
      .lineBetween(p.x+8,p.y-30,p.x-14,p.y).lineBetween(p.x-14,p.y,p.x+8,p.y+30);
    g.lineStyle(2,0xdcecf2,1).lineBetween(p.x+8,p.y-30,p.x+8,p.y+30);
    for(const a of this.arrows) {
      const dx=a.to.x-a.from.x,dy=a.to.y-a.from.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
      g.lineStyle(3,a.burst?0xffd478:0xbcecf2,1)
        .lineBetween(a.p.x-ux*24,a.p.y-uy*24,a.p.x,a.p.y)
        .lineBetween(a.p.x-ux*8-uy*5,a.p.y-uy*8+ux*5,a.p.x,a.p.y)
        .lineBetween(a.p.x-ux*8+uy*5,a.p.y-uy*8-ux*5,a.p.x,a.p.y);
    }
  }
  onRecycle() {
    this.state='idle';this.arrows=[];this.shots=0;this.nextBurst=null;this.nextNormal=0;this.graphics?.clear();
  }
  shiftTimers(delta,after) {
    for(const key of ['nextBurst','nextNormal','nextShot','until'])if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
    this.arrows.forEach(a=>{a.started+=delta;});
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() { this.arrows=[];this.graphics?.destroy();this.graphics=null;this.state='idle'; }
}
