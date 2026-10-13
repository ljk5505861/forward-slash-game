import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import AbyssApostleBehavior from '../src/enemies/behaviors/AbyssApostleBehavior.js';
import EmperorBehavior from '../src/enemies/behaviors/EmperorBehavior.js';
import ForeseerBehavior,{ForeseerOrbBehavior} from '../src/enemies/behaviors/ForeseerBehavior.js';
import UncrownedKingBehavior from '../src/enemies/behaviors/UncrownedKingBehavior.js';
import ThornlessRoseBehavior from '../src/enemies/behaviors/ThornlessRoseBehavior.js';
import MountainGeneralBehavior from '../src/enemies/behaviors/MountainGeneralBehavior.js';
import CombatSystem,{isBossUsingSkill} from '../src/systems/CombatSystem.js';
import StageSystem,{LevelFlowStates as F} from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import StatusEffectSystem,{StatusEffects} from '../src/systems/StatusEffectSystem.js';
import {ABYSS_APOSTLE_TUNING as A} from '../src/config/enemies.js';
import {BALANCE} from '../src/config/balance.js';
import {CombatEvents} from '../src/core/CombatEvents.js';
import {getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull} from '../src/systems/EnemyGravityControl.js';
import {isEnemyFrozen,shiftEnemyColdTimers,applyEnemyCold} from '../src/systems/EnemyColdControl.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import {SKILLS} from '../src/config/skills.js';
import {SpiritWolvesSkill} from '../src/skills/handlers/SpiritWolvesSkill.js';
import {SpiritBirdSkill} from '../src/skills/handlers/SpiritBirdSkill.js';
import {MantraHeavenlyBookSkill,chooseMantraMode} from '../src/skills/handlers/MantraHeavenlyBookSkill.js';

// Execute the actual manager and factory; only the Phaser rendering import is shimmed.
const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ')
  .replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const imports={AbyssApostleBehavior,EmperorBehavior,ForeseerBehavior,ForeseerOrbBehavior,UncrownedKingBehavior,
  ThornlessRoseBehavior,MountainGeneralBehavior,getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,
  updateGravityPull,isEnemyFrozen,shiftEnemyColdTimers,Phaser:{Math:{Between:()=>0}}};
for(const name of ['MeatBehavior','DoctorBehavior','MasterBehavior','ShieldGuardBehavior','SharpshooterBehavior',
  'WarDrumPriestBehavior','EliteBerserkerBehavior','ThunderMageBehavior','HellEnvoyBehavior','HellSummonBehavior',
  'GamblerBehavior','GoldenHallGuardBehavior'])imports[name]=class {};
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',imports);

function node(x=0,y=0,w=0,h=0) {
  const n={x,y,width:w,height:h,active:true,alpha:1,circles:[],lines:[],rects:[],
    destroy(){this.active=false;this.destroyed=true;},setX(x){this.x=x;return this;},
    setPosition(x,y){this.x=x;this.y=y;return this;},setText(text){this.text=text;return this;},
    setAlpha(alpha){this.alpha=alpha;return this;},setFillStyle(color){this.color=color;return this;},add(){return this;},
    setDisplaySize(w,h){this.width=w;this.height=h;return this;},
    clear(){this.circles=[];this.lines=[];this.rects=[];return this;},strokeCircle(x,y,r){this.circles.push({x,y,r});return this;},
    strokeRect(x,y,width,height){this.rects.push({x,y,width,height});return this;},
    lineStyle(width,color,alpha){this.lineWidth=width;this.lineColor=color;this.lineAlpha=alpha;return this;},
    lineBetween(x1,y1,x2,y2){this.lines.push({x1,y1,x2,y2,width:this.lineWidth,color:this.lineColor});return this;}};
  for(const key of ['setStrokeStyle','setDepth','setOrigin','setVisible','setScale'])n[key]=()=>n;
  n.body={velocity:{x:0},enable:true,setVelocityX(v){this.velocity.x=v;},reset(x,y){n.x=x;n.y=y;},
    setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}};
  return n;
}
function fixture(mode='normal',boss=true) {
  const graphics=[],tweens=[],hits=[],events=[],wins=[],listeners=new Map();
  const s={runMode:mode,now:0,paused:false,balance:BALANCE,enemies:[],killCount:0,player:node(350,400,50,80),
    playerData:{hp:1000,maxHp:1000,baseMaxHp:1000,baseAttack:20,baseDefense:0},
    cameras:{main:{worldView:{x:0,width:720},width:720,scrollX:0}},
    getGameplayTime(){return this.now;},isGameplayPaused(){return this.paused;},
    hud:{update(){},setStatus(text){s.status=text;}},floatText(){},
    finishRun(won){wins.push(won);s.paused=true;s.enemyBehaviors.destroy();s.statusEffects.reset();},
    physics:{add:{existing(){}}},events:{on(){},once(){},off(){}},
    eventBus:{on(type,fn){const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);return ()=>set.delete(fn);},
      emit(type,meta){events.push({type,meta});for(const fn of [...(listeners.get(type)||[])])fn(meta);}},
    add:{rectangle:(...args)=>Object.assign(node(...args),{scene:s}),text:(x,y)=>node(x,y),container:node,circle:node,ellipse:node,
      graphics:()=>{const g=node();graphics.push(g);return g;}},
    tweens:{add(config){const item={config,stopped:false,stop(){this.stopped=true;},remove(){},pause(){},resume(){}};tweens.push(item);return item;}}};
  s.targeting=new TargetingSystem(s);s.combatSystem=new CombatSystem(s);s.statusEffects=new StatusEffectSystem(s);
  const damage=s.combatSystem.damageAttackTarget.bind(s.combatSystem);
  s.combatSystem.damageAttackTarget=(target,amount,meta)=>{
    const result=damage(target,amount,meta);hits.push({target,amount,meta,result,t:s.now});return result;
  };
  s.enemyBehaviors=new Manager(s);
  const stage=new StageSystem(s);s.stageSystem=stage;stage.currentEnemyLevel=19;stage.currentGroup=18;
  stage.groupIndex=17;stage.currentWave=stage.wavesPerGroup();stage.activeRush='boss6';
  if(boss)stage.spawnBoss('boss6');else stage.spawn('abyss_apostle',500);
  const e=s.enemies[0];e.x=500;e.y=400;e.scene=s;const b=s.enemyBehaviors.items.get(e);
  return {s,e,b,stage,graphics,tweens,hits,events,wins,tick(t){s.now=t;s.enemyBehaviors.update(t);stage.updateBossKnockbackCounterattacks(t);},
    destroy(){s.skillSystem?.reset?.();s.combatSystem.clearAllKnockbacks();s.statusEffects.reset();s.enemyBehaviors.destroy();}};
}
const sources=f=>f.hits.map(h=>h.meta.source);
const isolate=(f,skill)=>{for(const name of ['Release','Blood','Chain','Slam'])if(name.toLowerCase()!==skill)f.b['next'+name]=Infinity;};
const begin=(f,skill)=>{isolate(f,skill);f.tick(A[skill+'First']);assert.equal(f.b.state,skill+'Windup');};
const release=(f,skill)=>{begin(f,skill);f.tick(A[skill+'First']+A[skill+'Windup']);};
const split=f=>{f.e.hp=f.e.maxHp/2;f.tick(1);assert.equal(f.s.enemies.length,2);return f.s.enemies[1];};
const ally=(type='spiritWolf',x=350,y=400)=>({type,x,y,hp:1000,active:true,
  isAlive(){return this.active&&this.hp>0;},takeDamage(n){this.hp=Math.max(0,this.hp-n);}});
const addWolves=(f,wolves)=>{f.s.skillSystem={passiveState:{spiritWolves:{wolves}},beforePlayerDamage(){},beforePlayerHpDamage(){}};};

function realSkills(f) {
  const s=f.s;Object.assign(s.playerData,{skills:[],mana:500,maxMana:500,skillDamageMultiplier:1,weaponId:'blade'});
  s.artifactSystem={level:()=>0,highHpDamageMultiplier:()=>1};
  s.healPlayer=n=>{const before=s.playerData.hp;s.playerData.hp=Math.min(s.playerData.maxHp,before+n);return s.playerData.hp-before;};
  s.skillSystem=new SkillSystem(s);return s.skillSystem;
}
const addSkill=(sys,id,level=1)=>{sys.scene.playerData.skills.push({id,level});sys.ensurePassiveBound(id);return sys.getData(id);};

// Actual Boss6 spawn retains the old first-fight HP/damage/speed and test-mode identity.
for(const mode of ['normal','test']) {
  const f=fixture(mode),e=f.e;
  assert.equal(e.enemyId,mode==='normal'?'abyss_apostle':'void_monarch');
  assert.equal(e.name,mode==='normal'?'深渊使徒':'虚空君王');
  assert.equal(e.hp,14852);assert.equal(e.damage,52);assert.equal(e.speed,308);
  assert.equal(e.attackIntervalMs,mode==='normal'?2600:950);assert.equal(e.flowBossType,'boss6');
  assert(e.isFinalBoss&&!e.isMidBoss);assert.equal(f.b instanceof AbyssApostleBehavior,mode==='normal');
  assert.equal(f.stage.flowState,F.BOSS_FIGHT);assert.match(f.s.status,mode==='normal'?/深渊使徒/:/虚空君王/);
  assert.equal(f.events.find(v=>v.meta?.kind==='boss').meta.bossId,mode==='normal'?'abyss_apostle':'boss');
  assert.equal(f.events.find(v=>v.type===CombatEvents.BOSS_SPAWNED).meta.enemy,e);
  f.s.combatSystem.damageEnemy(e,20000,{source:'skill'});
  assert.deepEqual(f.wins,[true]);assert.equal(f.events.filter(v=>v.type===CombatEvents.BOSS_KILLED).length,1);f.destroy();
}
{
  const f=fixture();
  for(const level of [1,4,19,100]) {
    f.stage.currentEnemyLevel=level;const e=f.stage.tunedEnemy('abyss_apostle');
    assert.equal(e.hp,Math.round(4700*(1+(level-1)*.12)));
    assert.equal(e.damage,Math.round(38*.8*(1+(level-1)*.04)));
    assert.equal(e.attackIntervalMs,2600);assert.equal(e.attackRange,170);assert.equal(e.speed,308);
  }
  f.destroy();
}
// Split starts only at/below half HP, exactly preserves totals (including odd/fractional health).
{
  const f=fixture();f.e.hp=f.e.maxHp/2+1;f.tick(0);assert.equal(f.s.enemies.length,1);
  f.e.maxHp=1001;f.e.hp=499;f.tick(1);const twin=f.s.enemies[1],other=f.s.enemyBehaviors.items.get(twin);
  assert.equal(f.e.maxHp,500.5);assert.equal(twin.maxHp,500.5);
  assert.equal(f.e.hp,249.5);assert.equal(twin.hp,249.5);assert.equal(f.e.hp+twin.hp,499);
  assert.notEqual(f.e.hpBar,twin.hpBar);assert.equal(f.e.hpBar.width,f.e.width*249.5/500.5);
  assert.notEqual(f.b,other);assert.equal(f.e.abyssFight,twin.abyssFight);assert(f.e.abyssFight.split);
  assert.equal(twin.flowBossType,'boss6');assert(twin.isFinalBoss);assert.equal(twin.x,610);
  assert.equal(f.e.nameText.text,'深渊使徒·甲');assert.equal(twin.nameText.text,'深渊使徒·乙');
  assert.equal(f.events.filter(v=>v.type===CombatEvents.BOSS_SPAWNED).length,1);
  f.e.hp=1;twin.hp=2;f.tick(2);assert.equal(f.s.enemies.length,2);
  assert.equal(f.e.hp,1);assert.equal(twin.hp,2);f.destroy();
}
{
  const f=fixture();f.s.balance={...BALANCE,enemyPopulation:{...BALANCE.enemyPopulation,hardCap:1}};
  f.e.hp=7000;f.tick(1);f.tick(2);assert.equal(f.e.hp,7000);assert(!f.e.abyssFight.split);
  f.s.balance.enemyPopulation.hardCap=2;f.tick(3);assert.equal(f.s.enemies.length,2);
  assert.equal(f.e.hp+f.s.enemies[1].hp,7000);assert(f.e.abyssFight.split);f.destroy();
}
// Both death orders and a reentrant death event must produce one victory, never an early one.
for(const order of [0,1]) {
  const f=fixture(),twin=split(f),pair=[f.e,twin];let gold=0,rewards=0;
  f.s.awardGold=n=>gold+=n;f.s.queueArtifactReward=()=>rewards++;
  const first=pair[order],last=pair[1-order];
  f.s.combatSystem.damageEnemy(first,10000,{source:'skill'});
  assert.equal(f.wins.length,0);assert.equal(f.stage.flowState,F.BOSS_FIGHT);
  assert.equal(f.events.filter(v=>v.type===CombatEvents.BOSS_KILLED).length,0);
  assert(f.s.enemyBehaviors.items.has(last));assert(!f.s.enemyBehaviors.items.has(first));
  f.stage.onBossKilled('boss6');assert.equal(f.wins.length,0,'Stage independently rejects early victory');
  f.s.combatSystem.damageEnemy(last,10000,{source:'skill'});
  f.s.combatSystem.killEnemy(first);f.s.combatSystem.killEnemy(last);f.stage.onBossKilled('boss6');
  assert.deepEqual(f.wins,[true]);assert.equal(f.stage.flowState,F.VICTORY);
  assert.equal(f.events.filter(v=>v.type===CombatEvents.BOSS_KILLED).length,1);
  assert.equal(f.events.filter(v=>v.type===CombatEvents.ENEMY_KILLED).length,2);
  assert.equal(gold,0);assert.equal(rewards,0);assert.equal(f.s.killCount,0);f.destroy();
}
{
  const f=fixture(),twin=split(f);
  f.s.eventBus.on(CombatEvents.ENEMY_KILLED,({enemy})=>{if(enemy===f.e)f.s.combatSystem.killEnemy(twin);});
  f.s.combatSystem.killEnemy(f.e);assert.deepEqual(f.wins,[true]);
  assert.equal(f.events.filter(v=>v.type===CombatEvents.BOSS_KILLED).length,1);f.destroy();
}

// Supplemental normal tentacle attack is one warned hit, with no legacy autoattack or half-HP enrage.
{
  const f=fixture();f.tick(0);assert.equal(f.b.state,'attackWindup');assert.equal(f.hits.length,0);
  f.tick(A.attackWindup-1);assert.equal(f.hits.length,0);f.tick(A.attackWindup);f.tick(A.attackWindup);
  assert.deepEqual(sources(f),['abyssTentacle']);assert.equal(f.hits[0].amount,52);
  assert.equal(f.b.nextAttack,2780);assert.equal(f.s.player.x,350);assert.equal(f.s.playerData.hp,948);
  f.e.hp=f.e.maxHp/3;f.s.combatSystem.updateEnemyAttack(f.e,99999);
  assert.equal(f.hits.length,1);assert.equal(f.e.enraged,false);assert.equal(f.e.attackIntervalMs,2600);f.destroy();
}
{
  const f=fixture();f.tick(0);f.s.player.x=100;f.tick(A.attackWindup);
  assert.equal(f.hits.length,0);assert.equal(f.b.nextAttack,0);f.destroy();
}
// Continuous tentacle strikes use the fixed warned frontal area and validate each hit independently.
{
  const f=fixture();release(f,'chain');assert.equal(f.b.chainRemaining,2);assert.equal(f.b.nextChain,16500);
  assert.equal(f.hits.length,1);assert.equal(f.hits[0].amount,36);assert.equal(f.s.player.x,350);
  f.tick(9779);assert.equal(f.hits.length,1);f.tick(9780);f.tick(10060);f.tick(10060);
  assert.deepEqual(sources(f),['abyssChain','abyssChain','abyssChain']);assert.equal(f.b.nextChain,16500);
  f.tick(10340);assert.equal(f.b.state,'recovery');assert.equal(f.b.until,11090);assert(!isBossUsingSkill(f.e));f.destroy();
}
{
  const f=fixture();f.s.player.x=100;const first=ally('spiritWolf',430),replacement=ally('spiritWolf',400);
  first.hp=20;addWolves(f,[first,replacement]);release(f,'chain');assert.equal(first.hp,0);
  f.tick(9780);assert.equal(replacement.hp,964);assert.equal(f.hits.length,2);
  replacement.hp=0;f.tick(10060);assert.equal(f.hits.length,2);assert.equal(f.b.nextChain,16500);f.destroy();
}
for(const failure of ['dead','range','behind','height']) {
  const f=fixture();begin(f,'chain');
  if(failure==='dead')f.s.playerData.hp=0;
  else if(failure==='range')f.s.player.x=100;
  else if(failure==='behind')f.s.player.x=550;
  else f.s.player.y=600;
  f.tick(9500);f.tick(9780);f.tick(10060);f.tick(10340);
  assert.equal(f.hits.length,0);assert.equal(f.b.nextChain,9000);assert.equal(f.b.state,'recovery');f.destroy();
}
// Giant tentacle is a fixed ground warning: one AoE hit, never a homing/follow-up slam.
{
  const f=fixture();begin(f,'slam');assert.deepEqual(f.b.area,{x:350,y:400});
  assert(f.b.graphics.circles.some(c=>c.x===350&&c.y===400&&c.r===105));
  f.tick(12949);assert.equal(f.hits.length,0);f.tick(12950);f.tick(12950);
  assert.deepEqual(sources(f),['abyssSlam']);assert.equal(f.hits[0].amount,109);assert.equal(f.b.nextSlam,22450);
  assert.equal(f.s.player.x,350);assert.equal(f.hits[0].meta.dodgeable,false);
  f.tick(13130);assert.equal(f.b.state,'recovery');assert.equal(f.b.until,14130);f.destroy();
}
{
  const f=fixture(),inside=ally('spiritWolf',380),outside=ally('spiritWolf',100);addWolves(f,[inside,outside]);
  release(f,'slam');assert.equal(f.hits.length,2);assert.equal(f.s.playerData.hp,891);
  assert.equal(inside.hp,891);assert.equal(outside.hp,1000);assert.equal(inside.x,380);f.destroy();
}
{
  const f=fixture();begin(f,'slam');f.s.player.x=600;f.tick(12950);
  assert.equal(f.hits.length,0);assert.equal(f.b.nextSlam,12000);assert.equal(f.b.state,'recovery');f.destroy();
}
// Frenzied release creates bounded temporary attack warnings, not enemies or damage-following objects.
{
  const f=fixture();release(f,'release');assert.equal(f.b.state,'releaseChannel');assert.equal(f.b.nextRelease,14500);
  assert.equal(f.b.hazards.length,1);assert.equal(f.hits.length,0);assert.equal(f.s.enemies.length,1);
  assert.deepEqual(f.b.hazards[0],{x:350,y:400,hitAt:4150,hit:false,until:0});
  f.tick(4149);assert.equal(f.hits.length,0);f.tick(4150);f.tick(4150);
  assert.equal(f.hits.length,1);assert.equal(f.hits[0].amount,39);assert.equal(f.s.player.x,350);
  f.tick(4800);f.tick(5450);f.tick(6100);f.tick(6750);f.tick(7000);
  assert.deepEqual(sources(f),Array(5).fill('abyssRelease'));assert.equal(f.b.hazards.length,0);
  assert.equal(f.s.enemies.length,1);assert.equal(f.b.state,'recovery');assert.equal(f.b.nextRelease,14500);f.destroy();
}
{
  const f=fixture();release(f,'release');f.s.player.x=200;f.tick(4150);
  assert.equal(f.hits.length,0);assert.equal(f.b.hazards[0].x,350,'released warnings never follow a moving target');
  assert.equal(f.b.hazards[1].x,200,'only the next warning uses the new target position');f.destroy();
}
{
  const f=fixture();release(f,'release');f.tick(100000);
  assert.equal(f.hits.length,1,'no catch-up burst spawning dozens of tentacles after a long frame');
  f.tick(100180);assert.equal(f.b.hazards.length,0);f.destroy();
}
// All independently obtainable Boss skills keep their cooldown when their initial/actual target is absent.
for(const key of ['release','blood','chain','slam']) {
  const f=fixture();isolate(f,key);f.s.playerData.hp=0;f.tick(A[key+'First']);
  assert(!f.b.state.endsWith('Windup'));assert.equal(f.b['next'+key[0].toUpperCase()+key.slice(1)],A[key+'First']);f.destroy();
}
for(const key of ['release','blood','slam']) {
  const f=fixture();begin(f,key);f.s.playerData.hp=0;f.tick(A[key+'First']+A[key+'Windup']);
  assert.equal(f.hits.length,0);assert.equal(f.b['next'+key[0].toUpperCase()+key.slice(1)],A[key+'First']);f.destroy();
}

// Blood Gate is temporary partial block + additive tentacle damage, not invulnerability or permanent stat edits.
{
  const f=fixture();release(f,'blood');assert.equal(f.e.abyssBloodUntil,9650);assert.equal(f.b.nextBlood,18950);
  assert.equal(f.hits.length,0);assert.equal(f.e.damage,52);assert.equal(f.e.damageReduction,0);
  assert.equal(f.b.tentacleDamage(6450),68);assert.equal(f.b.tentacleDamage(6450,A.chainDamageMultiplier),52);
  const hp=f.e.hp;f.s.combatSystem.damageEnemy(f.e,100,{source:'skill'});assert.equal(f.e.hp,hp-60);
  f.tick(6630);f.tick(7180);f.tick(7360);assert.deepEqual(sources(f),['abyssTentacle']);assert.equal(f.hits[0].amount,68);
  f.b.nextAttack=Infinity;f.tick(9650);assert.equal(f.e.abyssBloodUntil,0);assert.equal(f.b.tentacleDamage(9650),52);
  const after=f.e.hp;f.s.combatSystem.damageEnemy(f.e,100,{source:'skill'});assert.equal(f.e.hp,after-100);
  assert.equal(f.e.damage,52);assert.equal(f.e.damageReduction,0);f.destroy();
}
for(const meta of [{source:'attack',tags:['physical']},{source:'burn'},{source:'poison'},
  {source:'skill',damageAlreadyResolved:true}]) {
  const f=fixture();release(f,'blood');const hp=f.e.hp;
  f.s.combatSystem.damageEnemy(f.e,100,meta);assert.equal(f.e.hp,hp-60);f.destroy();
}
{
  const f=fixture();release(f,'blood');f.e.defense=10;f.e.damageReduction=.2;const hp=f.e.hp;
  f.s.combatSystem.damageEnemy(f.e,100,{source:'skill'});assert.equal(f.e.hp,hp-42);
  f.s.combatSystem.damageEnemy(f.e,100,{source:'skill',damageAlreadyResolved:true});assert.equal(f.e.hp,hp-102);
  assert.equal(f.e.defense,10);assert.equal(f.e.damageReduction,.2);f.destroy();
}
// Split inherits only remaining Blood Gate duration, never refills HP or restarts a buff/cooldown.
{
  const f=fixture();release(f,'blood');f.e.hp=7000;f.tick(6451);
  const twin=f.s.enemies[1],other=f.s.enemyBehaviors.items.get(twin);
  assert.equal(f.e.hp,3500);assert.equal(twin.hp,3500);assert.equal(twin.abyssBloodUntil,9650);
  assert.equal(f.b.nextBlood,18950);assert.equal(other.nextBlood,20050);
  f.s.enemyBehaviors.shiftTimers(1000,6451);
  assert.equal(f.e.abyssBloodUntil,10650);assert.equal(twin.abyssBloodUntil,10650,'pair timers shift once per body, not twice');
  assert.equal(f.b.nextBlood,19950);assert.equal(other.nextBlood,21050);f.destroy();
}

// Independent absolute clocks: oldest due skill wins; no ordinary attack is mixed into a skill/recovery.
{
  const f=fixture();for(const key of ['Release','Blood','Chain','Slam'])f.b['next'+key]=1000;
  f.tick(1000);assert.equal(f.b.state,'releaseWindup');f.tick(1500);assert.equal(f.b.nextRelease,12500);
  f.tick(4500);f.tick(5150);assert.equal(f.b.state,'bloodWindup');f.tick(5600);
  assert.equal(f.b.nextBlood,18100);assert.equal(f.b.nextChain,1000);assert.equal(f.b.nextSlam,1000);
  f.tick(5780);f.tick(6330);assert.equal(f.b.state,'chainWindup');f.tick(6830);f.tick(7110);f.tick(7390);
  assert.equal(f.b.nextChain,13830);f.tick(7670);f.tick(8420);assert.equal(f.b.state,'slamWindup');f.tick(9370);
  assert.equal(f.b.nextSlam,18870);assert.equal(f.b.nextRelease,12500);assert.equal(f.b.nextBlood,18100);
  assert(!sources(f).includes('abyssTentacle'));f.destroy();
}
{
  const f=fixture(),twin=split(f),other=f.s.enemyBehaviors.items.get(twin);
  for(const key of ['Release','Blood','Chain','Slam'])assert.equal(other['next'+key],f.b['next'+key]+1100);
  f.b.nextRelease=other.nextRelease=2000;f.tick(2000);
  assert.equal(f.b.state,'releaseWindup');assert.equal(other.state,'idle');assert.equal(other.nextRelease,2000);
  f.tick(2500);f.tick(3099);assert.equal(other.state,'idle');f.tick(3100);
  assert.equal(other.state,'releaseWindup');assert.equal(f.b.state,'releaseChannel');
  assert.equal(f.e.abyssSkillGateUntil,3100);assert.equal(twin.abyssSkillGateUntil,4200);
  assert.equal(other.nextRelease,2000);assert.equal(f.b.nextRelease,13500);f.destroy();
}
// Ordinary/recovery stages allow meaningful existing-style knockback; only active skill stages block it.
for(const key of ['release','blood','chain','slam']) {
  const f=fixture();isolate(f,key);f.tick(0);f.s.now=A[key+'First']-1;
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:250}));assert(f.e.isKnockbackActive);
  f.tick(A[key+'First']);assert.equal(f.b.state,key+'Windup','due skill starts through the real knocked-back Manager path');
  assert.equal(f.e.isKnockbackActive,false);assert(f.tweens[0].stopped);assert(isBossUsingSkill(f.e));
  assert.equal(f.b['next'+key[0].toUpperCase()+key.slice(1)],A[key+'First'],'windup does not prematurely consume cooldown');
  f.tick(A[key+'First']+A[key+'Windup']);assert(f.b['next'+key[0].toUpperCase()+key.slice(1)]>A[key+'First']);f.destroy();
}
for(const state of ['idle','attackWindup','attackRecovery','recovery']) {
  const f=fixture();f.b.setState(state);const clocks=[f.b.nextRelease,f.b.nextBlood,f.b.nextChain,f.b.nextSlam];
  assert(!isBossUsingSkill(f.e));assert(f.s.combatSystem.applyKnockback(f.e,{knockback:250}));
  assert.equal(f.tweens[0].config.duration,150);assert(f.e.isKnockbackActive);
  f.stage.updateBossKnockbackCounterattacks(99999);assert.equal(f.hits.length,0,'no forced knockback counter');
  f.tweens[0].config.onComplete();assert.equal(f.e.x,900);assert.equal(f.e.y,400);
  assert.deepEqual([f.b.nextRelease,f.b.nextBlood,f.b.nextChain,f.b.nextSlam],clocks);f.destroy();
}
for(const state of ['releaseWindup','releaseChannel','bloodWindup','bloodRelease','chainWindup','chain','slamWindup','slamRelease']) {
  const f=fixture();f.b.setState(state);const hp=f.e.hp;
  assert(isBossUsingSkill(f.e));assert(f.s.combatSystem.damageEnemy(f.e,5,{source:'attack',knockback:250}));
  assert.equal(f.e.hp,hp-5);assert.equal(f.e.isKnockbackActive,false);assert.equal(f.e.x,500);assert.equal(f.tweens.length,0);f.destroy();
}
{
  const f=fixture();applyEnemyCold(f.e,{now:0,stacks:8,data:{maxStacks:8,slowPerStack:.1,attackSlowPerStack:.1,
    bossMaxMoveSlow:.45,bossMaxAttackSlow:.5,coldDurationMs:30000}});
  assert.equal(getEnemyMoveSpeed(f.e,308,0),308*.55);assert.equal(getEnemyAttackDelay(f.e,2600,0),5200);
  assert(!isEnemyFrozen(f.e,0),'shared Boss cold rule is unchanged');
  f.tick(0);f.tick(180);assert.equal(f.b.nextAttack,5380);release(f,'chain');assert.equal(f.b.nextChain,23500);f.destroy();
}
{
  const f=fixture();release(f,'release');f.e.gravityReversalState={};f.tick(4000);f.tick(4500);f.tick(5000);
  assert.equal(f.hits.length,0);assert.equal(f.b.hazards[0].hitAt,5150);assert.equal(f.b.channelUntil,7500);
  assert.equal(f.b.nextRelease,15500);delete f.e.gravityReversalState;f.tick(5001);assert.equal(f.hits.length,0);
  f.tick(5150);assert.equal(f.hits.length,1);f.destroy();
}
{
  const f=fixture();release(f,'blood');f.e.gravityReversalState={};f.tick(9000);f.tick(10000);
  assert.equal(f.e.abyssBloodUntil,10650,'late control frame shifts the buff before expiry');
  delete f.e.gravityReversalState;f.tick(10001);assert.equal(f.e.abyssBloodUntil,10650);
  f.tick(10650);assert.equal(f.e.abyssBloodUntil,0);f.destroy();
}
{
  const f=fixture();begin(f,'release');f.s.paused=true;f.s.enemyBehaviors.pause();f.tick(3500);
  assert.equal(f.hits.length,0);assert.equal(f.b.hazards.length,0);f.s.enemyBehaviors.shiftTimers(1000,3000);
  f.s.paused=false;f.s.enemyBehaviors.resume();f.tick(4499);assert.equal(f.b.hazards.length,0);f.tick(4500);
  assert.equal(f.b.hazards[0].hitAt,5150);f.tick(5150);assert.equal(f.hits.length,1);f.destroy();
}
for(const key of ['release','blood','chain','slam']) {
  const f=fixture();begin(f,key);const clocks=[f.b.nextRelease,f.b.nextBlood,f.b.nextChain,f.b.nextSlam];
  f.e.x=-100;f.tick(A[key+'First']+1);assert(f.e.x>720);assert.equal(f.e.recycleCount,1);
  assert.equal(f.b.area,null);assert.equal(f.b.hazards.length,0);assert.equal(f.b.state,'idle');
  assert.deepEqual([f.b.nextRelease,f.b.nextBlood,f.b.nextChain,f.b.nextSlam],clocks);
  f.tick(A[key+'First']+A[key+'Windup']);assert.equal(f.hits.length,0);f.destroy();
}
{
  const f=fixture(),twin=split(f),other=f.s.enemyBehaviors.items.get(twin);
  const hp=twin.hp,clocks=[other.nextRelease,other.nextBlood,other.nextChain,other.nextSlam];
  f.e.x=-100;f.tick(2);assert(f.e.x>720);assert.equal(twin.x,610);assert.equal(twin.hp,hp);
  assert.equal(f.e.abyssFight,twin.abyssFight);assert(f.e.abyssFight.split);assert.equal(f.s.enemies.length,2);
  assert.deepEqual([other.nextRelease,other.nextBlood,other.nextChain,other.nextSlam],clocks);f.destroy();
}

// Four real summon implementations take the new tentacle damage independently, with no extra displacement.
{
  const f=fixture();f.s.player.x=100;const sys=realSkills(f);addSkill(sys,'spirit_wolves');
  SpiritWolvesSkill.cast(sys,SKILLS.spirit_wolves,sys.getData('spirit_wolves'),1);
  const target=sys.passiveState.spiritWolves.wolves[0];target.x=400;target.y=400;target.hp=500;
  release(f,'chain');assert.equal(target.hp,464);assert.equal(target.x,400);assert.equal(target.pendingKnockbackDistance,0);f.destroy();
}
{
  const f=fixture();f.s.player.x=100;const sys=realSkills(f);addSkill(sys,'spirit_bird');
  SpiritBirdSkill.cast(sys,SKILLS.spirit_bird,sys.getData('spirit_bird'),1);
  const target=f.s.spiritBirdRuntime.getAttackTarget();target.x=400;target.y=400;target.hp=500;
  release(f,'chain');assert(target.hp<500);assert.equal(target.x,400);f.destroy();
}
{
  const f=fixture();f.s.player.x=100;const sys=realSkills(f);addSkill(sys,'poison_king');
  sys.passiveUpdaters.forEach(fn=>fn());const target=f.s.poisonKingRuntime.get();assert(target);
  target.view.x=400;target.view.y=400;target.hp=500;release(f,'chain');
  assert.equal(target.hp,464);assert.equal(target.view.x,400);f.destroy();
}
{
  const f=fixture();f.s.player.x=100;const sys=realSkills(f);
  sys.scene.playerData.skills.push({id:'mantra_heavenly_book',level:6});chooseMantraMode(f.s,'absorb');
  const original=f.stage.spawn('grunt',300);original.y=400;const cfg=SKILLS.mantra_heavenly_book;
  const ctx=sys.createCastContext(cfg.id,cfg,{manaCost:0,effectiveManaCost:0});
  MantraHeavenlyBookSkill.cast(sys,cfg,cfg.levels[5],6,ctx);f.s.now=3000;sys.updateActive(3000);
  const target=sys.passiveState.mantraHeavenlyBook.absorb.ally;assert(target);target.x=400;target.y=400;target.hp=500;
  release(f,'chain');assert.equal(target.hp,464);assert.equal(target.x,400);f.destroy();
}
// Stable targets after synchronous damage: a replacement cannot be hit by the already-released AoE snapshot.
for(const type of ['spirit_bird','poison_king','mantraAlly']) {
  const f=fixture();f.s.player.x=100;const old=ally(type,400),replacement=ally(type,400);let current=old;
  if(type==='spirit_bird')f.s.spiritBirdRuntime={getAttackTarget:()=>current};
  if(type==='poison_king')f.s.poisonKingRuntime={get:()=>current,getAttackTarget:()=>current};
  if(type==='mantraAlly')f.s.skillSystem={passiveState:{mantraHeavenlyBook:{absorb:{ally:old}}}};
  old.takeDamage=n=>{old.hp-=n;old.active=false;current=replacement;
    if(type==='mantraAlly')f.s.skillSystem.passiveState.mantraHeavenlyBook.absorb.ally=replacement;};
  release(f,'slam');assert.equal(old.hp,891);assert.equal(replacement.hp,1000);assert.equal(old.x,400);assert.equal(replacement.x,400);f.destroy();
}
for(const key of ['chain','slam','release']) {
  const f=fixture(),wolf=ally('spiritWolf',380);addWolves(f,[wolf]);
  if(key==='release')release(f,key);else begin(f,key);
  const damage=f.s.combatSystem.damageAttackTarget.bind(f.s.combatSystem);
  f.s.combatSystem.damageAttackTarget=(...args)=>{const result=damage(...args);f.s.combatSystem.killEnemy(f.e);return result;};
  f.tick(key==='release'?4150:A[key+'First']+A[key+'Windup']);
  assert.equal(f.b.graphics,null);assert.equal(f.b.hazards.length,0);assert.equal(f.e.abyssBloodUntil,0);
  assert.equal(f.hits.length,1);assert.deepEqual(f.wins,[true]);
  if(key==='slam'||key==='release')assert.equal(wolf.hp,1000,'AoE must stop after reflect/death ends the caster');
  const hits=f.hits.length;f.tick(99999);f.b.update(99999);assert.equal(f.hits.length,hits);f.destroy();
}
{
  const f=fixture();f.s.playerData.hp=1;release(f,'release');f.tick(4150);
  assert.deepEqual(f.wins,[false]);assert.equal(f.b.graphics,null);assert.equal(f.b.hazards.length,0);
  const hits=f.hits.length;f.tick(99999);assert.equal(f.hits.length,hits);f.destroy();
}
// Real shutdown/clear/restart paths clean every phase; a new fight has no old split/buff/hazard record.
const phaseSetup={idle:()=>{},attackWindup:f=>f.tick(0),attackRecovery:f=>{f.tick(0);f.tick(180);},
  releaseWindup:f=>begin(f,'release'),releaseChannel:f=>release(f,'release'),
  bloodWindup:f=>begin(f,'blood'),bloodRelease:f=>release(f,'blood'),
  chainWindup:f=>begin(f,'chain'),chain:f=>release(f,'chain'),
  slamWindup:f=>begin(f,'slam'),slamRelease:f=>release(f,'slam'),recovery:f=>{release(f,'blood');f.tick(6630);}};
for(const [state,setup] of Object.entries(phaseSetup)) {
  const f=fixture();setup(f);assert.equal(f.b.state,state);const hits=f.hits.length;
  f.destroy();assert.equal(f.s.enemyBehaviors.items.size,0);assert.equal(f.b.graphics,null);assert(f.graphics.every(g=>g.destroyed));
  assert.equal(f.b.area,null);assert.equal(f.b.hazards.length,0);assert.equal(f.e.abyssBloodUntil,0);
  assert.equal(f.e.abyssSkillGateUntil,0);assert.equal(f.e.bossSkillKnockbackImmune,false);
  f.b.update(99999);f.b.advanceEffects(99999);assert.equal(f.hits.length,hits);
}
{
  const f=fixture(),twin=split(f),oldFight=f.e.abyssFight;
  f.stage.clearEnemies();assert.equal(f.s.enemies.length,0);assert.equal(f.s.enemyBehaviors.items.size,0);
  assert(f.graphics.every(g=>g.destroyed));assert(!f.e.active&&!twin.active);
  f.stage.reset();f.stage.currentEnemyLevel=19;f.stage.activeRush='boss6';f.stage.spawnBoss('boss6');
  const fresh=f.s.enemies[0],behavior=f.s.enemyBehaviors.items.get(fresh);
  assert.notEqual(fresh.abyssFight,oldFight);assert(!fresh.abyssFight.split);assert(!fresh.abyssFight.settled);
  assert.equal(fresh.abyssBloodUntil,0);assert.equal(behavior.hazards.length,0);assert.equal(fresh.hp,14852);f.destroy();
}
{
  const f=fixture(),twin=split(f);twin.x=550;f.e.hp=twin.hp=5;
  f.s.statusEffects.add(StatusEffects.BURN,f.e,{durationMs:2000,intervalMs:500,value:1,sourceId:'death-chain'});
  f.s.combatSystem.damageEnemy(f.e,10,{source:'skill'});
  assert(f.e.isDefeated&&twin.isDefeated);assert.deepEqual(f.wins,[true]);
  assert.equal(f.events.filter(v=>v.type===CombatEvents.BOSS_KILLED).length,1);f.destroy();
}
console.log('PASS 01148 Abyss Apostle: real normal/test spawn/stats; exact one-time twin HP and independent clocks; one all-dead victory including reentrant/burn death chain; fixed warned tentacles, additive temporary Blood Gate, independent combo/slam; real summons; skill-only knockback immunity; cold/gravity/pause/recycle/cleanup/restart.');
