import '../skills/handlers/index.js';
import { SKILLS } from '../config/skills.js';
import { SOUL_THRESHOLDS, SWORD_MYTHIC, getSwordFlowReadSnapshot, mainSwordStatsReadOnly, tombStatsReadOnly } from '../skills/handlers/SwordFlowState.js';

const QUALITY_NAMES={COMMON:'普通',RARE:'稀有',EPIC:'史诗',MYTHIC:'神话'};
const MYTHIC_NAMES={ [SWORD_MYTHIC.NONE]:'无', [SWORD_MYTHIC.MAIN]:'御剑术', [SWORD_MYTHIC.TOMB]:'剑冢' };
const BLOCKED=['该技能会在战斗中自动生效','技能说明缺失','造成伤害','提高属性','强化技能','效果增强','能力提升','提升当前技能关键数值'];

const FIELD_LABELS={damage:'伤害',cooldownMs:'冷却时间',attackIntervalMs:'攻击间隔',intervalMs:'攻击/结算间隔',radius:'攻击范围',range:'射程',durationMs:'持续时间',shots:'数量',hits:'打击次数',ticks:'切割次数',heal:'治疗量',threshold:'触发生命',shield:'护盾值',burnDamage:'灼烧伤害',poisonDamage:'中毒伤害',poisonStacks:'中毒层数',maxStacks:'最大层数',pierce:'穿透目标',defense:'防御',damageReduction:'减伤',dodgeChance:'闪避率',critChance:'暴击率',critMultiplierBonus:'暴击伤害',heavyHitEvery:'重击间隔',heavyHitMultiplier:'重击倍率',heavyHitLifeSteal:'重击吸血',swords:'飞剑数量',blockCd:'抵挡冷却',clones:'召唤数量',ratio:'伤害比例',width:'宽度',delayMs:'延迟',sweeps:'横扫次数',extraCasts:'额外释放轮数',windowMs:'爆发窗口'};
const fmt=(k,v)=>{ if(typeof v==='boolean') return v?'已解锁':'未解锁'; if(k.endsWith('Ms')) return `${(v/1000).toFixed(v%1000?1:0)}秒`; if(['threshold','damageReduction','dodgeChance','critChance','critMultiplierBonus','heavyHitMultiplier','heavyHitLifeSteal','ratio','finalScale','explosionScale'].includes(k)) return `${Math.round(v*100)}%`; return String(v); };
const linesFromData=(data={})=>Object.entries(FIELD_LABELS).filter(([k])=>data[k]!==undefined).map(([k,label])=>`${label}：${fmt(k,data[k])}`);
const diff=(a={},b={})=>Object.entries(FIELD_LABELS).filter(([k])=>b[k]!==undefined&&a[k]!==b[k]).map(([k,label])=>`${label}：${fmt(k,a[k])} → ${fmt(k,b[k])}`);

export function getSkillDetailData(skillId, context={}){
  const cfg=SKILLS[skillId]; if(!cfg) return null;
  const owned=context.scene?.playerData?.skills?.find(s=>s.id===skillId)||context.skill||{level:1};
  const level=Math.max(1, Math.min(cfg.maxLevel||1, owned.level||1));
  if(skillId==='sword_wave') return swordDetail(cfg, level, context);
  if(skillId==='sword_tomb') return tombDetail(cfg, level, context);
  const data=cfg.levels?.[level-1]||{};
  const next=cfg.levels?.[level]||null;
  return { name:cfg.name, level, maxLevel:cfg.maxLevel||1, description:cfg.description, currentEffects:linesFromData(data), mechanics:[data.desc||cfg.description], milestones:milestones(cfg, level), nextLevelPreview: next ? diff(data,next) : ['已达到最高等级'], progress:`${level}/${cfg.maxLevel||1}` };
}
function milestones(cfg, level){ return [3,6,9].map(l=>{ const base=cfg.milestones?.[l]||cfg.levels?.[l-1]?.milestoneText||`${cfg.name}${l}级解锁新的战斗表现`; const data=cfg.levels?.[l-1]; const extra=linesFromData(data).slice(0,3).join('，'); return { level:l, unlocked:level>=l, text:base.length>8?base:`${base}（${extra || '关键数值方向明确变化'}）` }; }); }
function swordDetail(cfg, level, { scene }={}){
  const sys=scene?.skillSystem; const data=sys?.getData?.('sword_wave',level)||cfg.levels[level-1]; const snapshot=sys?getSwordFlowReadSnapshot(sys):{}; const stats=sys?mainSwordStatsReadOnly(sys,data,snapshot):{}; const st=stats.state||snapshot||{}; const nextNeed=SOUL_THRESHOLDS[Math.min(SOUL_THRESHOLDS.length-1,(SOUL_THRESHOLDS.findIndex(x=>(st.effectiveSouls||0)<x) || SOUL_THRESHOLDS.length-1))];
  return { name:cfg.name, level, maxLevel:cfg.maxLevel, description:cfg.description, currentEffects:[`当前品质：${QUALITY_NAMES[stats.quality]||'普通'}`,`当前魂魄进度：${Math.floor(st.effectiveSouls||0)}/${nextNeed??SOUL_THRESHOLDS.at(-1)}`,`下一品质所需魂魄：${nextNeed??'已达到最高品质'}`,`当前伤害：${stats.damage??data.damage}`,`当前伤害倍率：${((stats.damage||data.damage)/(data.damage||1)).toFixed(2)}x`,`当前飞行速度倍率：${(stats.speed||1).toFixed(2)}x`,`当前攻击间隔：${stats.intervalMs??data.attackIntervalMs}ms`,`当前剑体尺寸倍率：${(stats.bodySize||1).toFixed(2)}x`,`当前剑光尺寸倍率：${(stats.glowSize||1).toFixed(2)}x`,`当前额外暴击率：${Math.round((stats.critChance||0)*100)}%`,`当前额外暴击伤害：${Math.round((stats.critMultiplierBonus||0)*100)}%`,`当前神话名额归属：${MYTHIC_NAMES[st.mythicOwner]||'无'}`,`当前是否进入神话全敌连斩：${stats.mythic?'是':'否'}`,`当前火魂数量与效果：${stats.fireSoul||0}（每个提供动态附加伤害/灼烧联动）`,`当前毒魂数量与效果：${stats.poisonSoul||0}（每个提供动态附加伤害/中毒联动）`], mechanics:['主剑由 SwordFlowState 和 mainSwordStats 提供实时品质、魂魄与倍率。'], milestones:[{level:3,unlocked:level>=3,text:'飞行速度提高25%，攻击间隔缩短15%。'},{level:6,unlocked:level>=6,text:'额外获得15%暴击率和50%暴击伤害。'},{level:9,unlocked:level>=9,text:'最终伤害提高50%，剑体尺寸和剑光尺寸提高30%。'}], nextLevelPreview: level>=cfg.maxLevel?['已达到最高等级']:diff(data,cfg.levels[level]), progress:`${level}/${cfg.maxLevel}` };
}
function tombDetail(cfg, level, { scene }={}){
  const sys=scene?.skillSystem; const st=sys?getSwordFlowReadSnapshot(sys):{}; const data=sys?.getData?.('sword_tomb',level)||cfg.levels[level-1]; const stats=sys?tombStatsReadOnly(sys,data,st):{};
  return { name:cfg.name, level, maxLevel:cfg.maxLevel, description:'剑冢周期性攻击敌人。敌人进入斩杀线时会被处决并产生魂魄。拥有御剑术时，魂魄优先强化主剑；没有御剑术时，魂魄强化剑冢自身。', currentEffects:[`当前总魂魄：${Math.floor(st.totalSouls||0)}`,`当前有效魂魄：${Math.floor(st.effectiveSouls||0)}`,`当前斩杀线：${Math.round((data.executeThreshold||0)*100)}%`,`当前精英斩杀线：${Math.round((data.eliteExecuteThreshold||0)*100)}%`,`Boss不受百分比直接斩杀说明：Boss不会被百分比斩杀线直接处决。`,`当前魂斩伤害：${stats.damage??data.damage}`,`当前魂斩间隔：${stats.intervalMs??data.intervalMs}ms`,`当前火魂数量：${st.affinities?.fire||0}`,`当前毒魂数量：${st.affinities?.poison||0}`,`是否解锁魂魄提纯：${level>=6?'是':'否'}`,`是否解锁火魂和毒魂实际效果：${level>=6?'是':'否'}`,`当前封神进度：${Math.floor(st.effectiveSouls||0)}/${SOUL_THRESHOLDS[3]}`,`当前神话名额归属：${MYTHIC_NAMES[st.mythicOwner]||'无'}`,`是否形成万魂剑域：${st.mythicOwner===SWORD_MYTHIC.TOMB?'是':'否'}`], mechanics:['魂魄、斩杀线和魂斩数值均来自 SwordFlowState 与剑冢运行时数据。'], milestones:milestones(cfg,level), nextLevelPreview: level>=cfg.maxLevel?['已达到最高等级']:diff(data,cfg.levels[level]), progress:`${level}/${cfg.maxLevel}` };
}
export function validateSkillDetailContent(){ return Object.keys(SKILLS).filter(id=>{ const d=getSkillDetailData(id,{}); return !d?.description||BLOCKED.some(x=>d.description.includes(x))||d.milestones?.length!==3; }); }
