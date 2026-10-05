import { MOUNTAIN_GENERAL_TUNING as GENERAL } from '../../config/enemies.js';
import { getEnemyMoveSpeed } from '../../systems/EnemyGravityControl.js';

const alive = e => e?.active && !e.isDefeated;
const valid = target => target?.isAlive?.() && target.active!==false && !target.isDefeated;
const skillStates = new Set(['windup','sweepPause','charge']);

// Boss 1 in normal mode. Only the actual combo resists knockback.
export default class MountainGeneralBehavior {
  constructor(scene, enemy, helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    this.state='idle'; this.until=0; this.nextAttack=0;
    this.nextSkill=(scene.getGameplayTime?.()||0)+GENERAL.first;
    this.direction=-1; this.chargeDirection=-1; this.previousX=enemy.x;
    this.effectUntil=0; this.chargeHits=new Set();
    this.graphics=scene.add.graphics().setDepth(23);
    this.setState('idle');
  }
  live() { return alive(this.e)&&!!this.graphics&&!this.scene.isGameplayPaused?.(); }
  setState(state) {
    this.state=state;
    const e=this.e;
    e.behaviorState=e.attackState=state;
    e.bossSkillKnockbackImmune=skillStates.has(state);
    e.casting=e.isCasting=state==='windup'||state==='sweepPause';
    e.charging=e.isCharging=e.dashing=e.isDashing=state==='charge';
    e.skillActive=skillStates.has(state);
  }
  readySkill(t) {
    if(t<this.nextSkill||skillStates.has(this.state)||this.state==='recovery')return false;
    const target=this.h.chooseAnyTarget(this.scene,this.e,Infinity);
    if(!valid(target))return false; // No legal target: no cooldown spent.
    this.direction=Math.sign(target.x-this.e.x)||this.direction;
    this.setState('windup'); this.until=t+GENERAL.windup; this.effectUntil=0;
    this.scene.combatSystem?.clearKnockback?.(this.e);
    this.e.body?.setVelocityX?.(0);
    return true;
  }
  finishRecovery(t) {
    if((this.state==='recovery'||this.state==='punchRecovery')&&t>=this.until)this.setState('idle');
  }
  updateWhileKnockedBack(t) {
    if(!this.live())return;
    this.finishRecovery(t);
    this.readySkill(t); // The absolute skill clock survives every ordinary hit.
  }
  sweep(t) {
    const e=this.e,s=this.scene,dir=this.direction,x=e.x,y=e.y;
    this.setState('sweepPause'); this.until=t+GENERAL.pause;
    this.nextSkill=t+this.h.getEnemyAttackDelay(e,GENERAL.cooldown,t);
    this.effectUntil=t+GENERAL.effectMs;
    const targets=s.combatSystem.getAttackableTargets(e).filter(valid);
    for(const target of targets) {
      if(!this.live())break; // Damage callbacks may destroy the caster or scene.
      const forward=(target.x-x)*dir;
      if(!valid(target)||forward<0||forward>GENERAL.sweepRange||Math.abs(target.y-y)>GENERAL.sweepHeight)continue;
      this.h.targetDamage(s,target,e,Math.max(1,Math.round(e.damage*GENERAL.sweepDamageMultiplier)),
        {source:'mountainGeneralSweep',attackType:'melee',singleTarget:false,
          knockbackDistance:GENERAL.sweepKnockback,knockbackDirection:dir});
    }
  }
  startCharge(t) {
    const target=this.h.chooseAnyTarget(this.scene,this.e,Infinity);
    this.chargeDirection=valid(target)?Math.sign(target.x-this.e.x)||this.direction:this.direction;
    this.direction=this.chargeDirection; this.previousX=this.e.x; this.chargeHits.clear();
    this.setState('charge'); this.until=t+GENERAL.chargeDuration;
    this.e.body?.setVelocityX?.(this.chargeDirection*getEnemyMoveSpeed(this.e,GENERAL.chargeSpeed,t));
  }
  charge(t) {
    const e=this.e,s=this.scene,from=this.previousX,to=e.x;
    this.previousX=to;
    e.body?.setVelocityX?.(this.chargeDirection*getEnemyMoveSpeed(e,GENERAL.chargeSpeed,t));
    for(const target of s.combatSystem.getAttackableTargets(e).filter(valid)) {
      if(!this.live())break;
      const key=target.type==='player'?s.player:target.type==='poison_king'?(s.poisonKingRuntime?.get?.()||target):target;
      const closestX=Math.max(Math.min(from,to),Math.min(Math.max(from,to),target.x));
      if(this.chargeHits.has(key)||!valid(target)||Math.hypot(target.x-closestX,target.y-e.y)>GENERAL.chargeRadius)continue;
      this.chargeHits.add(key); // Commit before a death burst can destroy us.
      this.h.targetDamage(s,target,e,Math.max(1,Math.round(e.damage*GENERAL.chargeDamageMultiplier)),
        {source:'mountainGeneralCharge',attackType:'charge',knockbackDistance:0});
    }
    if(this.live()&&t>=this.until)this.recover(t);
  }
  recover(t) {
    this.setState('recovery'); this.until=t+GENERAL.recovery;
    this.nextAttack=Math.max(this.nextAttack,this.until);
    this.chargeHits.clear(); this.e.body?.setVelocityX?.(0);
  }
  punch(t) {
    const e=this.e,target=this.h.chooseTarget(this.scene,e,e.attackRange);
    if(!valid(target)||Math.hypot(e.x-target.x,e.y-target.y)>e.attackRange) {
      this.setState('idle'); this.until=0; return;
    }
    this.direction=Math.sign(target.x-e.x)||this.direction;
    this.setState('punchRecovery'); this.until=t+GENERAL.punchRecovery;
    this.nextAttack=t+this.h.getEnemyAttackDelay(e,e.attackIntervalMs,t);
    this.effectUntil=t+GENERAL.effectMs;
    this.h.targetDamage(this.scene,target,e,e.damage,
      {source:'mountainGeneralPunch',attackType:'melee',knockbackDistance:0});
  }
  update(t) {
    if(!this.live())return;
    const e=this.e,s=this.scene;
    this.finishRecovery(t);
    if(this.readySkill(t)) { this.syncVisual(); return; }
    if(this.state==='idle') {
      this.h.approach(s,e,e.attackRange);
      const target=this.h.chooseTarget(s,e,e.attackRange);
      if(t>=this.nextAttack&&valid(target)) {
        this.direction=Math.sign(target.x-e.x)||this.direction;
        this.setState('punchWindup'); this.until=t+GENERAL.punchWindup;
        e.body?.setVelocityX?.(0);
      }
    } else if(this.state==='charge')this.charge(t);
    else {
      e.body?.setVelocityX?.(0);
      if(t>=this.until) {
        if(this.state==='windup')this.sweep(t);
        else if(this.state==='sweepPause')this.startCharge(t);
        else if(this.state==='punchWindup')this.punch(t);
      }
    }
    this.syncVisual();
  }
  syncVisual() {
    const g=this.graphics,e=this.e;
    if(!g)return;
    g.clear(); if(!alive(e))return;
    const wind=this.state==='windup',charge=this.state==='charge';
    e.setFillStyle?.(wind?0xe8a263:charge?0xd85532:e.baseColor);
    const y=e.y-(wind?44:10),dir=this.direction;
    for(const offset of [-30,30]) {
      const x=e.x+offset;
      g.lineStyle(9,0x713e30,1).lineBetween(e.x+offset*.65,e.y-12,x,y);
      g.lineStyle(4,wind?0xffe1a5:0xd9b393,1).strokeCircle(x,y,13);
    }
    if((this.scene.getGameplayTime?.()||0)<this.effectUntil)
      g.lineStyle(7,0xffcb96,0.9).lineBetween(e.x+dir*38,e.y-32,e.x+dir*(this.state==='sweepPause'?GENERAL.sweepRange:92),e.y+12);
    if(charge)g.lineStyle(5,0xffbb77,0.8).lineBetween(e.x-dir*75,e.y-15,e.x-dir*135,e.y-15);
  }
  interrupt() {
    // Ordinary knockback cancels a pending punch, never the skill clock/recovery.
    this.effectUntil=0;
    if(this.state==='punchWindup') { this.setState('idle'); this.until=0; }
    this.syncVisual();
  }
  onRecycle() {
    if(skillStates.has(this.state))this.recover(this.scene.getGameplayTime?.()||0);
    else if(this.state==='punchWindup')this.setState('idle');
    this.effectUntil=0; this.chargeHits.clear(); this.direction=-1;
    this.graphics?.clear(); this.e.setFillStyle?.(this.e.baseColor);
  }
  shiftTimers(delta,after) {
    for(const key of ['nextSkill','nextAttack','until','effectUntil'])
      if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {
    if(this.state==='charge'&&alive(this.e))this.e.body?.setVelocityX?.(
      this.chargeDirection*getEnemyMoveSpeed(this.e,GENERAL.chargeSpeed,this.scene.getGameplayTime?.()||0));
  }
  destroy() {
    this.graphics?.destroy(); this.graphics=null; this.chargeHits.clear();
    this.setState('idle'); this.effectUntil=0; this.e.body?.setVelocityX?.(0);
    this.e.setFillStyle?.(this.e.baseColor);
  }
}
