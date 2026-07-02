import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';

const skillSystemSource = readFileSync(new URL('../src/systems/SkillSystem.js', import.meta.url), 'utf8');
assert.match(
  skillSystemSource,
  /ensurePassiveBound\(id\)[\s\S]*handler\?\.onAcquire\?\.\(this\)/,
  'SkillSystem must notify already-bound passive handlers when a skill is acquired'
);

function visual(type) {
  return {
    type,
    destroyed: false,
    x: 0,
    y: 0,
    alpha: 1,
    rotation: 0,
    setDepth() { return this; },
    setScrollFactor() { return this; },
    setStrokeStyle() { return this; },
    setOrigin() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    setRotation(rotation) { this.rotation = rotation; return this; },
    setScale(scale) { this.scale = scale; return this; },
    destroy() { this.destroyed = true; return this; }
  };
}

function events() {
  const listeners = new Map();
  return {
    once(name, callback) { listeners.set(name, callback); },
    off(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
    emit(name) { listeners.get(name)?.(); },
    count(name) { return listeners.has(name) ? 1 : 0; }
  };
}

function enemy(id, x, y, options = {}) {
  return {
    id,
    x,
    y,
    width: options.width ?? 40,
    displayWidth: options.displayWidth ?? options.width ?? 40,
    hp: options.hp ?? 10000,
    maxHp: options.hp ?? 10000,
    active: true,
    inside: options.inside ?? true,
    isDefeated: false,
    isElite: !!options.isElite,
    isBoss: !!options.isBoss,
    charging: !!options.charging,
    body: {
      velocity: { x: 0 },
      setVelocityX(value) { this.velocity.x = value; },
      reset() {}
    }
  };
}

function createScene() {
  const created = [];
  const scene = {
    now: 0,
    enemies: [],
    player: { x: 300, y: 600 },
    playerData: { hp: 100, maxHp: 100, damageReductionBonuses: {}, skills: [] },
    balance: { groundTopY: 620, stageWorldWidth: 1200 },
    cameras: { main: { worldView: { x: 100, y: 0, centerX: 460 } } },
    events: events(),
    hits: [],
    knockbacks: [],
    created,
    getGameplayTime() { return this.now; },
    targeting: {
      valid(target) { return !!target && target.active !== false && !target.isDefeated && target.hp > 0; },
      all() { return scene.enemies.filter(target => this.valid(target)); },
      isEnemyFullyInsideViewport(target) { return target.inside !== false; }
    },
    add: {
      circle(x = 0, y = 0) { const object = visual('circle').setPosition(x, y); created.push(object); return object; },
      line() { const object = visual('line'); created.push(object); return object; },
      rectangle(x = 0, y = 0) { const object = visual('rectangle').setPosition(x, y); created.push(object); return object; }
    },
    combatSystem: {
      damageEnemy(target, damage, meta) {
        const resolved = Math.round(damage);
        target.hp -= resolved;
        scene.hits.push({ target, damage: resolved, meta, time: scene.now });
        if (target.hp <= 0) target.isDefeated = true;
        return true;
      },
      applyKnockback(target, meta) {
        scene.knockbacks.push({ target, meta, time: scene.now });
        return true;
      }
    },
    floatText() {}
  };
  return scene;
}

function createSystem(scene, levels = {}) {
  return {
    scene,
    passiveState: {},
    passiveUpdaters: [],
    getLevel(id) { return levels[id] || 0; },
    getData(id, level = levels[id]) { return SKILLS[id].levels[level - 1]; }
  };
}

function tick(system, elapsedMs = 0) {
  system.scene.now += elapsedMs;
  [...system.passiveUpdaters].forEach(update => update());
}

// Global bind while unowned creates no runtime; later acquisition activates through onAcquire without rebinding.
{
  const scene = createScene();
  const levels = {};
  const system = createSystem(scene, levels);
  const neutronCleanup = SKILL_HANDLERS.neutron_star.bind(system);
  const dwarfCleanup = SKILL_HANDLERS.white_dwarf.bind(system);
  tick(system, 5000);
  assert.equal(scene.neutronStarRuntime, undefined, 'unowned neutron star creates no runtime');
  assert.equal(scene.whiteDwarfRuntime, undefined, 'unowned white dwarf creates no runtime');
  assert.equal(system.passiveUpdaters.length, 0, 'unowned celestial handlers add no frame updaters');
  assert.equal(scene.created.length, 0, 'unowned skills create no visuals');

  levels.neutron_star = 1;
  SKILL_HANDLERS.neutron_star.onAcquire(system);
  scene.enemies = [enemy('acquire-target', 620, 375)];
  tick(system, 0);
  assert.equal(scene.neutronStarRuntime.active, true);
  assert.equal(scene.hits.length, 0, 'in-run neutron acquisition waits before its first pulse');
  tick(system, SKILLS.neutron_star.levels[0].initialPulseDelayMs);
  assert.equal(scene.hits.length, 1, 'initial neutron delay then starts its first pulse');

  levels.white_dwarf = 1;
  SKILL_HANDLERS.white_dwarf.onAcquire(system);
  assert.equal(scene.whiteDwarfRuntime.active, true);
  assert.equal(scene.playerData.damageReductionBonuses.white_dwarf, .12, 'in-run white dwarf acquisition applies reduction immediately');
  assert.equal(scene.whiteDwarfRuntime.charges.length, 1);
  assert.equal(scene.whiteDwarfRuntime.charges[0].readyAt, scene.now, 'first guard charge is immediately ready');

  neutronCleanup();
  dwarfCleanup();
  assert.equal(system.passiveUpdaters.length, 0);
}

// Non-Lv9 sweep hits only enemies physically crossed by the beam, even when one update jumps to the sweep end.
{
  const scene = createScene();
  const levels = { neutron_star: 1 };
  const system = createSystem(scene, levels);
  const inside = enemy('inside', 100 + 710, 555, { hp: 10000 });
  scene.enemies = [inside];
  SKILL_HANDLERS.neutron_star.bind(system);
  tick(system, 0);       // arm pulse 1
  tick(system, SKILLS.neutron_star.levels[0].initialPulseDelayMs); // pulse 1
  tick(system, SKILLS.neutron_star.levels[0].pulseGapMs);     // pulse 2
  const outside = enemy('outside', 100 + 210, 555, { hp: 10000 });
  scene.enemies.push(outside);
  tick(system, SKILLS.neutron_star.levels[0].singlePulseVisualMs + SKILLS.neutron_star.levels[0].postSecondPulseDelayMs);     // warning
  tick(system, SKILLS.neutron_star.levels[0].sweepWarningMs);     // start sweep
  const hitsBeforeSweep = scene.hits.length;
  tick(system, SKILLS.neutron_star.levels[0].sweepDurationMs);     // low-FPS jump directly to sweep end
  const sweepHits = scene.hits.slice(hitsBeforeSweep);
  assert.deepEqual(sweepHits.map(hit => hit.target.id), ['inside'], 'sweep end does not grant catch-all damage outside its angular path');
  assert.equal(sweepHits[0].damage, SKILLS.neutron_star.levels[0].sweepDamage);
  assert.equal(scene.neutronStarRuntime.sweep, null);
  assert(scene.created.filter(object => object.type !== 'circle').every(object => object.destroyed), 'pulse, warning, and sweep visuals are destroyed on schedule');
  assert.equal(scene.neutronStarRuntime.visuals.size, 2, 'only the permanent neutron body and ring remain tracked');
}

// Lv9 legitimately covers the full viewport exactly once per enemy, not once per frame.
{
  const scene = createScene();
  const levels = { neutron_star: 9 };
  const system = createSystem(scene, levels);
  const targets = [
    enemy('east', 100 + 710, 555),
    enemy('middle', 100 + 500, 555),
    enemy('front', 100 + 320, 555),
    enemy('behind', 100 + 210, 555),
    enemy('offscreen', 100 + 650, 555, { inside: false })
  ];
  scene.enemies = targets;
  SKILL_HANDLERS.neutron_star.bind(system);
  tick(system, 0);
  tick(system, SKILLS.neutron_star.levels[8].initialPulseDelayMs);
  tick(system, SKILLS.neutron_star.levels[8].pulseGapMs);
  tick(system, SKILLS.neutron_star.levels[8].singlePulseVisualMs + SKILLS.neutron_star.levels[8].postSecondPulseDelayMs);
  tick(system, SKILLS.neutron_star.levels[8].sweepWarningMs);
  const before = scene.hits.length;
  tick(system, SKILLS.neutron_star.levels[8].sweepDurationMs);
  const sweepHits = scene.hits.slice(before);
  assert.deepEqual(new Set(sweepHits.map(hit => hit.target.id)), new Set(['east','middle','front']));
  assert.equal(sweepHits.length, 3, 'fixed right-to-front sweep has a per-enemy one-hit cap');
  assert(!sweepHits.some(hit => hit.target.id === 'offscreen'));
  assert(sweepHits.every(hit => hit.meta.defenseIgnore === .35));
}

// White Dwarf guard respects direct attacks, follows the player immediately, recharges, and cleans up/reacquires.
{
  const scene = createScene();
  const levels = { white_dwarf: 1 };
  const system = createSystem(scene, levels);
  SKILL_HANDLERS.white_dwarf.bind(system);
  SKILL_HANDLERS.white_dwarf.onAcquire(system);
  const runtime = scene.whiteDwarfRuntime;
  const firstX = runtime.visuals[0].x;
  scene.player.x += 100;
  SKILL_HANDLERS.white_dwarf.syncAttachedVisuals(system);
  assert.equal(runtime.visuals[0].x, firstX + 100, 'post-update sync removes player-follow lag');
  assert.equal(SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(system, { directAttack: false, hpDamage: 80 }), null);
  assert.equal(runtime.charges[0].readyAt, 0, 'indirect damage does not consume a charge');
  const smallGuarded = SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(system, { directAttack: true, hpDamage: 5 });
  assert.equal(smallGuarded.hpDamage, 2, 'small direct hits now consume a charge and reduce hp damage');
  assert.equal(smallGuarded.blockedDamage, 3);
  runtime.charges[0].readyAt = scene.now;
  const guarded = SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(system, { directAttack: true, hpDamage: 20 });
  assert.equal(guarded.hpDamage, 9);
  assert(runtime.charges[0].readyAt > scene.now);
  tick(system, 8499);
  assert.match(runtime.getSkillBarState().text, /^护体 0\/1/);
  tick(system, 1);
  assert.equal(runtime.getSkillBarState().text, '护体 1/1');

  SKILL_HANDLERS.white_dwarf.destroyRuntime(system);
  assert.equal(scene.whiteDwarfRuntime, null);
  assert.equal(scene.playerData.damageReductionBonuses.white_dwarf, undefined);
  const reboundCleanup = SKILL_HANDLERS.white_dwarf.bind(system);
  SKILL_HANDLERS.white_dwarf.onAcquire(system);
  assert(scene.whiteDwarfRuntime);
  assert.notEqual(scene.whiteDwarfRuntime, runtime);
  assert.equal(scene.whiteDwarfRuntime.charges[0].readyAt, scene.now);
  reboundCleanup();
}

// Lv9 consumes only one of two charges, disables lifesteal on burst, and uses unified safe knockback.
{
  const scene = createScene();
  scene.playerData.hp = 30;
  const levels = { white_dwarf: 9 };
  const system = createSystem(scene, levels);
  const normal = enemy('normal', 330, 600);
  const elite = enemy('elite', 340, 600, { isElite: true });
  const boss = enemy('boss', 350, 600, { isBoss: true });
  const protectedEnemy = enemy('charging', 360, 600, { charging: true });
  scene.enemies = [normal, elite, boss, protectedEnemy];
  SKILL_HANDLERS.white_dwarf.bind(system);
  SKILL_HANDLERS.white_dwarf.onAcquire(system);
  const guarded = SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(system, { directAttack: true, hpDamage: 20 });
  assert.equal(guarded.hpDamage, 2);
  assert.equal(scene.whiteDwarfRuntime.charges.filter(charge => charge.readyAt <= scene.now).length, 1, 'one damage event consumes at most one star');
  assert.equal(scene.hits.length, 4, 'burst damages all nearby visible enemies');
  assert(scene.hits.every(hit => hit.meta.allowLifeSteal === false && hit.meta.noKnockback === true));
  assert.deepEqual(scene.knockbacks.map(entry => entry.target.id), ['normal', 'elite'], 'bosses and protected enemy states are not displaced');
  assert(scene.knockbacks.every(entry => entry.meta.knockback === 72));
  const burstRing = scene.whiteDwarfRuntime.transients[0]?.object;
  assert(burstRing && !burstRing.destroyed);
  tick(system, 260);
  assert.equal(burstRing.destroyed, true, 'guard burst visual is destroyed after its configured duration');
}

console.log('v0.10.91 celestial runtime validation passed');
