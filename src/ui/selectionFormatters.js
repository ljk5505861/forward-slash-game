import { SKILLS } from '../config/skills.js';
import { getRarity } from '../config/rarities.js';
import { ARTIFACTS, ARTIFACT_CATEGORIES, getArtifactLevelText } from '../config/artifacts.js';
import { PROFESSIONS, PROFESSION_ATTACK_PROFILES } from '../config/professions.js';

export const SELECTION_ICON_STYLE = Object.freeze({ colors:[0xff6533,0x66ccff,0x42c978,0xd8b4ff,0xffd166,0x58d7ff] });
export const resolveSelectionMode = (options=[], explicitMode=null) => explicitMode || (options?.some(o=>o.artifactId||o.kind==='artifact'||o.type==='fallback')?'icon':'card');
const text = (v, fallback='') => (v===0 ? '0' : (v == null ? fallback : String(v)));
const lines = (v) => Array.isArray(v) ? v.map(x=>text(x)).filter(Boolean) : text(v).split('\n').filter(Boolean);
const unique = (items=[]) => [...new Set(items.map(s=>text(s).trim()).filter(Boolean))];
const seconds = (ms) => `${Number.isInteger(ms/1000) ? ms/1000 : (ms/1000).toFixed(1)} 秒`;
const cooldownText = (skill={}, levelData={}) => {
  if(skill.passive || skill.targetType === 'passive' || (levelData.cooldownMs ?? skill.cooldownMs) >= 999000) return '持续生效';
  const ms = levelData.cooldownMs ?? skill.cooldownMs;
  return ms ? `冷却：${seconds(ms)}` : '持续生效';
};
const futureSkillLines = (skill={}, fromLevel=0) => {
  const max = skill.maxLevel || skill.levels?.length || 0;
  const out=[];
  for(let lv=Math.max(1, fromLevel+1); lv<=max; lv++){
    const data=skill.levels?.[lv-1];
    const change=lines(data?.changes).join('；') || data?.desc;
    if(change) out.push(`Lv.${lv}：${change}`);
  }
  return out.length ? out : ['已达到最高等级'];
};
const attrLabels = { attack_15:['攻击强化','属性升级','攻击力 +15%'], hp_20:['生命强化','属性升级','最大生命 +20'], as_10:['速度强化','属性升级','攻击速度 +10%'], skill_15:['技能强化','属性升级','技能伤害 +15%'], cdr_8:['冷却强化','属性升级','冷却缩减 +8%'], crit_5:['暴击强化','属性升级','暴击率 +5%'] };
export function formatSkillSelectionOption(option={}, playerData={}){
  const skill = option.skillId ? SKILLS[option.skillId] : null;
  if(!skill){
    const m=attrLabels[option.id]||[text(option.title,'属性提升').split('\n')[0]||'属性提升','属性升级',lines(option.title).slice(1).join(' / ')||'属性提升'];
    return { ...option, kind:'attribute', title:m[0], subtitle:m[1], iconText:m[0][0], rarity:'属性', rarityColor:0x62e883, levelText:'', optionLines:[m[1]], detailLines:[m[2]], confirmText:`再次点击“${m[0]}”确认` };
  }
  const owned=(playerData.skills||[]).find(s=>s.id===skill.id); const cur=owned?.level||0; const target=option.type==='skillLevel'?Math.min(skill.maxLevel||cur+1,cur+1):1;
  const data=skill.levels?.[Math.max(0,target-1)]||skill.levels?.[0]||{}; const rarity=getRarity(skill.rarity)||{};
  const detail=unique([skill.name, option.type==='skillLevel'?`Lv.${cur} → Lv.${target}`:`Lv.${target}`, data.desc||skill.description, cooldownText(skill,data), ...futureSkillLines(skill,target), `再次点击“${skill.name}”确认`]);
  return { ...option, kind:'skill', title:skill.name||option.skillId||'未知技能', subtitle:rarity.name||skill.rarity||'普通', iconText:skill.short||skill.name?.[0]||'技', iconColor:skill.color, rarity:rarity.name||skill.rarity||'普通', rarityColor:rarity.color||0x5278c8, rarityUiColor:rarity.uiColor, levelText: option.type==='skillLevel'?`Lv.${cur} → Lv.${target}`:'新技能', optionLines:[rarity.name||skill.rarity||'普通', option.type==='skillLevel'?`Lv.${cur} → Lv.${target}`:'新技能'], detailLines:detail, confirmText:`再次点击“${skill.name}”确认` };
}
export function formatArtifactSelectionOption(option={}){
  if(option.type==='fallback'){
    const titleLines=lines(option.title||option.name||'保底奖励'); const name=(titleLines[0]||'保底奖励').split('｜')[0]||'保底奖励'; const category=(titleLines[0]||'').split('｜')[1]||'属性奖励'; const effects=unique([...titleLines.slice(1), ...lines(option.description)]); const detailLines=effects.length?effects:['获得属性奖励'];
    return { ...option, kind:'artifact', title:name, subtitle:'属性奖励', iconText:name[0], levelText:'', optionLines:['属性奖励'], summaryLines:detailLines.slice(0,2), detailLines:[name,...detailLines,`再次点击“${name}”确认`], category, confirmText:`再次点击“${name}”确认` };
  }
  const artifact=ARTIFACTS[option.artifactId]||{}; const name=artifact.name||option.name||option.title||option.artifactId||'法宝奖励'; const category=ARTIFACT_CATEGORIES[artifact.category]?.name||artifact.category||option.category||'法宝'; const isUp=option.type==='upgrade'; const levelText=isUp?`Lv.${text(option.level,0)} → Lv.${text(option.nextLevel, (option.level||0)+1)}`:'获得'; const cur=isUp?getArtifactLevelText(option.artifactId,option.level):''; const next=getArtifactLevelText(option.artifactId,option.nextLevel||1)||artifact.description||option.description||'获得法宝奖励';
  const details=unique([name, ...(cur?[`当前效果：${cur}`]:[]), `${isUp?'升级后效果':'效果'}：${next}`, ...(artifact.listenEvent?[`触发条件：战斗事件触发`]:[]), ...(option.requiredSkillName?[`所需技能：${option.requiredSkillName}`]:[]), `再次点击“${name}”确认`]);
  return { ...option, kind:'artifact', title:name, subtitle:isUp?'升级':'获得', iconText:name[0], iconColor:artifact.color, levelText, optionLines:[isUp?'升级':'获得', levelText], summaryLines:[next], detailLines:details, category, confirmText:`再次点击“${name}”确认` };
}
const bonusText = (b={}) => unique([b.attackMultiplier?`基础伤害 +${Math.round((b.attackMultiplier-1)*100)}%`:'', b.maxHp?`最大生命 +${b.maxHp}`:'', b.skillDamageMultiplier?`技能伤害 +${Math.round(b.skillDamageMultiplier*100)}%`:'', b.cooldownReduction?`冷却缩减 +${Math.round(b.cooldownReduction*100)}%`:'', b.attackSpeedMultiplier?`攻击速度 +${Math.round(b.attackSpeedMultiplier*100)}%`:'', b.critChance?`暴击率 +${Math.round(b.critChance*100)}%`:'']).join('，');
export function formatProfessionSelectionOption(id){ const p=typeof id==='string'?PROFESSIONS[id]:id||{}; const profile=PROFESSION_ATTACK_PROFILES[p.professionAttackProfile]||{}; const attack={swordSlash:'近战长剑攻击',arcaneBolt:'远程法术弹',hunterArrow:'远程弓箭射击'}[profile.type]||profile.type||'默认攻击'; return { ...p, kind:'profession', title:p.name||p.id||'未知职业', subtitle:'职业', iconText:(p.name||'?')[0], iconColor:p.color, optionLines:['职业'], detailLines:[p.name||p.id||'未知职业',`普攻：${attack}`,`核心机制：${p.mechanic||'暂无'}`,`基础加成：${bonusText(p.bonuses)||'无'}`,`特点：${(p.description||'定位清晰').split('；')[0]}`,`限制：需要围绕职业机制作战`,`再次点击“${p.name||p.id||'职业'}”确认`], confirmText:`再次点击“${p.name||p.id||'职业'}”确认` }; }
export class SelectionState { constructor(){this.reset();} reset(){this.selectedIndex=-1;this.selectedOption=null;this.confirmed=false;this.isOpen=false;} open(){this.reset();this.isOpen=true;} select(i,o){ if(!this.isOpen||this.confirmed) return false; this.selectedIndex=i; this.selectedOption=o; return true;} selectOrConfirm(i,o,cb){ if(!this.isOpen||this.confirmed) return 'locked'; if(this.selectedIndex===i){ this.confirmed=true; const result=cb?.(this.selectedOption,i); if(result===false){ this.confirmed=false; return 'rejected'; } return 'confirmed'; } this.selectedIndex=i; this.selectedOption=o; return 'selected'; } confirm(cb){ if(!this.isOpen||this.confirmed||this.selectedIndex<0) return false; this.confirmed=true; cb?.(this.selectedOption,this.selectedIndex); return true;} close(){this.reset();} }
