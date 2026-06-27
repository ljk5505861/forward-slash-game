import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';
import { getEffectiveDefense } from '../../config/balance.js';

const levels = (values, build, milestones={}) => values.map((value,index)=>({
  ...build(value,index+1),
  ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}),
}));

const DEFENSE_CORE_SKILLS = {
  thorn_armor: {
    id:'thorn_armor', name:'反甲', rarity:'RARE', handler:'thorn_armor', passive:true, maxLevel:9,
    coreSkill:true,
    tags:['physical',TAGS.BUILD_DEFENSE], cooldownMs:999999,
    targetType:'passive', color:0x9fd37a, short:'反',
    description:'受到敌人直接攻击时，根据当前有效防御对攻击者造成物理反伤。护盾吸收的攻击同样可以触发。',
    levels:levels([
      [0.80,8,500],[0.95,9,480],[1.10,10,450],[1.30,12,420],[1.50,14,390],[1.75,16,350],[2.00,18,320],[2.30,21,280],[2.70,25,250]
    ],([defenseScale,flatDamage,internalCooldownMs],level)=>({ defenseScale,flatDamage,internalCooldownMs,defenseIgnore:level>=3?0.40:0,burstRadius:level>=6?120:0,burstRatio:level>=6?0.60:0,sufferedRatio:level>=9?1:0,desc:`防御系数${defenseScale.toFixed(2)}，固定伤害${flatDamage}，内置冷却${internalCooldownMs}ms${level>=3?'；反甲伤害无视目标40%防御':''}${level>=6?'；120范围爆裂造成60%伤害':''}${level>=9?'；附加本次承伤100%':''}。` }),{
      3:'破甲尖刺：反伤无视目标40%防御。',
      6:'荆棘爆裂：反伤时产生120范围爆裂，对周围敌人造成反伤基础伤害60%的物理伤害。',
      9:'以伤还伤：反伤额外附加本次生命损失与护盾吸收总量100%的物理伤害。'
    })
  },
  guardian_shield: {
    id:'guardian_shield', name:'守护盾', rarity:'RARE', handler:'guardian_shield', passive:true, maxLevel:9,
    coreSkill:true,
    tags:[TAGS.SHIELD,TAGS.BUILD_DEFENSE], cooldownMs:999999,
    targetType:'passive', color:0x8fd7ff, short:'盾',
    description:'提高最大护盾，并周期获得基于当前有效防御的护盾。',
    levels:levels([
      [30,0.80,12,7000,8000],[36,0.90,14,6800,8000],[42,1.00,16,6500,8000],[50,1.15,18,6200,8000],[58,1.30,20,6000,8000],[68,1.50,24,5700,null],[80,1.70,28,5400,null],[92,1.90,32,5100,null],[105,2.20,36,4800,null]
    ],([maxShieldBonus,defenseScale,flatShield,intervalMs,durationMs],level)=>({ maxShieldBonus,defenseScale,flatShield,intervalMs,durationMs,persistent:durationMs==null,regenRatio:level>=9?0.4:0,regenDelayMs:1000,regenCooldownMs:8000,desc:`最大护盾+${maxShieldBonus}；每${(intervalMs/1000).toFixed(1)}秒获得有效防御×${defenseScale.toFixed(2)}+${flatShield}护盾；${durationMs?`${durationMs/1000}秒后到期`:'不会自然消失'}。` }),{
      3:'迎战之盾：每场战斗开始时立即生成一次守护盾。',
      6:'不灭之盾：守护盾生成的护盾不再自然到期。',
      9:'护盾再生：总护盾从大于0降至0时，1秒后恢复最大护盾40%。'
    })
  }
};

export function configureDefenseCoreSkills(){ Object.entries(DEFENSE_CORE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

const activeNow=s=>Math.max(0,(s.getGameplayTime?.()??s.time?.now??0)-(s.runStats?.pausedDurationMs||0));
const validDirectDamage=p=>!!p?.enemy&&p.directAttack===true&&((p.hpDamage||0)+(p.shieldAbsorbed||0))>0&&!p.blocked;
const shieldSourcePriority=effect=>String(effect?.sourceId||'').startsWith('guardian_shield')?0:1;
const actualShieldTotal=(s,p)=>(s.statusEffects?.getEffects?.(p,StatusEffects.SHIELD)||[]).reduce((sum,e)=>sum+Math.max(0,e.remainingValue||0),Math.max(0,p.permanentShield||0));
const clampShieldToMax=(s,p)=>{ const maxShield=Math.max(0,Number(p.maxShield)||0),effects=s.statusEffects?.getEffects?.(p,StatusEffects.SHIELD)||[]; let excess=Math.max(0,actualShieldTotal(s,p)-maxShield); if(excess>0){ [...effects].sort((a,b)=>shieldSourcePriority(a)-shieldSourcePriority(b)||(b.id||0)-(a.id||0)).forEach(effect=>{ if(excess<=0) return; const current=Math.max(0,effect.remainingValue||0),removed=Math.min(current,excess); effect.remainingValue=current-removed; excess-=removed; if(effect.remainingValue<=0) s.statusEffects?.removeEffect?.(effect,'shieldCapReduced'); }); if(excess>0){ const removed=Math.min(Math.max(0,p.permanentShield||0),excess); p.permanentShield=Math.max(0,(p.permanentShield||0)-removed); } } s.statusEffects?.syncPlayerDerived?.(); };

export const ThornArmorSkill={ bind(system){ let readyAt=0; return system.scene.eventBus.on(CombatEvents.PLAYER_DAMAGED,payload=>{ const s=system.scene,data=system.getData('thorn_armor'),enemy=payload.enemy,now=activeNow(s); if(!data||!validDirectDamage(payload)||now<readyAt||!s.targeting.valid(enemy)) return; readyAt=now+data.internalCooldownMs; const suffered=(payload.hpDamage||0)+(payload.shieldAbsorbed||0); const base=Math.max(1,Math.round(getEffectiveDefense(s.playerData)*data.defenseScale+data.flatDamage+suffered*(data.sufferedRatio||0))); s.combatSystem.damageEnemy(enemy,base,{ source:'reflect', skillId:'thorn_armor', tags:['physical',TAGS.BUILD_DEFENSE], allowLifeSteal:false, noKnockback:true, defenseIgnore:data.defenseIgnore||0, noThornTrigger:true }); if(data.burstRadius>0){ s.targeting.all().filter(e=>e!==enemy&&Math.hypot(e.x-enemy.x,e.y-enemy.y)<=data.burstRadius).forEach(e=>s.combatSystem.damageEnemy(e,Math.round(base*data.burstRatio),{ source:'reflect', damageKind:'thornBurst', skillId:'thorn_armor', tags:['physical','area',TAGS.BUILD_DEFENSE], allowLifeSteal:false, noKnockback:true, defenseIgnore:data.defenseIgnore||0, noThornTrigger:true })); } s.floatText?.(enemy.x,enemy.y-92,`反伤 ${base}`,'#b7e887'); }); } };

export const GuardianShieldSkill={ bind(system){ const s=system.scene,p=s.playerData,seenCombatKeys=new Set(); let nextReadyAt=0,regenDueAt=0,regenCooldownUntil=0; const syncMax=()=>{ p.baseMaxShield??=(p.maxShield||50); p.maxShieldBonuses??={}; const data=system.getData('guardian_shield'); if(data) p.maxShieldBonuses.guardian_shield=data.maxShieldBonus||0; else delete p.maxShieldBonuses.guardian_shield; p.maxShield=(p.baseMaxShield||50)+Object.values(p.maxShieldBonuses||{}).reduce((a,b)=>a+(Number(b)||0),0); clampShieldToMax(s,p); }; const addGuardianShield=(requested,{persistent=false,sourceId='guardian_shield',durationMs=1}={})=>{ syncMax(); const room=Math.max(0,(p.maxShield||0)-actualShieldTotal(s,p)); const amount=Math.min(Math.max(0,Math.round(requested||0)),room); if(amount<=0) return null; const effect=s.statusEffects.add(StatusEffects.SHIELD,p,{ durationMs,persistent,expiresNaturally:!persistent,value:amount,remainingValue:amount,sourceId }); clampShieldToMax(s,p); return effect; }; const grant=()=>{ const data=system.getData('guardian_shield'); if(!data) return null; const generated=Math.max(1,Math.round(getEffectiveDefense(p)*data.defenseScale+data.flatShield)); const effect=addGuardianShield(generated,{durationMs:data.durationMs??1,persistent:!!data.persistent,sourceId:'guardian_shield'}); if(effect){ s.floatText?.(s.player.x,s.player.y-104,`守护盾 +${effect.remainingValue}`,'#8fd7ff'); s.hud?.update?.(); } return effect; }; const updater=()=>{ const data=system.getData('guardian_shield'),now=activeNow(s); syncMax(); if(!data){ nextReadyAt=0; regenDueAt=0; return; } if(p.hp<=0){ regenDueAt=0; return; } if(nextReadyAt===0) nextReadyAt=now+data.intervalMs; if(regenDueAt&&now>=regenDueAt){ regenDueAt=0; const amount=Math.round((p.maxShield||0)*(data.regenRatio||0)); if(amount>0&&system.getLevel('guardian_shield')>=9) addGuardianShield(amount,{persistent:true,sourceId:'guardian_shield_regen'}); } if(now>=nextReadyAt){ grant(); nextReadyAt=now+data.intervalMs; } }; const offCombat=s.eventBus.on(CombatEvents.COMBAT_STARTED,payload=>{ const data=system.getData('guardian_shield'),key=`${payload.kind}:${payload.group}:${payload.wave}:${payload.bossId||payload.flowBossType||''}`; if(!data||system.getLevel('guardian_shield')<3||seenCombatKeys.has(key)) return; seenCombatKeys.add(key); grant(); nextReadyAt=activeNow(s)+data.intervalMs; }); const offDamaged=s.eventBus.on(CombatEvents.PLAYER_DAMAGED,payload=>{ const data=system.getData('guardian_shield'),now=activeNow(s); if(!data||system.getLevel('guardian_shield')<9||!payload?.shieldDepleted||regenDueAt||now<regenCooldownUntil||p.hp<=0) return; regenDueAt=now+(data.regenDelayMs||1000); regenCooldownUntil=now+(data.regenCooldownMs||8000); }); system.passiveUpdaters.push(updater); updater(); return ()=>{ offCombat?.(); offDamaged?.(); seenCombatKeys.clear(); regenDueAt=0; delete p.maxShieldBonuses?.guardian_shield; p.maxShield=(p.baseMaxShield||50)+Object.values(p.maxShieldBonuses||{}).reduce((a,b)=>a+(Number(b)||0),0); clampShieldToMax(s,p); system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater); }; } };
