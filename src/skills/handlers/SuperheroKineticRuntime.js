import { SKILLS } from '../../config/skills.js';
import CombatSystem from '../../systems/CombatSystem.js';
import { applyEnemyCold } from '../../systems/EnemyColdControl.js';

const KINETIC_ATTACK_MULTIPLIER_KEY = '__superSpeedKineticMultiplier';
let combatPatched = false;

const nowOf = scene => scene.getGameplayTime?.() ?? 0;
const validEnemy = (scene, enemy) => !!enemy && scene.targeting?.valid?.(enemy) !== false && !enemy.isDefeated && (enemy.hp ?? 1) > 0;

function kineticState(system) {
  return system?.passiveState?.superSpeed || null;
}

function hasLinkedSuperheroSkill(system) {
  return (system?.getLevel?.('laser_eyes') || 0) > 0 || (system?.getLevel?.('freezing_breath') || 0) > 0;
}

function canUseKinetic(system) {
  const state = kineticState(system);
  const data = system?.getData?.('super_speed');
  return !!(state?.kineticReady && state.highSpeed && data?.kineticEnabled && (system.getLevel?.('super_speed') || 0) >= 6);
}

function showKineticFeedback(scene, text, color = 0xffe36e) {
  const x = scene.player?.x ?? 0;
  const y = (scene.player?.y ?? 0) - 58;
  const ring = scene.add?.circle?.(x, y, 34, color, 0.08)?.setStrokeStyle?.(5, color, 0.95)?.setDepth?.(175);
  if (ring && scene.tweens?.add) {
    scene.tweens.add({ targets: ring, scale: 1.65, alpha: 0, duration: 360, onComplete: () => ring.destroy?.() });
  }
  const label = scene.add?.text?.(x, y - 46, text, {
    fontFamily: 'Arial, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#fff4a8',
    stroke: '#5b4300', strokeThickness: 5
  })?.setOrigin?.(0.5)?.setDepth?.(180);
  if (label && scene.tweens?.add) {
    scene.tweens.add({ targets: label, y: y - 82, alpha: 0, duration: 620, onComplete: () => label.destroy?.() });
  }
}

function grantKinetic(system) {
  const state = kineticState(system);
  if (!state) return;
  state.kineticReady = true;
  state.kineticConsumedBy = null;
  state.kineticGrantedAt = nowOf(system.scene);
  showKineticFeedback(system.scene, '动能就绪');
}

function clearKinetic(system) {
  const state = kineticState(system);
  if (!state) return;
  state.kineticReady = false;
  state.kineticConsumedBy = null;
}

function consumeKinetic(system, kind, feedbackText, feedbackColor) {
  if (!canUseKinetic(system)) return false;
  const state = kineticState(system);
  state.kineticReady = false;
  state.kineticConsumedBy = kind;
  showKineticFeedback(system.scene, feedbackText, feedbackColor);
  return true;
}

function configureKineticSkillData() {
  const skill = SKILLS.super_speed;
  if (!skill) return;
  skill.description = '提高移动速度与常驻攻击速度；Lv3后进入高速状态，Lv6后每次高速可积蓄一次动能强化。';
  skill.milestones ??= {};
  skill.milestones[6] = '动能强化：高速额外攻速提高至8%，停止保留3秒；每次高速获得1次动能，优先强化下一次镭射眼或冰冻吐息，没有两者时强化下一次本体武器攻击。';
  skill.levels?.forEach((data, index) => {
    data.weaponWaitCutRatio = 0;
    data.kineticEnabled = index >= 5;
    data.kineticLaserDurationBonus = index >= 5 ? 0.25 : 0;
    data.kineticLaserWidthBonus = index >= 5 ? 0.20 : 0;
    data.kineticBreathRangeBonus = index >= 5 ? 0.20 : 0;
    data.kineticBreathAngleBonus = index >= 5 ? 0.15 : 0;
    data.kineticBreathFirstHitExtraStacks = index >= 5 ? 1 : 0;
    data.kineticAttackDamageBonus = index >= 5 ? 0.40 : 0;
    if (index >= 5 && typeof data.desc === 'string') {
      data.desc = data.desc.replace(
        '；每次高速状态停止后下一次玩家本体真实武器攻击剩余等待缩短50%（仅一次）',
        '；每次进入高速状态获得1次动能：优先强化下一次镭射眼或冰冻吐息，没有两者时使下一次玩家本体真实武器攻击伤害+40%'
      );
    }
  });
}

function patchCombatSystem() {
  if (combatPatched) return;
  combatPatched = true;
  const basePerformAttack = CombatSystem.prototype.performAttack;
  const baseAttackDamageFactors = CombatSystem.prototype.attackDamageFactors;

  CombatSystem.prototype.attackDamageFactors = function attackDamageFactorsWithKinetic(weapon, profile = null, heavy = false) {
    const result = baseAttackDamageFactors.call(this, weapon, profile, heavy);
    const multiplier = Math.max(1, Number(profile?.[KINETIC_ATTACK_MULTIPLIER_KEY] || this[KINETIC_ATTACK_MULTIPLIER_KEY] || 1));
    if (multiplier === 1) return result;
    return { ...result, nonCritBaseDamage: Math.max(1, Math.round(result.nonCritBaseDamage * multiplier)) };
  };

  CombatSystem.prototype.performAttack = function performAttackWithKinetic(target, weapon, profile) {
    const system = this.scene?.skillSystem;
    const data = system?.getData?.('super_speed');
    const shouldConsume = canUseKinetic(system) && !hasLinkedSuperheroSkill(system) && (data?.kineticAttackDamageBonus || 0) > 0;
    if (!shouldConsume) return basePerformAttack.call(this, target, weapon, profile);

    const multiplier = 1 + data.kineticAttackDamageBonus;
    consumeKinetic(system, 'attack', '动能重击', 0xffd34d);
    if (profile) {
      return basePerformAttack.call(this, target, weapon, { ...profile, [KINETIC_ATTACK_MULTIPLIER_KEY]: multiplier });
    }
    this[KINETIC_ATTACK_MULTIPLIER_KEY] = multiplier;
    try {
      return basePerformAttack.call(this, target, weapon, profile);
    } finally {
      delete this[KINETIC_ATTACK_MULTIPLIER_KEY];
    }
  };
}

function wrapSuperSpeed(SuperSpeedSkill) {
  const baseBind = SuperSpeedSkill.bind;
  SuperSpeedSkill.bind = system => {
    const baseCleanup = baseBind(system);
    const state = kineticState(system);
    if (state) {
      state.kineticReady = false;
      state.kineticConsumedBy = null;
      state.kineticGrantedAt = 0;
    }
    let wasHighSpeed = !!state?.highSpeed;
    let wasKineticEnabled = !!system.getData('super_speed')?.kineticEnabled;

    const updater = () => {
      const current = kineticState(system);
      const data = system.getData('super_speed');
      const enabled = !!data?.kineticEnabled;
      if (!current || system.scene.playerData.hp <= 0 || !enabled) {
        clearKinetic(system);
        wasHighSpeed = !!current?.highSpeed;
        wasKineticEnabled = enabled;
        return;
      }
      if (current.highSpeed && (!wasHighSpeed || !wasKineticEnabled)) grantKinetic(system);
      if (!current.highSpeed && wasHighSpeed) clearKinetic(system);
      wasHighSpeed = current.highSpeed;
      wasKineticEnabled = enabled;
    };

    system.passiveUpdaters.push(updater);
    return () => {
      system.passiveUpdaters = system.passiveUpdaters.filter(fn => fn !== updater);
      clearKinetic(system);
      baseCleanup?.();
    };
  };
}

function wrapLaserEyes(LaserEyesSkill) {
  const baseCast = LaserEyesSkill.cast;
  LaserEyesSkill.cast = (system, cfg, data, level, ctx) => {
    const kinetic = canUseKinetic(system);
    const speedData = system.getData('super_speed');
    const castData = kinetic ? {
      ...data,
      durationMs: Math.round(data.durationMs * (1 + (speedData.kineticLaserDurationBonus || 0))),
      width: data.width * (1 + (speedData.kineticLaserWidthBonus || 0)),
      kineticEnhanced: true
    } : data;
    const result = baseCast(system, cfg, castData, level, ctx);
    if (!result?.failed && kinetic) consumeKinetic(system, 'laser_eyes', '动能镭射', 0xff5533);
    return result;
  };
}

function inCone(enemy, snapshot) {
  if (!snapshot) return false;
  const point = { x: enemy.x, y: enemy.y - (enemy.height || 60) * 0.35 };
  const dx = point.x - snapshot.origin.x;
  const dy = point.y - snapshot.origin.y;
  const length = Math.hypot(dx, dy);
  if (length > snapshot.range) return false;
  const dot = (dx * snapshot.dir.x + dy * snapshot.dir.y) / Math.max(1, length);
  return Math.acos(Math.max(-1, Math.min(1, dot))) <= snapshot.angleRad / 2;
}

function wrapFreezingBreath(FreezingBreathSkill) {
  const baseCast = FreezingBreathSkill.cast;
  FreezingBreathSkill.cast = (system, cfg, data, level, ctx) => {
    const kinetic = canUseKinetic(system);
    const speedData = system.getData('super_speed');
    const castData = kinetic ? {
      ...data,
      range: data.range * (1 + (speedData.kineticBreathRangeBonus || 0)),
      angleDeg: data.angleDeg * (1 + (speedData.kineticBreathAngleBonus || 0)),
      kineticEnhanced: true
    } : data;
    const before = new Set(system.active);
    const result = baseCast(system, cfg, castData, level, ctx);
    if (result?.failed || !kinetic) return result;

    const active = system.active.find(candidate => !before.has(candidate) && candidate.skillId === 'freezing_breath' && candidate.activeKind === 'breath');
    if (active) {
      active.kineticEnhanced = true;
      const firstHitTargets = new WeakSet();
      active.kineticFirstHitTargets = firstHitTargets;
      const baseTick = active.tick?.bind(active);
      active.tick = () => {
        const firstHits = (system.scene.targeting?.all?.() || []).filter(enemy => validEnemy(system.scene, enemy) && inCone(enemy, active.currentSnapshot) && !firstHitTargets.has(enemy));
        baseTick?.();
        firstHits.forEach(enemy => {
          firstHitTargets.add(enemy);
          applyEnemyCold(enemy, {
            now: nowOf(system.scene), data: active.data,
            stacks: speedData.kineticBreathFirstHitExtraStacks || 1,
            level: active.level, ctx: active.ctx, sourceId: 'freezing_breath'
          });
        });
      };

      const baseOnEnd = active.onEnd?.bind(active);
      active.onEnd = reason => {
        if (reason === 'complete' && active.currentSnapshot) {
          active.currentSnapshot = {
            ...active.currentSnapshot,
            origin: { ...active.currentSnapshot.origin },
            dir: { ...active.currentSnapshot.dir },
            range: data.range,
            angleRad: data.angleDeg * Math.PI / 180
          };
        }
        baseOnEnd?.(reason);
      };
    }
    consumeKinetic(system, 'freezing_breath', '动能寒息', 0x8eeaff);
    return result;
  };
}

export function configureSuperheroKineticRuntime({ SuperSpeedSkill, LaserEyesSkill, FreezingBreathSkill }) {
  configureKineticSkillData();
  patchCombatSystem();
  wrapSuperSpeed(SuperSpeedSkill);
  wrapLaserEyes(LaserEyesSkill);
  wrapFreezingBreath(FreezingBreathSkill);
}

export const __kineticTest = {
  canUseKinetic,
  hasLinkedSuperheroSkill,
  consumeKinetic,
  grantKinetic,
  clearKinetic,
  inCone,
  KINETIC_ATTACK_MULTIPLIER_KEY
};
