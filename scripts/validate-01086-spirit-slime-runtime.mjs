import assert from 'node:assert/strict';
import { SKILLS } from '../src/config/skills.js';
import { createPlayerRuntime, getEffectiveAttack, getEffectiveDefense } from '../src/config/balance.js';
import { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { SpiritSlimeSkill } from '../src/skills/handlers/SpiritSlimeSkill.js';
import { SpiritWolvesSkill } from '../src/skills/handlers/SpiritWolvesSkill.js';
import { SpiritBirdSkill } from '../src/skills/handlers/SpiritBirdSkill.js';
import { PoisonKingSkillWithSpiritSlime, correctedPoisonKingGrowthHp } from '../src/skills/handlers/PoisonKingSpiritSlimeCompat.js';
class Bus {
constructor() { this.listeners = new Map(); }
on(type, fn) {
const list = this.listeners.get(type) || [];
list.push(fn);
this.listeners.set(type, list);
return () => {
const current = this.listeners.get(type) || [];
this.listeners.set(type, current.filter(listener => listener !== fn));
};
}
once(type, fn) {
const off = this.on(type, payload => { off(); fn(payload); });
return off;
}
off(type, fn) {
const list = this.listeners.get(type) || [];
this.listeners.set(type, list.filter(listener => listener !== fn));
}
emit(type, payload) {
for (const fn of [...(this.listeners.get(type) || [])]) fn(payload);
}
}
function displayObject(x = 0, y = 0) {
return {
x,
y,
active: true,
visible: true,
scale: 1,
destroy() { this.active = false; },
setStrokeStyle() { return this; },
setDepth() { return this; },
setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
setScale(value) { this.scale = value; return this; },
setOrigin() { return this; },
setDisplaySize(width, height) { this.displayWidth = width; this.displayHeight = height; return this; },
setVisible(value) { this.visible = value; return this; },
add(children) { this.children = children; return this; }
};
}
function makeScene() {
const created = [];
const destroyed = [];
const eventBus = new Bus();
const events = new Bus();
const scene = {
now: 0,
player: { x: 100, y: 200, height: 80, groundY: 200 },
playerData: createPlayerRuntime(),
enemies: [],
eventBus,
events,
combatLog: [],
poisonLog: [],
healLog: [],
balance: { groundTopY: 240 },
cameras: { main: { worldView: { left: 0, right: 1000, x: 0, width: 1000 } } },
targeting: {
valid(enemy) { return !!enemy && enemy.active !== false && !enemy.isDefeated && enemy.hp > 0; },
isEnemyFullyInsideViewport() { return true; },
all() { return scene.enemies.filter(enemy => this.valid(enemy)); }
},
combatSystem: {
damageEnemy(enemy, damage, meta = {}) {
scene.combatLog.push({ enemy, damage, meta });
enemy.hp = Math.max(0, enemy.hp - damage);
return true;
}
},
statusEffects: {
has(enemy, type) { return !!enemy.statuses?.has(type); },
add(type, enemy, data) {
scene.poisonLog.push({ type, enemy, data });
enemy.statuses ??= new Set();
enemy.statuses.add(type);
return data;
}
},
add: {
circle(x, y) { const object = displayObject(x, y); created.push(object); return object; },
ellipse(x, y) { const object = displayObject(x, y); created.push(object); return object; },
rectangle(x, y) { const object = displayObject(x, y); created.push(object); return object; },
container(x, y) { const object = displayObject(x, y); created.push(object); return object; },
line(x, y) { const object = displayObject(x, y); created.push(object); return object; }
},
tweens: {
add(config) {
const tween = { removed: false, remove() { this.removed = true; } };
if (config.duration === 260 && config.targets && 'x' in config) {
config.targets.x = config.x;
config.targets.y = config.y;
}
config.onComplete?.();
return tween;
}
},
getGameplayTime() { return this.now; },
isGameplayPaused() { return false; },
floatText() {},
healPlayer(amount) {
const rounded = Math.max(0, Math.round(amount));
const before = this.playerData.hp;
this.playerData.hp = Math.min(this.playerData.maxHp, before + rounded);
const actual = this.playerData.hp - before;
this.healLog.push({ amount: rounded, actual });
return actual;
}
};
const system = {
scene,
passiveState: {},
passiveUpdaters: [],
cooldowns: new Map(),
getLevel(id) {
return scene.playerData.skills.find(skill => skill.id === id)?.level || 0;
},
getData(id, level = this.getLevel(id)) {
return SKILLS[id]?.levels?.[level - 1];
}
};
scene.skillSystem = system;
return { scene, system, created, destroyed };
}
function tick(environment, milliseconds = 16, count = 1) {
for (let index = 0; index < count; index += 1) {
environment.scene.now += milliseconds;
for (const updater of [...environment.system.passiveUpdaters]) updater();
}
}
let environment = makeScene();
let disposeSlime = SpiritSlimeSkill.bind(environment.system);
const initialAttack = getEffectiveAttack(environment.scene.playerData);
const initialMaxHp = environment.scene.playerData.maxHp;
const initialDefense = getEffectiveDefense(environment.scene.playerData);
tick(environment, 1000, 5);
assert.equal(environment.scene.spiritSlimeRuntime.getMode(), 'inactive');
assert.equal(environment.created.length, 0);
assert.equal(getEffectiveAttack(environment.scene.playerData), initialAttack);
assert.equal(environment.scene.playerData.maxHp, initialMaxHp);
assert.equal(getEffectiveDefense(environment.scene.playerData), initialDefense);
assert.equal(environment.scene.combatLog.length, 0);
environment.scene.playerData.baseAttack = 100;
environment.scene.playerData.attack = 100;
environment.scene.playerData.baseMaxHp = 500;
environment.scene.playerData.maxHp = 500;
environment.scene.playerData.hp = 250;
environment.scene.playerData.baseDefense = 0;
environment.scene.playerData.defense = 0;
environment.scene.playerData.skills.push({ id: 'spirit_slime', level: 1 });
tick(environment, 1);
assert.equal(environment.scene.spiritSlimeRuntime.getMode(), 'companion');
assert.equal(getEffectiveAttack(environment.scene.playerData), 105);
assert.equal(environment.scene.playerData.maxHp, 525);
assert.equal(environment.scene.playerData.hp, 263);
assert.equal(getEffectiveDefense(environment.scene.playerData), 1);
const companionVisual = environment.scene.spiritSlimeRuntime._state.companionVisual;
tick(environment, 16, 100);
assert.equal(environment.scene.spiritSlimeRuntime._state.companionVisual, companionVisual);
environment.scene.enemies = [{ x: 200, y: 200, hp: 1000, active: true }];
tick(environment, 300);
assert.equal(environment.scene.combatLog.length, 1);
assert.equal(environment.scene.combatLog[0].damage, 21);
assert.equal(environment.scene.combatLog[0].meta.crit, false);
assert.equal(environment.scene.combatLog[0].meta.allowLifeSteal, false);
assert.equal(environment.scene.combatLog[0].meta.canTriggerArtifacts, false);
assert.equal(environment.scene.combatLog[0].meta.noKnockback, true);
assert(!('noDeathExplosion' in environment.scene.combatLog[0].meta));
assert(!('noPoisonSpread' in environment.scene.combatLog[0].meta));
const kingTarget = { type: 'poison_king', hp: 100, maxHp: 100, baseMaxHp: 100, view: displayObject(120, 190) };
const wolf0 = { type: 'spiritWolf', index: 0, hp: 100, maxHp: 100, baseMaxHp: 100, x: 130, y: 200, isAlive() { return this.hp > 0; } };
const wolf1 = { type: 'spiritWolf', index: 1, hp: 100, maxHp: 100, baseMaxHp: 100, x: 140, y: 200, isAlive() { return this.hp > 0; } };
const birdTarget = { type: 'spirit_bird', hp: 100, maxHp: 100, baseMaxHp: 100, x: 90, y: 200, visualY: 100, isAlive() { return this.hp > 0; } };
environment.scene.poisonKingRuntime = { get: () => kingTarget };
environment.system.passiveState.spiritWolves = { wolves: [wolf1, wolf0] };
environment.scene.spiritBirdRuntime = { get: () => birdTarget };
environment.scene.playerData.skills[0].level = 3;
environment.scene.spiritSlimeRuntime.refresh();
assert.deepEqual(environment.scene.spiritSlimeRuntime.getAttachedTargets(), [kingTarget, wolf0]);
environment.scene.playerData.skills[0].level = 9;
environment.scene.spiritSlimeRuntime.refresh();
assert.deepEqual(environment.scene.spiritSlimeRuntime.getAttachedTargets(), [kingTarget, wolf0, wolf1, birdTarget]);
assert.equal(environment.system.passiveUpdaters.length, 1);
disposeSlime();
assert.equal(environment.system.passiveUpdaters.length, 0);
assert.equal(environment.scene.spiritSlimeRuntime, null);
disposeSlime = SpiritSlimeSkill.bind(environment.system);
assert.equal(environment.system.passiveUpdaters.length, 1);
disposeSlime();
environment = makeScene();
environment.scene.playerData.baseAttack = 400;
environment.scene.playerData.attack = 400;
environment.scene.playerData.baseMaxHp = 1000;
environment.scene.playerData.maxHp = 1000;
environment.scene.playerData.baseDefense = 100;
environment.scene.playerData.skills.push(
{ id: 'spirit_wolves', level: 6 },
{ id: 'spirit_slime', level: 6 }
);
const offWolves = SpiritWolvesSkill.bind(environment.system);
const offWolfSlime = SpiritSlimeSkill.bind(environment.system);
SpiritWolvesSkill.cast(
environment.system,
SKILLS.spirit_wolves,
SKILLS.spirit_wolves.levels[5],
6
);
const wolves = environment.system.passiveState.spiritWolves.wolves;
const wolf = wolves[0];
const unusedWolf = wolves[1];
unusedWolf.hp = 0;
unusedWolf.destroyed = true;
unusedWolf.view.active = false;
const primary = { x: wolf.x + 10, y: wolf.y, hp: 1000, active: true };
const nearby = { x: wolf.x + 50, y: wolf.y, hp: 1000, active: true };
environment.scene.enemies = [primary, nearby];
environment.scene.spiritSlimeRuntime.refresh();
environment.scene.combatLog = [];
tick(environment, 1);
const melee = environment.scene.combatLog.find(entry => entry.meta.damageKind === 'summonMelee');
const splash = environment.scene.combatLog.find(entry => entry.meta.damageKind === 'summonSplash');
assert.equal(melee.damage, 150);
assert.equal(splash.damage, 53);
environment.scene.combatLog = [];
wolf.takeDamage(99999);
const bursts = environment.scene.combatLog.filter(entry => entry.meta.damageKind === 'summonDeathBurst');
assert(bursts.length >= 1);
assert(bursts.every(entry => entry.damage === 120));
offWolfSlime();
offWolves();
environment = makeScene();
environment.scene.playerData.baseMaxHp = 1000;
environment.scene.playerData.maxHp = 1000;
environment.scene.playerData.hp = 500;
environment.scene.playerData.baseDefense = 100;
environment.scene.playerData.skills.push(
{ id: 'spirit_bird', level: 1 },
{ id: 'spirit_slime', level: 1 }
);
const offBird = SpiritBirdSkill.bind(environment.system);
const offBirdSlime = SpiritSlimeSkill.bind(environment.system);
SpiritBirdSkill.cast(
environment.system,
SKILLS.spirit_bird,
SKILLS.spirit_bird.levels[0],
1
);
environment.scene.spiritSlimeRuntime.refresh();
const bird = environment.scene.spiritBirdRuntime.get();
assert.equal(bird.baseMaxHp, 100);
assert.equal(bird.maxHp, 140);
const damageTaken = bird.takeDamage(110);
assert.equal(damageTaken, 85);
const healedBird = bird.heal(20);
assert.equal(healedBird, 24);
bird.hp = bird.maxHp;
bird.nextHealAt = 0;
environment.scene.now = 6000;
environment.scene.healLog = [];
for (const updater of [...environment.system.passiveUpdaters]) updater();
assert.equal(environment.scene.healLog[0].amount, 23);
assert.equal(bird.nextHealAt, 11455);
offBirdSlime();
offBird();
assert.equal(correctedPoisonKingGrowthHp({
oldHp: 90,
oldMaxHp: 180,
oldBaseMaxHp: 180,
newMaxHp: 215,
newBaseMaxHp: 215,
stageGain: 1,
poisonKingLevel: 1
}), 125);
assert.equal(correctedPoisonKingGrowthHp({
oldHp: 126,
oldMaxHp: 252,
oldBaseMaxHp: 180,
newMaxHp: 301,
newBaseMaxHp: 215,
stageGain: 1,
poisonKingLevel: 1
}), 175);
environment = makeScene();
environment.scene.playerData.skills.push({ id: 'poison_king', level: 1 });
let offKing = PoisonKingSkillWithSpiritSlime.bind(environment.system);
let king = environment.scene.poisonKingRuntime.get();
king.hp = 90;
environment.scene.eventBus.emit(CombatEvents.STATUS_TICK, {
type: StatusEffects.POISON,
actualDamage: 205,
effect: { poisonMeta: {} }
});
assert.equal(king.stage, 1);
assert.equal(king.baseMaxHp, 215);
assert.equal(king.maxHp, 215);
assert.equal(king.hp, 125);
offKing();
environment = makeScene();
environment.scene.playerData.skills.push({ id: 'poison_king', level: 1 });
const fullSlimeModifier = {
powerBonus: 0.65,
maxHpBonus: 0.40,
damageReduction: 0.30,
actionSpeedBonus: 0.25,
healingReceivedBonus: 0.50
};
environment.scene.spiritSlimeRuntime = { getModifier: () => fullSlimeModifier };
offKing = PoisonKingSkillWithSpiritSlime.bind(environment.system);
king = environment.scene.poisonKingRuntime.get();
assert.equal(king.maxHp, 252);
king.hp = 126;
environment.scene.eventBus.emit(CombatEvents.STATUS_TICK, {
type: StatusEffects.POISON,
actualDamage: 205,
effect: { poisonMeta: {} }
});
assert.equal(king.stage, 1);
assert.equal(king.baseMaxHp, 215);
assert.equal(king.maxHp, 301);
assert.equal(king.hp, 175);
king.hp = 200;
assert.equal(environment.scene.poisonKingRuntime.getAttackTarget().takeDamage(100), 70);
king.hp = 100;
assert.equal(environment.scene.poisonKingRuntime.getHealingTarget().heal(20), 30);
const biteTarget = { x: 140, y: 180, hp: 1000, active: true, statuses: new Set() };
environment.scene.enemies = [biteTarget];
environment.scene.combatLog = [];
environment.scene.poisonLog = [];
king.nextBiteAt = 0;
environment.scene.now = 1000;
for (const updater of [...environment.system.passiveUpdaters]) updater();
assert.equal(environment.scene.combatLog[0].damage, 56);
assert.equal(environment.scene.poisonLog[0].data.value, 15);
assert.equal(king.nextBiteAt, 1720);
offKing();
console.log('validate-01086-spirit-slime runtime behavior passed');
