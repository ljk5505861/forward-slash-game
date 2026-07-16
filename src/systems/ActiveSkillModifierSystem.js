import { TAGS } from '../config/tags.js';
import { getCultivationSpellModifiers, getCultivationUniversalModifiers } from '../skills/handlers/CultivationCoreSkill.js';
import { getAlchemyDaoBuffModifiers } from '../skills/handlers/CultivationAlchemySkill.js';

const one=Object.freeze({damageMultiplier:1,rangeMultiplier:1,cooldownMultiplier:1,manaCostMultiplier:1});
const activeOne=Object.freeze({activeSkillDamageMultiplier:1,activeSkillCooldownMultiplier:1});
const alchemyOne=Object.freeze({activeSkillDamageMultiplier:1,cultivationSkillDamageMultiplier:1});
const n=v=>Number.isFinite(Number(v))?Number(v):1;
export function isActiveSkillConfig(cfg){ return !!cfg && cfg.passive!==true; }
export function isCultivationActiveSkillConfig(cfg){ return isActiveSkillConfig(cfg) && Array.isArray(cfg.tags) && cfg.tags.includes(TAGS.CULTIVATION); }
export function getActiveSkillCastModifierSnapshot(sceneOrSystem,cfg={}){
  const isActiveSkill=isActiveSkillConfig(cfg), isCultivationSkill=isCultivationActiveSkillConfig(cfg);
  const universal=isActiveSkill?getCultivationUniversalModifiers(sceneOrSystem):activeOne;
  const cultivation=isActiveSkill?getCultivationSpellModifiers(sceneOrSystem):one;
  const alchemy=isActiveSkill?getAlchemyDaoBuffModifiers(sceneOrSystem):alchemyOne;
  const appliedDamageMultiplier=!isActiveSkill?1:(isCultivationSkill?n(cultivation.damageMultiplier)*n(alchemy.cultivationSkillDamageMultiplier):n(universal.activeSkillDamageMultiplier)*n(alchemy.activeSkillDamageMultiplier));
  const appliedCooldownMultiplier=!isActiveSkill?1:(isCultivationSkill?n(cultivation.cooldownMultiplier):n(universal.activeSkillCooldownMultiplier));
  const appliedRangeMultiplier=!isActiveSkill?1:(isCultivationSkill?n(cultivation.rangeMultiplier):1);
  const appliedManaCostMultiplier=!isActiveSkill?1:(isCultivationSkill?n(cultivation.manaCostMultiplier):1);
  return Object.freeze({skillId:cfg?.id,isActiveSkill,isCultivationSkill,universalActiveDamageMultiplier:n(universal.activeSkillDamageMultiplier),universalActiveCooldownMultiplier:n(universal.activeSkillCooldownMultiplier),cultivationDamageMultiplier:n(cultivation.damageMultiplier),cultivationRangeMultiplier:n(cultivation.rangeMultiplier),cultivationCooldownMultiplier:n(cultivation.cooldownMultiplier),cultivationManaCostMultiplier:n(cultivation.manaCostMultiplier),alchemyActiveDamageMultiplier:n(alchemy.activeSkillDamageMultiplier),alchemyCultivationDamageMultiplier:n(alchemy.cultivationSkillDamageMultiplier),appliedDamageMultiplier,appliedCooldownMultiplier,appliedRangeMultiplier,appliedManaCostMultiplier});
}
export function rangeValue(baseRange,ctxOrSnapshot){ const m=ctxOrSnapshot?.appliedRangeMultiplier ?? ctxOrSnapshot?.rangeMultiplier ?? 1; return (Number(baseRange)||0)*(Number(m)||1); }
export function manaCostValue(baseCost,ctxOrSnapshot){ const m=ctxOrSnapshot?.appliedManaCostMultiplier ?? ctxOrSnapshot?.manaCostMultiplier ?? 1; return Math.round((Number(baseCost)||0)*(Number(m)||1)*10)/10; }
