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
assertRange('midBossSummonGapMs', p.midBossSummonGapMs, [8000, 12000]);
assertRange('midBossSummonSize', p.midBossSummonSize, [3, 5]);
assert.equal(p.midBossMinionCap, 8, 'mid boss minion cap must be 8');
assertRange('finalBossInitial', p.finalBossInitial, [6, 9]);
assertRange('finalBossSummonGapMs', p.finalBossSummonGapMs, [7000, 10000]);
assertRange('finalBossSummonSize', p.finalBossSummonSize, [4, 6]);
assertRange('finalBossMinionCap', p.finalBossMinionCap, [10, 12]);
assertRange('bossWaveSpawnIntervalMs', p.bossWaveSpawnIntervalMs, [100, 250]);

const savedBetween = Phaser.Math.Between;
const useBetween = (value) => { Phaser.Math.Between = (min, max) => Math.min(max, Math.max(min, value)); };
const restoreBetween = () => { Phaser.Math.Between = savedBetween; };
const minion = (id='grunt') => ({ id:`${id}_${Math.random()}`, enemyId:id, active:true, isDefeated:false, isBoss:false, isElite:false, hp:10, maxHp:10, width:80, x:0, y:0 });
const boss = (hp=100, maxHp=100) => ({ id:'boss', enemyId:'boss', active:true, isDefeated:false, isBoss:true, isElite:false, hp, maxHp, width:120, x:0, y:0 });
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
  };
  const system = new StageSystem(scene);
  system.phaseIndex = system.phaseIndexById(phaseId);
  system.spawnAhead = (id='grunt') => { const e = minion(id); scene.enemies.push(e); return e; };
  system.spawn = (id) => { const e = id === 'boss' || id === 'mid_boss' ? boss() : minion(id); scene.enemies.push(e); return e; };
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
    const { scene, system, setNow } = makeSystem('midBoss');
    scene.enemies = [boss()];
    system.nextBossSummonAt = 8000;
    setNow(7999);
    system.maintainPopulation(7999);
    assert.equal(system.waveQueue.length, 0, 'mid boss must not summon before 8-12s timer');
    setNow(8000);
    system.maintainPopulation(8000);
    assert.ok(system.waveQueue.length >= p.midBossSummonSize[0] && system.waveQueue.length <= p.midBossSummonSize[1], 'mid boss summon wave must be 3-5');
    system.waveQueue = [];
    scene.enemies = [boss(), ...Array.from({ length:p.midBossMinionCap }, () => minion())];
    system.nextBossSummonAt = 9000;
    system.maintainPopulation(9000);
    assert.equal(system.waveQueue.length, 0, 'mid boss minion cap must prevent summon');
  }

  {
    const { scene, system, setNow } = makeSystem('finalBoss');
    system.bossSummonCap = 10;
    scene.enemies = [boss(100, 100)];
    system.nextBossSummonAt = 7000;
    setNow(6999);
    system.maintainPopulation(6999);
    assert.equal(system.waveQueue.length, 0, 'final boss must not summon before 7-10s timer');
    setNow(7000);
    system.maintainPopulation(7000);
    assert.ok(system.waveQueue.length >= p.finalBossSummonSize[0] && system.waveQueue.length <= p.finalBossSummonSize[1], 'final boss summon wave must be 4-6');
    assert.ok(system.nextBossSummonAt - 7000 >= 7000 && system.nextBossSummonAt - 7000 <= 10000, 'full-health final boss interval should be 7-10s');
    system.waveQueue = [];
    scene.enemies = [boss(40, 100)];
    system.nextBossSummonAt = 15000;
    setNow(15000);
    system.maintainPopulation(15000);
    assert.ok(system.nextBossSummonAt - 15000 >= 5600 && system.nextBossSummonAt - 15000 <= 8000, 'half-health final boss interval should be shortened by about 20%');
    const queued = system.waveQueue.length;
    system.maintainPopulation(15001);
    assert.equal(system.waveQueue.length, queued, 'half-health shortening must not become per-frame continuous refill');
    system.waveQueue = [];
    scene.enemies = [boss(40, 100), ...Array.from({ length:system.bossSummonCap }, () => minion())];
    system.nextBossSummonAt = 25000;
    system.maintainPopulation(25000);
    assert.equal(system.waveQueue.length, 0, 'final boss per-fight minion cap must prevent summon');
  }
} finally {
  restoreBetween();
}

console.log('[validate:enemy-population] PASS behavioral wave spawning, phase progression, caps, boss summons, and reset checks');
