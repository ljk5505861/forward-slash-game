const alive = enemy => !!enemy && enemy.active !== false && !enemy.isDefeated && (enemy.hp ?? 1) > 0;
const bossSlowScale = enemy => enemy?.isBoss ? 1 : 1;
const coldMap = enemy => enemy && (enemy.coldSources ||= new Map());

export function getEnemyColdState(enemy, now = 0) {
  const state = {
    stacks: 0,
    moveSlow: 0,
    attackSlow: 0,
    frozen: false,
    frozenUntil: 0,
    refreezeGuardUntil: 0,
    shatterUsed: false,
    ownerSkillLevel: 0,
    ownerCtx: null,
    ownerData: null,
    lastAppliedAt: 0
  };
  if (!enemy?.coldSources) return state;
  for (const [id, source] of [...enemy.coldSources.entries()]) {
    if (source.expiresAt !== Infinity && source.expiresAt <= now) {
      enemy.coldSources.delete(id);
      continue;
    }
    state.stacks += source.stacks || 0;
    state.moveSlow = Math.max(state.moveSlow, source.moveSlow || 0);
    state.attackSlow = Math.max(state.attackSlow, source.attackSlow || 0);
    state.frozenUntil = Math.max(state.frozenUntil, source.frozenUntil || 0);
    state.refreezeGuardUntil = Math.max(state.refreezeGuardUntil, source.refreezeGuardUntil || 0);
    state.shatterUsed ||= !!source.shatterUsed;
    state.ownerSkillLevel = Math.max(state.ownerSkillLevel, source.ownerSkillLevel || 0);
    state.ownerCtx = source.ownerCtx || state.ownerCtx;
    state.ownerData = source.ownerData || state.ownerData;
    state.lastAppliedAt = Math.max(state.lastAppliedAt, source.lastAppliedAt || 0);
  }
  state.frozen = !enemy.isBoss && state.frozenUntil > now;
  return state;
}

export function isEnemyFrozen(enemy, now = 0) {
  return getEnemyColdState(enemy, now).frozen;
}

export function getEnemyColdMoveSpeed(enemy, baseSpeed = 0, now = 0) {
  if (isEnemyFrozen(enemy, now)) return 0;
  const state = getEnemyColdState(enemy, now);
  const maxBossSlow = state.ownerData?.bossMaxMoveSlow ?? 0.45;
  const slow = enemy?.isBoss ? Math.min(maxBossSlow, state.moveSlow * bossSlowScale(enemy)) : state.moveSlow;
  return Math.max(0, Number(baseSpeed || 0) * (1 - Math.min(0.95, slow)));
}

export function getEnemyColdAttackDelay(enemy, baseDelayMs = 1000, now = 0) {
  if (isEnemyFrozen(enemy, now)) return Number.POSITIVE_INFINITY;
  const state = getEnemyColdState(enemy, now);
  const maxBossSlow = state.ownerData?.bossMaxAttackSlow ?? 0.75;
  const slow = enemy?.isBoss ? Math.min(maxBossSlow, state.attackSlow * bossSlowScale(enemy)) : state.attackSlow;
  return Math.max(120, Number(baseDelayMs || 1000) / Math.max(0.05, 1 - Math.min(0.95, slow)));
}

export function applyEnemyCold(enemy, options = {}) {
  if (!alive(enemy)) return null;
  const now = options.now ?? 0;
  const data = options.data || {};
  const sourceId = options.sourceId || 'freezing_breath';
  const previous = getEnemyColdState(enemy, now);
  const maxStacks = data.maxStacks || 8;
  const stacks = Math.min(maxStacks, Math.max(0, previous.stacks) + Math.max(1, options.stacks || 1));
  const source = {
    sourceId,
    stacks,
    expiresAt: now + (data.coldDurationMs || 3400),
    moveSlow: Math.min(enemy.isBoss && stacks >= maxStacks ? data.bossMaxMoveSlow ?? 0.45 : 0.95, stacks * (data.slowPerStack ?? 0.04)),
    attackSlow: Math.min(enemy.isBoss && stacks >= maxStacks ? data.bossMaxAttackSlow ?? 0.75 : 0.95, stacks * (data.attackSlowPerStack ?? 0.03)),
    frozenUntil: previous.frozenUntil || 0,
    refreezeGuardUntil: previous.refreezeGuardUntil || 0,
    shatterUsed: previous.shatterUsed || false,
    ownerSkillLevel: options.level || previous.ownerSkillLevel || 0,
    ownerCtx: options.ctx || previous.ownerCtx || null,
    ownerData: data,
    lastAppliedAt: now
  };
  const threshold = enemy.isBoss ? Infinity : (enemy.isElite ? data.eliteFreezeStacks : data.normalFreezeStacks);
  if (stacks >= threshold && now >= source.refreezeGuardUntil && now >= source.frozenUntil) {
    const freezeMs = enemy.isElite ? data.eliteFreezeMs : data.normalFreezeMs;
    source.frozenUntil = now + (freezeMs || 0);
    source.refreezeGuardUntil = source.frozenUntil + (data.refreezeGuardMs || 800);
    source.shatterUsed = false;
    enemy.body?.setVelocityX?.(0);
  }
  coldMap(enemy).set(sourceId, source);
  return getEnemyColdState(enemy, now);
}

export function markEnemyColdShattered(enemy, sourceId = 'freezing_breath') {
  const source = enemy?.coldSources?.get?.(sourceId);
  if (source) {
    source.shatterUsed = true;
    source.frozenUntil = 0;
  }
}

export function shiftEnemyColdTimers(enemy, duration, pausedAt) {
  if (!enemy?.coldSources) return;
  enemy.coldSources.forEach(source => {
    ['expiresAt', 'frozenUntil', 'refreezeGuardUntil'].forEach(key => {
      if (source[key] > pausedAt) source[key] += duration;
    });
  });
}

export function clearEnemyCold(enemy) {
  if (!enemy) return;
  enemy.coldSources?.clear?.();
  enemy.coldSources = undefined;
}

export function clearAllEnemyCold(scene) {
  scene?.enemies?.forEach(clearEnemyCold);
}
