import { TAGS } from '../../config/tags.js';
import { SKILLS } from '../../config/skills.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { getActiveSkillCastModifierSnapshot } from '../../systems/ActiveSkillModifierSystem.js';
import { launchEnergyCannon, launchShoulderVolley, clearMechTasks, selectDenseEnemyCluster } from './MechRuntime.js';

export const POWERED_ARMOR_ID = 'powered_armor';
export const SHOULDER_MISSILE_ID = 'shoulder_missile';
export const OVERLOAD_CORE_ID = 'overload_core';

const ARMOR_LEVELS = [
  [20,2,0,0,0],[28,3,0,0,0],[38,4,.01,0,0],[50,5,.01,0,0],[62,6,.02,0,0],
  [78,8,.02,1,8000],[94,9,.03,1,7600],[112,11,.03,1,7200],[135,13,.04,2,6800]
].map(([maxHpBonus, defenseBonus, damageReduction, reactiveArmorSlots, rechargeMs]) => ({ maxHpBonus, defenseBonus, damageReduction, reactiveArmorSlots, rechargeMs }));
const MISSILE_LEVELS = [
  [42,105,5500,5,1],[48,110,5300,5,1],[56,130,5100,5,1],[64,135,4900,5,1],[72,140,4700,5,1],
  [78,145,4500,6,2],[86,150,4300,6,2],[95,155,4100,6,2],[106,165,3900,7,2]
].map(([damage,radius,cooldownMs,manaCost,missileCount], index) => ({ damage,radius,cooldownMs,manaCost,missileCount,
  sameClusterSecondMultiplier:.6, miniCount:index===8?3:0, miniDamageRatio:index===8?.22:0, miniRadius:55, miniSearchRange:320 }));
const CORE_LEVELS = [
  [10,.08,.06,.22,46],[10,.10,.07,.25,50],[9,.13,.09,.29,54],[9,.15,.10,.32,58],[9,.17,.11,.35,62],
  [9,.20,.13,.39,66],[9,.22,.15,.43,70],[9,.25,.17,.47,75],[8,.28,.20,.52,82]
].map(([threshold,attackSpeedBonus,moveSpeedBonus,energyCannonDamageRatio,energyCannonRadius],index)=>({threshold,durationMs:5000,attackSpeedBonus,moveSpeedBonus,energyCannonDamageRatio,energyCannonRadius,
  ignitionCannon:index>=2,castExtendMs:index>=5?400:0,maxCastExtendMs:index>=5?2000:0,coordinatedAttack:index===8}));

export function configureMechFlowSkills() {
  SKILLS[POWERED_ARMOR_ID] = { id:POWERED_ARMOR_ID,name:'动力装甲',rarity:'FINE',handler:POWERED_ARMOR_ID,passive:true,targetType:'passive',maxLevel:9,manaCost:0,color:0x82cfff,short:'甲',tags:[TAGS.MECH,TAGS.BUILD_MECH],description:'强化最大生命、防御与伤害减免；高等级获得可拦截直接攻击的反应装甲。',milestones:{3:'合金强化：开始获得1%伤害减免，后续等级继续成长。',6:'反应装甲：获得1层可在护盾后完整拦截敌人直接生命伤害的装甲。',9:'复合装甲：最大反应装甲层数提高到2，两层分别独立充能。'},levels:ARMOR_LEVELS };
  SKILLS[SHOULDER_MISSILE_ID] = { id:SHOULDER_MISSILE_ID,name:'肩载导弹',rarity:'FINE',handler:SHOULDER_MISSILE_ID,targetType:'random',maxLevel:9,manaCost:5,cooldownMs:5500,color:0xff9e55,short:'弹',tags:['physical',TAGS.PROJECTILE,TAGS.ACTIVE_SKILL,TAGS.MECH,TAGS.BUILD_MECH],description:'从肩部发射导弹轰击当前最密集的敌群，高等级可齐射并释放微型追踪导弹。',milestones:{3:'重型弹头：爆炸半径明显提高到130，视觉爆炸同步增大。',6:'双联齐射：发射2枚主导弹，优先轰击相距至少180的不同敌群。',9:'蜂群弹舱：每枚主导弹命中后释放3枚不会继续分裂的微型追踪导弹。'},levels:MISSILE_LEVELS };
  SKILLS[OVERLOAD_CORE_ID] = { id:OVERLOAD_CORE_ID,name:'过载核心',rarity:'RARE',handler:OVERLOAD_CORE_ID,passive:true,targetType:'passive',maxLevel:9,manaCost:0,color:0x67e8f9,short:'核',tags:['physical',TAGS.NORMAL_ATTACK,TAGS.MECH,TAGS.BUILD_MECH],description:'真实普通攻击与成功主动施法为核心充能；充满后进入过载，提高攻速与移速，并让普通攻击追加能量炮。',milestones:{3:'核心点火：阈值降为9，进入过载时立即发射一次能量炮。',6:'超频续航：过载期间每次成功真实主动施法延长400ms，每轮最多2秒。',9:'武装协同：阈值降为8，启动攻击升级为免费导弹齐射或三连能量炮。'},levels:CORE_LEVELS };
}

function recomputeMaxHp(player) {
  const oldMax = Math.max(1, Number(player.maxHp) || 1), alive = (player.hp || 0) > 0, ratio = (Number(player.hp) || 0) / oldMax;
  const sum = Object.values(player.maxHpBonuses || {}).reduce((total, value) => total + (Number(value) || 0), 0);
  player.maxHp = Math.max(1, Math.round((Number(player.baseMaxHp) || oldMax - sum) + sum));
  player.hp = alive ? Math.max(1, Math.min(player.maxHp, Math.round(player.maxHp * ratio))) : 0;
}

function syncArmor(system) {
  const player = system.scene.playerData, data = system.getData(POWERED_ARMOR_ID);
  player.maxHpBonuses ??= {}; player.defenseBonuses ??= {}; player.damageReductionBonuses ??= {};
  const previous = player.maxHpBonuses[POWERED_ARMOR_ID] || 0;
  if (data) {
    player.maxHpBonuses[POWERED_ARMOR_ID] = data.maxHpBonus;
    player.defenseBonuses[POWERED_ARMOR_ID] = data.defenseBonus;
    player.damageReductionBonuses[POWERED_ARMOR_ID] = data.damageReduction;
  } else {
    delete player.maxHpBonuses[POWERED_ARMOR_ID]; delete player.defenseBonuses[POWERED_ARMOR_ID]; delete player.damageReductionBonuses[POWERED_ARMOR_ID];
  }
  if (previous !== (data?.maxHpBonus || 0)) recomputeMaxHp(player);
}

function syncArmorSlots(system, state) {
  const data = system.getData(POWERED_ARMOR_ID), now = system.scene.getGameplayTime?.() ?? 0, max = data?.reactiveArmorSlots || 0;
  while (state.slots.length < max) state.slots.push({ ready:true, consumedAt:0, readyAt:0 });
  while (state.slots.length > max) state.slots.pop();
  state.slots.forEach(slot => {
    if (slot.ready) return;
    const calculated = slot.consumedAt + data.rechargeMs;
    slot.readyAt = calculated;
    if (now >= calculated) { slot.ready = true; slot.readyAt = 0; }
  });
}

export function getPoweredArmorState(system) {
  const state = system?.passiveState?.poweredArmor, data = system?.getData?.(POWERED_ARMOR_ID), now = system?.scene?.getGameplayTime?.() ?? 0;
  if (!data) return null;
  const ready = state?.slots?.filter(slot => slot.ready).length || 0;
  const nextReadyAt = Math.min(...(state?.slots?.filter(slot => !slot.ready).map(slot => slot.readyAt) || [Infinity]));
  return Object.freeze({ max:data.reactiveArmorSlots || 0, ready, remainingMs:Number.isFinite(nextReadyAt)?Math.max(0,nextReadyAt-now):0 });
}

function armorFlash(system) {
  const scene=system.scene, x=scene.player?.x||0,y=(scene.player?.y||0)-45;
  scene.floatText?.(x,y-52,'反应装甲','#dff8ff');
  const visual=scene.add?.polygon?.(x,y,[0,-42,36,-21,36,21,0,42,-36,21,-36,-21],0xbdeeff,.22)?.setStrokeStyle?.(4,0xffffff,.95)?.setDepth?.(160);
  scene.tweens?.add?.({targets:visual,alpha:0,scale:1.25,duration:240,onComplete:()=>visual?.destroy?.()});
}

export const PoweredArmorSkill = {
  bind(system) { const state=system.passiveState.poweredArmor={slots:[]}; const updater=()=>{syncArmor(system);syncArmorSlots(system,state);}; system.passiveUpdaters.push(updater); updater(); return()=>{system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater);state.slots.length=0;const p=system.scene.playerData,had=p.maxHpBonuses?.[POWERED_ARMOR_ID]||0;delete p.maxHpBonuses?.[POWERED_ARMOR_ID];delete p.defenseBonuses?.[POWERED_ARMOR_ID];delete p.damageReductionBonuses?.[POWERED_ARMOR_ID];if(had)recomputeMaxHp(p);delete system.passiveState.poweredArmor;}; },
  onAcquire(system){syncArmor(system);const state=system.passiveState.poweredArmor;if(state)syncArmorSlots(system,state);},
  beforePlayerHpDamage(system,payload){ if(system.getLevel(POWERED_ARMOR_ID)<6||!payload?.enemy||payload.directAttack!==true||!(payload.hpDamage>0)||(system.scene.playerData?.hp||0)<=0||system.scene.isGameplayPaused?.())return null; const state=system.passiveState.poweredArmor;if(!state)return null;syncArmorSlots(system,state);const slot=state.slots.find(item=>item.ready);if(!slot)return null;slot.ready=false;slot.consumedAt=system.scene.getGameplayTime?.()??0;slot.readyAt=slot.consumedAt+system.getData(POWERED_ARMOR_ID).rechargeMs;armorFlash(system);return {hpDamage:0};},
  shiftTimers(system,duration,pausedAt){system.passiveState.poweredArmor?.slots.forEach(slot=>{if(!slot.ready){if(slot.consumedAt<=pausedAt)slot.consumedAt+=duration;if(slot.readyAt>pausedAt)slot.readyAt+=duration;}});}
};

export const ShoulderMissileSkill = {
  canCast(system){return !!selectDenseEnemyCluster(system.scene);},
  cast(system,cfg,data,level,ctx){return launchShoulderVolley(system,data,level,ctx);},
  cleanup(system){clearMechTasks(system,SHOULDER_MISSILE_ID);},
};

function validRealCast(event) {
  const cfg=SKILLS[event?.skillId],ctx=event?.ctx;
  return !!cfg&&event.skill===cfg&&cfg.passive!==true&&cfg.targetType!=='passive'&&Number.isInteger(ctx?.castId)&&ctx.castId>0&&!event.fromMyriadAfterimage&&!ctx.fromMyriadAfterimage&&!ctx.fromMechFreeVolley;
}
function syncOverloadBonuses(system,state) {
  const p=system.scene.playerData,data=system.getData(OVERLOAD_CORE_ID);p.attackSpeedMultiplierBonuses??={};p.moveSpeedMultiplierBonuses??={};
  if(state.overloaded&&data){p.attackSpeedMultiplierBonuses[OVERLOAD_CORE_ID]=data.attackSpeedBonus;p.moveSpeedMultiplierBonuses[OVERLOAD_CORE_ID]=data.moveSpeedBonus;}
  else{delete p.attackSpeedMultiplierBonuses[OVERLOAD_CORE_ID];delete p.moveSpeedMultiplierBonuses[OVERLOAD_CORE_ID];}
}
function startOverload(system,state,data){const now=system.scene.getGameplayTime?.()??0;state.energy=0;state.overloaded=true;state.endsAt=now+data.durationMs;state.extendedMs=0;syncOverloadBonuses(system,state);const level=system.getLevel(OVERLOAD_CORE_ID);if(level>=9){if(system.getLevel(SHOULDER_MISSILE_ID)>0){const missileData=system.getData(SHOULDER_MISSILE_ID),cfg=SKILLS[SHOULDER_MISSILE_ID],snapshot=getActiveSkillCastModifierSnapshot(system,cfg),professionMultiplier=system.scene.professionSystem?.getDamageMultiplier?.({type:'activeSkill',damaging:true})||1,baseDamageMultiplierWithoutProfession=(system.scene.playerData.skillDamageMultiplier||1)*(snapshot.appliedDamageMultiplier||1)*(system.scene.artifactSystem?.highHpDamageMultiplier?.()||1);launchShoulderVolley(system,missileData,system.getLevel(SHOULDER_MISSILE_ID),{damageMultiplier:baseDamageMultiplierWithoutProfession*professionMultiplier,baseDamageMultiplierWithoutProfession,professionMultiplier,castModifierSnapshot:snapshot,fromMechFreeVolley:true},{free:true,sourceSkillId:OVERLOAD_CORE_ID});}else{const used=new Set();[0,120,240].forEach(delay=>{const target=(system.scene.targeting?.all?.()||[]).find(e=>!used.has(e));launchEnergyCannon(system,{target,delayMs:delay,excluded:used});if(target)used.add(target);});}}else if(data.ignitionCannon)launchEnergyCannon(system);}

export function getOverloadCoreState(system){const state=system?.passiveState?.overloadCore,data=system?.getData?.(OVERLOAD_CORE_ID),now=system?.scene?.getGameplayTime?.()??0;if(!data)return null;return Object.freeze({energy:state?.energy||0,threshold:data.threshold,overloaded:!!state?.overloaded,remainingMs:state?.overloaded?Math.max(0,state.endsAt-now):0});}

export const OverloadCoreSkill = {
  bind(system){const scene=system.scene,state=system.passiveState.overloadCore={energy:0,overloaded:false,endsAt:0,extendedMs:0,visual:null};
    const attackOff=scene.eventBus.on(CombatEvents.PLAYER_ATTACK_RESOLVED,payload=>{const data=system.getData(OVERLOAD_CORE_ID);if(!data)return;if(state.overloaded){launchEnergyCannon(system,{target:payload?.enemy||payload?.targets?.[0],baseDamage:payload?.baseDamage});return;}state.energy=Math.min(data.threshold,state.energy+1);if(state.energy>=data.threshold)startOverload(system,state,data);});
    const castOff=scene.eventBus.on(CombatEvents.SKILL_CAST_COMPLETED,event=>{const data=system.getData(OVERLOAD_CORE_ID);if(!data||!validRealCast(event))return;if(state.overloaded){const add=Math.min(data.castExtendMs||0,(data.maxCastExtendMs||0)-state.extendedMs);if(add>0){state.extendedMs+=add;state.endsAt+=add;}return;}state.energy=Math.min(data.threshold,state.energy+2);if(state.energy>=data.threshold)startOverload(system,state,data);});
    const updater=()=>{const data=system.getData(OVERLOAD_CORE_ID),now=scene.getGameplayTime?.()??0;if(!data||(scene.playerData?.hp||0)<=0){state.overloaded=false;state.energy=0;syncOverloadBonuses(system,state);state.visual?.destroy?.();state.visual=null;return;}if(!state.overloaded&&state.energy>=data.threshold)startOverload(system,state,data);if(state.overloaded&&now>=state.endsAt){state.overloaded=false;state.energy=0;syncOverloadBonuses(system,state);}syncOverloadBonuses(system,state);if(state.overloaded&&!state.visual)state.visual=scene.add?.circle?.(scene.player?.x||0,(scene.player?.y||0)-50,30,0x67e8f9,.18)?.setStrokeStyle?.(4,0xeaffff,.95)?.setDepth?.(140)||null;if(!state.overloaded&&state.visual){state.visual.destroy?.();state.visual=null;}state.visual?.setPosition?.(scene.player?.x||0,(scene.player?.y||0)-50);};
    system.passiveUpdaters.push(updater);return()=>{attackOff?.();castOff?.();system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater);state.overloaded=false;state.energy=0;state.visual?.destroy?.();clearMechTasks(system,OVERLOAD_CORE_ID);syncOverloadBonuses(system,state);delete system.passiveState.overloadCore;};},
  onAcquire(system){const state=system.passiveState.overloadCore,data=system.getData(OVERLOAD_CORE_ID);if(state?.overloaded)syncOverloadBonuses(system,state);else if(state&&data&&state.energy>=data.threshold)startOverload(system,state,data);},
  shiftTimers(system,duration,pausedAt){const state=system.passiveState.overloadCore;if(state?.overloaded&&state.endsAt>pausedAt)state.endsAt+=duration;}
};
