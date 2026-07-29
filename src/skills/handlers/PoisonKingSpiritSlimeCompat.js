import { CombatEvents } from '../../core/CombatEvents.js';
import { StatusEffects } from '../../systems/StatusEffectSystem.js';
import {
  POISON_ADVANCED_TUNING,
  PoisonKingSkill
} from './PoisonSummonAdvancedSkills.js';

function isNormalPoisonTick(payload) {
  return payload?.type === StatusEffects.POISON
    && payload.actualDamage > 0
    && !payload.effect?.poisonMeta?.nonNormal
    && !payload.effect?.noPoisonKingRecursive;
}

function removeUpdater(system, updater) {
  const index = system.passiveUpdaters.indexOf(updater);
  if (index >= 0) system.passiveUpdaters.splice(index, 1);
}

function syncHpBar(king) {
  const bar = king?.hpBar;
  if (!bar || !king || king.dead || king.hp <= 0) return;
  const ratio = Math.max(0, Math.min(1, king.hp / Math.max(1, king.maxHp || 1)));
  bar.fill?.setDisplaySize?.(bar.width * ratio, bar.height);
  bar.fill?.setPosition?.(-bar.width / 2, 0);
}

export function poisonKingContractData(data, {
  stage = 0,
  growthMultiplier = 1,
  stageStatMultiplier = 1
} = {}) {
  if (!data) return data;
  return {
    ...data,
    growthRatio: (Number(data.growthRatio) || 0) * Math.max(1, Number(growthMultiplier) || 1),
    biteDamage: (Number(data.biteDamage) || 0)
      + Math.max(0, Number(stage) || 0)
        * POISON_ADVANCED_TUNING.king.damagePerStage
        * (Math.max(1, Number(stageStatMultiplier) || 1) - 1)
  };
}

export function correctedPoisonKingGrowthHp({
  oldHp,
  oldMaxHp,
  oldBaseMaxHp,
  newMaxHp,
  newBaseMaxHp,
  stageGain,
  poisonKingLevel,
  stageStatMultiplier = 1
}) {
  const safeOldMaxHp = Math.max(1, Number(oldMaxHp) || 1);
  const safeOldBaseMaxHp = Math.max(1, Number(oldBaseMaxHp) || safeOldMaxHp);
  const safeNewMaxHp = Math.max(1, Number(newMaxHp) || 1);
  const safeNewBaseMaxHp = Math.max(1, Number(newBaseMaxHp) || safeNewMaxHp);
  const safeOldHp = Math.max(0, Number(oldHp) || 0);
  if (safeOldHp <= 0 || stageGain <= 0) return safeOldHp;

  const oldBaseHp = Math.min(
    safeOldBaseMaxHp,
    safeOldHp * safeOldBaseMaxHp / safeOldMaxHp
  );
  const stageHpGain = Math.round(
    POISON_ADVANCED_TUNING.king.hpPerStage
      * Math.max(1, Number(stageStatMultiplier) || 1)
  );
  const healPerStage = stageHpGain
    + (poisonKingLevel >= 3 ? POISON_ADVANCED_TUNING.king.stageHealL3 : 0);
  const newBaseHp = Math.min(
    safeNewBaseMaxHp,
    oldBaseHp + stageGain * healPerStage
  );
  return Math.max(
    1,
    Math.min(
      safeNewMaxHp,
      Math.round(newBaseHp * safeNewMaxHp / safeNewBaseMaxHp)
    )
  );
}

function contractMultiplier(scene, key) {
  return scene.professionSystem
    ?.summonCreatureContractMultiplier?.('poison_king', key) || 1;
}

function desiredStageHpBonus(scene, king) {
  const stage = Math.max(0, Number(king?.stage) || 0);
  const multiplier = contractMultiplier(scene, 'stageStatMultiplier');
  const standard = POISON_ADVANCED_TUNING.king.hpPerStage;
  const contracted = Math.round(standard * multiplier);
  return stage * Math.max(0, contracted - standard);
}

function syncContractStageHp(system, king) {
  if (!king || king.dead || king.hp <= 0) return false;
  const scene = system.scene;
  const previous = Math.max(0, Number(king.contractStageHpBonus) || 0);
  const desired = desiredStageHpBonus(scene, king);
  if (previous === desired) return false;

  const baseWithoutContract = Math.max(
    1,
    (Number(king.baseMaxHp) || Number(king.maxHp) || 1) - previous
  );
  king.contractStageHpBonus = desired;
  king.baseMaxHp = baseWithoutContract + desired;

  const data = system.getData('poison_king') || {};
  scene.professionSystem?.applyEntitySummonStats?.(king, 'poison_king', {
    baseAttack: (Number(data.biteDamage) || 0)
      + (Math.max(0, Number(king.stage) || 0) * POISON_ADVANCED_TUNING.king.damagePerStage),
    baseDefense: 0,
    baseMaxHp: king.baseMaxHp
  });
  syncHpBar(king);
  return true;
}

export const PoisonKingSkillWithSpiritSlime = {
  ...PoisonKingSkill,
  bind(system) {
    const scene = system.scene;
    let beforeGrowth = null;

    const originalGetData = system.getData;
    const wrappedGetData = function(skillId, ...args) {
      const data = originalGetData.call(system, skillId, ...args);
      if (skillId !== 'poison_king' || !data) return data;
      const king = scene.poisonKingRuntime?.get?.();
      return poisonKingContractData(data, {
        stage: king?.stage || 0,
        growthMultiplier: contractMultiplier(scene, 'growthMultiplier'),
        stageStatMultiplier: contractMultiplier(scene, 'stageStatMultiplier')
      });
    };
    system.getData = wrappedGetData;

    const offBefore = scene.eventBus.on(CombatEvents.STATUS_TICK, payload => {
      if (!isNormalPoisonTick(payload)) {
        beforeGrowth = null;
        return;
      }
      const king = scene.poisonKingRuntime?.get?.();
      if (!king || king.dead || king.hp <= 0) {
        beforeGrowth = null;
        return;
      }
      beforeGrowth = {
        king,
        hp: king.hp,
        maxHp: king.maxHp,
        baseMaxHp: king.baseMaxHp || king.maxHp,
        stage: king.stage || 0
      };
    });

    const originalOff = PoisonKingSkill.bind(system);

    const offAfter = scene.eventBus.on(CombatEvents.STATUS_TICK, payload => {
      const snapshot = beforeGrowth;
      beforeGrowth = null;
      if (!snapshot || !isNormalPoisonTick(payload)) return;
      const king = scene.poisonKingRuntime?.get?.();
      if (!king || king !== snapshot.king || king.dead || king.hp <= 0) return;
      const stageGain = Math.max(0, (king.stage || 0) - snapshot.stage);
      if (stageGain <= 0) return;

      syncContractStageHp(system, king);
      const stageStatMultiplier = contractMultiplier(scene, 'stageStatMultiplier');
      king.hp = correctedPoisonKingGrowthHp({
        oldHp: snapshot.hp,
        oldMaxHp: snapshot.maxHp,
        oldBaseMaxHp: snapshot.baseMaxHp,
        newMaxHp: king.maxHp,
        newBaseMaxHp: king.baseMaxHp || king.maxHp,
        stageGain,
        poisonKingLevel: system.getLevel('poison_king'),
        stageStatMultiplier
      });
      syncHpBar(king);
    });

    const contractUpdater = () => {
      const king = scene.poisonKingRuntime?.get?.();
      if (king) syncContractStageHp(system, king);
    };
    system.passiveUpdaters.push(contractUpdater);
    contractUpdater();

    return () => {
      offBefore?.();
      offAfter?.();
      removeUpdater(system, contractUpdater);
      if (system.getData === wrappedGetData) system.getData = originalGetData;
      originalOff?.();
      beforeGrowth = null;
    };
  }
};
