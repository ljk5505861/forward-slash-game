import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { BALANCE } from '../../config/balance.js';
import { applyEnemyGravity, removeEnemyGravitySource } from '../../systems/EnemyGravityControl.js';

export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

const TWO_PI = Math.PI * 2;
const PROTECTED_ENEMY_STATES = new Set(['windup', 'slamWind', 'charge', 'jump', 'jumping', 'skillActive', 'recovery', 'cool']);

const N = {
  singlePulseDamage: [72, 80, 90, 101, 113, 128, 144, 162, 184],
  sweepDamage: [54, 60, 68, 77, 87, 99, 113, 129, 148],
  roundCooldownMs: [7200, 7000, 6800, 6600, 6400, 6100, 5900, 5700, 5400],
  initialPulseDelayMs: [280, 280, 270, 270, 260, 260, 250, 250, 240],
  pulseTargetRetryMs: [120, 120, 120, 120, 120, 120, 120, 120, 120],
  pulseGapMs: [460, 450, 440, 430, 420, 410, 400, 390, 380],
  singlePulseVisualMs: [260, 260, 250, 250, 240, 240, 230, 230, 220],
  postSecondPulseDelayMs: [300, 300, 290, 290, 280, 280, 270, 260, 250],
  sweepWarningMs: [380, 370, 360, 350, 340, 330, 320, 310, 300],
  sweepDurationMs: [700, 690, 680, 670, 660, 650, 640, 630, 620],
  sameTargetSecondPulseBonus: [0, 0, .45, .45, .45, .45, .45, .45, .45],
  pulseMarkedSweepBonus: [0, 0, 0, 0, 0, .30, .30, .30, .30],
  sweepDefenseIgnore: [0, 0, 0, 0, 0, 0, 0, 0, .35],
};

const W = {
  damageReduction: [.12, .13, .15, .16, .17, .19, .20, .21, .24],
  guardReduction: [.55, .57, .60, .62, .64, .68, .70, .72, .78],
  guardRechargeMs: [8500, 8200, 7800, 7500, 7200, 6800, 6400, 6000, 5200],
  contactDamage: [70, 85, 100, 120, 140, 165, 195, 230, 280],
  contactCooldownMs: [1800, 1750, 1700, 1650, 1600, 1500, 1400, 1300, 1200],
  contactPadding: [8, 8, 9, 9, 10, 11, 12, 13, 14],
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

function worldToScreen(scene, x, y) {
  const camera = scene.cameras?.main;
  return {
    x: x - (camera?.worldView?.x ?? 0),
    y: y - (camera?.worldView?.y ?? 0)
  };
}

function screenToWorld(scene, point) {
  const camera = scene.cameras?.main;
  return {
    x: (camera?.worldView?.x ?? 0) + point.x,
    y: (camera?.worldView?.y ?? 0) + point.y
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getNeutronSweepPath(scene) {
  const originScreen = neutronStarScreenPosition(scene);
  const camera = scene.cameras?.main;
  const playerScreenX = scene.player && camera?.worldView
    ? scene.player.x - camera.worldView.x
    : DESIGN_WIDTH * BALANCE.camera.playerScreenAnchorX;
  const playerScreenY = scene.player && camera?.worldView
    ? scene.player.y - camera.worldView.y
    : DESIGN_HEIGHT * .52;
  const sweepTargetY = clamp(playerScreenY - 45, originScreen.y + 70, DESIGN_HEIGHT - 100);
  const startTargetScreen = { x: DESIGN_WIDTH + 24, y: sweepTargetY };
  const endTargetScreen = {
    x: clamp(playerScreenX + 120, 0, DESIGN_WIDTH + 24),
    y: sweepTargetY
  };
  const startAngle = Math.atan2(startTargetScreen.y - originScreen.y, startTargetScreen.x - originScreen.x);
  let endAngle = Math.atan2(endTargetScreen.y - originScreen.y, endTargetScreen.x - originScreen.x);
  while (endAngle < startAngle) endAngle += TWO_PI;
  while (endAngle - startAngle > Math.PI) endAngle -= TWO_PI;
  if (endAngle < startAngle) endAngle += TWO_PI;
  return {
    originScreen,
    originWorld: screenToWorld(scene, originScreen),
    startTargetScreen,
    endTargetScreen,
    startAngle,
    endAngle
  };
}

function createPulseVisual(scene, runtime, origin, target, data, time) {
  const expiresAt = time + data.singlePulseVisualMs;
  runtime.pulseFlashUntil = expiresAt;
  const outer = scene.add?.line?.(0, 0, origin.x, origin.y, target.x, target.y, 0x7dd3fc, .5);
  outer?.setOrigin?.(0, 0);
  outer?.setDepth?.(21);
  outer?.setLineWidth?.(12, 12);
  trackTransient(runtime, outer, expiresAt);
  const inner = scene.add?.line?.(0, 0, origin.x, origin.y, target.x, target.y, 0xe0f2fe, .9);
  inner?.setOrigin?.(0, 0);
  inner?.setDepth?.(22);
  inner?.setLineWidth?.(5, 5);
  trackTransient(runtime, inner, expiresAt);
  const impact = scene.add?.circle?.(target.x, target.y, 16, 0xe0f2fe, .65);
  impact?.setDepth?.(23);
  trackTransient(runtime, impact, expiresAt);
  const ring = scene.add?.circle?.(target.x, target.y, 24, 0x7dd3fc, .18);
  ring?.setDepth?.(23);
  ring?.setStrokeStyle?.(4, 0xe0f2fe, .75);
  trackTransient(runtime, ring, expiresAt);
}

function ensureNeutronRuntime(system) {
  const scene = system.scene;
  if (scene.neutronStarRuntime) return scene.neutronStarRuntime;
  const runtime = scene.neutronStarRuntime = {
    visuals: new Set(),
    transients: [],
    active: false,
    phase: 'cooldown',
    nextAt: now(scene),
    pulseHits: new Set(),
    firstTarget: null,
    sweepPlan: null,
    sweep: null,
    pulseFlashUntil: 0,
    updater: null,
    shutdown: null,
    getSkillBarState() {
      const time = now(scene);
      if (this.phase === 'cooldown') return { label: '冷却', remainingMs: Math.max(1, this.nextAt - time) };
      if (this.phase === 'ready') return { text: '脉冲就绪' };
      if (this.phase === 'pulse1' || this.phase === 'pulse2' || this.phase === 'postSecondPulse') return { text: '脉冲释放' };
      if (this.phase === 'warning' || this.phase === 'sweep') return { text: '横扫释放' };
      return null;
    }
  };
  runtime.updater = () => updateNeutronStar(system);
  system.passiveUpdaters.push(runtime.updater);
  runtime.shutdown = () => NeutronStarSkill.destroyRuntime(system);
  scene.events?.once?.('shutdown', runtime.shutdown);
  return runtime;
}

function beginNeutronRoundCooldown(runtime, data, time) {
  runtime.phase = 'cooldown';
  runtime.nextAt = time + data.roundCooldownMs;
  runtime.firstTarget = null;
  runtime.pulseHits.clear();
  runtime.sweepPlan = null;
  runtime.sweep = null;
}

function resetNeutronCycle(runtime, time, data = null) {
  runtime.firstTarget = null;
  runtime.pulseHits.clear();
  runtime.sweepPlan = null;
  runtime.sweep = null;
  runtime.pulseFlashUntil = 0;
  if (data) {
    beginNeutronRoundCooldown(runtime, data, time);
  } else {
    runtime.phase = 'cooldown';
    runtime.nextAt = time;
  }
}


function deactivateNeutronStar(runtime, time) {
  cleanupVisuals(runtime);
  runtime.body = null;
  runtime.ring = null;
  runtime.active = false;
  resetNeutronCycle(runtime, time);
}

function activateNeutronStar(runtime, time, data = null) {
  if (runtime.active) return;
  runtime.active = true;
  resetNeutronCycle(runtime, time, data);
}

function prepareSweep(scene, runtime, data, time) {
  const path = getNeutronSweepPath(scene);
  const warningStart = createScreenBeam(scene, runtime, { screen: path.originScreen }, path.startAngle, data.sweepBeamWidthPx * 2.4, data.sweepWarningAlpha);
  runtime.sweepPlan = { ...path, warningStart, preparedAt: time, startAt: time, endAt: time + data.sweepWarningMs };
}

function startSweep(scene, runtime, data, time) {
  const plan = runtime.sweepPlan || (() => {
    prepareSweep(scene, runtime, data, time);
    return runtime.sweepPlan;
  })();
  destroyTracked(runtime, plan.warningStart);
  const beam = createScreenBeam(scene, runtime, { screen: plan.originScreen }, plan.startAngle, data.sweepBeamWidthPx, .78);
  runtime.sweep = {
    startAt: time,
    endAt: time + data.sweepDurationMs,
    startAngle: plan.startAngle,
    endAngle: plan.endAngle,
    lastAngle: plan.startAngle,
    origin: plan.originWorld,
    originScreen: plan.originScreen,
    endTargetScreen: plan.endTargetScreen,
    hit: new Set(),
    beam
  };
  runtime.sweepPlan = null;
  runtime.phase = 'sweep';
  runtime.nextAt = time;
}

function beamTouchesEnemy(enemy, sweep, fromAngle, toAngle, data, scene) {
  const screen = worldToScreen(scene, enemy.x, enemy.y);
  const enemyHalfWidth = Math.max(12, (enemy.displayWidth || enemy.width || 40) * .5);
  if (screen.x < sweep.endTargetScreen.x - enemyHalfWidth || screen.x > DESIGN_WIDTH + enemyHalfWidth) return false;
  const dx = enemy.x - sweep.origin.x;
  const dy = enemy.y - sweep.origin.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
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
    if (sweep.hit.has(enemy) || !beamTouchesEnemy(enemy, sweep, fromAngle, toAngle, data, system.scene)) continue;
    const bonus = runtime.pulseHits.has(enemy) ? 1 + data.pulseMarkedSweepBonus : 1;
    if (damageWithNeutronStar(system, enemy, data.sweepDamage * bonus, { defenseIgnore: data.sweepDefenseIgnore })) {
      sweep.hit.add(enemy);
    }
  }
  sweep.lastAngle = currentAngle;
  if (time < sweep.endAt) return;
  destroyTracked(runtime, sweep.beam);
  runtime.sweep = null;
  beginNeutronRoundCooldown(runtime, data, time);
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
  const data = levelData(system, 'neutron_star', level);
  activateNeutronStar(runtime, time, data);
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
  const flashing = runtime.pulseFlashUntil && time < runtime.pulseFlashUntil;
  runtime.body?.setScale?.(flashing ? 1.25 : 1);
  runtime.body?.setAlpha?.(flashing ? 1 : .95);
  runtime.ring?.setScale?.(flashing ? 1.18 : 1);
  runtime.ring?.setAlpha?.(flashing ? .55 : .25);
  if (time < runtime.nextAt) return;
  if (runtime.phase === 'cooldown') {
    runtime.phase = visibleEnemies(scene).length ? 'pulse1' : 'ready';
    runtime.nextAt = runtime.phase === 'pulse1' ? time + data.initialPulseDelayMs : time + data.pulseTargetRetryMs;
    return;
  }
  if (runtime.phase === 'ready') {
    if (!visibleEnemies(scene).length) {
      runtime.nextAt = time + data.pulseTargetRetryMs;
      return;
    }
    runtime.phase = 'pulse1';
    runtime.nextAt = time + data.initialPulseDelayMs;
    return;
  }
  if (runtime.phase === 'pulse1' || runtime.phase === 'pulse2') {
    const secondPulse = runtime.phase === 'pulse2';
    const target = secondPulse ? pickPulseTarget(scene, runtime.firstTarget) : pickPulseTarget(scene, null);
    if (!target) {
      if (!secondPulse) runtime.phase = 'ready';
      runtime.nextAt = time + data.pulseTargetRetryMs;
      return;
    }
    const sameTarget = secondPulse && target === runtime.firstTarget;
    const multiplier = sameTarget ? 1 + data.sameTargetSecondPulseBonus : 1;
    const origin = neutronStarWorldOrigin(scene);
    if (!damageWithNeutronStar(system, target, data.singlePulseDamage * multiplier, { defenseIgnore: 0 })) {
      runtime.nextAt = time + data.pulseTargetRetryMs;
      return;
    }
    runtime.pulseHits.add(target);
    if (!secondPulse) runtime.firstTarget = target;
    runtime.lastAttackOrigin = origin;
    createPulseVisual(scene, runtime, origin, target, data, time);
    if (secondPulse) {
      runtime.phase = 'postSecondPulse';
      runtime.nextAt = time + data.singlePulseVisualMs + data.postSecondPulseDelayMs;
    } else {
      runtime.phase = 'pulse2';
      runtime.nextAt = time + data.pulseGapMs;
    }
    return;
  }
  if (runtime.phase === 'postSecondPulse') {
    prepareSweep(scene, runtime, data, time);
    runtime.phase = 'warning';
    runtime.nextAt = time + data.sweepWarningMs;
    return;
  }
  if (runtime.phase === 'warning') {
    startSweep(scene, runtime, data, time);
    return;
  }
  if (runtime.phase === 'sweep') updateSweep(system, runtime, data, time);
}

export const NeutronStarSkill = {
  bind(system) {
    const level = system.getLevel?.('neutron_star') || 0;
    if (level) {
      activateNeutronStar(ensureNeutronRuntime(system), now(system.scene), levelData(system, 'neutron_star', level));
    }
    return () => NeutronStarSkill.destroyRuntime(system);
  },
  onAcquire(system) {
    const level = system.getLevel?.('neutron_star') || 0;
    if (level) activateNeutronStar(ensureNeutronRuntime(system), now(system.scene), levelData(system, 'neutron_star', level));
  },
  shiftTimers(system, pausedDuration, pausedAt = 0) {
    const runtime = system.scene.neutronStarRuntime;
    if (!runtime) return;
    const shift = value => (value > pausedAt ? value + pausedDuration : value);
    runtime.nextAt = shift(runtime.nextAt || 0);
    runtime.pulseFlashUntil = shift(runtime.pulseFlashUntil || 0);
    runtime.transients?.forEach(entry => { entry.expiresAt = shift(entry.expiresAt || 0); });
    if (runtime.sweepPlan) {
      runtime.sweepPlan.startAt = shift(runtime.sweepPlan.startAt || 0);
      runtime.sweepPlan.endAt = shift(runtime.sweepPlan.endAt || 0);
      runtime.sweepPlan.preparedAt = shift(runtime.sweepPlan.preparedAt || 0);
    }
    if (runtime.sweep) {
      runtime.sweep.startAt = shift(runtime.sweep.startAt || 0);
      runtime.sweep.endAt = shift(runtime.sweep.endAt || 0);
    }
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
    contactReadyAtByEnemy: new Map(),
    crushStates: new Map(),
    lastContactCleanupAt: 0,
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
      const cooling = this.charges.filter(charge => charge.readyAt > time);
      const nextRemaining = cooling.length ? Math.min(...cooling.map(charge => charge.readyAt - time)) : 0;
      return { text: ready === total ? `护体 ${ready}/${total}` : `护体 ${ready}/${total} · ${Math.ceil(nextRemaining / 1000)}s` };
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
  while (runtime.charges.length < data.guardCharges) {
    runtime.charges.push({ readyAt: time, wasReady: true, flashUntil: 0, flashType: null });
  }
  runtime.charges.length = data.guardCharges;
}

function destroyWhiteDwarfVisual(visual) {
  destroy(visual?.core);
  destroy(visual?.glow);
}

function syncWhiteDwarfVisualCount(scene, runtime, data) {
  while (runtime.visuals.length > data.guardCharges) destroyWhiteDwarfVisual(runtime.visuals.pop());
  while (runtime.visuals.length < data.guardCharges) {
    const glow = scene.add?.circle?.(scene.player.x, scene.player.y, data.whiteDwarfGlowRadius, 0x7dd3fc, .22);
    glow?.setDepth?.(11);
    const core = scene.add?.circle?.(scene.player.x, scene.player.y, data.whiteDwarfVisualRadius, 0xe0f2fe, .95);
    core?.setDepth?.(12);
    runtime.visuals.push({ core, glow });
  }
}

function setVisualScale(object, value) { object?.setScale?.(value); object && (object.scale = value); }

function positionWhiteDwarfs(system, data, runtime, time) {
  const scene = system.scene;
  runtime.visuals.forEach((visual, index) => {
    const angle = runtime.angle + index * TWO_PI / Math.max(1, runtime.visuals.length);
    const x = scene.player.x + Math.cos(angle) * data.orbitRadius;
    const y = scene.player.y + Math.sin(angle) * data.orbitRadius;
    const charge = runtime.charges[index] || {};
    const ready = charge.readyAt <= time;
    const flashing = time < Math.max(charge.flashUntil || 0, visual.crushFlashUntil || 0);
    const readyPulse = 1 + Math.sin(time / 260 + index) * .045;
    const crushFlashing = time < (visual.crushFlashUntil || 0);
    const coreScale = flashing ? (crushFlashing ? 1.42 : (charge.flashType === 'consume' ? 1.35 : 1.22)) : (ready ? readyPulse : .86);
    const glowScale = flashing ? (crushFlashing ? 1.62 : (charge.flashType === 'consume' ? 1.45 : 1.32)) : (ready ? readyPulse : .8);
    const coreAlpha = flashing ? 1 : (ready ? .95 : .36);
    const glowAlpha = flashing ? (crushFlashing ? .62 : .42) : (ready ? .24 + Math.sin(time / 260 + index) * .05 : .06);
    visual.x = x; visual.y = y;
    visual.core?.setPosition?.(x, y);
    visual.glow?.setPosition?.(x, y);
    visual.core?.setAlpha?.(coreAlpha);
    visual.glow?.setAlpha?.(glowAlpha);
    setVisualScale(visual.core, coreScale);
    setVisualScale(visual.glow, glowScale);
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
  runtime.visuals.forEach(destroyWhiteDwarfVisual);
  runtime.visuals = [];
  runtime.transients.forEach(entry => destroy(entry.object));
  runtime.transients = [];
  cleanupWhiteDwarfCrush(system, runtime);
  runtime.charges = [];
  runtime.active = false;
  runtime.guardUntil = 0;
  runtime.contactReadyAtByEnemy?.clear?.();
  syncWhiteDwarfReduction(system);
}

function updateWhiteDwarfTransientVisuals(runtime, time) {
  runtime.transients = runtime.transients.filter(entry => {
    if (entry.type === 'crushLine') {
      const enemy = entry.enemy;
      if (!enemy || enemy.scene === null || enemy.active === false || enemy.destroyed) {
        destroy(entry.object);
        return false;
      }
      const startedAt = entry.startedAt ?? time;
      const duration = Math.max(1, (entry.expiresAt ?? time) - startedAt);
      const progress = Math.max(0, Math.min(1, (time - startedAt) / duration));
      const x = enemy.x + (entry.startOffsetX + (entry.endOffsetX - entry.startOffsetX) * progress);
      const y = enemy.y + (entry.startOffsetY + (entry.endOffsetY - entry.startOffsetY) * progress);
      entry.object?.setPosition?.(x, y);
      entry.object?.setAlpha?.(1 - progress);
      entry.object?.setScale?.(1, Math.max(.35, 1 - progress * .45));
    }
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

function cleanupWhiteDwarfContactMap(scene, runtime, time) {
  if (time - (runtime.lastContactCleanupAt || 0) < 1000) return;
  runtime.lastContactCleanupAt = time;
  for (const enemy of runtime.contactReadyAtByEnemy.keys()) {
    if (!isAlive(enemy) || enemy.scene === null || enemy.active === false) runtime.contactReadyAtByEnemy.delete(enemy);
  }
  for (const [enemy, state] of runtime.crushStates || []) {
    if (!enemy || enemy.scene === null || enemy.active === false || enemy.destroyed) {
      runtime.crushStates.delete(enemy);
      continue;
    }
    if (!state.lethal && !isAlive(enemy)) state.lethal = true;
  }
}

const WHITE_DWARF_CRUSH_SOURCE = 'white_dwarf_gravity_crush';

function enemyCrushProfile(enemy) {
  if (enemy?.isBoss) return { scaleXMultiplier: 1.05, scaleYMultiplier: .82, crushVisualMs: 120 };
  if (enemy?.isElite) return { scaleXMultiplier: 1.18, scaleYMultiplier: .55, crushVisualMs: 220, moveSlow: .50, attackSlow: .30, durationMs: 350 };
  return { scaleXMultiplier: 1.35, scaleYMultiplier: .25, crushVisualMs: 280, moveSlow: .80, attackSlow: .50, durationMs: 500 };
}

function setEnemyScale(enemy, scaleX, scaleY) {
  if (!enemy || enemy.destroyed) return;
  if (typeof enemy.setScale === 'function') enemy.setScale(scaleX, scaleY);
  else {
    enemy.scaleX = scaleX;
    enemy.scaleY = scaleY;
  }
}

function updateWhiteDwarfCrushStates(runtime, time) {
  for (const [enemy, state] of runtime.crushStates || []) {
    if (!enemy || enemy.scene === null || enemy.active === false || enemy.destroyed) {
      runtime.crushStates.delete(enemy);
      continue;
    }
    if (state.lethal || !isAlive(enemy)) {
      setEnemyScale(enemy, state.targetScaleX, state.targetScaleY);
      state.lethal = true;
      continue;
    }
    if (time >= state.recoverEndsAt) {
      if (!state.scaleRestored) {
        setEnemyScale(enemy, state.baseScaleX, state.baseScaleY);
        state.scaleRestored = true;
      }
      if (time < (state.gravityExpiresAt || state.recoverEndsAt)) continue;
      setEnemyScale(enemy, state.baseScaleX, state.baseScaleY);
      removeEnemyGravitySource(enemy, WHITE_DWARF_CRUSH_SOURCE);
      runtime.crushStates.delete(enemy);
      continue;
    }
    if (time <= state.compressEndsAt) {
      const t = Math.max(0, Math.min(1, (time - state.startedAt) / Math.max(1, state.compressEndsAt - state.startedAt)));
      setEnemyScale(enemy, state.startScaleX + (state.targetScaleX - state.startScaleX) * t, state.startScaleY + (state.targetScaleY - state.startScaleY) * t);
    } else if (time <= state.holdEndsAt) {
      setEnemyScale(enemy, state.targetScaleX, state.targetScaleY);
    } else {
      const t = Math.max(0, Math.min(1, (time - state.holdEndsAt) / Math.max(1, state.recoverEndsAt - state.holdEndsAt)));
      setEnemyScale(enemy, state.targetScaleX + (state.baseScaleX - state.targetScaleX) * t, state.targetScaleY + (state.baseScaleY - state.targetScaleY) * t);
    }
  }
}

function cleanupWhiteDwarfCrush(system, runtime) {
  for (const [enemy, state] of runtime.crushStates || []) {
    if (enemy && enemy.scene !== null && enemy.active !== false && !enemy.destroyed) {
      removeEnemyGravitySource(enemy, WHITE_DWARF_CRUSH_SOURCE);
      if (!state.lethal && isAlive(enemy)) setEnemyScale(enemy, state.baseScaleX, state.baseScaleY);
    }
  }
  runtime.crushStates?.clear?.();
}

function showWhiteDwarfCrushVisuals(system, runtime, enemy, time) {
  const scene = system.scene;
  const ring = scene.add?.ellipse?.(enemy.x, enemy.y, 76, 20, 0x7dd3fc, .16) || scene.add?.circle?.(enemy.x, enemy.y, 34, 0x7dd3fc, .12);
  ring?.setStrokeStyle?.(3, 0xe0f2fe, .9);
  ring?.setDepth?.(14);
  if (ring) runtime.transients.push({ object: ring, expiresAt: time + 240 });
  const lineCount = 3;
  for (let i = 0; i < lineCount; i++) {
    const dx = (i - 1) * 18;
    for (const profile of [{ startOffsetY: -42, endOffsetY: -6 }, { startOffsetY: 42, endOffsetY: 6 }]) {
      const line = scene.add?.rectangle?.(enemy.x + dx, enemy.y + profile.startOffsetY, 3, 24, 0xe0f2fe, .72);
      line?.setDepth?.(15);
      if (line) runtime.transients.push({
        object: line,
        type: 'crushLine',
        enemy,
        startedAt: time,
        expiresAt: time + 220,
        startOffsetX: dx,
        startOffsetY: profile.startOffsetY,
        endOffsetX: dx,
        endOffsetY: profile.endOffsetY
      });
    }
  }
  scene.floatText?.(enemy.x, enemy.y - 30, '重力碾压', 0xe0f2fe);
}

function applyWhiteDwarfCrush(system, runtime, visual, enemy, time) {
  const profile = enemyCrushProfile(enemy);
  const existing = runtime.crushStates.get(enemy);
  const baseScaleX = existing?.baseScaleX ?? enemy.scaleX ?? enemy.scale ?? 1;
  const baseScaleY = existing?.baseScaleY ?? enemy.scaleY ?? enemy.scale ?? 1;
  const startScaleX = Number.isFinite(enemy.scaleX) ? enemy.scaleX : baseScaleX;
  const startScaleY = Number.isFinite(enemy.scaleY) ? enemy.scaleY : baseScaleY;
  const compressMs = Math.min(80, Math.round(profile.crushVisualMs * .36));
  const holdMs = Math.min(80, Math.max(0, Math.round(profile.crushVisualMs * .36)));
  const lethal = !isAlive(enemy);
  const state = {
    enemy,
    baseScaleX,
    baseScaleY,
    startScaleX,
    startScaleY,
    startedAt: time,
    compressEndsAt: time + compressMs,
    holdEndsAt: time + compressMs + holdMs,
    recoverEndsAt: time + profile.crushVisualMs,
    gravityExpiresAt: time + (profile.durationMs || profile.crushVisualMs),
    targetScaleX: baseScaleX * profile.scaleXMultiplier,
    targetScaleY: baseScaleY * profile.scaleYMultiplier,
    lethal
  };
  runtime.crushStates.set(enemy, state);
  setEnemyScale(enemy, lethal ? state.targetScaleX : state.startScaleX, lethal ? state.targetScaleY : state.startScaleY);
  if (!enemy.isBoss) applyEnemyGravity(enemy, { sourceId: WHITE_DWARF_CRUSH_SOURCE, moveSlow: profile.moveSlow, attackSlow: profile.attackSlow, expiresAt: time + profile.durationMs, external: true });
  visual.crushFlashUntil = time + 180;
  showWhiteDwarfCrushVisuals(system, runtime, enemy, time);
}

function whiteDwarfContactEnemy(system, data, runtime, time) {
  const scene = system.scene;
  cleanupWhiteDwarfContactMap(scene, runtime, time);
  const hitThisFrame = new Set();
  for (const visual of runtime.visuals) {
    const sx = visual.x ?? visual.core?.x;
    const sy = visual.y ?? visual.core?.y;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
    for (const enemy of visibleEnemies(scene)) {
      if (hitThisFrame.has(enemy)) continue;
      if ((runtime.contactReadyAtByEnemy.get(enemy) || 0) > time) continue;
      const enemyWidth = enemy.displayWidth ?? enemy.width ?? enemy.body?.width ?? 0;
      const contactDistance = data.whiteDwarfVisualRadius + enemyWidth / 2 + data.contactPadding;
      if (Math.hypot(enemy.x - sx, enemy.y - sy) > contactDistance) continue;
      const damaged = scene.combatSystem?.damageEnemy?.(enemy, data.contactDamage, {
        source: 'skill',
        skillId: 'white_dwarf',
        damageKind: 'gravityCrush',
        tags: [TAGS.MAGIC, TAGS.CELESTIAL, TAGS.BUILD_CELESTIAL],
        allowLifeSteal: false,
        canTriggerArtifacts: false,
        noKnockback: true
      });
      if (damaged === false) continue;
      runtime.contactReadyAtByEnemy.set(enemy, time + data.contactCooldownMs);
      hitThisFrame.add(enemy);
      applyWhiteDwarfCrush(system, runtime, visual, enemy, time);
    }
  }
}

function burstFromWhiteDwarf(system, data, runtime, time) {
  const scene = system.scene;
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
  updateWhiteDwarfTransientVisuals(runtime, time);
  updateWhiteDwarfCrushStates(runtime, time);
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
  runtime.charges.forEach(charge => {
    const ready = charge.readyAt <= time;
    if (ready && charge.wasReady === false) {
      charge.flashUntil = time + 180;
      charge.flashType = 'ready';
    }
    charge.wasReady = ready;
  });
  const elapsed = Math.max(0, time - runtime.last);
  runtime.last = time;
  runtime.angle += elapsed / Math.max(1, data.orbitPeriodMs) * TWO_PI;
  positionWhiteDwarfs(system, data, runtime, time);
  whiteDwarfContactEnemy(system, data, runtime, time);
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
  shiftTimers(system, pausedDuration, pausedAt) {
    const runtime = system.scene.whiteDwarfRuntime;
    if (!runtime || !pausedDuration) return;
    runtime.charges?.forEach?.(charge => {
      if (charge.readyAt > pausedAt) charge.readyAt += pausedDuration;
      if (charge.flashUntil > pausedAt) charge.flashUntil += pausedDuration;
    });
    if (runtime.guardUntil > pausedAt) runtime.guardUntil += pausedDuration;
    runtime.contactReadyAtByEnemy?.forEach?.((readyAt, enemy) => {
      if (readyAt > pausedAt) runtime.contactReadyAtByEnemy.set(enemy, readyAt + pausedDuration);
    });
    runtime.transients?.forEach?.(entry => {
      if (Number.isFinite(entry.startedAt)) entry.startedAt += pausedDuration;
      if (entry.expiresAt > pausedAt) entry.expiresAt += pausedDuration;
    });
    runtime.crushStates?.forEach?.(state => {
      for (const key of ['startedAt', 'compressEndsAt', 'holdEndsAt', 'recoverEndsAt', 'gravityExpiresAt']) {
        if (Number.isFinite(state[key])) state[key] += pausedDuration;
      }
      if (state.enemy?.gravitySources?.get?.(WHITE_DWARF_CRUSH_SOURCE)) {
        const source = state.enemy.gravitySources.get(WHITE_DWARF_CRUSH_SOURCE);
        source.expiresAt += pausedDuration;
      }
    });
    runtime.visuals?.forEach?.(visual => {
      if (visual.crushFlashUntil > pausedAt) visual.crushFlashUntil += pausedDuration;
    });
    if (runtime.active === true && Number.isFinite(runtime.last)) runtime.last += pausedDuration;
    if (runtime.lastContactCleanupAt > 0) runtime.lastContactCleanupAt += pausedDuration;
  },
  destroyRuntime(system) {
    const scene = system.scene;
    const runtime = scene.whiteDwarfRuntime;
    if (runtime) {
      runtime.visuals.forEach(destroyWhiteDwarfVisual);
      runtime.transients.forEach(entry => destroy(entry.object));
      cleanupWhiteDwarfCrush(system, runtime);
      runtime.contactReadyAtByEnemy?.clear?.();
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
    let emergency = false;
    if (data.emergencyProjectedHpRatio && projectedRatio <= data.emergencyProjectedHpRatio) {
      reduction = data.emergencyGuardReduction;
      emergency = true;
      scene.floatText?.(scene.player.x, scene.player.y - 40, data.emergencyFloatText, 0xe0f2fe);
    }
    runtime.charges[chargeIndex].readyAt = time + data.guardRechargeMs;
    runtime.charges[chargeIndex].wasReady = false;
    runtime.charges[chargeIndex].flashUntil = time + 220;
    runtime.charges[chargeIndex].flashType = 'consume';
    const hpDamage = Math.max(0, Math.round(payload.hpDamage * (1 - reduction)));
    const blockedDamage = Math.max(0, payload.hpDamage - hpDamage);
    if (data.postGuardDamageReduction) {
      scene.playerData.damageReductionBonuses ??= {};
      scene.playerData.damageReductionBonuses.white_dwarf_guard = data.postGuardDamageReduction;
      runtime.guardUntil = Math.max(runtime.guardUntil, time + data.postGuardDurationMs);
    }
    showGuardBurst(system, data, runtime, time);
    if (data.burstDamage) burstFromWhiteDwarf(system, data, runtime, time);
    positionWhiteDwarfs(system, data, runtime, time);
    scene.floatText?.(scene.player.x, scene.player.y - 28, `${data.guardFloatText} -${blockedDamage}`, 0xe0f2fe);
    return { hpDamage, blockedDamage, emergency };
  }
};

export function configureCelestialFlowSkills() {
  const neutronLevels = Array.from({ length: 9 }, (_, index) => ({
    singlePulseCount: 2,
    sweepWarningAlpha: .20,
    sweepBeamWidthPx: 18,
    sweepHitLimitPerEnemy: 1,
    maxSinglePulseTargets: 2,
    ...Object.fromEntries(Object.keys(N).map(key => [key, N[key][index]])),
    desc: `单体脉冲${N.singlePulseDamage[index]}，单体脉冲次数2，横扫${N.sweepDamage[index]}，每轮冷却${(N.roundCooldownMs[index] / 1000).toFixed(1)}秒；冷却结束后自动释放一轮脉冲，无目标时保持就绪。Lv3同目标第二发加成，Lv6标记横扫增伤，Lv9横扫无视防御。`,
    milestoneText: index === 2 ? '脉冲聚焦' : index === 5 ? '脉冲共振' : index === 8 ? '全域星脉' : undefined
  }));
  const whiteDwarfLevels = Array.from({ length: 9 }, (_, index) => ({
    whiteDwarfVisualRadius: 22,
    whiteDwarfGlowRadius: 34,
    guardBurstVisualMs: 260,
    guardFloatText: '简并护体',
    emergencyFloatText: '临界稳定',
    ...Object.fromEntries(Object.keys(W).map(key => [key, W[key][index]])),
    desc: `常驻伤害减免${Math.round(W.damageReduction[index] * 100)}%，护体减伤${Math.round(W.guardReduction[index] * 100)}%，护体恢复时间${(W.guardRechargeMs[index] / 1000).toFixed(1)}秒，护体次数${W.guardCharges[index]}；重力碾压伤害${W.contactDamage[index]}，同一敌人碾压冷却${(W.contactCooldownMs[index] / 1000).toFixed(2)}秒；普通敌人移动减速80%、攻击减速50%，精英敌人减弱效果，Boss仅承受伤害和轻微压缩视觉。`,
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
    description: '中子星永久悬浮于战场上方，每次冷却结束后自动释放一轮脉冲：连续进行两次单体脉冲，再从战场最右侧向角色前方释放一次横扫脉冲。',
    milestones: {
      3: '脉冲聚焦：两次单体脉冲命中同一目标时，第二次脉冲伤害提高45%。',
      6: '脉冲共振：横扫脉冲对本轮已被单体脉冲命中的敌人额外造成30%伤害。',
      9: '全域星脉：横扫覆盖当前可视的前方战场，并无视35%防御。'
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
    description: '白矮星永久围绕玩家旋转，提供常驻减伤和护体；触碰敌人时以强重力造成高额魔法伤害，并将敌人瞬间压扁。',
    milestones: {
      3: '简并星壳：护体触发后，短时间内获得额外伤害减免。',
      6: '质量反冲：护体触发时，对玩家周围敌人造成范围魔法伤害并推离普通敌人。',
      9: '双星稳定：生成第二颗白矮星，获得两次独立护体；致命重击将触发临界稳定。'
    },
    levels: whiteDwarfLevels
  };
}
