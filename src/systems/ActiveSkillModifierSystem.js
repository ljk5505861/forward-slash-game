import { TAGS } from '../config/tags.js';
import { getCultivationSpellModifiers } from '../skills/handlers/CultivationCoreSkill.js';
import { getAlchemyDaoBuffModifiers } from '../skills/handlers/CultivationAlchemySkill.js';

export const CULTIVATION_UNIVERSAL_ACTIVE_SKILL_MODIFIERS = Object.freeze([
  Object.freeze({ activeSkillDamageMultiplier:1, activeSkillCooldownMultiplier:1 }),
  Object.freeze({ activeSkillDamageMultiplier:1.03, activeSkillCooldownMultiplier:1 }),
  Object.freeze({ activeSkillDamageMultiplier:1.06, activeSkillCooldownMultiplier:.98 }),
  Object.freeze({ activeSkillDamageMultiplier:1.10, activeSkillCooldownMultiplier:.96 }),
  Object.freeze({ activeSkillDamageMultiplier:1.15, activeSkillCooldownMultiplier:.94 }),
  Object.freeze({ activeSkillDamageMultiplier:1.22, activeSkillCooldownMultiplier:.92 }),
  Object.freeze({ activeSkillDamageMultiplier:1.30, activeSkillCooldownMultiplier:.90 }),
  Object.freeze({ activeSkillDamageMultiplier:1.45, activeSkillCooldownMultiplier:.88 }),
  Object.freeze({ activeSkillDamageMultiplier:1.70, activeSkillCooldownMultiplier:.85 }),
]);
const NEUTRAL_UNIVERSAL = Object.freeze({ activeSkillDamageMultiplier:1, activeSkillCooldownMultiplier:1 });
const NEUTRAL_SPELL = Object.freeze({ damageMultiplier:1, rangeMultiplier:1, cooldownMultiplier:1, manaCostMultiplier:1 });
const NEUTRAL_ALCHEMY = Object.freeze({ activeSkillDamageMultiplier:1, cultivationSkillDamageMultiplier:1 });
const systemOf=x=>x?.skillSystem || x;
const stateOf=x=>systemOf(x)?.passiveState?.ninefoldDao || null;
const hasTag=(cfg,tag)=>Array.isArray(cfg?.tags)&&cfg.tags.includes(tag);
const roundMana=value=>Math.round((Number(value)||0)*10)/10;

export function getCultivationUniversalModifiers(sceneOrSystem){
  const st=stateOf(sceneOrSystem);
  if(!st) return { ...NEUTRAL_UNIVERSAL };
  return { ...CULTIVATION_UNIVERSAL_ACTIVE_SKILL_MODIFIERS[Math.max(0,Math.min(8,st.realmIndex||0))] };
}

export function getActiveSkillCastModifierSnapshot(sceneOrSystem,cfg={}){
  const isActiveSkill=!!cfg && cfg.passive!==true;
  const isCultivationSkill=isActiveSkill && hasTag(cfg,TAGS.CULTIVATION);
  const universal=isActiveSkill&&!isCultivationSkill?getCultivationUniversalModifiers(sceneOrSystem):{...NEUTRAL_UNIVERSAL};
  const cultivation=isCultivationSkill?getCultivationSpellModifiers(sceneOrSystem):{...NEUTRAL_SPELL};
  const alchemy=isActiveSkill?(getAlchemyDaoBuffModifiers(sceneOrSystem)||{...NEUTRAL_ALCHEMY}):{...NEUTRAL_ALCHEMY};
  const alchemyDamageMultiplier=isCultivationSkill?(alchemy.cultivationSkillDamageMultiplier||1):(alchemy.activeSkillDamageMultiplier||1);
  const snapshot={
    isActiveSkill,
    isCultivationSkill,
    universalDamageMultiplier:universal.activeSkillDamageMultiplier||1,
    universalCooldownMultiplier:universal.activeSkillCooldownMultiplier||1,
    cultivationDamageMultiplier:cultivation.damageMultiplier||1,
    cultivationRangeMultiplier:cultivation.rangeMultiplier||1,
    cultivationCooldownMultiplier:cultivation.cooldownMultiplier||1,
    cultivationManaCostMultiplier:cultivation.manaCostMultiplier||1,
    alchemyDamageMultiplier,
    appliedDamageMultiplier:isActiveSkill?(isCultivationSkill?(cultivation.damageMultiplier||1)*alchemyDamageMultiplier:(universal.activeSkillDamageMultiplier||1)*alchemyDamageMultiplier):1,
    appliedCooldownMultiplier:isActiveSkill?(isCultivationSkill?(cultivation.cooldownMultiplier||1):(universal.activeSkillCooldownMultiplier||1)):1,
    appliedRangeMultiplier:isActiveSkill&&isCultivationSkill?(cultivation.rangeMultiplier||1):1,
    appliedManaCostMultiplier:isActiveSkill&&isCultivationSkill?(cultivation.manaCostMultiplier||1):1,
  };
  return Object.freeze(snapshot);
}

export function manaCostValue(baseManaCost,ctxOrSnapshot){ return roundMana(Math.max(0,Number(baseManaCost)||0)*(ctxOrSnapshot?.appliedManaCostMultiplier??ctxOrSnapshot?.manaCostMultiplier??1)); }
export function rangeValue(baseRange,ctxOrSnapshot){ return (Number(baseRange)||0)*(ctxOrSnapshot?.appliedRangeMultiplier??ctxOrSnapshot?.rangeMultiplier??1); }
