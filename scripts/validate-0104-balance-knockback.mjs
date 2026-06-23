import { strict as assert } from 'node:assert';
import { ENEMIES } from '../src/config/enemies.js';
import { SKILLS } from '../src/config/skills.js';
import { BALANCE } from '../src/config/balance.js';
import { WEAPONS } from '../src/config/weapons.js';
import CombatSystem from '../src/systems/CombatSystem.js';
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

const player={x:100,y:200,width:BALANCE.player.width,height:BALANCE.player.height}; const size=playerHealthBarSize(player);
assert.equal(size.width, Math.round(BALANCE.player.width*1.25)); assert.notEqual(size.width, 82); assert(size.height<=8 && size.height>=5); assert.equal(playerHealthBarY(player), player.y-player.height/2-10);

const makeEnemy=(props={})=>({x:500,y:800,width:52,height:83,active:true,isDefeated:false,hp:10,maxHp:10,body:{vx:0,setVelocityX(v){this.vx=v;},reset(x,y){this.owner.x=x;this.owner.y=y;}},hpBarBg:{setPosition(x,y){this.x=x;this.y=y;return this;}},hpBar:{setPosition(x,y){this.x=x;this.y=y;return this;},setDisplaySize(w,h){this.w=w;this.h=h;return this;}},nameText:{setPosition(x,y){this.x=x;this.y=y;return this;}},...props});
const scene={balance:BALANCE,player:{x:100},getGameplayTime(){return 1000;},targeting:{valid:e=>!!e&&!e.isDefeated,isEnemyFullyInsideViewport(){return true;}},professionSystem:{getDamageMultiplier(){return 1;}},eventBus:{emit(){}},floatText(){},tweens:{last:null,add(cfg){this.last=cfg; return {stop(){this.stopped=true;}, remove(){this.removed=true;}};}}};
const combat=new CombatSystem(scene); const e=makeEnemy(); e.body.owner=e; combat.applyKnockback(e,{knockback:WEAPONS.short_sword.knockback});
assert.equal(e.isKnockbackActive,true); assert.equal(scene.tweens.last.duration,220); assert.equal(e.x,500,'does not jump instantly');
scene.tweens.last.targets.t=0.5; scene.tweens.last.onUpdate(); assert(e.x>500 && e.x<572); assert(e.y<800); const midY=e.y;
scene.tweens.last.targets.t=1; scene.tweens.last.onComplete(); assert.equal(e.x,572); assert.equal(e.y,800); assert.equal(e.isKnockbackActive,false); assert(e.hpBarBg.x===e.x && e.nameText.x===e.x);
const boss=makeEnemy({x:500,isBoss:true}); boss.body.owner=boss; combat.applyKnockback(boss,{knockback:72}); scene.tweens.last.targets.t=1; scene.tweens.last.onComplete(); assert.equal(boss.x,509);
const armored=makeEnemy({x:500,enemyId:'armored_guard'}); armored.body.owner=armored; combat.applyKnockback(armored,{knockback:72}); scene.tweens.last.targets.t=1; scene.tweens.last.onComplete(); assert.equal(armored.x,543);
const overlap=[makeEnemy({x:500}),makeEnemy({x:500}),makeEnemy({x:500})]; overlap.forEach(x=>x.body.owner=x); combat.applyKnockback(overlap[0],{knockback:72}); assert.equal(overlap[1].x,500); assert.equal(overlap[2].x,500);
const behaviorScene={balance:BALANCE,player:{x:0},targeting:{isEnemyFullyInsideViewport(){return true;}},enemies:[e]}; e.isKnockbackActive=true; e.body.vx=123; approach(behaviorScene,e,60); assert.equal(e.body.vx,123); entryMove(behaviorScene,e); assert.equal(e.body.vx,123);
console.log('[validate-0104-balance-knockback] PASS 0.10.4 balance, cooldowns, dynamic player health bar, and arced attack knockback');
