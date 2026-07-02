import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { getEnemyColdState } from '../src/systems/EnemyColdControl.js';

const close = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-9, message || `${actual} ~= ${expected}`);

class Bus {
  constructor() { this.handlers = new Map(); }
  on(type, fn) { const list = this.handlers.get(type) || []; list.push(fn); this.handlers.set(type, list); return () => this.handlers.set(type, (this.handlers.get(type) || []).filter(item => item !== fn)); }
  emit(type, payload) { (this.handlers.get(type) || []).slice().forEach(fn => fn(payload)); }
}

const node = () => ({
  active: true, alpha: 1, setDepth(){return this}, setStrokeStyle(){return this}, setOrigin(){return this},
  clear(){return this}, lineStyle(){return this}, lineBetween(){return this}, fillStyle(){return this}, slice(){return this}, fillPath(){return this},
  setFillStyle(){return this}, setScale(){return this}, destroy(){this.destroyed = true}
});

function makeScene() {
  const scene = {
    now: 0,
    player: { x: 0, y: 500 },
    playerData: {
      hp: 100, maxHp: 100, mana: 100, maxMana: 100, attack: 100, baseAttack: 100,
      skills: [], attackSpeedMultiplier: 1, skillDamageMultiplier: 1, cooldownReduction: 0,
      moveSpeedMultiplierBonuses: {}, attackSpeedMultiplierBonuses: {}, attackBonuses: {}, strengthBonuses: {},
      attackDamageBonuses: {}, normalAttackDamageBonuses: {}, heavyHitDamageBonuses: {}, physicalCritChanceBonuses: {},
      physicalCritMultiplierBonuses: {}, attackRangeMultiplierBonuses: {}, critChance: 0, critMultiplier: 1.5
    },
    enemies: [], eventBus: new Bus(),
    isGameplayPaused(){return false}, getGameplayTime(){return this.now},
    hud:{update(){}}, skillBar:{update(){}}, events:{on(){},once(){}},
    add:{graphics:()=>node(),circle:()=>node(),rectangle:()=>node(),arc:()=>node(),text:()=>node()},
    tweens:{add(config){ if(config?.onComplete && config.completeImmediately) config.onComplete(); return node(); },killTweensOf(){}},
    targeting:{
      valid: enemy => !!enemy && !enemy.isDefeated && (enemy.hp ?? 1) > 0,
      all(){return scene.enemies.filter(this.valid)},
      nearestAhead(range=9999){return this.all().filter(enemy => enemy.x >= scene.player.x && enemy.x - scene.player.x <= range).sort((a,b)=>a.x-b.x)[0] || null},
      isEnemyFullyInsideViewport(){return true}
    },
    professionSystem:{getDamageMultiplier(){return 1},onActiveSkillCast(){},onDirectHit(){}},
    artifactSystem:{highHpDamageMultiplier(){return 1}}
  };
  scene.combatSystem = {
    nextPlayerAttackAt: 0, damageLog: [],
    damageEnemy(enemy, amount, meta={}) {
      if(!scene.targeting.valid(enemy)) return false;
      const damage = Math.max(0, Math.round(amount));
      enemy.hp = Math.max(0, enemy.hp - damage);
      this.damageLog.push({enemy, amount:damage, meta});
      return damage > 0;
    }
  };
  scene.skillSystem = new SkillSystem(scene);
  return scene;
}

function enemy(props={}) {
  return { active:true, x:props.x ?? 300, y:props.y ?? 500, width:props.width ?? 60, height:props.height ?? 90, hp:props.hp ?? 1000, maxHp:props.hp ?? 1000, ...props };
}

function setSkills(scene, skills) {
  scene.playerData.skills = skills.map(([id, level]) => ({id, level}));
  if (skills.some(([id]) => id === 'super_speed')) scene.skillSystem.ensurePassiveBound('super_speed');
}

function update(scene, time) { scene.now = time; scene.skillSystem.update(time); }
function enterHighSpeed(scene) { update(scene, 0); scene.player.x += 120; update(scene, 1000); }

// Config and milestone: old wait-cut is removed and replaced by one kinetic charge per high-speed state.
{
  const level6 = SKILLS.super_speed.levels[5];
  assert.equal(level6.weaponWaitCutRatio, 0);
  assert.equal(level6.kineticEnabled, true);
  assert.equal(level6.kineticAttackDamageBonus, 0.40);
  assert.equal(level6.kineticLaserDurationBonus, 0.25);
  assert.equal(level6.kineticLaserWidthBonus, 0.20);
  assert.equal(level6.kineticBreathRangeBonus, 0.20);
  assert.equal(level6.kineticBreathAngleBonus, 0.15);
  assert.equal(level6.kineticBreathFirstHitExtraStacks, 1);
  assert.match(SKILLS.super_speed.milestones[6], /动能强化/);
}

// Every new high-speed state grants exactly one kinetic charge; expiry clears it and kills do not refill it.
{
  const scene = makeScene();
  setSkills(scene, [['super_speed', 9]]);
  enterHighSpeed(scene);
  const state = scene.skillSystem.passiveState.superSpeed;
  assert.equal(state.kineticReady, true);
  state.kineticReady = false;
  scene.eventBus.emit('ENEMY_KILLED', {enemy:enemy()});
  assert.equal(state.kineticReady, false, 'Lv9 kill extension must not refill kinetic');
  scene.player.x += 5;
  update(scene, 1100);
  update(scene, 6201);
  assert.equal(state.highSpeed, false);
  assert.equal(state.kineticReady, false);
  scene.player.x += 120;
  update(scene, 7301);
  assert.equal(state.kineticReady, true, 'a fresh high-speed state grants a new charge');
}

// Laser consumes kinetic only on a successful cast and snapshots +25% duration / +20% width.
{
  const scene = makeScene();
  setSkills(scene, [['super_speed', 6], ['laser_eyes', 1]]);
  enterHighSpeed(scene);
  const state = scene.skillSystem.passiveState.superSpeed;
  const failed = SKILL_HANDLERS.laser_eyes.cast(scene.skillSystem, SKILLS.laser_eyes, SKILLS.laser_eyes.levels[0], 1, scene.skillSystem.createCastContext('laser_eyes'));
  assert.equal(failed.failed, true);
  assert.equal(state.kineticReady, true, 'failed cast must not consume kinetic');
  scene.enemies = [enemy({x:420,y:560})];
  const base = SKILLS.laser_eyes.levels[0];
  const result = SKILL_HANDLERS.laser_eyes.cast(scene.skillSystem, SKILLS.laser_eyes, base, 1, scene.skillSystem.createCastContext('laser_eyes'));
  assert.equal(result.ok, true);
  const active = scene.skillSystem.active.find(item => item.skillId === 'laser_eyes');
  assert.equal(active.data.durationMs, Math.round(base.durationMs * 1.25));
  close(active.data.width, base.width * 1.20);
  assert.equal(state.kineticReady, false);
}

// Breath gets +20% range, +15% angle and only the first hit on each enemy gets one extra cold stack.
{
  const scene = makeScene();
  setSkills(scene, [['super_speed', 6], ['freezing_breath', 1]]);
  enterHighSpeed(scene);
  const target = enemy({x:430,y:500});
  scene.enemies = [target];
  const base = SKILLS.freezing_breath.levels[0];
  const result = SKILL_HANDLERS.freezing_breath.cast(scene.skillSystem, SKILLS.freezing_breath, base, 1, scene.skillSystem.createCastContext('freezing_breath'));
  assert.equal(result.ok, true);
  const active = scene.skillSystem.active.find(item => item.activeKind === 'breath');
  close(active.data.range, base.range * 1.20);
  close(active.data.angleDeg, base.angleDeg * 1.15);
  active.tick();
  assert.equal(getEnemyColdState(target, scene.now).stacks, 2, 'first kinetic breath hit adds two total stacks');
  scene.now = 250;
  active.tick();
  assert.equal(getEnemyColdState(target, scene.now).stacks, 3, 'later ticks add only one stack');
  assert.equal(scene.skillSystem.passiveState.superSpeed.kineticReady, false);
}

// When laser or breath is owned, a normal attack does not steal kinetic.
{
  const scene = makeScene();
  setSkills(scene, [['super_speed', 6], ['laser_eyes', 1]]);
  enterHighSpeed(scene);
  const combat = new CombatSystem(scene);
  scene.combatSystem = combat;
  const weapon = {damageMultiplier:1, knockback:0};
  let captured = 0;
  combat.performDefaultAttack = function(_target, currentWeapon){ captured = this.attackDamageFactors(currentWeapon, null, false).nonCritBaseDamage; };
  combat.performAttack(enemy(), weapon, null);
  assert.equal(captured, 100);
  assert.equal(scene.skillSystem.passiveState.superSpeed.kineticReady, true);
}

// Without linked skills, the next body weapon attack snapshots +40% for default and profile attacks, then consumes kinetic once.
{
  const scene = makeScene();
  setSkills(scene, [['super_speed', 6]]);
  enterHighSpeed(scene);
  const combat = new CombatSystem(scene);
  scene.combatSystem = combat;
  const weapon = {damageMultiplier:1, knockback:0};
  let captured = 0;
  combat.performDefaultAttack = function(_target, currentWeapon){ captured = this.attackDamageFactors(currentWeapon, null, false).nonCritBaseDamage; };
  combat.performAttack(enemy(), weapon, null);
  assert.equal(captured, 140);
  assert.equal(scene.skillSystem.passiveState.superSpeed.kineticReady, false);

  update(scene, 5001);
  scene.player.x += 120;
  update(scene, 6101);
  assert.equal(scene.skillSystem.passiveState.superSpeed.kineticReady, true);
  let profileDamage = 0;
  combat.performSwordSlashAttack = function(profile, currentWeapon){ profileDamage = this.attackDamageFactors(currentWeapon, profile, false).nonCritBaseDamage; };
  combat.performAttack(enemy(), weapon, {id:'test_slash',type:'swordSlash',damageMultiplier:1,pierce:3,range:300});
  assert.equal(profileDamage, 140, 'profile attacks carry the same one-attack kinetic snapshot');
  assert.equal(scene.skillSystem.passiveState.superSpeed.kineticReady, false);
}

// Removing super speed clears the kinetic state and old Lv6 wait-cut never changes the attack timer.
{
  const scene = makeScene();
  setSkills(scene, [['super_speed', 6]]);
  scene.combatSystem.nextPlayerAttackAt = 5000;
  enterHighSpeed(scene);
  update(scene, 1100);
  assert.equal(scene.combatSystem.nextPlayerAttackAt, 5000);
  scene.skillSystem.removeSkillRuntime('super_speed');
  assert.equal(scene.skillSystem.passiveState.superSpeed, undefined);
}

console.log('v0.11.00 superhero kinetic enhancement validation passed');
