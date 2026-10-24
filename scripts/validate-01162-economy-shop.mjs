import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { SHOP_ITEMS, LEGACY_SHOP_ITEMS } from '../src/config/shopItems.js';
import { BALANCE, createPlayerRuntime } from '../src/config/balance.js';
import { ENEMIES } from '../src/config/enemies.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import createEnemy from '../src/entities/createEnemy.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import RunStatsSystem from '../src/systems/RunStatsSystem.js';

global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,k){return k==='getImageData'?()=>({data:[0,0,0,0]}):()=>{};}});},style:{}};}};
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
global.Image=class {set src(v){setTimeout(()=>this.onload?.(),0);}};
global.HTMLCanvasElement=class {};
const {default:ShopSystem}=await import('../src/systems/ShopSystem.js');
const source=fs.readFileSync(new URL('../src/scenes/GameScene.js',import.meta.url),'utf8');
const awardGold=source.split('\n').find(line=>line.startsWith('  awardGold('));
const RewardScene=vm.runInNewContext('(class {'+awardGold+'})');
const ids=['fortune_coin','bounty_badge','boss_contract'];

function node(x=0,y=0,width=0,height=0){
  const n={x,y,width,height,active:true,destroy(){this.active=false;}};
  for(const name of ['add','setVisible','setStrokeStyle','setDepth','setOrigin','setScrollFactor','setDisplaySize','setAlpha','setPosition',
    'setText','setScale','clear','lineStyle','lineBetween','strokeCircle','fillStyle','fillCircle','fillPoints'])n[name]=()=>n;
  n.body={enable:true,setAllowGravity(){},setImmovable(){},setSize(){},setOffset(){},setVelocityX(){}};
  return n;
}
function fixture(mode='normal'){
  const emitter=new EventEmitter();
  const s=Object.assign(new RewardScene(),{runMode:mode,playerData:createPlayerRuntime(),balance:BALANCE,
    enemies:[],killCount:0,player:{x:0,y:800},getGameplayTime:()=>0,hud:{update(){}},
    events:{on(){},once(){},off(){}},eventBus:{on(e,fn){emitter.on(e,fn);return ()=>emitter.off(e,fn);},emit(e,p){emitter.emit(e,p);}},
    add:{rectangle:node,text:node,graphics:node,container:node},physics:{add:{existing(){}}},tweens:{add(){return {stop(){},remove(){}};}},
    statusEffects:{clearTarget(){}},enemyBehaviors:{destroyEnemy(){}},shopPanel:{show(){}},
    stageSystem:{clears:0,bosses:[],clearBossMinions(){this.clears++;},onBossKilled(id){this.bosses.push(id);}}});
  s.playerData.gold=10000;s.playerData.critChance=0;
  s.runStats=new RunStatsSystem(s);s.combatSystem=new CombatSystem(s);s.shopSystem=new ShopSystem(s);
  s.shopSystem.open('fixture');
  function enemy(id='grunt',extra={}){
    const e=createEnemy(s,{...ENEMIES[id],level:1},300,BALANCE.groundTopY);
    Object.assign(e,extra);s.enemies.push(e);return e;
  }
  function offer(id){
    const cfg=SHOP_ITEMS.find(item=>item.id===id);assert(cfg,id);
    const o={...cfg,itemId:id,id:'fixture_'+(++s.shopSystem.serial),locked:false};s.shopSystem.currentItems=[o];return o;
  }
  function buy(id){const o=offer(id);assert(s.shopSystem.buy(o.id).ok);return s.shopSystem.inventory.at(-1).id;}
  function kill(id,extra={},meta={}){
    const e=enemy(id,extra),before=s.playerData.gold;s.combatSystem.killEnemy(e,meta);
    return {enemy:e,gold:s.playerData.gold-before};
  }
  return {s,enemy,offer,buy,kill,destroy(){s.combatSystem.reset();s.runStats.destroy();emitter.removeAllListeners();}};
}

// The actual shop generator offers the items only while another useful shopping opportunity remains.
{
  const f=fixture(),sys=f.s.shopSystem;let seed=20261025;
  sys.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let visit=1;visit<=6;visit++){
    sys.visits=visit;const seen=new Set();
    for(let roll=0;roll<200;roll++){
      sys.currentItems=[];sys.generateItems();assert.equal(sys.currentItems.length,4);
      assert(sys.currentItems.filter(o=>o.kind==='item'&&o.price<=16).length>=2);
      for(const o of sys.currentItems)if(ids.includes(o.itemId))seen.add(o.itemId);
    }
    const expected=visit>=2&&visit<=4?ids:visit===5?ids.slice(0,2):[];
    assert.deepEqual([...seen].sort(),[...expected].sort(),'economic goods at visit '+visit);
  }
  assert.deepEqual(ids.map(id=>SHOP_ITEMS.find(o=>o.id===id).price),[80,36,48]);f.destroy();
}

// The purchase, stacking, sale and real kill paths keep each bounty independent and reversible.
{
  const f=fixture(),s=f.s,units=ids.map(id=>[f.buy(id),f.buy(id)]);
  assert.equal(s.runStats.stats.goldEarned,0,'purchases are not income');
  assert.equal(s.shopSystem.ownedItems().length,3);
  assert(s.shopSystem.ownedItems().every(o=>o.units===2));
  assert.equal(f.kill('grunt').gold,3);
  assert.equal(f.kill('elite').gold,31);
  assert.equal(f.kill('berserker_boss').gold,60);
  assert.equal(f.kill('mid_boss').gold,100,'mid boss retains its original 40 plus bounty');
  assert.equal(s.runStats.stats.goldSources.shopBounty,138);
  assert.equal(s.runStats.stats.goldEarned,194);
  const income=s.runStats.stats.goldEarned;
  units.forEach(([unit],i)=>{
    const before=s.playerData.gold;assert(s.shopSystem.sell(unit).ok);
    assert.equal(s.playerData.gold-before,[40,18,24][i]);assert(!s.shopSystem.sell(unit).ok);
  });
  assert.equal(s.runStats.stats.goldEarned,income,'sale refunds are not kill income');
  assert.equal(f.kill('grunt').gold,2);assert.equal(f.kill('elite').gold,23);
  assert.equal(f.kill('berserker_boss').gold,30);assert.equal(f.kill('mid_boss').gold,70);
  units.forEach(([,unit])=>assert(s.shopSystem.sell(unit).ok));
  assert.equal(f.kill('grunt').gold,1);assert.equal(f.kill('elite').gold,15);
  assert.equal(f.kill('berserker_boss').gold,0);assert.equal(f.kill('mid_boss').gold,40);
  assert.equal(s.playerData.normalKillGoldBonus,0);assert.equal(s.playerData.eliteKillGoldBonus,0);assert.equal(s.playerData.bossKillGoldBonus,0);
  f.destroy();
}

// Rewards arrive before death callbacks; repeated kills and non-gold summons cannot mint bounties.
{
  const f=fixture(),s=f.s;ids.forEach(f.buy);
  for(const id of ['grunt','elite','berserker_boss','mid_boss'])assert.equal(f.kill(id,{noGoldReward:true}).gold,0,id);
  let callbackGold;
  s.eventBus.on(CombatEvents.ENEMY_KILLED,({enemy})=>{
    if(enemy.enemyId==='grunt'){callbackGold=s.playerData.gold;s.combatSystem.killEnemy(enemy);}
  });
  const before=s.playerData.gold,{enemy:e,gold}=f.kill('grunt',{}, {source:'skill'});
  assert.equal(gold,2);assert.equal(callbackGold,before+2);
  s.combatSystem.killEnemy(e);assert.equal(s.playerData.gold,before+2);
  assert.equal(s.runStats.stats.goldSources.shopBounty,1);f.destroy();
}

// Deep Abyss bodies share one encounter bounty, matching the existing victory settlement.
{
  const f=fixture(),s=f.s;f.buy('boss_contract');
  const a=f.enemy('abyss_apostle',{flowBossType:'boss6'}),b=f.enemy('abyss_apostle',{flowBossType:'boss6'});
  const fight={members:new Set([a,b]),settled:false};a.abyssFight=fight;b.abyssFight=fight;
  const before=s.playerData.gold;s.combatSystem.killEnemy(a);
  assert.equal(s.playerData.gold,before);assert.equal(s.stageSystem.bosses.length,0);
  s.combatSystem.killEnemy(b);assert.equal(s.playerData.gold,before+30);
  assert.deepEqual(s.stageSystem.bosses,['boss6']);assert(fight.settled);
  s.combatSystem.killEnemy(a);s.combatSystem.killEnemy(b);assert.equal(s.playerData.gold,before+30);f.destroy();
}

// Locks preserve identity and original price even after fresh offers stop; refunds cannot retrigger income.
{
  const f=fixture(),sys=f.s.shopSystem;sys.visits=4;
  const o=f.offer('boss_contract');assert(sys.toggleLock(o.id));const slot=sys.currentItems.indexOf(o);
  const gold=f.s.playerData.gold;assert(sys.refresh().ok);assert.equal(f.s.playerData.gold,gold-4);
  assert.equal(sys.currentItems[slot],o);sys.closeCurrent();sys.visits=5;assert(sys.open('last'));
  assert.equal(sys.currentItems[slot],o);assert.equal(o.price,48);
  assert(sys.buy(o.id).ok);assert.equal(sys.ownedItems()[0].price,24);
  assert.equal(f.s.runStats.stats.goldEarned,0);f.destroy();
}

// A new run has no economic bonuses; test mode keeps the previous catalog and kill-gold amounts.
{
  const f=fixture();ids.forEach(f.buy);f.s.playerData=createPlayerRuntime();f.s.shopSystem.reset();f.s.combatSystem.reset();
  assert.equal(f.kill('grunt').gold,1);assert.equal(f.kill('elite').gold,15);
  assert.equal(f.kill('berserker_boss').gold,0);assert.equal(f.kill('mid_boss').gold,40);f.destroy();
}
{
  const f=fixture('test');assert(f.s.shopSystem.currentItems.every(o=>LEGACY_SHOP_ITEMS.some(old=>old.id===o.id)));
  // Supply the modifiers directly to prove mode isolation, independent of catalog gating.
  Object.assign(f.s.playerData,{normalKillGoldBonus:1,eliteKillGoldBonus:8,bossKillGoldBonus:30});
  assert.equal(f.kill('grunt').gold,1);assert.equal(f.kill('elite').gold,15);
  assert.equal(f.kill('berserker_boss').gold,0);assert.equal(f.kill('mid_boss').gold,40);
  assert.equal(f.s.runStats.stats.goldSources.shopBounty,undefined);f.destroy();
}
console.log('PASS 01162: 3 economic goods, real shop gating/budget/locks, kill-gold ledger, stacking/refunds/removal, summons, duplicate deaths, shared Boss victory, restart and legacy mode.');
