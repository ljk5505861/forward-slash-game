import { SKILLS } from '../config/skills.js';

const PLACEHOLDER_PATTERNS = [/自动生效/, /技能说明缺失/, /强化当前技能机制/, /效果增强/, /提升当前技能关键数值/, /该等级强化/];
const MILESTONE_LEVELS = [3, 6, 9];

const describeLevel = (level = {}) => {
  const parts = [];
  if (level.desc) parts.push(level.desc);
  if (Array.isArray(level.changes) && level.changes.length) parts.push(level.changes.join('；'));
  return parts.join(' ');
};

const assertText = (skillId, field, text) => {
  if (!String(text || '').trim()) throw new Error(`${field}缺失：${skillId}`);
  const bad = PLACEHOLDER_PATTERNS.find((pattern) => pattern.test(text));
  if (bad) throw new Error(`${field}包含占位话术：${skillId}`);
};

export function getSkillDetailData(skillId, context = {}) {
  const cfg = SKILLS[skillId];
  if (!cfg) throw new Error(`技能不存在：${skillId}`);
  const currentLevel = Math.max(1, Math.min(context.level || context.skill?.level || 1, cfg.maxLevel || cfg.levels?.length || 1));
  const levelData = cfg.levels?.[currentLevel - 1] || cfg.levels?.[0] || {};
  const nextLevel = cfg.levels?.[currentLevel] || null;
  const description = cfg.description || levelData.desc || `技能说明缺失：${skillId}`;
  assertText(skillId, '技能说明', description);
  const milestones = MILESTONE_LEVELS.map((level) => {
    const text = cfg.milestones?.[level] || cfg.levels?.[level - 1]?.milestoneText || describeLevel(cfg.levels?.[level - 1]) || '';
    assertText(skillId, `${level}级强化`, text);
    return { level, text, unlocked: currentLevel >= level };
  });
  return {
    id: skillId,
    name: cfg.name || skillId,
    level: currentLevel,
    maxLevel: cfg.maxLevel || cfg.levels?.length || 1,
    description,
    currentEffect: levelData.desc || describeLevel(levelData),
    specialRules: cfg.passive ? '被动技能：获得后持续生效，不占用主动释放窗口。' : `释放方式：${cfg.targetType || '自动选择目标'}；冷却：${((levelData.cooldownMs ?? cfg.cooldownMs ?? 0) / 1000).toFixed(1)}秒。`,
    milestones,
    nextPreview: nextLevel ? describeLevel(nextLevel) : '已达到最高等级。',
  };
}

export function validateAllSkillDetailData(context = {}) {
  return Object.keys(SKILLS).map((skillId) => getSkillDetailData(skillId, context));
}
