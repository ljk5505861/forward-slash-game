import { RewardSources } from './UpgradeSystem.js';

const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

export function applyCampfireSkillUpgrade(scene){
  const candidates=scene.playerData.skills.filter(s=>s.level<(scene.skillSystem.getConfig(s.id)?.maxLevel||s.level));
  const upgraded=candidates.length?pickRandom(candidates):null;
  if(!upgraded) return null;
  const option={ type:'skillLevel', id:`campfire_${upgraded.id}_${upgraded.level+1}`, skillId:upgraded.id, nextLevel:upgraded.level+1 };
  const applied=scene.upgradeSystem?.applyFreeOption?.(option, { source:RewardSources.CAMPFIRE, rewardKind:'campfire' });
  return applied ? scene.playerData.skills.find(s=>s.id===upgraded.id) : null;
}
