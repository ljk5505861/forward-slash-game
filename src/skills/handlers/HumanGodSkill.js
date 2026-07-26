import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { sumRuntimeBonuses } from '../../config/balance.js';

export const HUMAN_GOD_SOURCE = 'human_god';
const BUCKETS = ['strengthBonuses', 'defenseBonuses', 'moveSpeedMultiplierBonuses', 'attackSpeedMultiplierBonuses', 'damageReductionBonuses'];
const ROWS = [
  [4, 3, 30, .03, .03, 0], [5, 4, 40, .04, .04, 0], [7, 6, 60, .05, .05, .02],
  [9, 7, 75, .06, .06, .02], [11, 9, 90, .07, .07, .03], [14, 11, 115, .08, .08, .05],
  [16, 13, 130, .09, .09, .05], [18, 15, 145, .10, .10, .06], [22, 18, 180, .12, .12, .08]
];
const pct = value => `${Math.round(value * 1000) / 10}%`;

export function getHumanGodSolarMultiplier(system) {
  if ((system?.getLevel?.('solar_flame') || 0) <= 0) return 1;
  return system.getData?.('solar_flame')?.suns === 2 ? 1.4 : 1.25;
}

export function getHumanGodActualStats(data, multiplier = 1) {
  if (!data) return null;
  return {
    strength: Math.round(data.strength * multiplier),
    defense: Math.round(data.defense * multiplier),
    maxHpBonus: Math.round(data.maxHpBonus * multiplier),
    moveSpeedBonus: Number((data.moveSpeedBonus * multiplier).toFixed(6)),
    attackSpeedBonus: Number((data.attackSpeedBonus * multiplier).toFixed(6)),
    damageReduction: Number((data.damageReduction * multiplier).toFixed(6))
  };
}

export function configureHumanGodSkill() {
  SKILLS.human_god = {
    id: 'human_god', name: '人间之神', rarity: 'LEGENDARY', handler: 'human_god', passive: true,
    ultimateSkill: true, coreSkill: true, maxLevel: 9, tags: [TAGS.SUPERPOWER, TAGS.BUILD_SUPERHERO],
    cooldownMs: 999999, targetType: 'passive', manaCost: 0, color: 0xffd56a, short: '神',
    description: '超越凡人的肉体持续成长，提高力量、防御、最大生命、移动速度、攻击速度和伤害减免。拥有“太阳”时，本技能提供的全部属性受到日照强化；双日凌空时强化效果进一步提高。',
    milestones: {
      3: '钢铁之躯：力量提高至7，防御提高至6，最大生命提高至60，并首次获得2%伤害减免。',
      6: '超越凡人：力量提高至14，防御提高至11，最大生命提高至115，移动速度和攻击速度均提高至8%，伤害减免提高至5%。',
      9: '人间之神：力量提高至22，防御提高至18，最大生命提高至180，移动速度和攻击速度均提高至12%，伤害减免提高至8%。'
    },
    levels: ROWS.map(([strength, defense, maxHpBonus, moveSpeedBonus, attackSpeedBonus, damageReduction], index) => ({
      strength, defense, maxHpBonus, moveSpeedBonus, attackSpeedBonus, damageReduction,
      ...(index === 2 || index === 5 || index === 8 ? { milestoneText: index === 2 ? '钢铁之躯' : index === 5 ? '超越凡人' : '人间之神' } : {}),
      desc: `力量+${strength}，防御+${defense}，最大生命+${maxHpBonus}，移动速度+${pct(moveSpeedBonus)}，攻击速度+${pct(attackSpeedBonus)}，伤害减免+${pct(damageReduction)}。`
    }))
  };
}

function syncUi(scene) {
  scene.hud?.update?.();
  scene.playerHealthBar?.update?.();
  if (scene.playerInfoPanel?.isOpen) scene.playerInfoPanel.render?.();
}

function recomputeMaxHp(scene, nextBonus) {
  const player = scene.playerData;
  player.maxHpBonuses ??= {};
  const previous = player.maxHpBonuses[HUMAN_GOD_SOURCE] || 0;
  if (previous === nextBonus) return false;
  const oldMaxHp = Math.max(1, Number(player.maxHp) || 1);
  const ratio = Math.max(0, Number(player.hp) || 0) / oldMaxHp;
  if (nextBonus) player.maxHpBonuses[HUMAN_GOD_SOURCE] = nextBonus;
  else delete player.maxHpBonuses[HUMAN_GOD_SOURCE];
  player.maxHp = Math.max(1, Math.round((Number(player.baseMaxHp) || oldMaxHp - sumRuntimeBonuses(player.maxHpBonuses)) + sumRuntimeBonuses(player.maxHpBonuses)));
  player.hp = Math.max(0, Math.min(player.maxHp, Math.round(player.maxHp * ratio)));
  return true;
}

function clearBonuses(player) {
  BUCKETS.forEach(bucket => { if (player[bucket]) delete player[bucket][HUMAN_GOD_SOURCE]; });
}

export const HumanGodSkill = {
  bind(system) {
    const scene = system.scene;
    const player = scene.playerData;
    let snapshot = '';
    const updater = () => {
      const data = system.getData('human_god');
      const multiplier = getHumanGodSolarMultiplier(system);
      const stats = getHumanGodActualStats(data, multiplier);
      const nextSnapshot = stats ? JSON.stringify(stats) : '';
      if (nextSnapshot === snapshot) return;
      clearBonuses(player);
      if (stats) {
        player.strengthBonuses ??= {}; player.defenseBonuses ??= {};
        player.moveSpeedMultiplierBonuses ??= {}; player.attackSpeedMultiplierBonuses ??= {}; player.damageReductionBonuses ??= {};
        player.strengthBonuses[HUMAN_GOD_SOURCE] = stats.strength;
        player.defenseBonuses[HUMAN_GOD_SOURCE] = stats.defense;
        player.moveSpeedMultiplierBonuses[HUMAN_GOD_SOURCE] = stats.moveSpeedBonus;
        player.attackSpeedMultiplierBonuses[HUMAN_GOD_SOURCE] = stats.attackSpeedBonus;
        player.damageReductionBonuses[HUMAN_GOD_SOURCE] = stats.damageReduction;
      }
      recomputeMaxHp(scene, stats?.maxHpBonus || 0);
      snapshot = nextSnapshot;
      system.passiveState.humanGod = stats ? { multiplier, ...stats } : undefined;
      syncUi(scene);
    };
    system.passiveUpdaters.push(updater);
    updater();
    return () => {
      clearBonuses(player);
      recomputeMaxHp(scene, 0);
      system.passiveUpdaters = system.passiveUpdaters.filter(fn => fn !== updater);
      delete system.passiveState.humanGod;
      snapshot = '';
      syncUi(scene);
    };
  }
};
