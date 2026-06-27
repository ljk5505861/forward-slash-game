import { strict as assert } from 'node:assert';
import { ENEMIES } from '../src/config/enemies.js';
import { SKILLS } from '../src/config/skills.js';
import { BALANCE } from '../src/config/balance.js';
import { WEAPONS } from '../src/config/weapons.js';
import CombatSystem, { BOSS_KNOCKBACK_MULTIPLIER, MIN_PLAYER_ATTACK_INTERVAL_MS, NORMAL_ATTACK_KNOCKBACK_DURATION_MS, NORMAL_ATTACK_KNOCKBACK_LIFT_PX } from '../src/systems/CombatSystem.js';
import MovementSystem from '../src/systems/MovementSystem.js';
import { playerHealthBarSize, playerHealthBarY } from '../src/ui/PlayerHealthBar.js';

global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,k){ if(k==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});},style:{}};},addEventListener(){},removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:global.window.navigator,configurable:true});
global.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } };
global.HTMLCanvasElement=class {};
const { approach, entryMove } = await import('../src/enemies/behaviors/EnemyBehaviorManager.js');

for(const [id,cfg] of Object.entries(ENEMIES)){
  assert.equal(cfg.speed,cfg.kind==='boss'?272:(['bomber','healer'].includes(cfg.behavior)?360:216),`${id} speed`);
  assert.equal('entrySpeed' in cfg,false,`${id} has no entrySpeed`);
  assert.equal('combatSpeed' in cfg,false,`${id} has no combatSpeed`);
}
assert.equal(ENEMIES.charger.chargeDamage,9);
assert.equal(ENEMIES.berserker_boss.chargeSpeed,240);
assert.equal(ENEMIES.healer.healAmount,18);
['berserker_boss','mid_boss','boss'].forEach(id=>assert.equal(ENEMIES[id].attackRange,155,`${id} boss melee range`));
assert.equal(WEAPONS.short_sword.attackIntervalMs,333);
assert.equal(WEAPONS.short_sword.attackRange,115);
assert.equal(WEAPONS.short_sword.knockback,72);

const player={x:100,y:200,width:BALANCE.player.width,height:BALANCE.player.height,displayWidth:90,displayHeight:156,body:{width:BALANCE.player.bodyWidth,height:BALANCE.player.bodyHeight,center:{x:102},top:160}};
const size=playerHealthBarSize(player);
assert.equal(size.width,Math.round(BALANCE.player.bodyWidth*1.25),'health bar uses stable body width');
assert.equal(playerHealthBarY(player),150,'health bar follows physics-body top');
player.displayWidth=180; player.displayHeight=312; player.y=260;
assert.deepEqual(playerHealthBarSize(player),size,'attack animation display scaling does not resize health bar');
assert.equal(playerHealthBarY(player),150,'sprite animation movement does not move health bar while body top is stable');

const makeEnemy=(props={})=>({x:500,y:800,width:52,height:83,active:true,isDefeated:false,hp:10,maxHp:10,damage:3,attackRange:999,nextAttackAt:1000,body:{vx:0,velocity:{x:0},setVelocityX(v){this.vx=v;this.velocity.x=v;},reset(x,y){this.owner.x=x;this.owner.y=y;}},hpBarBg:{setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){}},hpBar:{setPosition(x,y){this.x=x;this.y=y;return this;},setDisplaySize(){return this;},destroy(){}},nameText:{setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){}},destroy(){this.active=false;},...props});
const makeScene=()=>({balance:BALANCE,player:{x:100,y:800},enemies:[],killCount:0,awardGold(){},stageSystem:{},runStats:{},playerData:{hp:100,attackSpeedMultiplier:1},getGameplayTime(){return 1000;},targeting:{valid:e=>!!e&&!e.isDefeated,isEnemyFullyInsideViewport(){return true;}},professionSystem:{getDamageMultiplier(){return 1;}},eventBus:{emit(){}},floatText(){},isGameplayPaused(){return false;},skillSystem:{beforePlayerDamage(){}},statusEffects:{clearTarget(){},absorbShield(d){return {absorbed:0,remainingDamage:d};}},hud:{update(){},setStatus(){}},finishRun(){},tweens:{items:[],last:null,add(cfg){const tween={cfg,paused:false,stopped:false,removed:false,pause(){this.paused=true;},resume(){this.paused=false;},stop(){this.stopped=true;},remove(){this.removed=true;}};this.last=cfg;this.items.push(tween);return tween;}}});
const scene=makeScene();
const combat=new CombatSystem(scene);
assert.equal(MIN_PLAYER_ATTACK_INTERVAL_MS,180);
assert.equal(NORMAL_ATTACK_KNOCKBACK_DURATION_MS,440);
assert.equal(NORMAL_ATTACK_KNOCKBACK_LIFT_PX,24);
assert.equal(BOSS_KNOCKBACK_MULTIPLIER,0.8);
assert.equal(BALANCE.stageWorldWidth,100000);
assert.equal(combat.getPlayerAttackInterval(WEAPONS.short_sword),333);
scene.playerData.attackSpeedMultiplier=10;
assert.equal(combat.getPlayerAttackInterval(WEAPONS.short_sword),180);
scene.playerData.attackSpeedMultiplier=1;

const finish=enemy=>{scene.tweens.last.targets.t=1;scene.tweens.last.onComplete();return enemy;};
const right=makeEnemy({x:500}); right.body.owner=right;
combat.applyKnockback(right,{knockback:72});
assert.equal(scene.tweens.last.duration,440);
scene.tweens.last.targets.t=0.5; scene.tweens.last.onUpdate();
assert.equal(Math.round(right.y),776,'midpoint reaches 24px lift');
finish(right);
assert.equal(right.x,572);
assert.equal(right.y,800);
assert.equal(right.isKnockbackActive,false,'control ends immediately on landing');
assert.equal(scene.tweens.items.length,1,'no landing bounce tween is created');

const repeat=makeEnemy({x:500}); repeat.body.owner=repeat;
combat.applyKnockback(repeat,{knockback:72});
const firstTween=repeat.knockbackTween;
scene.tweens.last.targets.t=0.4; scene.tweens.last.onUpdate();
const startX=repeat.x,startY=repeat.y;
combat.applyKnockback(repeat,{knockback:72});
assert.equal(firstTween.stopped,true);
assert.equal(firstTween.removed,true);
scene.tweens.last.targets.t=0; scene.tweens.last.onUpdate();
assert.equal(repeat.x,startX);
assert.equal(repeat.y,startY);
assert.equal(combat.knockbackTargets.size,1);
finish(repeat);
assert.equal(repeat.y,800);

scene.player.x=100; let damageCalls=0;
combat.damagePlayer=()=>{damageCalls+=1;}; combat.damageAttackTarget=(target)=>{ damageCalls+=1; };
const attacker=makeEnemy({x:90,nextAttackAt:0,isKnockbackActive:true});
combat.updateEnemyAttack(attacker,5000);
assert.equal(damageCalls,0);
attacker.isKnockbackActive=false;
combat.updateEnemyAttack(attacker,5000);
assert.equal(damageCalls,1);

const boss=makeEnemy({x:500,isBoss:true}); boss.body.owner=boss; combat.applyKnockback(boss,{knockback:72}); finish(boss); assert.equal(boss.x,510,'boss only moves configured 10px');
const elite=makeEnemy({x:500,isElite:true}); elite.body.owner=elite; combat.applyKnockback(elite,{knockback:72}); finish(elite); assert.equal(elite.x,525);
const armored=makeEnemy({x:500,enemyId:'armored_guard'}); armored.body.owner=armored; combat.applyKnockback(armored,{knockback:72}); finish(armored); assert.equal(armored.x,543);
const behaviorScene={balance:BALANCE,player:{x:0},targeting:{isEnemyFullyInsideViewport(){return true;}},enemies:[right]};
right.isKnockbackActive=true; right.body.vx=123; approach(behaviorScene,right,60); assert.equal(right.body.vx,123); entryMove(behaviorScene,right); assert.equal(right.body.vx,123);

const movementScene={balance:BALANCE,player:{x:100,body:{velocity:{x:0},setVelocityX(v){this.velocity.x=v;}}},playerData:{weaponId:'short_sword'},targeting:{nearestAhead(){return {x:70};}},stageSystem:{stage:{worldWidth:50000}},cameras:{main:{worldView:{right:720,width:720},width:720,scrollX:0}},isGameplayPaused(){return false;}};
new MovementSystem(movementScene).update();
assert.equal(movementScene.player.x,100,'ordinary enemies cannot push or snap player backward');
assert.equal(movementScene.player.body.velocity.x,0);

console.log('[validate-0104-balance-knockback] PASS 0.10.7 stable camera, body-anchored health bar, reduced boss knockback, and matched boss melee range');
