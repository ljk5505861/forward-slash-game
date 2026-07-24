import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS } from '../src/config/tags.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import { GAME_VERSION } from '../src/config/version.js';
import {
  ALCHEMY_ID,
  MATERIAL_MULTIPLIERS,
  TRIBULATION_PILL,
  alchemyEnemyMaterials,
  applyAlchemyMaterialMultiplier,
  getAlchemyCultivationDamageMultiplier,
  getAlchemyDaoBuffModifiers,
  getAlchemyState,
} from '../src/skills/handlers/CultivationAlchemySkill.js';
import { CULTIVATION_THRESHOLDS } from '../src/skills/handlers/CultivationCoreSkill.js';
import { getSkillBarStateText } from '../src/ui/skillBarState.js';
import { getSkillDetailData } from '../src/ui/skillDetailContent.js';

class Bus {
  constructor() { this.listeners = new Map(); }
  on(event, fn) { this.listeners.set(event, [...(this.listeners.get(event) || []), fn]); }
  off(event, fn) { this.listeners.set(event, (this.listeners.get(event) || []).filter(item => item !== fn)); }
  emit(event, payload) { for (const fn of this.listeners.get(event) || []) fn(payload); }
}
function visualNode(kind, props = {}) {
  return {
    kind,
    ...props,
    visible:true,
    alpha:props.alpha ?? 1,
    destroyed:false,
    children:[],
    setDepth(value) { this.depth = value; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setStrokeStyle() { return this; },
    setOrigin() { return this; },
    setVisible(value) { this.visible = value; return this; },
    setFillStyle(color, alpha = 1) { this.fillColor = color; this.alpha = alpha; return this; },
    setAlpha(value) { this.alpha = value; return this; },
    setText(value) { this.text = value; return this; },
    add(items) { this.children.push(...(Array.isArray(items) ? items : [items])); return this; },
    destroy() { this.destroyed = true; },
  };
}
function createScene(skills = [], { autoCompleteTweens = true } = {}) {
  const scene = {
    now:0,
    paused:false,
    player:{ x:100, y:200, flipX:false },
    playerData:{ hp:50, maxHp:100, mana:0, maxMana:100, skills },
    eventBus:new Bus(),
    heals:[],
    floats:[],
    visualNodes:[],
    tweenRecords:[],
    isGameplayPaused() { return this.paused; },
    getGameplayTime() { return this.now; },
    healPlayer(amount) {
      const before = this.playerData.hp;
      this.playerData.hp = Math.min(this.playerData.maxHp, before + amount);
      const actual = this.playerData.hp - before;
      this.heals.push(actual);
      return actual;
    },
    floatText(...args) { this.floats.push(args); },
    hud:{ update() {} },
    skillBar:{ update() {} },
    events:{ on() {}, once() {}, off() {} },
  };
  const addNode = (kind, props) => {
    const node = visualNode(kind, props);
    scene.visualNodes.push(node);
    return node;
  };
  scene.add = {
    container:(x = 0, y = 0) => addNode('container', { x, y }),
    circle:(x, y, radius, fillColor, alpha) => addNode('circle', { x, y, radius, fillColor, alpha }),
    rectangle:(x, y, width, height, fillColor, alpha) => addNode('rectangle', { x, y, width, height, fillColor, alpha }),
    text:(x, y, text, style) => addNode('text', { x, y, text, style }),
  };
  scene.tweens = {
    add(config) {
      const record = {
        config,
        completed:false,
        stopped:false,
        removed:false,
        destroyed:false,
        complete() {
          if (this.completed || this.stopped) return;
          this.completed = true;
          config.onComplete?.();
        },
        stop() {
          if (this.completed || this.stopped) return;
          this.stopped = true;
          config.onStop?.();
        },
        remove() { this.removed = true; },
        destroy() { this.destroyed = true; },
      };
      scene.tweenRecords.push(record);
      if (autoCompleteTweens) record.complete();
      return record;
    },
  };
  scene.skillSystem = new SkillSystem(scene);
  return scene;
}
function own(scene, id = ALCHEMY_ID, level = 1) {
  const existing = scene.playerData.skills.find(item => item.id === id);
  if (existing) existing.level = level;
  else scene.playerData.skills.push({ id, level });
  scene.skillSystem.ensurePassiveBound(id);
}
function tick(scene, milliseconds) {
  scene.now += milliseconds;
  scene.skillSystem.update(scene.now);
}
function completeTweens(scene) { [...scene.tweenRecords].forEach(tween => tween.complete()); }
function detailLine(detail, prefix) { return detail.currentEffects.find(line => line.startsWith(prefix)); }

assert.equal(GAME_VERSION, '0.11.7');
assert.equal(Object.keys(SKILLS).length, 43);
const config = SKILLS[ALCHEMY_ID];
assert.equal(config.rarity, 'EPIC');
assert.equal(config.passive, true);
assert.equal(config.maxLevel, 9);
assert(!config.prerequisite && !config.requires);
assert(config.tags.includes(TAGS.CULTIVATION));
assert(config.tags.includes(TAGS.BUILD_CULTIVATION));
for (const id of ['mitian_handprint',  'one_qi_three_purities']) assert(!SKILLS[id]);

for (const [enemy, bone, blood] of [
  [{ level:3 }, 6, 3],
  [{ level:3, isElite:true }, 36, 24],
  [{ level:3, isMidBoss:true }, 180, 135],
  [{ level:3, isBoss:true }, 180, 135],
  [{ level:3, isFinalBoss:true }, 600, 480],
]) {
  const materials = alchemyEnemyMaterials(enemy);
  assert.equal(materials.bone, bone);
  assert.equal(materials.blood, blood);
}
for (let level = 1; level <= 9; level += 1) assert.equal(applyAlchemyMaterialMultiplier(100, level, 'bone', 'normal'), Math.floor(100 * MATERIAL_MULTIPLIERS[level - 1]));
assert.equal(applyAlchemyMaterialMultiplier(8, 3, 'blood', 'elite'), Math.floor(8 * 1.2 * 1.5));
assert.equal(applyAlchemyMaterialMultiplier(1, 3, 'blood', 'normal'), 1);

let scene = createScene();
own(scene, ALCHEMY_ID, 1);
let state = getAlchemyState(scene);
scene.eventBus.emit(CombatEvents.ENEMY_KILLED, { enemy:{ level:1 } });
assert.equal(state.crafting, false);
state.boneEssence = 12;
state.bloodEssence = 8;
tick(scene, 1);
assert.equal(state.crafting, true);
assert.equal(state.cauldronPot.fillColor, 0x8f2c20);
assert.equal(state.cauldronProgressText.visible, true);
assert.match(state.cauldronProgressText.text, /^聚气 0%$/);
tick(scene, 750);
assert.match(state.cauldronProgressText.text, /^聚气 50%$/);
tick(scene, 750);
assert.equal(state.completedPills, 1);
assert.equal(state.boneEssence, 0);
assert.equal(state.bloodEssence, 0);
assert(scene.heals.at(-1) > 0);
assert(scene.playerData.mana >= 20);
assert.equal(state.lastCultivationGranted, 0);
assert.equal(state.cauldronProgressText.visible, false);

scene = createScene([{ id:'ninefold_dao', level:1 }]);
scene.skillSystem.ensurePassiveBound('ninefold_dao');
own(scene, ALCHEMY_ID, 1);
state = getAlchemyState(scene);
state.boneEssence = 24;
state.bloodEssence = 16;
tick(scene, 1);
tick(scene, 1500);
assert.equal(state.completedPills, 1);
assert.equal(state.crafting, true, 'auto continues with remaining recipe');
assert.equal(state.lastCultivationGranted, 25);

scene = createScene([{ id:'ninefold_dao', level:1 }]);
scene.skillSystem.ensurePassiveBound('ninefold_dao');
scene.skillSystem.passiveState.ninefoldDao.realmIndex = 8;
own(scene, ALCHEMY_ID, 9);
state = getAlchemyState(scene);
state.boneEssence = TRIBULATION_PILL.bone;
state.bloodEssence = TRIBULATION_PILL.blood;
tick(scene, 1);
tick(scene, 700);
assert.equal(state.completedPills, 1);
assert.equal(state.lastCultivationGranted, 0);
assert.equal(scene.playerData.mana, scene.playerData.maxMana);
assert.deepEqual(getAlchemyDaoBuffModifiers(scene), { activeSkillDamageMultiplier:1.2, cultivationSkillDamageMultiplier:1.5 });
assert.equal(getAlchemyCultivationDamageMultiplier(scene), 1.5);

tick(scene, 3000);
const pauseStartedAt = scene.now;
const remainingBeforePause = state.alchemyBuffUntil - pauseStartedAt;
assert.equal(remainingBeforePause, 7000);
scene.paused = true;
scene.now += 10000;
scene.skillSystem.shiftTimers(10000, pauseStartedAt);
assert.equal(state.alchemyBuffUntil - scene.now, 7000);
assert.deepEqual(getAlchemyDaoBuffModifiers(scene), { activeSkillDamageMultiplier:1.2, cultivationSkillDamageMultiplier:1.5 });
scene.paused = false;
tick(scene, 6999);
assert.equal(getAlchemyDaoBuffModifiers(scene).activeSkillDamageMultiplier, 1.2);
tick(scene, 1);
assert.deepEqual(getAlchemyDaoBuffModifiers(scene), { activeSkillDamageMultiplier:1, cultivationSkillDamageMultiplier:1 });

scene = createScene([{ id:'ninefold_dao', level:1 }]);
scene.skillSystem.ensurePassiveBound('ninefold_dao');
scene.skillSystem.passiveState.ninefoldDao.realmIndex = 1;
own(scene, ALCHEMY_ID, 6);
state = getAlchemyState(scene);
state.boneEssence = 60;
state.bloodEssence = 20;
tick(scene, 1);
assert.equal(state.crafting, true);
assert.equal(state.boneEssence, 40);
assert.equal(state.bloodEssence, 30);

scene = createScene([{ id:'ninefold_dao', level:1 }]);
scene.skillSystem.ensurePassiveBound('ninefold_dao');
scene.skillSystem.passiveState.ninefoldDao.realmIndex = 1;
own(scene, ALCHEMY_ID, 6);
state = getAlchemyState(scene);
state.boneEssence = 30;
state.bloodEssence = 50;
tick(scene, 1);
assert.equal(state.crafting, true);
assert.equal(state.boneEssence, 40);
assert.equal(state.bloodEssence, 30);

scene = createScene([{ id:'ninefold_dao', level:1 }]);
scene.skillSystem.ensurePassiveBound('ninefold_dao');
scene.skillSystem.passiveState.ninefoldDao.realmIndex = 1;
own(scene, ALCHEMY_ID, 6);
state = getAlchemyState(scene);
state.boneEssence = 50;
state.bloodEssence = 20;
tick(scene, 1);
assert.equal(state.crafting, false);

scene = createScene([{ id:'ninefold_dao', level:1 }], { autoCompleteTweens:false });
scene.skillSystem.ensurePassiveBound('ninefold_dao');
own(scene, ALCHEMY_ID, 9);
state = getAlchemyState(scene);
state.nineTurnCounter = 8;
state.boneEssence = 12;
state.bloodEssence = 8;
tick(scene, 1);
tick(scene, 700);
assert.equal(state.nineTurnCounter, 0);
assert.equal(state.lastCultivationGranted, 225);
assert.equal(state.nineTurnVisuals.length, 9);
assert.equal(state.pillVisuals.length, 1);
completeTweens(scene);
assert.equal(state.nineTurnVisuals.length, 0);
assert.equal(state.pillVisuals.length, 0);
assert.equal(state.tweens.length, 0);

scene = createScene([], { autoCompleteTweens:false });
own(scene, ALCHEMY_ID, 1);
state = getAlchemyState(scene);
scene.eventBus.emit(CombatEvents.ENEMY_KILLED, { enemy:{ level:1, x:500, y:400 } });
assert.equal(state.materialVisuals.length, 2);
assert(state.materialVisuals.every(item => item.alchemyStartX === 500 && item.alchemyStartY === 400));
assert.deepEqual(state.materialVisuals.map(item => item.alchemyMaterialKind).sort(), ['blood', 'bone']);
assert.notEqual(state.materialVisuals[0].fillColor, state.materialVisuals[1].fillColor);
completeTweens(scene);
assert.equal(state.materialVisuals.length, 0);
assert.equal(state.tweens.length, 0);

scene = createScene();
own(scene, ALCHEMY_ID, 1);
state = getAlchemyState(scene);
for (let index = 0; index < 100; index += 1) scene.eventBus.emit(CombatEvents.ENEMY_KILLED, { enemy:{ level:1, x:300 + index, y:350 } });
assert.equal(state.materialVisuals.length, 0);
assert.equal(state.tweens.length, 0);

scene = createScene();
own(scene, ALCHEMY_ID, 1);
state = getAlchemyState(scene);
state.boneEssence = 12;
state.bloodEssence = 8;
tick(scene, 1);
scene.paused = true;
tick(scene, 5000);
assert(state.craftProgressMs < 1500);
scene.paused = false;
tick(scene, 1);
assert(state.craftProgressMs < 10, 'no pause catch-up');
scene.playerData.hp = 0;
tick(scene, 5000);
assert(state.craftProgressMs < 1500);
scene.skillSystem.removeSkillRuntime(ALCHEMY_ID);
assert.equal(getAlchemyState(scene), null);
own(scene, ALCHEMY_ID, 1);
assert.equal(getAlchemyState(scene).boneEssence, 0);
scene.eventBus.emit(CombatEvents.ENEMY_KILLED, { enemy:{ level:6 } });
assert.equal(getAlchemyState(scene).boneEssence, 12, 'single listener after rebinding');

scene = createScene([{ id:'ninefold_dao', level:1 }]);
scene.skillSystem.ensurePassiveBound('ninefold_dao');
own(scene, ALCHEMY_ID, 1);
state = getAlchemyState(scene);
state.boneEssence = 52;
state.bloodEssence = 38;
tick(scene, 1);
assert.equal(state.currentRecipe.id, 'qi');
assert.match(getSkillBarStateText(scene, { id:ALCHEMY_ID, level:1 }, config), /^聚气 /);
scene.skillSystem.passiveState.ninefoldDao.realmIndex = 1;
assert.match(getSkillBarStateText(scene, { id:ALCHEMY_ID, level:1 }, config), /^聚气 /);
tick(scene, 1500);
assert.equal(state.lastCompletedPillId, 'qi');
assert.equal(state.boneEssence, 40);
assert.equal(state.bloodEssence, 30);
assert(state.boneEssence >= 0 && state.bloodEssence >= 0);
assert.equal(state.currentRecipe.id, 'foundation');
assert.match(getSkillBarStateText(scene, { id:ALCHEMY_ID, level:1 }, config), /^筑基 /);

scene = createScene();
own(scene, ALCHEMY_ID, 1);
state = getAlchemyState(scene);
state.boneEssence = 12;
state.bloodEssence = 8;
tick(scene, 1);
state.bloodEssence = 0;
const healsBefore = scene.heals.length;
const manaBefore = scene.playerData.mana;
const completedBefore = state.completedPills;
tick(scene, 1500);
assert.equal(state.completedPills, completedBefore);
assert.equal(scene.heals.length, healsBefore);
assert.equal(state.bloodEssence, 0);
assert(state.boneEssence >= 0);
assert.equal(state.crafting, false);
assert.equal(state.lastCraftCancelled, 'insufficientMaterials');
assert.equal(state.lastCompletedPillId, null);
assert(scene.playerData.mana >= manaBefore);

scene = createScene();
own(scene, ALCHEMY_ID, 9);
state = getAlchemyState(scene);
state.boneEssence = 126;
state.bloodEssence = 84;
state.nineTurnCounter = 7;
assert.equal(getSkillBarStateText(scene, { id:ALCHEMY_ID, level:9 }, config), '骨126 血84 转7/9');
state.boneEssence = 30000000;
state.bloodEssence = 24000000;
const largeText = getSkillBarStateText(scene, { id:ALCHEMY_ID, level:9 }, config);
assert.equal(largeText, '骨30m 血24m 转7/9');
assert(!largeText.endsWith('/'));

scene = createScene([{ id:'ninefold_dao', level:6 }]);
scene.skillSystem.ensurePassiveBound('ninefold_dao');
own(scene, ALCHEMY_ID, 1);
state = getAlchemyState(scene);
let before = JSON.stringify(state);
let detail = getSkillDetailData(ALCHEMY_ID, { scene, skill:{ id:ALCHEMY_ID, level:1 } });
assert.equal(detailLine(detail, '当前境界：'), '当前境界：炼气，本炉实际修为+31.25');
assert.equal(JSON.stringify(state), before, 'detail is read only');

scene.skillSystem.passiveState.ninefoldDao.realmIndex = 7;
scene.skillSystem.passiveState.ninefoldDao.breakthroughCount = 7;
scene.skillSystem.passiveState.ninefoldDao.progress = CULTIVATION_THRESHOLDS[7] - 100;
before = JSON.stringify(state);
detail = getSkillDetailData(ALCHEMY_ID, { scene, skill:{ id:ALCHEMY_ID, level:1 } });
assert.equal(detailLine(detail, '当前境界：'), '当前境界：大乘，本炉实际修为+100');
assert.equal(JSON.stringify(state), before, 'capacity detail remains read only');

console.log('validate-01102-alchemy passed');
