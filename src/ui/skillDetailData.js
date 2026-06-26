import { SKILLS } from '../config/skills.js';
import { StatusEffects } from '../systems/StatusEffectSystem.js';
import { getSwordFlowState, mainSwordStats, SOUL_THRESHOLDS, SWORD_MYTHIC } from '../skills/handlers/SwordFlowState.js';

const fmt = (v, suffix = '') => `${v}${suffix}`;
const sec = ms => `${(ms / 1000).toFixed(ms % 1000 ? 2 : 1)}秒`;
const pct = v => `${Math.round(v * 100)}%`;
const qualityName = q => ({ COMMON:'普通', RARE:'稀有', EPIC:'史诗', MYTHIC:'神话' }[q] || q || '普通');
const mythicOwnerName = owner => ({ [SWORD_MYTHIC.NONE]:'暂无', [SWORD_MYTHIC.MAIN]:'御剑术', [SWORD_MYTHIC.TOMB]:'剑冢' }[owner] || '暂无');

function currentEffectFields(data = {}) {
  const fields = [];
  const add = (label, value) => { if (value !== undefined && value !== null && value !== false) fields.push({ label, value: String(value) }); };
  add('当前伤害', data.damage ?? data.zoneDamage ?? data.biteDamage);
  add('灼烧伤害', data.burnDamage);
  add('中毒伤害', data.poisonDamage ?? data.damagePerGrowth);
  add('攻击间隔', data.intervalMs ? sec(data.intervalMs) : data.attackIntervalMs ? sec(data.attackIntervalMs) : null);
  add('冷却时间', data.cooldownMs ? sec(data.cooldownMs) : null);
  add('攻击范围', data.range ?? data.radius);
  add('持续时间', data.durationMs ? sec(data.durationMs) : null);
  add('数量', data.shots ?? data.blades ?? data.clones ?? data.suns ?? data.volley);
  add('灼烧层数上限', data.maxStacks);
  add('暴击加成', data.critChance ? `+${pct(data.critChance)}` : null);
  return fields;
}

function nextLevelPreview(skill, level) {
  if (level >= (skill.maxLevel || 1)) return '已达到最高等级';
  const next = skill.levels?.[level];
  return next?.changes?.join('；') || next?.desc || '提升当前技能关键数值。';
}

function milestones(skill, level) {
  return [3, 6, 9].map(lv => ({ level: lv, unlocked: level >= lv, text: skill.milestones?.[lv] || skill.levels?.[lv - 1]?.milestoneText || '该等级强化当前技能机制。' }));
}

function swordWaveDetail(system, skill, level, data) {
  const stats = mainSwordStats(system, data);
  const st = stats.state;
  const nextQuality = SOUL_THRESHOLDS.find(v => v > st.effectiveSouls);
  return {
    description: '召出一把常驻主剑，自动寻找敌人出击。普通、稀有和史诗品质每次攻击一个目标；达到神话品质后，主剑会连续飞斩当前所有有效敌人，随后返回角色身边。',
    currentEffects: [
      { label:'当前品质', value:qualityName(stats.quality) },
      { label:'魂魄进度', value: nextQuality ? `${Math.floor(st.effectiveSouls)}/${nextQuality}` : `${Math.floor(st.effectiveSouls)}/已满` },
      { label:'下一品质所需魂魄', value: nextQuality ? nextQuality : '已达到最高品质' },
      { label:'当前伤害', value:stats.damage },
      { label:'伤害倍率', value:`×${((stats.damage || 1) / Math.max(1, data?.damage || 1)).toFixed(2)}` },
      { label:'飞行速度倍率', value:`×${stats.speed.toFixed(2)}` },
      { label:'攻击间隔', value:sec(stats.intervalMs) },
      { label:'剑体尺寸倍率', value:`×${stats.bodySize.toFixed(2)}` },
      { label:'剑光尺寸倍率', value:`×${stats.glowSize.toFixed(2)}` },
      { label:'额外暴击率', value:`+${pct(stats.critChance)}` },
      { label:'额外暴击伤害', value:`+${pct(stats.critMultiplierBonus)}` },
      { label:'当前神话名额归属', value:mythicOwnerName(st.mythicOwner) },
      { label:'神话全敌连斩状态', value:stats.mythic ? '已进入' : '未进入' },
      { label:'当前火魂效果', value:`火魂 ${stats.fireSoul}，命中附加灼烧` },
      { label:'当前毒魂效果', value:`毒魂 ${stats.poisonSoul}，命中附加中毒` },
    ],
    mechanics: ['品质由魂魄进度实时决定；神话名额被剑冢占用时主剑最高保持史诗。']
  };
}

function swordTombDetail(system, skill, level, data) {
  const st = getSwordFlowState(system);
  const effectiveData = { ...data };
  if (system.getLevel('sword_wave') <= 0) {
    effectiveData.damage = Math.round(data.damage + st.effectiveSouls * 1.5 + (st.affinities.fire || 0) * 5 + (st.affinities.poison || 0) * 4);
    effectiveData.intervalMs = Math.max(620, data.intervalMs - st.effectiveSouls * 8);
  }
  return {
    description: '剑冢周期性攻击敌人。敌人进入斩杀线时会被处决并产生魂魄。拥有御剑术时，魂魄优先强化主剑；没有御剑术时，魂魄强化剑冢自身。',
    currentEffects: [
      { label:'当前总魂魄', value:Math.floor(st.totalSouls || 0) },
      { label:'当前有效魂魄', value:Math.floor(st.effectiveSouls || 0) },
      { label:'当前斩杀线', value:pct(data.executeRatio || 0) },
      { label:'当前精英斩杀线', value:pct((data.executeRatio || 0) * 0.6) },
      { label:'Boss规则', value:'Boss不受百分比直接斩杀，改为承受强化魂斩伤害。' },
      { label:'当前魂斩伤害', value:effectiveData.damage },
      { label:'当前魂斩间隔', value:sec(effectiveData.intervalMs) },
      { label:'当前火魂数量', value:st.affinities.fire || 0 },
      { label:'当前毒魂数量', value:st.affinities.poison || 0 },
      { label:'魂魄提纯', value:level >= 6 ? '已解锁' : '未解锁' },
      { label:'火魂/毒魂实际效果', value:level >= 6 ? '已解锁' : '未解锁' },
      { label:'封神条件进度', value:`${Math.floor(st.effectiveSouls || 0)}/${SOUL_THRESHOLDS[3]}` },
      { label:'当前神话名额归属', value:mythicOwnerName(st.mythicOwner) },
      { label:'万魂剑域', value:st.mythicOwner === SWORD_MYTHIC.TOMB ? '已形成' : '未形成' },
    ],
    mechanics: ['吸魂来源于剑冢击杀；拥有御剑术时优先推动主剑品质成长。']
  };
}

export function getSkillDetailData(skillId, context = {}) {
  const skill = SKILLS[skillId];
  if (!skill) return null;
  const system = context.skillSystem || context.scene?.skillSystem;
  const entry = context.skillEntry || context.scene?.playerData?.skills?.find(s => s.id === skillId) || {};
  const level = Math.max(1, entry.level || system?.getLevel?.(skillId) || 1);
  const data = system?.getData?.(skillId, level) || skill.levels?.[level - 1] || {};
  let detail = { description: skill.description || data.desc || '该技能会在战斗中自动生效。', currentEffects: currentEffectFields({ ...data, cooldownMs: data.cooldownMs || skill.cooldownMs }), mechanics: skill.mechanicsDescription ? [skill.mechanicsDescription] : [] };
  if (skillId === 'sword_wave' && system) detail = { ...detail, ...swordWaveDetail(system, skill, level, data) };
  if (skillId === 'sword_tomb' && system) detail = { ...detail, ...swordTombDetail(system, skill, level, data) };
  return { name: skill.name || skillId, level, maxLevel: skill.maxLevel || skill.levels?.length || 1, description: detail.description, currentEffects: detail.currentEffects, mechanics: detail.mechanics, milestones: milestones(skill, level), nextLevelPreview: nextLevelPreview(skill, level), progress: detail.progress || null };
}
