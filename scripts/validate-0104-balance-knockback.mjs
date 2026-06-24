import { strict as assert } from 'node:assert';
import { ENEMIES } from '../src/config/enemies.js';
import { SKILLS } from '../src/config/skills.js';
import { BALANCE } from '../src/config/balance.js';
import { WEAPONS } from '../src/config/weapons.js';
import CombatSystem, { MIN_PLAYER_ATTACK_INTERVAL_MS } from '../src/systems/CombatSystem.js';
import { playerHealthBarSize, playerHealthBarY } from '../src/ui/PlayerHealthBar.js';

global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,k){ if(k==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});},style:{}};},addEventListener(){},removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:global.window.navigator,configurable:true});
global.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } };
global.HTMLCanvasElement=class {};
const { approach, entryMove } = await import('../src/enemies/behaviors/EnemyBehaviorManager.js');

const old = {
  grunt:{hp:25,damage:4,speed:300}, elite:{hp:120,damage:10,speed:300}, armored_guard:{hp:66,damage:6,defense:2,damageReduction:0.12,speed:300}, charger:{hp:32,damage:5,chargeDamage:11,speed:300},
  bomber:{hp:38,damage:4,bombDamage:9,speed:300}, healer:{hp:34,damage:3,healAmount:18,speed:300}, berserker_boss:{hp:1000,damage:12,chargeDamage:20,speed:340,chargeSpeed:240},
  mid_boss:{hp:1500,damage:17,slamDamage:14,chargeDamage:18,speed:340}, boss:{hp:2200,damage:24,speed:340}
};
const rounded = v => Math.round(v*0.8);
for(const [id,cfg] of Object.entries(ENEMIES)){
  assert.equal(cfg.speed, cfg.kind==='boss'?272:240, `${id} speed`);
  assert.equal('entrySpeed' in cfg, false, `${id} has no entrySpeed`); assert.equal('combatSpeed' in cfg, false, `${id} has no combatSpeed`);
  assert.equal(cfg.hp, rounded(old[id].hp), `${id} hp nerfed once`);
  for(const field of ['damage','chargeDamage','bombDamage','slamDamage']) if(old[id][field]!==undefined) assert.equal(cfg[field], rounded(old[id][field]), `${id} ${field} nerfed once`);
  if(old[id].defense!==undefined) assert.equal(cfg.defense, old[id].defense);
  if(old[id].damageReduction!==undefined) assert.equal(cfg.damageReduction, old[id].damageReduction);
}
assert.equal(ENEMIES.charger.chargeDamage, 9); assert.equal(ENEMIES.berserker_boss.chargeSpeed, 240); assert.equal(ENEMIES.healer.healAmount, 18);

assert.equal(SKILLS.time_loan.cooldownMs, 10000); assert.equal(SKILLS.judgment_pendulum.cooldownMs, 5000); assert.equal(SKILLS.parasite_lantern.cooldownMs, 4200); assert.equal(SKILLS.hanging_blade.cooldownMs, 4500); assert.equal(SKILLS.mirror_march.cooldownMs, 6000);
assert.equal(SKILLS.healing.cooldownMs, 6500); assert.equal(SKILLS.shadow_fist.cooldownMs, 999999); assert.equal(SKILLS.bullet_eater.cooldownMs, 999999);
assert.equal(SKILLS.judgment_pendulum.levels[0].damage, 34); assert.equal(SKILLS.judgment_pendulum.levels[0].width, 520); assert.equal(SKILLS.parasite_lantern.levels[0].damage, 9);
assert.equal(WEAPONS.short_sword.attackIntervalMs, 333);
assert(Math.abs(1000 / WEAPONS.short_sword.attackIntervalMs - 3) < 0.01, 'short sword attacks about 3 times per second');
assert.equal(WEAPONS.short_sword.damageMultiplier, 1, 'normal attack damage unchanged');
assert.equal(WEAPONS.short_sword.attackRange, 88, 'normal attack range unchanged');
assert.equal(WEAPONS.short_sword.knockback, 72, 'normal attack knockback unchanged');

const player={x:100,y:200,width:BALANCE.player.width,height:BALANCE.player.height}; const size=playerHealthBarSize(player);
assert.equal(size.width, Math.round(BALANCE.player.width*1.25)); assert.notEqual(size.width, 82); assert(size.height<=8 && size.height>=5); assert.equal(playerHealthBarY(player), player.y-player.height/2-10);

const makeEnemy=(props={})=>({x:500,y:800,width:52,height:83,active:true,isDefeated:false,hp:10,maxHp:10,damage:3,attackRange:999,nextAttackAt:1000,body:{vx:0,velocity:{x:0},setVelocityX(v){this.vx=v; this.velocity.x=v;},reset(x,y){this.owner.x=x;this.owner.y=y;}},hpBarBg:{setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){this.destroyed=true;}},hpBar:{setPosition(x,y){this.x=x;this.y=y;return this;},setDisplaySize(w,h){this.w=w;this.h=h;return this;},destroy(){this.destroyed=true;}},nameText:{setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){this.destroyed=true;}},destroy(){this.active=false;},...props});
const makeScene=()=>({balance:BALANCE,player:{x:100},enemies:[],killCount:0,awardGold(){},stageSystem:{},runStats:{},playerData:{hp:100},getGameplayTime(){return 1000;},targeting:{valid:e=>!!e&&!e.isDefeated,isEnemyFullyInsideViewport(){return true;}},professionSystem:{getDamageMultiplier(){return 1;}},eventBus:{emit(){}},floatText(){},damageLog:[],isGameplayPaused(){return false;},skillSystem:{beforePlayerDamage(){}},statusEffects:{clearTarget(){},absorbShield(d){return {absorbed:0,remainingDamage:d};}},hud:{update(){},setStatus(){}},finishRun(){},tweens:{items:[],last:null,add(cfg){ const tween={cfg,paused:false,stopped:false,removed:false,pause(){this.paused=true;},resume(){this.paused=false;},stop(){this.stopped=true;},remove(){this.removed=true;}}; this.last=cfg; this.items.push(tween); return tween;}}});
const scene=makeScene(); const combat=new CombatSystem(scene);
assert.equal(MIN_PLAYER_ATTACK_INTERVAL_MS, 180, 'minimum normal attack interval is 180ms');
scene.playerData.attackSpeedMultiplier=1;
assert.equal(combat.getPlayerAttackInterval(WEAPONS.short_sword), 333, 'base normal attack interval has no speed bonus');
scene.playerData.attackSpeedMultiplier=10;
assert.equal(combat.getPlayerAttackInterval(WEAPONS.short_sword), 180, 'high attack speed is clamped to minimum interval');
scene.playerData.attackSpeedMultiplier=10;
assert.equal(combat.getPlayerAttackInterval(WEAPONS.short_sword,{intervalMultiplier:0.82}), 180, 'profession attack profiles also use minimum interval');
scene.playerData.attackSpeedMultiplier=1;
const complete = enemy => { scene.tweens.last.targets.t=1; scene.tweens.last.onComplete(); return enemy; };

const right=makeEnemy({x:500}); right.body.owner=right; combat.applyKnockback(right,{knockback:WEAPONS.short_sword.knockback}); assert.equal(right.isKnockbackActive,true); assert.equal(scene.tweens.last.duration,220, 'arced knockback duration unchanged'); assert.equal(right.x,500,'does not jump instantly'); scene.tweens.last.targets.t=0.5; scene.tweens.last.onUpdate(); assert(right.x>500 && right.x<572); assert(right.y<800); complete(right); assert.equal(right.x,572); assert.equal(right.y,800); assert.equal(right.isKnockbackActive,false); assert(right.hpBarBg.x===right.x && right.nameText.x===right.x);

scene.player.x=500; const left=makeEnemy({x:420}); left.body.owner=left; combat.applyKnockback(left,{knockback:72}); complete(left); assert.equal(left.x,348, 'enemy left of player is knocked left');
const sameX=makeEnemy({x:500}); sameX.body.owner=sameX; combat.applyKnockback(sameX,{knockback:72}); complete(sameX); assert.equal(sameX.x,572, 'same X defaults to right when no direction is reliable');
const leftEdge=makeEnemy({x:30}); leftEdge.body.owner=leftEdge; scene.player.x=100; combat.applyKnockback(leftEdge,{knockback:72}); complete(leftEdge); assert.equal(leftEdge.x, leftEdge.width/2+8, 'left boundary clamps');
const rightEdge=makeEnemy({x:BALANCE.stageWorldWidth-30}); rightEdge.body.owner=rightEdge; scene.player.x=rightEdge.x-100; combat.applyKnockback(rightEdge,{knockback:72}); complete(rightEdge); assert.equal(rightEdge.x, BALANCE.stageWorldWidth-rightEdge.width/2-8, 'right boundary clamps');

scene.player.x=100; let playerDamageCalls=0; combat.damagePlayer=()=>{ playerDamageCalls+=1; }; const attacker=makeEnemy({x:90,nextAttackAt:0,isKnockbackActive:true}); const nextBefore=attacker.nextAttackAt; combat.updateEnemyAttack(attacker,5000); assert.equal(playerDamageCalls,0); assert.equal(attacker.nextAttackAt,nextBefore, 'knockback does not refresh attack cooldown'); attacker.isKnockbackActive=false; combat.updateEnemyAttack(attacker,5000); assert.equal(playerDamageCalls,1, 'attack resumes after knockback');

scene.player.x=100; const pauseEnemy=makeEnemy({x:500}); pauseEnemy.body.owner=pauseEnemy; combat.applyKnockback(pauseEnemy,{knockback:72}); scene.tweens.last.targets.t=0.25; scene.tweens.last.onUpdate(); const pausedX=pauseEnemy.x, pausedY=pauseEnemy.y; combat.pauseKnockbacks(); const activeTween=scene.tweens.items.at(-1); assert.equal(activeTween.paused,true); for(let i=0;i<5;i+=1){ if(!activeTween.paused){ scene.tweens.last.targets.t+=0.2; scene.tweens.last.onUpdate(); } } assert.equal(pauseEnemy.x,pausedX); assert.equal(pauseEnemy.y,pausedY); combat.resumeKnockbacks(); assert.equal(activeTween.paused,false); scene.tweens.last.targets.t=0.5; scene.tweens.last.onUpdate(); assert(pauseEnemy.x>pausedX && pauseEnemy.x<572, 'resume continues from paused progress'); scene.tweens.last.targets.t=1; scene.tweens.last.onComplete(); assert.equal(pauseEnemy.x,572);

const dying=makeEnemy({x:500}); dying.body.owner=dying; combat.applyKnockback(dying,{knockback:72}); const dyingTween=dying.knockbackTween; combat.killEnemy(dying,{}); assert.equal(dying.isKnockbackActive,false); assert.equal(dying.knockbackTween,null); assert.equal(dyingTween.stopped,true);
const repeat=makeEnemy({x:500}); repeat.body.owner=repeat; combat.applyKnockback(repeat,{knockback:72}); const firstTween=repeat.knockbackTween; scene.tweens.last.targets.t=0.4; scene.tweens.last.onUpdate(); const repeatY=repeat.y; combat.applyKnockback(repeat,{knockback:72}); assert.equal(firstTween.stopped,true, 'repeated knockback clears previous tween'); assert.equal(firstTween.removed,true, 'repeated knockback removes previous tween'); assert.equal(repeat.isKnockbackActive,true); assert.notEqual(repeat.knockbackTween,firstTween, 'repeated knockback creates one replacement tween'); assert.equal(repeat.knockbackGroundY,800, 'repeated knockback keeps original ground Y'); assert(repeatY<800, 'second knockback can start while target is airborne'); scene.tweens.last.targets.t=1; scene.tweens.last.onComplete(); assert.equal(repeat.y,800, 'repeated knockback lands on original ground Y');

const boss=makeEnemy({x:500,isBoss:true}); boss.body.owner=boss; scene.player.x=100; combat.applyKnockback(boss,{knockback:72}); complete(boss); assert.equal(boss.x,509);
const elite=makeEnemy({x:500,isElite:true}); elite.body.owner=elite; combat.applyKnockback(elite,{knockback:72}); complete(elite); assert.equal(elite.x,525);
const armored=makeEnemy({x:500,enemyId:'armored_guard'}); armored.body.owner=armored; combat.applyKnockback(armored,{knockback:72}); complete(armored); assert.equal(armored.x,543);
const overlap=[makeEnemy({x:500}),makeEnemy({x:500}),makeEnemy({x:500})]; overlap.forEach(x=>x.body.owner=x); combat.applyKnockback(overlap[0],{knockback:72}); assert.equal(overlap[1].x,500); assert.equal(overlap[2].x,500);
const behaviorScene={balance:BALANCE,player:{x:0},targeting:{isEnemyFullyInsideViewport(){return true;}},enemies:[right]}; right.isKnockbackActive=true; right.body.vx=123; approach(behaviorScene,right,60); assert.equal(right.body.vx,123); entryMove(behaviorScene,right); assert.equal(right.body.vx,123);
console.log('[validate-0104-balance-knockback] PASS 0.10.4 balance, cooldowns, directional arced knockback, pause compatibility, and attack blocking');
