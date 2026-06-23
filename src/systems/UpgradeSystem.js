import { SKILLS } from '../config/skills.js';
import { CombatEvents, RunStates } from '../core/CombatEvents.js';
import { REWARD_BIAS } from '../config/rewardBias.js';
import { getBuildBiasContext, calculateBuildBiasWeight, createWeightedCandidates } from '../utils/rewardWeighting.js';

export const SKILL_MILESTONES = Object.freeze({ 3:'机制强化 I', 6:'机制强化 II', 9:'机制质变' });
export const skillMilestoneText = (skill, level) => {
  const map={fireball:['爆炸范围扩大并点燃','额外火球','燃烧目标爆裂'], lightning:['额外弹射目标','重复命中衰减降低','雷击可连锁更多敌人'], spinning_blade:['旋转范围扩大','持续次数增加','命中附带轻击退'], poison_cloud:['毒云扩散','持续时间延长','毒层爆发'], sword_wave:['穿透增加','剑气宽度扩大','远距离斩击强化'], healing:['额外护盾','冷却降低','低血回复增强']};
  return (map[skill?.id]||['额外目标','冷却缩短','机制强化'])[{3:0,6:1,9:2}[level]];
};
export default class UpgradeSystem{
  constructor(scene){ this.scene=scene; this.pending=0; this.panelOpen=false; this.replacingSkillId=null; }
  reset(){ this.pending=0; this.panelOpen=false; this.replacingSkillId=null; }
  gainExperience(){ return false; }
  buildBiasContext(){ const p=this.scene.playerData; return getBuildBiasContext({ skills:p.skills, artifacts:p.artifacts, professionId:p.professionId, config:REWARD_BIAS }); }
  weightSkillOption(option, skill, baseWeight, context){ const bias=calculateBuildBiasWeight({ baseWeight, tags:skill.tags, context }); return { ...option, tags:skill.tags||[], baseWeight, ...bias }; }
  rollOptions(){ const p=this.scene.playerData, context=this.buildBiasContext(), candidates=[]; Object.values(SKILLS).forEach(skill=>{ const own=p.skills.find(s=>s.id===skill.id); if(own){ if(own.level<skill.maxLevel) candidates.push(this.weightSkillOption({type:'skillLevel',id:`lv_${skill.id}`,title:`升级：${skill.name} Lv.${own.level+1}`,skillId:skill.id,nextLevel:own.level+1},skill,8,context)); } else candidates.push(this.weightSkillOption({type:'newSkill',id:`new_${skill.id}`,title:`获得：${skill.name}`,skillId:skill.id,nextLevel:1},skill,p.skills.length>=4?3:6,context)); }); const picked=createWeightedCandidates(candidates,{count:3,uniqueKey:o=>o.skillId}); return picked.slice(0,3); }
  rollHighQualityOptions(){ return this.rollOptions(); }
  rollStartingOptions(){ return Object.values(SKILLS).sort(()=>Math.random()-0.5).slice(0,3).map(skill=>({type:'startingSkill',id:`start_${skill.id}`,title:`获得技能：${skill.name}`,skillId:skill.id,nextLevel:1})); }
  maybeShow({force=false,title='技能三选一'}={}){ if(this.panelOpen||this.pending<=0) return; const s=this.scene; if(!force && s.hasBlockingModal?.()) return; s.beginGameplayPause(); s.runState=RunStates.UPGRADING; this.panelOpen=true; s.upgradePanel.show({ title, options:this.rollOptions(), onConfirm:o=>this.applyOption(o) }); }
  requestSkillReward(title='技能三选一'){ this.pending+=1; this.maybeShow({force:true,title}); }
  applyFreeOption(o, meta={}){ return this.applyOption(o, { free:true, keepPanel:false, meta }); }
  applyOption(o,{free=false,keepPanel=false,meta={}}={}){ const p=this.scene.playerData; if(['newSkill','skillLevel','startingSkill'].includes(o.type)){ const result=this.scene.skillSystem.addOrLevel(o.skillId); if(result?.needsReplacement){ this.replacingSkillId=o.skillId; this.scene.upgradePanel?.showReplacement?.(o, idx=>this.confirmReplacement(idx), ()=>this.cancelReplacement()); return false; } } p.upgradesChosen.push(o.id); this.scene.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{ optionId:o.id, option:o, skillId:o.skillId, type:o.type, level:p.level, free, ...meta }); if(!free) this.pending=Math.max(0,this.pending-1); this.panelOpen=false; if(!keepPanel) this.scene.upgradePanel.hide(); this.scene.hud?.update(); this.scene.skillBar?.update(); this.scene.stageSystem?.onSkillRewardClosed?.(); this.scene.resumeModalFlow(); return true; }
  confirmReplacement(index){ if(this.replacingSkillId==null) return false; const old=this.replacingSkillId; this.scene.skillSystem.replaceSkill(index, old); this.replacingSkillId=null; this.pending=Math.max(0,this.pending-1); this.panelOpen=false; this.scene.upgradePanel.hide(); this.scene.stageSystem?.onSkillRewardClosed?.(); this.scene.resumeModalFlow(); return true; }
  cancelReplacement(){ this.replacingSkillId=null; this.scene.upgradePanel.show({ title:'技能三选一', options:this.rollOptions(), onConfirm:o=>this.applyOption(o) }); }
}
