import { NINEFOLD_DAO_ID, getCultivationSnapshot } from '../skills/handlers/CultivationCoreSkill.js';
import { ALCHEMY_ID, CultivationAlchemySkill } from '../skills/handlers/CultivationAlchemySkill.js';
import { CHARGED_SLAM_ID, getChargedSlamState } from '../skills/handlers/ChargedSlamSkill.js';

const SPECIAL_RUNTIMES = {
  guardian_shield: 'guardianShieldRuntime',
  lightning_enchant: 'lightningEnchantRuntime',
  neutron_star: 'neutronStarRuntime',
  white_dwarf: 'whiteDwarfRuntime'
};

export function getSkillBarStateText(scene, skillData, cfg) {
  if (skillData.id === NINEFOLD_DAO_ID) {
    const snap = getCultivationSnapshot(scene);
    if (!snap.active) return '炼气 0%';
    if (snap.isComplete) return '渡劫 圆满';
    const pct = Math.max(0, Math.min(100, Math.floor((snap.progress / (snap.nextThreshold || 1)) * 100)));
    return `${snap.realm} ${pct}%`;
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
