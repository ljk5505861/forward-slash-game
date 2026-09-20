import assert from 'node:assert/strict';
import StageSystem, {FLOW_GROUPS, WAVE_SETTLEMENT_MS, LevelFlowStates as F} from '../src/systems/StageSystem.js';
import {BALANCE, createPlayerRuntime} from '../src/config/balance.js';

const catalog=JSON.stringify(FLOW_GROUPS);
let time=0, paused=false;
const waves=[], shops=[], skills=[], bosses=[], rushes=[], artifacts=[], camps=[];
const scene={runMode:'normal',balance:BALANCE,playerData:createPlayerRuntime(),player:{x:220,y:850},enemies:[],
  cameras:{main:{worldView:{right:720}}},getGameplayTime:()=>time,isGameplayPaused:()=>paused,
  eventBus:{emit(_,p){if(p.kind==='wave') waves.push(p);if(p.kind==='boss') bosses.push(p.flowBossType);if(p.kind==='bossRush') rushes.push(p.flowBossType);}},
  hud:{setStage(text){this.stage=text;},setStatus(){},update(){}},
  queueShop(reason){shops.push(reason);paused=true;},showSkillReward(title){skills.push(title);paused=true;},
  queueArtifactReward(_,meta){artifacts.push(meta.afterBoss);},showCampfire(source){camps.push(source);},
  showProfessionChoice(){},showAdvancedProfessionChoice(){},finishRun(won){assert(won);},
};
const stage=new StageSystem(scene);
// Only rendered enemy construction is replaced; queues, settlement, rewards,
// level growth, boss rushes and all 18 group transitions use the real system.
stage.spawn=id=>{const e={active:true,isDefeated:false,id};scene.enemies.push(e);return e;};
for(let group=1;group<=18;group++){
  assert.equal(stage.groupIndex,group-1);
  for(let wave=1;wave<=3;wave++){
    time+=BALANCE.enemyPopulation.waveClearDelayMs;stage.update(time);
    assert.equal(stage.currentWave,wave);assert.equal(stage.flowState,F.GROUP_COMBAT);
    assert.equal(stage.progressionWaveIndex(),(group-1)*3+wave-1);
    assert.match(scene.hud.stage,new RegExp(`第${wave}/3波`));
    assert.equal(stage.currentWaveSize,FLOW_GROUPS[group-1].waves[wave-1]);
    assert.equal(stage.waveQueue.length,stage.currentWaveSize);
    time+=100000;stage.update(time);assert.equal(scene.enemies.length,stage.currentWaveSize);
    scene.enemies=[];stage.update(time);
    time+=WAVE_SETTLEMENT_MS-1;stage.update(time);
    assert.equal(skills.length,group-1);assert.equal(shops.length,group-1,'wait for corpse settlement');
    time++;stage.update(time);
    assert.equal(stage.completedWaveCount,(group-1)*3+wave);
    assert.equal(stage.flowState,wave===3?F.SKILL_REWARD:F.GROUP_COMBAT);
    assert.equal(shops.length,group-1,'no shop before completing the skill choice');
  }
  assert.equal(skills.length,group);assert.match(skills.at(-1),/第3波清空/);
  assert.equal(scene.playerData.level,group);assert.equal(stage.currentEnemyLevel,group);
  assert.equal(stage.pendingLevelUp,true);
  stage.update(time+100000);assert.equal(skills.length,group,'paused reward cannot repeat');
  assert.equal(stage.onShopClosed(`group_${group}`),false,'premature shop callback cannot skip skill selection');
  assert.equal(stage.onSkillRewardClosed(),true);
  assert.equal(stage.flowState,F.SHOP);assert.equal(shops.length,group);
  assert.equal(stage.onSkillRewardClosed(),false,'duplicate skill callback cannot open another shop');
  assert.equal(stage.onShopClosed('first'),false);assert.equal(stage.onShopClosed('group_999'),false);
  assert.equal(stage.currentWave,3);assert.equal(scene.playerData.level,group);
  stage.update(time+100000);assert.equal(waves.length,group*3,'no fourth wave during shop');
  stage.onShopClosed(`group_${group}`);paused=false;
  assert.equal(stage.onShopClosed(`group_${group}`),false);
  assert.equal(scene.playerData.level,group+1);assert.equal(stage.currentEnemyLevel,group+1);
  assert.equal(scene.playerData.maxHp,500+group*8);assert.equal(scene.playerData.maxMana,100+group*5);
  if(group%3===0){
    const boss=`boss${group/3}`;
    if(group===9){assert.equal(stage.flowState,F.ADVANCED_PROFESSION_STATUE);stage.onAdvancedProfessionChosen();assert.equal(stage.flowState,F.CAMPFIRE);stage.onCampfireClosed('advanced');}
    assert.equal(stage.flowState,F.BOSS_RUSH);assert.equal(stage.activeRush,boss);
    stage.update(time);assert(stage.waveQueue.length>0,'boss rush is retained');
    time+=100000;stage.update(time);assert(scene.enemies.length>0);assert.equal(stage.flowState,F.BOSS_RUSH);
    scene.enemies=[];stage.update(time);assert.equal(stage.flowState,F.BOSS_FIGHT);
    assert.equal(shops.length,group,'no duplicated pre-boss shop');
    scene.enemies=[];stage.onBossKilled(boss);stage.onBossKilled(boss);
    if(group===18){assert.equal(stage.flowState,F.VICTORY);break;}
    assert.equal(artifacts.at(-1),boss);stage.beginAfterBossReward(boss);
    if(group===6){assert.equal(stage.flowState,F.PROFESSION_REWARD);stage.onProfessionChosen();}
    assert.equal(stage.flowState,F.CAMPFIRE);stage.onCampfireClosed(boss);
  }
}
assert.equal(waves.length,54);assert.equal(skills.length,18);assert.equal(shops.length,18);
assert.deepEqual(bosses,['boss1','boss2','boss3','boss4','boss5','boss6']);assert.deepEqual(rushes,bosses);
assert.equal(artifacts.length,5);assert.equal(camps.length,6);
assert.equal(stage.completedWaveCount,54);assert.equal(scene.playerData.level,19);
assert.equal(JSON.stringify(FLOW_GROUPS),catalog,'shared test-mode wave catalog remains untouched');
stage.reset();assert.equal(stage.nodeDone.size,0);assert.equal(stage.pendingShopReason,null);assert.equal(stage.awaitingSkillRewardClose,false);
for(const mode of ['normal','test',undefined]){
  scene.runMode=mode;stage.reset();
  const count=mode==='normal'?3:4;
  assert.equal(stage.wavesPerGroup(),count);
  for(let group=0;group<18;group++) for(let wave=0;wave<count;wave++) assert.equal(stage.enemyLevelForCompletedWaves(group*count+wave),group+1);
}
console.log('PASS: normal 54 waves, 18 skill→shop pairs, 6 retained boss rushes/bosses, special nodes, once-only callbacks, per-group levels and mode isolation');
