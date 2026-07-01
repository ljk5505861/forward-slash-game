import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { BALANCE } from '../../config/balance.js';

export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

const TWO_PI = Math.PI * 2;
const PROTECTED_ENEMY_STATES = new Set(['windup', 'slamWind', 'charge', 'jump', 'jumping', 'skillActive', 'recovery', 'cool']);

const N = {
  singlePulseDamage: [72, 80, 90, 101, 113, 128, 144, 162, 184],
  sweepDamage: [54, 60, 68, 77, 87, 99, 113, 129, 148],
  cycleIntervalMs: [7200, 7000, 6800, 6600, 6400, 6100, 5900, 5700, 5400],
  pulseGapMs: [300, 290, 280, 270, 260, 240, 230, 220, 200],
  sweepChargeMs: [460, 440, 420, 400, 380, 350, 330, 310, 280],
  sweepDurationMs: [620, 610, 600, 590, 580, 550, 530, 510, 480],
  sweepHalfAngleDeg: [18, 18, 22, 22, 22, 28, 29, 30, 36],
  sameTargetSecondPulseBonus: [0, 0, .45, .45, .45, .45, .45, .45, .45],
  pulseMarkedSweepBonus: [0, 0, 0, 0, 0, .30, .30, .30, .30],
  sweepDefenseIgnore: [0, 0, 0, 0, 0, 0, 0, 0, .35],
  fullViewportSweep: [false, false, false, false, false, false, false, false, true]
};

const W = {
  damageReduction: [.12, .13, .15, .16, .17, .19, .20, .21, .24],
  guardReduction: [.55, .57, .60, .62, .64, .68, .70, .72, .78],
  guardRechargeMs: [8500, 8200, 7800, 7500, 7200, 6800, 6400, 6000, 5200],
  guardTriggerMaxHpRatio: [.10, .10, .09, .09, .08, .08, .07, .07, .06],
  criticalHpRatio: [.30, .30, .32, .32, .34, .34, .36, .36, .40],
  postGuardDamageReduction: [0, 0, .12, .13, .14, .16, .17, .18, .20],
  postGuardDurationMs: [0, 0, 1200, 1250, 1300, 1450, 1500, 1550, 1800],
  burstDamage: [0, 0, 0, 0, 0, 85, 100, 116, 140],
  burstRadius: [0, 0, 0, 0, 0, 175, 185, 195, 225],
  burstKnockback: [0, 0, 0, 0, 0, 48, 54, 60, 72],
  guardCharges: [1, 1, 1, 1, 1, 1, 1, 1, 2],
  emergencyProjectedHpRatio: [0, 0, 0, 0, 0, 0, 0, 0, .25],
  emergencyGuardReduction: [0, 0, 0, 0, 0, 0, 0, 0, .92],
  orbitRadius: [82, 84, 88, 90, 92, 96, 98, 100, 108],
  orbitPeriodMs: [2400, 2350, 2300, 2250, 2200, 2100, 2050, 2000, 1850]
};

export const NEUTRON_STAR_VALUES = N;
export const WHITE_DWARF_VALUES = W;

const now = scene => scene.getGameplayTime?.() ?? scene.now ?? 0;
const levelData = (system, id, level) => SKILLS[id].levels[level - 1];
const isAlive = enemy => enemy && enemy.active !== false && !enemy.isDefeated && (enemy.hp ?? 1) > 0;
const visibleEnemies = scene => (scene.targeting?.all?.() || scene.enemies || [])
  .filter(enemy => isAlive(enemy) && scene.targeting?.isEnemyFullyInsideViewport?.(enemy) !== false);
const destroy = object => object?.destroy?.();

function trackVisual(runtime, object) {
  if (object) runtime.visuals.add(object);
  return object;
}

function destroyTracked(runtime, object) {
  if (!object) return;
  runtime.visuals.delete(object);
  destroy(object);
}

function trackTransient(runtime, object, expiresAt) {
  if (!object) return object;
  trackVisual(runtime, object);
  runtime.transients.push({ object, expiresAt });
  return object;
}

function expireTransients(runtime, time) {
  runtime.transients = runtime.transients.filter(entry => {
    if (time < entry.expiresAt && !entry.object?.destroyed) return true;
    destroyTracked(runtime, entry.object);
    return false;
  });
}

function cleanupVisuals(runtime) {
  runtime?.visuals?.forEach(destroy);
  runtime?.visuals?.clear?.();
  if (runtime) runtime.transients = [];
}

function normalizeAngle(value) {
  let angle = value % TWO_PI;
  if (angle < 0) angle += TWO_PI;
  return angle;
}

function unwrapFromStart(angle, startAngle) {
  return startAngle + normalizeAngle(angle - startAngle);
}

function isProtectedFromBurstKnockback(enemy) {
  return !!(enemy?.casting
    || enemy?.charging
    || enemy?.dashing
    || enemy?.jumping
    || enemy?.skillActive
    || enemy?.isCasting
    || enemy?.isCharging
    || enemy?.isDashing
    || enemy?.isJumping
    || PROTECTED_ENEMY_STATES.has(enemy?.attackState)
    || PROTECTED_ENEMY_STATES.has(enemy?.behaviorState));
}

export function neutronStarScreenPosition(scene) {
  const groundTopY = scene.balance?.groundTopY ?? 620;
  return {
    x: (DESIGN_WIDTH * BALANCE.camera.playerScreenAnchorX + DESIGN_WIDTH / 2) / 2,
    y: groundTopY - 245
  };
}

function neutronStarWorldOrigin(scene) {
  const screen = neutronStarScreenPosition(scene);
  const camera = scene.cameras?.main;
  return {
    x: (camera?.worldView?.x ?? ((camera?.worldView?.centerX ?? DESIGN_WIDTH / 2) - DESIGN_WIDTH / 2)) + screen.x,
    y: (camera?.worldView?.y ?? 0) + screen.y,
    screen
  };
}

function damageWithNeutronStar(system, enemy, amount, extra = {}) {
  if (!isAlive(enemy)) return false;
  return system.scene.combatSystem?.damageEnemy?.(enemy, Math.round(amount), {
    source: 'skill',
    skillId: 'neutron_star',
    tags: [TAGS.MAGIC, TAGS.CELESTIAL, TAGS.BUILD_CELESTIAL],
    ...extra
  });
}

function pickPulseTarget(scene, excludedEnemy) {
  const pool = visibleEnemies(scene).filter(enemy => enemy !== excludedEnemy);
  const target = pool.sort((a, b) => (b.hp - a.hp) || Math.abs(a.x - scene.player.x) - Math.abs(b.x - scene.player.x))[0];
  return target || (excludedEnemy ? visibleEnemies(scene)[0] : null);
}

function createScreenBeam(scene, runtime, origin, angle, width, alpha) {
  const length = Math.hypot(DESIGN_WIDTH, DESIGN_HEIGHT) * 1.25;
  const beam = scene.add?.rectangle?.(origin.screen.x, origin.screen.y, length, width, 0x7dd3fc, alpha);
  beam?.setOrigin?.(0, .5);
  beam?.setScrollFactor?.(0);
  beam?.setDepth?.(19);
  beam?.setRotation?.(angle);
  return trackVisual(runtime, beam);
}

function createPulseVisual(scene, runtime, origin, target, data, time) {
  const line = scene.add?.line?.(0, 0, origin.x, origin.y, target.x, target.y, 0xe0f2fe, .75);
  line?.setOrigin?.(0, 0);
  line?.setDepth?.(20);
  trackTransient(runtime, line, time + data.singlePulseVisualMs);
}

function ensureNeutronRuntime(system) {
  const scene = system.scene;
  if (scene.neutronStarRuntime) return scene.neutronStarRuntime;
  const runtime = scene.neutronStarRuntime = {
    visuals: new Set(),
    transients: [],
    active: false,
    phase: 'idle',
    nextAt: now(scene),
    pulseHits: new Set(),
    firstTarget: null,
    sweepPlan: null,
    sweep: null,
    updater: null,
    shutdown: null
  };
  runtime.updater = () => updateNeutronStar(system);
  system.passiveUpdaters.push(runtime.updater);
  runtime.shutdown = () => NeutronStarSkill.destroyRuntime(system);
  scene.events?.once?.('shutdown', runtime.shutdown);
  return runtime;
}

function resetNeutronCycle(runtime, time) {
  runtime.phase = 'idle';
  runtime.nextAt = time;
  runtime.firstTarget = null;
  runtime.pulseHits.clear();
  runtime.sweepPlan = null;
  runtime.sweep = null;
}

function deactivateNeutronStar(runtime, time) {
  cleanupVisuals(runtime);
  runtime.body = null;
  runtime.ring = null;
  runtime.active = false;
  resetNeutronCycle(runtime, time);
}

function activateNeutronStar(runtime, time) {
  if (runtime.active) return;
  runtime.active = true;
  resetNeutronCycle(runtime, time);
}

function prepareSweep(scene, runtime, data, time) {
  const targets = visibleEnemies(scene);
  const origin = neutronStarWorldOrigin(scene);
  const centerAngle = targets.length
    ? Math.atan2(
      targets.reduce((sum, enemy) => sum + enemy.y, 0) / targets.length - origin.y,
      targets.reduce((sum, enemy) => sum + enemy.x, 0) / targets.length - origin.x
    )
    : 0;
  const halfAngle = data.fullViewportSweep ? Math.PI : data.sweepHalfAngleDeg * Math.PI / 180;
  const startAngle = centerAngle - halfAngle;
  const endAngle = centerAngle + halfAngle;
  const warning = createScreenBeam(scene, runtime, origin, centerAngle, data.sweepBeamWidthPx * 3, data.sweepWarningAlpha);
  runtime.sweepPlan = { origin, centerAngle, startAngle, endAngle, warning, preparedAt: time };
}

function startSweep(scene, runtime, data, time) {
  const plan = runtime.sweepPlan || (() => {
    prepareSweep(scene, runtime, data, time);
    return runtime.sweepPlan;
  })();
  destroyTracked(runtime, plan.warning);
  const beam = createScreenBeam(scene, runtime, plan.origin, plan.startAngle, data.sweepBeamWidthPx, .78);
  runtime.sweep = {
    startAt: time,
    endAt: time + data.sweepDurationMs,
    startAngle: plan.startAngle,
    endAngle: plan.endAngle,
    lastAngle: plan.startAngle,
    origin: plan.origin,
    hit: new Set(),
    beam
  };
  runtime.sweepPlan = null;
  runtime.phase = 'sweep';
  runtime.nextAt = time;
}

function beamTouchesEnemy(enemy, sweep, fromAngle, toAngle, data) {
  const dx = enemy.x - sweep.origin.x;
  const dy = enemy.y - sweep.origin.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const enemyHalfWidth = Math.max(12, (enemy.displayWidth || enemy.width || 40) * .5);
  const angularTolerance = Math.atan2(enemyHalfWidth + data.sweepBeamWidthPx * .5, distance);
  const targetAngle = unwrapFromStart(Math.atan2(dy, dx), sweep.startAngle);
  return targetAngle + angularTolerance >= fromAngle && targetAngle - angularTolerance <= toAngle;
}

function updateSweep(system, runtime, data, time) {
  const sweep = runtime.sweep;
  if (!sweep) return;
  const progress = Math.max(0, Math.min(1, (time - sweep.startAt) / Math.max(1, data.sweepDurationMs)));
  const currentAngle = sweep.startAngle + (sweep.endAngle - sweep.startAngle) * progress;
  sweep.beam?.setRotation?.(currentAngle);
  const fromAngle = Math.min(sweep.lastAngle, currentAngle);
  const toAngle = Math.max(sweep.lastAngle, currentAngle);
  for (const enemy of visibleEnemies(system.scene)) {
    if (sweep.hit.has(enemy) || !beamTouchesEnemy(enemy, sweep, fromAngle, toAngle, data)) continue;
    const bonus = runtime.pulseHits.has(enemy) ? 1 + data.pulseMarkedSweepBonus : 1;
    damageWithNeutronStar(system, enemy, data.sweepDamage * bonus, { defenseIgnore: data.sweepDefenseIgnore });
    sweep.hit.add(enemy);
  }
  sweep.lastAngle = currentAngle;
  if (time < sweep.endAt) return;
  destroyTracked(runtime, sweep.beam);
  runtime.sweep = null;
  runtime.phase = 'idle';
  runtime.nextAt = time + data.cycleIntervalMs;
  runtime.firstTarget = null;
  runtime.pulseHits.clear();
}

function updateNeutronStar(system) {
  const scene = system.scene;
  const runtime = ensureNeutronRuntime(system);
  const level = system.getLevel?.('neutron_star') || 0;
  const time = now(scene);
  expireTransients(runtime, time);
  if (!level) {
    if (runtime.active || runtime.visuals.size) deactivateNeutronStar(runtime, time);
    return;
  }
  activateNeutronStar(runtime, time);
  const data = levelData(system, 'neutron_star', level);
  if (!runtime.body && scene.add) {
    const position = neutronStarScreenPosition(scene);
    runtime.body = trackVisual(runtime, scene.add.circle?.(position.x, position.y, 16, 0x7dd3fc, .95));
    runtime.body?.setScrollFactor?.(0);
    runtime.body?.setDepth?.(18);
    runtime.ring = trackVisual(runtime, scene.add.circle?.(position.x, position.y, 28, 0x38bdf8, .25));
    runtime.ring?.setStrokeStyle?.(4, 0xe0f2fe, .8);
    runtime.ring?.setScrollFactor?.(0);
    runtime.ring?.setDepth?.(18);
  }
  const position = neutronStarScreenPosition(scene);
  runtime.body?.setPosition?.(position.x, position.y);
  runtime.ring?.setPosition?.(position.x, position.y);
  if (time < runtime.nextAt) return;
  if (runtime.phase === 'idle') {
    runtime.phase = 'pulse1';
    runtime.pulseHits.clear();
  }
  if (runtime.phase === 'pulse1' || runtime.phase === 'pulse2') {
    const secondPulse = runtime.phase === 'pulse2';
    const target = secondPulse ? pickPulseTarget(scene, runtime.firstTarget) : pickPulseTarget(scene, null);
    if (target) {
      const sameTarget = secondPulse && target === runtime.firstTarget;
      const multiplier = sameTarget ? 1 + data.sameTargetSecondPulseBonus : 1;
      damageWithNeutronStar(system, target, data.singlePulseDamage * multiplier, { defenseIgnore: 0 });
      runtime.pulseHits.add(target);
      if (!secondPulse) runtime.firstTarget = target;
      const origin = neutronStarWorldOrigin(scene);
      runtime.lastAttackOrigin = origin;
      createPulseVisual(scene, runtime, origin, target, data, time);
    }
    if (secondPulse) {
      prepareSweep(scene, runtime, data, time);
      runtime.phase = 'charge';
      runtime.nextAt = time + data.sweepChargeMs;
    } else {
      runtime.phase = 'pulse2';
      runtime.nextAt = time + data.pulseGapMs;
    }
    return;
  }
  if (runtime.phase === 'charge') {
    startSweep(scene, runtime, data, time);
    return;
  }
  if (runtime.phase === 'sweep') updateSweep(system, runtime, data, time);
}

export const NeutronStarSkill = {
  bind(system) {
    if (system.getLevel?.('neutron_star')) {
      activateNeutronStar(ensureNeutronRuntime(system), now(system.scene));
    }
    return () => NeutronStarSkill.destroyRuntime(system);
  },
  onAcquire(system) {
    activateNeutronStar(ensureNeutronRuntime(system), now(system.scene));
  },
  destroyRuntime(system) {
    const scene = system.scene;
    const runtime = scene.neutronStarRuntime;
    if (!runtime) return;
    cleanupVisuals(runtime);
    system.passiveUpdaters = system.passiveUpdaters.filter(updater => updater !== runtime.updater);
    if (runtime.shutdown) scene.events?.off?.('shutdown', runtime.shutdown);
    scene.neutronStarRuntime = null;
  }
};

function ensureWhiteDwarfRuntime(system) {
  const scene = system.scene;
  if (scene.whiteDwarfRuntime) return scene.whiteDwarfRuntime;
  const runtime = scene.whiteDwarfRuntime = {
    visuals: [],
    transients: [],
    charges: [],
    active: false,
    angle: 0,
    last: now(scene),
    guardUntil: 0,
    updater: null,
    shutdown: null,
    getSkillBarState() {
      const time = now(scene);
      const ready = this.charges.filter(charge => charge.readyAt <= time).length;
      const total = this.charges.length;
      const remaining = this.charges.length ? Math.max(0, ...this.charges.map(charge => charge.readyAt - time)) : 0;
      return { text: ready === total ? `护体 ${ready}/${total}` : `护体 ${ready}/${total} · ${Math.ceil(remaining / 1000)}s` };
    }
  };
  runtime.updater = () => updateWhiteDwarf(system);
  system.passiveUpdaters.push(runtime.updater);
  runtime.shutdown = () => WhiteDwarfSkill.destroyRuntime(system);
  scene.events?.once?.('shutdown', runtime.shutdown);
  return runtime;
}

function syncWhiteDwarfReduction(system) {
  const level = system.getLevel?.('white_dwarf') || 0;
  const playerData = system.scene.playerData;
  playerData.damageReductionBonuses ??= {};
  if (level) playerData.damageReductionBonuses.white_dwarf = SKILLS.white_dwarf.levels[level - 1].damageReduction;
  else {
    delete playerData.damageReductionBonuses.white_dwarf;
    delete playerData.damageReductionBonuses.white_dwarf_guard;
  }
}

function ensureWhiteDwarfCharges(runtime, data, time) {
  while (runtime.charges.length < data.guardCharges) runtime.charges.push({ readyAt: time });
  runtime.charges.length = data.guardCharges;
}

function syncWhiteDwarfVisualCount(scene, runtime, data) {
  while (runtime.visuals.length > data.guardCharges) destroy(runtime.visuals.pop());
  while (runtime.visuals.length < data.guardCharges) {
    const star = scene.add?.circle?.(scene.player.x, scene.player.y, data.whiteDwarfVisualRadius, 0xe0f2fe, .9);
    star?.setDepth?.(12);
    runtime.visuals.push(star);
  }
}

function positionWhiteDwarfs(system, data, runtime, time) {
  const scene = system.scene;
  runtime.visuals.forEach((visual, index) => {
    const angle = runtime.angle + index * TWO_PI / Math.max(1, runtime.visuals.length);
    visual?.setPosition?.(
      scene.player.x + Math.cos(angle) * data.orbitRadius,
      scene.player.y + Math.sin(angle) * data.orbitRadius
    );
    visual?.setAlpha?.(runtime.charges[index]?.readyAt <= time ? .9 : .35);
  });
}

function activateWhiteDwarf(system, runtime, data, time) {
  if (!runtime.active) {
    runtime.active = true;
    runtime.last = time;
    runtime.angle = 0;
  }
  ensureWhiteDwarfCharges(runtime, data, time);
  syncWhiteDwarfReduction(system);
  syncWhiteDwarfVisualCount(system.scene, runtime, data);
  positionWhiteDwarfs(system, data, runtime, time);
}

function deactivateWhiteDwarf(system, runtime) {
  runtime.visuals.forEach(destroy);
  runtime.visuals = [];
  runtime.transients.forEach(entry => destroy(entry.object));
  runtime.transients = [];
  runtime.charges = [];
  runtime.active = false;
  runtime.guardUntil = 0;
  syncWhiteDwarfReduction(system);
}

function expireWhiteDwarfTransients(runtime, time) {
  runtime.transients = runtime.transients.filter(entry => {
    if (time < entry.expiresAt && !entry.object?.destroyed) return true;
    destroy(entry.object);
    return false;
  });
}

function showGuardBurst(system, data, runtime, time) {
  const scene = system.scene;
  const ring = scene.add?.circle?.(scene.player.x, scene.player.y, data.burstRadius || data.orbitRadius, 0xe0f2fe, .08);
  ring?.setStrokeStyle?.(4, 0xe0f2fe, .9);
  ring?.setDepth?.(13);
  if (ring) runtime.transients.push({ object: ring, expiresAt: time + data.guardBurstVisualMs });
}

function burstFromWhiteDwarf(system, data, runtime, time) {
  const scene = system.scene;
  showGuardBurst(system, data, runtime, time);
  for (const enemy of visibleEnemies(scene)) {
    if (Math.hypot(enemy.x - scene.player.x, enemy.y - scene.player.y) > data.burstRadius) continue;
    scene.combatSystem?.damageEnemy?.(enemy, data.burstDamage, {
      source: 'skill',
      skillId: 'white_dwarf',
      tags: [TAGS.MAGIC, TAGS.CELESTIAL, TAGS.BUILD_CELESTIAL, 'area'],
      allowLifeSteal: false,
      noKnockback: true
    });
    if (enemy.isBoss || !data.burstKnockback || isProtectedFromBurstKnockback(enemy)) continue;
    scene.combatSystem?.applyKnockback?.(enemy, { source: 'skill', knockback: data.burstKnockback });
  }
}

function updateWhiteDwarf(system) {
  const scene = system.scene;
  const runtime = ensureWhiteDwarfRuntime(system);
  const level = system.getLevel?.('white_dwarf') || 0;
  const time = now(scene);
  expireWhiteDwarfTransients(runtime, time);
  if (!level) {
    if (runtime.active || runtime.visuals.length || runtime.charges.length) deactivateWhiteDwarf(system, runtime);
    return;
  }
  const data = levelData(system, 'white_dwarf', level);
  activateWhiteDwarf(system, runtime, data, time);
  if (runtime.guardUntil && time >= runtime.guardUntil) {
    delete scene.playerData.damageReductionBonuses.white_dwarf_guard;
    runtime.guardUntil = 0;
  }
  const elapsed = Math.max(0, time - runtime.last);
  runtime.last = time;
  runtime.angle += elapsed / Math.max(1, data.orbitPeriodMs) * TWO_PI;
  positionWhiteDwarfs(system, data, runtime, time);
}

export const WhiteDwarfSkill = {
  bind(system) {
    const level = system.getLevel?.('white_dwarf') || 0;
    if (level) {
      activateWhiteDwarf(system, ensureWhiteDwarfRuntime(system), levelData(system, 'white_dwarf', level), now(system.scene));
    } else {
      syncWhiteDwarfReduction(system);
    }
    return () => WhiteDwarfSkill.destroyRuntime(system);
  },
  onAcquire(system) {
    const level = system.getLevel?.('white_dwarf') || 0;
    if (!level) return;
    activateWhiteDwarf(system, ensureWhiteDwarfRuntime(system), levelData(system, 'white_dwarf', level), now(system.scene));
  },
  syncAttachedVisuals(system) {
    const level = system.getLevel?.('white_dwarf') || 0;
    const runtime = system.scene.whiteDwarfRuntime;
    if (!level || !runtime?.active) return;
    positionWhiteDwarfs(system, levelData(system, 'white_dwarf', level), runtime, now(system.scene));
  },
  destroyRuntime(system) {
    const scene = system.scene;
    const runtime = scene.whiteDwarfRuntime;
    if (runtime) {
      runtime.visuals.forEach(destroy);
      runtime.transients.forEach(entry => destroy(entry.object));
      system.passiveUpdaters = system.passiveUpdaters.filter(updater => updater !== runtime.updater);
      if (runtime.shutdown) scene.events?.off?.('shutdown', runtime.shutdown);
    }
    delete scene.playerData?.damageReductionBonuses?.white_dwarf;
    delete scene.playerData?.damageReductionBonuses?.white_dwarf_guard;
    scene.whiteDwarfRuntime = null;
  },
  beforePlayerHpDamage(system, payload) {
    const scene = system.scene;
    const level = system.getLevel?.('white_dwarf') || 0;
    if (!level || !payload.directAttack || payload.hpDamage <= 0) return null;
    const data = levelData(system, 'white_dwarf', level);
    const runtime = ensureWhiteDwarfRuntime(system);
    const time = now(scene);
    activateWhiteDwarf(system, runtime, data, time);
    const chargeIndex = runtime.charges.findIndex(charge => charge.readyAt <= time);
    if (chargeIndex < 0) return null;
    const maxHp = scene.playerData.maxHp || 100;
    const currentHp = scene.playerData.hp ?? maxHp;
    const projectedRatio = (currentHp - payload.hpDamage) / maxHp;
    let reduction = data.guardReduction;
    let shouldTrigger = payload.hpDamage >= maxHp * data.guardTriggerMaxHpRatio || currentHp / maxHp <= data.criticalHpRatio;
    if (data.emergencyProjectedHpRatio && projectedRatio <= data.emergencyProjectedHpRatio) {
      shouldTrigger = true;
      reduction = data.emergencyGuardReduction;
      scene.floatText?.(scene.player.x, scene.player.y - 40, data.emergencyFloatText, 0xe0f2fe);
    }
    if (!shouldTrigger) return null;
    runtime.charges[chargeIndex].readyAt = time + data.guardRechargeMs;
    const hpDamage = Math.max(1, Math.round(payload.hpDamage * (1 - reduction)));
    if (data.postGuardDamageReduction) {
      scene.playerData.damageReductionBonuses ??= {};
      scene.playerData.damageReductionBonuses.white_dwarf_guard = data.postGuardDamageReduction;
      runtime.guardUntil = Math.max(runtime.guardUntil, time + data.postGuardDurationMs);
    }
    if (data.burstDamage) burstFromWhiteDwarf(system, data, runtime, time);
    positionWhiteDwarfs(system, data, runtime, time);
    scene.floatText?.(scene.player.x, scene.player.y - 28, data.guardFloatText, 0xe0f2fe);
    return { hpDamage };
  }
};

export function configureCelestialFlowSkills() {
  const neutronLevels = Array.from({ length: 9 }, (_, index) => ({
    singlePulseCount: 2,
    singlePulseVisualMs: 140,
    sweepWarningAlpha: .20,
    sweepBeamWidthPx: 18,
    sweepHitLimitPerEnemy: 1,
    maxSinglePulseTargets: 2,
    ...Object.fromEntries(Object.keys(N).map(key => [key, N[key][index]])),
    desc: `单体脉冲${N.singlePulseDamage[index]}，横扫${N.sweepDamage[index]}，循环${(N.cycleIntervalMs[index] / 1000).toFixed(1)}秒。`,
    milestoneText: index === 2 ? '脉冲聚焦' : index === 5 ? '脉冲共振' : index === 8 ? '全域星脉' : undefined
  }));
  const whiteDwarfLevels = Array.from({ length: 9 }, (_, index) => ({
    whiteDwarfVisualRadius: 22,
    whiteDwarfGlowRadius: 34,
    guardBurstVisualMs: 260,
    guardFloatText: '简并护体',
    emergencyFloatText: '临界稳定',
    ...Object.fromEntries(Object.keys(W).map(key => [key, W[key][index]])),
    desc: `常驻减伤${Math.round(W.damageReduction[index] * 100)}%，护体减伤${Math.round(W.guardReduction[index] * 100)}%，恢复${(W.guardRechargeMs[index] / 1000).toFixed(1)}秒。`,
    milestoneText: index === 2 ? '简并星壳' : index === 5 ? '质量反冲' : index === 8 ? '双星稳定' : undefined
  }));
  SKILLS.neutron_star = {
    id: 'neutron_star',
    name: '中子星',
    rarity: 'MYTHIC',
    handler: 'neutron_star',
    passive: true,
    ultimateSkill: true,
    maxLevel: 9,
    targetType: 'passive',
    manaCost: 0,
    short: '星',
    color: 0x7dd3fc,
    tags: [TAGS.MAGIC, TAGS.CELESTIAL, TAGS.BUILD_CELESTIAL, 'mythicSkill'],
    description: '获得后永久悬浮于太阳与黑洞之间，周期释放两次单体脉冲，随后释放一次横扫脉冲。',
    milestones: {
      3: '脉冲聚焦：两次单体脉冲命中同一目标时，第二次脉冲伤害提高45%。',
      6: '脉冲共振：横扫脉冲对本轮已被单体脉冲命中的敌人额外造成30%伤害。',
      9: '全域星脉：横扫覆盖当前全部可视敌人，并无视35%防御。'
    },
    levels: neutronLevels
  };
  SKILLS.white_dwarf = {
    id: 'white_dwarf',
    name: '白矮星',
    rarity: 'MYTHIC',
    handler: 'white_dwarf',
    passive: true,
    ultimateSkill: true,
    maxLevel: 9,
    targetType: 'passive',
    manaCost: 0,
    short: '矮',
    color: 0xe0f2fe,
    tags: [TAGS.MAGIC, TAGS.CELESTIAL, TAGS.BUILD_CELESTIAL, TAGS.SHIELD, 'mythicSkill'],
    description: '白矮星永久围绕玩家旋转，提供常驻减伤，并消耗护体次数压缩高额直接伤害。',
    milestones: {
      3: '简并星壳：护体触发后，短时间内获得额外伤害减免。',
      6: '质量反冲：护体触发时，对玩家周围敌人造成范围魔法伤害并推离普通敌人。',
      9: '双星稳定：生成第二颗白矮星，获得两次独立护体；致命重击将触发临界稳定。'
    },
    levels: whiteDwarfLevels
  };
}
