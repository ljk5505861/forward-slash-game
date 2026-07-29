import { TAGS } from '../../config/tags.js';
import { getWeapon } from '../../config/weapons.js';

const MISSILE_TAGS = ['physical', 'area', TAGS.PROJECTILE, TAGS.MECH, TAGS.BUILD_MECH];
const valid = (scene, enemy) => !!enemy && enemy.active !== false && !enemy.isDefeated && (enemy.hp ?? 1) > 0 && scene.targeting?.valid?.(enemy) !== false && scene.targeting?.isEnemyFullyInsideViewport?.(enemy) !== false;
const enemies = scene => (scene.targeting?.all?.() || scene.enemies || []).filter(enemy => valid(scene, enemy));
const distance = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
const destroy = object => object?.destroy?.();

export function selectDenseEnemyCluster(scene, { excludeCenter = null, minCenterDistance = 0 } = {}) {
  const pool = enemies(scene).filter(enemy => !excludeCenter || distance(enemy, excludeCenter) >= minCenterDistance);
  const player = scene.player || { x: 0, y: 0 };
  return pool.map(enemy => ({
    x: enemy.x,
    y: enemy.y,
    count: enemies(scene).filter(other => distance(other, enemy) <= 150).length,
    playerDistance: distance(enemy, player)
  })).sort((a, b) => b.count - a.count || a.playerDistance - b.playerDistance || a.x - b.x)[0] || null;
}

function stateOf(system) {
  return system.passiveState.mechRuntime || createMechRuntime(system);
}

function makeVisual(scene, kind, x, y, radius = 10) {
  if (!scene.add) return null;
  if (kind === 'missile') return scene.add.rectangle?.(x, y, 25, 8, 0xdcefff, 1)?.setStrokeStyle?.(2, 0x4aa8ff, 1)?.setDepth?.(150) || null;
  return scene.add.circle?.(x, y, radius, 0x8edcff, 0.85)?.setStrokeStyle?.(2, 0xffffff, 0.9)?.setDepth?.(150) || null;
}

function ring(state, x, y, radius, color = 0x75caff) {
  const scene = state.system.scene;
  const visual = scene.add?.circle?.(x, y, radius, color, 0.14)?.setStrokeStyle?.(4, 0xe8f8ff, 0.9)?.setDepth?.(145);
  if (!visual) return;
  state.visuals.add(visual);
  const tween = scene.tweens?.add?.({ targets: visual, alpha: 0, scale: 1.15, duration: 220, onComplete: () => { state.visuals.delete(visual); destroy(visual); } });
  if (tween) state.tweens.add(tween);
}

function damageMissile(system, task, enemy) {
  const raw = task.damage;
  system.scene.combatSystem?.damageEnemy?.(enemy, system.damageValue?.(raw, task.ctx) ?? raw, {
    source: 'skill', skillId: 'shoulder_missile', damageKind: task.mini ? 'shoulderMiniMissile' : 'shoulderMissile',
    tags: MISSILE_TAGS, level: task.level, professionApplied: true,
    professionMultiplier: task.ctx?.professionMultiplier || 1,
    baseAmountBeforeProfession: system.baseDamageValue?.(raw, task.ctx) ?? raw,
    canCrit: true, allowLifeSteal: true, noKnockback: true,
    fromMechFreeVolley: !!task.free
  });
}

function miniTargets(scene, center, count) {
  const pool = enemies(scene).filter(enemy => distance(enemy, center) <= 320)
    .sort((a, b) => distance(a, center) - distance(b, center) || a.x - b.x);
  if (!pool.length) return [];
  return Array.from({ length: count }, (_, index) => pool[index % pool.length]);
}

function explodeMissile(state, task) {
  const { system } = state;
  ring(state, task.x, task.y, task.radius, task.mini ? 0x8bdcff : 0xffa34d);
  enemies(system.scene).filter(enemy => distance(enemy, task) <= task.radius).forEach(enemy => damageMissile(system, task, enemy));
  if (!task.mini && task.miniCount > 0) {
    miniTargets(system.scene, task, task.miniCount).forEach((target, index) => {
      const dueAt = (system.scene.getGameplayTime?.() ?? 0) + 100 + index * 100;
      addProjectile(state, { kind: 'mini', mini: true, target, x: task.x, y: task.y, endX: target.x, endY: target.y, dueAt,
        startAt: dueAt - 100, radius: task.miniRadius, damage: task.damage * task.miniRatio, ctx: task.ctx, level: task.level, free: task.free });
    });
  }
}

function addProjectile(state, task) {
  task.visual = makeVisual(state.system.scene, task.mini ? 'energy' : 'missile', task.x, task.y, task.mini ? 6 : 10);
  state.visuals.add(task.visual);
  state.tasks.push(task);
}

function updateTask(state, task, now) {
  const duration = Math.max(1, task.dueAt - task.startAt);
  const progress = Math.max(0, Math.min(1, (now - task.startAt) / duration));
  task.visual?.setPosition?.(task.x + (task.endX - task.x) * progress, task.y + (task.endY - task.y) * progress);
  if (now < task.dueAt) return false;
  state.visuals.delete(task.visual); destroy(task.visual);
  if (task.kind === 'energy') hitEnergyCannon(state, task);
  else explodeMissile(state, task);
  return true;
}

export function launchShoulderVolley(system, data, level, ctx = {}, { free = false } = {}) {
  const first = selectDenseEnemyCluster(system.scene);
  if (!first) return { failed: true };
  const state = stateOf(system);
  const centers = [{ center: first, scale: 1 }];
  if ((data.missileCount || 1) > 1) {
    const second = selectDenseEnemyCluster(system.scene, { excludeCenter: first, minCenterDistance: 180 });
    centers.push({ center: second || first, scale: second ? 1 : (data.sameClusterSecondMultiplier || 0.6) });
  }
  const now = system.scene.getGameplayTime?.() ?? 0;
  centers.forEach(({ center, scale }, index) => {
    const start = { x: (system.scene.player?.x || 0) + (index ? -22 : 22), y: (system.scene.player?.y || 0) - 78 };
    const duration = Math.max(180, Math.min(750, distance(start, center) / 520 * 1000));
    addProjectile(state, { kind: 'main', x: start.x, y: start.y, endX: center.x, endY: center.y, startAt: now + index * 90,
      dueAt: now + index * 90 + duration, radius: data.radius, damage: data.damage * scale, ctx, level, free,
      miniCount: data.miniCount || 0, miniRatio: data.miniDamageRatio || 0, miniRadius: data.miniRadius || 55 });
  });
  return { launched: centers.length, free };
}

function fallbackEnergyBase(system) {
  const scene = system.scene;
  return scene.combatSystem?.calcNonCritAttackBaseDamage?.(getWeapon(scene.playerData.weaponId), scene.professionSystem?.currentAttackProfile?.() || null, false) || scene.playerData.attack || 1;
}

function energyTarget(system, preferred, excluded = new Set()) {
  const scene = system.scene;
  if (valid(scene, preferred) && !excluded.has(preferred)) return preferred;
  const player = scene.player || { x: 0, y: 0 };
  return enemies(scene).filter(enemy => enemy.x >= player.x && enemy.x - player.x <= 760 && !excluded.has(enemy))
    .sort((a, b) => distance(a, player) - distance(b, player) || a.x - b.x)[0] || null;
}

export function launchEnergyCannon(system, { target = null, baseDamage = null, delayMs = 0, excluded = new Set() } = {}) {
  const data = system.getData('overload_core');
  const chosen = energyTarget(system, target, excluded);
  if (!data || !chosen) return false;
  const state = stateOf(system), scene = system.scene, now = scene.getGameplayTime?.() ?? 0;
  const start = { x: (scene.player?.x || 0) + 20, y: (scene.player?.y || 0) - 66 };
  const end = { x: chosen.x, y: chosen.y };
  const dueAt = now + delayMs + Math.max(120, Math.min(600, distance(start, end) / 650 * 1000));
  addProjectile(state, { kind: 'energy', x: start.x, y: start.y, endX: end.x, endY: end.y, target: chosen,
    startAt: now + delayMs, dueAt, radius: data.energyCannonRadius,
    damage: Math.max(1, Math.round((baseDamage ?? fallbackEnergyBase(system)) * data.energyCannonDamageRatio)), level: system.getLevel('overload_core') });
  return true;
}

function hitEnergyCannon(state, task) {
  const { system } = state, scene = system.scene;
  let target = energyTarget(system, task.target);
  const center = target ? { x: target.x, y: target.y } : { x: task.endX, y: task.endY };
  if (!target) target = enemies(scene).sort((a, b) => distance(a, center) - distance(b, center))[0] || null;
  if (!target || distance(target, center) > task.radius) return;
  ring(state, target.x, target.y, task.radius);
  const profileMultiplier = scene.professionSystem?.getDamageMultiplier?.({ type: 'normalAttack' }) || 1;
  const hit = new Set();
  enemies(scene).filter(enemy => distance(enemy, target) <= task.radius).forEach(enemy => {
    if (hit.has(enemy)) return; hit.add(enemy);
    scene.combatSystem?.damageEnemy?.(enemy, Math.round(task.damage * profileMultiplier), {
      source: 'skill', skillId: 'overload_core', damageKind: 'overloadEnergyCannon', tags: MISSILE_TAGS,
      critResolved: true, crit: false, canCrit: false, allowLifeSteal: false, canTriggerArtifacts: false,
      professionApplied: true, professionMultiplier: profileMultiplier, baseAmountBeforeProfession: task.damage, noKnockback: true
    });
  });
}

export function createMechRuntime(system) {
  const old = system.passiveState.mechRuntime;
  if (old) return old;
  const state = { system, tasks: [], visuals: new Set(), tweens: new Set(), updater: null };
  state.updater = () => {
    const scene = system.scene;
    if ((scene.playerData?.hp || 0) <= 0) {
      state.tasks.forEach(task => destroy(task.visual)); state.tasks.length = 0;
      state.tweens.forEach(tween => { tween?.stop?.(); tween?.remove?.(); }); state.tweens.clear();
      state.visuals.forEach(destroy); state.visuals.clear();
      return;
    }
    if (scene.isGameplayPaused?.()) return;
    const now = scene.getGameplayTime?.() ?? 0;
    state.tasks = state.tasks.filter(task => !updateTask(state, task, now));
  };
  system.passiveUpdaters.push(state.updater);
  system.passiveState.mechRuntime = state;
  return state;
}

export function clearMechTasks(system, skillId = null) {
  const state = system.passiveState.mechRuntime;
  if (!state) return;
  const matches = task => !skillId || (skillId === 'shoulder_missile' ? task.kind !== 'energy' : task.kind === 'energy');
  state.tasks.filter(matches).forEach(task => { state.visuals.delete(task.visual); destroy(task.visual); });
  state.tasks = state.tasks.filter(task => !matches(task));
  if (!skillId) {
    state.tweens.forEach(tween => { tween?.stop?.(); tween?.remove?.(); });
    state.visuals.forEach(destroy); state.visuals.clear(); state.tweens.clear();
    system.passiveUpdaters = system.passiveUpdaters.filter(fn => fn !== state.updater);
    delete system.passiveState.mechRuntime;
  }
}

export function shiftMechTimers(system, duration, pausedAt) {
  const state = system.passiveState.mechRuntime;
  state?.tasks.forEach(task => { if (task.startAt >= pausedAt) task.startAt += duration; if (task.dueAt > pausedAt) task.dueAt += duration; });
}

export const MechRuntimeSkill = {
  bind(system) { createMechRuntime(system); return () => clearMechTasks(system); },
  shiftTimers: shiftMechTimers
};
