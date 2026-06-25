import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';
import { poisonSummonBonusUtils } from './PoisonSummonAdvancedSkills.js';

const levels=(values,build,milestones={})=>values.map((value,index)=>({ ...build(value,index+1), ...(milestones[index+1]?{milestoneText:milestones[index+1]}:{}) }));
const removeUpdater=(system,updater)=>{ const index=system.passiveUpdaters.indexOf(updater); if(index>=0) system.passiveUpdaters.splice(index,1); };
const bonusSum=bonuses=>poisonSummonBonusUtils.sumBonuses(bonuses);

const CONFIGS={
  parasitic_gu:{ id:'parasitic_gu',name:'寄生蛊',rarity:'RARE',handler:'parasitic_gu',passive:true,maxLevel:9,coreSkill:true,requiredSkillId:'poison_cloud',tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],cooldownMs:999999,targetType:'passive',color:0x8ad66f,short:'蛊',description:'寄生在中毒目标体内，吸收毒伤成长；宿主死亡后转移到新的中毒目标。',levels:levels([[0.18,18,0.10],[0.21,20,0.11],[0.24,22,0.12],[0.27,24,0.13],[0.30,26,0.14],[0.34,28,0.16],[0.38,30,0.18],[0.42,32,0.20],[0.48,36,0.23]],([absorbRatio,maxGrowth,damagePerGrowth])=>({absorbRatio,maxGrowth,damagePerGrowth,desc:`吸收毒伤的${Math.round(absorbRatio*100)}%成长，成长会转化为寄生伤害。`}),{3:'吸收比例提高至24%，成长上限提高至22',6:'吸收比例提高至34%，成长上限提高至28',9:'吸收比例提高至48%，成长上限提高至36'}) },
  bone_eating_insect:{ id:'bone_eating_insect',name:'蚀骨毒虫',rarity:'RARE',handler:'bone_eating_insect',passive:true,maxLevel:9,coreSkill:true,requiredSkillId:'poison_cloud',tags:[TAGS.POISON,TAGS.DOT,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],cooldownMs:999999,targetType:'passive',color:0xb2ef72,short:'虫',description:'召唤毒虫追猎中毒目标，延长感染并根据感染规模增加毒虫数量。',levels:levels([[1,7,700,2600,15],[1,8,760,2450,14],[2,8,820,2300,14],[2,9,900,2150,13],[2,10,980,2000,13],[3,10,1080,1850,12],[3,11,1180,1700,12],[3,12,1300,1550,11],[4,14,1450,1400,10]],([baseCount,damage,extendMs,attackIntervalMs,stacksPerExtra])=>({baseCount,damage,extendMs,attackIntervalMs,stacksPerExtra,maxCount:baseCount+2,desc:`维持${baseCount}只毒虫，命中造成${damage}点伤害并延长中毒。`}),{3:'基础毒虫增加至2只，并进一步延长感染',6:'基础毒虫增加至3只，攻击间隔缩短',9:'基础毒虫增加至4只，攻击间隔缩短至1.4秒'}) }
};

export function configurePoisonSummonCoreSkills(){ Object.entries(CONFIGS).forEach(([id,cfg])=>{ SKILLS[id]={...cfg}; }); }

export const ParasiticGuSkill={ bind(system){
  const s=system.scene; const runtime=poisonSummonBonusUtils.ensurePoisonRuntime?.(s); let host=null,growth=0,marker=null;
  const infected=()=>s.targeting.all().filter(e=>s.statusEffects.has(e,StatusEffects.POISON));
  const choose=()=>infected().sort((a,b)=>s.statusEffects.getStackCount(b,StatusEffects.POISON)-s.statusEffects.getStackCount(a,StatusEffects.POISON))[0]||null;
  const publish=()=>runtime?.setParasiticGuSnapshot?.({ host, growth, maxGrowth:(system.getData('parasitic_gu')?.maxGrowth)||0 });
  const attach=target=>{ host=target; marker?.destroy?.(); marker=target?s.add.circle(target.x,target.y-88,8,0x8ad66f,0.85).setStrokeStyle(2,0xe4ffd0,0.9).setDepth(152):null; if(target)s.floatText(target.x,target.y-105,'寄生','#9be67a'); publish(); };
  const offTick=s.eventBus.on(CombatEvents.STATUS_TICK,p=>{ const data=system.getData('parasitic_gu'); if(!data||p.type!==StatusEffects.POISON||p.actualDamage<=0)return; if(!host||!s.targeting.valid(host)||!s.statusEffects.has(host,StatusEffects.POISON))attach(choose()||p.target); if(p.target!==host)return; poisonSummonBonusUtils.ensureRuntime(s.playerData); const absorbRatio=data.absorbRatio*(1+bonusSum(s.playerData.parasiticGuAbsorbBonuses)); const maxGrowth=data.maxGrowth*(1+bonusSum(s.playerData.parasiticGuGrowthCapBonuses)); const damagePerGrowth=data.damagePerGrowth*(1+bonusSum(s.playerData.parasiticGuDamageBonuses)); growth=Math.min(maxGrowth,growth+p.actualDamage*absorbRatio); publish(); const bonus=Math.floor(growth*damagePerGrowth); if(bonus>0&&s.targeting.valid(host))s.combatSystem.damageEnemy(host,bonus,{source:'skill',skillId:'parasitic_gu',tags:[TAGS.POISON,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],allowLifeSteal:false,noKnockback:true}); });
  const offKill=s.eventBus.on(CombatEvents.ENEMY_KILLED,p=>{ if(p.enemy===host)attach(choose()); });
  const updater=()=>{ if(host&&!s.targeting.valid(host))attach(choose()); if(marker&&host){ marker.x=host.x; marker.y=host.y-88; } publish(); };
  system.passiveUpdaters.push(updater); return ()=>{ offTick(); offKill(); removeUpdater(system,updater); marker?.destroy?.(); host=null; growth=0; runtime?.setParasiticGuSnapshot?.(null); };
} };

export const BoneEatingInsectSkill={ bind(system){
  const s=system.scene,insects=[]; const clear=()=>insects.splice(0).forEach(i=>i.view?.destroy?.());
  const updater=()=>{ const data=system.getData('bone_eating_insect'); if(!data){ clear(); return; } const targets=s.targeting.all().filter(e=>s.statusEffects.has(e,StatusEffects.POISON)); const stacks=targets.reduce((sum,e)=>sum+s.statusEffects.getStackCount(e,StatusEffects.POISON),0); const desired=targets.length?Math.min(data.maxCount,data.baseCount+Math.floor(stacks/data.stacksPerExtra)):0;
    while(insects.length<desired){ const view=s.add.circle(s.player.x-20,s.player.y-28,6,0xb2ef72,0.9).setStrokeStyle(2,0x426d24,1).setDepth(146); insects.push({view,readyAt:s.getGameplayTime()+insects.length*180}); }
    while(insects.length>desired)insects.pop().view.destroy(); const now=s.getGameplayTime(); insects.forEach((insect,index)=>{ const target=targets[index%Math.max(1,targets.length)]||null; const tx=target?target.x-20+(index%3)*18:s.player.x-35-index*14; const ty=target?target.y-55+(index%2)*16:s.player.y-35; insect.view.x+=(tx-insect.view.x)*0.24; insect.view.y+=(ty-insect.view.y)*0.24; if(!target||now<insect.readyAt)return; poisonSummonBonusUtils.ensureRuntime(s.playerData); const attackSpeedBonus=bonusSum(s.playerData.poisonInsectAttackSpeedBonuses); const interval=Math.max(poisonSummonBonusUtils.MIN_INSECT_INTERVAL_MS,Math.round(data.attackIntervalMs*(1-attackSpeedBonus))); const damage=Math.max(1,Math.round(data.damage*(1+bonusSum(s.playerData.poisonInsectDamageBonuses)))); const extendMs=Math.min(poisonSummonBonusUtils.MAX_SINGLE_EXTEND_MS,Math.round(data.extendMs*(1+bonusSum(s.playerData.poisonInsectExtendBonuses)))); insect.readyAt=now+interval; s.combatSystem.damageEnemy(target,damage,{source:'skill',skillId:'bone_eating_insect',tags:[TAGS.POISON,TAGS.SUMMON,TAGS.BUILD_POISON_SUMMON],allowLifeSteal:false,noKnockback:true}); s.statusEffects.getEffects(target,StatusEffects.POISON).forEach(effect=>{ effect.expiresAt=Math.min(now+poisonSummonBonusUtils.MAX_EFFECT_REMAINING_MS,effect.expiresAt+extendMs); }); s.floatText(target.x,target.y-98,'蚀骨','#b7ef74'); }); };
  system.passiveUpdaters.push(updater); updater(); return ()=>{ removeUpdater(system,updater); clear(); };
} };
