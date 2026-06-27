const Phaser = globalThis.Phaser || { Math:{ Distance:{ Between:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1) } } };
import { CombatEvents } from '../core/CombatEvents.js';
import { getWeapon } from '../config/weapons.js';
import { syncEnemyUi } from '../entities/createEnemy.js';
import { TAGS } from '../config/tags.js';
import { mergeTags } from '../utils/tagUtils.js';
import { StatusEffects } from './StatusEffectSystem.js';
import { destroyEnemyStatusIndicators } from '../ui/EnemyStatusIndicators.js';
import { TUNING } from '../config/tuning.js';
import { getEffectiveAttack, getEffectiveDefense, getEffectiveDamageReduction, sumRuntimeBonuses } from '../config/balance.js';

const BEHAVIOR_ATTACKERS = new Set(['charger', 'bomber', 'healer', 'midBoss', 'berserkerBoss']);
const NON_LIFESTEAL_SOURCES = new Set(['burn','poison','burn_burst','reflect','shield_break','afterimage']);
const NON_DIRECT_PLAYER_DAMAGE_TYPES = new Set(['dot','ground','environment','burn','poison','bomb']);
const sumBonuses = sumRuntimeBonuses;
const PHYSICAL_DAMAGE_TAKEN_BONUS_CAP = 1;
export const MIN_PLAYER_ATTACK_INTERVAL_MS = 180;
export const NORMAL_ATTACK_KNOCKBACK_DURATION_MS = 440;
export const NORMAL_ATTACK_KNOCKBACK_LIFT_PX = 24;
export const BOSS_KNOCKBACK_MULTIPLIER = 0.8;
export const bossKnockbackDistance = TUNING.combat?.bossKnockbackDistance ?? 10;
const BOSS_SKILL_STATES = new Set(['windup','slamWind','charge','jump','jumping','skillActive','recovery','cool']);
export const isBossUsingSkill = enemy => !!(enemy?.isBoss && (enemy.casting || enemy.charging || enemy.dashing || enemy.jumping || enemy.skillActive || enemy.isCasting || enemy.isCharging || enemy.isDashing || enemy.isJumping || BOSS_SKILL_STATES.has(enemy.attackState) || BOSS_SKILL_STATES.has(enemy.behaviorState)));
const isDirectEnemyAttack=(enemy,meta={})=>{
  if(!enemy||meta.directAttack===false) return false;
  if(meta.directAttack===true) return true;
  const source=meta.source||'';
  const attackType=meta.attackType||source;
  return !NON_DIRECT_PLAYER_DAMAGE_TYPES.has(source)
    &&!NON_DIRECT_PLAYER_DAMAGE_TYPES.has(attackType);
};

export default class CombatSystem {
  constructor(scene){ this.scene=scene; this.nextPlayerAttackAt=0; this.knockbackTargets=new Set(); this.ensureBuildRuntime(); }
  ensureBuildRuntime(){ const p=this.scene.playerData; p.dodgeChance??=0; p.heavyHitEvery??=0; p.heavyHitCounter??=0; p.heavyHitMultiplier??=1.8; p.heavyHitLifeSteal??=0; p.nextAttackIsHeavy??=false; p.attackDamageBonuses??={}; p.normalAttackDamageBonuses??={}; p.heavyHitDamageBonuses??={}; p.attackSpeedMultiplierBonuses??={}; p.lifeStealBonuses??={}; p.heavyHitLifeStealBonuses??={}; p.defenseBonuses??={}; p.damageReductionBonuses??={}; p.healingReceivedMultiplierBonuses??={}; p.moveSpeedMultiplierBonuses??={}; p.dodgeChanceBonuses??={}; p.afterimageDamageBonuses??={}; }
  reset(){ this.nextPlayerAttackAt=0; this.clearAllKnockbacks(); const p=this.scene.playerData; if(p){ p.heavyHitCounter=0; p.nextAttackIsHeavy=false; p.defenseBonuses={}; p.damageReductionBonuses={}; p.healingReceivedMultiplierBonuses={}; } }
  shiftTimers(pausedDuration, pausedAt){ if(this.nextPlayerAttackAt>pausedAt) this.nextPlayerAttackAt+=pausedDuration; this.scene.enemies?.forEach(e=>{ if(!e.isDefeated&&e.nextAttackAt>pausedAt) e.nextAttackAt+=pausedDuration; }); }
  update(time){ const s=this.scene; if(s.isGameplayPaused?.()||s.playerData.hp<=0) return; const enemies=s.targeting.all(); const weapon=getWeapon(s.playerData.weaponId); const profile=s.professionSystem?.currentAttackProfile?.(); const range=(profile?.range ?? weapon.attackRange)*(1+sumBonuses(s.playerData.attackRangeMultiplierBonuses)); const target=s.targeting.nearestAhead(range); if(target && time>=this.nextPlayerAttackAt){ const interval=this.getPlayerAttackInterval(weapon, profile); this.nextPlayerAttackAt=time+interval; this.prepareHeavyHit(); this.performAttack(target, weapon, profile); } enemies.forEach(e=>this.updateEnemyAttack(e,time)); }
  prepareHeavyHit(){ const p=this.scene.playerData; const every=Math.max(0,Math.floor(p.heavyHitEvery||0)); p.nextAttackIsHeavy=false; if(every<=0) return false; p.heavyHitCounter=(p.heavyHitCounter||0)+1; if(p.heavyHitCounter<every) return false; p.heavyHitCounter=0; p.nextAttackIsHeavy=true; return true; }
  consumeHeavyHit(){ const p=this.scene.playerData; const heavy=!!p.nextAttackIsHeavy; p.nextAttackIsHeavy=false; return heavy; }
  getPlayerAttackInterval(weapon, profile=null){ const p=this.scene.playerData; const multiplier=Math.max(0.2,(p.attackSpeedMultiplier||1)+sumBonuses(p.attackSpeedMultiplierBonuses)); const interval=(weapon.attackIntervalMs*(profile?.intervalMultiplier||1))/multiplier; return Math.max(MIN_PLAYER_ATTACK_INTERVAL_MS, interval); }
  performAttack(target, weapon, profile){ if(!profile) return this.performDefaultAttack(target, weapon); if(profile.type==='swordSlash') return this.performSwordSlashAttack(profile, weapon); if(profile.type==='arcaneBolt') return this.performArcaneBoltAttack(target, profile, weapon); if(profile.type==='hunterArrow') return this.performHunterArrowAttack(target, profile, weapon); return this.performDefaultAttack(target, weapon); }
  attackDamageFactors(weapon, profile=null, heavy=false){ const s=this.scene,p=s.playerData; const artifactMult=s.artifactSystem?.highHpDamageMultiplier?.() || 1; const professionMult=s.professionSystem?.getDamageMultiplier?.({ type:'normalAttack' })||1; const attackBonus=1+sumBonuses(p.attackDamageBonuses)+(heavy?0:sumBonuses(p.normalAttackDamageBonuses)); const heavyDamageBonus=heavy?1+sumBonuses(p.heavyHitDamageBonuses):1; const heavyMult=heavy?Math.max(1,(p.heavyHitMultiplier||1)*heavyDamageBonus):1; const baseAttack=getEffectiveAttack(p); const nonCritBaseDamage=Math.round(baseAttack*weapon.damageMultiplier*(profile?.damageMultiplier||1)*artifactMult*attackBonus*heavyMult); return { professionMult, nonCritBaseDamage }; }
  calcNonCritAttackBaseDamage(weapon, profile=null, heavyOverride=false){ return this.attackDamageFactors(weapon,profile,!!heavyOverride).nonCritBaseDamage; }
  calcAttackDamage(weapon, profile=null, heavyOverride=null, physical=true){ const s=this.scene,p=s.playerData; const heavy=heavyOverride ?? this.consumeHeavyHit(); const factors=this.attackDamageFactors(weapon,profile,heavy); const crit=Math.random()<Math.max(0,Math.min(0.95,(p.critChance||0)+(physical?sumBonuses(p.physicalCritChanceBonuses):0))); const critMult=crit?((p.critMultiplier||1.5)+(physical?sumBonuses(p.physicalCritMultiplierBonuses):0)):1; const baseBeforeProfession=Math.round(factors.nonCritBaseDamage*critMult); return { crit, critResolved:true, heavy, professionMult:factors.professionMult, baseBeforeProfession, nonCritBaseDamage:factors.nonCritBaseDamage, damage:Math.round(baseBeforeProfession*factors.professionMult) }; }
  applyAttackDamage(enemy, result, tags=['physical'], extra={}){ const s=this.scene; const sourceTags=mergeTags([TAGS.NORMAL_ATTACK], tags, result.heavy?[TAGS.HEAVY_HIT]:[]); const damaged=this.damageEnemy(enemy,result.damage,{ source:'attack', damageKind:result.heavy?'heavyHit':'normalAttack', heavyHit:result.heavy, tags:sourceTags, canTriggerArtifacts:true, allowLifeSteal:true, professionMultiplier:result.professionMult, baseAmountBeforeProfession:result.baseBeforeProfession, critResolved:true, crit:result.crit, professionApplied:true, ...extra }); if(!damaged) return; s.professionSystem?.onDirectHit?.({ enemy, source:'attack', baseDamage:result.baseBeforeProfession }); if(result.heavy) s.eventBus.emit(CombatEvents.PLAYER_HEAVY_HIT,{ enemy, damage:result.damage, tags:sourceTags }); s.eventBus.emit(CombatEvents.PLAYER_HIT,{ enemy, damage:result.damage, crit:result.crit, heavyHit:result.heavy, forcedCrit:false, tags:sourceTags, source:'attack' }); }
  emitAttackResolved(payload={}){ this.scene.eventBus.emit(CombatEvents.PLAYER_ATTACK_RESOLVED,{ ...payload, source:'attackResolved' }); }
  performDefaultAttack(enemy, weapon){ const s=this.scene; if(!s.targeting.valid(enemy)) return; const heavy=this.consumeHeavyHit(); const baseDamage=this.calcNonCritAttackBaseDamage(weapon,null,heavy); s.eventBus.emit(CombatEvents.PLAYER_ATTACK,{ enemy, weapon, baseDamage }); this.applyAttackDamage(enemy,this.calcAttackDamage(weapon,null,heavy),['physical',TAGS.MELEE],{knockback:weapon.knockback}); this.emitAttackResolved({ enemy, targets:[enemy], weapon, baseDamage, profile:null, heavy }); }
  performSwordSlashAttack(profile, weapon){ const s=this.scene; const heavy=this.consumeHeavyHit(); const baseDamage=this.calcNonCritAttackBaseDamage(weapon,profile,heavy); s.eventBus.emit(CombatEvents.PLAYER_ATTACK,{ enemy:null, weapon, profile, baseDamage }); s.professionWeaponView?.playAttack(profile.id); const x=s.player.x+112, y=s.player.y-42; const arc=s.add.arc(x,y,118,210,330,false,0xcff5ff,0.34).setStrokeStyle(14,0xe8fbff,0.95).setDepth(135); s.tweens.add({targets:arc,scaleX:1.16,alpha:0,duration:150,onComplete:()=>arc.destroy()}); const targets=s.targeting.all().filter(e=>e.x>=s.player.x-25 && e.x-s.player.x<=profile.range*(1+sumBonuses(s.playerData.attackRangeMultiplierBonuses)) && Math.abs(e.y-s.player.y)<145).sort((a,b)=>a.x-b.x).slice(0,profile.pierce); targets.forEach(e=>{ const r=this.calcAttackDamage(weapon,profile,heavy); this.applyAttackDamage(e,r,['physical','slash',TAGS.MELEE],{knockback:weapon.knockback}); this.slashHit(e); }); this.emitAttackResolved({ enemy:targets[0]||null, targets, weapon, profile, baseDamage, heavy }); }
  performArcaneBoltAttack(enemy, profile, weapon){ const s=this.scene; if(!s.targeting.valid(enemy)) return; const heavy=this.consumeHeavyHit(); const baseDamage=this.calcNonCritAttackBaseDamage(weapon,profile,heavy); s.eventBus.emit(CombatEvents.PLAYER_ATTACK,{ enemy, weapon, profile, baseDamage }); s.professionWeaponView?.playAttack(profile.id); this.flyProjectile({ enemy, profile, weapon, color:0x9ee8ff, radius:15, fromX:s.player.x+72, fromY:s.player.y-100, tags:['arcane',TAGS.PROJECTILE], heavy, attackResolvedBaseDamage:baseDamage }); }
  performHunterArrowAttack(enemy, profile, weapon){ const s=this.scene; if(!s.targeting.valid(enemy)) return; const heavy=this.consumeHeavyHit(); const baseDamage=this.calcNonCritAttackBaseDamage(weapon,profile,heavy); s.eventBus.emit(CombatEvents.PLAYER_ATTACK,{ enemy, weapon, profile, baseDamage }); s.professionWeaponView?.playAttack(profile.id); this.flyProjectile({ enemy, profile, weapon, color:0xd8f5ff, radius:6, fromX:s.player.x+82, fromY:s.player.y-64, tags:['physical',TAGS.PROJECTILE], arrow:true, heavy, attackResolvedBaseDamage:baseDamage }); }
  flyProjectile({ enemy, profile, weapon, color, radius, fromX, fromY, tags, arrow=false, heavy=false, attackResolvedBaseDamage=0 }){ const s=this.scene; const dist=Phaser.Math?.Distance?.Between?.(fromX,fromY,enemy.x,enemy.y-42) ?? Math.hypot(enemy.x-fromX,enemy.y-42-fromY); const duration=Math.max(80,dist/(profile.projectileSpeed||520)*1000); const obj=arrow ? s.add.rectangle(fromX,fromY,86,7,color,1).setStrokeStyle(2,0x1d4660,1) : s.add.circle(fromX,fromY,radius,color,1).setStrokeStyle(4,0xffffff,0.7); obj.setDepth(145); if(arrow) obj.rotation=Phaser.Math?.Angle?.Between?.(fromX,fromY,enemy.x,enemy.y-42) ?? Math.atan2(enemy.y-42-fromY,enemy.x-fromX); s.tweens.add({targets:obj,x:enemy.x,y:enemy.y-42,duration,onComplete:()=>{ obj.destroy(); if(!s.targeting.valid(enemy)) return; const r=this.calcAttackDamage(weapon,profile,heavy,(tags||[]).includes('physical')); this.applyAttackDamage(enemy,r,tags,{ allowLifeSteal:true, knockback:weapon.knockback }); profile.hitEffectId==='arcane_burst'?this.arcaneHit(enemy):this.pierceHit(enemy); this.emitAttackResolved({ enemy, targets:[enemy], weapon, profile, baseDamage:attackResolvedBaseDamage||r.nonCritBaseDamage, heavy }); }}); }
  slashHit(e){ const o=this.scene.add.circle(e.x,e.y-50,34,0xffffff,0.22).setStrokeStyle(5,0xcff5ff,1).setDepth(150); this.scene.tweens.add({targets:o,alpha:0,scale:1.25,duration:180,onComplete:()=>o.destroy()}); }
  arcaneHit(e){ const o=this.scene.add.circle(e.x,e.y-48,42,0x7d6fff,0.2).setStrokeStyle(5,0xb7fbff,1).setDepth(150); this.scene.tweens.add({targets:o,alpha:0,scale:1.35,duration:240,onComplete:()=>o.destroy()}); }
  pierceHit(e){ const g=this.scene.add.graphics().setDepth(150); g.lineStyle(5,0xd8f5ff,1).lineBetween(e.x-32,e.y-58,e.x+32,e.y-34); this.scene.tweens.add({targets:g,alpha:0,duration:160,onComplete:()=>g.destroy()}); }

  snapshotBurnBeforeDeath(enemy){
    const effects=this.scene.statusEffects?.getEffects?.(enemy,StatusEffects.BURN)||[];
    if(!effects.length) return null;
    const now=this.scene.getGameplayTime?.()||0;
    const primary=[...effects].sort((a,b)=>(b.stacks||1)-(a.stacks||1)||((b.expiresAt||now)-now)-((a.expiresAt||now)-now)||((a.id||0)-(b.id||0)))[0];
    const spreadDepths=effects.map(effect=>effect.eternalSpreadDepth).filter(Number.isFinite);
    return {
      stacks:effects.reduce((sum,e)=>sum+(e.stacks||1),0),
      value:primary?.value||0,
      intervalMs:primary?.intervalMs||0,
      damageMultiplier:primary?.damageMultiplier||1,
      baseDamageMultiplierWithoutProfession:primary?.baseDamageMultiplierWithoutProfession||primary?.damageMultiplier||1,
      professionMultiplier:primary?.professionMultiplier||1,
      professionApplied:!!primary?.professionApplied,
      eternalSpreadDepth:spreadDepths.length?Math.max(...spreadDepths):0
    };
  }
  damageEnemy(enemy, amount, meta={}){ if(!this.scene.targeting.valid(enemy)) return false; if(!this.scene.targeting.isEnemyFullyInsideViewport(enemy)) return false; const physical=(meta.tags||[]).includes('physical'); let work=physical?Math.round(amount*(1+sumBonuses(this.scene.playerData?.physicalDamageBonuses))):amount; const critChance=Math.max(0,Math.min(0.95,(this.scene.playerData?.critChance||0)+(meta.bonusCritChance||0)+(physical?sumBonuses(this.scene.playerData?.physicalCritChanceBonuses):0))); const physicalCritBonus=physical?(sumBonuses(this.scene.playerData?.physicalCritChanceBonuses)+sumBonuses(this.scene.playerData?.physicalCritMultiplierBonuses)):0; const canCrit=!!meta.canCrit||physicalCritBonus>0; const crit=meta.critResolved?!!meta.crit:(canCrit && Math.random()<critChance); const critMultiplier=(this.scene.playerData?.critMultiplier||1.5)+(meta.bonusCritMultiplier||0)+(physical?sumBonuses(this.scene.playerData?.physicalCritMultiplierBonuses):0); const critAmount=meta.critResolved?work:(crit?Math.round(work*critMultiplier):work); const professionMult=meta.professionApplied ? (meta.professionMultiplier||1) : (this.scene.professionSystem?.getDamageMultiplier?.({ type:meta.source==='skill'?'activeSkill':meta.source, damaging:true })||1); const baseBeforeProfession=Math.max(0, Math.round(meta.baseAmountBeforeProfession ?? (meta.professionApplied && professionMult>0 ? critAmount/professionMult : critAmount))); const boosted=meta.professionApplied ? Math.round(critAmount) : Math.round(critAmount*professionMult); const physicalTakenBonus=physical?Math.max(0,Math.min(PHYSICAL_DAMAGE_TAKEN_BONUS_CAP,sumBonuses(enemy.physicalDamageTakenBonuses))):0; const physicalTakenMultiplier=1+physicalTakenBonus; const enemyReduction=Math.max(0,Math.min(0.95,enemy.damageReduction||0)); const critIgnore=physical&&crit?sumBonuses(this.scene.playerData?.physicalCritDefenseIgnoreBonuses):0; const explicitIgnore=physical?Number(meta.defenseIgnore||0):0; const ignore=physical?Math.max(0,Math.min(.9,critIgnore+explicitIgnore)):0; const effectiveDefense=(enemy.defense||0)*(1-ignore); const reducedBeforeTaken=Math.max(0, Math.round(boosted*(1-enemyReduction)-effectiveDefense)); const baseReducedBeforeTaken=Math.max(0, Math.round(baseBeforeProfession*(1-enemyReduction)-effectiveDefense)); let reduced=Math.max(0,Math.round(reducedBeforeTaken*physicalTakenMultiplier)); if(physical&&crit) reduced=Math.round(reduced*(1+sumBonuses(this.scene.playerData?.physicalCritFinalMultiplierBonuses)));  const baseReduced=Math.max(0,Math.round(baseReducedBeforeTaken*physicalTakenMultiplier)); const hpBefore=enemy.hp; enemy.hp=Math.max(0, enemy.hp-reduced); const actualDamage=hpBefore-enemy.hp; const actualWithoutProfession=Math.min(hpBefore,baseReduced); const professionBonus=professionMult>1 ? Math.min(actualDamage, Math.max(0, actualDamage-actualWithoutProfession)) : 0; if(actualDamage>0){ const damageTextX=(enemy.nameText?.x ?? enemy.x)+((enemy._damageTextOffsetToggle=!enemy._damageTextOffsetToggle)?-4:4); const damageTextY=enemy.nameText?.y ?? enemy.y-100; this.scene.floatText(damageTextX, damageTextY, `-${actualDamage}`, meta.source==='burn'?'#ff8a33':meta.source==='poison'?'#63ff72':crit?'#ffcc33':'#fff'); syncEnemyUi(enemy); this.scene.eventBus.emit(CombatEvents.ENEMY_HIT,{ enemy, damage:actualDamage, professionBonusDamage:professionBonus, crit, ...meta }); if(crit) this.scene.eventBus.emit(CombatEvents.PLAYER_CRIT,{ enemy, damage:actualDamage, forcedCrit:false, source:meta.source, skillId:meta.skillId }); if(!meta.noKnockback&&(meta.applyKnockback||meta.source==='attack'||meta.source==='normalAttack')) this.applyKnockback(enemy, meta); this.applyLifeSteal(actualDamage, meta); } else syncEnemyUi(enemy); if(enemy.hp<=0){
      if(meta.burnSnapshotBeforeDeath===undefined) meta.burnSnapshotBeforeDeath=this.snapshotBurnBeforeDeath(enemy);
      if(meta.burnStacksBeforeDeath===undefined) meta.burnStacksBeforeDeath=meta.burnSnapshotBeforeDeath?.stacks ?? (this.scene.statusEffects?.getStackCount?.(enemy,StatusEffects.BURN)||0);
      if(meta.poisonStacksBeforeDeath===undefined) meta.poisonStacksBeforeDeath=this.scene.statusEffects?.getStackCount?.(enemy,StatusEffects.POISON)||0;
    } if(enemy.hp<=0) this.handleDeathReactions(enemy, meta); if(enemy.hp<=0) this.killEnemy(enemy, meta); return actualDamage > 0; }
  clearKnockback(enemy){ if(!enemy) return; enemy.knockbackTween?.stop?.(); enemy.knockbackTween?.remove?.(); enemy.knockbackTween=null; enemy.isKnockbackActive=false; enemy.knockbackUntil=0; delete enemy.knockbackGroundY; this.knockbackTargets?.delete?.(enemy); }
  pauseKnockbacks(){ this.knockbackTargets?.forEach(enemy=>{ if(enemy?.isKnockbackActive) enemy.knockbackTween?.pause?.(); }); }
  resumeKnockbacks(){ this.knockbackTargets?.forEach(enemy=>{ if(enemy?.isKnockbackActive) enemy.knockbackTween?.resume?.(); }); }
  clearAllKnockbacks(){ [...(this.knockbackTargets||[])].forEach(enemy=>this.clearKnockback(enemy)); this.knockbackTargets?.clear?.(); }
  applyKnockback(enemy, meta={}){ if(!enemy?.body||enemy.isDefeated) return false; const base=meta.knockback ?? 0; if(base<=0) return false; if(isBossUsingSkill(enemy)){ this.clearKnockback(enemy); return false; } const mult=enemy.isBoss?BOSS_KNOCKBACK_MULTIPLIER:(enemy.isElite?0.35:(enemy.enemyId==='armored_guard'?0.6:1)); const requestedDistance=Math.max(2,Math.round(base*mult)); const dx=enemy.isBoss?Math.min(requestedDistance,bossKnockbackDistance):requestedDistance; const minX=enemy.width/2+8; const maxX=(this.scene.balance.stageWorldWidth||50000)-enemy.width/2-8; const startX=enemy.x; const groundY=enemy.knockbackGroundY ?? enemy.y; const direction=Math.sign(startX-(this.scene.player?.x ?? startX)) || Math.sign(enemy.body?.velocity?.x||0) || Math.sign(enemy.body?.vx||0) || (enemy.flipX?-1:1) || 1; const endX=Math.max(minX,Math.min(maxX,startX+direction*dx)); const duration=NORMAL_ATTACK_KNOCKBACK_DURATION_MS; const lift=enemy.isBoss?0:NORMAL_ATTACK_KNOCKBACK_LIFT_PX; const startY=enemy.y; this.clearKnockback(enemy); enemy.knockbackGroundY=groundY; enemy.isKnockbackActive=true; this.knockbackTargets.add(enemy); enemy.knockbackUntil=(this.scene.getGameplayTime?.()??0)+duration; enemy.body?.setVelocityX?.(0); const state={ t:0 }; const sync=()=>syncEnemyUi(enemy); enemy.knockbackTween=this.scene.tweens.add({ targets:state, t:1, duration, ease:'Sine.easeOut', onUpdate:()=>{ if(enemy.isDefeated||!enemy.active){ this.clearKnockback(enemy); return; } const t=Math.max(0,Math.min(1,state.t)); enemy.x=startX+(endX-startX)*t; enemy.y=startY+(groundY-startY)*t-Math.sin(Math.PI*t)*lift; enemy.body?.reset?.(enemy.x,enemy.y); enemy.body?.setVelocityX?.(0); sync(); }, onComplete:()=>{ if(enemy.isDefeated||!enemy.active){ this.clearKnockback(enemy); return; } enemy.x=endX; enemy.y=groundY; enemy.body?.reset?.(enemy.x,enemy.y); enemy.body?.setVelocityX?.(0); sync(); this.clearKnockback(enemy); } }); return true; }
  applyLifeSteal(actualDamage, meta={}){ const s=this.scene,p=s.playerData; const source=meta.source||''; const allowed=meta.allowLifeSteal ?? ((source==='attack'||source==='skill')&&!NON_LIFESTEAL_SOURCES.has(source)); if(!allowed||actualDamage<=0||p.hp>=p.maxHp) return 0; const baseRate=Math.max(0,(p.lifeSteal||0)+sumBonuses(p.lifeStealBonuses)); const heavyRate=meta.heavyHit?Math.max(0,(p.heavyHitLifeSteal||0)+sumBonuses(p.heavyHitLifeStealBonuses)):0; const echoScale=meta.afterimage?Math.max(0,meta.lifeStealScale??0.25):1; const rate=(baseRate+heavyRate)*echoScale; if(rate<=0) return 0; const requested=Math.floor(actualDamage*rate); if(requested<=0) return 0; const healed=s.healPlayer?.(requested,'lifeSteal')||0; if(healed>0) s.eventBus.emit(CombatEvents.LIFESTEAL_TRIGGERED,{ amount:healed, requested, actualDamage, rate, source, heavyHit:!!meta.heavyHit, afterimage:!!meta.afterimage }); return healed; }
  canDodge(meta={}){ if(meta.undodgeable||meta.dodgeable===false) return false; const type=meta.attackType||meta.source||''; return !['dot','ground','environment','burn','poison'].includes(type); }
  damagePlayer(enemy, rawDamage, meta={}){
    const s=this.scene;
    if(s.isGameplayPaused?.()||s.playerData.hp<=0) return;
    const directAttack=isDirectEnemyAttack(enemy,meta);
    if(this.canDodge(meta)&&Math.random()<Math.max(0,Math.min(0.95,(s.playerData.dodgeChance||0)+sumBonuses(s.playerData.dodgeChanceBonuses)))){
      s.floatText(s.player.x,s.player.y-86,'闪避','#b7f7ff');
      s.eventBus.emit(CombatEvents.PLAYER_DODGED,{ enemy, rawDamage, attackType:meta.attackType||meta.source||'unknown', forced:false, directAttack, ...meta });
      return;
    }
    const totalDefense=getEffectiveDefense(s.playerData);
    const totalDamageReduction=getEffectiveDamageReduction(s.playerData);
    const base=Math.max(1,Math.round(rawDamage*(1-totalDamageReduction)-totalDefense));
    const damage=Math.max(1,Math.round(base*(1-(s.playerData.temporaryDamageReduction||0))));
    const intercepted=s.skillSystem?.beforePlayerDamage({ enemy, damage, rawDamage, directAttack, ...meta });
    if(intercepted?.blocked){
      const blocked=intercepted.absorbed||damage;
      s.floatText(s.player.x,s.player.y-92,'吞弹抵挡','#58d7ff');
      s.eventBus.emit(CombatEvents.PLAYER_DAMAGED,{
        enemy,
        damage,
        hpDamage:0,
        shieldAbsorbed:0,
        totalShieldBefore:s.playerData.shield||0,
        totalShieldAfter:s.playerData.shield||0,
        shieldDepleted:false,
        directAttack,
        skillBlocked:blocked,
        blocked:true,
        blockedBySkillId:intercepted.blockedBySkillId||'bullet_eater',
        ...meta
      });
      s.hud?.update();
      return;
    }
    const totalShieldBefore=Math.max(0,s.playerData.shield||0);
    const shieldResult=s.statusEffects?.absorbShield(damage,{ enemy, rawDamage, damage, directAttack, ...meta })||{absorbed:0,remainingDamage:damage};
    const absorbed=shieldResult.absorbed;
    let hpDmg=shieldResult.remainingDamage;
    const hpIntercept=s.skillSystem?.beforePlayerHpDamage({ enemy, damage, rawDamage, hpDamage:hpDmg, shieldAbsorbed:absorbed, directAttack, ...meta });
    if(hpIntercept){
      hpDmg=Math.max(0,Math.min(hpDmg,hpIntercept.hpDamage??hpDmg));
    }
    s.playerData.hp=Math.max(0,s.playerData.hp-hpDmg);
    const totalShieldAfter=Math.max(0,s.playerData.shield||0);
    const shieldDepleted=totalShieldBefore>0&&totalShieldAfter<=0;
    s.floatText(s.player.x,s.player.y-80,absorbed&&hpDmg?`盾-${absorbed} -${hpDmg}`:absorbed?`盾-${absorbed}`:`-${hpDmg}`,absorbed?'#8fd7ff':'#ff7777');
    s.eventBus.emit(CombatEvents.PLAYER_DAMAGED,{
      enemy,
      damage,
      hpDamage:hpDmg,
      shieldAbsorbed:absorbed,
      totalShieldBefore,
      totalShieldAfter,
      shieldDepleted,
      directAttack,
      ...meta
    });
    if(s.playerData.hp/s.playerData.maxHp<=0.3) s.eventBus.emit(CombatEvents.PLAYER_LOW_HP,{hp:s.playerData.hp});
    s.hud?.update();
    if(s.playerData.hp<=0) s.finishRun(false);
  }
  killEnemy(enemy, meta={}){ if(!enemy||enemy.isDefeated) return; const s=this.scene; enemy.isDefeated=true; this.clearKnockback(enemy); s.statusEffects?.clearTarget(enemy); destroyEnemyStatusIndicators(enemy); enemy.body&&(enemy.body.enable=false); s.enemies=s.enemies.filter(e=>e!==enemy); s.killCount += enemy.isBoss ? 0 : 1; const gold=enemy.isMidBoss?40:enemy.isElite?15:(enemy.isBoss?0:1); if(gold) s.awardGold?.(gold, enemy.isMidBoss?'midBoss':enemy.isElite?'eliteEnemy':'normalEnemy'); s.eventBus.emit(CombatEvents.ENEMY_KILLED,{ enemy, ...meta }); if(enemy.isBoss){ const flowBossType=enemy.flowBossType||(enemy.enemyId==='berserker_boss'?'boss1':(enemy.isMidBoss?'boss2':'boss3')); const bossType=enemy.isFinalBoss?'final':(enemy.isMidBoss?'mid':flowBossType); s.eventBus.emit(CombatEvents.BOSS_KILLED,{ enemy, bossType, flowBossType }); s.stageSystem?.clearBossMinions?.(); s.stageSystem?.onBossKilled?.(flowBossType); if(enemy.isMidBoss) s.runStats?.endMidBossFight?.(); } [enemy.hpBarBg, enemy.hpBar, enemy.nameText, enemy.levelText].forEach(o=>o?.destroy()); s.tweens.add({ targets:enemy, alpha:0, duration:s.balance.enemyFadeMs, onComplete:()=>enemy.destroy() }); }
  handleDeathReactions(enemy, meta={}){ const s=this.scene; if(enemy._deathReacted) return; enemy._deathReacted=true; const all=s.targeting.all().filter(e=>e!==enemy); if(s.statusEffects?.has(enemy,'BURN')&&!meta.noDeathExplosion){ all.filter(e=>Phaser.Math.Distance.Between(e.x,e.y,enemy.x,enemy.y)<=95).forEach(e=>this.damageEnemy(e,8,{source:'burn_burst',tags:[TAGS.FIRE,TAGS.DOT],noDeathExplosion:true})); } const spreadingPoison=s.statusEffects?.getEffects(enemy,'POISON').find(e=>e.canSpread); if(spreadingPoison&&!meta.noPoisonSpread){ const r=spreadingPoison.spreadRadius||105; all.filter(e=>Phaser.Math.Distance.Between(e.x,e.y,enemy.x,enemy.y)<=r).forEach(e=>s.statusEffects.add('POISON',e,{durationMs:spreadingPoison.spreadDurationMs||2200,intervalMs:650,value:spreadingPoison.spreadDamage||5,sourceId:'poison_spread',canSpread:false,damageMultiplier:spreadingPoison.damageMultiplier||1,baseDamageMultiplierWithoutProfession:spreadingPoison.baseDamageMultiplierWithoutProfession||spreadingPoison.damageMultiplier||1,professionMultiplier:spreadingPoison.professionMultiplier||1,professionApplied:!!spreadingPoison.professionApplied})); } }
  getPlayerAttackTarget(){ const s=this.scene; return { type:'player', get x(){ return s.player.x; }, get y(){ return s.player.y; }, isAlive:()=>s.playerData.hp>0, takeDamage:(amount,meta={})=>this.damagePlayer(meta.enemy||null,amount,meta) }; }
  getPoisonKingAttackTarget(){ const king=this.scene.poisonKingRuntime?.getAttackTarget?.(); if(!king||!king.isAlive?.()) return null; return king; }
  getAttackableTargets(enemy, options={}){ const targets=[]; const player=this.getPlayerAttackTarget(); if(options.includePlayer!==false&&player.isAlive()) targets.push(player); const king=this.getPoisonKingAttackTarget(); if(options.includePoisonKing!==false&&king?.isAlive?.()) targets.push(king); return targets; }
  chooseEnemyAttackTarget(enemy, range=enemy?.attackRange||0, options={}){ const targets=this.getAttackableTargets(enemy,options).filter(target=>target.isAlive?.()); const inRange=targets.map(target=>({ target, distance:Math.hypot((enemy?.x||0)-target.x,(enemy?.y||0)-target.y) })).filter(item=>item.distance<=range).sort((a,b)=>a.distance-b.distance); return inRange[0]?.target||null; }
  damageAttackTarget(target, amount, meta={}){ if(!target?.isAlive?.()) return 0; const before=target.hp ?? (target.type==='player'?this.scene.playerData.hp:0); target.takeDamage(amount,meta); const after=target.hp ?? (target.type==='player'?this.scene.playerData.hp:before); return Math.max(0,before-after); }
  damageTargetsInRadius(x,y,radius,amount,meta={},options={}){ return this.getAttackableTargets(meta.enemy,options).filter(target=>target.isAlive?.()&&Math.hypot(target.x-x,target.y-y)<=radius).map(target=>({ target, damage:this.damageAttackTarget(target,amount,{...meta,targetType:target.type}) })); }
  updateEnemyAttack(enemy,time){ const s=this.scene; if(!s.targeting.valid(enemy)||enemy.isKnockbackActive) return; if(BEHAVIOR_ATTACKERS.has(enemy.behavior)) return; if(enemy.isBoss && !enemy.enraged && enemy.hp <= enemy.maxHp/2){ enemy.enraged=true; enemy.attackIntervalMs=enemy.enragedAttackIntervalMs; s.hud?.setStatus('Boss 半血狂暴：攻击速度提升！'); } const target=this.chooseEnemyAttackTarget(enemy,enemy.attackRange); if(!target) return; if(time < enemy.nextAttackAt) return; enemy.nextAttackAt=time+enemy.attackIntervalMs; this.damageAttackTarget(target, enemy.damage, { enemy, source:'enemyMelee', attackType:'melee', dodgeable:true }); }
}
