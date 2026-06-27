import Phaser from 'phaser';

const alive = e => e?.active && !e.isDefeated;
const knockbackActive = e => !!e?.isKnockbackActive;
const syncBossSkillState = (scene, enemy, state) => { if(!enemy?.isBoss) return; const previous=enemy.behaviorState; enemy.behaviorState=state; enemy.attackState=state; enemy.charging=state==='charge'; enemy.isCharging=state==='charge'; enemy.dashing=state==='charge'; enemy.isDashing=state==='charge'; enemy.casting=['windup','slamWind','skillActive','recovery','cool'].includes(state); enemy.isCasting=enemy.casting; enemy.skillActive=['charge','slamWind','skillActive','recovery','cool'].includes(state); if(previous!==state && state!=='idle') scene.combatSystem?.clearKnockback?.(enemy); };
const playerDamage = (scene, enemy, amount, meta={}) => scene.combatSystem?.damagePlayer?.(enemy, amount, meta);
const targetDamage = (scene, target, enemy, amount, meta={}) => scene.combatSystem?.damageAttackTarget?.(target, amount, { enemy, source:'enemyMelee', attackType:'melee', dodgeable:true, ...meta });
const chooseTarget = (scene, enemy, range=enemy.attackRange, options={}) => scene.combatSystem?.chooseEnemyAttackTarget?.(enemy, range, options);
const chooseAnyTarget = (scene, enemy, range=Infinity, options={}) => scene.combatSystem?.getAttackableTargets?.(enemy, options).filter(t=>t.isAlive?.()).map(t=>({target:t,distance:Math.hypot(enemy.x-t.x,enemy.y-t.y)})).filter(x=>x.distance<=range).sort((a,b)=>a.distance-b.distance)[0]?.target||null;
const lockCharge = (scene, enemy, target, speed, duration, now) => {
  const tx=target?.x ?? scene.player.x, ty=target?.y ?? scene.player.y;
  return { target, targetType:target?.type||'player', initialX:tx, initialY:ty, direction:Math.sign(tx-enemy.x||1), targetX:tx, targetY:ty, endAt:now+duration, speed };
};
const chargeHit = (scene, enemy, lock, radius, amount) => {
  if(!lock?.target?.isAlive?.()) return false;
  if(Math.hypot(enemy.x-lock.target.x,enemy.y-lock.target.y)>radius) return false;
  targetDamage(scene,lock.target,enemy,amount,{attackType:'charge'});
  return true;
};
export const approach = (scene, enemy, min=enemy.attackRange, max=null) => { if(!alive(enemy)||!enemy.body||knockbackActive(enemy)) return; const target=chooseAnyTarget(scene,enemy,Infinity)||scene.combatSystem?.getPlayerAttackTarget?.(); const dx=(target?.x??scene.player.x)-enemy.x; const dy=(target?.y??scene.player.y??enemy.y)-enemy.y; const d=Math.hypot(dx,dy); const sp=enemy.speed||40; const buffer=enemy.rangeBuffer ?? scene.balance.enemies?.rangeBuffer ?? 24; if(max){ if(d>max+buffer) enemy.body.setVelocityX(Math.sign(dx||1)*sp); else if(d<max-buffer) enemy.body.setVelocityX(-Math.sign(dx||1)*sp); else enemy.body.setVelocityX(0); return; } if(d>min) enemy.body.setVelocityX(Math.sign(dx||1)*sp); else enemy.body.setVelocityX(0); };
export const entryMove = (_scene, enemy) => { if(alive(enemy)&&enemy.body&&!knockbackActive(enemy)) enemy.body.setVelocityX(-(enemy.speed||40)); };
export const resetBodyPosition = (enemy,x,y=enemy.y) => { if(enemy.body?.reset) enemy.body.reset(x,y); else { enemy.x=x; enemy.y=y; } enemy.body?.setVelocityX?.(0); };

class ChargerBehavior {
  constructor(scene,e){ this.scene=scene; this.e=e; this.state='idle'; this.next=0; this.hit=false; this.chargeLock=null; this.chargeDirection=0; this.chargeTargetX=0; }
  onRecycle(){ this.state='idle'; syncBossSkillState(this.scene,this.e,this.state); this.hit=false; this.chargeLock=null; this.chargeDirection=0; this.chargeTargetX=0; this.e.setFillStyle?.(this.e.baseColor); }
  finishCharge(t){ const e=this.e,s=this.scene; e.body?.setVelocityX?.(0); e.setFillStyle?.(e.baseColor); this.state='cooldown'; syncBossSkillState(s,e,this.state); this.next=t+1500; this.hit=true; }
  update(t){ const e=this.e,s=this.scene; if(!alive(e)) return; syncBossSkillState(s,e,this.state); if(knockbackActive(e)){ e.body?.setVelocityX?.(0); return; }
    if(this.state==='windup'&&t>=this.next){ const target=chooseAnyTarget(s,e,e.chargeTriggerRange||330); if(!target){ this.state='idle'; return; } this.state='charge'; syncBossSkillState(s,e,this.state); this.hit=false; this.chargeLock=lockCharge(s,e,target,360,520,t); this.chargeDirection=this.chargeLock.direction; this.chargeTargetX=this.chargeLock.targetX; this.end=this.chargeLock.endAt; e.setFillStyle(0xff3b1f); e.body.setVelocityX(this.chargeDirection*360); }
    else if(this.state==='charge'){ const crossed=this.chargeDirection<0?e.x<=this.chargeTargetX:e.x>=this.chargeTargetX; if(!this.hit&&(chargeHit(s,e,this.chargeLock,70,e.chargeDamage||e.damage*2)||crossed)){ this.hit=true; if(crossed&&!this.chargeLock?.target?.isAlive?.()){} this.finishCharge(t); } else if(t>=this.end) this.finishCharge(t); }
    else if(this.state==='cooldown'&&t>=this.next){ this.state='idle'; syncBossSkillState(s,e,this.state); }
    if(this.state==='idle'){ approach(s,e,e.attackRange); if(t>=this.next&&chooseAnyTarget(s,e,e.chargeTriggerRange||330)){ this.state='windup'; syncBossSkillState(s,e,this.state); this.next=t+(e.chargeWindupMs||520); e.setFillStyle(0xfff1a8); e.body?.setVelocityX?.(0); } }
  }
  shiftTimers(d,a){ if(this.next>a)this.next+=d; if(this.end>a)this.end+=d; }
  pause(){ this.savedVelocityX=this.e.body?.velocity?.x||0; this.e.body?.setVelocityX(0); }
  resume(){ if(this.state==='charge'&&this.e.body) this.e.body.setVelocityX((this.chargeDirection||1)*360); }
  destroy(){}
}

class BomberBehavior {
  constructor(scene,e){ this.scene=scene; this.e=e; this.next=0; this.bombs=[]; }
  onRecycle(){ this.destroy(); this.next=0; }
  update(t){ const e=this.e,s=this.scene; if(!alive(e)) return; syncBossSkillState(s,e,this.state); if(knockbackActive(e)){ e.body?.setVelocityX?.(0); return; } approach(s,e,e.attackRange,e.preferredRange); const hasPendingBomb=this.bombs.some(b=>!b.exploded); if(chooseTarget(s,e,e.attackRange)&&t>=this.next&&!hasPendingBomb){ this.next=t+(e.attackIntervalMs||1800); this.drop(t); }
    this.bombs=this.bombs.filter(b=>{ if(!b.warn?.active)return false; if(!b.exploded&&t>=b.explodeAt){ b.exploded=true; b.warn.setFillStyle(0xff4d4d,0.45); s.combatSystem.damageTargetsInRadius(b.x,b.y,b.radius,e.bombDamage||3,{ enemy:e, source:'bomb', attackType:'bomb', dodgeable:false }); b.destroyAt=t+160; } if(b.destroyAt&&t>=b.destroyAt){ b.warn.destroy(); return false; } return true; });
  }
  drop(t){ const target=chooseTarget(this.scene,this.e,this.e.attackRange)||this.scene.combatSystem.getPlayerAttackTarget(); const x=target.x,y=target.y; const radius=72; const warn=this.scene.add.circle(x,y,radius,0xffcc00,0.22).setStrokeStyle(4,0xfff3a3,0.9).setDepth(19); this.bombs.push({x,y,radius,warn,explodeAt:t+(this.e.bombWarningMs||1050),exploded:false}); }
  shiftTimers(d,a){ if(this.next>a)this.next+=d; this.bombs.forEach(b=>{ if(b.explodeAt>a)b.explodeAt+=d; if(b.destroyAt>a)b.destroyAt+=d; }); }
  pause(){ this.savedVelocityX=this.e.body?.velocity?.x||0; this.e.body?.setVelocityX(0); }
  resume(){}
  destroy(){ this.bombs.forEach(b=>b.warn?.destroy()); this.bombs=[]; }
}

class HealerBehavior {
  constructor(scene,e){ this.scene=scene; this.e=e; this.next=0; this.fx=[]; }
  onRecycle(){ this.next=0; }
  update(t){ const e=this.e,s=this.scene; if(!alive(e)) return; syncBossSkillState(s,e,this.state); if(knockbackActive(e)){ e.body?.setVelocityX?.(0); return; } approach(s,e,e.attackRange,e.preferredRange); if(t<this.next)return; this.next=t+(e.attackIntervalMs||2200); const targets=s.enemies.filter(x=>alive(x)&&x!==e&&x.hp<x.maxHp&&Phaser.Math.Distance.Between(x.x,x.y,e.x,e.y)<520).sort((a,b)=>(b.isBoss?4:b.isElite?3:b.enemyId==='armored_guard'?2:1)-(a.isBoss?4:a.isElite?3:a.enemyId==='armored_guard'?2:1)); const target=targets[0]; if(target){ const before=target.hp; target.hp=Math.min(target.maxHp,target.hp+(e.healAmount||20)); s.floatText(target.x,target.y-70,`+${target.hp-before}`,'#5cff8d'); const line=s.add.line(0,0,e.x,e.y-40,target.x,target.y-55,0x58ff8a,0.9).setOrigin(0).setDepth(23); s.tweens.add({targets:line,alpha:0,duration:360,onComplete:()=>line.destroy()}); } else if(Math.hypot(e.x-s.player.x,e.y-s.player.y)<e.attackRange) playerDamage(s,e,Math.max(1,Math.round(e.damage*0.7)),{source:'healerFallback',attackType:'healer'}); }
  shiftTimers(d,a){ if(this.next>a)this.next+=d; }
  pause(){ this.savedVelocityX=this.e.body?.velocity?.x||0; this.e.body?.setVelocityX(0); }
  resume(){}
  destroy(){}
}

class MidBossBehavior {
  constructor(scene,e){ this.scene=scene; this.e=e; this.next=0; this.state='idle'; this.hit=false; this.warn=null; this.chargeDirection=0; this.chargeTargetX=0; this.chargeLock=null; this.slamCenterX=0; this.slamCenterY=0; }
  onRecycle(){ this.warn?.destroy(); this.warn=null; this.state='idle'; this.hit=false; this.chargeDirection=0; this.chargeTargetX=0; this.chargeLock=null; }
  finishCharge(t){ const e=this.e,s=this.scene; e.body?.setVelocityX?.(0); this.state='cool'; syncBossSkillState(s,e,this.state); this.next=t+1200; }
  update(t){ const e=this.e,s=this.scene; if(!alive(e))return; syncBossSkillState(s,e,this.state); if(knockbackActive(e)){ e.body?.setVelocityX?.(0); return; } if(!e.enraged&&e.hp<=e.maxHp/2){ e.enraged=true; e.attackIntervalMs=e.enragedAttackIntervalMs; e.setFillStyle(0xb91c1c); s.hud?.setStatus('铁甲暴君进入狂暴状态'); }
    if(this.state==='slamWind'&&t>=this.fireAt){ s.combatSystem.damageTargetsInRadius(this.slamCenterX,this.slamCenterY,160,e.slamDamage||18,{ enemy:e, source:'midBossSlam', attackType:'ground', dodgeable:false }); this.warn?.destroy(); this.warn=null; this.state='cool'; this.next=t+(e.enraged?1050:1350); }
    else if(this.state==='charge'){ const crossed=this.chargeDirection<0?e.x<=this.chargeTargetX:e.x>=this.chargeTargetX; if(!this.hit&&(chargeHit(s,e,this.chargeLock,105,e.chargeDamage||24)||crossed)){ this.hit=true; this.finishCharge(t); } else if(t>=this.end) this.finishCharge(t); }
    else if(this.state==='cool'&&t>=this.next)this.state='idle';
    if(this.state==='idle'){ const target=chooseAnyTarget(s,e,Infinity); if(target&&Math.hypot(e.x-target.x,e.y-target.y)>145) approach(s,e,145); else e.body.setVelocityX(0); if(t>=this.next){ if(Math.random()<0.55){ const slamTarget=chooseAnyTarget(s,e,Infinity)||s.combatSystem.getPlayerAttackTarget(); this.slamCenterX=slamTarget.x; this.slamCenterY=slamTarget.y; this.warn=s.add.circle(this.slamCenterX,this.slamCenterY,160,0xff3333,0.18).setStrokeStyle(5,0xffdddd,0.9).setDepth(18); this.state='slamWind'; syncBossSkillState(s,e,this.state); this.fireAt=t+760; e.body.setVelocityX(0); } else { const chargeTarget=chooseAnyTarget(s,e,Infinity)||s.combatSystem.getPlayerAttackTarget(); this.state='charge'; syncBossSkillState(s,e,this.state); this.hit=false; this.chargeLock=lockCharge(s,e,chargeTarget,285,620,t); this.end=this.chargeLock.endAt; this.chargeDirection=this.chargeLock.direction; this.chargeTargetX=this.chargeLock.targetX; e.body.setVelocityX(this.chargeDirection*285); } } }
  }
  shiftTimers(d,a){ ['next','fireAt','end'].forEach(k=>{if(this[k]>a)this[k]+=d;}); }
  pause(){ this.savedVelocityX=this.e.body?.velocity?.x||0; this.e.body?.setVelocityX(0); }
  resume(){ if(this.state==='charge'&&this.e.body) this.e.body.setVelocityX((this.chargeDirection||1)*285); }
  destroy(){ this.warn?.destroy(); }
}

class BerserkerBossBehavior {
  constructor(scene,e){ this.scene=scene; this.e=e; this.state='idle'; this.nextChargeAt=0; this.nextMeleeAt=0; this.windupUntil=0; this.recoverUntil=0; this.chargeEndAt=0; this.hit=false; this.chargeDirection=-1; this.chargeTargetX=0; this.chargeLock=null; this.warn=null; }
  onRecycle(){ this.warn?.destroy(); this.warn=null; this.state='idle'; this.hit=false; this.nextMeleeAt=0; this.chargeTargetX=0; this.chargeLock=null; this.e.setFillStyle?.(this.e.baseColor); this.e.setScale?.(1); }
  finishCharge(t){ const e=this.e,s=this.scene; e.body?.setVelocityX?.(0); this.state='recovery'; syncBossSkillState(s,e,this.state); this.recoverUntil=t+(e.chargeRecoveryMs||800); e.setFillStyle(0x92400e); }
  update(t){ const e=this.e,s=this.scene;if(!alive(e))return; syncBossSkillState(s,e,this.state); if(knockbackActive(e)){ e.body?.setVelocityX?.(0); return; } if(!this.nextChargeAt) this.nextChargeAt=t+(e.chargeCooldownMs||4000);
    if(this.state==='windup'){ e.body.setVelocityX(0); const flash=Math.floor(t/120)%2===0; e.setFillStyle(flash?0xfff1a8:e.baseColor); e.setScale(flash?1.08:1); if(t>=this.windupUntil){ this.state='charge'; syncBossSkillState(s,e,this.state); this.hit=false; this.warn?.destroy(); this.warn=null; e.setFillStyle(0xff3b1f); e.setScale(1); const selected=this.chargeLock?.target&&this.chargeLock.target.isAlive()?this.chargeLock.target:(chooseAnyTarget(s,e,Infinity)||s.combatSystem.getPlayerAttackTarget()); this.chargeLock=lockCharge(s,e,selected,e.chargeSpeed||((e.speed||80)*3),520,t); this.chargeDirection=this.chargeLock.direction; this.chargeTargetX=this.chargeLock.targetX; e.body.setVelocityX(this.chargeDirection*this.chargeLock.speed); this.chargeEndAt=this.chargeLock.endAt; } return; }
    if(this.state==='charge'){ const crossed=this.chargeDirection<0?e.x<=this.chargeTargetX:e.x>=this.chargeTargetX; if(!this.hit&&(chargeHit(s,e,this.chargeLock,110,e.chargeDamage||20)||crossed)){ this.hit=true; this.finishCharge(t); } else if(t>=this.chargeEndAt) this.finishCharge(t); return; }
    if(this.state==='recovery'){ e.body.setVelocityX(0); if(t>=this.recoverUntil){ this.state='idle'; syncBossSkillState(s,e,this.state); this.nextChargeAt=t+(e.chargeCooldownMs||4000); e.setFillStyle(e.baseColor); } return; }
    const meleeTarget=chooseTarget(s,e,e.attackRange); approach(s,e,145); if(meleeTarget&&t>=this.nextMeleeAt){ this.nextMeleeAt=t+(e.attackIntervalMs||1450); targetDamage(s,meleeTarget,e,e.damage); e.setFillStyle(0xffc857); s.time.delayedCall(120,()=>alive(e)&&e.setFillStyle(e.baseColor)); } if(t>=this.nextChargeAt){ const selected=chooseAnyTarget(s,e,Infinity)||s.combatSystem.getPlayerAttackTarget(); this.state='windup'; syncBossSkillState(s,e,this.state); this.chargeLock=lockCharge(s,e,selected,e.chargeSpeed||((e.speed||80)*3),520,t); this.chargeDirection=this.chargeLock.direction; this.chargeTargetX=this.chargeLock.targetX; this.windupUntil=t+(e.chargeWindupMs||600); e.body.setVelocityX(0); this.warn=s.add.triangle(e.x,e.y-e.height/2-58,0,32,56,32,28,0,0xffe066,0.9).setStrokeStyle(4,0xffffff,1).setDepth(24); }
  }
  shiftTimers(d,a){ ['nextChargeAt','nextMeleeAt','windupUntil','recoverUntil','chargeEndAt'].forEach(k=>{if(this[k]>a)this[k]+=d;}); }
  pause(){ this.savedVelocityX=this.e.body?.velocity?.x||0; this.e.body?.setVelocityX(0); }
  resume(){ if(this.state==='charge'&&this.e.body) this.e.body.setVelocityX(this.chargeDirection*(this.chargeLock?.speed||this.e.chargeSpeed||((this.e.speed||80)*3))); }
  destroy(){ this.warn?.destroy(); }
}

export default class EnemyBehaviorManager { constructor(scene){this.scene=scene;this.items=new Map();this.paused=false;} attach(e){ let C={charger:ChargerBehavior,bomber:BomberBehavior,healer:HealerBehavior,midBoss:MidBossBehavior,berserkerBoss:BerserkerBossBehavior}[e.behavior]; if(C)this.items.set(e,new C(this.scene,e)); e.entryState='entering'; } updateEnemyApproach(e){ approach(this.scene,e,e.attackRange,e.preferredRange); } recycleEnemy(e){ const b=this.items.get(e); b?.onRecycle?.(); const jitter=Phaser.Math.Between?.(0,28) ?? Math.floor(Math.random()*29); const x=this.scene.targeting.getEnemyRightRespawnX(e,undefined,jitter); resetBodyPosition(e,x,e.y); e.entryState='recycled'; e.recycleCount=(e.recycleCount||0)+1; this.scene.enemyRecycleCount=(this.scene.enemyRecycleCount||0)+1; entryMove(this.scene,e); } update(t){ if(this.paused) return; this.scene.enemies?.forEach(e=>{ if(!alive(e)) return; if(this.scene.targeting?.shouldRecycleEnemyLeft(e)){ this.recycleEnemy(e); return; } const full=this.scene.targeting?.isEnemyFullyInsideViewport(e); e.entryState=full?'active':(e.entryState==='recycled'?'recycled':'entering'); if(!full) entryMove(this.scene,e); }); this.scene.enemies?.forEach(e=>{ if(!alive(e)||this.items.has(e)||knockbackActive(e)) return; if(this.scene.targeting?.isEnemyFullyInsideViewport(e)) this.updateEnemyApproach(e); }); this.items.forEach((b,e)=>{ if(!alive(e)){ b.destroy(); this.items.delete(e); return; } if(knockbackActive(e)){ e.body?.setVelocityX?.(0); return; } if(!this.scene.targeting?.isEnemyFullyInsideViewport(e)) return; b.update(t); }); } pause(){ if(this.paused) return; this.paused=true; this.items.forEach((b,e)=>alive(e)?b.pause?.():(b.destroy(),this.items.delete(e))); this.scene.enemies?.forEach(e=>{ if(alive(e)&&e.body) e.body.setVelocityX(0); }); } resume(){ if(!this.paused) return; this.paused=false; this.scene.enemies?.forEach(e=>{ if(alive(e)&&e.body) e.body.setVelocityX(0); }); this.items.forEach((b,e)=>alive(e)?b.resume?.():(b.destroy(),this.items.delete(e))); } shiftTimers(d,a){ this.items.forEach(b=>b.shiftTimers?.(d,a)); } destroyEnemy(e){ this.items.get(e)?.destroy(); this.items.delete(e); } destroy(){ this.paused=false; this.items.forEach(b=>b.destroy?.()); this.items.clear(); } }
