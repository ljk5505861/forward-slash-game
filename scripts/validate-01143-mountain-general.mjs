import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import MountainGeneralBehavior from '../src/enemies/behaviors/MountainGeneralBehavior.js';
import CombatSystem,{ isBossUsingSkill, NORMAL_ATTACK_KNOCKBACK_DURATION_MS } from '../src/systems/CombatSystem.js';
import StageSystem,{ LevelFlowStates as F } from '../src/systems/StageSystem.js';
import { ENEMIES, MOUNTAIN_GENERAL_TUNING as G } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers,applyEnemyCold } from '../src/systems/EnemyColdControl.js';
import { SpiritWolvesSkill } from '../src/skills/handlers/SpiritWolvesSkill.js';
import { SpiritBirdSkill } from '../src/skills/handlers/SpiritBirdSkill.js';

const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ')
  .replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const imports={ MountainGeneralBehavior,getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,
  updateGravityPull,isEnemyFrozen,shiftEnemyColdTimers,Phaser:{Math:{Between:()=>0}} };
for(const name of ['MeatBehavior','DoctorBehavior','MasterBehavior','ShieldGuardBehavior','SharpshooterBehavior',
  'WarDrumPriestBehavior','EliteBerserkerBehavior','ThunderMageBehavior','HellEnvoyBehavior','HellSummonBehavior',
  'GamblerBehavior','GoldenHallGuardBehavior'])imports[name]=class {};
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',imports);

function node(x=0,y=0,w=0,h=0) {
  const n={x,y,width:w,height:h,active:true,alpha:1,
    destroy(){this.active=false;this.destroyed=true;},setX(x){this.x=x;return this;},
    setPosition(x,y){this.x=x;this.y=y;return this;},setText(text){this.text=text;return this;},
    setFillStyle(color){this.color=color;return this;},add(){return this;}};
  for(const key of ['setStrokeStyle','setDepth','setOrigin','setVisible','setAlpha','setScale','setDisplaySize',
    'lineStyle','lineBetween','strokeCircle','strokeRect','clear'])n[key]=()=>n;
  n.body={velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){n.x=x;n.y=y;},
    setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}};
  return n;
}
function fixture() {
  const graphics=[],tweens=[],hits=[],events=[];
  const s={runMode:'normal',now:0,paused:false,balance:BALANCE,enemies:[],player:node(350,400,50,80),
    playerData:{hp:500,maxHp:500,baseMaxHp:500,baseAttack:20,baseDefense:0},
    getGameplayTime(){return this.now;},isGameplayPaused(){return this.paused;},
    hud:{update(){},setStatus(text){s.status=text;}},floatText(){},finishRun(){s.paused=true;s.enemyBehaviors.destroy();},
    physics:{add:{existing(){}}},events:{on(){},once(){},off(){}},
    eventBus:{emit(type,meta){events.push({type,meta});}},
    targeting:{valid:e=>e?.active&&!e.isDefeated,isEnemyFullyInsideViewport:e=>e.full!==false,
      shouldRecycleEnemyLeft:e=>!!e.recycle,getEnemyRightRespawnX:()=>900},
    add:{rectangle:node,text:(x,y)=>node(x,y),container:node,circle:node,ellipse:node,
      graphics:()=>{const g=node();graphics.push(g);return g;}},
    tweens:{add(config){const item={config,stopped:false,stop(){this.stopped=true;},remove(){},pause(){},resume(){}};tweens.push(item);return item;}}};
  s.combatSystem=new CombatSystem(s);
  const damage=s.combatSystem.damageAttackTarget.bind(s.combatSystem);
  s.combatSystem.damageAttackTarget=(target,amount,meta)=>{
    const result=damage(target,amount,meta);hits.push({target,amount,meta,t:s.now});return result;
  };
  s.enemyBehaviors=new Manager(s);
  const stage=new StageSystem(s);stage.currentEnemyLevel=4;
  const e=stage.spawn('mountain_general',500);e.y=400;
  const b=s.enemyBehaviors.items.get(e);
  return {s,e,b,stage,graphics,tweens,hits,events,tick(t){s.now=t;s.enemyBehaviors.update(t);stage.updateBossKnockbackCounterattacks(t);},
    destroy(){s.combatSystem.clearAllKnockbacks();s.enemyBehaviors.destroy();}};
}
const sources=f=>f.hits.map(h=>h.meta.source);
const toSweep=f=>{f.tick(G.first);assert.equal(f.b.state,'windup');f.tick(G.first+G.windup);};
const toCharge=f=>{toSweep(f);f.tick(G.first+G.windup+G.pause);assert.equal(f.b.state,'charge');};

// Actual spawn and mode-specific Boss 1 introduction/events/rewards.
for(const mode of ['normal','test']) {
  const f=fixture();f.destroy();f.s.enemies=[];f.s.runMode=mode;f.s.enemyBehaviors=new Manager(f.s);
  f.stage.activeRush='boss1';f.stage.spawnBoss('boss1');
  const e=f.s.enemies[0];assert.equal(e.enemyId,mode==='normal'?'mountain_general':'berserker_boss');
  assert.equal(e.name,mode==='normal'?'撼山将军':'狂暴巨兽');assert.equal(e.hp,870);assert.equal(e.damage,9);
  assert.equal(e.attackIntervalMs,mode==='normal'?2200:1450);assert.equal(f.stage.flowState,F.BOSS_FIGHT);
  assert.equal(e.flowBossType,'boss1');assert(!e.isFinalBoss&&!e.isMidBoss);
  assert.equal(f.s.enemyBehaviors.items.get(e) instanceof MountainGeneralBehavior,mode==='normal');
  assert.match(f.s.status,mode==='normal'?/撼山将军/:/狂暴巨兽/);
  let reward;f.s.queueArtifactReward=value=>{reward=value;};f.stage.onBossKilled('boss1');
  assert.match(reward.name,mode==='normal'?/撼山将军/:/狂暴巨兽/);
  assert.equal(f.events.find(v=>v.meta?.kind==='boss').meta.bossId,e.enemyId);
  f.destroy();
}
// Boss 2/3/4/5's intentional normal-mode migrations have actual spawn coverage in their own specialty checks.
for(const id of ['boss6']) {
  const f=fixture();f.destroy();const spawned=[];
  f.stage.spawn=(...args)=>{spawned.push(args);return {};};
  f.stage.spawnBoss(id);const expected=spawned[0];
  f.s.runMode='test';f.stage.spawnBoss(id);assert.deepEqual(spawned[1],expected,'other Boss definitions unchanged');
}
{
  const f=fixture();
  for(const level of [1,4,19,100]) {
    f.stage.currentEnemyLevel=level;const e=f.stage.tunedEnemy('mountain_general');
    assert.equal(e.hp,Math.round(640*(1+(level-1)*.12)));assert.equal(e.damage,Math.round(8*(1+(level-1)*.04)));
    assert.equal(e.attackIntervalMs,2200);assert.equal(e.attackRange,155);assert.equal(e.speed,272);
  }
  f.destroy();
}
{
  const f=fixture();f.tick(0);assert.equal(f.b.state,'punchWindup');assert(!isBossUsingSkill(f.e));
  f.tick(G.punchWindup-1);assert.equal(f.hits.length,0);f.tick(G.punchWindup);assert.deepEqual(sources(f),['mountainGeneralPunch']);
  assert.equal(f.s.playerData.hp,491);f.s.combatSystem.updateEnemyAttack(f.e,1000);assert.equal(f.hits.length,1,'generic melee cannot duplicate the punch');
  const next=f.b.nextAttack;f.tick(next-1);assert.equal(f.hits.length,1);f.tick(next);f.tick(next+G.punchWindup);
  assert.equal(f.hits.length,2);f.destroy();
}
for(const replacement of [false,true]) {
  const f=fixture();f.tick(0);f.s.playerData.hp=0;
  const wolf={type:'spiritWolf',x:370,y:400,hp:100,isAlive(){return this.hp>0;},takeDamage(n){this.hp-=n;}};
  if(replacement)f.s.skillSystem={beforePlayerDamage(){},beforePlayerHpDamage(){},passiveState:{spiritWolves:{wolves:[wolf]}}};
  f.tick(G.punchWindup);assert.equal(f.hits.length,replacement?1:0);
  assert.equal(f.b.nextAttack,replacement?G.punchWindup+2200:0);if(replacement)assert.equal(f.hits[0].target,wolf);
  f.destroy();
}
{
  const f=fixture();f.tick(0);f.s.player.x=200;f.tick(G.punchWindup);assert.equal(f.hits.length,0);assert.equal(f.b.nextAttack,0);
  f.s.playerData.hp=0;f.tick(G.first);assert.equal(f.b.nextSkill,G.first,'no target spends no skill cooldown');assert(!isBossUsingSkill(f.e));f.destroy();
}
// Full combo timing, frontal AoE, actual player displacement and independent charge collision.
{
  const f=fixture(),wolf={type:'spiritWolf',x:400,y:400,hp:100,view:node(400,400),hpBarBg:node(400,350),hpBar:node(378,350),
    isAlive(){return this.hp>0;},takeDamage(n){this.hp-=n;}};
  const behind={...wolf,x:540,hp:100,view:node(540,400)},high={...wolf,x:410,y:250,hp:100};
  f.s.skillSystem={beforePlayerDamage(){},beforePlayerHpDamage(){},passiveState:{spiritWolves:{wolves:[wolf,high]}}};
  f.tick(G.first);f.s.skillSystem.passiveState.spiritWolves.wolves.push(behind);f.tick(G.first+G.windup);assert.deepEqual(sources(f),['mountainGeneralSweep','mountainGeneralSweep']);
  assert.equal(f.s.playerData.hp,486);assert.equal(f.s.player.x,278);assert.equal(wolf.hp,86);assert.equal(wolf.x,328);
  assert.equal(wolf.view.x,328);assert.equal(wolf.hpBar.x,306);assert.equal(behind.hp,100);assert.equal(high.hp,100);
  assert.equal(f.b.state,'sweepPause');assert(isBossUsingSkill(f.e));behind.hp=0;
  f.tick(G.first+G.windup+G.pause-1);assert.equal(f.b.state,'sweepPause');
  f.tick(G.first+G.windup+G.pause);assert.equal(f.b.chargeDirection,-1);assert.equal(f.e.body.velocity.x,-720);
  f.s.player.x=850;f.e.x=300;f.tick(4200);assert.equal(wolf.hp,68);assert.equal(f.s.playerData.hp,486,'sweep hit does not guarantee charge hit');
  f.tick(4210);assert.equal(wolf.hp,68,'same summon is hit at most once');
  assert.equal(f.b.chargeDirection,-1);assert.equal(f.e.body.velocity.x,-720,'target movement cannot steer a started charge');
  f.tick(G.first+G.windup+G.pause+G.chargeDuration);assert.equal(f.b.state,'recovery');assert(!isBossUsingSkill(f.e));
  const end=f.b.until,next=f.b.nextSkill;f.s.combatSystem.applyKnockback(f.e,{knockback:72});f.tick(end-1);
  assert.equal(f.b.until,end,'repeated recovery hits cannot extend recovery');assert.equal(f.b.nextSkill,next);
  assert(!sources(f).includes('mountainGeneralPunch'),'normal attacks stay suspended throughout combo/recovery');f.destroy();
}
{
  const f=fixture();toCharge(f);f.e.x=200;f.tick(4200);f.tick(4210);
  assert.equal(sources(f).filter(v=>v==='mountainGeneralCharge').length,1,'fresh player wrappers share one hit key');
  f.destroy();
}
// Independent hit key and displacement of getter-only poison king target wrappers.
{
  const f=fixture(),king={hp:100,view:node(390,400),domain:node(390,400),hpBar:{container:node(390,369)}};
  f.s.poisonKingRuntime={get:()=>king,getAttackTarget:()=>({type:'poison_king',get x(){return king.view.x;},get y(){return king.view.y;},
    get hp(){return king.hp;},isAlive:()=>king.hp>0,takeDamage(n){king.hp-=n;}})};
  toCharge(f);assert.equal(king.view.x,318);assert.equal(king.domain.x,318);assert.equal(king.hpBar.container.x,318);
  f.e.x=300;f.tick(4200);f.tick(4210);assert.equal(king.hp,68);f.destroy();
}
// Real wolf and bird skill runtimes: AoE sweep displaces each without new stun timers.
{
  const f=fixture(),nodes=[node(410,400),node(410,400),node(410,350),node(382,350)];
  const ally={type:'mantraAlly',x:410,y:400,hp:100,active:true,visual:{nodes},isAlive(){return this.active&&this.hp>0;},takeDamage(n){this.hp-=n;}};
  f.s.skillSystem={beforePlayerDamage(){},beforePlayerHpDamage(){},passiveState:{mantraHeavenlyBook:{absorb:{ally}}}};
  toSweep(f);assert.equal(ally.hp,86);assert.equal(ally.x,338);assert.deepEqual(nodes.map(n=>n.x),[338,338,338,310]);f.destroy();
}
{
  const f=fixture();
  const sys={beforePlayerDamage(){},beforePlayerHpDamage(){},scene:f.s,passiveState:{},passiveUpdaters:[],cooldowns:new Map(),getLevel:()=>1,getData:()=>({}),getOwned:()=>[]};
  f.s.skillSystem=sys;SpiritWolvesSkill.cast(sys,{}, {},1);SpiritBirdSkill.cast(sys,{}, {},1);
  const wolf=sys.passiveState.spiritWolves.wolves[0],bird=sys.passiveState.spiritBird.bird;
  wolf.x=420;wolf.y=400;wolf.view.setPosition(wolf.x,wolf.y);bird.x=370;bird.y=400;bird.view.setPosition(370,300);
  const whp=wolf.hp,bhp=bird.hp;toSweep(f);
  assert.equal(wolf.x,348);assert.equal(bird.x,298);assert.equal(wolf.hp,whp-14);assert.equal(bird.hp,bhp-14);
  assert.equal(wolf.pendingKnockbackDistance,0);assert.equal(wolf.knockbackUntil,0);assert.equal(bird.view.x,298);
  SpiritWolvesSkill.cleanup(sys);SpiritBirdSkill.cleanup(sys);f.destroy();
}
// Knockback starts visibly and has no accumulated cap; every actual skill state rejects it.
{
  const f=fixture();f.tick(0);assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  const tween=f.tweens.at(-1);assert.equal(tween.config.duration,G.knockbackDuration);
  tween.config.targets.t=1;tween.config.onUpdate();assert.equal(f.e.x,558);tween.config.onComplete();
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));const second=f.tweens.at(-1);second.config.targets.t=1;second.config.onComplete();
  assert.equal(f.e.x,616,'consecutive displacement is not accumulated/capped at old Boss 10px');
  const deadline=f.b.nextSkill;f.tick(G.first-1);assert.equal(f.b.nextSkill,deadline);assert.equal(f.hits.length,0);
  f.s.combatSystem.applyKnockback(f.e,{knockback:72});f.tick(G.first);
  assert.equal(f.b.state,'windup');assert(!f.e.isKnockbackActive);assert.equal(f.b.nextSkill,deadline);
  assert(!f.s.combatSystem.applyKnockback(f.e,{knockback:72}));f.tick(G.first+G.windup);
  assert(!f.s.combatSystem.applyKnockback(f.e,{knockback:72}));f.tick(G.first+G.windup+G.pause);
  assert(!f.s.combatSystem.applyKnockback(f.e,{knockback:72}));f.tick(G.first+G.windup+G.pause+G.chargeDuration);
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));f.destroy();
}
// Small deterministic Boss-only timing sample: ordinary attack cadence permits a punch,
// faster cadence suppresses punches, and neither can delay the independent skill start.
for(const cadence of [333,180]) {
  const f=fixture();f.e.x=460;f.b.nextSkill=3000;
  let nextHit=0,started=null;
  for(let t=0;t<=3000;t+=5) {
    f.s.now=t;
    for(const tw of f.tweens)if(!tw.stopped&&tw.started!==undefined) {
      const p=Math.min(1,(t-tw.started)/tw.config.duration);tw.config.targets.t=Math.sin(p*Math.PI/2);tw.config.onUpdate?.();
      if(p===1){tw.stopped=true;tw.config.onComplete?.();}
    }
    f.e.x+=f.e.body.velocity.x*.005;
    if(t>=nextHit) {
      // Hold the attacker within its legal 115px weapon range at each hit.
      f.s.player.x=f.e.x-110;
      f.s.combatSystem.applyKnockback(f.e,{knockback:72});f.tweens.at(-1).started=t;nextHit+=cadence;
    }
    f.tick(t);
    if(f.b.state==='windup'){started=t;break;}
  }
  const punches=sources(f).filter(v=>v==='mountainGeneralPunch').length;
  if(cadence===333)assert(punches>0,'base attack cadence leaves a natural normal punch opportunity');
  else assert.equal(punches,0,'fast attacks can completely suppress normal punches');
  assert.equal(started,3000,'skill starts on time even during uninterrupted ordinary hit pressure');f.destroy();
}
// Other Bosses retain their legacy displacement duration, cap and skill immunity.
{
  const f=fixture(),legacy={...f.e,behavior:'berserkerBoss',behaviorState:'idle',attackState:'idle'};
  assert(f.s.combatSystem.applyKnockback(legacy,{knockback:72}));const tw=f.tweens.at(-1);
  assert.equal(tw.config.duration,NORMAL_ATTACK_KNOCKBACK_DURATION_MS);tw.config.targets.t=1;tw.config.onComplete();
  assert.equal(legacy.x,510);legacy.behaviorState='windup';assert(!f.s.combatSystem.applyKnockback(legacy,{knockback:72}));f.destroy();
}
for(const phase of ['punchWindup','windup','sweepPause','charge','recovery']) {
  const f=fixture();
  if(phase==='punchWindup')f.tick(0);else if(phase==='windup')f.tick(G.first);else if(phase==='sweepPause')toSweep(f);
  else {toCharge(f);if(phase==='recovery')f.tick(G.first+G.windup+G.pause+G.chargeDuration);}
  const deadline=f.b.nextSkill,until=f.b.until,count=f.hits.length;
  f.s.paused=true;f.s.enemyBehaviors.pause();f.tick(99999);assert.equal(f.hits.length,count);assert.equal(f.b.until,until);
  f.s.paused=false;f.s.enemyBehaviors.resume();if(phase==='charge')assert.equal(f.e.body.velocity.x,-720);
  f.s.now=4000;f.s.enemyBehaviors.recycleEnemy(f.e);assert.equal(f.e.x,900);assert.equal(f.b.nextSkill,deadline);
  assert.equal(f.b.chargeHits.size,0);assert(!isBossUsingSkill(f.e));assert.equal(f.e.lockedAttackTarget,null);
  f.e.isDefeated=true;f.tick(99999);assert.equal(f.s.enemyBehaviors.items.size,0);assert(f.graphics[0].destroyed);f.destroy();
}
{
  const f=fixture();f.tick(G.first);f.b.shiftTimers(1000,G.first);assert.equal(f.b.until,G.first+G.windup+1000);
  f.tick(G.first+G.windup);assert.equal(f.hits.length,0);f.tick(G.first+G.windup+1000);assert.equal(f.hits.length,1);
  applyEnemyCold(f.e,{now:f.s.now,stacks:4,data:{maxStacks:8,slowPerStack:.04,attackSlowPerStack:.03}});
  assert(getEnemyMoveSpeed(f.e,G.chargeSpeed,f.s.now)<G.chargeSpeed,'skill knockback immunity does not grant slow immunity');
  assert(getEnemyAttackDelay(f.e,2200,f.s.now)>2200);f.destroy();
}
for(const during of ['sweep','charge'])for(const end of ['caster','scene']) {
  const f=fixture();
  if(during==='charge')toCharge(f);else f.tick(G.first);
  let count=0;
  f.s.eventBus.emit=(type)=>{if(type===CombatEvents.PLAYER_DAMAGED){count++;if(end==='caster'){f.e.isDefeated=true;f.s.enemyBehaviors.destroyEnemy(f.e);}else {f.s.paused=true;f.s.enemyBehaviors.destroy();}}};
  if(during==='charge'){f.e.x=200;f.tick(4200);}else f.tick(G.first+G.windup);
  assert.equal(count,1);assert.equal(f.b.graphics,null);assert(f.graphics[0].destroyed);assert(!isBossUsingSkill(f.e));f.destroy();
}
{
  const f=fixture();f.tick(G.first);const before=f.e.hp;
  assert(f.s.combatSystem.damageEnemy(f.e,20,{source:'attack',knockback:72}));
  assert.equal(f.e.hp,before-20,'skill knockback immunity is not damage immunity');assert(!f.e.isKnockbackActive);f.destroy();
}
for(const during of ['sweep','charge']) {
  const f=fixture();f.s.player.x=100;
  if(during==='charge')toCharge(f);else f.tick(G.first);
  const wolf={type:'spiritWolf',x:400,y:400,hp:100,isAlive(){return this.hp>0;},takeDamage(n){
    this.hp-=n;f.e.isDefeated=true;f.s.enemyBehaviors.destroyEnemy(f.e);
  }},other={...wolf,x:360,hp:100,takeDamage(n){this.hp-=n;}};
  f.s.skillSystem={beforePlayerDamage(){},beforePlayerHpDamage(){},passiveState:{spiritWolves:{wolves:[wolf,other]}}};
  if(during==='charge'){f.e.x=200;f.tick(4200);}else f.tick(G.first+G.windup);
  assert.equal(f.hits.length,1);assert.equal(other.hp,100,'reflected summon damage stops subsequent targets');
  assert.equal(f.e.body.velocity.x,0);assert(f.graphics[0].destroyed);f.destroy();
}
{
  const f=fixture(),random=Math.random;f.s.playerData.dodgeChance=.7;
  try {Math.random=()=>0;toSweep(f);assert.equal(f.s.playerData.hp,500);assert.equal(f.s.player.x,350,'dodged sweep cannot displace player');}
  finally {Math.random=random;f.destroy();}
}
console.log('PASS mountain general actual Boss spawn/modes/titles/growth, punch and combo timing/targets, frontal player+summon sweep displacement, independent fixed-direction continuous charge collision/one hit per target, ordinary knockback pressure/independent skill clock/skill-only immunity/hittable recovery, old Boss isolation, death callbacks/pause/recycle/slow/timer/visual cleanup');
