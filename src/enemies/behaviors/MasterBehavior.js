import { MASTER_TIMING } from '../../config/enemies.js';
const alive = e => e?.active && !e.isDefeated;
const segmentDistance = (target,a,b) => {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const u=length?Math.max(0,Math.min(1,((target.x-a.x)*dx+(target.y-a.y)*dy)/length)):0;
  return Math.hypot(target.x-a.x-u*dx,target.y-a.y-u*dy);
};

export default class MasterBehavior {
  constructor(scene,enemy,helpers) {
    this.scene=scene;this.e=enemy;this.h=helpers;
    this.state='idle';this.nextWave=null;this.nextMelee=0;
    this.wave=null;this.target=null;this.graphics=scene.add.graphics().setDepth(23);
  }
  hand() { return {x:this.e.x-this.e.width*0.4,y:this.e.y-8}; }
  syncVisual() {
    if(!this.graphics||!alive(this.e))return;
    const g=this.graphics,p=this.hand();g.clear();
    g.lineStyle(5,this.state==='windup'?0xffdd88:0xd8dce5,1).lineBetween(p.x+6,p.y+18,p.x-12,p.y-36);
    g.lineStyle(6,0x64432f,1).lineBetween(p.x+6,p.y+18,p.x+10,p.y+30);
    if(this.wave){
      const w=this.wave,dx=this.to.x-this.from.x,dy=this.to.y-this.from.y,length=Math.hypot(dx,dy)||1;
      const ux=dx/length,uy=dy/length;
      g.lineStyle(5,0xcbbcff,0.95)
        .lineBetween(w.x-ux*10-uy*24,w.y-uy*10+ux*24,w.x+ux*8,w.y+uy*8)
        .lineBetween(w.x+ux*8,w.y+uy*8,w.x-ux*10+uy*24,w.y-uy*10-ux*24);
    }
  }
  delay(ms,t) { return this.h.getEnemyAttackDelay(this.e,ms,t); }
  finish(t) {
    this.state='idle';this.wave=null;this.target=null;
    this.nextWave=t+this.delay(MASTER_TIMING.cooldown,t);
    this.nextMelee=t+this.delay(this.e.attackIntervalMs,t);
  }
  interrupt(t) { if(this.state!=='idle'){this.finish(t);this.syncVisual();} }
  update(t) {
    if(!alive(this.e)||!this.graphics)return;
    const e=this.e,s=this.scene;
    if(this.nextWave===null)this.nextWave=t+MASTER_TIMING.first;
    if(this.state==='idle'){
      this.h.approach(s,e,e.attackRange);
      const target=this.h.chooseAnyTarget(s,e,MASTER_TIMING.range);
      if(t>=this.nextWave&&target?.isAlive?.()){
        this.state='windup';this.target=target;this.until=t+MASTER_TIMING.windup;e.body?.setVelocityX?.(0);
      }else{
        const victim=this.h.chooseTarget(s,e,e.attackRange);
        if(victim?.isAlive?.()&&t>=this.nextMelee){
          this.nextMelee=t+this.delay(e.attackIntervalMs,t);
          this.h.targetDamage(s,victim,e,e.damage,{source:'masterMelee',knockbackDistance:0});
        }
      }
    }else{
      e.body?.setVelocityX?.(0);
      if(this.state==='windup'&&t>=this.until){
        if(!this.target?.isAlive?.()){this.finish(t);return;}
        const from=this.hand(),dx=this.target.x-from.x,dy=this.target.y-from.y,length=Math.hypot(dx,dy)||1;
        this.from=from;this.to={x:from.x+dx/length*MASTER_TIMING.range,y:from.y+dy/length*MASTER_TIMING.range};
        this.wave={...from};this.target=null;this.started=t;this.state='wave';
      }else if(this.state==='wave'){
        const fraction=Math.min(1,(t-this.started)/MASTER_TIMING.flight),previous=this.wave;
        this.wave={x:this.from.x+(this.to.x-this.from.x)*fraction,y:this.from.y+(this.to.y-this.from.y)*fraction};
        const targets=s.combatSystem.getAttackableTargets(e).filter(target=>target.isAlive?.()&&segmentDistance(target,previous,this.wave)<=22);
        targets.sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y));
        if(targets.length||fraction>=1){
          const victim=targets[0];this.finish(t); // Safe before synchronous reflect/death callbacks.
          if(victim)this.h.targetDamage(s,victim,e,Math.round(e.damage*MASTER_TIMING.damageMultiplier),{source:'masterWave',attackType:'projectile',knockbackDistance:0});
        }
      }
    }
    this.syncVisual();
  }
  onRecycle() { this.state='idle';this.wave=null;this.target=null;this.nextWave=null;this.nextMelee=0;this.graphics?.clear(); }
  shiftTimers(delta,after) {
    for(const key of ['nextWave','nextMelee','until'])if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
    if(this.state==='wave')this.started+=delta;
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() { this.graphics?.destroy();this.graphics=null;this.wave=null;this.target=null;this.state='idle'; }
}
