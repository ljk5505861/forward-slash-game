import assert from 'node:assert/strict';
import StageSystem, { WAVE_SETTLEMENT_MS, LevelFlowStates as F } from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import GameSpeedSystem, { GAME_SPEEDS } from '../src/systems/GameSpeedSystem.js';
import { BALANCE, createPlayerRuntime } from '../src/config/balance.js';

function harness(wave=1,speed=1){
  const modals=[],tweens=[];
  let paused=false;
  const scene={balance:BALANCE,enemies:[],killCount:0,playerData:createPlayerRuntime(),
    eventBus:{emit(){}},hud:{setStage(){},setStatus(){},update(){}},
    isGameplayPaused:()=>paused,
    queueShop(reason){modals.push(reason);paused=true;},
    showSkillReward(){modals.push('skill');paused=true;},
    tweens:{setGlobalTimeScale(){},add(config){tweens.push({...config,remaining:config.duration});}},
  };
  const clock=new GameSpeedSystem(scene);clock.setSpeed(speed);
  scene.getGameplayTime=()=>clock.gameplayTimeMs;
  const stage=scene.stageSystem=new StageSystem(scene);
  stage.currentWave=wave;stage.waveSpawnFinished=true;stage.waveState='fighting';
  const combat=Object.create(CombatSystem.prototype);combat.scene=scene;
  function tick(realMs){
    const before=clock.gameplayTimeMs;
    const time=clock.advance(realMs,paused);
    for(const tween of tweens){
      if(tween.done) continue;
      tween.remaining-=time-before;
      if(tween.remaining<=0){tween.done=true;tween.onComplete();}
    }
    stage.update(time);
  }
  function enemy(extra={}){
    const e={active:true,isDefeated:false,body:{enable:true},destroy(){this.active=false;this.destroyed=true;},...extra};
    scene.enemies.push(e);return e;
  }
  return {scene,stage,combat,clock,modals,tick,enemy,pause(value){paused=value;}};
}

// Reproduce the real kill path: it removes the enemy immediately, but schedules corpse destruction later.
for(const speed of GAME_SPEEDS) for(const wave of [1,2]) for(const isElite of [false,true]){
  const h=harness(wave,speed),corpse=h.enemy({isElite});
  h.combat.killEnemy(corpse);h.tick(0);
  assert.equal(h.scene.enemies.length,0);assert.equal(corpse.destroyed,undefined);
  assert.equal(h.modals.length,0,'death must not immediately open a modal');
  h.tick(BALANCE.enemyFadeMs/speed);
  assert.equal(corpse.destroyed,true);assert.equal(h.modals.length,0,'keep a gap after corpse removal');
  h.tick((WAVE_SETTLEMENT_MS-BALANCE.enemyFadeMs-1)/speed);
  assert.equal(h.modals.length,0);
  h.tick(1/speed);
  assert.deepEqual(h.modals,[wave===1?'group_1':'skill']);
  h.tick(10000);assert.equal(h.modals.length,1,'modal pause cannot duplicate settlement');
}

{
  const h=harness(),e=h.enemy();h.combat.killEnemy(e);h.tick(0);h.tick(200);
  h.pause(true);h.tick(10000);assert.equal(h.clock.gameplayTimeMs,200);assert.equal(h.modals.length,0);
  h.pause(false);h.tick(599);assert.equal(h.modals.length,0);h.tick(1);assert.equal(h.modals.length,1);
}
{
  const h=harness();h.tick(0);h.tick(400);
  const e=h.enemy();h.tick(100);assert.equal(h.stage.waveSettlementAt,null,'a new enemy cancels settlement');
  h.combat.killEnemy(e);h.tick(0);h.tick(799);assert.equal(h.modals.length,0);h.tick(1);assert.equal(h.modals.length,1);
}
{
  const h=harness();h.tick(0);
  h.scene.skillSystem={passiveState:{mantraHeavenlyBook:{absorb:{phase:'refining'}}}};
  h.tick(900);assert.equal(h.stage.waveSettlementAt,null);assert.equal(h.modals.length,0,'refining still blocks clear');
  h.scene.skillSystem.passiveState.mantraHeavenlyBook.absorb=null;h.tick(0);h.tick(800);assert.equal(h.modals.length,1);
}
{
  const h=harness();h.stage.waveQueue=[{at:10000,id:'grunt'}];h.tick(0);
  assert.equal(h.stage.waveSettlementAt,null,'pending spawns prevent settlement');
  h.stage.waveQueue=[];h.tick(0);h.stage.reset();
  h.stage.currentWave=1;h.stage.waveState='fighting';h.stage.waveSpawnFinished=true;
  h.tick(1000);assert.equal(h.modals.length,0,'restart cannot reuse the old deadline');
  h.tick(800);assert.equal(h.modals.length,1);
}
{
  const h=harness();h.tick(0);h.stage.shiftTimers(1000,0);
  assert.equal(h.stage.waveSettlementAt,1800);h.tick(1799);assert.equal(h.modals.length,0);
  h.tick(1);assert.equal(h.modals.length,1);
}
{
  const h=harness();h.tick(0);h.stage.clearEnemies();assert.equal(h.stage.waveSettlementAt,null);
}
// Boss aftermath retains the existing artifact/final-victory behavior; the delay targets regular waves only.
for(const boss of ['boss1','boss6']){
  const h=harness();h.stage.activeRush=boss;h.stage.flowState=F.BOSS_FIGHT;
  const rewards=[];h.scene.queueArtifactReward=(_,meta)=>rewards.push(meta.afterBoss);
  h.scene.finishRun=won=>rewards.push(won);
  h.combat.killEnemy(h.enemy({isBoss:true,isFinalBoss:boss==='boss6',flowBossType:boss}));
  assert.deepEqual(rewards,[boss==='boss6'?true:'boss1']);assert.equal(h.modals.length,0);
}
console.log('PASS: death fade before settlement; 1x/1.5x/2x, both rewards, elites, pause, reset, new enemies and boss aftermath');
