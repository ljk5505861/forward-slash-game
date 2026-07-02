const PhaserRef = globalThis.Phaser || { Math: { Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) } } };

import { TAGS } from '../../config/tags.js';
import { SKILLS } from '../../config/skills.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import {
  applyEnemyCold,
  clearAllEnemyCold,
  clearEnemyCold,
  getEnemyColdState,
  isEnemyFrozen,
  markEnemyColdShattered,
  shiftEnemyColdTimers
} from '../../systems/EnemyColdControl.js';

const nowOf = scene => scene.getGameplayTime?.() ?? 0;
const validEnemy = (scene, enemy) => !!enemy && scene.targeting?.valid?.(enemy) !== false && !enemy.isDefeated && (enemy.hp ?? 1) > 0;
const distance = (a, b) => PhaserRef.Math.Distance.Between(a.x, a.y, b.x, b.y);
const eyePoint = scene => ({ x: (scene.player?.x ?? 0) + 12, y: (scene.player?.y ?? 0) - 72 });
const mouthPoint = scene => ({ x: (scene.player?.x ?? 0) + 30, y: (scene.player?.y ?? 0) - 52 });
const cleanupVisual = visual => { try { visual?.destroy?.(); } catch {} };

const SUPER_SPEED_LEVELS = [
  [0.06, 0.04, 0, 0], [0.08, 0.05, 0, 0], [0.10, 0.07, 0.05, 2000],
  [0.12, 0.08, 0.05, 2000], [0.14, 0.10, 0.05, 2000], [0.16, 0.12, 0.08, 3000],
  [0.17, 0.14, 0.08, 3000], [0.19, 0.16, 0.08, 3000], [0.20, 0.18, 0.10, 3000]
].map(([moveSpeedBonus, attackSpeedBonus, highSpeedAttackSpeedBonus, graceMs], index) => ({
  moveSpeedBonus,
  attackSpeedBonus,
  highSpeedAttackSpeedBonus,
  graceMs,
  chargeMs: index >= 2 ? 1000 : 0,
  weaponWaitCutRatio: index >= 5 ? 0.5 : 0,
  killExtendMs: index >= 8 ? 500 : 0,
  maxKillExtendMs: index >= 8 ? 2000 : 0,
  desc: `移动速度 +${Math.round(moveSpeedBonus * 100)}%，常驻攻击速度 +${Math.round(attackSpeedBonus * 100)}%${index >= 2 ? `；连续实际前进1秒进入高速状态，停止后保留${graceMs / 1000}秒并额外提供${Math.round(highSpeedAttackSpeedBonus * 100)}%攻击速度` : ''}${index >= 5 ? '；每次高速状态停止后下一次玩家本体真实武器攻击剩余等待缩短50%（仅一次）' : ''}${index >= 8 ? '；保留阶段击杀延长0.5秒，单次高速状态最多延长2秒' : ''}。`
}));

const LASER_LEVELS = [18, 20, 22, 24, 26, 22, 24, 26, 28].map((damage, index) => ({
  damage,
  cooldownMs: Math.max(4200, 5000 - index * 80),
  durationMs: index >= 8 ? 1800 : 1200,
  intervalMs: 200,
  overloadIntervalMs: index >= 8 ? 150 : 200,
  manaCost: 5,
  width: 34 + index * 2,
  range: 760,
  beamCount: index >= 5 ? 2 : 1,
  beamDamageScale: index >= 5 ? 0.7 : 1,
  focusPerTick: index >= 2 ? 0.1 : 0,
  maxFocus: index >= 2 ? 5 : 0,
  retargetOnKill: index >= 8,
  killExtendMs: index >= 8 ? 300 : 0,
  maxExtendMs: index >= 8 ? 1200 : 0,
  retargetFocusLoss: index >= 8 ? 2 : 5,
  desc: `自动向前方最近敌人发射${index >= 5 ? '两道平行' : '一道'}红色贯穿光束，持续${index >= 8 ? '1.8' : '1.2'}秒，每${index >= 8 ? '0.2秒（满焦点后0.15秒）' : '0.2秒'}造成${damage}点技能伤害${index >= 5 ? '，每道为原单道70%伤害，可分别命中同一敌人' : ''}${index >= 2 ? '；连续命中锁定目标每跳使后续对其伤害+10%，最多5层/50%' : ''}${index >= 8 ? '；击杀自动换前方目标、焦点减少2层，每杀延长0.3秒，最多延长1.2秒' : ''}。`
}));

const BREATH_LEVELS = [10, 11, 12, 13, 14, 15, 16, 17, 18].map((damage, index) => ({
  damage,
  cooldownMs: 6800 - index * 80,
  durationMs: 1500,
  intervalMs: 250,
  manaCost: 6,
  range: index >= 2 ? 500 : 400,
  angleDeg: index >= 2 ? 58 : 46,
  coldDurationMs: index >= 2 ? 4200 : 3400,
  slowPerStack: 0.04,
  attackSlowPerStack: 0.03,
  maxStacks: index >= 8 ? 10 : 8,
  normalFreezeStacks: index >= 2 ? 4 : 5,
  eliteFreezeStacks: index >= 2 ? 7 : 8,
  normalFreezeMs: 1200,
  eliteFreezeMs: 600,
  refreezeGuardMs: 800,
  shatterDamage: index >= 5 ? Math.round(damage * 2.2) : 0,
  shatterRadius: 110,
  deathShatterScale: index >= 8 ? 0.5 : 0,
  deathShatterRadius: 90,
  zoneDurationMs: index >= 8 ? 3000 : 0,
  zoneIntervalMs: 500,
  bossMaxMoveSlow: 0.45,
  bossMaxAttackSlow: 0.75,
  bossBreathDamageBonus: 0.3,
  desc: `向前喷出${index >= 2 ? '扩大后的' : ''}浅蓝锥形寒气，持续1.5秒，每0.25秒造成${damage}点技能伤害并叠加1层寒气；普通敌人${index >= 2 ? 4 : 5}层冻结1.2秒，精英${index >= 2 ? 7 : 8}层冻结0.6秒，Boss不会冻结${index >= 5 ? '；冻结目标受到合法玩家本体直接伤害时碎冰，110范围造成冰系技能伤害并给周围2层寒气' : ''}${index >= 8 ? '；结束后留下3秒极寒区域，每0.5秒叠1层寒气，冻结死亡产生50%小碎冰，Boss满层只受更强减速/攻速降低和冰冻吐息本体+30%伤害' : ''}。`
}));

export function configureSuperheroFlowSkills() {
  SKILLS.super_speed = { id: 'super_speed', name: '超级速度', rarity: 'COMMON', handler: 'super_speed', passive: true, maxLevel: 9, tags: [TAGS.SUPERPOWER, TAGS.BUILD_SUPERHERO], targetType: 'passive', manaCost: 0, color: 0xfff066, short: '速', description: '提高移动速度与常驻攻击速度；Lv3后根据实际前进移动进入高速状态。', milestones: { 3: '极速起步：连续实际移动1秒进入高速状态，停止后保留2秒并获得额外5%攻击速度。', 6: '超音速反应：高速额外攻速提高至8%，停止保留3秒，并让下一次玩家本体真实武器攻击剩余等待缩短50%（每次高速一次）。', 9: '神速不息：高速额外攻速提高至10%，保留阶段击杀延长0.5秒，单次最多延长2秒。' }, levels: SUPER_SPEED_LEVELS };
  SKILLS.laser_eyes = { id: 'laser_eyes', name: '镭射眼', rarity: 'FINE', handler: 'laser_eyes', maxLevel: 9, tags: [TAGS.SUPERPOWER, TAGS.MAGIC, TAGS.SPELL, TAGS.ACTIVE_SKILL, TAGS.BUILD_SUPERHERO], targetType: 'nearestAhead', manaCost: 5, cooldownMs: 5000, color: 0xff3333, short: '镭', description: '从眼部持续发出红色贯穿光束，造成直接技能伤害，不触发普通攻击附带效果。', milestones: { 3: '焦点灼穿：连续命中锁定目标时焦点提升，每层+10%后续伤害，最多5层/50%。', 6: '双瞳齐射：变为两道平行光束，每道造成原单道70%伤害，覆盖宽度提高。', 9: '热视线超载：持续1.8秒，满焦点后间隔缩短至0.15秒，击杀自动换目标并延长持续时间。' }, levels: LASER_LEVELS };
  SKILLS.freezing_breath = { id: 'freezing_breath', name: '冰冻吐息', rarity: 'RARE', handler: 'freezing_breath', maxLevel: 9, tags: [TAGS.SUPERPOWER, TAGS.ICE, TAGS.MAGIC, TAGS.SPELL, TAGS.ACTIVE_SKILL, TAGS.BUILD_SUPERHERO], targetType: 'nearestAhead', manaCost: 6, cooldownMs: 6800, color: 0x8eeaff, short: '冻', description: '向前方喷出浅蓝锥形寒气，低伤害叠加寒气并控制普通/精英敌人，Boss永不冻结。', milestones: { 3: '寒潮扩散：吐息距离提高约25%，角度扩大，寒气持续更久，普通/精英冻结门槛降低。', 6: '碎冰爆裂：冻结目标被合法玩家本体直接伤害命中时触发一次碎冰爆炸。', 9: '绝对零度：吐息结束后留下3秒极寒区域；冻结死亡会小型碎冰；Boss满寒气只受强化减速和吐息增伤。' }, levels: BREATH_LEVELS };
}

function syncSuperSpeedBonuses(system) {
  const scene = system.scene;
  const player = scene.playerData;
  const data = system.getData('super_speed');
  player.moveSpeedMultiplierBonuses ??= {};
  player.attackSpeedMultiplierBonuses ??= {};
  if (!data) {
    delete player.moveSpeedMultiplierBonuses.super_speed;
    delete player.attackSpeedMultiplierBonuses.super_speed;
    return;
  }
  const state = system.passiveState.superSpeed;
  player.moveSpeedMultiplierBonuses.super_speed = data.moveSpeedBonus || 0;
  player.attackSpeedMultiplierBonuses.super_speed = (data.attackSpeedBonus || 0) + (state?.highSpeed ? data.highSpeedAttackSpeedBonus || 0 : 0);
}

function cutNextPlayerWeaponWait(scene) {
  const currentTime = nowOf(scene);
  const readyAt = scene.combatSystem?.nextPlayerAttackAt ?? 0;
  if (readyAt > currentTime) scene.combatSystem.nextPlayerAttackAt = currentTime + (readyAt - currentTime) * 0.5;
}

export const SuperSpeedSkill = {
  bind(system) {
    const scene = system.scene;
    const player = scene.playerData;
    const state = system.passiveState.superSpeed = {
      highSpeed: false,
      movingMs: 0,
      graceUntil: 0,
      killExtendedMs: 0,
      weaponWaitCutConsumed: false,
      lastX: scene.player?.x ?? 0,
      lastUpdateAt: nowOf(scene),
      inGrace: false
    };
    syncSuperSpeedBonuses(system);

    const updater = () => {
      const data = system.getData('super_speed');
      const t = nowOf(scene);
      if (!data || player.hp <= 0) {
        state.highSpeed = false;
        state.inGrace = false;
        syncSuperSpeedBonuses(system);
        return;
      }
      const x = scene.player?.x ?? state.lastX;
      const dt = Math.max(0, t - state.lastUpdateAt);
      const moving = x > state.lastX + 0.5;
      const wasInGrace = state.inGrace;
      if (moving) {
        state.movingMs += dt;
        state.inGrace = false;
        if ((data.chargeMs || 0) > 0 && state.movingMs >= data.chargeMs && !state.highSpeed) {
          state.highSpeed = true;
          state.killExtendedMs = 0;
          state.weaponWaitCutConsumed = false;
        }
        if (state.highSpeed) state.graceUntil = t + (data.graceMs || 0);
      } else {
        state.movingMs = 0;
        if (state.highSpeed) {
          state.inGrace = true;
          if (!wasInGrace && data.weaponWaitCutRatio > 0 && !state.weaponWaitCutConsumed) {
            cutNextPlayerWeaponWait(scene);
            state.weaponWaitCutConsumed = true;
          }
          if (t > state.graceUntil) {
            state.highSpeed = false;
            state.inGrace = false;
            state.killExtendedMs = 0;
          }
        }
      }
      state.lastX = x;
      state.lastUpdateAt = t;
      syncSuperSpeedBonuses(system);
    };

    const offKill = scene.eventBus.on(CombatEvents.ENEMY_KILLED, () => {
      const data = system.getData('super_speed');
      const t = nowOf(scene);
      if (!data?.killExtendMs || !state.highSpeed || !state.inGrace || t > state.graceUntil) return;
      const add = Math.min(data.killExtendMs, (data.maxKillExtendMs || 0) - state.killExtendedMs);
      if (add > 0) {
        state.killExtendedMs += add;
        state.graceUntil += add;
      }
    });

    system.passiveUpdaters.push(updater);
    return () => {
      offKill?.();
      system.passiveUpdaters = system.passiveUpdaters.filter(fn => fn !== updater);
      delete player.moveSpeedMultiplierBonuses?.super_speed;
      delete player.attackSpeedMultiplierBonuses?.super_speed;
      delete system.passiveState.superSpeed;
    };
  },
  shiftTimers(system, duration, pausedAt) {
    const state = system.passiveState.superSpeed;
    if (!state) return;
    if (state.graceUntil > pausedAt) state.graceUntil += duration;
    if (state.lastUpdateAt > pausedAt) state.lastUpdateAt += duration;
  }
};

function segmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq));
  const closest = { x: start.x + dx * t, y: start.y + dy * t };
  return distance(point, closest);
}

function enemyRadius(enemy) {
  return Math.max(16, Math.min(54, Math.max(enemy.width || 32, enemy.height || 48) * 0.35));
}

function lineTargets(scene, start, end, halfWidth) {
  return (scene.targeting?.all?.() || []).filter(enemy => validEnemy(scene, enemy) && segmentDistance({ x: enemy.x, y: enemy.y - (enemy.height || 60) * 0.45 }, start, end) <= halfWidth + enemyRadius(enemy));
}

function createBeamVisual(scene) {
  return scene.add?.graphics?.()?.setDepth?.(150) || null;
}

function redrawBeam(graphics, start, end) {
  graphics?.clear?.();
  graphics?.lineStyle?.(6, 0xff2222, 0.9);
  graphics?.lineBetween?.(start.x, start.y, end.x, end.y);
}

function unitFrom(raw, fallback = { x: 1, y: 0 }) {
  const len = Math.hypot(raw?.x || 0, raw?.y || 0);
  if (len <= 0.0001) return { ...fallback };
  return { x: raw.x / len, y: raw.y / len };
}

function visualDelta(active, scene) {
  const now = nowOf(scene);
  if (active.lastVisualAt == null) {
    active.lastVisualAt = now;
    return 0;
  }
  const delta = Math.max(0, Math.min(80, now - active.lastVisualAt));
  active.lastVisualAt = now;
  return delta;
}

export const LaserEyesSkill = {
  canCast(system, cfg, data) {
    return !!system.scene.targeting?.nearestAhead?.(data.range || 760);
  },
  cast(system, cfg, data, level, ctx) {
    const scene = system.scene;
    const target = scene.targeting.nearestAhead(data.range);
    if (!validEnemy(scene, target)) return { failed: true };
    const origin = eyePoint(scene);
    const targetPoint = { x: target.x, y: target.y - (target.height || 60) * 0.45 };
    const dir = unitFrom({ x: targetPoint.x - origin.x, y: targetPoint.y - origin.y });
    const beamCount = data.beamCount || 1;
    const active = {
      skillId: cfg.id,
      cfg, data, level, ctx,
      nextAt: nowOf(scene),
      endAt: nowOf(scene) + data.durationMs,
      focus: 0,
      extended: 0,
      visuals: Array.from({ length: beamCount }, () => createBeamVisual(scene)).filter(Boolean),
      beamSegments: [],
      target,
      visualDir: dir,
      lastDirection: dir,
      lastVisualAt: null,
      selfScheduled: true,
      onEnd() {
        this.visuals.forEach(cleanupVisual);
        this.visuals = [];
        this.beamSegments = [];
        this.syncVisual = null;
        this.target = null;
        this.visualDir = null;
      }
    };
    active.syncVisual = () => syncLaserVisual(system, active);
    active.syncVisual();
    active.tick = () => tickLaser(system, active);
    const offKill = scene.eventBus.on(CombatEvents.ENEMY_KILLED, payload => {
      if (payload?.skillId !== cfg.id) return;
      if (data.killExtendMs && active.extended < data.maxExtendMs) {
        const add = Math.min(data.killExtendMs, data.maxExtendMs - active.extended);
        active.extended += add;
        active.endAt += add;
      }
    });
    const oldEnd = active.onEnd.bind(active);
    active.onEnd = reason => { offKill?.(); oldEnd(reason); };
    system.active.push(active);
    return { ok: true };
  },
  cleanup(system) {
    system.active.filter(active => active.skillId === 'laser_eyes').forEach(active => active.onEnd?.('cleanup'));
  }
};

function syncLaserVisual(system, active) {
  const scene = system.scene;
  const data = active.data;
  const origin = eyePoint(scene);
  if (!validEnemy(scene, active.target) && data.retargetOnKill) {
    const next = scene.targeting.nearestAhead(data.range);
    if (validEnemy(scene, next)) {
      active.target = next;
      active.focus = Math.max(0, active.focus - (data.retargetFocusLoss || 0));
    }
  }
  let targetDir = active.visualDir || { x: 1, y: 0 };
  if (validEnemy(scene, active.target)) {
    targetDir = unitFrom({ x: active.target.x - origin.x, y: active.target.y - (active.target.height || 60) * 0.45 - origin.y }, targetDir);
    active.lastDirection = targetDir;
  } else if (active.lastDirection) {
    targetDir = active.lastDirection;
  }
  const delta = visualDelta(active, scene);
  if (!active.visualDir || delta <= 0) active.visualDir = { ...targetDir };
  else {
    const alpha = 1 - Math.exp(-delta / 45);
    active.visualDir = unitFrom({ x: active.visualDir.x + (targetDir.x - active.visualDir.x) * alpha, y: active.visualDir.y + (targetDir.y - active.visualDir.y) * alpha }, targetDir);
  }
  const dir = active.visualDir;
  const normal = { x: -dir.y, y: dir.x };
  const beamCount = data.beamCount || 1;
  while (active.visuals.length < beamCount) {
    const visual = createBeamVisual(scene);
    if (!visual) break;
    active.visuals.push(visual);
  }
  active.beamSegments = [];
  for (let i = 0; i < beamCount; i += 1) {
    const offset = (i - (beamCount - 1) / 2) * data.width * 0.35;
    const start = { x: origin.x + normal.x * offset, y: origin.y + normal.y * offset };
    const end = { x: start.x + dir.x * (data.range || 760), y: start.y + dir.y * (data.range || 760) };
    const halfWidth = data.width * (beamCount > 1 ? 0.65 : 1) / 2;
    active.beamSegments.push({ start, end, halfWidth });
    redrawBeam(active.visuals[i], start, end);
  }
}

function tickLaser(system, active) {
  const scene = system.scene;
  const data = active.data;
  if (!active.beamSegments?.length) active.syncVisual?.();
  if (!validEnemy(scene, active.target) && data.retargetOnKill) {
    active.syncVisual?.();
    if (!validEnemy(scene, active.target)) {
      active.ended = true;
      return;
    }
  }
  let lockHit = false;
  (active.beamSegments || []).forEach(segment => {
    const targets = lineTargets(scene, segment.start, segment.end, segment.halfWidth);
    targets.forEach(enemy => {
      const isLock = enemy === active.target;
      lockHit ||= isLock;
      const scale = (data.beamDamageScale || 1) * (isLock ? 1 + Math.min(active.focus, data.maxFocus || 0) * (data.focusPerTick || 0) : 1);
      system.hit(enemy, system.damageValue(data.damage * scale, active.ctx), active.cfg, active.level, active.ctx, system.baseDamageValue(data.damage * scale, active.ctx), [TAGS.MAGIC, TAGS.SPELL, TAGS.SUPERPOWER]);
    });
  });
  if (data.maxFocus && lockHit) active.focus = Math.min(data.maxFocus, active.focus + 1);
  active.nextAt = nowOf(scene) + (active.focus >= 5 ? data.overloadIntervalMs : data.intervalMs);
}

function coneSnapshot(scene, data, target = null, fallbackDir = { x: 1, y: 0 }) {
  const origin = mouthPoint(scene);
  const raw = validEnemy(scene, target) ? { x: target.x - origin.x, y: target.y - (target.height || 60) * 0.35 - origin.y } : fallbackDir;
  const dir = unitFrom(raw, fallbackDir);
  return { origin, dir, range: data.range, angleRad: data.angleDeg * Math.PI / 180 };
}

function cloneSnapshot(snapshot) {
  return { origin: { ...snapshot.origin }, dir: { ...snapshot.dir }, range: snapshot.range, angleRad: snapshot.angleRad };
}

function inConeSnapshot(enemy, snapshot) {
  const point = { x: enemy.x, y: enemy.y - (enemy.height || 60) * 0.35 };
  const dx = point.x - snapshot.origin.x;
  const dy = point.y - snapshot.origin.y;
  const len = Math.hypot(dx, dy);
  if (len > snapshot.range) return false;
  const dot = (dx * snapshot.dir.x + dy * snapshot.dir.y) / Math.max(1, len);
  return Math.acos(Math.max(-1, Math.min(1, dot))) <= snapshot.angleRad / 2;
}

function redrawCone(g, snapshot, color = 0x8eeaff, alpha = 0.22) {
  if (!g) return null;
  g.clear?.();
  const base = Math.atan2(snapshot.dir.y, snapshot.dir.x);
  g.fillStyle(color, alpha);
  g.slice(snapshot.origin.x, snapshot.origin.y, snapshot.range, base - snapshot.angleRad / 2, base + snapshot.angleRad / 2, false);
  g.fillPath();
  return g;
}

function drawCone(scene, snapshot, color = 0x8eeaff, alpha = 0.22) {
  const g = scene.add?.graphics?.()?.setDepth?.(145);
  return redrawCone(g, snapshot, color, alpha);
}

function isLegalColdShatterSource(payload) {
  if (!payload || payload.noColdShatter || payload.afterimage || payload.fromMyriadAfterimage || payload.fromSummon || payload.fromArtifact) return false;
  if (['burn', 'poison', 'reflect', 'ground', 'environment', 'bomb'].includes(payload.source) || ['ground', 'dot', 'burn', 'poison', 'coldShatter', 'coldDeathShatter'].includes(payload.damageKind)) return false;
  const tags = payload.tags || [];
  if (tags.includes(TAGS.DOT) || tags.includes(TAGS.SUMMON)) return false;
  if (payload.source === 'attack') return tags.includes(TAGS.NORMAL_ATTACK);
  if (payload.source === 'skill') {
    const skill = SKILLS[payload.skillId];
    return !!skill && skill.id !== 'freezing_breath' && skill.tags?.includes(TAGS.ACTIVE_SKILL) && !skill.tags?.includes(TAGS.SUMMON) && !skill.tags?.includes(TAGS.DOT);
  }
  return false;
}

function shatterDamageMeta(kind, ctx, level) {
  return {
    source: 'skill', skillId: 'freezing_breath', damageKind: kind,
    tags: [TAGS.MAGIC, TAGS.SPELL, TAGS.ICE, TAGS.BUILD_SUPERHERO], level,
    allowLifeSteal: false, noKnockback: true, noColdShatter: true, noColdDeathShatter: true,
    professionApplied: true, professionMultiplier: ctx?.professionMultiplier || 1,
    baseAmountBeforeProfession: 1
  };
}

function triggerColdShatter(system, enemy, state, scale = 1, kind = 'coldShatter') {
  const scene = system.scene;
  const data = state.ownerData || system.getData('freezing_breath');
  const ctx = state.ownerCtx || {};
  const level = state.ownerSkillLevel || system.getLevel('freezing_breath');
  const radius = kind === 'coldDeathShatter' ? data.deathShatterRadius : data.shatterRadius;
  const base = Math.max(1, Math.round((data.shatterDamage || data.damage * 2) * scale));
  markEnemyColdShattered(enemy);
  const meta = shatterDamageMeta(kind, ctx, level);
  (scene.targeting.all() || []).filter(target => validEnemy(scene, target) && distance(target, enemy) <= radius).forEach(target => {
    const targetBase = Math.max(1, Math.round(base * (target === enemy ? 1 : 0.65)));
    const damage = Math.max(1, Math.round(targetBase * (ctx.damageMultiplier || scene.playerData.skillDamageMultiplier || 1)));
    scene.combatSystem.damageEnemy(target, damage, { ...meta, baseAmountBeforeProfession: Math.max(1, Math.round(targetBase * (ctx.baseDamageMultiplierWithoutProfession || scene.playerData.skillDamageMultiplier || 1))) });
    if (target !== enemy) applyEnemyCold(target, { now: nowOf(scene), data, stacks: kind === 'coldDeathShatter' ? 1 : 2, level, ctx, sourceId: 'freezing_breath' });
  });
}

export const FreezingBreathSkill = {
  canCast(system, cfg, data) {
    return !!system.scene.targeting?.nearestAhead?.(data.range || 500);
  },
  cast(system, cfg, data, level, ctx) {
    const scene = system.scene;
    const target = scene.targeting.nearestAhead(data.range);
    const snapshot = coneSnapshot(scene, data, target);
    const active = {
      skillId: cfg.id,
      activeKind: 'breath',
      cfg, data, level, ctx,
      target,
      visualDir: snapshot.dir,
      currentSnapshot: snapshot,
      lastVisualAt: null,
      nextAt: nowOf(scene),
      endAt: nowOf(scene) + data.durationMs,
      visual: scene.add?.graphics?.()?.setDepth?.(145) || null,
      onEnd(reason) {
        const finalSnapshot = this.currentSnapshot ? cloneSnapshot(this.currentSnapshot) : null;
        cleanupVisual(this.visual);
        this.visual = null;
        this.currentSnapshot = null;
        this.syncVisual = null;
        this.target = null;
        this.visualDir = null;
        if (reason === 'complete' && finalSnapshot && system.getLevel('freezing_breath') >= 9 && (scene.playerData?.hp || 0) > 0 && data.zoneDurationMs) createColdZone(system, cfg, data, level, ctx, finalSnapshot);
      }
    };
    active.syncVisual = () => syncBreathVisual(system, active);
    active.syncVisual();
    active.tick = () => {
      active.syncVisual?.();
      const current = active.currentSnapshot;
      (scene.targeting.all() || []).filter(enemy => validEnemy(scene, enemy) && current && inConeSnapshot(enemy, current)).forEach(enemy => {
        const coldState = applyEnemyCold(enemy, { now: nowOf(scene), data, stacks: 1, level, ctx, sourceId: 'freezing_breath' });
        const bonus = enemy.isBoss && coldState.stacks >= (data.maxStacks || 8) ? data.bossBreathDamageBonus || 0 : 0;
        system.hit(enemy, system.damageValue(data.damage * (1 + bonus), ctx), cfg, level, ctx, system.baseDamageValue(data.damage * (1 + bonus), ctx), [TAGS.MAGIC, TAGS.SPELL, TAGS.ICE]);
      });
    };
    system.active.push(active);
    return { ok: true };
  },
  bind(system) {
    const scene = system.scene;
    const updater = () => (scene.enemies || []).forEach(enemy => {
      const state = getEnemyColdState(enemy, nowOf(scene));
      if (!state.stacks || !validEnemy(scene, enemy)) clearEnemyCold(enemy);
      if (isEnemyFrozen(enemy, nowOf(scene))) enemy.body?.setVelocityX?.(0);
    });
    const offHit = scene.eventBus.on(CombatEvents.ENEMY_HIT, payload => {
      const enemy = payload?.enemy;
      const state = getEnemyColdState(enemy, nowOf(scene));
      if (!state.frozen || state.shatterUsed || !isLegalColdShatterSource(payload)) return;
      triggerColdShatter(system, enemy, state, 1, 'coldShatter');
    });
    const offKill = scene.eventBus.on(CombatEvents.ENEMY_KILLED, payload => {
      const enemy = payload?.enemy;
      const state = getEnemyColdState(enemy, nowOf(scene));
      if (state.frozen && !state.shatterUsed && payload?.noColdDeathShatter !== true && payload?.damageKind !== 'coldShatter' && (state.ownerData?.deathShatterScale || 0) > 0) triggerColdShatter(system, enemy, state, state.ownerData.deathShatterScale, 'coldDeathShatter');
      clearEnemyCold(enemy);
    });
    system.passiveUpdaters.push(updater);
    return () => {
      offHit?.();
      offKill?.();
      system.passiveUpdaters = system.passiveUpdaters.filter(fn => fn !== updater);
      FreezingBreathSkill.cleanup(system);
    };
  },
  cleanup(system) {
    system.active.filter(active => active.skillId === 'freezing_breath').forEach(active => {
      active.onEnd?.('cleanup');
      active.ended = true;
    });
    system.active = system.active.filter(active => active.skillId !== 'freezing_breath');
    clearAllEnemyCold(system.scene);
  },
  shiftTimers(system, duration, pausedAt) {
    system.scene.enemies?.forEach(enemy => shiftEnemyColdTimers(enemy, duration, pausedAt));
  }
};

function syncBreathVisual(system, active) {
  const scene = system.scene;
  const data = active.data;
  if (!validEnemy(scene, active.target)) {
    const next = scene.targeting?.nearestAhead?.(data.range);
    if (validEnemy(scene, next)) active.target = next;
  }
  let targetDir = active.visualDir || { x: 1, y: 0 };
  const origin = mouthPoint(scene);
  if (validEnemy(scene, active.target)) targetDir = unitFrom({ x: active.target.x - origin.x, y: active.target.y - (active.target.height || 60) * 0.35 - origin.y }, targetDir);
  const delta = visualDelta(active, scene);
  if (!active.visualDir || delta <= 0) active.visualDir = { ...targetDir };
  else {
    const alpha = 1 - Math.exp(-delta / 45);
    active.visualDir = unitFrom({ x: active.visualDir.x + (targetDir.x - active.visualDir.x) * alpha, y: active.visualDir.y + (targetDir.y - active.visualDir.y) * alpha }, targetDir);
  }
  active.currentSnapshot = coneSnapshot(scene, data, active.target, active.visualDir);
  redrawCone(active.visual, active.currentSnapshot);
}

function createColdZone(system, cfg, data, level, ctx, snapshot) {
  const scene = system.scene;
  const visual = drawCone(scene, snapshot, 0x8eeaff, 0.12);
  const active = {
    skillId: 'freezing_breath',
    activeKind: 'coldZone',
    data: { intervalMs: data.zoneIntervalMs },
    snapshot,
    nextAt: nowOf(scene) + data.zoneIntervalMs,
    endAt: nowOf(scene) + data.zoneDurationMs,
    visual,
    onEnd() { cleanupVisual(visual); },
    tick() {
      (scene.targeting.all() || []).filter(enemy => validEnemy(scene, enemy) && inConeSnapshot(enemy, snapshot)).forEach(enemy => applyEnemyCold(enemy, { now: nowOf(scene), data, stacks: 1, level, ctx, sourceId: 'freezing_breath' }));
    }
  };
  system.active.push(active);
}

export const __superheroTest = { segmentDistance, lineTargets, inConeSnapshot, isLegalColdShatterSource, getEnemyColdState, eyePoint, mouthPoint, syncLaserVisual, syncBreathVisual };
