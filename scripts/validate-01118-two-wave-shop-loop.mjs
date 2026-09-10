import assert from 'node:assert/strict';
import StageSystem, {WAVE_SETTLEMENT_MS,FLOW_GROUPS,LevelFlowStates as F} from '../src/systems/StageSystem.js';
import {BALANCE,createPlayerRuntime} from '../src/config/balance.js';
import {onShopClosed} from '../src/systems/ShopFlow.js';
globalThis.window??={};
const context={fillRect(){},drawImage(){},getImageData(){return {data:new Uint8ClampedArray([0,0,0,255])};},putImageData(){},createImageData(){return {data:new Uint8ClampedArray(4)};},clearRect(){}};
globalThis.document??={documentElement:{style:{}},createElement:()=>({getContext:()=>context,style:{}})};
globalThis.navigator??={userAgent:'node'};
globalThis.HTMLCanvasElement??=class {};
globalThis.Image??=class { set src(_value){setTimeout(()=>this.onload?.(),0);} };

const {default:ShopSystem}=await import('../src/systems/ShopSystem.js');
let time=0,paused=false;
const events=[],shops=[],rewards=[],artifacts=[],campfires=[];
const scene={balance:BALANCE,playerData:createPlayerRuntime(),player:{x:220,y:850},enemies:[],
 cameras:{main:{worldView:{right:720}}},eventBus:{emit(type,payload){events.push({type,payload});}},
 hud:{setStage(t){this.stage=t;},setStatus(){},update(){}},
 getGameplayTime:()=>time,isGameplayPaused:()=>paused,endGameplayPause(){paused=false;},
 shopPanel:{show(){paused=true;}},queueShop(reason){shops.push(reason);scene.shopSystem.open(reason);},
 onShopClosed(reason){onShopClosed(scene,reason);scene.stageSystem.onShopClosed(reason);},
 showSkillReward(title){rewards.push(title);paused=true;},
 queueArtifactReward(_,meta){artifacts.push(meta.afterBoss);},
 showCampfire(source){campfires.push(source);},showProfessionChoice(){events.push('profession');},
 showAdvancedProfessionChoice(){events.push('advanced');},finishRun(won){assert.equal(won,true);},
};
const stage=scene.stageSystem=new StageSystem(scene);scene.shopSystem=new ShopSystem(scene);
assert.equal(FLOW_GROUPS.length,18);
for(const g of FLOW_GROUPS){assert.equal(g.waves.length,2);assert.equal(g.ids.length,2);assert.equal(g.rangedCounts.length,2);}
// Keep real queue/drain/transition logic; replace only rendered enemy creation.
stage.spawn=(id)=>{const e={active:true,isDefeated:false,id};scene.enemies.push(e);return e;};
function clearWave(){time+=100000;stage.update(time);assert.ok(scene.enemies.length>0);scene.enemies=[];stage.update(time);assert.equal(stage.flowState,F.GROUP_COMBAT);time+=WAVE_SETTLEMENT_MS;stage.update(time);}
for(let group=1;group<=18;group++){
 assert.equal(stage.groupIndex,group-1);assert.equal(stage.flowState,F.GROUP_COMBAT);
 stage.update(time);assert.equal(stage.currentWave,1);assert.equal(stage.progressionWaveIndex(),(group-1)*2);
 // Active enemies and pending spawns must block the shop.
 scene.enemies=[{active:true}];stage.update(time);assert.equal(stage.flowState,F.GROUP_COMBAT);scene.enemies=[];
 clearWave();assert.equal(stage.flowState,F.SHOP);assert.equal(stage.completedWaveCount,group*2-1);
 assert.equal(shops.at(-1),`group_${group}`);assert.equal(scene.shopSystem.currentItems.length,4);
 const count=shops.length;stage.update(time);stage.update(time);assert.equal(shops.length,count);assert.equal(stage.currentWave,1);
 assert.equal(stage.onShopClosed('group_999'),false); if(group>3) assert.equal(stage.onShopClosed('first'),false,'stale boss shop callback cannot hijack a group shop');assert.equal(stage.flowState,F.SHOP);
 // A visit supports no purchase; insufficient funds and duplicate purchases never charge twice.
 scene.playerData.gold=0;const item=scene.shopSystem.currentItems[0];assert.equal(scene.shopSystem.buy(item.id).ok,false);
 if(group===2){scene.playerData.gold=1000;for(const product of scene.shopSystem.currentItems.slice(0,2)){
 const before=scene.playerData.gold;assert.equal(scene.shopSystem.buy(product.id).ok,true);assert.equal(scene.playerData.gold,before-product.price);
 assert.equal(scene.shopSystem.buy(product.id).ok,false);assert.equal(scene.playerData.gold,before-product.price);
 }}
 scene.shopSystem.closeCurrent();assert.equal(paused,false);assert.equal(stage.flowState,F.GROUP_COMBAT);
 assert.equal(stage.onShopClosed(`group_${group}`),false);
 stage.update(time);assert.equal(stage.currentWave,1,'delay must complete before second wave');
 time+=BALANCE.enemyPopulation.waveClearDelayMs;stage.update(time);assert.equal(stage.currentWave,2);
 clearWave();assert.equal(stage.flowState,F.SKILL_REWARD);assert.equal(rewards.length,group);assert.equal(stage.completedWaveCount,group*2);
 assert.equal(scene.playerData.level,group);stage.update(time);assert.equal(rewards.length,group);
 stage.onSkillRewardClosed();paused=false;assert.equal(scene.playerData.level,group+1);assert.equal(stage.currentEnemyLevel,group+1);
 assert.equal(stage.onSkillRewardClosed(),false);
 if(group%3===0){const boss=`boss${group/3}`;
 if(group===9){assert.equal(stage.flowState,F.ADVANCED_PROFESSION_STATUE);stage.onAdvancedProfessionChosen();stage.onCampfireClosed('advanced');}
 else {assert.equal(stage.flowState,F.BOSS_RUSH);assert.equal(shops.length,group,'no extra shop after skill reward');}
 assert.equal(stage.flowState,F.BOSS_RUSH);assert.equal(stage.activeRush,boss);
 stage.spawnBoss(boss);assert.equal(stage.flowState,F.BOSS_FIGHT);scene.enemies=[];
 stage.onBossKilled(boss);stage.onBossKilled(boss);
 if(group===18){assert.equal(stage.flowState,F.VICTORY);break;}
 assert.equal(artifacts.at(-1),boss);stage.beginAfterBossReward(boss);
 if(group===6){assert.equal(stage.flowState,F.PROFESSION_REWARD);stage.onProfessionChosen();}
 assert.equal(stage.flowState,F.CAMPFIRE);stage.onCampfireClosed(boss);
 }
}
assert.equal(events.filter(e=>e?.payload?.kind==='wave').length,36);
assert.equal(shops.filter(s=>s.startsWith('group_')).length,18);
assert.equal(shops.length,18,'only the 18 group shops remain');
assert.equal(rewards.length,18);assert.equal(artifacts.length,5);assert.equal(campfires.length,6);
stage.reset();scene.shopSystem.reset();paused=false;scene.enemies=[];stage.update(time);clearWave();
assert.equal(scene.shopSystem.visits,1,'restart permits the first group shop again');
console.log('PASS: 36 waves, 18 fixed shops, 18 rewards, 6 bosses, existing special nodes, purchases and restart');
