import assert from 'node:assert/strict';
import EmperorBehavior from '../src/enemies/behaviors/EmperorBehavior.js';
import ForeseerBehavior,{ForeseerOrbBehavior} from '../src/enemies/behaviors/ForeseerBehavior.js';
import MovementSystem from '../src/systems/MovementSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import { SKILLS } from '../src/config/skills.js';
import { isForeseerBound } from '../src/systems/ForeseerBindingControl.js';
import { SpiritWolvesSkill } from '../src/skills/handlers/SpiritWolvesSkill.js';
import { SpiritBirdSkill } from '../src/skills/handlers/SpiritBirdSkill.js';
import { MantraHeavenlyBookSkill,chooseMantraMode } from '../src/skills/handlers/MantraHeavenlyBookSkill.js';
import fs from 'node:fs';
import vm from 'node:vm';
import UncrownedKingBehavior from '../src/enemies/behaviors/UncrownedKingBehavior.js';
import StatusEffectSystem,{StatusEffects} from '../src/systems/StatusEffectSystem.js';
import ThornlessRoseBehavior from '../src/enemies/behaviors/ThornlessRoseBehavior.js';
import MountainGeneralBehavior from '../src/enemies/behaviors/MountainGeneralBehavior.js';
import CombatSystem,{ isBossUsingSkill, isUncrownedShadowActive, NORMAL_ATTACK_KNOCKBACK_DURATION_MS } from '../src/systems/CombatSystem.js';
import StageSystem,{ LevelFlowStates as F } from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import { EMPEROR_TUNING as K } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { ENEMY_UI_LAYOUT } from '../src/ui/EnemyStatusIndicators.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers,applyEnemyCold } from '../src/systems/EnemyColdControl.js';

// Run the actual manager with Phaser's rendering import replaced by a minimal node shim.
const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ')
  .replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const imports={ EmperorBehavior,ForeseerBehavior,ForeseerOrbBehavior,UncrownedKingBehavior,ThornlessRoseBehavior,MountainGeneralBehavior,getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,
  updateGravityPull,isEnemyFrozen,shiftEnemyColdTimers,Phaser:{Math:{Between:()=>0}} };
for(const name of ['MeatBehavior','DoctorBehavior','MasterBehavior','ShieldGuardBehavior','SharpshooterBehavior',
  'WarDrumPriestBehavior','EliteBerserkerBehavior','ThunderMageBehavior','HellEnvoyBehavior','HellSummonBehavior',
  'GamblerBehavior','GoldenHallGuardBehavior'])imports[name]=class {};
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',imports);

function node(x=0,y=0,w=0,h=0) {
  const n={x,y,width:w,height:h,active:true,alpha:1,circles:[],lines:[],rects:[],
    destroy(){this.active=false;this.destroyed=true;},setX(x){this.x=x;return this;},
    setPosition(x,y){this.x=x;this.y=y;return this;},setText(text){this.text=text;return this;},
    setAlpha(alpha){this.alpha=alpha;return this;},setFillStyle(color){this.color=color;return this;},add(){return this;},
    clear(){this.circles=[];this.lines=[];this.rects=[];return this;},strokeCircle(x,y,r){this.circles.push({x,y,r});return this;},
    strokeRect(x,y,width,height){this.rects.push({x,y,width,height});return this;},
    lineStyle(width,color,alpha){this.lineWidth=width;this.lineColor=color;this.lineAlpha=alpha;return this;},
    lineBetween(x1,y1,x2,y2){this.lines.push({x1,y1,x2,y2,width:this.lineWidth,color:this.lineColor});return this;}};
  for(const key of ['setStrokeStyle','setDepth','setOrigin','setVisible','setScale','setDisplaySize',
    ])n[key]=()=>n;
  n.body={velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){n.x=x;n.y=y;},
    setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}};
  return n;
}
function fixture(mode='normal',boss=false) {
  const graphics=[],tweens=[],hits=[],events=[],heals=[];
  const s={runMode:mode,now:0,paused:false,balance:BALANCE,enemies:[],killCount:0,player:node(350,400,50,80),
    playerData:{hp:500,maxHp:500,baseMaxHp:500,baseAttack:20,baseDefense:0},
    cameras:{main:{worldView:{x:0,width:720},width:720,scrollX:0}},
    getGameplayTime(){return this.now;},isGameplayPaused(){return this.paused;},
    hud:{update(){},setStatus(text){s.status=text;}},floatText(x,y,text){if(text.startsWith('+'))heals.push(text);},
    finishRun(){s.paused=true;s.enemyBehaviors.destroy();},physics:{add:{existing(){}}},events:{on(){},once(){},off(){}},
    eventBus:{emit(type,meta){events.push({type,meta});}},
    add:{rectangle:node,text:(x,y)=>node(x,y),container:node,circle:node,ellipse:node,
      graphics:()=>{const g=node();graphics.push(g);return g;}},
    tweens:{add(config){const item={config,stopped:false,stop(){this.stopped=true;},remove(){},pause(){},resume(){}};tweens.push(item);return item;}}};
  s.targeting=new TargetingSystem(s);s.combatSystem=new CombatSystem(s);
  const damage=s.combatSystem.damageAttackTarget.bind(s.combatSystem);
  s.combatSystem.damageAttackTarget=(target,amount,meta)=>{
    const result=damage(target,amount,meta);hits.push({target,amount,meta,result,t:s.now});return result;
  };
  s.enemyBehaviors=new Manager(s);
  const stage=new StageSystem(s);s.stageSystem=stage;stage.currentEnemyLevel=16;stage.currentGroup=15;stage.groupIndex=14;stage.currentWave=stage.wavesPerGroup();
  if(boss){stage.activeRush='boss5';stage.spawnBoss('boss5');}
  else stage.spawn('emperor',500);
  const e=s.enemies[0];e.x=500;e.y=400;e.scene=s;
  const b=s.enemyBehaviors.items.get(e);
  return {s,e,b,stage,graphics,tweens,hits,events,heals,tick(t){s.now=t;s.enemyBehaviors.update(t);stage.updateBossKnockbackCounterattacks(t);},
    destroy(){s.skillSystem?.reset?.();s.statusEffects?.reset?.();s.combatSystem.clearAllKnockbacks();s.enemyBehaviors.destroy();}};
}
const sources=f=>f.hits.map(h=>h.meta.source);
const isolate=(f,skill)=>{for(const name of ['Stab','Kick','Enchant'])if(name.toLowerCase()!==skill)f.b['next'+name]=Infinity;};
const begin=(f,skill)=>{isolate(f,skill);f.tick(K[skill+'First']);assert.equal(f.b.state,skill+'Windup');};
const release=(f,skill)=>{begin(f,skill);f.tick(K[skill+'First']+K[skill+'Windup']);};
const wolf=(x=350,y=400)=>({type:'spiritWolf',x,y,hp:100,active:true,view:node(x,y),hpBarBg:node(x,y-50),hpBar:node(x-20,y-50),
  isAlive(){return this.active&&this.hp>0;},takeDamage(n){this.hp=Math.max(0,this.hp-n);}});
const addWolves=(f,wolves)=>{f.s.skillSystem={beforePlayerDamage(){},beforePlayerHpDamage(){},passiveState:{spiritWolves:{wolves}}};};

function realSkills(f) {
  const s=f.s,listeners=new Map(),sceneListeners=new Map();
  s.eventBus.on=(type,fn)=>{const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);return ()=>set.delete(fn);};
  s.eventBus.emit=(type,meta)=>{f.events.push({type,meta});for(const fn of [...(listeners.get(type)||[])])fn(meta);};
  s.events.on=(type,fn)=>{const set=sceneListeners.get(type)||new Set();set.add(fn);sceneListeners.set(type,set);};
  s.events.off=(type,fn)=>sceneListeners.get(type)?.delete(fn);s.events.emit=type=>{for(const fn of [...(sceneListeners.get(type)||[])])fn();};
  Object.assign(s.playerData,{skills:[],mana:500,maxMana:500,skillDamageMultiplier:1,weaponId:'blade'});
  s.statusEffects=new StatusEffectSystem(s);s.artifactSystem={level:()=>0,highHpDamageMultiplier:()=>1};
  s.healPlayer=n=>{const hp=s.playerData.hp;s.playerData.hp=Math.min(s.playerData.maxHp,hp+n);return s.playerData.hp-hp;};
  s.skillSystem=new SkillSystem(s);s.movementSystem=new MovementSystem(s);return s.skillSystem;
}
const addSkill=(sys,id,level=1)=>{sys.scene.playerData.skills.push({id,level});sys.ensurePassiveBound(id);return sys.getData(id);};

// Boss5 uses the actual normal/test spawn, stats, event identity and original reward node.
for(const mode of ['normal','test']) {
  const f=fixture(mode,true),e=f.e;
  assert.equal(e.enemyId,mode==='normal'?'emperor':'thunder_war_machine');
  assert.equal(e.name,mode==='normal'?'皇者':'雷霆战争机');
  assert.equal(e.hp,9240);assert.equal(e.damage,38);assert.equal(e.speed,296);
  assert.equal(e.attackIntervalMs,mode==='normal'?2400:1080);assert.equal(e.flowBossType,'boss5');
  assert(!e.isMidBoss&&!e.isFinalBoss);assert.equal(f.b instanceof EmperorBehavior,mode==='normal');
  assert.equal(f.stage.flowState,F.BOSS_FIGHT);assert.match(f.s.status,mode==='normal'?/皇者/:/雷霆战争机/);
  const event=f.events.find(v=>v.meta?.kind==='boss');
  assert.equal(event.meta.bossId,mode==='normal'?'emperor':'mid_boss');assert.equal(event.meta.group,15);
  assert.equal(f.events.find(v=>v.type===CombatEvents.BOSS_SPAWNED).meta.enemy,e);
  let reward;f.s.queueArtifactReward=value=>{reward=value;};f.stage.onBossKilled('boss5');
  assert.match(reward.name,mode==='normal'?/皇者/:/雷霆战争机/);f.destroy();
}
{
  const f=fixture();
  for(const level of [1,16,19,100]) {
    f.stage.currentEnemyLevel=level;const e=f.stage.tunedEnemy('emperor');
    assert.equal(e.hp,Math.round(3300*(1+(level-1)*.12)));
    assert.equal(e.damage,Math.round(24*(1+(level-1)*.04)));
    assert.equal(e.attackIntervalMs,2400);assert.equal(e.attackRange,165);assert.equal(e.speed,296);
  }
  f.destroy();
}
// Supplemental greatsword attack is warned, single-hit and not a second legacy autoattack/enrage.
{
  const f=fixture();f.tick(0);assert.equal(f.b.state,'attackWindup');assert.equal(f.hits.length,0);
  f.tick(K.attackWindup-1);assert.equal(f.hits.length,0);f.tick(K.attackWindup);
  assert.deepEqual(sources(f),['emperorSword']);assert.equal(f.hits[0].amount,38);assert.equal(f.s.player.x,350);
  f.tick(K.attackWindup);assert.equal(f.hits.length,1);assert.equal(f.b.nextAttack,2620);
  f.e.hp=f.e.maxHp/3;f.s.combatSystem.updateEnemyAttack(f.e,99999);
  assert.equal(f.hits.length,1);assert.equal(f.e.enraged,false);assert.equal(f.e.attackIntervalMs,2400);f.destroy();
}
{
  const f=fixture();f.tick(0);f.s.player.x=100;f.tick(K.attackWindup);
  assert.equal(f.hits.length,0);assert.equal(f.b.nextAttack,0);f.destroy();
}
// High downward stab uses the fixed warned forward area and damages one actual live target once.
{
  const f=fixture();begin(f,'stab');assert.equal(f.hits.length,0);
  assert.deepEqual(f.b.graphics.rects,[{x:300,y:310,width:200,height:180}]);
  assert.equal(f.b.area.direction,-1);assert(f.b.graphics.lines.some(l=>l.y2===288));
  f.tick(3899);assert.equal(f.hits.length,0);f.tick(3900);
  assert.deepEqual(sources(f),['emperorStab']);assert.equal(f.hits[0].amount,114);
  assert.equal(f.hits[0].meta.attackType,'pierce');assert.equal(f.s.player.x,350);
  assert.equal(f.b.nextStab,10900);assert.equal(f.b.state,'stabRelease');
  f.tick(3900);assert.equal(f.hits.length,1);f.tick(4080);
  assert.equal(f.b.state,'recovery');assert.equal(f.b.until,5480);assert(!f.e.skillActive);
  const clocks=[f.b.nextStab,f.b.nextKick,f.b.nextEnchant],until=f.b.until;
  assert.equal(f.s.combatSystem.applyKnockback(f.e,{knockback:300}),false);f.tick(5479);
  assert.deepEqual([f.b.nextStab,f.b.nextKick,f.b.nextEnchant],clocks);
  assert.equal(f.b.until,until);assert.equal(f.hits.length,1);f.destroy();
}
{
  const f=fixture(),near=wolf(430),far=wolf(390);near.hp=far.hp=300;addWolves(f,[near,far]);release(f,'stab');
  assert.equal(near.hp,186);assert.equal(far.hp,300);assert.equal(f.s.playerData.hp,500);
  assert.equal(f.hits.length,1);assert.equal(near.x,430);f.destroy();
}
for(const kind of ['dead','outOfArea','behind','height']) {
  const f=fixture();begin(f,'stab');
  if(kind==='dead')f.s.playerData.hp=0;
  if(kind==='outOfArea')f.s.player.x=100;
  if(kind==='behind')f.s.player.x=550;
  if(kind==='height')f.s.player.y=600;
  f.tick(3900);assert.equal(f.hits.length,0);assert.equal(f.b.nextStab,3000);
  assert.equal(f.b.state,'recovery');f.destroy();
}
{
  const f=fixture();begin(f,'stab');f.s.playerData.hp=0;const w=wolf(410);w.hp=300;addWolves(f,[w]);f.tick(3900);
  assert.equal(f.hits.length,1);assert.equal(w.hp,186);assert.equal(f.b.nextStab,10900);f.destroy();
}
// The kick has its own windup/clock, actual displacement, no fire damage bonus or second frame hit.
{
  const f=fixture();f.s.player.x=400;f.b.fireUntil=20000;begin(f,'kick');f.tick(6349);
  assert.equal(f.s.player.x,400);assert.equal(f.hits.length,0);f.tick(6350);
  assert.equal(f.s.playerData.hp,458);assert.equal(f.s.player.x,304);
  assert.equal(f.hits[0].meta.source,'emperorKick');assert.equal(f.hits[0].amount,42);
  assert.equal(f.b.nextKick,12850);f.tick(6350);assert.equal(f.s.player.x,304);assert.equal(f.hits.length,1);f.destroy();
}
{
  const f=fixture();f.s.player.x=400;f.s.playerData.dodgeChance=1;
  const random=Math.random;try{Math.random=()=>0;release(f,'kick');}finally{Math.random=random;}
  assert.equal(f.s.playerData.hp,500);assert.equal(f.s.player.x,400);
  assert.equal(f.hits[0].result,0);assert.equal(f.b.nextKick,12850);f.destroy();
}
for(const skill of ['stab','kick','enchant']) {
  const f=fixture();isolate(f,skill);f.s.playerData.hp=0;f.tick(K[skill+'First']);
  assert.equal(f.b['next'+skill[0].toUpperCase()+skill.slice(1)],K[skill+'First']);
  assert.equal(f.hits.length,0);assert(!f.b.state.endsWith('Windup'));f.destroy();
}
for(const kind of ['dead','range','behind']) {
  const f=fixture();f.s.player.x=400;begin(f,'kick');
  if(kind==='dead')f.s.playerData.hp=0;else f.s.player.x=kind==='range'?200:550;
  f.tick(6350);assert.equal(f.hits.length,0);assert.equal(f.b.nextKick,6000);f.destroy();
}
// Real summons: native wolf slide occurs only once; other summons use the shared displacement/visual path.
{
  const f=fixture();f.s.player.x=100;const sys=realSkills(f);addSkill(sys,'spirit_wolves');
  SpiritWolvesSkill.cast(sys,SKILLS.spirit_wolves,sys.getData('spirit_wolves'),1);
  const w=sys.passiveState.spiritWolves.wolves[0];w.x=400;w.y=400;w.view.setPosition(400,400);release(f,'kick');
  assert.equal(w.x,400,'do not add an instant displacement to the native queued slide');
  assert.equal(w.pendingKnockbackDistance,96);assert.equal(w.knockbackUntil,6610);
  f.s.now=6370;sys.passiveUpdaters.forEach(fn=>fn());
  assert(w.x<400&&w.x>304);assert(Math.abs((400-w.x)+w.pendingKnockbackDistance-96)<1e-8);
  f.destroy();
}
{
  const f=fixture();f.s.player.x=100;const sys=realSkills(f);addSkill(sys,'spirit_bird');
  SpiritBirdSkill.cast(sys,SKILLS.spirit_bird,sys.getData('spirit_bird'),1);
  const bird=f.s.spiritBirdRuntime.getAttackTarget();bird.x=400;bird.y=400;bird.hp=500;
  bird.view.x=400;bird.hpBarBg.x=400;bird.hpBar.x=380;release(f,'kick');
  assert.equal(bird.x,304);assert.equal(bird.view.x,304);assert.equal(bird.hpBarBg.x,304);
  assert.equal(bird.hpBar.x,284);assert(bird.hp<500);f.destroy();
}
{
  const f=fixture();f.s.player.x=100;const sys=realSkills(f);addSkill(sys,'poison_king');
  sys.passiveUpdaters.forEach(fn=>fn());const king=f.s.poisonKingRuntime.get();assert(king);
  king.view.x=400;king.view.y=400;king.hp=500;release(f,'kick');
  assert.equal(king.view.x,304);assert.equal(king.hp,458);f.destroy();
}
{
  const f=fixture();f.s.player.x=100;const sys=realSkills(f);
  sys.scene.playerData.skills.push({id:'mantra_heavenly_book',level:6});chooseMantraMode(f.s,'absorb');
  const original=f.stage.spawn('grunt',300);original.y=400;
  const cfg=SKILLS.mantra_heavenly_book,ctx=sys.createCastContext(cfg.id,cfg,{manaCost:0,effectiveManaCost:0});
  MantraHeavenlyBookSkill.cast(sys,cfg,cfg.levels[5],6,ctx);f.s.now=3000;sys.updateActive(3000);
  const ally=sys.passiveState.mantraHeavenlyBook.absorb.ally;assert(ally);
  for(const view of ally.visual.nodes)view.setPosition(view.x+400-ally.x,view.y+400-ally.y);
  ally.x=400;ally.y=400;
  const visuals=ally.visual.nodes.map(v=>[v,v.x]);release(f,'kick');assert.equal(ally.x,304);
  for(const [view,x] of visuals)assert.equal(view.x,x-96);f.destroy();
}
// Stable identity after damage: no displacement of dead/removed/replaced targets or an ended scene.
for(const type of ['spirit_bird','mantraAlly','poison_king']) {
  const f=fixture();f.s.player.x=100;const old=wolf(400);old.type=type;old.hp=300;
  const replacement=wolf(450);replacement.type=type;replacement.hp=300;
  if(type==='spirit_bird')f.s.spiritBirdRuntime={getAttackTarget:()=>old};
  if(type==='mantraAlly')f.s.skillSystem={passiveState:{mantraHeavenlyBook:{absorb:{ally:old}}}};
  if(type==='poison_king')f.s.poisonKingRuntime={get:()=>old,getAttackTarget:()=>old};
  old.takeDamage=n=>{old.hp-=n;
    if(type==='spirit_bird')f.s.spiritBirdRuntime.getAttackTarget=()=>replacement;
    if(type==='mantraAlly')f.s.skillSystem.passiveState.mantraHeavenlyBook.absorb.ally=replacement;
    if(type==='poison_king')f.s.poisonKingRuntime.get=()=>replacement;
  };
  release(f,'kick');assert.equal(old.hp,258);assert.equal(old.x,400);assert.equal(replacement.x,450);f.destroy();
}
for(const event of ['targetDeath','casterDeath','sceneEnd']) {
  const f=fixture();f.s.player.x=100;const target=wolf(400);target.type='spirit_bird';target.hp=300;
  f.s.spiritBirdRuntime={getAttackTarget:()=>target};target.takeDamage=n=>{target.hp-=n;
    if(event==='targetDeath')target.hp=0;
    if(event==='casterDeath')f.s.combatSystem.killEnemy(f.e);
    if(event==='sceneEnd')f.s.finishRun();
  };
  release(f,'kick');assert.equal(target.x,400);
  if(event!=='targetDeath'){assert.equal(f.b.graphics,null);assert.equal(f.e.emperorFireSwordActive,undefined);}
  const hits=f.hits.length;f.tick(99999);assert.equal(f.hits.length,hits);f.destroy();
}
// Fire is a temporary sword multiplier only: no fire ground, damage tick, kick bonus or damage immunity.
{
  const f=fixture();release(f,'enchant');assert.equal(f.b.fireUntil,14150);assert.equal(f.b.nextEnchant,23650);
  assert.equal(f.e.emperorFireSwordActive,true);assert.equal(f.e.damage,38);assert.equal(f.e.attackIntervalMs,2400);
  assert.equal(f.hits.length,0);assert.equal(f.s.enemies.length,1);assert.equal(f.tweens.length,0);
  f.tick(9830);f.tick(10380);f.tick(10600);
  assert.deepEqual(sources(f),['emperorSword']);assert.equal(f.hits[0].amount,57);
  assert(f.s.combatSystem.damageEnemy(f.e,10,{source:'skill'}));assert.equal(f.e.hp,9230);
  f.tick(14149);f.tick(14150);assert.equal(f.e.emperorFireSwordActive,false);
  assert.equal(f.b.fireUntil,0);assert.equal(f.b.state,'fireEndRecovery');assert.equal(f.b.until,14850);
  assert.equal(f.b.swordDamage(14150),38);f.tick(14849);assert.equal(f.hits.length,1);
  f.tick(14850);f.tick(15070);assert.equal(f.hits.at(-1).amount,38);assert.equal(f.hits.length,2);f.destroy();
}
{
  const f=fixture();f.b.fireUntil=10000;release(f,'stab');assert.equal(f.hits[0].amount,171);f.destroy();
}
{
  const f=fixture();f.b.fireUntil=3500;f.b.nextAttack=Infinity;begin(f,'stab');f.tick(3500);
  assert.equal(f.b.state,'stabWindup');assert.equal(f.b.fireEndPending,true);f.tick(3900);
  assert.equal(f.hits[0].amount,114);f.tick(4080);f.tick(5480);
  assert.equal(f.b.state,'fireEndRecovery');assert.equal(f.b.until,6180);f.tick(6180);
  assert.equal(f.hits.length,1);assert.equal(f.b.state,'idle');f.destroy();
}
{
  const f=fixture();begin(f,'enchant');f.s.playerData.hp=0;f.tick(9650);
  assert.equal(f.b.fireUntil,0);assert.equal(f.b.nextEnchant,9000);assert.equal(f.hits.length,0);f.destroy();
}
// Absolute independent clocks: one action/recovery at a time, earliest due skill first, no resets from hits.
{
  const f=fixture();f.s.player.x=400;f.b.nextStab=f.b.nextKick=f.b.nextEnchant=1000;
  f.tick(1000);assert.equal(f.b.state,'stabWindup');f.tick(1900);assert.equal(f.b.nextStab,8900);
  assert.equal(f.b.nextKick,1000);assert.equal(f.b.nextEnchant,1000);
  f.tick(2080);f.tick(3480);assert.equal(f.b.state,'kickWindup');
  f.tick(3830);assert.equal(f.b.nextKick,10330);f.s.player.x=400;
  f.tick(4010);f.tick(4660);assert.equal(f.b.state,'enchantWindup');f.tick(5310);
  assert.equal(f.b.nextEnchant,19310);assert.equal(f.b.nextStab,8900);assert.equal(f.b.nextKick,10330);f.destroy();
}
// Full knockback immunity in every phase remains damageable and does not add forced counterattacks.
for(const state of ['idle','attackWindup','attackRecovery','stabWindup','stabRelease','kickWindup','kickRelease',
  'enchantWindup','enchantRelease','recovery','fireEndRecovery']) {
  const f=fixture();f.b.setState(state);const clocks=[f.b.nextStab,f.b.nextKick,f.b.nextEnchant],x=f.e.x,hp=f.e.hp;
  assert(f.e.bossSkillKnockbackImmune);assert(f.s.combatSystem.damageEnemy(f.e,5,{source:'attack',knockback:500}));
  assert.equal(f.e.x,x);assert.equal(f.e.isKnockbackActive,false);assert.equal(f.e.hp,hp-5);
  assert.deepEqual([f.b.nextStab,f.b.nextKick,f.b.nextEnchant],clocks);assert.equal(f.tweens.length,0);
  f.e.isKnockbackActive=true;f.stage.updateBossKnockbackCounterattacks(99999);assert.equal(f.hits.length,0);
  f.e.isKnockbackActive=false;f.destroy();
}
// Shared cold/gravity rules are preserved. Boss cold supplies existing slows; no new Emperor-only freeze policy.
{
  const f=fixture();applyEnemyCold(f.e,{now:0,stacks:8,data:{maxStacks:8,slowPerStack:.1,attackSlowPerStack:.1,
    bossMaxMoveSlow:.45,bossMaxAttackSlow:.5,coldDurationMs:30000}});
  assert.equal(getEnemyMoveSpeed(f.e,296,0),296*.55);assert.equal(getEnemyAttackDelay(f.e,2400,0),4800);
  f.tick(0);f.tick(220);assert.equal(f.b.nextAttack,5020);isolate(f,'stab');
  f.tick(3000);f.tick(3900);assert.equal(f.b.nextStab,17900);f.destroy();
}
{
  const f=fixture();begin(f,'stab');f.e.gravityReversalState={};f.tick(3400);f.tick(3600);f.tick(3800);
  assert.equal(f.hits.length,0);assert.equal(f.b.until,4300);delete f.e.gravityReversalState;
  f.tick(3900);assert.equal(f.hits.length,0);f.tick(4300);assert.equal(f.hits.length,1);f.destroy();
}
// Pause, timer shifts and left-side recycle cannot renew fire, ghost-strike or reset cooldowns.
{
  const f=fixture();release(f,'enchant');f.b.nextAttack=Infinity;f.tick(9830);f.tick(10380);
  f.e.gravityReversalState={};f.tick(13500);f.tick(14500);
  assert.equal(f.b.fireUntil,15150,'control timer shift must precede buff expiry even on a late frame');
  assert.equal(f.e.emperorFireSwordActive,true);assert.equal(f.b.fireEndPending,false);
  delete f.e.gravityReversalState;f.tick(14510);assert.equal(f.b.fireUntil,15150);
  f.tick(15150);assert.equal(f.b.state,'fireEndRecovery');assert.equal(f.hits.length,0);f.destroy();
}
{
  const f=fixture();begin(f,'stab');f.s.paused=true;f.s.enemyBehaviors.pause();f.tick(3900);
  assert.equal(f.hits.length,0);f.s.enemyBehaviors.shiftTimers(1000,3000);
  f.s.paused=false;f.s.enemyBehaviors.resume();f.tick(4899);assert.equal(f.hits.length,0);
  f.tick(4900);assert.equal(f.hits.length,1);f.destroy();
}
{
  const f=fixture();release(f,'enchant');f.s.enemyBehaviors.shiftTimers(1000,9650);
  assert.equal(f.b.fireUntil,15150);assert.equal(f.b.nextEnchant,24650);
  f.e.x=-100;f.tick(10700);assert(f.e.x>720);assert.equal(f.e.recycleCount,1);
  assert.equal(f.b.fireUntil,15150);assert.equal(f.b.nextEnchant,24650);
  f.tick(15150);assert.equal(f.b.fireUntil,0);assert.equal(f.e.emperorFireSwordActive,false);
  assert.equal(f.hits.length,0);f.destroy();
}
for(const skill of ['stab','kick','enchant']) {
  const f=fixture();if(skill==='kick')f.s.player.x=400;begin(f,skill);
  const clocks=[f.b.nextStab,f.b.nextKick,f.b.nextEnchant];f.e.x=-100;f.tick(K[skill+'First']+1);
  assert(f.e.x>720);assert.equal(f.b.area,null);assert.equal(f.b.state,'recovery');
  assert.deepEqual([f.b.nextStab,f.b.nextKick,f.b.nextEnchant],clocks);
  f.tick(K[skill+'First']+K[skill+'Windup']);assert.equal(f.hits.length,0);f.destroy();
}
// Real lifecycle routes and damage callbacks destroy graphics/buff references before modal/death flow.
const phaseSetup={
  idle:()=>{},attackWindup:f=>f.tick(0),attackRecovery:f=>{f.tick(0);f.tick(220);},
  stabWindup:f=>begin(f,'stab'),stabRelease:f=>release(f,'stab'),recovery:f=>{release(f,'stab');f.tick(4080);},
  kickWindup:f=>{f.s.player.x=400;begin(f,'kick');},kickRelease:f=>{f.s.player.x=400;release(f,'kick');},
  enchantWindup:f=>begin(f,'enchant'),enchantRelease:f=>release(f,'enchant'),
  fireEndRecovery:f=>{release(f,'enchant');f.b.nextAttack=Infinity;f.tick(9830);f.tick(10380);f.tick(14150);}
};
for(const [state,setup] of Object.entries(phaseSetup)) {
  const f=fixture();setup(f);assert.equal(f.b.state,state);const hits=f.hits.length;
  f.destroy();assert.equal(f.s.enemyBehaviors.items.size,0);assert.equal(f.b.graphics,null);
  assert.equal(f.b.area,null);assert.equal(f.b.fireUntil,0);assert.equal(f.e.emperorFireSwordActive,undefined);
  assert.equal(f.e.bossSkillKnockbackImmune,false);assert(f.graphics.every(g=>g.destroyed));
  f.b.update(99999);assert.equal(f.hits.length,hits);
}
for(const skill of ['stab','kick']) {
  const f=fixture('normal',true);if(skill==='kick')f.s.player.x=400;
  begin(f,skill);const damage=f.s.combatSystem.damageAttackTarget.bind(f.s.combatSystem);
  f.s.combatSystem.damageAttackTarget=(...args)=>{const n=damage(...args);f.s.combatSystem.killEnemy(f.e);return n;};
  f.tick(K[skill+'First']+K[skill+'Windup']);assert.equal(f.b.graphics,null);
  assert.equal(f.e.emperorFireSwordActive,undefined);assert.equal(f.hits.length,1);
  f.tick(99999);assert.equal(f.hits.length,1);f.destroy();
}
{
  const f=fixture('normal',true);release(f,'enchant');let rewards=0,campfires=0,gold=0;
  f.s.awardGold=n=>gold+=n;f.s.queueArtifactReward=(data,context)=>{rewards++;
    assert.equal(context.afterBoss,'boss5');assert.match(data.name,/皇者/);
    assert.equal(f.b.graphics,null);assert.equal(f.e.emperorFireSwordActive,undefined);
    assert.equal(f.s.enemyBehaviors.items.has(f.e),false);};
  f.s.showCampfire=()=>campfires++;f.s.combatSystem.killEnemy(f.e);f.s.combatSystem.killEnemy(f.e);
  f.stage.onBossKilled('boss5');assert.equal(rewards,1);assert.equal(gold,0);assert.equal(f.stage.flowState,F.ARTIFACT_REWARD);
  assert.equal(f.events.filter(v=>v.type===CombatEvents.BOSS_KILLED).length,1);
  f.stage.beginAfterBossReward('boss5');f.stage.beginAfterBossReward('boss5');
  assert.equal(campfires,1);assert.equal(f.stage.flowState,F.CAMPFIRE);f.destroy();
}
console.log('PASS 01147 Emperor: actual mode/stats/rewards; fixed single stab; kick/native summon displacement & identity; independent clocks; temporary fire swords/end gap; full knockback-only immunity; cold/gravity; pause/recycle/cleanup/callback death.');
