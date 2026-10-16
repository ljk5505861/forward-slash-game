import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import CombatSystem from '../src/systems/CombatSystem.js';
import StageSystem from '../src/systems/StageSystem.js';
import GameSpeedSystem from '../src/systems/GameSpeedSystem.js';
import {BALANCE,createPlayerRuntime} from '../src/config/balance.js';
import {SHOP_ITEMS} from '../src/config/shopItems.js';
import {CombatEvents,RunStates} from '../src/core/CombatEvents.js';

global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,k){return k==='getImageData'?()=>({data:[0,0,0,0]}):()=>{};}});},style:{}};}};
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
global.Image=class {set src(v){setTimeout(()=>this.onload?.(),0);}};
global.HTMLCanvasElement=class {};
const {default:PlayerInfoPanel}=await import('../src/ui/PlayerInfoPanel.js');
const game=fs.readFileSync(new URL('../src/scenes/GameScene.js',import.meta.url),'utf8');
const start=game.slice(game.indexOf('  startRun(mode){'),game.indexOf('  showStartingSkillChoice(){'));
const heal=game.slice(game.indexOf('  healPlayer('),game.indexOf('  queueShop('));
const RunScene=vm.runInNewContext('(class {'+start+heal+'})',{RunStates,CombatEvents});
function node(x=0,y=0,width=0,height=0){
  const n={x,y,width,height,active:true,setPosition(x,y){this.x=x;this.y=y;return this;},setText(){return this;},add(){return this;}};
  for(const key of ['setStrokeStyle','setDepth','setOrigin','setVisible','setAlpha','setFillStyle','setDisplaySize'])n[key]=()=>n;
  n.body={setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){},setVelocityX(){}};
  return n;
}
function fixture(mode='normal'){
  const s=Object.assign(new RunScene(),{runMode:null,now:0,paused:true,enemies:[],playerData:createPlayerRuntime(),
    balance:BALANCE,runState:RunStates.STARTING,getGameplayTime(){return this.now;},isGameplayPaused(){return this.paused;},
    endGameplayPause(){this.paused=false;},showStartingSkillChoice(){},hud:{update(){},setStatus(){}},
    skillSystem:{passiveState:{}},eventBus:{emit(){}},physics:{add:{existing(){}}},
    add:{rectangle:node,text:(x,y)=>node(x,y),circle:node,container:node}});
  s.stageSystem=new StageSystem(s);s.stageSystem.start=()=>{};
  assert(s.startRun(mode));
  const c=s.combatSystem=new CombatSystem(s),p=s.playerData;
  return {s,c,p,at(t){s.now=t;return c.updateHealthRegen(t);}};
}
for(let restart=0;restart<2;restart++)for(const mode of ['normal','test']){
  const f=fixture(mode);assert.equal(f.p.healthRegenPerSecond||0,mode==='normal'?1:0);
  assert.equal(f.s.startRun(mode),false,'duplicate entry cannot stack the base rate');
  f.s.paused=false;f.p.hp=100;
  f.at(500);assert.equal(f.p.hp,100,'fractional time is accumulated');
  f.at(1000);assert.equal(f.p.hp,mode==='normal'?101:100,'real startRun feeds real healing');
  f.c.reset();assert.equal(f.p.healthRegenPerSecond||0,mode==='normal'?1:0,'combat reset does not remove base attributes');
}
{
  const f=fixture(),sprout=SHOP_ITEMS.find(x=>x.id==='regen_sprout'),leaf=SHOP_ITEMS.find(x=>x.id==='revival_leaf');
  const panel=new PlayerInfoPanel(f.s);panel.page=1;
  assert.equal(panel.snapshot().get('healthRegen'),'1/秒');
  sprout.effect(f.p);assert.equal(panel.snapshot().get('healthRegen'),'1.5/秒');
  leaf.effect(f.p);assert.equal(panel.snapshot().get('healthRegen'),'1.58/秒');
  f.p.hp=100;f.at(40000);assert.equal(f.p.hp,163,'(1 base + .5 item) × 1.05 heals 63 over 40 seconds');
  sprout.remove(f.p);leaf.remove(f.p);assert.equal(panel.snapshot().get('healthRegen'),'1/秒');
  f.at(41000);assert.equal(f.p.hp,164,'removing item bonuses preserves base regeneration');
}
{
  const f=fixture();f.at(10000);f.p.hp=100;f.at(11000);assert.equal(f.p.hp,101,'no full-health banking');
  f.p.hp=0;f.at(20000);assert.equal(f.p.hp,0,'base healing cannot revive');
}
{
  const f=fixture();f.p.hp=100;f.s.skillSystem.passiveState.lastStand={active:true};
  f.at(10000);assert.equal(f.p.hp,100);f.s.skillSystem.passiveState.lastStand.active=false;
  f.at(11000);assert.equal(f.p.hp,101,'blocked recovery is not banked');
}
{
  const f=fixture(),stage=f.s.stageSystem;f.p.hp=100;
  stage.groupIndex=2;stage.currentGroup=3;stage.currentWave=3;stage.waveSpawnFinished=true;
  assert(stage.isBossPrepGroup());f.at(5000);assert.equal(f.p.hp,100,'pre-shop settlement does not recover');
  stage.flowState='SHOP';f.at(10000);assert.equal(f.p.hp,100,'shop does not recover');
  stage.flowState='GROUP_COMBAT';stage.groupIndex=3;stage.currentGroup=4;stage.waveSpawnFinished=false;
  f.at(11000);assert.equal(f.p.hp,101,'ordinary travel/wave gaps recover with no catch-up');
  f.s.pendingShop={};f.at(16000);assert.equal(f.p.hp,101);f.s.pendingShop=null;
  f.s.shopSystem={currentShopReason:'merchant'};f.at(21000);assert.equal(f.p.hp,101);f.s.shopSystem.currentShopReason=null;
  f.s.paused=true;f.at(31000);assert.equal(f.p.hp,101);f.s.paused=false;
  f.at(32000);assert.equal(f.p.hp,102,'paused/pre-shop/shop time never becomes extra healing');
}
for(const speed of [1,1.5,2]){
  const f=fixture();f.p.hp=100;const clock=new GameSpeedSystem(f.s);clock.setSpeed(speed);
  f.at(clock.advance(2000));assert.equal(f.p.hp,100+2*speed,'healing follows gameplay time');
  f.at(clock.advance(10000,true));assert.equal(f.p.hp,100+2*speed);clock.destroy();
}
for(const mode of ['normal','test'])for(const level of [1,2,10,19]){
  const f=fixture(mode),stage=f.s.stageSystem;stage.currentEnemyLevel=level;
  const tuned=stage.tunedEnemy('armored_guard'),e=stage.spawn('armored_guard',600);
  assert.equal(e.hp,tuned.hp);assert.equal(e.maxHp,tuned.hp,'spawned health bar uses reduced max health too');
  if(mode==='normal'){
    assert.equal(e.hp,Math.round(64*(1+(level-1)*.18)));
    assert(Math.abs(e.hp-Math.round(128*(1+(level-1)*.18))/2)<=.5,'half health, subject only to integer rounding');
    assert.equal(e.damage,tuned.damage*.5);assert.equal(e.attackIntervalMs,2400);assert.equal(e.behavior,'meat');
  }else assert.equal(e.behavior,'armored','test mode preserves its legacy enemy profile');
}
console.log('PASS 01160: actual normal start at 1 HP/s; fractional recovery, item stacking/removal and live panel, full/dead/last-stand guards, pre-shop/shop/pause/no catch-up, 1/1.5/2x; real meat spawn/maxHP at half base with original growth, attack and test-mode isolation.');
