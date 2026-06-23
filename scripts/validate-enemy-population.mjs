import { strict as assert } from 'node:assert';
import { BALANCE, createPlayerRuntime } from '../src/config/balance.js';
import { ENEMIES } from '../src/config/enemies.js';
import { WEAPONS } from '../src/config/weapons.js';
import { SKILLS } from '../src/config/skills.js';
import StageSystem, { FLOW_GROUPS, LevelFlowStates } from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';

const RANGED = new Set(['bomber', 'healer']);
const noop = () => {};
const makeNode = (x = 0, y = 0, w = 10, h = 10) => ({
  x, y, width: w, height: h, active: true, isDefeated: false,
  setStrokeStyle(){ return this; }, setDepth(){ return this; }, setOrigin(){ return this; }, setScrollFactor(){ return this; }, setDisplaySize(w2,h2){ this.width=w2; this.height=h2; return this; }, setPosition(x2,y2){ this.x=x2; this.y=y2; return this; }, destroy(){ this.active=false; },
  body: { width: w, height: h, setAllowGravity(){}, setImmovable(){}, setSize(w2,h2){ this.width=w2; this.height=h2; }, setOffset(){}, setVelocityX(){}, reset(x2,y2){ this.owner.x=x2; this.owner.y=y2; }, enable:true }
});
function makeScene(){
  const scene = { balance: BALANCE, scale:{height:1280}, playerData:createPlayerRuntime(), enemies:[], runState:'RUNNING', player:{x:220,y:850}, cameras:{main:{worldView:{right:720}, scrollX:0, width:720, setBounds(){}}}, physics:{world:{setBounds(){}}, add:{existing(o){ o.body.owner=o; }}}, add:{rectangle:(x,y,w,h)=>makeNode(x,y,w,h), text:(x,y)=>makeNode(x,y), circle:(x,y,r)=>makeNode(x,y,r*2,r*2), arc:(x,y,r)=>makeNode(x,y,r*2,r*2)}, tweens:{add({onComplete}={}){ onComplete?.(); }}, eventBus:{events:[], emit(type,payload){ this.events.push({type,payload}); }}, hud:{setStage(v){this.stage=v;}, setStatus(v){this.status=v;}, update(){}}, enemyBehaviors:{attach(){}, update(){}, destroyEnemy(){}}, statusEffects:{clearTarget(){}}, targeting:{valid:e=>!!e&&!e.isDefeated, all(){return scene.enemies.filter(e=>!e.isDefeated);}, isEnemyFullyInsideViewport(){return true;}}, professionSystem:{getDamageMultiplier(){return 1;}, onDirectHit(){}}, artifactSystem:{highHpDamageMultiplier(){return 1;}}, isGameplayPaused(){return false;}, awardGold(){}, floatText(){}, finishRun(){}, runStats:{}, skillSystem:{beforePlayerDamage(){}}, resumeModalFlow:noop };
  return scene;
}
const idsOf = items => items.map(item => item.id);
const assertNoRanged = (ids, label) => assert.deepEqual(ids.filter(id => RANGED.has(id)), [], label);

FLOW_GROUPS.slice(0,3).forEach(group => group.waves.forEach((count, i) => assertNoRanged(idsOf(new StageSystem(makeScene()).makeWaveIds(group.ids[i], count, group.rangedCounts?.[i] ?? 0)), `group ${group.group} wave ${i+1} has no ranged`)));
const later = new StageSystem(makeScene()).makeWaveIds(['elite','grunt','bomber','healer'],8,2);
assert.equal(later.length, 8); assert.equal(later.filter(x=>x.id==='elite').length,1); assert.equal(later.filter(x=>x.id==='healer').length,1); assert(later.some(x=>x.id==='bomber'), 'later stages still allow bomber');

const rushScene = makeScene(); const rush = new StageSystem(rushScene); rush.startRush('boss1'); const oldRandom = Math.random; Math.random = () => 0.999; rush.updateRush(100); Math.random = oldRandom;
assert.equal(rush.waveQueue.length, 10, 'boss1 rush is exactly 10 and random-proof'); assertNoRanged(idsOf(rush.waveQueue), 'boss1 rush has no ranged');
rush.drainWaveQueue(9999); assert.equal(rushScene.enemies.length, 10); rush.updateRush(10000); assert.equal(rush.flowState, LevelFlowStates.BOSS_RUSH, 'boss does not spawn while rush enemies live');
rushScene.enemies.forEach(e => { e.isDefeated = true; }); rush.updateRush(10001); assert.equal(rush.flowState, LevelFlowStates.BOSS_FIGHT); assert.equal(rushScene.enemies.filter(e=>e.isBoss).length, 1); rush.updateRush(10002); assert.equal(rushScene.enemies.filter(e=>e.isBoss).length, 1, 'same boss spawns once');

const spacingScene = makeScene(); const spacingStage = new StageSystem(spacingScene); const spaced = spacingStage.assignWaveSpawnXs([{id:'grunt'},{id:'elite'},{id:'charger'}]);
assert.equal(new Set(spaced.map(i=>i.x)).size, 3, 'three scheduled monsters do not share one spawn X');
for(let i=1;i<spaced.length;i+=1){ const prev=ENEMIES[spaced[i-1].id], cur=ENEMIES[spaced[i].id]; const min=(prev.bodyWidth||prev.width)/2+(cur.bodyWidth||cur.width)/2+10; assert(spaced[i].x-spaced[i-1].x>=min, `spawn spacing ${i} uses half widths plus safety`); }
spaced.forEach(item => { const cfg=ENEMIES[item.id]; const half=(cfg.bodyWidth||cfg.width)/2; assert(item.x>=half+8 && item.x<=BALANCE.stageWorldWidth-half-8, `${item.id} stays inside world`); });
spacingStage.groupIndex = 2; spacingStage.queueGroupWave(0); assert.equal(new Set(spacingStage.waveQueue.map(i=>i.x)).size, spacingStage.waveQueue.length, 'formal wave queue stores distinct spawn X values');

assert.equal(BALANCE.enemyPopulation.waveClearDelayMs, 1500);
const waitScene = makeScene(); const waitStage = new StageSystem(waitScene); waitStage.waveSpawnFinished=true; waitStage.currentWave=1; waitStage.waveState='fighting'; waitStage.updateGroup(0); assert.equal(waitStage.waveState, 'waitingNextWave'); waitStage.updateGroup(1499); assert.equal(waitStage.currentWave, 1); waitStage.updateGroup(1500); assert.equal(waitStage.currentWave, 2);

Object.values(WEAPONS).forEach(w => assert(Number.isFinite(w.knockback) && w.knockback >= 0, `${w.id} has valid knockback`)); assert.equal(WEAPONS.short_sword.knockback, 36);
const combatScene = makeScene(); const combat = new CombatSystem(combatScene); let seenMeta; combat.damageEnemy = (_enemy,_damage,meta) => { seenMeta=meta; return true; }; const enemy = { active:true, isDefeated:false, body:{}, x:300, y:850, hp:10, width:74 }; combatScene.playerData.attack=1; combat.performDefaultAttack(enemy, WEAPONS.short_sword); assert.equal(seenMeta.knockback, WEAPONS.short_sword.knockback, 'normal attack reads weapon config knockback');
assert.equal(SKILLS.sword_wave.levels[5].knockback, 26, 'skill knockback is not globally doubled'); assert.equal(SKILLS.spinning_blade.levels[8].knockback, 18, 'skill knockback is unchanged');
const applyText = CombatSystem.prototype.applyKnockback.toString(); assert(!/base\s*\*\s*2|2\s*\*\s*base|knockback\s*\*\s*2|2\s*\*\s*knockback/.test(applyText), 'attack knockback logic does not multiply by 2');
console.log('[validate:enemy-population] PASS pre-boss melee-only pools, fixed boss1 rush count, formal spawn spacing, wave delay, weapon knockback config');
