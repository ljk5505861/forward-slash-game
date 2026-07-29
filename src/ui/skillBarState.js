import { NINEFOLD_DAO_ID, getCultivationSnapshot } from '../skills/handlers/CultivationCoreSkill.js';
import { ALCHEMY_ID, CultivationAlchemySkill } from '../skills/handlers/CultivationAlchemySkill.js';
import { CHARGED_SLAM_ID, getChargedSlamState } from '../skills/handlers/ChargedSlamSkill.js';
import { KINETIC_RELEASE_ID, getKineticReleaseState } from '../skills/handlers/KineticReleaseSkill.js';
import { SPELL_TIDE_ID, getSpellTideState } from '../skills/handlers/SpellTideSkill.js';
import { POWERED_ARMOR_ID, OVERLOAD_CORE_ID, getPoweredArmorState, getOverloadCoreState } from '../skills/handlers/MechFlowSkills.js';

const SPECIAL_RUNTIMES = {
  guardian_shield: 'guardianShieldRuntime',
  lightning_enchant: 'lightningEnchantRuntime',
  neutron_star: 'neutronStarRuntime',
  white_dwarf: 'whiteDwarfRuntime'
};

export function getSkillBarStateText(scene, skillData, cfg) {
  if (skillData.id === POWERED_ARMOR_ID) {
    const snap = getPoweredArmorState(scene.skillSystem);
    if (!snap?.max) return '装甲 常驻';
    if (snap.ready > 0) return `装甲 ${snap.ready}/${snap.max}`;
    return `装甲 充能 ${(snap.remainingMs / 1000).toFixed(1)}s`;
  }
  if (skillData.id === OVERLOAD_CORE_ID) {
    const snap = getOverloadCoreState(scene.skillSystem);
    if (snap?.overloaded) return `过载 ${(snap.remainingMs / 1000).toFixed(1)}s`;
    return `核心 ${snap?.energy || 0}/${snap?.threshold || 10}`;
  }
  if (skillData.id === SPELL_TIDE_ID) {
    const snap = getSpellTideState(scene.skillSystem);
    return snap?.pendingTide ? '潮汐 涌动' : `潮汐 ${snap?.count || 0}/3`;
  }
  if (skillData.id === NINEFOLD_DAO_ID) {
    const snap = getCultivationSnapshot(scene);
    if (!snap.active) return '炼气 0%';
    if (snap.isComplete) return '渡劫 圆满';
    const pct = Math.max(0, Math.min(100, Math.floor((snap.progress / (snap.nextThreshold || 1)) * 100)));
    return `${snap.realm} ${pct}%`;
  }
  if (skillData.id === KINETIC_RELEASE_ID) {
    const snap = getKineticReleaseState(scene.skillSystem);
    if (snap?.ready) return '动能 就绪';
    const required = snap?.required || cfg?.levels?.[skillData.level - 1]?.kineticRequired || 400;
    return `动能 ${Math.max(0, Math.min(100, Math.floor(((snap?.kinetic || 0) / required) * 100)))}%`;
  }
  if (skillData.id === CHARGED_SLAM_ID) {
    const snap = getChargedSlamState(scene.skillSystem);
    if (snap?.ready) return '重击 就绪';
    return `蓄势 ${snap?.count || 0}/${snap?.required || cfg?.levels?.[skillData.level - 1]?.attacksRequired || 5}`;
  }
  if (skillData.id === ALCHEMY_ID) return CultivationAlchemySkill.getSkillBarState(scene.skillSystem).text;
  const readyAt = scene.skillSystem?.cooldowns.get(skillData.id) || 0;
  const cooldownRemainingMs = Math.max(0, readyAt - scene.getGameplayTime());
  const runtimeKey = SPECIAL_RUNTIMES[skillData.id];
  const specialState = runtimeKey ? (scene[runtimeKey]?.getSkillBarState?.() || null) : null;
  if (specialState && typeof specialState.text === 'string') return specialState.text;
  if (specialState && specialState.remainingMs > 0) {
    return `${specialState.label} ${Math.ceil(specialState.remainingMs / 1000)}s`;
  }
  if (cooldownRemainingMs > 0) {
    return `冷却 ${Math.ceil(cooldownRemainingMs / 1000)}s`;
  }
  if (skillData.level >= (cfg?.maxLevel || 1)) {
    return '已满级';
  }
  return '就绪';
}
