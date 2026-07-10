import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';
import { CombatEvents } from '../../core/CombatEvents.js';
import { CULTIVATION_THRESHOLDS, getCultivationSnapshot, grantCultivation } from './CultivationCoreSkill.js';

export const ALCHEMY_ID = 'alchemy';
export const MATERIAL_MULTIPLIERS = [1, 1.1, 1.2, 1.35, 1.5, 1.7, 1.9, 2.15, 2.5];
export const CRAFT_DURATIONS_MS = [1500, 1400, 1300, 1200, 1100, 1000, 900, 800, 700];
export const PILL_RECIPES = [
  { realm:'炼气', id:'qi', name:'聚气丹', short:'聚气', bone:12, blood:8, cultivation:25 },
  { realm:'筑基', id:'foundation', name:'筑基丹', short:'筑基', bone:40, blood:30, cultivation:100 },
  { realm:'金丹', id:'golden_core', name:'金元丹', short:'金元', bone:150, blood:110, cultivation:400 },
  { realm:'元婴', id:'nascent', name:'婴元丹', short:'婴元', bone:800, blood:600, cultivation:1500 },
  { realm:'化神', id:'spirit', name:'化神丹', short:'化神', bone:5000, blood:4000, cultivation:8000 },
  { realm:'炼虚', id:'void', name:'炼虚丹', short:'炼虚', bone:50000, blood:40000, cultivation:60000 },
  { realm:'合体', id:'union', name:'合道丹', short:'合道', bone:1000000, blood:800000, cultivation:1000000 },
  { realm:'大乘', id:'mahayana', name:'大乘仙丹', short:'大乘', bone:30000000, blood:24000000, cultivation:10000000 },
];
export const TRIBULATION_PILL = { realm:'渡劫', id:'tribulation', name:'渡劫仙丹', short:'仙丹', bone:30000000, blood:24000000, cultivation:0, tribulation:true };

const MAX_MATERIAL_VISUALS = 20;
const stateOf = system => system?.passiveState?.alchemy;
const systemOf = sceneOrSystem => sceneOrSystem?.skillSystem || sceneOrSystem;
const levelOf = system => Math.max(0, Math.min(9, Number(system?.getLevel?.(ALCHEMY_ID)) || 0));
const clean = value => Math.max(0, Math.floor(Number(value) || 0));
const finiteCoordinate = value => Number.isFinite(Number(value));

function destroy(object) { object?.destroy?.(); }
function removeTween(tween) { tween?.stop?.(); tween?.remove?.(); tween?.destroy?.(); }
function untrackTween(state, tween) { if (state && tween) state.tweens = state.tweens.filter(item => item !== tween); }
function createTrackedTween(scene, state, config, onDone) {
  if (!scene?.tweens?.add) { onDone?.(); return null; }
  let tween = null;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onDone?.();
    if (tween) untrackTween(state, tween);
  };
  tween = scene.tweens.add({ ...config, onComplete:finish, onStop:finish });
  if (tween && !finished) state.tweens.push(tween);
  return tween;
}
function compactNumber(value) {
  const number = clean(value);
  if (number < 1000) return String(number);
  const units = [
    { value:1e9, suffix:'b' },
    { value:1e6, suffix:'m' },
    { value:1e3, suffix:'k' },
  ];
  const unit = units.find(item => number >= item.value);
  if (!unit) return String(number);
  const scaled = Math.floor((number / unit.value) * 10) / 10;
  return `${Number.isInteger(scaled) ? scaled : scaled.toFixed(1)}${unit.suffix}`;
}
function remainingCultivationCapacity(snapshot) {
  if (!snapshot?.active || snapshot.isComplete || snapshot.realmIndex >= 8) return 0;
  let remaining = Math.max(0, (CULTIVATION_THRESHOLDS[snapshot.realmIndex] || 0) - (Number(snapshot.progress) || 0));
  for (let index = snapshot.realmIndex + 1; index < CULTIVATION_THRESHOLDS.length; index += 1) remaining += CULTIVATION_THRESHOLDS[index] || 0;
  return remaining;
}
function expectedCultivation(system, baseCultivation) {
  const snapshot = getCultivationSnapshot(system);
  if (!snapshot.active || snapshot.isComplete) return Number(baseCultivation) || 0;
  const state = stateOf(system);
  const nineMultiplier = levelOf(system) >= 9 && (state?.nineTurnCounter || 0) === 8 ? 9 : 1;
  const theoretical = (Number(baseCultivation) || 0) * nineMultiplier * (snapshot.gainMultiplier || 1);
  return Math.min(theoretical, remainingCultivationCapacity(snapshot));
}
function decorateRecipe(system, recipe) {
  if (!recipe) return null;
  const decorated = {
    id:recipe.id,
    name:recipe.name,
    short:recipe.short,
    bone:recipe.bone,
    blood:recipe.blood,
    baseCultivation:Number(recipe.baseCultivation ?? recipe.cultivation) || 0,
    tribulation:!!recipe.tribulation,
  };
  Object.defineProperty(decorated, 'cultivation', {
    enumerable:true,
    configurable:false,
    get() {
      const nineMultiplier = levelOf(system) >= 9 && (stateOf(system)?.nineTurnCounter || 0) === 8 ? 9 : 1;
      return nineMultiplier > 0 ? expectedCultivation(system, decorated.baseCultivation) / nineMultiplier : 0;
    },
  });
  return decorated;
}

export function getAlchemyState(sceneOrSystem) { return stateOf(systemOf(sceneOrSystem)) || null; }
export function getAlchemyDaoBuffModifiers(sceneOrSystem) {
  const scene = sceneOrSystem?.scene || sceneOrSystem;
  const state = getAlchemyState(sceneOrSystem);
  const now = scene?.getGameplayTime?.() ?? 0;
  const active = !!(state && (state.alchemyBuffUntil || 0) > now);
  return active
    ? { activeSkillDamageMultiplier:1.2, cultivationSkillDamageMultiplier:1.5 }
    : { activeSkillDamageMultiplier:1, cultivationSkillDamageMultiplier:1 };
}
export function getAlchemyCultivationDamageMultiplier(sceneOrSystem) { return getAlchemyDaoBuffModifiers(sceneOrSystem).cultivationSkillDamageMultiplier; }
export function getAlchemyRecipe(sceneOrSystem) {
  const system = systemOf(sceneOrSystem);
  const snapshot = getCultivationSnapshot(system);
  let recipe = PILL_RECIPES[0];
  if (snapshot.active && (snapshot.isComplete || snapshot.realmIndex >= 8)) recipe = TRIBULATION_PILL;
  else if (snapshot.active) recipe = PILL_RECIPES[Math.max(0, Math.min(PILL_RECIPES.length - 1, snapshot.realmIndex || 0))];
  return decorateRecipe(system, recipe);
}
export function alchemyEnemyMaterials(enemy = {}) {
  const enemyLevel = Math.max(1, Math.floor(Number(enemy.level) || 1));
  let bone = 2;
  let blood = 1;
  let type = 'normal';
  if (enemy.isFinalBoss) { bone = 200; blood = 160; type = 'finalBoss'; }
  else if (enemy.isMidBoss || enemy.isBoss) { bone = 60; blood = 45; type = 'midBoss'; }
  else if (enemy.isElite) { bone = 12; blood = 8; type = 'elite'; }
  return { type, enemyLevel, bone:bone * enemyLevel, blood:blood * enemyLevel };
}
export function applyAlchemyMaterialMultiplier(base, skillLevel, kind, enemyType) {
  const level = Math.max(1, Math.min(9, skillLevel || 1));
  let value = (Number(base) || 0) * MATERIAL_MULTIPLIERS[level - 1];
  if (kind === 'blood' && level >= 3 && ['elite', 'midBoss', 'finalBoss'].includes(enemyType)) value *= 1.5;
  const output = Math.floor(value);
  return base > 0 ? Math.max(1, output) : 0;
}

function ensure(system) {
  if (levelOf(system) <= 0) return null;
  let state = stateOf(system);
  if (state) return state;
  state = {
    boneEssence:0,
    bloodEssence:0,
    crafting:false,
    currentPillId:null,
    currentRecipe:null,
    lastCompletedPillId:null,
    lastCompletedPillName:null,
    craftProgressMs:0,
    craftDurationMs:1500,
    batchCount:0,
    nineTurnCounter:0,
    lastGameplayAt:system.scene?.getGameplayTime?.() ?? 0,
    alchemyBuffUntil:0,
    cauldronVisual:null,
    cauldronPot:null,
    cauldronGlow:null,
    cauldronSmoke:null,
    cauldronProgressText:null,
    cauldronNodes:[],
    materialVisuals:[],
    pillVisuals:[],
    nineTurnVisuals:[],
    timers:[],
    tweens:[],
    updater:null,
    listener:null,
    completedPills:0,
    lastCultivationGranted:0,
    lastCraftCancelled:null,
  };
  system.passiveState.alchemy = state;
  createCauldron(system, state);
  return state;
}
function canAdvance(system) {
  const scene = system?.scene;
  return !scene?.isGameplayPaused?.() && (scene?.playerData?.hp ?? 1) > 0;
}
function convertForLv6(state, recipe) {
  const needBone = Math.max(0, recipe.bone - state.boneEssence);
  const needBlood = Math.max(0, recipe.blood - state.bloodEssence);
  if (needBone > 0 && needBlood > 0) return false;
  if (needBlood > 0 && state.boneEssence >= recipe.bone + needBlood * 2) {
    state.boneEssence -= needBlood * 2;
    state.bloodEssence += needBlood;
    return true;
  }
  if (needBone > 0 && state.bloodEssence >= recipe.blood + needBone * 2) {
    state.bloodEssence -= needBone * 2;
    state.boneEssence += needBone;
    return true;
  }
  return needBone === 0 && needBlood === 0;
}
function cancelCraft(state) {
  state.crafting = false;
  state.currentPillId = null;
  state.currentRecipe = null;
  state.craftProgressMs = 0;
  updateCauldronVisual(state);
}
function tryStart(system) {
  const state = ensure(system);
  if (!state || state.crafting) return false;
  const recipe = getAlchemyRecipe(system);
  if (levelOf(system) >= 6) convertForLv6(state, recipe);
  if (state.boneEssence < recipe.bone || state.bloodEssence < recipe.blood) return false;
  state.crafting = true;
  state.currentPillId = recipe.id;
  state.currentRecipe = recipe;
  state.craftProgressMs = 0;
  state.craftDurationMs = CRAFT_DURATIONS_MS[levelOf(system) - 1] || 1500;
  state.lastCraftCancelled = null;
  updateCauldronVisual(state);
  return true;
}
function complete(system) {
  const state = stateOf(system);
  const scene = system.scene;
  const recipe = state?.currentRecipe;
  if (!state || !recipe) return;
  if (state.boneEssence < recipe.bone || state.bloodEssence < recipe.blood) {
    state.lastCraftCancelled = 'insufficientMaterials';
    cancelCraft(state);
    scene?.skillBar?.update?.();
    return;
  }
  state.boneEssence -= recipe.bone;
  state.bloodEssence -= recipe.blood;
  state.crafting = false;
  state.craftProgressMs = 0;
  state.currentRecipe = null;
  state.currentPillId = null;
  state.lastCompletedPillId = recipe.id;
  state.lastCompletedPillName = recipe.name;
  state.batchCount += 1;
  state.completedPills += 1;
  state.lastCultivationGranted = 0;
  const nineTurn = levelOf(system) >= 9 && state.nineTurnCounter + 1 >= 9;
  state.nineTurnCounter = nineTurn ? 0 : Math.min(8, state.nineTurnCounter + 1);
  const player = scene.playerData || {};
  const heal = Math.round((player.maxHp || 0) * (recipe.tribulation ? 0.2 : 0.1));
  let actualHeal = 0;
  if (heal > 0) {
    if (scene.healPlayer) actualHeal = scene.healPlayer(heal, 'skill', { skillId:ALCHEMY_ID }) || 0;
    else {
      const before = player.hp || 0;
      player.hp = Math.min(player.maxHp, before + heal);
      actualHeal = player.hp - before;
    }
  }
  if (recipe.tribulation) {
    system.recoverMana?.(player.maxMana || 0);
    state.alchemyBuffUntil = (scene.getGameplayTime?.() ?? 0) + 10000;
  } else {
    system.recoverMana?.(20);
    const baseCultivation = recipe.baseCultivation * (nineTurn ? 9 : 1);
    const result = grantCultivation(system, baseCultivation, { source:ALCHEMY_ID });
    state.lastCultivationGranted = result?.actualAmount || 0;
  }
  showPill(system, state, recipe, nineTurn, actualHeal);
  scene.hud?.update?.();
  scene.skillBar?.update?.();
  updateCauldronVisual(state);
  tryStart(system);
}
function update(system) {
  const state = ensure(system);
  if (!state) return;
  const now = system.scene?.getGameplayTime?.() ?? 0;
  if (!canAdvance(system)) {
    state.lastGameplayAt = now;
    return;
  }
  const elapsed = Math.max(0, now - (state.lastGameplayAt ?? now));
  state.lastGameplayAt = now;
  if (!state.crafting) tryStart(system);
  if (state.crafting) {
    state.craftProgressMs += elapsed;
    if (state.craftProgressMs >= state.craftDurationMs) complete(system);
  }
  syncVisual(system, state);
}
function onKill(system, payload) {
  const state = ensure(system);
  if (!state || !payload?.enemy) return;
  const level = levelOf(system);
  const materials = alchemyEnemyMaterials(payload.enemy);
  state.boneEssence += applyAlchemyMaterialMultiplier(materials.bone, level, 'bone', materials.type);
  state.bloodEssence += applyAlchemyMaterialMultiplier(materials.blood, level, 'blood', materials.type);
  materialVisual(system, state, payload.enemy);
  tryStart(system);
  system.scene?.skillBar?.update?.();
}

function cauldronTarget(system) {
  const player = system.scene?.player || { x:0, y:0, flipX:false };
  const direction = player.flipX ? -1 : 1;
  return { x:(Number(player.x) || 0) - direction * 34, y:(Number(player.y) || 0) - 68 };
}
function createCauldron(system, state) {
  const scene = system.scene;
  if (!scene?.add || state.cauldronVisual) return;
  const container = scene.add.container?.(0, 0)?.setDepth?.(90);
  const glow = scene.add.circle?.(0, 0, 18, 0xa92222, 0.28)?.setVisible?.(false);
  const pot = scene.add.circle?.(0, 0, 12, 0x4b3a31, 0.9);
  const lid = scene.add.rectangle?.(0, -10, 24, 6, 0x6b4c34, 0.95);
  const smoke = scene.add.circle?.(-7, -24, 4, 0xd8d2c5, 0.42)?.setVisible?.(false);
  const progressText = scene.add.text?.(0, -39, '', {
    fontFamily:'Arial', fontSize:'14px', color:'#ffd6a0', stroke:'#000000', strokeThickness:3,
  })?.setOrigin?.(0.5)?.setVisible?.(false);
  const nodes = [glow, pot, lid, smoke, progressText].filter(Boolean);
  container?.add?.(nodes);
  state.cauldronVisual = container || pot;
  state.cauldronPot = pot;
  state.cauldronGlow = glow;
  state.cauldronSmoke = smoke;
  state.cauldronProgressText = progressText;
  state.cauldronNodes = container ? [container] : nodes;
  syncVisual(system, state);
}
function updateCauldronVisual(state) {
  if (!state) return;
  const crafting = !!state.crafting;
  const progress = crafting ? Math.max(0, Math.min(100, Math.floor((state.craftProgressMs / Math.max(1, state.craftDurationMs)) * 100))) : 0;
  state.cauldronPot?.setFillStyle?.(crafting ? 0x8f2c20 : 0x4b3a31, 0.95);
  state.cauldronGlow?.setVisible?.(crafting)?.setAlpha?.(crafting ? 0.25 + (progress % 20) / 100 : 0);
  state.cauldronSmoke?.setVisible?.(crafting)?.setAlpha?.(crafting ? 0.25 + (progress % 30) / 100 : 0);
  state.cauldronProgressText?.setVisible?.(crafting)?.setText?.(crafting ? `${state.currentRecipe?.short || '炼丹'} ${progress}%` : '');
}
function syncVisual(system, state) {
  if (!state?.cauldronVisual) return;
  const target = cauldronTarget(system);
  state.cauldronVisual.setPosition?.(target.x, target.y);
  updateCauldronVisual(state);
}
function materialVisual(system, state, enemy) {
  const scene = system.scene;
  if (!scene?.add || state.materialVisuals.length >= MAX_MATERIAL_VISUALS) return;
  const fallback = system.scene?.player || { x:0, y:0 };
  const startX = finiteCoordinate(enemy?.x) ? Number(enemy.x) : (Number(fallback.x) || 0) + 40;
  const startY = finiteCoordinate(enemy?.y) ? Number(enemy.y) : (Number(fallback.y) || 0) - 90;
  const target = cauldronTarget(system);
  const specs = [
    { kind:'bone', color:0xd9d9d9 },
    { kind:'blood', color:0x8b1f2d },
  ];
  specs.forEach(({ kind, color }) => {
    if (state.materialVisuals.length >= MAX_MATERIAL_VISUALS) return;
    const object = scene.add.circle?.(startX, startY, 4, color, 0.85)?.setDepth?.(95);
    if (!object) return;
    object.alchemyMaterialKind = kind;
    object.alchemyStartX = startX;
    object.alchemyStartY = startY;
    state.materialVisuals.push(object);
    createTrackedTween(scene, state, { targets:object, x:target.x, y:target.y, alpha:0, duration:260 }, () => {
      destroy(object);
      state.materialVisuals = state.materialVisuals.filter(item => item !== object);
    });
  });
}
function showNineTurnVisual(system, state) {
  const scene = system.scene;
  if (!scene?.add) return;
  const target = cauldronTarget(system);
  const marks = [];
  for (let index = 0; index < 9; index += 1) {
    const angle = (Math.PI * 2 * index) / 9;
    const mark = scene.add.circle?.(target.x + Math.cos(angle) * 25, target.y + Math.sin(angle) * 25, 3, 0xff5b32, 0.95)?.setDepth?.(111);
    if (mark) marks.push(mark);
  }
  if (!marks.length) return;
  state.nineTurnVisuals.push(...marks);
  createTrackedTween(scene, state, { targets:marks, alpha:0, scale:1.8, duration:520 }, () => {
    marks.forEach(destroy);
    state.nineTurnVisuals = state.nineTurnVisuals.filter(item => !marks.includes(item));
  });
}
function showPill(system, state, recipe, nineTurn, heal) {
  const scene = system.scene;
  const playerX = Number(scene.player?.x) || 0;
  const playerY = Number(scene.player?.y) || 0;
  scene.floatText?.(playerX, playerY - 120, nineTurn ? '九转丹成' : recipe.name, '#ffd166');
  if (!recipe.tribulation && state.lastCultivationGranted) scene.floatText?.(playerX, playerY - 150, `修为+${Math.floor(state.lastCultivationGranted)}`, '#ffb347');
  if (heal > 0) scene.floatText?.(playerX, playerY - 95, `生命+${heal}`, '#7dff8a');
  scene.floatText?.(playerX, playerY - 70, recipe.tribulation ? '法力全满' : '法力+20', '#66ccff');
  if (nineTurn) showNineTurnVisual(system, state);
  const object = scene.add?.circle?.(cauldronTarget(system).x, cauldronTarget(system).y, 7, nineTurn ? 0xff3322 : 0xffd166, 1)?.setDepth?.(110);
  if (!object) return;
  state.pillVisuals.push(object);
  createTrackedTween(scene, state, { targets:object, x:playerX, y:playerY - 20, alpha:0, duration:420 }, () => {
    destroy(object);
    state.pillVisuals = state.pillVisuals.filter(item => item !== object);
  });
}
function cleanup(system) {
  const state = stateOf(system);
  if (!state) return;
  if (state.listener) system.scene?.eventBus?.off?.(CombatEvents.ENEMY_KILLED, state.listener);
  if (state.updater) system.passiveUpdaters = system.passiveUpdaters.filter(fn => fn !== state.updater);
  [...state.cauldronNodes, ...state.materialVisuals, ...state.pillVisuals, ...state.nineTurnVisuals].forEach(destroy);
  state.timers.forEach(timer => timer?.remove?.(false));
  const activeTweens = [...state.tweens];
  state.tweens = [];
  activeTweens.forEach(removeTween);
  state.materialVisuals = [];
  state.pillVisuals = [];
  state.nineTurnVisuals = [];
  state.cauldronNodes = [];
  delete system.passiveState.alchemy;
}
function setup(system) {
  const state = ensure(system);
  if (!state) return null;
  if (!state.listener) {
    state.listener = payload => onKill(system, payload);
    system.scene?.eventBus?.on?.(CombatEvents.ENEMY_KILLED, state.listener);
  }
  if (!state.updater) state.updater = () => update(system);
  if (!system.passiveUpdaters.includes(state.updater)) system.passiveUpdaters.push(state.updater);
  return state;
}

export const CultivationAlchemySkill = {
  bind(system) { setup(system); return () => cleanup(system); },
  onAcquire(system) { setup(system); },
  cleanup,
  shiftTimers(system, duration, pausedAt) {
    const state = stateOf(system);
    const pausedDuration = Math.max(0, Number(duration) || 0);
    const pauseStart = Number(pausedAt);
    if (!state || pausedDuration <= 0 || !Number.isFinite(pauseStart)) return;
    if ((state.lastGameplayAt ?? pauseStart) <= pauseStart) state.lastGameplayAt = (state.lastGameplayAt ?? pauseStart) + pausedDuration;
    if ((state.alchemyBuffUntil || 0) > pauseStart) state.alchemyBuffUntil += pausedDuration;
  },
  syncAttachedVisuals(system) { const state = stateOf(system); if (state) syncVisual(system, state); },
  getSkillBarState(system) {
    const state = stateOf(system);
    if (!state) return { text:'骨0 血0' };
    if (state.crafting) {
      const recipe = state.currentRecipe || getAlchemyRecipe(system);
      const progress = Math.max(0, Math.min(100, Math.floor((state.craftProgressMs / Math.max(1, state.craftDurationMs)) * 100)));
      return { text:`${recipe.short} ${progress}%` };
    }
    const materials = `骨${compactNumber(state.boneEssence)} 血${compactNumber(state.bloodEssence)}`;
    return { text:levelOf(system) >= 9 ? `${materials} 转${state.nineTurnCounter || 0}/9` : materials };
  },
};

export function configureCultivationAlchemySkill() {
  SKILLS[ALCHEMY_ID] = {
    id:ALCHEMY_ID,
    name:'炼丹术',
    rarity:'EPIC',
    handler:ALCHEMY_ID,
    passive:true,
    maxLevel:9,
    cooldownMs:999999,
    targetType:'passive',
    short:'丹',
    color:0xd89a2e,
    tags:[TAGS.MAGIC, TAGS.CULTIVATION, TAGS.BUILD_CULTIVATION],
    description:'敌人死亡后收集尸骨精华与精血，材料足够时自动炼丹。丹药恢复生命和法力；拥有九转大道时额外增加修为，渡劫后改为渡劫仙丹道韵，所有主动技能伤害提高，修仙技能收益更高。',
    milestones:{
      3:'精血提纯：精英和Boss精血提高50%。',
      6:'血骨相济：当前炉只缺一种材料时按2:1转换补足。',
      9:'九转丹成：每第9炉丹药修为×9。',
    },
    levels:CRAFT_DURATIONS_MS.map((craftDurationMs, index) => ({
      craftDurationMs,
      materialMultiplier:MATERIAL_MULTIPLIERS[index],
      desc:`材料获取×${MATERIAL_MULTIPLIERS[index]}，炼丹时间${craftDurationMs / 1000}秒。`,
    })),
  };
}
