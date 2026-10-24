import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {SHOP_ITEMS,LEGACY_SHOP_ITEMS} from '../src/config/shopItems.js';
import {BALANCE,createPlayerRuntime,getEffectiveAttack} from '../src/config/balance.js';
import {CombatEvents} from '../src/core/CombatEvents.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import StageSystem from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import MovementSystem from '../src/systems/MovementSystem.js';
import GameSpeedSystem from '../src/systems/GameSpeedSystem.js';

global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,k){return k==='getImageData'?()=>({data:[0,0,0,0]}):()=>{};}});},style:{}};}};
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
global.Image=class {set src(v){setTimeout(()=>this.onload?.(),0);}};
global.HTMLCanvasElement=class {};
const {default:ShopSystem}=await import('../src/systems/ShopSystem.js');
const {default:SkillSystem}=await import('../src/systems/SkillSystem.js');
const {default:PlayerInfoPanel}=await import('../src/ui/PlayerInfoPanel.js');
const game=fs.readFileSync(new URL('../src/scenes/GameScene.js',import.meta.url),'utf8');
const HealScene=vm.runInNewContext('(class {'+game.slice(game.indexOf('  healPlayer('),game.indexOf('  queueShop('))+'})',{CombatEvents});
const near=(a,b,label='number')=>assert(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
function node(x=0,y=0,width=0,height=0){
  const n={x,y,width,height,active:true,callbacks:{},text:'',setPosition(x,y){this.x=x;this.y=y;return this;},
    setText(v){this.text=v;return this;},setX(x){this.x=x;return this;},destroy(){this.active=false;},
    on(event,fn){this.callbacks[event]=fn;return this;},removeAllListeners(){this.callbacks={};},add(){return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;}};
  for(const name of ['setStrokeStyle','setDepth','setOrigin','setVisible','setAlpha','setFillStyle','setScale','setScrollFactor','setInteractive',
    'clear','lineStyle','lineBetween','strokeCircle','strokeRect','fillStyle','fillRect','setRotation','fillRoundedRect','strokeRoundedRect',
    'fillCircle','fillEllipse','strokeEllipse','fillTriangle','strokeTriangle','beginPath','moveTo','lineTo','closePath','strokePath','fillPath','strokePoints','fillPoints'])n[name]=()=>n;
  n.body={enable:true,velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){n.x=x;n.y=y;},setAllowGravity(){},setImmovable(){},setSize(){},setOffset(){}};
  return n;
}
function fixture(mode='normal',enemyId='grunt'){
  const s=Object.assign(new HealScene(),{runMode:mode,now:0,paused:false,enemies:[],killCount:0,runState:'RUNNING',
    balance:{...BALANCE,stageWorldWidth:4000,groundTopY:1000},player:node(400,960,45,78),playerData:createPlayerRuntime(),
    cameras:{main:{worldView:{x:0,width:720},width:720,scrollX:0}},getGameplayTime(){return this.now;},isGameplayPaused(){return this.paused;},
    physics:{add:{existing(){}}},hud:{update(){},setStatus(){}},skillBar:{update(){}},playerHealthBar:{update(){}},floatText(){},
    eventBus:{on(){return ()=>{};},emit(){}},events:{on(){},once(){},off(){}},time:{delayedCall(){return {remove(){}};}},
    artifactSystem:{level:()=>0,highHpDamageMultiplier:()=>1},shopPanel:{show(){}},
    add:{rectangle:node,text:(x,y,t)=>Object.assign(node(x,y),{text:t}),circle:node,ellipse:node,triangle:node,container:node,graphics:node},
    tweens:{add(config){return {config,stop(){},remove(){},pause(){},resume(){}};}},
    onShopClosed(){this.paused=false;}});
  s.playerData.gold=100000;s.playerData.critChance=0;
  s.targeting=new TargetingSystem(s);s.combatSystem=new CombatSystem(s);s.stageSystem=new StageSystem(s);
  s.skillSystem=new SkillSystem(s);s.shopSystem=new ShopSystem(s);
  const e=s.stageSystem.spawn(enemyId,500);
  return {s,e,c:s.combatSystem,p:s.playerData,at(t){s.now=t;return s.combatSystem.updateHealthRegen(t);},
    destroy(){s.skillSystem.reset();s.combatSystem.reset();}};
}
function give(f,id){
  const sys=f.s.shopSystem,item=SHOP_ITEMS.find(x=>x.id===id);assert(item,id);
  const prior=sys.currentShopReason;sys.currentShopReason='fixture';
  const offer={...item,itemId:item.id,id:'qa_'+(++sys.serial)};sys.currentItems=[offer];
  assert(sys.buy(offer.id).ok,id+' bought through production transaction');sys.currentShopReason=prior;
  return sys.inventory.at(-1)?.id??null;
}
function sell(f,unit){const sys=f.s.shopSystem,prior=sys.currentShopReason;sys.currentShopReason='fixture';assert(sys.sell(unit).ok);sys.currentShopReason=prior;}

assert.equal(SHOP_ITEMS.length,47);assert.equal(new Set(SHOP_ITEMS.map(x=>x.id)).size,47);
assert.equal(SHOP_ITEMS.filter(x=>(x.minVisit||1)===1).length,24);
assert.equal(SHOP_ITEMS.filter(x=>x.minVisit===2).length,15);
assert.equal(SHOP_ITEMS.filter(x=>x.minVisit===3).length,4);
assert.equal(SHOP_ITEMS.filter(x=>x.minVisit===5).length,4);
assert.deepEqual(SHOP_ITEMS.slice(24).map(x=>x.price),[58,64,54,76,50,58,56,54,110,148,150,250,300,300,330,360,80,36,48,160,64,60,70]);

// The real generator retains four slots, 25% skill rolls, low-price choices and visit gating.
{
  const f=fixture(),sys=f.s.shopSystem,seen=new Set();let seed=20261016;
  sys.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let visit=1;visit<=6;visit++){
    sys.closeCurrent();assert(sys.open('visit_'+visit));assert.equal(sys.visits,visit);
    for(let roll=0;roll<200;roll++){
      sys.currentItems=[];sys.generateItems();assert.equal(sys.currentItems.length,4);
      assert.equal(new Set(sys.currentItems.map(x=>x.itemId)).size,4);
      const items=sys.currentItems.filter(x=>x.kind==='item');
      assert(items.every(x=>(x.minVisit||1)<=visit&&(!x.maxVisit||visit<=x.maxVisit)));assert(items.filter(x=>x.price<=16).length>=2);
      assert(items.some(x=>x.price<=12));assert(sys.currentItems.filter(x=>x.kind==='skill').length<=1);
      items.forEach(x=>seen.add(x.itemId));
    }
  }
  assert.equal(seen.size,47,'every declared item can actually appear');
  sys.visits=5;sys.currentItems=[];
  for(let i=0;!sys.currentItems.some(x=>x.price>=300)&&i<100;i++){sys.currentItems=[];sys.generateItems();}
  const rare=sys.currentItems.find(x=>x.price>=300);assert(rare);assert(sys.toggleLock(rare.id));
  const slot=sys.currentItems.indexOf(rare),price=rare.price;sys.closeCurrent();assert(sys.open('next_visit'));
  assert.equal(sys.currentItems[slot],rare);assert.equal(rare.price,price,'cross-shop lock preserves price and identity');
  f.destroy();
}

// Small normal-mode healing accumulates after the healing modifier; full health stores nothing.
{
  const f=fixture();give(f,'regen_sprout');f.p.hp=100;
  assert.equal(f.at(1000),0);assert.equal(f.p.hp,100);assert.equal(f.at(2000),1);assert.equal(f.p.hp,101);
  f.s.enemies=[];assert.equal(f.at(4000),1,'travel and empty-wave windows regenerate too');
  const unit=give(f,'revival_leaf');near(f.s.combatSystem.healthRegenRemainder,0);
  f.p.hp=100;f.c.reset();f.at(44000);assert.equal(f.p.hp,121,'40 seconds at .5/s with +5% healing gives 21');
  sell(f,unit);f.p.hp=f.p.maxHp;f.at(84000);f.p.hp=100;f.at(85000);assert.equal(f.p.hp,100,'full-health time is not banked');
  f.p.hp=0;f.at(100000);assert.equal(f.p.hp,0,'regeneration cannot revive');f.destroy();
}
{
  const f=fixture();give(f,'regen_sprout');f.p.hp=100;f.s.skillSystem.passiveState.lastStand={active:true};
  f.at(1000);assert.equal(f.c.healthRegenRemainder,0);f.s.skillSystem.passiveState.lastStand.active=false;
  f.at(2000);assert.equal(f.p.hp,100,'blocked healing is not saved');f.destroy();
}
// Actual shop-preparation state blocks natural regeneration, while ordinary wave gaps permit it.
{
  const f=fixture();give(f,'regen_orb');f.p.hp=100;f.s.enemies=[];
  const stage=f.s.stageSystem;stage.groupIndex=2;stage.currentGroup=3;stage.currentWave=3;stage.waveSpawnFinished=true;
  assert(stage.isBossPrepGroup());f.at(5000);assert.equal(f.p.hp,100,'pre-shop settlement gives no healing');
  stage.flowState='SHOP';f.at(10000);assert.equal(f.p.hp,100,'shop gives no healing');
  f.s.shopSystem.open('merchant');assert.equal(f.p.hp,100,'opening shop never refills health');f.s.shopSystem.closeCurrent();
  stage.flowState='GROUP_COMBAT';stage.groupIndex=3;stage.currentGroup=4;stage.currentWave=1;stage.waveSpawnFinished=false;
  f.at(11000);assert.equal(f.p.hp,102,'no catch-up for time spent entering or in the shop');
  f.s.paused=true;f.at(21000);f.s.paused=false;f.at(22000);assert.equal(f.p.hp,104,'pause interval not regenerated');f.destroy();
}
{
  const f=fixture();give(f,'regen_orb');f.p.hp=100;const clock=new GameSpeedSystem(f.s);clock.setSpeed(2);
  f.at(clock.advance(1000));assert.equal(f.p.hp,104,'two-speed advances two gameplay seconds');
  f.at(clock.advance(5000,true));assert.equal(f.p.hp,104,'paused clock adds no recovery');clock.destroy();f.destroy();
}
{
  const f=fixture();give(f,'regen_sprout');f.p.hp=100;f.at(1000);
  f.c.shiftTimers(10000,1000);f.at(12000);assert.equal(f.p.hp,101,'legacy timer shifting excludes the paused interval');
  f.c.reset();assert.equal(f.c.healthRegenRemainder,0);assert.equal(f.c.lifeStealRemainder,0);f.destroy();
}
{
  const f=fixture('test');give(f,'regen_orb');f.p.hp=100;f.at(10000);assert.equal(f.p.hp,100,'new natural regeneration stays normal-only');
  f.s.shopSystem.open('test');assert(f.s.shopSystem.currentItems.every(x=>LEGACY_SHOP_ITEMS.some(y=>y.id===x.id)));f.destroy();
}
// Low-damage life steal uses the real normal-mode damage/heal pipeline and keeps its fractions.
{
  const f=fixture();give(f,'blood_fang');f.p.hp=100;
  f.e.hp=f.e.maxHp=1000;
  for(let i=0;i<5;i++)f.c.damageEnemy(f.e,20,{source:'attack',tags:['physical'],noKnockback:true});
  assert.equal(f.e.hp,900,'five actual hits feed life steal');
  assert.equal(f.p.hp,102);near(f.c.lifeStealRemainder,0);
  give(f,'revival_leaf');f.p.hp=100;
  for(let i=0;i<50;i++)f.c.applyLifeSteal(20,{source:'attack'});
  assert.equal(f.p.hp,121,'healing multiplier is applied exactly once');
  const hp=f.p.hp;f.c.applyLifeSteal(1000,{source:'burn'});assert.equal(f.p.hp,hp);
  f.p.hp=f.p.maxHp;f.c.applyLifeSteal(10000,{source:'attack'});f.p.hp=100;f.c.applyLifeSteal(20,{source:'attack'});
  assert.equal(f.p.hp,100,'full-health life steal is not banked');
  f.p.hp=0;f.c.applyLifeSteal(10000,{source:'attack'});assert.equal(f.p.hp,0);f.c.reset();assert.equal(f.c.lifeStealRemainder,0);f.destroy();
}
{
  const f=fixture('test');f.p.lifeSteal=.02;f.p.hp=100;for(let i=0;i<5;i++)f.c.applyLifeSteal(20,{source:'attack'});
  assert.equal(f.p.hp,100,'test mode retains its previous per-hit rounding');f.destroy();
}
// Fixed penetration follows percentage penetration, clamps defense at zero, and cannot affect nonphysical/resolved damage.
for(const id of ['grunt','elite','boss']){
  const f=fixture('normal',id);give(f,'armor_piercer');f.e.hp=f.e.maxHp=1000;f.e.defense=10;f.e.damageReduction=0;
  f.c.damageEnemy(f.e,20,{source:'skill',tags:['physical'],defenseIgnore:.5,noKnockback:true});assert.equal(f.e.hp,984,id);
  f.e.hp=1000;f.c.damageEnemy(f.e,20,{source:'skill',tags:['magic'],noKnockback:true});assert.equal(f.e.hp,990);
  f.e.hp=1000;f.c.damageEnemy(f.e,20,{source:'skill',tags:['physical'],damageAlreadyResolved:true,noKnockback:true});assert.equal(f.e.hp,980);
  f.e.hp=1000;f.e.defense=0;f.c.damageEnemy(f.e,20,{source:'skill',tags:['physical'],noKnockback:true});assert.equal(f.e.hp,980);
  f.destroy();
}
// Range, movement, strength and mana restoration use the existing production systems.
{
  const f=fixture();const unit=give(f,'ward_scale');
  f.c.damagePlayer(f.e,100,{source:'enemyMelee'});assert.equal(f.p.hp,402,'2% mitigation changes actual incoming damage');
  sell(f,unit);f.c.damagePlayer(f.e,100,{source:'enemyMelee'});assert.equal(f.p.hp,302,'selling removes mitigation');f.destroy();
}
{
  const f=fixture();f.p.hp=100;f.p.mana=10;
  const heart=give(f,'blood_core');assert.equal(f.p.maxHp,1500);assert.equal(f.p.hp,1100);
  sell(f,heart);assert.equal(f.p.maxHp,500);assert.equal(f.p.hp,100,'large resource items cannot buy/sell for free healing');
  const core=give(f,'eternal_mana_core');assert.equal(f.p.maxMana,300);assert.equal(f.p.mana,210);
  sell(f,core);assert.equal(f.p.maxMana,100);assert.equal(f.p.mana,10);f.destroy();
}
{
  const f=fixture();give(f,'long_handle');f.s.player.x=f.e.x-90;f.s.player.y=f.e.y;
  new MovementSystem(f.s).update(0);assert.equal(f.s.player.body.velocity.x,0,'stop at the upgraded attack distance');
  const hp=f.e.hp;f.c.update(0);assert(f.e.hp<hp,'real attack reaches 90px with the range item');f.destroy();
}
{
  const f=fixture();const unit=give(f,'gale_crown');f.s.player.x=0;
  new MovementSystem(f.s).update(0);near(f.s.player.body.velocity.x,148.925);
  sell(f,unit);new MovementSystem(f.s).update(0);near(f.s.player.body.velocity.x,129.5);
  const before=getEffectiveAttack(f.p),axe=give(f,'war_axe');assert.equal(getEffectiveAttack(f.p),before+18);sell(f,axe);assert.equal(getEffectiveAttack(f.p),before);f.destroy();
}
{
  const f=fixture();give(f,'eternal_mana_core');f.p.mana=0;
  f.s.skillSystem.updateManaRegen(0);const initial=f.p.mana;f.s.now=1000;f.s.skillSystem.updateManaRegen(1000);
  near(f.p.mana-initial,5,'base 2 + item 3 mana each second');f.destroy();
}
// The actual panel reports effective values; each new attribute remains visible after UI refresh.
{
  const f=fixture();give(f,'light_boots');give(f,'armor_piercer');give(f,'regen_sprout');give(f,'revival_leaf');give(f,'mana_crystal');
  const panel=new PlayerInfoPanel(f.s);panel.show();assert.equal(panel.pageText.text,'1/3');
  assert.equal(panel.valueNodes.get('moveSpeed').text,'移动速度：135.98/秒');
  assert.equal(panel.valueNodes.get('armorPenetration').text,'固定破甲：1');
  panel.flip(1);assert.equal(panel.pageText.text,'2/3');assert.equal(panel.valueNodes.get('healthRegen').text,'每秒回血：0.53/秒');
  assert.equal(panel.valueNodes.get('manaRegen').text,'每秒回蓝：2.2/秒');
  const nodes=panel.nodes.length;for(let i=0;i<20;i++)panel.update(i*101);assert.equal(panel.nodes.length,nodes);
  for(const n of panel.content)assert((n.y??442)<850,'new resource page fits before the buttons');
  panel.flip(1);assert.equal(panel.pageText.text,'3/3');panel.flip(1);assert.equal(panel.pageText.text,'1/3');panel.hide();assert.equal(panel.nodes.length,0);f.destroy();
}
console.log('PASS 01158: all 47 items reachable within visit limits; locks and budget choices; fractional regen/life steal, healing modifiers, no pre-shop heal, pause/speed/death/reset; normal/elite/boss penetration; actual range/movement/strength/mana and 3-page panel.');
