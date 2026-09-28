// Normal-mode chain-cleaver carrier. Gameplay time owns every phase; no timers
// or tweens survive death, recycling, pause or a scene restart.
export const MEAT_TIMING = Object.freeze({ first:4500, cooldown:6500, windup:650, flight:550, recall:350, range:360 });
const alive = e => e?.active && !e.isDefeated;
const distanceToSegment = (p, a, b) => {
  const dx=b.x-a.x, dy=b.y-a.y, length=dx*dx+dy*dy;
  const u=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
};

export default class MeatBehavior {
  constructor(scene, enemy, helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    this.state='idle'; this.nextThrow=null; this.nextMelee=0;
    this.knife=null; this.graphics=scene.add.graphics().setDepth(23);
  }
  hand(){ return {x:this.e.x-this.e.width*0.4,y:this.e.y-8}; }
  syncVisual(){
    if(!this.graphics||!alive(this.e)) return;
    const g=this.graphics, hand=this.hand(), blade=this.knife||hand;
    g.clear();
    if(this.knife) g.lineStyle(3,0x888888,1).lineBetween(hand.x,hand.y,blade.x,blade.y);
    g.fillStyle(this.state==='windup'?0xffdd88:0xcbd5e1,1);
    g.fillRect(blade.x-32,blade.y-8,32,16);
    g.fillStyle(0x654321,1).fillRect(blade.x,blade.y-3,12,6);
  }
  delay(ms,t){ return this.h.getEnemyAttackDelay(this.e,ms,t); }
  interrupt(t){
    if(this.state==='idle') return;
    this.state='idle'; this.knife=null; this.target=null;
    this.nextThrow=t+this.delay(MEAT_TIMING.cooldown,t);
    this.nextMelee=t+this.delay(this.e.attackIntervalMs,t);
    this.syncVisual();
  }
  update(t){
    if(!alive(this.e)) return;
    const e=this.e, s=this.scene;
    if(this.nextThrow===null) this.nextThrow=t+MEAT_TIMING.first;
    if(this.state==='idle'){
      this.h.approach(s,e,e.attackRange);
      const target=this.h.chooseAnyTarget(s,e,MEAT_TIMING.range);
      if(t>=this.nextThrow&&target?.isAlive?.()){
        this.state='windup'; this.target=target; this.until=t+MEAT_TIMING.windup;
        e.body?.setVelocityX?.(0);
      } else {
        const melee=this.h.chooseTarget(s,e,e.attackRange);
        if(melee&&t>=this.nextMelee){
          this.nextMelee=t+this.delay(e.attackIntervalMs,t);
          this.h.targetDamage(s,melee,e,e.damage,{source:'meatMelee'});
        }
      }
    } else {
      e.body?.setVelocityX?.(0);
      if(this.state==='windup'&&t>=this.until){
        if(!this.target?.isAlive?.()){ this.interrupt(t); return; }
        const from=this.hand(), dx=this.target.x-from.x, dy=this.target.y-from.y;
        const length=Math.hypot(dx,dy)||1;
        this.from=from; this.to={x:from.x+dx/length*MEAT_TIMING.range,y:from.y+dy/length*MEAT_TIMING.range};
        this.knife={...from}; this.target=null; this.started=t; this.state='outbound';
      } else if(this.state==='outbound'){
        const fraction=Math.min(1,(t-this.started)/MEAT_TIMING.flight), previous=this.knife;
        this.knife={x:this.from.x+(this.to.x-this.from.x)*fraction,y:this.from.y+(this.to.y-this.from.y)*fraction};
        const targets=s.combatSystem.getAttackableTargets(e).filter(target=>target.isAlive?.()&&distanceToSegment(target,previous,this.knife)<=22);
        targets.sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y));
        if(targets.length||fraction>=1){
          // Switch state before damage: reflected damage may synchronously kill us.
          this.state='recall'; this.started=t; this.from={...this.knife};
          if(targets.length) this.h.targetDamage(s,targets[0],e,e.damage*2,{source:'meatKnife',attackType:'projectile',knockbackDistance:36});
        }
      } else if(this.state==='recall'){
        const fraction=Math.min(1,(t-this.started)/MEAT_TIMING.recall), hand=this.hand();
        this.knife={x:this.from.x+(hand.x-this.from.x)*fraction,y:this.from.y+(hand.y-this.from.y)*fraction};
        if(fraction>=1) this.interrupt(t);
      }
    }
    this.syncVisual();
  }
  onRecycle(){ this.interrupt(this.scene.getGameplayTime?.()||0); this.knife=null; this.target=null; }
  shiftTimers(delta,after){
    for(const key of ['nextThrow','nextMelee','until']) if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
    if(['outbound','recall'].includes(this.state)) this.started+=delta;
  }
  pause(){ this.e.body?.setVelocityX?.(0); }
  resume(){}
  destroy(){ this.graphics?.destroy(); this.graphics=null; this.knife=null; this.target=null; this.state='idle'; }
}
