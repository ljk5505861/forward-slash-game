import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { ENEMIES } from '../src/config/enemies.js';

globalThis.window = globalThis.window || {};
const canvasContext = { fillRect(){}, clearRect(){}, getImageData(){ return { data:new Uint8ClampedArray([0,0,0,255]) }; }, putImageData(){}, createImageData(){ return []; }, drawImage(){}, save(){}, restore(){}, translate(){}, scale(){}, rotate(){}, beginPath(){}, closePath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, arc(){}, rect(){}, measureText(){ return { width:0 }; }, setTransform(){}, resetTransform(){}, fillText(){}, strokeText(){} };
globalThis.document = globalThis.document || { documentElement:{}, createElement:()=>({ getContext:()=>canvasContext, style:{} }) };
if (!globalThis.navigator?.userAgent) Object.defineProperty(globalThis, 'navigator', { value:{ userAgent:'node' }, configurable:true });
globalThis.HTMLCanvasElement = globalThis.HTMLCanvasElement || class {};
globalThis.Image = globalThis.Image || class { set src(_value){ setTimeout(()=>this.onload?.(),0); } };
const [{ default:Phaser }, { default:StageSystem }] = await Promise.all([import('phaser'), import('../src/systems/StageSystem.js')]);

const p = BALANCE.enemyPopulation;
for (const key of ['earlyTarget','midTarget','lateTarget','hardCap']) if (!Number.isFinite(p[key])) throw new Error(`missing ${key}`);
if (!(p.earlyTarget < p.midTarget && p.midTarget < p.lateTarget && p.hardCap >= p.lateTarget)) throw new Error('bad population targets');
if (ENEMIES.grunt.hp > 30 || ENEMIES.grunt.damage > 5) throw new Error('grunt not weakened enough');

const assertRange = (name, actual, expected) => assert.deepEqual(actual, expected, `${name} must be [${expected}]`);
assertRange('waveGapMs.early', p.waveGapMs?.early, [4000, 5000]);
assertRange('waveGapMs.mixed', p.waveGapMs?.mixed, [3500, 4500]);
assertRange('waveGapMs.late', p.waveGapMs?.late, [3000, 4000]);
assertRange('waveSize.early', p.waveSize?.early, [3, 5]);
assertRange('waveSize.mixed', p.waveSize?.mixed, [4, 6]);
assertRange('waveSize.late', p.waveSize?.late, [5, 8]);
assert.deepEqual(p.waveTriggerRemaining, { early:2, mixed:3, late:4 }, 'bad wave trigger thresholds');
assertRange('midBossInitial', p.midBossInitial, [5, 7]);
assertRange('finalBossInitial', p.finalBossInitial, [6, 9]);
assert.equal(p.bossIntroDelayMs, 5000, 'boss intro delay must be fixed at 5000ms');
assertRange('bossWaveSpawnIntervalMs', p.bossWaveSpawnIntervalMs, [100, 250]);

const savedBetween = Phaser.Math.Between;
const useBetween = (value) => { Phaser.Math.Between = (min, max) => Math.min(max, Math.max(min, value)); };
const restoreBetween = () => { Phaser.Math.Between = savedBetween; };
const minion = (id='grunt') => ({ id:`${id}_${Math.random()}`, enemyId:id, active:true, isDefeated:false, isBoss:false, isElite:false, hp:10, maxHp:10, width:80, x:0, y:0 });
const boss = (hp=100, maxHp=100, enemyId='boss') => ({ id:enemyId, enemyId, active:true, isDefeated:false, isBoss:true, isMidBoss:enemyId==='mid_boss', isFinalBoss:enemyId==='boss', isElite:false, hp, maxHp, width:120, x:0, y:0 });
const makeSystem = (phaseId='early') => {
  let now = 0;
  const scene = {
    balance:BALANCE,
    player:{ x:0 },
    enemies:[],
    currentTarget:null,
    runState:null,
    playerData:{ level:1 },
    isGameplayPaused:()=>false,
    getGameplayTime:()=>now,
    setNow(v){ now = v; },
    hud:{ setStage(){}, setStatus(){} },
    eventBus:{ emit(){} },
    runStats:{ startMidBossFight(){} },
    enemyBehaviors:{ attach(){}, update(){}, destroyEnemy(){} },
    statusEffects:{ clearTarget(){} },
    showRestPoint(){},
    finishRun(won){ this.finishedWon = won; },
  };
  const system = new StageSystem(scene);
  system.phaseIndex = system.phaseIndexById(phaseId);
  system.spawnAhead = (id='grunt') => { const e = minion(id); scene.enemies.push(e); return e; };
  system.spawn = (id) => { const e = id === 'boss' || id === 'mid_boss' ? boss(100,100,id) : minion(id); scene.enemies.push(e); return e; };
  system.separateEnemies = () => {};
  return { scene, system, setNow:(v)=>scene.setNow(v) };
};
const phaseId = (system) => system.phase().id;
const intervals = (queue, startAt) => queue.map((item, index) => item.at - (index ? queue[index - 1].at : startAt));
const assertStrictlyIncreasing = (queue) => queue.reduce((prev, item) => { assert.ok(item.at > prev, 'waveQueue times must be strictly increasing'); return item.at; }, -Infinity);

try {
  useBetween(100);

  {
    const { scene, system, setNow } = makeSystem('early');
    scene.player.x = 1000;
    system.nextWaveAt = 5000;
    setNow(4000);
    system.update(4000);
    assert.equal(phaseId(system), 'early', 'early must not advance while player is before x=2200 and enemies are empty');
    assert.equal(scene.enemies.length, 0, 'wave gap must preserve a real empty breather before nextWaveAt');
    setNow(5000);
    system.update(5000);
    assert.equal(phaseId(system), 'early', 'early remains active when a new wave is queued');
    assert.ok(system.waveQueue.length >= p.waveSize.early[0] && system.waveQueue.length <= p.waveSize.early[1], 'early queued wave size must be in config range');
    assertStrictlyIncreasing(system.waveQueue);
    intervals(system.waveQueue, 5000).forEach((gap) => assert.ok(gap >= 100 && gap <= 250, 'each same-wave spawn gap must be 100-250ms'));
    const queued = system.waveQueue.length;
    setNow(system.waveQueue[0].at);
    system.update(system.waveQueue[0].at);
    assert.equal(scene.enemies.length, 1, 'first queued monster should spawn at its own timestamp');
    assert.equal(system.waveQueue.length, queued - 1, 'only due queued monster should drain');
    setNow(100000);
    system.update(100000);
    assert.equal(scene.enemies.length, queued, 'remaining queued monsters should spawn after their timestamps');
    scene.enemies = [];
    system.waveQueue = [{ at:100050, id:'grunt' }];
    system.nextWaveAt = 99999;
    system.waveIndex = 7;
    scene.player.x = 2200;
    setNow(100000);
    system.update(100000);
    assert.equal(phaseId(system), 'mixed', 'early should advance to mixed only after player reaches x=2200');
    assert.deepEqual(system.waveQueue, [], 'phase switch must clear old waveQueue');
    assert.equal(system.nextWaveAt, 0, 'phase switch must reset nextWaveAt');
    assert.equal(system.waveIndex, 0, 'phase switch must reset waveIndex');
  }

  for (const [phase, beforeX, afterX, next] of [['mixed', 4400, 4550, 'midBoss'], ['late', 7000, 7200, 'rest']]) {
    const { scene, system, setNow } = makeSystem(phase);
    scene.player.x = beforeX;
    system.nextWaveAt = 5000;
    setNow(4000);
    system.update(4000);
    assert.equal(phaseId(system), phase, `${phase} must not advance with empty enemies before position threshold`);
    scene.player.x = afterX;
    setNow(6000);
    system.update(6000);
    assert.equal(phaseId(system), next, `${phase} should advance after reaching its position threshold`);
  }

  {
    const { scene, system, setNow } = makeSystem('early');
    scene.enemies = Array.from({ length:p.waveTriggerRemaining.early + 1 }, () => minion());
    system.nextWaveAt = 0;
    setNow(1000);
    system.maintainPopulation(1000);
    assert.equal(system.waveQueue.length, 0, 'remaining minions above threshold must not queue a new wave');
    scene.enemies = [];
    system.nextWaveAt = 2000;
    system.maintainPopulation(1000);
    assert.equal(system.waveQueue.length, 0, 'wave gap not reached must not queue a new wave');
    system.nextWaveAt = 0;
    const savedEarlyTarget = p.earlyTarget;
    p.earlyTarget = 2;
    scene.enemies = [minion()];
    system.maintainPopulation(3000);
    assert.equal(system.waveQueue.length, 1, 'phase recommended cap should limit queued monsters to available room');
    p.earlyTarget = savedEarlyTarget;
    system.waveQueue = [];
    scene.enemies = Array.from({ length:p.hardCap }, () => minion());
    system.maintainPopulation(4000);
    assert.equal(system.waveQueue.length, 0, 'hardCap must block new waves');
    scene.enemies = [];
    system.waveQueue = [{ at:5000, id:'grunt' }];
    system.nextWaveAt = 0;
    system.maintainPopulation(4000);
    assert.equal(system.waveQueue.length, 1, 'existing queue must prevent duplicate wave queueing');
  }

  {
    const { scene, system, setNow } = makeSystem('early');
    setNow(50000);
    const entered = system.enterPhaseById('midBoss');
    assert.equal(entered, true, 'midBoss phase should be reachable through real enterPhaseById');
    assert.equal(phaseId(system), 'midBoss', 'phase should now be midBoss');
    assert.equal(scene.enemies.some((e) => e.isBoss), false, 'mid boss must not spawn immediately on phase entry');
    assert.equal(system.bossIntroType, 'mid', 'mid boss intro type should be explicit');
    assert.equal(system.bossIntroState, 'spawningMinions', 'mid boss intro starts by spawning minions');
    assert.ok(system.waveQueue.length >= p.midBossInitial[0] && system.waveQueue.length <= p.midBossInitial[1], 'mid boss intro minion count must be 5-7');
    assertStrictlyIncreasing(system.waveQueue);
    intervals(system.waveQueue, 50000).forEach((gap) => assert.ok(gap >= 100 && gap <= 250, 'mid boss intro minions must be 100-250ms apart'));
    const finalMinionAt = system.waveQueue.at(-1).at;
    setNow(finalMinionAt - 1);
    system.update(finalMinionAt - 1);
    assert.equal(system.bossIntroState, 'spawningMinions', '5s boss timer cannot start before the last intro minion is generated');
    assert.equal(system.bossSpawnAt, 0, 'bossSpawnAt must not be set before intro queue finishes');
    setNow(finalMinionAt);
    system.update(finalMinionAt);
    assert.equal(system.bossIntroState, 'waitingBoss', 'intro should wait for boss after the final minion is generated');
    assert.equal(system.bossIntroQueueDoneAt, finalMinionAt, 'intro completion time should be the final minion spawn time');
    assert.equal(system.bossSpawnAt, finalMinionAt + 5000, 'mid boss should spawn exactly 5s after final intro minion');
    const minionsStillAlive = scene.enemies.filter((e) => !e.isBoss).length;
    setNow(system.bossSpawnAt - 1);
    system.update(system.bossSpawnAt - 1);
    assert.equal(scene.enemies.filter((e) => e.isBoss).length, 0, 'mid boss must not spawn before bossSpawnAt');
    setNow(system.bossSpawnAt);
    system.update(system.bossSpawnAt);
    assert.equal(scene.enemies.filter((e) => e.isBoss && e.enemyId === 'mid_boss').length, 1, 'exactly one mid boss should spawn at bossSpawnAt');
    assert.equal(scene.enemies.filter((e) => !e.isBoss).length, minionsStillAlive, 'living intro minions must not block boss spawn');
    const countAfterBoss = scene.enemies.length;
    setNow(system.bossSpawnAt + 60000);
    system.update(system.bossSpawnAt + 60000);
    assert.equal(scene.enemies.length, countAfterBoss, 'mid boss active phase must not generate more minions later');
    assert.equal(scene.enemies.filter((e) => e.isBoss && e.enemyId === 'mid_boss').length, 1, 'mid boss must not spawn twice');
  }

  {
    const { scene, system, setNow } = makeSystem('early');
    setNow(90000);
    const entered = system.enterPhaseById('finalBoss');
    assert.equal(entered, true, 'finalBoss phase should be reachable through real enterPhaseById');
    assert.equal(phaseId(system), 'finalBoss', 'phase should now be finalBoss');
    assert.equal(scene.enemies.some((e) => e.isFinalBoss), false, 'final boss must not spawn immediately on phase entry');
    assert.equal(system.bossIntroType, 'final', 'final boss intro type should be explicit');
    assert.ok(system.waveQueue.length >= p.finalBossInitial[0] && system.waveQueue.length <= p.finalBossInitial[1], 'final boss intro minion count must be 6-9');
    assertStrictlyIncreasing(system.waveQueue);
    intervals(system.waveQueue, 90000).forEach((gap) => assert.ok(gap >= 100 && gap <= 250, 'final boss intro minions must be 100-250ms apart'));
    const finalMinionAt = system.waveQueue.at(-1).at;
    setNow(finalMinionAt - 1);
    system.update(finalMinionAt - 1);
    assert.equal(system.bossSpawnAt, 0, 'final boss timer cannot start before the last intro minion is generated');
    setNow(finalMinionAt);
    system.update(finalMinionAt);
    assert.equal(system.bossIntroQueueDoneAt, finalMinionAt, 'final intro completion time should be the final minion spawn time');
    assert.equal(system.bossSpawnAt, finalMinionAt + 5000, 'final boss should spawn exactly 5s after final intro minion');
    setNow(system.bossSpawnAt - 1);
    system.update(system.bossSpawnAt - 1);
    assert.equal(scene.enemies.filter((e) => e.isFinalBoss).length, 0, 'final boss must not spawn before bossSpawnAt');
    const minionsStillAlive = scene.enemies.filter((e) => !e.isBoss).length;
    setNow(system.bossSpawnAt);
    system.update(system.bossSpawnAt);
    assert.equal(scene.enemies.filter((e) => e.isFinalBoss).length, 1, 'exactly one final boss should spawn at bossSpawnAt');
    assert.equal(scene.enemies.filter((e) => !e.isBoss).length, minionsStillAlive, 'living intro minions must not block final boss spawn');
    const countAfterBoss = scene.enemies.length;
    setNow(system.bossSpawnAt + 60000);
    system.update(system.bossSpawnAt + 60000);
    assert.equal(scene.enemies.length, countAfterBoss, 'final boss active phase must not generate more minions later');
    assert.equal(scene.enemies.filter((e) => e.isFinalBoss).length, 1, 'final boss must not spawn twice');
    scene.enemies.find((e) => e.isFinalBoss).isDefeated = true;
    scene.finishRun(true);
    assert.equal(scene.finishedWon, true, 'final boss death path should still be able to enter victory settlement');
  }

  {
    const { scene, system, setNow } = makeSystem('early');
    setNow(120000);
    system.enterPhaseById('finalBoss');
    assert.equal(system.bossIntroState, 'spawningMinions', 'final intro should be active before cleanup');
    system.clearEnemies();
    setNow(200000);
    system.update(200000);
    assert.equal(scene.enemies.some((e) => e.isBoss), false, 'cleanup/restart state must not later spawn a stale boss');
    assert.equal(system.bossIntroState, 'idle', 'cleanup should reset boss intro state');
  }

} finally {
  restoreBetween();
}

console.log('[validate:enemy-population] PASS behavioral wave spawning, phase progression, caps, boss intro, and reset checks');
