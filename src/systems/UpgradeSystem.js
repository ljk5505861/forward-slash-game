import { SKILLS } from '../config/skills.js';
import { CombatEvents, RunStates } from '../core/CombatEvents.js';
import { REWARD_BIAS } from '../config/rewardBias.js';
import { getBuildBiasContext, calculateBuildBiasWeight, createWeightedCandidates } from '../utils/rewardWeighting.js';
import { MAX_SKILL_SLOTS } from './SkillSystem.js';

export const SKILL_MILESTONES = Object.freeze({ 3:'机制强化 I', 6:'机制强化 II', 9:'机制质变' });
export const skillMilestoneText = (skill, level) => skill?.milestones?.[level] || skill?.levels?.[level - 1]?.milestoneText || '';
export const RewardSources = Object.freeze({ STAGE_SKILL_REWARD:'stageSkillReward', CAMPFIRE:'campfire', DEBUG:'debug', OTHER_FREE_REWARD:'otherFreeReward' });

const equalRandomPick=(items,count,random=Math.random)=>{
  const pool=[...(Array.isArray(items)?items:[])];
  for(let i=pool.length-1;i>0;i-=1){
    const roll=Math.min(0.999999,Math.max(0,random()));
    const j=Math.floor(roll*(i+1));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  return pool.slice(0,Math.max(0,count));
};

const startingOption=skill=>({
  type:'startingSkill',
  id:`start_${skill.id}`,
  title:`获得技能：${skill.name}`,
  skillId:skill.id,
  nextLevel:1
});

export default class UpgradeSystem{
  constructor(scene){ this.scene=scene; this.pending=0; this.panelOpen=false; this.replacingSkillId=null; this.pendingReplacement=null; }
  reset(){ this.pending=0; this.panelOpen=false; this.replacingSkillId=null; this.pendingReplacement=null; }
  gainExperience(){ return false; }
  buildBiasContext(){ const p=this.scene.playerData; return getBuildBiasContext({ skills:p.skills, artifacts:p.artifacts, professionId:p.professionId, config:REWARD_BIAS }); }
  weightSkillOption(option, skill, baseWeight, context){ const bias=calculateBuildBiasWeight({ baseWeight, tags:skill.tags, context }); return { ...option, tags:skill.tags||[], baseWeight, ...bias }; }
  isSkillUnlocked(){ return true; }
  rollOptions(){ const p=this.scene.playerData, context=this.buildBiasContext(), candidates=[]; Object.values(SKILLS).forEach(skill=>{ const own=p.skills.find(s=>s.id===skill.id); if(own){ if(own.level<skill.maxLevel) candidates.push(this.weightSkillOption({type:'skillLevel',id:`lv_${skill.id}`,title:`升级：${skill.name} Lv.${own.level+1}`,skillId:skill.id,nextLevel:own.level+1},skill,8,context)); } else candidates.push(this.weightSkillOption({type:'newSkill',id:`new_${skill.id}`,title:`获得：${skill.name}`,skillId:skill.id,nextLevel:1},skill,p.skills.length>=MAX_SKILL_SLOTS?3:6,context)); }); const picked=createWeightedCandidates(candidates,{count:3,uniqueKey:o=>o.skillId}); return picked.slice(0,3); }
  rollHighQualityOptions(){ return this.rollOptions(); }
  rollStartingOptions(){
    const skills=Object.values(SKILLS);
    const mythics=skills.filter(skill=>skill.rarity==='MYTHIC'||skill.ultimateSkill);
    const regular=skills.filter(skill=>!mythics.includes(skill));
    const firstTwo=equalRandomPick(regular,2);
    const mythic=equalRandomPick(mythics,1)[0];
    return [...firstTwo,...(mythic?[mythic]:[])].map(startingOption);
  }
  maybeShow({force=false,title='技能三选一',source=RewardSources.STAGE_SKILL_REWARD,meta={}}={}){ if(this.panelOpen||this.pending<=0) return; const s=this.scene; if(!force && s.hasBlockingModal?.()) return; s.beginGameplayPause(); s.runState=RunStates.UPGRADING; this.panelOpen=true; const options=this.rollOptions(); s.upgradePanel.show({ title, options, onConfirm:o=>this.applyOption(o,{source,meta,originalOptions:options}) }); }
  requestSkillReward(title='技能三选一', { source=RewardSources.STAGE_SKILL_REWARD, meta={} }={}){ this.pending+=1; this.maybeShow({force:true,title,source,meta}); }
  applyFreeOption(o, meta={}){ return this.applyOption(o, { free:true, keepPanel:false, source:meta.source||RewardSources.OTHER_FREE_REWARD, meta }); }
  applyOption(o,{free=false,keepPanel=false,meta={},source=RewardSources.OTHER_FREE_REWARD,originalOptions=null}={}){ if(['newSkill','skillLevel','startingSkill'].includes(o.type)){ const result=this.scene.skillSystem.addOrLevel(o.skillId); if(result?.needsReplacement){ this.replacingSkillId=o.skillId; this.pendingReplacement={ option:o, skillId:o.skillId, free, source, meta, originalOptions:originalOptions?.slice?.()||[], shouldConsumePending:!free, shouldAdvanceStage:source===RewardSources.STAGE_SKILL_REWARD, completed:false }; this.scene.upgradePanel?.showReplacement?.(o, idx=>this.confirmReplacement(idx), ()=>this.cancelReplacement()); return false; } }
    return this.completeSkillChoice({ option:o, free, keepPanel, meta, source }); }
  completeSkillChoice({ option, free=false, keepPanel=false, meta={}, source=RewardSources.OTHER_FREE_REWARD }){ const p=this.scene.playerData; p.upgradesChosen.push(option.id); this.scene.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{ optionId:option.id, option, skillId:option.skillId, type:option.type, level:p.skills.find(s=>s.id===option.skillId)?.level ?? p.level, free, source, ...meta }); if(!free) this.pending=Math.max(0,this.pending-1); this.panelOpen=false; if(!keepPanel) this.scene.upgradePanel.hide(); this.scene.hud?.update(); this.scene.skillBar?.update(); if(source===RewardSources.STAGE_SKILL_REWARD) this.scene.stageSystem?.onSkillRewardClosed?.(); this.scene.resumeModalFlow(); return true; }
  confirmReplacement(index){ const pending=this.pendingReplacement; if(!pending||pending.completed) return false; pending.completed=true; const before=this.scene.playerData.skills.map(s=>s.id); const result=this.scene.skillSystem.replaceSkill(index, pending.skillId); const replaced=this.scene.playerData.skills[index]; if(!result?.applied || replaced?.id!==pending.skillId || replaced?.level!==1){ pending.completed=false; return false; } this.replacingSkillId=null; this.pendingReplacement=null; this.completeSkillChoice({ option:pending.option, free:pending.free, meta:pending.meta, source:pending.source }); return before[index]!==pending.skillId; }
  cancelReplacement(){ const pending=this.pendingReplacement; this.replacingSkillId=null; this.pendingReplacement=null; const options=pending?.originalOptions?.length ? pending.originalOptions : []; this.panelOpen=true; this.scene.upgradePanel.show({ title:'技能三选一', options, onConfirm:o=>this.applyOption(o,{ free:pending?.free||false, source:pending?.source||RewardSources.OTHER_FREE_REWARD, meta:pending?.meta||{}, originalOptions:options }) }); }
}
