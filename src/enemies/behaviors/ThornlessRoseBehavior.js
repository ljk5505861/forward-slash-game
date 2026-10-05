import { THORNLESS_ROSE_TUNING as ROSE } from '../../config/enemies.js';
import { getEnemyMoveSpeed } from '../../systems/EnemyGravityControl.js';
import { syncEnemyUi } from '../../entities/createEnemy.js';

const alive = e => e?.active && !e.isDefeated;
const valid = target => target?.isAlive?.() && target.active!==false && !target.isDefeated;
const skillStates = new Set(['dashWindup','dash','roseWindup','roseThrow','drainWindup','drainThrust']);

// Boss 2 in normal mode. Three independent clocks, one action at a time.
export default class ThornlessRoseBehavior {
  constructor(scene, enemy, helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    const t=scene.getGameplayTime?.()||0;
    this.nextDash=t+ROSE.dashFirst; this.nextRose=t+ROSE.roseFirst; this.nextDrain=t+ROSE.drainFirst;
    this.nextAttack=0; this.until=0; this.state='idle'; this.direction=-1;
    this.previousX=enemy.x; this.dashHits=new Set();
    this.point=null; this.rose=null; this.impact=null; this.flashUntil=0; this.effectUntil=0;
    this.graphics=scene.add.graphics().setDepth(23); this.setState('idle');
  }
  live() { return alive(this.e)&&!!this.graphics&&!this.scene.isGameplayPaused?.(); }
  delay(ms,t) { return this.h.getEnemyAttackDelay(this.e,ms,t); }
  setState(state) {
    this.state=state;
    const e=this.e;
    e.behaviorState=e.attackState=state;
    e.bossSkillKnockbackImmune=skillStates.has(state);
    e.charging=e.isCharging=e.dashing=e.isDashing=state==='dash';
    e.casting=e.isCasting=skillStates.has(state)&&state!=='dash';
    e.skillActive=skillStates.has(state);
  }
  finishRecovery(t) {
    if((this.state==='recovery'||this.state==='attackRecovery')&&t>=this.until)this.setState('idle');
  }
  readySkill(t) {
    if(!['idle','attackWindup','attackRecovery'].includes(this.state)||this.rose)return false;
    const ready=[['dash','nextDash'],['rose','nextRose'],['drain','nextDrain']]
      .filter(([,key])=>t>=this[key]).sort((a,b)=>this[a[1]]-this[b[1]]);
    for(const [skill] of ready) {
      const target=skill==='drain'?this.h.chooseTarget(this.scene,this.e,ROSE.drainRange):this.h.chooseAnyTarget(this.scene,this.e,Infinity);
      if(!valid(target)||(skill==='dash'&&target.x>this.e.x))continue;
      this.direction=skill==='dash'?-1:Math.sign(target.x-this.e.x)||-1;
      this.point=skill==='rose'?{x:target.x,y:target.y}:null;
      this.setState(skill+'Windup'); this.until=t+ROSE[skill+'Windup']; this.effectUntil=0;
      this.scene.combatSystem?.clearKnockback?.(this.e); this.e.body?.setVelocityX?.(0);
      return true;
    }
    return false; // No legal initial target: each cooldown stays available.
  }
  updateWhileKnockedBack(t) {
    if(!this.live())return;
    this.finishRecovery(t); this.readySkill(t);
  }
  recover(t,ms) {
    this.setState('recovery'); this.until=t+ms;
    this.nextAttack=Math.max(this.nextAttack,this.until); this.e.body?.setVelocityX?.(0);
  }
  startDash(t) {
    this.setState('dash'); this.previousX=this.e.x; this.dashHits.clear();
    this.nextDash=t+this.delay(ROSE.dashCooldown,t);
    this.e.body?.setVelocityX?.(-getEnemyMoveSpeed(this.e,ROSE.dashSpeed,t));
  }
  dash(t) {
    const e=this.e,s=this.scene,from=this.previousX,to=e.x; this.previousX=to;
    e.body?.setVelocityX?.(-getEnemyMoveSpeed(e,ROSE.dashSpeed,t));
    for(const target of s.combatSystem.getAttackableTargets(e).filter(valid)) {
      if(!this.live())break;
      const key=target.type==='player'?s.player:target.type==='poison_king'?(s.poisonKingRuntime?.get?.()||target):target;
      const closestX=Math.max(Math.min(from,to),Math.min(Math.max(from,to),target.x));
      if(this.dashHits.has(key)||!valid(target)||Math.hypot(target.x-closestX,target.y-e.y)>ROSE.dashRadius)continue;
      this.dashHits.add(key); // Commit before reflect/kill callbacks.
      this.h.targetDamage(s,target,e,Math.max(1,Math.round(e.damage*ROSE.dashDamageMultiplier)),
        {source:'thornlessRoseDash',attackType:'charge',singleTarget:false,
          knockbackDistance:ROSE.dashKnockback,knockbackDirection:-1});
    }
    // Keep going left after passing the target. The existing recycle boundary ends the dash.
  }
  beforeRecycle(t) { if(this.state==='dash'&&this.live())this.dash(t); }
  throwRose(t) {
    if(!this.point) {this.setState('idle');return;}
    const e=this.e;
    this.rose={...this.point,fromX:e.x+this.direction*24,fromY:e.y-20,
      started:t,landAt:t+ROSE.roseFlight,explodeAt:t+ROSE.roseFlight+ROSE.roseWarning,
      damage:Math.max(1,Math.round(e.damage*ROSE.roseDamageMultiplier))};
    this.point=null; this.setState('roseThrow'); this.until=this.rose.landAt;
    this.nextRose=t+this.delay(ROSE.roseCooldown,t);
  }
  advanceEffects(t) {
    if(!this.live()||!this.rose)return;
    if(this.state==='roseThrow'&&t>=this.rose.landAt)this.setState('roseWait');
    if(t<this.rose.explodeAt)return;
    const point=this.rose; this.rose=null; this.impact={x:point.x,y:point.y}; this.flashUntil=t+ROSE.effectMs;
    this.recover(t,ROSE.roseRecovery); // Consume the effect before any callback.
    for(const target of this.scene.combatSystem.getAttackableTargets(this.e).filter(valid)) {
      if(!this.live())break;
      if(valid(target)&&Math.hypot(target.x-point.x,target.y-point.y)<=ROSE.roseRadius)
        this.h.targetDamage(this.scene,target,this.e,point.damage,
          {source:'thornlessRoseBloom',attackType:'ground',dodgeable:false,singleTarget:false,knockbackDistance:0});
    }
    this.syncVisual();
  }
  stab(t,drain=false) {
    const e=this.e,range=drain?ROSE.drainRange:e.attackRange;
    const target=this.h.chooseTarget(this.scene,e,range);
    if(!valid(target)||Math.hypot(e.x-target.x,e.y-target.y)>range) {
      this.setState('idle'); this.until=0; return; // No hit released: no attack/skill cooldown.
    }
    this.direction=Math.sign(target.x-e.x)||this.direction;
    this.effectUntil=t+ROSE.effectMs;
    if(drain) {
      this.nextDrain=t+this.delay(ROSE.drainCooldown,t);
      this.setState('drainThrust'); this.until=this.effectUntil;
    } else {
      this.nextAttack=t+this.delay(e.attackIntervalMs,t);
      this.setState('attackRecovery'); this.until=t+ROSE.attackRecovery;
    }
    const damage=this.h.targetDamage(this.scene,target,e,Math.max(1,Math.round(e.damage*(drain?ROSE.drainDamageMultiplier:1))),
      {source:drain?'thornlessRoseDrain':'thornlessRoseStab',attackType:'melee',knockbackDistance:0});
    if(drain&&this.live()&&e.hp>0&&damage>0) {
      const before=e.hp; e.hp=Math.min(e.maxHp,e.hp+Math.round(damage*ROSE.drainHealMultiplier));
      const healed=e.hp-before;
      if(healed>0) {syncEnemyUi(e);this.scene.floatText?.(e.x,e.y-85,`+${healed}`,'#ef9cad');}
    }
  }
  update(t) {
    if(!this.live())return;
    this.advanceEffects(t); if(!this.live())return;
    this.finishRecovery(t);
    if(this.readySkill(t)) {this.syncVisual();return;}
    const e=this.e,s=this.scene;
    if(this.state==='dash')this.dash(t);
    else if(this.state==='roseWait')this.h.approach(s,e,e.attackRange);
    else if(this.state==='idle') {
      this.h.approach(s,e,e.attackRange);
      const target=this.h.chooseTarget(s,e,e.attackRange);
      if(t>=this.nextAttack&&valid(target)) {
        this.direction=Math.sign(target.x-e.x)||-1; this.setState('attackWindup');
        this.until=t+ROSE.attackWindup; e.body?.setVelocityX?.(0);
      }
    } else {
      e.body?.setVelocityX?.(0);
      if(t>=this.until) {
        if(this.state==='dashWindup')this.startDash(t);
        else if(this.state==='roseWindup')this.throwRose(t);
        else if(this.state==='drainWindup')this.stab(t,true);
        else if(this.state==='drainThrust')this.recover(t,ROSE.drainRecovery);
        else if(this.state==='attackWindup')this.stab(t);
      }
    }
    this.syncVisual();
  }
  syncVisual() {
    const g=this.graphics,e=this.e;
    if(!g)return;
    g.clear(); if(!alive(e))return;
    const t=this.scene.getGameplayTime?.()||0,dir=this.direction,wind=this.state.endsWith('Windup');
    e.setFillStyle?.(wind?0xe5728a:this.state==='dash'?0xd54168:e.baseColor);
    const y=e.y-18,handX=e.x+dir*(wind?-4:22),extended=t<this.effectUntil;
    const tipX=extended?e.x+dir*ROSE.drainRange:handX+dir*142;
    g.lineStyle(3,0xf8d4da,1).lineBetween(handX,y,tipX,y-10);
    g.lineStyle(4,0x72364b,1).lineBetween(handX-dir*18,y,handX,y);
    g.lineStyle(3,0xdb92a5,1).lineBetween(handX,y-10,handX,y+10);
    if(this.state==='dash')g.lineStyle(5,0xf29bab,0.8).lineBetween(e.x+40,y,e.x+120,y+6);
    if(extended)g.lineStyle(5,0xffa9bc,0.9).lineBetween(e.x+dir*35,y,tipX,y-10);
    if(this.rose) {
      const p=this.rose,u=Math.max(0,Math.min(1,(t-p.started)/ROSE.roseFlight));
      const x=p.fromX+(p.x-p.fromX)*u,y=p.fromY+(p.y-p.fromY)*u;
      g.lineStyle(3,0xf27399,1).strokeCircle(x,y,9).strokeCircle(x-6,y-4,5).strokeCircle(x+6,y-4,5);
      g.lineStyle(4,0xffc0d4,0.85).strokeCircle(p.x,p.y,ROSE.roseRadius);
    }
    if(this.impact&&t<this.flashUntil)g.lineStyle(7,0xff7aab,0.95).strokeCircle(this.impact.x,this.impact.y,ROSE.roseRadius);
  }
  interrupt() {
    this.effectUntil=0;
    if(this.state==='attackWindup') {this.setState('idle');this.until=0;}
    this.syncVisual(); // Released roses keep their fixed location and clock.
  }
  onRecycle() {
    if(this.state==='dash'||this.state==='dashWindup')this.recover(this.scene.getGameplayTime?.()||0,ROSE.dashRecovery);
    else if(this.rose)this.setState('roseWait');
    else if(skillStates.has(this.state))this.recover(this.scene.getGameplayTime?.()||0,ROSE.drainRecovery);
    else if(this.state==='attackWindup')this.setState('idle');
    this.dashHits.clear(); this.effectUntil=0; this.direction=-1; this.point=null;
    this.graphics?.clear(); this.e.setFillStyle?.(this.e.baseColor);
  }
  shiftTimers(delta,after) {
    for(const key of ['nextDash','nextRose','nextDrain','nextAttack','until','effectUntil','flashUntil'])
      if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
    if(this.rose)for(const key of ['started','landAt','explodeAt'])this.rose[key]+=delta;
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() { if(this.state==='dash'&&alive(this.e))this.e.body?.setVelocityX?.(-getEnemyMoveSpeed(this.e,ROSE.dashSpeed,this.scene.getGameplayTime?.()||0)); }
  destroy() {
    this.rose=this.point=this.impact=null; this.dashHits.clear();
    this.graphics?.destroy(); this.graphics=null; this.setState('idle');
    this.effectUntil=this.flashUntil=0; this.e.body?.setVelocityX?.(0); this.e.setFillStyle?.(this.e.baseColor);
  }
}
