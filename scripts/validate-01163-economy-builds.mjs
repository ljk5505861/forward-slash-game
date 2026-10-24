import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { SHOP_ITEMS, LEGACY_SHOP_ITEMS, SHOP_SKILL_PRICES } from '../src/config/shopItems.js';
import { BALANCE, createPlayerRuntime } from '../src/config/balance.js';
import { ENEMIES } from '../src/config/enemies.js';
import { SKILLS } from '../src/config/skills.js';
import createEnemy from '../src/entities/createEnemy.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import StageSystem, { FLOW_GROUPS } from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import RunStatsSystem from '../src/systems/RunStatsSystem.js';

global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,k){return k==='getImageData'?()=>({data:[0,0,0,0]}):()=>{};}});},style:{}};}};
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
global.Image=class {set src(v){setTimeout(()=>this.onload?.(),0);}};
global.HTMLCanvasElement=class {};
const {default:ShopSystem}=await import('../src/systems/ShopSystem.js');
const {default:SkillSystem}=await import('../src/systems/SkillSystem.js');
const {default:ShopPanel}=await import('../src/ui/ShopPanel.js');
const source=fs.readFileSync(new URL('../src/scenes/GameScene.js',import.meta.url),'utf8');
const RewardScene=vm.runInNewContext('(class {'+source.split('\n').find(line=>line.startsWith('  awardGold('))+'})');
const ids=['calamity_banner','greed_seal','golden_piggy_bank','merchant_gold_card'];
const cfg=id=>SHOP_ITEMS.find(item=>item.id===id);
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);

function node(x=0,y=0,width=0,height=0){
  const n={x,y,width,height,active:true,callbacks:{},text:'',destroy(){this.active=false;},
    on(event,fn){this.callbacks[event]=fn;return this;},removeAllListeners(){this.callbacks={};},
    setPosition(x,y){this.x=x;this.y=y;return this;},setText(t){this.text=t;return this;}};
  for(const name of ['add','setVisible','setStrokeStyle','setDepth','setOrigin','setScrollFactor','setDisplaySize','setAlpha',
    'setScale','setInteractive','clear','lineStyle','lineBetween','strokeCircle','fillStyle','fillCircle','fillRoundedRect','fillPoints','strokePoints','beginPath','arc','strokePath','strokeRoundedRect'])n[name]=()=>n;
  n.body={enable:true,velocity:{x:0},setAllowGravity(){},setImmovable(){},setSize(){},setOffset(){},setVelocityX(){},reset(){}};
  return n;
}
function fixture(mode='normal'){
  const emitter=new EventEmitter();
  const s=Object.assign(new RewardScene(),{runMode:mode,playerData:createPlayerRuntime(),balance:BALANCE,
    enemies:[],killCount:0,runState:'RUNNING',player:node(220,850,45,78),getGameplayTime:()=>0,
    cameras:{main:{worldView:{right:720,x:0,width:720},width:720,scrollX:0}},
    events:{on(){},once(){},off(){}},hud:{update(){},setStage(){},setStatus(){}},skillBar:{update(){}},floatText(){},
    eventBus:{on(e,fn){emitter.on(e,fn);return ()=>emitter.off(e,fn);},emit(e,p){emitter.emit(e,p);}},
    add:{rectangle:node,text:(x,y,t)=>Object.assign(node(x,y),{text:t}),graphics:node,container:node},
    physics:{add:{existing(){}}},tweens:{add(){return {stop(){},remove(){}};}},enemyBehaviors:{attach(){},destroyEnemy(){}},
    shopPanel:{show(){}},beginGameplayPause(){this.paused=true;},onShopClosed(){this.paused=false;}});
  s.playerData.gold=100000;s.playerData.critChance=0;
  s.runStats=new RunStatsSystem(s);s.combatSystem=new CombatSystem(s);s.stageSystem=new StageSystem(s);
  s.targeting=new TargetingSystem(s);s.skillSystem=new SkillSystem(s);s.shopSystem=new ShopSystem(s);s.shopSystem.open('fixture');
  function offer(id){return {...cfg(id),itemId:id,id:'fixture_'+(++s.shopSystem.serial),locked:false};}
  function buy(id){const o=offer(id);s.shopSystem.currentItems=[o];assert(s.shopSystem.buy(o.id).ok,id);return s.shopSystem.inventory.at(-1)?.id;}
  function enemy(id='grunt',extra={}){
    const e=createEnemy(s,{...ENEMIES[id],level:1},400,BALANCE.groundTopY);Object.assign(e,extra);s.enemies.push(e);return e;
  }
  function kill(id='grunt',extra={}){const e=enemy(id,extra),before=s.playerData.gold;s.combatSystem.killEnemy(e);return s.playerData.gold-before;}
  return {s,offer,buy,enemy,kill,sell(unit){assert(s.shopSystem.sell(unit).ok);},destroy(){s.skillSystem.reset();s.combatSystem.reset();s.runStats.destroy();emitter.removeAllListeners();}};
}
function fixedRandom(value,fn){const old=Math.random;Math.random=()=>value;try{return fn();}finally{Math.random=old;}}

assert.deepEqual(ids.map(id=>cfg(id).price),[160,64,60,70]);
assert(ids.every(id=>cfg(id).unique&&cfg(id).minVisit===2));

// The real generator and transaction reject a second copy, then allow it again after sale.
for(const id of ids){
  const f=fixture(),sys=f.s.shopSystem;sys.visits=2;
  const unit=f.buy(id),duplicate=f.offer(id),gold=f.s.playerData.gold;
  sys.currentItems=[duplicate];assert(!sys.canBuy(duplicate));assert(!sys.buy(duplicate.id).ok);
  assert.equal(f.s.playerData.gold,gold);assert(!sys.toggleLock(duplicate.id));
  for(let i=0;i<40;i++){sys.currentItems=[];sys.generateItems();assert(sys.currentItems.every(o=>o.itemId!==id));}
  f.sell(unit);assert(!sys.hasItem(id));
  assert(f.buy(id));assert.equal(sys.ownedItems().find(o=>o.itemId===id).units,1);f.destroy();
}

// All 54 real wave queues receive exactly the cumulative 20%, with unchanged group/level cadence.
{
  const base=fixture(),more=fixture();more.buy('calamity_banner');let original=0,expanded=0;
  fixedRandom(0.5,()=>{
    for(let group=0;group<18;group++)for(let wave=0;wave<3;wave++){
      for(const f of [base,more]){f.s.stageSystem.groupIndex=group;f.s.stageSystem.currentWave=wave;f.s.stageSystem.waveQueue=[];f.s.stageSystem.queueGroupWave(0);}
      original+=base.s.stageSystem.waveQueue.length;expanded+=more.s.stageSystem.waveQueue.length;
      assert.equal(expanded,original+Math.floor(original*.2));
      assert.equal(more.s.stageSystem.currentWaveSize,more.s.stageSystem.waveQueue.length);
      assert.equal(more.s.stageSystem.currentEnemyLevel,base.s.stageSystem.currentEnemyLevel);
      assert(more.s.stageSystem.waveQueue.every(o=>!ENEMIES[o.id].bossType));
    }
  });
  assert.equal(more.s.stageSystem.wavesPerGroup(),3);
  more.s.stageSystem.reset();assert.equal(more.s.stageSystem.economySpawnCount,0);
  base.destroy();more.destroy();
}
// Extra enemies can be elites, retain front/back ordering, and stop after the banner is sold.
{
  const f=fixture(),stage=f.s.stageSystem,unit=f.buy('calamity_banner');stage.groupIndex=5;stage.currentWave=2;
  fixedRandom(0,()=>stage.queueGroupWave(0));
  assert.equal(stage.waveQueue.length,9);assert.equal(stage.waveQueue.filter(o=>o.id==='elite').length,2);
  assert.equal(stage.waveQueue[0].id,'elite');assert.equal(stage.waveQueue[1].id,'elite');
  f.sell(unit);stage.waveQueue=[];stage.currentWave=2;stage.queueGroupWave(0);assert.equal(stage.waveQueue.length,8);f.destroy();
}
// Boss-rush overflow waits at the actual live cap, drains fully, then spawns exactly one Boss.
{
  const f=fixture(),s=f.s,stage=s.stageSystem;f.buy('calamity_banner');
  fixedRandom(0.5,()=>{stage.startRush('boss6');stage.updateRush(0);});
  const total=stage.waveQueue.length;assert.equal(total,33);
  stage.drainWaveQueue(100000);assert.equal(s.enemies.length,BALANCE.enemyPopulation.hardCap);
  assert.equal(stage.waveQueue.length,total-BALANCE.enemyPopulation.hardCap);assert(!stage.waveSpawnFinished);
  stage.updateRush(100000);assert(!stage.bossSpawned);
  s.enemies=[];stage.drainWaveQueue(100001);assert.equal(s.enemies.length,total-BALANCE.enemyPopulation.hardCap);
  assert.equal(stage.waveQueue.length,0);s.enemies=[];stage.updateRush(100002);
  assert.equal(s.enemies.length,1);assert(s.enemies[0].isBoss);assert.equal(s.enemies[0].flowBossType,'boss6');
  f.destroy();
}
for(const mode of ['normal','test']){
  const f=fixture(mode),s=f.s,stage=s.stageSystem,cap=BALANCE.enemyPopulation.hardCap;
  stage.waveState='spawning';stage.waveQueue=Array.from({length:cap+2},()=>({id:'grunt',at:0,x:800}));
  stage.drainWaveQueue(10000);assert.equal(s.enemies.length,cap);assert.equal(stage.waveQueue.length,2);
  s.enemies=[];stage.drainWaveQueue(10001);assert.equal(s.enemies.length,2);assert(stage.waveSpawnFinished);f.destroy();
}

// Actual kills accumulate low-value gold, include flat bounties, and keep non-kill income separate.
{
  const f=fixture(),s=f.s,unit=f.buy('greed_seal');
  assert.deepEqual(Array.from({length:4},()=>f.kill()),[1,1,1,2]);
  assert.equal(s.runStats.stats.goldSources.greed,1);near(s.playerData.killGoldRemainder,0);
  f.buy('fortune_coin');assert.equal(f.kill(),2);assert.equal(f.kill(),3);
  const e=f.enemy();e.hp=1;const gold=s.playerData.gold;
  s.combatSystem.damageEnemy(e,100,{source:'skill',tags:['physical'],noKnockback:true});assert(e.isDefeated);assert.equal(s.playerData.gold-gold,2);
  const remainder=s.playerData.killGoldRemainder;
  for(const id of ['grunt','elite','berserker_boss'])assert.equal(f.kill(id,{noGoldReward:true}),0);
  near(s.playerData.killGoldRemainder,remainder);
  const earned=s.runStats.stats.goldSources.greed;s.awardGold(100,'shopInterest');
  assert.equal(s.runStats.stats.goldSources.greed,earned);near(s.playerData.killGoldRemainder,remainder);
  f.sell(unit);near(s.playerData.killGoldRemainder,0);assert.equal(f.kill(),2);f.destroy();
}
for(const [id,bounty,expected] of [['elite','bounty_badge',115],['berserker_boss','boss_contract',150],['mid_boss','boss_contract',350]]){
  const f=fixture();f.buy('greed_seal');f.buy(bounty);
  assert.equal(Array.from({length:4},()=>f.kill(id)).reduce((a,b)=>a+b,0),expected,id+' boosted actual income');f.destroy();
}
// The penalty is applied after ordinary mitigation and to both direct and ongoing damage.
{
  const f=fixture(),s=f.s,unit=f.buy('greed_seal');
  s.combatSystem.damagePlayer(null,100,{undodgeable:true});assert.equal(s.playerData.hp,390);
  s.playerData.hp=500;s.playerData.defense=10;
  s.combatSystem.damagePlayer(null,110,{undodgeable:true});assert.equal(s.playerData.hp,390);
  s.playerData.hp=500;s.playerData.defense=0;
  s.combatSystem.damagePlayer(null,40,{source:'poison',undodgeable:true});assert.equal(s.playerData.hp,456);
  f.sell(unit);s.playerData.hp=500;s.combatSystem.damagePlayer(null,100,{undodgeable:true});assert.equal(s.playerData.hp,400);f.destroy();
}

// Interest starts at the next new shop, floors once, caps at 30, and never pays for reopens or refreshes.
{
  const f=fixture(),s=f.s,sys=s.shopSystem,unit=f.buy('golden_piggy_bank');
  assert.equal(s.runStats.stats.goldEarned,0);s.playerData.gold=289;sys.closeCurrent();assert(sys.open('second'));
  assert.equal(s.playerData.gold,317);assert.equal(s.runStats.stats.goldSources.shopInterest,28);
  assert(!sys.open('second'));assert.equal(s.playerData.gold,317);
  assert(sys.refresh().ok);assert.equal(s.playerData.gold,313);assert.equal(s.runStats.stats.goldEarned,28);
  f.sell(unit);sys.closeCurrent();const before=s.playerData.gold;
  assert(!sys.open('second'));assert.equal(s.playerData.gold,before);
  assert(sys.open('third'));assert.equal(s.playerData.gold,before);f.destroy();
}
{
  const f=fixture(),s=f.s,sys=s.shopSystem;f.buy('golden_piggy_bank');f.buy('greed_seal');
  s.playerData.gold=1000;sys.closeCurrent();sys.open('cap');assert.equal(s.playerData.gold,1030);
  assert.equal(s.runStats.stats.goldSources.shopInterest,30);assert.equal(s.runStats.stats.goldSources.greed,undefined);
  s.playerData.gold=0;sys.closeCurrent();sys.open('empty');assert.equal(s.playerData.gold,0);f.destroy();
}

// Discount quotes are generated once, include skill levels, preserve locks, and refund actual paid prices.
{
  const f=fixture(),s=f.s,sys=s.shopSystem,card=f.offer('merchant_gold_card'),locked=f.offer('war_axe'),old=f.offer('giant_blade');
  sys.currentItems=[card,locked,old];assert(sys.toggleLock(locked.id));
  const before=s.playerData.gold;assert(sys.buy(card.id).ok);assert.equal(s.playerData.gold,before-70);
  assert.equal(locked.price,148);assert.equal(old.price,58,'existing quotes stay fixed');
  const gold=s.playerData.gold;assert(sys.refresh().ok);assert.equal(s.playerData.gold,gold-4);
  assert.equal(sys.currentItems[1],locked);assert.equal(locked.price,148);
  for(const o of sys.currentItems.filter(o=>o!==locked)){
    const raw=o.kind==='skill'?SHOP_SKILL_PRICES[o.rarity]+o.fromLevel*2:cfg(o.itemId).price;
    assert.equal(o.price,Math.max(1,Math.floor(raw*.9)));
  }
  s.skillSystem.addOrLevel('healing');
  const own=SKILLS.healing,skills=s.playerData.skills;
  s.playerData.skills=Object.keys(SKILLS).filter(id=>id!==own.id).map(id=>({id,level:SKILLS[id].maxLevel}));
  s.playerData.skills.push({id:'healing',level:1});const skill=sys.skillOffer();
  assert.equal(skill.skillId,'healing');assert.equal(skill.price,Math.floor((SHOP_SKILL_PRICES[own.rarity]+2)*.9));s.playerData.skills=skills;
  const o=sys.currentItems.find(o=>o.kind==='item'&&o!==locked);assert(o);
  const paid=o.price;assert(sys.buy(o.id).ok);const unit=sys.inventory.at(-1);
  const saleGold=s.playerData.gold;f.sell(unit.id);assert.equal(s.playerData.gold-saleGold,Math.floor(paid/2));
  const cardUnit=sys.inventory.find(o=>o.itemId==='merchant_gold_card');f.sell(cardUnit.id);
  sys.currentItems=[locked];const originalPrice=locked.price;sys.closeCurrent();sys.open('next');
  assert.equal(sys.currentItems[0],locked);assert.equal(locked.price,originalPrice);
  assert(sys.currentItems.filter(o=>o.kind==='item'&&o!==locked).every(o=>o.price===cfg(o.itemId).price));f.destroy();
}
// Real shop text shows the transaction quote and each complete mechanism fits the three-line item area.
{
  const f=fixture(),s=f.s;const panel=s.shopPanel=new ShopPanel(s);
  for(const id of ids)assert(panel.wrap(cfg(id).description,25).length<=3,id+' complete description');
  f.buy('merchant_gold_card');s.shopSystem.visits=2;s.shopSystem.currentItems=[];s.shopSystem.generateItems();
  const o=s.shopSystem.currentItems.find(o=>o.kind==='item');panel.show({items:s.shopSystem.currentItems,reason:'fixture'});
  panel.selectedId=o.id;panel.render();assert(panel.nodes.some(n=>n.text==='购买 · '+o.price+' 金币'));
  panel.hide({resume:false});assert.equal(panel.nodes.length,0);f.destroy();
}

// Fresh runs clear economic state; explicitly supplied modifiers cannot alter legacy mode.
{
  const f=fixture();ids.forEach(f.buy);f.kill();
  f.s.playerData=createPlayerRuntime();f.s.shopSystem.reset();f.s.stageSystem.reset();f.s.combatSystem.reset();
  assert.equal(f.s.stageSystem.economySpawnCount,0);assert.equal(f.s.shopSystem.inventory.length,0);
  assert.equal(f.kill(),1);f.s.combatSystem.damagePlayer(null,100,{undodgeable:true});assert.equal(f.s.playerData.hp,400);f.destroy();
}
{
  const f=fixture('test'),s=f.s;
  Object.assign(s.playerData,{enemyCountBonus:.2,killGoldBonusRate:.25,damageTakenBonus:.1,shopInterestRate:.1,shopInterestCap:30,shopDiscount:.1});
  s.stageSystem.queueGroupWave(0);assert.equal(s.stageSystem.waveQueue.length,FLOW_GROUPS[0].waves[0]);
  assert.equal(f.kill(),1);s.combatSystem.damagePlayer(null,100,{undodgeable:true});assert.equal(s.playerData.hp,400);
  s.playerData.gold=1000;s.shopSystem.closeCurrent();s.shopSystem.open('next');assert.equal(s.playerData.gold,1000);
  assert(s.shopSystem.currentItems.every(o=>LEGACY_SHOP_ITEMS.some(old=>old.id===o.id&&old.price===o.price)));
  assert.equal(s.shopSystem.discountPrice(100),100);f.destroy();
}
console.log('PASS 01163: 4 unique economic goods; cumulative waves/elites/rushes/live-cap queues; real kill income/risk penalty; once-only interest/cap; discount/skills/locks/refunds/UI; sale, restart and legacy isolation.');
