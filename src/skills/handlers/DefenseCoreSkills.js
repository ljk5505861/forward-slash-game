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
    description:'提高最大护盾；同一时间最多存在一层守护盾，护盾存在期间不会叠加、刷新或补充，护盾消失后进入充能，充能结束重新生成。',
    levels:levels([
      [30,0.80,12,5000,8000,1.0],[36,0.90,14,4800,8000,1.0],[42,1.00,16,4600,8000,1.3],[50,1.15,18,4400,8000,1.3],[58,1.30,20,4200,8000,1.3],[68,1.50,24,4000,null,1.3],[80,1.70,28,3800,null,1.3],[92,1.90,32,3600,null,1.3],[105,2.20,36,3400,null,1.3]
    ],([maxShieldBonus,defenseScale,flatShield,rechargeMs,durationMs,generatedShieldMultiplier],level)=>({ maxShieldBonus,defenseScale,flatShield,rechargeMs,durationMs,generatedShieldMultiplier,persistent:durationMs==null,regenRatio:level>=9?0.4:0,regenDelayMs:1000,regenCooldownMs:8000,desc:level===1?`最大护盾+${maxShieldBonus}；生成一层“有效防御×${defenseScale.toFixed(2)}+${flatShield}”的守护盾，持续8秒；护盾消失后充能${(rechargeMs/1000).toFixed(1)}秒重新生成，护盾存在期间不会叠加或刷新。`:level>=3?`最大护盾+${maxShieldBonus}；普通守护盾值提高30%，生成量为“（有效防御×${defenseScale.toFixed(2)}+${flatShield}）×1.30”${durationMs?'，持续8秒':'；守护盾不再自然到期'}；${level>=9?'被打空后可触发护盾再生，普通充能为':'护盾消失后充能'}${(rechargeMs/1000).toFixed(1)}秒${level>=9?'。':'重新生成。'}`:`最大护盾+${maxShieldBonus}；生成“有效防御×${defenseScale.toFixed(2)}+${flatShield}”的守护盾，持续8秒；护盾消失后充能${(rechargeMs/1000).toFixed(1)}秒重新生成。` }),{
      3:'厚重守护：普通守护盾生成量提高30%。',
      6:'不灭之盾：守护盾生成的护盾不再自然到期。',
      9:'护盾再生：正常守护盾被打空时，1秒后恢复最大护盾40%；再生护盾不会再次触发该效果。'
    })
  }};

export function configureDefenseCoreSkills(){ Object.entries(DEFENSE_CORE_SKILLS).forEach(([id,config])=>{ SKILLS[id]={...config}; }); }

const activeNow=s=>Math.max(0,(s.getGameplayTime?.()??s.time?.now??0)-(s.runStats?.pausedDurationMs||0));
const validDirectDamage=p=>!!p?.enemy&&p.directAttack===true&&((p.hpDamage||0)+(p.shieldAbsorbed||0))>0&&!p.blocked;
const shieldSourcePriority=effect=>String(effect?.sourceId||'').startsWith('guardian_shield')?0:1;
const actualShieldTotal=(s,p)=>(s.statusEffects?.getEffects?.(p,StatusEffects.SHIELD)||[]).reduce((sum,e)=>sum+Math.max(0,e.remainingValue||0),Math.max(0,p.permanentShield||0));
const clampShieldToMax=(s,p)=>{ const maxShield=Math.max(0,Number(p.maxShield)||0),effects=s.statusEffects?.getEffects?.(p,StatusEffects.SHIELD)||[]; let excess=Math.max(0,actualShieldTotal(s,p)-maxShield); if(excess>0){ [...effects].sort((a,b)=>shieldSourcePriority(a)-shieldSourcePriority(b)||(b.id||0)-(a.id||0)).forEach(effect=>{ if(excess<=0) return; const current=Math.max(0,effect.remainingValue||0),removed=Math.min(current,excess); effect.remainingValue=current-removed; excess-=removed; if(effect.remainingValue<=0) s.statusEffects?.removeEffect?.(effect,'shieldCapReduced'); }); if(excess>0){ const removed=Math.min(Math.max(0,p.permanentShield||0),excess); p.permanentShield=Math.max(0,(p.permanentShield||0)-removed); } } s.statusEffects?.syncPlayerDerived?.(); };

export const ThornArmorSkill={ bind(system){ let readyAt=0; return system.scene.eventBus.on(CombatEvents.PLAYER_DAMAGED,payload=>{ const s=system.scene,data=system.getData('thorn_armor'),enemy=payload.enemy,now=activeNow(s); if(!data||!validDirectDamage(payload)||now<readyAt||!s.targeting.valid(enemy)) return; readyAt=now+data.internalCooldownMs; const suffered=(payload.hpDamage||0)+(payload.shieldAbsorbed||0); const base=Math.max(1,Math.round(getEffectiveDefense(s.playerData)*data.defenseScale+data.flatDamage+suffered*(data.sufferedRatio||0))); s.combatSystem.damageEnemy(enemy,base,{ source:'reflect', skillId:'thorn_armor', tags:['physical',TAGS.BUILD_DEFENSE], allowLifeSteal:false, noKnockback:true, defenseIgnore:data.defenseIgnore||0, noThornTrigger:true }); if(data.burstRadius>0){ s.targeting.all().filter(e=>e!==enemy&&Math.hypot(e.x-enemy.x,e.y-enemy.y)<=data.burstRadius).forEach(e=>s.combatSystem.damageEnemy(e,Math.round(base*data.burstRatio),{ source:'reflect', damageKind:'thornBurst', skillId:'thorn_armor', tags:['physical','area',TAGS.BUILD_DEFENSE], allowLifeSteal:false, noKnockback:true, defenseIgnore:data.defenseIgnore||0, noThornTrigger:true })); } s.floatText?.(enemy.x,enemy.y-92,`反伤 ${base}`,'#b7e887'); }); } };

export const GuardianShieldSkill={ bind(system){ const s=system.scene,p=s.playerData; let cooldownStartedAt=null,regenDueAt=0,regenCooldownUntil=0,lastHadGuardian=false,cleaned=false; const isGuardian=e=>String(e?.sourceId||'').startsWith('guardian_shield'); const isNormal=e=>e?.guardianShieldKind==='normal'||String(e?.sourceId||'').startsWith('guardian_shield:'); const guardianEffects=()=>s.statusEffects?.getEffects?.(p,StatusEffects.SHIELD)?.filter(isGuardian)||[]; const getSkillBarState=()=>{ const data=system.getData('guardian_shield'),now=activeNow(s); if(!data||p.hp<=0) return null; if(guardianEffects().length>0) return null; if(regenDueAt>now) return { phase:'regen', label:'再生', remainingMs:Math.max(0,regenDueAt-now) }; if(cooldownStartedAt!==null) return { phase:'recharge', label:'充能', remainingMs:Math.max(0,data.rechargeMs-(now-cooldownStartedAt)) }; return null; }; const runtime={ getSkillBarState }; s.guardianShieldRuntime=runtime; const syncMax=()=>{ p.baseMaxShield??=(p.maxShield||50); p.maxShieldBonuses??={}; const data=system.getData('guardian_shield'); if(data) p.maxShieldBonuses.guardian_shield=data.maxShieldBonus||0; else delete p.maxShieldBonuses.guardian_shield; p.maxShield=(p.baseMaxShield||50)+Object.values(p.maxShieldBonuses||{}).reduce((a,b)=>a+(Number(b)||0),0); clampShieldToMax(s,p); }; const startCooldown=now=>{ cooldownStartedAt=now; }; const addGuardianShield=(requested,{persistent=false,sourceId='guardian_shield',durationMs=1,kind='normal'}={})=>{ syncMax(); const room=Math.max(0,(p.maxShield||0)-actualShieldTotal(s,p)); const amount=Math.min(Math.max(0,Math.round(requested||0)),room); if(amount<=0){ startCooldown(activeNow(s)); return null; } const effect=s.statusEffects.add(StatusEffects.SHIELD,p,{ durationMs,persistent,expiresNaturally:!persistent,value:amount,remainingValue:amount,sourceId,guardianShieldKind:kind }); clampShieldToMax(s,p); return effect; }; const grant=()=>{ const data=system.getData('guardian_shield'); if(!data||guardianEffects().length) return null; const generated=Math.max(1,Math.round((getEffectiveDefense(p)*data.defenseScale+data.flatShield)*(data.generatedShieldMultiplier||1))); const effect=addGuardianShield(generated,{durationMs:data.durationMs??1,persistent:!!data.persistent,sourceId:'guardian_shield',kind:'normal'}); if(effect){ cooldownStartedAt=null; lastHadGuardian=true; s.floatText?.(s.player.x,s.player.y-104,`守护盾 +${effect.remainingValue}`,'#8fd7ff'); s.hud?.update?.(); } return effect; }; const grantRegen=()=>{ const data=system.getData('guardian_shield'); if(!data||system.getLevel('guardian_shield')<9||guardianEffects().length) return null; const effect=addGuardianShield(Math.round((p.maxShield||0)*(data.regenRatio||0)),{persistent:true,sourceId:'guardian_shield_regen',kind:'regen'}); if(effect){ cooldownStartedAt=null; lastHadGuardian=true; s.floatText?.(s.player.x,s.player.y-104,`护盾再生 +${effect.remainingValue}`,'#8fd7ff'); s.hud?.update?.(); } return effect; }; const updater=()=>{ const data=system.getData('guardian_shield'),now=activeNow(s); syncMax(); if(!data){ cooldownStartedAt=null; regenDueAt=0; lastHadGuardian=false; return; } if(p.hp<=0){ regenDueAt=0; return; } const effects=guardianEffects(); if(data.persistent) effects.filter(e=>isNormal(e)).forEach(e=>{ e.persistent=true; e.expiresNaturally=false; e.expiresAt=Number.POSITIVE_INFINITY; }); const hasGuardian=effects.length>0; if(regenDueAt&&now>=regenDueAt){ regenDueAt=0; if(!grantRegen()) startCooldown(now); }
      if(hasGuardian){ cooldownStartedAt=null; lastHadGuardian=true; return; }
      if(lastHadGuardian){ lastHadGuardian=false; if(!regenDueAt) startCooldown(now); }
      if(regenDueAt) return;
      if(cooldownStartedAt===null) startCooldown(now);
      if(now-cooldownStartedAt>=data.rechargeMs){ if(!grant()) startCooldown(now); }
    }; const offDamaged=s.eventBus.on(CombatEvents.PLAYER_DAMAGED,payload=>{ const data=system.getData('guardian_shield'),now=activeNow(s),effect=(payload?.brokenShieldEffects||[]).find(e=>isGuardian(e)); if(!data||!effect||p.hp<=0) return; lastHadGuardian=false; if(!isNormal(effect)||system.getLevel('guardian_shield')<9||regenDueAt||now<regenCooldownUntil){ startCooldown(now); return; } regenDueAt=now+(data.regenDelayMs||1000); regenCooldownUntil=now+(data.regenCooldownMs||8000); cooldownStartedAt=null; }); system.passiveUpdaters.push(updater); updater(); return ()=>{ if(cleaned) return; cleaned=true; offDamaged?.(); if(s.guardianShieldRuntime===runtime) s.guardianShieldRuntime=null; cooldownStartedAt=null; regenDueAt=0; regenCooldownUntil=0; lastHadGuardian=false; guardianEffects().forEach(effect=>s.statusEffects?.removeEffect?.(effect,'guardianShieldRemoved')); delete p.maxShieldBonuses?.guardian_shield; p.maxShield=(p.baseMaxShield||50)+Object.values(p.maxShieldBonuses||{}).reduce((a,b)=>a+(Number(b)||0),0); clampShieldToMax(s,p); system.passiveUpdaters=system.passiveUpdaters.filter(fn=>fn!==updater); }; } };
