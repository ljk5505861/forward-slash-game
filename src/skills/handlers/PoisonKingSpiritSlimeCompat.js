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

function syncHpBar(king) {
  const bar = king?.hpBar;
  if (!bar || !king || king.dead || king.hp <= 0) return;
  const ratio = Math.max(0, Math.min(1, king.hp / Math.max(1, king.maxHp || 1)));
  bar.fill?.setDisplaySize?.(bar.width * ratio, bar.height);
  bar.fill?.setPosition?.(-bar.width / 2, 0);
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

export const PoisonKingSkillWithSpiritSlime = {
  ...PoisonKingSkill,
  bind(system) {
    const scene = system.scene;
    let beforeGrowth = null;

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

    const eventBus = scene.eventBus;
    const originalOn = eventBus.on;
    let wrappedGrowthListener = false;
    eventBus.on = function(eventName, listener) {
      if (!wrappedGrowthListener && eventName === CombatEvents.STATUS_TICK) {
        wrappedGrowthListener = true;
        return originalOn.call(this, eventName, payload => {
          if (!isNormalPoisonTick(payload)) return listener(payload);
          const growthMultiplier = scene.professionSystem
            ?.summonCreatureContractMultiplier?.('poison_king', 'growthMultiplier') || 1;
          if (growthMultiplier === 1) return listener(payload);
          return listener({
            ...payload,
            actualDamage: payload.actualDamage * growthMultiplier
          });
        });
      }
      return originalOn.call(this, eventName, listener);
    };

    let originalOff;
    try {
      originalOff = PoisonKingSkill.bind(system);
    } finally {
      eventBus.on = originalOn;
    }

    const offAfter = scene.eventBus.on(CombatEvents.STATUS_TICK, payload => {
      const snapshot = beforeGrowth;
      beforeGrowth = null;
      if (!snapshot || !isNormalPoisonTick(payload)) return;
      const king = scene.poisonKingRuntime?.get?.();
      if (!king || king !== snapshot.king || king.dead || king.hp <= 0) return;
      const stageGain = Math.max(0, (king.stage || 0) - snapshot.stage);
      if (stageGain <= 0) return;

      const stageStatMultiplier = scene.professionSystem
        ?.summonCreatureContractMultiplier?.('poison_king', 'stageStatMultiplier') || 1;
      if (stageStatMultiplier > 1) {
        const standardGain = POISON_ADVANCED_TUNING.king.hpPerStage;
        const contractedGain = Math.round(standardGain * stageStatMultiplier);
        king.baseMaxHp = (king.baseMaxHp || king.maxHp)
          + stageGain * Math.max(0, contractedGain - standardGain);
        const data = system.getData('poison_king') || {};
        scene.professionSystem?.applyEntitySummonStats?.(king, 'poison_king', {
          baseAttack: (data.biteDamage || 0)
            + (king.stage || 0) * POISON_ADVANCED_TUNING.king.damagePerStage,
          baseDefense: 0,
          baseMaxHp: king.baseMaxHp
        });
      }

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

    return () => {
      offBefore?.();
      originalOff?.();
      offAfter?.();
      beforeGrowth = null;
    };
  }
};
