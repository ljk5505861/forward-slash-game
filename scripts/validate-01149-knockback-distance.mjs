import assert from 'node:assert/strict';
import CombatSystem,{NORMAL_ATTACK_KNOCKBACK_DURATION_MS,NORMAL_ATTACK_KNOCKBACK_LIFT_PX,ENEMY_LANDING_STUN_MS,isEnemyLandingStunned} from '../src/systems/CombatSystem.js';
import StageSystem from '../src/systems/StageSystem.js';
import TargetingSystem from '../src/systems/TargetingSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import MeatBehavior from '../src/enemies/behaviors/MeatBehavior.js';
import {BALANCE} from '../src/config/balance.js';
import {ENEMIES} from '../src/config/enemies.js';
import MovementSystem from '../src/systems/MovementSystem.js';

import {WEAPONS} from '../src/config/weapons.js';
import {SKILLS} from '../src/config/skills.js';
import {CombatEvents} from '../src/core/CombatEvents.js';
import {SKILL_HANDLERS} from '../src/skills/handlers/index.js';
import {SpiritWolvesSkill} from '../src/skills/handlers/SpiritWolvesSkill.js';

// The behavior manager loads Phaser in Node: use the same DOM shims as the existing combat regression.
global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,k){ if(k==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});},style:{}};},addEventListener(){},removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:global.window.navigator,configurable:true});
global.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } };
global.HTMLCanvasElement=class {};
const {default:EnemyBehaviorManager}=await import('../src/enemies/behaviors/EnemyBehaviorManager.js');

function node(x=0,y=0,width=0,height=0) {
  const n={x,y,width,height,active:true,alpha:1,destroy(){this.active=false;},
    setPosition(x,y){this.x=x;this.y=y;return this;},setX(x){this.x=x;return this;},
    setText(text){this.text=text;return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},add(){return this;}};
  for(const key of ['setStrokeStyle','setDepth','setOrigin','setVisible','setAlpha','setFillStyle','setScale',
    'clear','lineStyle','lineBetween','strokeCircle','strokeRect','fillStyle','fillRect','setRotation'])n[key]=()=>n;
  n.body={enable:true,velocity:{x:0},setVelocityX(v){this.velocity.x=v;},reset(x,y){n.x=x;n.y=y;},
    setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}};
  return n;
}
function fixture(runMode='normal',id='grunt') {
  const tweens=[],hits=[],events=[],listeners=new Map(),graphics=[];
  const s={runMode,now:0,paused:false,enemies:[],killCount:0,balance:{...BALANCE,stageWorldWidth:4000,groundTopY:1000},
    player:node(400,960,45,78),playerData:{hp:1000,maxHp:1000,baseMaxHp:1000,baseAttack:2,baseDefense:0,
      skills:[],mana:1000,maxMana:1000,skillDamageMultiplier:1,weaponId:'short_sword'},
    cameras:{main:{worldView:{x:0,width:720},width:720,scrollX:0}},getGameplayTime(){return this.now;},
    isGameplayPaused(){return this.paused;},physics:{add:{existing(){}}},hud:{update(){}},floatText(){},finishRun(){this.paused=true;},
    events:{on(){},once(){},off(){}},artifactSystem:{level:()=>0,highHpDamageMultiplier:()=>1},
    eventBus:{on(type,fn){const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);return ()=>set.delete(fn);},
      emit(type,payload){events.push({type,payload});for(const fn of [...(listeners.get(type)||[])])fn(payload);}},
    add:{rectangle:(...a)=>Object.assign(node(...a),{scene:s}),text:(x,y)=>node(x,y),circle:node,ellipse:node,container:node,
      graphics:()=>{const g=node();graphics.push(g);return g;}},
    tweens:{add(config){const t={config,stopped:false,removed:false,paused:false,
      stop(){this.stopped=true;},remove(){this.removed=true;},pause(){this.paused=true;},resume(){this.paused=false;}};
      tweens.push(t);return t;}}};
  s.targeting=new TargetingSystem(s);s.combatSystem=new CombatSystem(s);s.stageSystem=new StageSystem(s);
  const e=s.stageSystem.spawn(id,500);e.isKnockbackActive=false;const damage=s.combatSystem.damageAttackTarget.bind(s.combatSystem);
  s.combatSystem.damageAttackTarget=(target,amount,meta)=>{const result=damage(target,amount,meta);hits.push({target,amount,meta,result});return result;};
  return {s,e,tweens,hits,events,graphics,finish(target=e){const c=target.knockbackTween.config;c.targets.t=1;c.onUpdate();c.onComplete();},
    destroy(){s.skillSystem?.reset();s.combatSystem.clearAllKnockbacks();graphics.forEach(g=>g.destroy());}};
}

// Final rounded/resisted/capped distance is 4x the original in normal mode (2x v0.11.51).
const cases=[['grunt',288,72],['armored_guard',172,43],['elite',100,25],['elite_golden_guard',100,25],
  ['mountain_general',232,58],['thornless_rose',232,58],['uncrowned_king',232,58],
  ['foreseer',232,58],['abyss_apostle',232,58],['boss',40,10]];
for(const [id,normal,test] of cases)for(const mode of ['normal','test',undefined]) {
  const f=fixture(mode,id);if(mode===undefined)f.s.runMode=undefined;
  const x=f.e.x,y=f.e.y,expected=mode==='normal'?normal:test;
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));const tween=f.e.knockbackTween;
  const duration=['mountain_general','thornless_rose','uncrowned_king','foreseer','abyss_apostle'].includes(id)
    ?(id==='thornless_rose'?140:150):NORMAL_ATTACK_KNOCKBACK_DURATION_MS;
  assert.equal(tween.config.duration,duration);tween.config.targets.t=.5;tween.config.onUpdate();
  assert.equal(f.e.x,x+expected/2);assert(Math.abs(f.e.y-(y-(f.e.isBoss?0:NORMAL_ATTACK_KNOCKBACK_LIFT_PX)))<1e-8);
  f.finish();assert.equal(f.e.x,x+expected);assert.equal(f.e.y,y);assert.equal(f.e.isKnockbackActive,false);
  assert.equal(f.e.hpBarBg.x,f.e.x);assert.equal(f.e.nameText.x,f.e.x);f.destroy();
}
for(const mode of ['normal','test']) {
  const f=fixture(mode);f.s.combatSystem.performDefaultAttack(f.e,WEAPONS.short_sword);
  assert.equal(f.events.filter(v=>v.type===CombatEvents.ENEMY_HIT).length,1);assert(f.e.hp<f.e.maxHp);
  f.finish();assert.equal(f.e.x,mode==='normal'?788:572);assert.equal(WEAPONS.short_sword.knockback,72,'shared weapon input stat is unchanged');f.destroy();
}
for(const base of [0,-1]) {
  const f=fixture();assert.equal(f.s.combatSystem.applyKnockback(f.e,{knockback:base}),false);
  assert.equal(f.tweens.length,0);assert.equal(f.e.x,500);f.destroy();
}
{
  const f=fixture();assert(f.s.combatSystem.applyKnockback(f.e,{knockback:1}));f.finish();assert.equal(f.e.x,508,'scale after the old 2px minimum/rounding');f.destroy();
}
// Boss skill immunity/Emperor full immunity and gravity reversal cannot be bypassed by the multiplier.
for(const kind of ['skill','emperor','gravity']) {
  const f=fixture('normal',kind==='emperor'?'emperor':'mountain_general');
  if(kind==='skill')f.e.bossSkillKnockbackImmune=true;
  if(kind==='gravity')f.e.gravityReversalState={};
  const hp=f.e.hp;f.s.combatSystem.damageEnemy(f.e,2,{source:'attack',knockback:72});
  assert.equal(f.e.hp,hp-2);assert.equal(f.e.x,500);assert.equal(f.e.isKnockbackActive,false);assert.equal(f.tweens.length,0);f.destroy();
}
// Directions, legal world bounds, repeated hit replacement, pause and disposal remain intact.
for(const [x,playerX,end] of [[3950,3500,3966],[50,300,34],[300,600,34]]) {
  const f=fixture();f.e.x=x;f.s.player.x=playerX;assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  f.finish();assert.equal(f.e.x,end);f.destroy();
}
{
  const f=fixture();f.s.combatSystem.applyKnockback(f.e,{knockback:72});const first=f.e.knockbackTween;
  first.config.targets.t=.5;first.config.onUpdate();assert.equal(f.e.x,644);
  f.s.combatSystem.applyKnockback(f.e,{knockback:72});assert(first.stopped&&first.removed);
  f.s.combatSystem.pauseKnockbacks();assert(f.e.knockbackTween.paused);f.s.combatSystem.resumeKnockbacks();assert(!f.e.knockbackTween.paused);
  f.finish();assert.equal(f.e.x,932);assert.equal(f.s.combatSystem.knockbackTargets.size,0);f.destroy();
}
{
  const f=fixture();f.e.hp=1;f.s.combatSystem.damageEnemy(f.e,5,{source:'attack',knockback:72});
  assert(f.e.isDefeated);assert.equal(f.e.x,500);assert.equal(f.e.isKnockbackActive,false);assert.equal(f.s.combatSystem.knockbackTargets.size,0);f.destroy();
}

// Current rewritten sword/blade skills do not have knockback; scaling cannot introduce it.
assert.equal(SKILLS.sword_wave.handler,'entry_sword');
for(const id of ['sword_wave','spinning_blade'])assert(SKILLS[id].levels.every(data=>!data.knockback));
{
  const f=fixture();f.s.combatSystem.damageEnemy(f.e,1,{source:'skill',noKnockback:true,applyKnockback:true,knockback:72});
  assert.equal(f.e.x,500);assert.equal(f.e.knockbackTween,undefined);f.destroy();
}

// Real passive handlers still use their configured input distance once; Combat applies mode scaling once.
for(const mode of ['normal','test'])for(const id of ['charged_slam','kinetic_release']) {
  const f=fixture(mode);f.e.hp=f.e.maxHp=500;f.s.player.y=f.e.y;f.s.playerData.skills=[{id,level:3}];
  const sys=new SkillSystem(f.s);f.s.skillSystem=sys;
  if(id==='charged_slam')for(let i=0;i<SKILLS[id].levels[2].attacksRequired;i++)
    f.s.eventBus.emit(CombatEvents.PLAYER_ATTACK_RESOLVED,{enemy:f.e,targets:[f.e],baseDamage:10});
  else {sys.passiveState.kineticRelease.kinetic=SKILLS[id].levels[2].kineticRequired;sys.passiveUpdaters.forEach(fn=>fn());}
  assert(f.e.knockbackTween,'real handler creates the real Combat knockback');f.finish();
  const base=SKILLS[id].levels[2].knockback;assert.equal(f.e.x,500+base*(mode==='normal'?4:1));f.destroy();
}
for(const id of ['charged_slam','kinetic_release']) {
  const f=fixture();f.e.hp=1;f.s.player.y=f.e.y;f.s.playerData.skills=[{id,level:3}];
  const sys=new SkillSystem(f.s);f.s.skillSystem=sys;
  if(id==='charged_slam')for(let i=0;i<SKILLS[id].levels[2].attacksRequired;i++)
    f.s.eventBus.emit(CombatEvents.PLAYER_ATTACK_RESOLVED,{enemy:f.e,targets:[f.e],baseDamage:10});
  else {sys.passiveState.kineticRelease.kinetic=SKILLS[id].levels[2].kineticRequired;sys.passiveUpdaters.forEach(fn=>fn());}
  assert(f.e.isDefeated);assert.equal(f.e.x,500);assert.equal(f.e.knockbackTween,null,'lethal real skill damage cannot leave a new knockback');f.destroy();
}

function meat(f) {
  f.s.player.x=260;f.s.player.y=f.e.y-8;
  const h={approach(){},getEnemyAttackDelay:(_e,ms)=>ms,
    chooseTarget:(s,e,r)=>s.combatSystem.chooseEnemyAttackTarget(e,r),
    chooseAnyTarget:(s,e,r)=>s.combatSystem.chooseEnemyAttackTarget(e,r),
    targetDamage:(s,target,e,amount,meta)=>s.combatSystem.damageAttackTarget(target,amount,{enemy:e,singleTarget:true,dodgeable:true,...meta})};
  const b=new MeatBehavior(f.s,f.e,h);
  return {b,tick(t){f.s.now=t;b.update(t);},destroy(){b.destroy();f.destroy();}};
}
// Actual swept chain knife -> damageAttackTarget -> damagePlayer: same damage, no displacement or recall hit.
{
  const f=fixture('normal','armored_guard'),m=meat(f),hp=f.s.playerData.hp,x=f.s.player.x;
  for(const t of [0,4500,5150,5500])m.tick(t);
  assert.equal(f.hits.length,1);assert.equal(f.hits[0].meta.source,'meatKnife');assert.equal(f.hits[0].meta.knockbackDistance,0);
  assert.equal(f.s.playerData.hp,hp-3);assert.equal(f.s.player.x,x);assert.equal(m.b.state,'recall');
  m.tick(5500);m.tick(5850);assert.equal(f.hits.length,1);assert.equal(m.b.nextThrow,12350);m.destroy();
}
{
  const f=fixture('normal','armored_guard'),m=meat(f);f.s.playerData.skills=[{id:'spirit_wolves',level:1}];
  const sys=new SkillSystem(f.s);f.s.skillSystem=sys;SpiritWolvesSkill.cast(sys,SKILLS.spirit_wolves,sys.getData('spirit_wolves'),1);
  const w=sys.passiveState.spiritWolves.wolves[0];w.x=300;w.y=f.e.y-8;w.hp=500;w.view.setPosition(w.x,w.y);
  for(const t of [0,4500,5150,5500])m.tick(t);
  assert.equal(w.hp,497);assert.equal(w.x,300);assert.equal(w.pendingKnockbackDistance,0);
  assert.equal(f.s.playerData.hp,1000);assert.equal(f.s.player.x,260);m.destroy();
}
{
  const f=fixture(),x=f.s.player.x;f.s.combatSystem.damagePlayer({x:500},6,{source:'meatKnife',knockbackDistance:36});
  assert.equal(f.s.player.x,x,'retired meat source cannot displace even with an old payload');assert.equal(f.s.playerData.hp,994);
  f.s.combatSystem.damagePlayer({x:500},6,{source:'emperorKick',knockbackDistance:96});
  assert.equal(f.s.player.x,x-96,'other enemy-to-player knockback is neither removed nor doubled');f.destroy();
}
// v0.11.50: equal baseline melee reach, with no longer-range free player hits.
{
  const f=fixture();
  assert.equal(WEAPONS.short_sword.attackRange,ENEMIES.grunt.attackRange);
  f.s.player.x=f.e.x-ENEMIES.grunt.attackRange;f.s.player.y=f.e.y;
  new MovementSystem(f.s).update();
  assert.equal(f.s.player.body.velocity.x,0,'player stops within the shared melee reach');
  const before=f.s.playerData.hp;
  f.s.combatSystem.updateEnemyAttack(f.e,0);
  assert(f.s.playerData.hp<before,'grunt can hit at the same distance as the player');
  const hp=f.e.hp;
  f.s.combatSystem.update(0);
  assert(f.e.hp<hp,'player can also hit at the shared distance');
  f.destroy();
}
// Only finished airborne lift starts exactly 200ms of normal-mode control.
{
  const f=fixture(), manager=new EnemyBehaviorManager(f.s);f.s.enemyBehaviors=manager;manager.attach(f.e);
  f.s.now=200;assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  assert.equal(f.e.landingRecoveryUntil||0,0,'no landing recovery in midair');
  f.s.now+=NORMAL_ATTACK_KNOCKBACK_DURATION_MS;f.finish();
  assert.equal(f.e.isKnockbackActive,false);
  assert.equal(f.e.landingRecoveryUntil,f.s.now+ENEMY_LANDING_STUN_MS);
  f.s.player.x=400;
  manager.update(f.s.now);assert.equal(f.e.body.velocity.x,0);
  f.s.now+=ENEMY_LANDING_STUN_MS-1;
  manager.update(f.s.now);assert.equal(f.e.body.velocity.x,0,'still frozen at 199ms');
  f.s.player.x=f.e.x-40;f.s.player.y=f.e.y;
  const before=f.s.playerData.hp;f.e.nextAttackAt=0;
  f.s.combatSystem.updateEnemyAttack(f.e,f.s.now);
  assert.equal(f.s.playerData.hp,before,'cannot attack during 200ms recovery');
  f.s.now++;
  assert(!isEnemyLandingStunned(f.e,f.s.now));
  f.s.player.x=400;manager.update(f.s.now);
  assert(f.e.body.velocity.x<0,'can move after 200ms if no new attack starts');
  f.s.player.x=f.e.x-40;f.s.combatSystem.updateEnemyAttack(f.e,f.s.now);
  assert(f.s.playerData.hp<before,'can attack when 200ms expires');
  manager.destroy();f.destroy();
}
{
  const f=fixture();f.s.now=500;
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));f.finish();
  assert.equal(f.e.landingRecoveryUntil,500+ENEMY_LANDING_STUN_MS);
  f.s.now=550;assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  assert.equal(f.e.landingRecoveryUntil,0,'new launch cancels earlier landing stun');
  f.s.now=990;f.finish();
  assert.equal(f.e.landingRecoveryUntil,990+ENEMY_LANDING_STUN_MS);
  f.s.combatSystem.clearAllKnockbacks();
  assert.equal(f.e.landingRecoveryUntil,0,'reset clears completed landing stun');
  f.destroy();
}
{
  const f=fixture('normal','mountain_general');
  assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  f.s.now=150;f.finish();
  assert.equal(f.e.landingRecoveryUntil||0,0,'boss without vertical lift does not enter landing stun');
  f.destroy();
}
{
  const f=fixture();assert(f.s.combatSystem.applyKnockback(f.e,{knockback:72}));
  f.s.now=440;f.finish();f.s.cameras.main.worldView.x=Math.max(0,f.e.x-500);f.e.hp=1;
  f.s.combatSystem.damageEnemy(f.e,5,{source:'attack',knockback:72});
  assert(f.e.isDefeated);assert.equal(f.e.landingRecoveryUntil,0,'death clears landing recovery');
  f.destroy();
}
console.log('PASS 01151: equal melee reach, 200ms normal-mode landing freeze, recovery, repeated knockback, reset and death.');
console.log('PASS 01149: actual normal-only 4x original final distances; resistance/rounding/cap/bounds/direction/duration/lift/cleanup; real default attack, charged slam and kinetic release; no new sword/blade knockback; dead target safety; real meat chain/player/wolf damage without active knockback; other incoming displacement unchanged.');
