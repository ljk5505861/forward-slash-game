import { FORESEER_TUNING as F } from '../../config/enemies.js';
import { viewportBounds, enemyHalfWidth } from '../../systems/TargetingSystem.js';
import { releaseForeseerBinding } from '../../systems/ForeseerBindingControl.js';
import { destroyEnemyStatusIndicators } from '../../ui/EnemyStatusIndicators.js';

const alive=e=>!!(e?.active&&!e.isDefeated&&e.hp>0);
const valid=target=>!!(target?.isAlive?.()&&target.active!==false&&!target.isDefeated);
const skillStates=new Set(['bindWindup','bindRelease','splitWindup','splitRelease','teleportWindup','teleportRelease']);
const segmentDistance=(p,a,b)=>{
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const u=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
};
const targetEntity=(scene,target)=>target?.type==='player'?scene.player:
  target?.type==='poison_king'?scene.poisonKingRuntime?.get?.():target;
const currentEntity=(scene,target,entity)=>{
  if(!valid(target)||!entity)return false;
  if(target.type==='player')return scene.player===entity;
  if(target.type==='poison_king')return scene.poisonKingRuntime?.get?.()===entity;
  if(target.type==='spirit_bird')return scene.spiritBirdRuntime?.getAttackTarget?.()===entity;
  if(target.type==='spiritWolf')return scene.skillSystem?.passiveState?.spiritWolves?.wolves?.includes(entity);
  if(target.type==='mantraAlly')return scene.skillSystem?.passiveState?.mantraHeavenlyBook?.absorb?.ally===entity;
  return false;
};

function removeOrb(scene,orb) {
  if(!orb||orb.isDefeated)return;
  orb.isDefeated=true;orb.lockedAttackTarget=null;
  scene.combatSystem?.clearKnockback?.(orb);scene.enemyBehaviors?.destroyEnemy?.(orb);
  scene.statusEffects?.clearTarget?.(orb);destroyEnemyStatusIndicators(orb);
  scene.enemies=scene.enemies.filter(e=>e!==orb);
  [orb.hpBarBg,orb.hpBar,orb.nameText,orb.levelText,orb].forEach(view=>view?.destroy?.());
}

class MeatBallBeamBehavior {
  constructor(scene,enemy,helpers) {
    this.scene=scene;this.e=enemy;this.h=helpers;this.state='idle';this.until=0;
    this.nextAttack=0;this.beam=null;this.flash=null;this.flashUntil=0;this.direction=-1;
    this.graphics=scene.add.graphics().setDepth(23);this.setState('idle');
  }
  live() {return alive(this.e)&&!!this.graphics&&!this.scene.isGameplayPaused?.();}
  delay(ms,t) {return this.h.getEnemyAttackDelay(this.e,ms,t);}
  setState(state) {
    this.state=state;const e=this.e;
    e.behaviorState=e.attackState=state;e.bossSkillKnockbackImmune=!!(e.isBoss&&skillStates.has(state));
    e.casting=e.isCasting=e.skillActive=e.bossSkillKnockbackImmune;
    e.charging=e.isCharging=e.dashing=e.isDashing=false;
  }
  ball() {return {x:this.e.x+this.direction*(this.e.isBoss?28:0),y:this.e.y};}
  prepareBeam(t) {
    const target=this.h.chooseTarget(this.scene,this.e,this.e.attackRange);
    if(!valid(target))return false;
    this.direction=Math.sign(target.x-this.e.x)||-1;
    const from=this.ball(),dx=target.x-from.x,dy=target.y-from.y,d=Math.hypot(dx,dy)||1;
    this.beam={from,to:{x:from.x+dx/d*this.e.attackRange,y:from.y+dy/d*this.e.attackRange}};
    this.setState('attackWindup');this.until=t+F.beamWindup;this.e.body?.setVelocityX?.(0);return true;
  }
  fireBeam(t) {
    const beam=this.beam;this.beam=null;
    if(!beam){this.setState('idle');return;}
    const targets=this.scene.combatSystem.getAttackableTargets(this.e).filter(valid)
      .filter(target=>segmentDistance(target,beam.from,beam.to)<=F.beamRadius)
      .sort((a,b)=>Math.hypot(a.x-beam.from.x,a.y-beam.from.y)-Math.hypot(b.x-beam.from.x,b.y-beam.from.y));
    this.flash=beam;this.flashUntil=t+F.flash;
    this.setState('attackRecovery');this.until=t+F.attackRecovery;
    if(!targets.length)return; // A lost/empty ray does not spend the attack clock.
    this.nextAttack=t+this.delay(this.e.attackIntervalMs,t);
    this.h.targetDamage(this.scene,targets[0],this.e,this.e.damage,
      {source:this.e.isBoss?'foreseerBeam':'foreseerOrbBeam',attackType:'projectile',knockbackDistance:0});
  }
  finishRecovery(t) {
    if(['recovery','attackRecovery'].includes(this.state)&&t>=this.until)this.setState('idle');
  }
  updateBeam(t) {
    if(this.state==='idle') {
      this.h.approach(this.scene,this.e,this.e.attackRange,this.e.preferredRange);
      if(t>=this.nextAttack)this.prepareBeam(t);
    } else {
      this.e.body?.setVelocityX?.(0);
      if(this.state==='attackWindup'&&t>=this.until)this.fireBeam(t);
    }
  }
  advanceEffects(t) {if(this.flash&&t>=this.flashUntil)this.flash=null;}
  syncVisual() {
    const g=this.graphics,e=this.e;if(!g)return;
    g.clear();if(!alive(e))return;
    const p=this.ball(),wind=this.state.endsWith('Windup'),r=e.isBoss?22:14;
    e.setFillStyle?.(wind?0xa88b9f:e.baseColor);
    if(e.isBoss)g.lineStyle(5,0xb39ba7,1).lineBetween(e.x,p.y+22,p.x,p.y);
    g.lineStyle(4,wind?0xffd3ed:0xec9fbd,1).strokeCircle(p.x,p.y,this.state==='teleportWindup'?r*.65:r);
    g.lineStyle(3,0x421d37,1).strokeCircle(p.x+this.direction*5,p.y,5);
    if(this.beam)g.lineStyle(2,0xdc96c1,.55)
      .lineBetween(this.beam.from.x,this.beam.from.y,this.beam.to.x,this.beam.to.y);
    if(this.flash)g.lineStyle(8,0xffc5e3,1)
      .lineBetween(this.flash.from.x,this.flash.from.y,this.flash.to.x,this.flash.to.y);
  }
  interrupt() {
    if(this.state==='attackWindup'){this.beam=null;this.setState('idle');this.until=0;}
    this.syncVisual();
  }
  shiftTimers(delta,after) {
    for(const key of ['nextAttack','until','flashUntil'])if(this[key]>after)this[key]+=delta;
  }
  pause() {this.e.body?.setVelocityX?.(0);}
  resume() {}
  destroy() {
    this.beam=this.flash=null;this.graphics?.destroy();this.graphics=null;
    this.e.setFillStyle?.(this.e.baseColor);this.setState('idle');this.e.body?.setVelocityX?.(0);
  }
}

export default class ForeseerBehavior extends MeatBallBeamBehavior {
  constructor(scene,enemy,helpers) {
    super(scene,enemy,helpers);const t=scene.getGameplayTime?.()||0;
    for(const name of ['Bind','Split','Teleport'])this['next'+name]=t+F[name.toLowerCase()+'First'];
    this.bindTarget=null;this.bindings=[];this.effectUntil=0;
  }
  orbs() {return this.scene.enemies.filter(e=>alive(e)&&e.foreseerOwner===this.e);}
  room() {return Math.min(F.orbCap-this.orbs().length,
    this.scene.balance.enemyPopulation.hardCap-this.scene.stageSystem.activeEnemyCount());}
  teleportPosition() {
    const s=this.scene,e=this.e,b=viewportBounds(s.cameras?.main),half=enemyHalfWidth(e);
    const min=Math.max(b.left+b.width*.6,(s.player?.x??b.left)+F.teleportPlayerGap+half,half+8);
    const max=Math.min(b.right-half-8,s.balance.stageWorldWidth-half-8);
    if(min>max)return null;
    return [max,min].find(x=>Math.abs(x-e.x)>=F.teleportMinDistance)??null;
  }
  readySkill(t) {
    if(!['idle','attackWindup','attackRecovery'].includes(this.state))return false;
    const names=['Bind','Split','Teleport'].filter(name=>t>=this['next'+name])
      .sort((a,b)=>this['next'+a]-this['next'+b]);
    for(const name of names) {
      const key=name.toLowerCase(),target=this.h.chooseAnyTarget(this.scene,this.e,key==='bind'?F.bindRange:Infinity);
      if(!valid(target)||(key==='split'&&this.room()<2)||(key==='teleport'&&this.teleportPosition()===null))continue;
      this.bindTarget=key==='bind'?target:null;this.direction=Math.sign(target.x-this.e.x)||-1;
      this.beam=null;this.flash=null;this.effectUntil=0;
      this.setState(key+'Windup');this.until=t+F[key+'Windup'];
      this.scene.combatSystem?.clearKnockback?.(this.e);this.e.body?.setVelocityX?.(0);return true;
    }
    return false;
  }
  updateWhileKnockedBack(t) {if(this.live()){this.finishRecovery(t);this.readySkill(t);}}
  failSkill() {this.bindTarget=null;this.setState('idle');this.until=0;}
  releaseBind(t) {
    const target=this.bindTarget;this.bindTarget=null;const entity=targetEntity(this.scene,target);
    if(!currentEntity(this.scene,target,entity)||Math.hypot(target.x-this.e.x,target.y-this.e.y)>F.bindRange)
      return this.failSkill();
    this.nextBind=t+this.delay(F.bindCooldown,t);this.effectUntil=t+F.flash;
    this.setState('bindRelease');this.until=t+F.flash;
    const damage=this.h.targetDamage(this.scene,target,this.e,Math.max(1,Math.round(this.e.damage*F.bindDamageMultiplier)),
      {source:'foreseerBind',attackType:'spell',knockbackDistance:0});
    if(damage>0&&this.live()&&currentEntity(this.scene,target,entity)) {
      const binding={owner:this.e,entity,target,endAt:t+F.bindDuration};
      entity.foreseerBinding=binding;this.bindings.push(binding);entity.body?.setVelocityX?.(0);
    }
  }
  releaseSplit(t) {
    if(this.room()<2||!valid(this.h.chooseAnyTarget(this.scene,this.e,Infinity)))return this.failSkill();
    let count=0;
    for(const offset of [-60,60]) {
      if(!this.live()||this.room()<=0)break;
      const x=Math.max(26,Math.min(this.scene.balance.stageWorldWidth-26,this.e.x+offset));
      const orb=this.scene.stageSystem.spawn('foreseer_orb',x);
      if(orb){orb.foreseerOwner=this.e;orb.foreseerExpiresAt=t+F.orbDuration;
        orb.body?.reset?.(x,this.e.y+18);orb.noGoldReward=true;count++;}
    }
    if(!this.live())return;
    if(!count)return this.failSkill();
    this.nextSplit=t+this.delay(F.splitCooldown,t);this.effectUntil=t+F.flash;
    this.setState('splitRelease');this.until=t+F.flash;
  }
  releaseTeleport(t) {
    const x=this.teleportPosition();
    if(x===null||!valid(this.h.chooseAnyTarget(this.scene,this.e,Infinity)))return this.failSkill();
    this.nextTeleport=t+this.delay(F.teleportCooldown,t);this.bindTarget=null;this.beam=null;
    this.setState('teleportRelease');this.until=t+F.flash;this.effectUntil=t+F.flash;
    this.e.body?.reset?.(x,this.e.y);this.e.body?.setVelocityX?.(0);this.e.lockedAttackTarget=null;
  }
  advanceEffects(t) {
    if(!this.live())return;
    super.advanceEffects(t);
    this.bindings=this.bindings.filter(binding=>{
      if(binding.endAt>t&&currentEntity(this.scene,binding.target,binding.entity)
        &&binding.entity.foreseerBinding===binding)return true;
      releaseForeseerBinding(binding);return false;
    });
  }
  update(t) {
    if(!this.live())return;
    this.advanceEffects(t);this.finishRecovery(t);
    if(this.readySkill(t)){this.syncVisual();return;}
    if(this.state==='bindWindup'&&t>=this.until)this.releaseBind(t);
    else if(this.state==='splitWindup'&&t>=this.until)this.releaseSplit(t);
    else if(this.state==='teleportWindup'&&t>=this.until)this.releaseTeleport(t);
    else if(['bindRelease','splitRelease','teleportRelease'].includes(this.state)&&t>=this.until) {
      const key=this.state.replace('Release','');this.setState('recovery');this.until=t+F[key+'Recovery'];
    } else this.updateBeam(t);
    this.syncVisual();
  }
  syncVisual() {
    super.syncVisual();const g=this.graphics;if(!g||!alive(this.e))return;
    if(this.state==='bindWindup'&&valid(this.bindTarget))g.lineStyle(3,0xeaaaee,.85)
      .strokeCircle(this.bindTarget.x,this.bindTarget.y,30);
    for(const binding of this.bindings||[])if(valid(binding.target)) {
      const p=binding.target;g.lineStyle(4,0xcf87c1,.9).strokeCircle(p.x,p.y,28)
        .lineBetween(p.x-24,p.y+20,p.x+24,p.y-20).lineBetween(p.x-24,p.y-20,p.x+24,p.y+20);
    }
    if(this.state==='splitWindup'||this.state==='splitRelease')for(const dx of [-60,60])
      g.lineStyle(3,0xf1aecf,.85).strokeCircle(this.e.x+dx,this.e.y+18,18);
    if(this.state==='teleportWindup') {
      const x=this.teleportPosition();if(x!==null)g.lineStyle(3,0xcabbec,.85).strokeCircle(x,this.e.y,30);
    } else if(this.state==='teleportRelease')g.lineStyle(5,0xded0f5,.9).strokeCircle(this.e.x,this.e.y,36);
  }
  onRecycle() {
    this.beam=this.flash=null;this.bindTarget=null;this.effectUntil=0;
    if(skillStates.has(this.state)){this.setState('recovery');this.until=(this.scene.getGameplayTime?.()||0)+F.teleportRecovery;}
    else if(this.state==='attackWindup')this.setState('idle');
    this.graphics?.clear(); // Released orbs and remaining binding durations are not renewed.
  }
  shiftTimers(delta,after) {
    super.shiftTimers(delta,after);
    for(const key of ['nextBind','nextSplit','nextTeleport','effectUntil'])if(this[key]>after)this[key]+=delta;
    for(const binding of this.bindings)if(binding.endAt>after)binding.endAt+=delta;
  }
  destroy() {
    for(const binding of this.bindings)releaseForeseerBinding(binding);
    this.bindings=[];this.bindTarget=null;
    for(const orb of this.orbs())removeOrb(this.scene,orb);
    super.destroy();
  }
}

export class ForeseerOrbBehavior extends MeatBallBeamBehavior {
  constructor(scene,enemy,helpers) {
    super(scene,enemy,helpers);enemy.noGoldReward=true;
    this.nextAttack=(scene.getGameplayTime?.()||0)+F.orbFirst;
  }
  advanceEffects(t) {
    if(!this.live())return;
    if(!alive(this.e.foreseerOwner)||t>=this.e.foreseerExpiresAt){removeOrb(this.scene,this.e);return;}
    super.advanceEffects(t);
  }
  update(t) {
    if(!this.live())return;this.advanceEffects(t);if(!this.live())return;
    this.finishRecovery(t);this.updateBeam(t);this.syncVisual();
  }
  onRecycle() {this.beam=this.flash=null;if(this.state==='attackWindup')this.setState('idle');this.graphics?.clear();}
  shiftTimers(delta,after) {super.shiftTimers(delta,after);if(this.e.foreseerExpiresAt>after)this.e.foreseerExpiresAt+=delta;}
  destroy() {delete this.e.foreseerOwner;super.destroy();}
}
