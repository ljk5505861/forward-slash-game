import assert from 'node:assert/strict';
import CombatSystem, { NORMAL_ATTACK_KNOCKBACK_DURATION_MS, NORMAL_ATTACK_KNOCKBACK_LIFT_PX, WARRIOR_LANDING_RECOVERY_MS } from '../src/systems/CombatSystem.js';
import { ENEMIES, NORMAL_ENEMY_PROFILES } from '../src/config/enemies.js';

global.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
global.document={documentElement:{style:{}},createElement(){return {getContext(){return new Proxy({},{get(_,key){ if(key==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});},style:{}};},addEventListener(){},removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:global.window.navigator,configurable:true});
global.Image=class { set src(value){ setTimeout(()=>this.onload?.(),0); } };
global.HTMLCanvasElement=class {};
const { approach, entryMove }=await import('../src/enemies/behaviors/EnemyBehaviorManager.js');

assert.equal(ENEMIES.grunt.speed,216);
assert.equal(NORMAL_ENEMY_PROFILES.grunt.speed,undefined,'normal warrior inherits original speed');
assert.equal(WARRIOR_LANDING_RECOVERY_MS,380);

let now=0, tween;
const scene={runMode:'normal',playerData:{hp:500},player:{x:220,y:0},balance:{stageWorldWidth:15000,enemies:{}},
  getGameplayTime:()=>now,targeting:{valid:()=>true},tweens:{add(config){tween=config;return {stop(){},remove(){}};}}};
const combat=scene.combatSystem=new CombatSystem(scene);
let hits=0;
combat.chooseEnemyAttackTarget=()=>({isAlive:()=>true});
combat.damageAttackTarget=()=>{hits+=1;};
const makeEnemy=(id='grunt')=>({enemyId:id,active:true,isDefeated:false,x:400,y:0,width:52,height:83,
  hp:64,maxHp:64,speed:216,attackRange:86,damage:2,attackIntervalMs:2800,nextAttackAt:0,
  body:{vx:0,setVelocityX(v){this.vx=v;},reset(x,y){this.x=x;this.y=y;}}});

const warrior=makeEnemy();
assert(combat.applyKnockback(warrior,{knockback:72}));
assert.equal(warrior.knockbackRecoveryUntil,0,'no recovery while airborne');
assert.equal(warrior.knockbackUntil,NORMAL_ATTACK_KNOCKBACK_DURATION_MS);
assert.equal(NORMAL_ATTACK_KNOCKBACK_LIFT_PX,24,'keep the original knockback arc');
now=NORMAL_ATTACK_KNOCKBACK_DURATION_MS;
tween.onComplete();
assert.equal(warrior.x,472,'knockback still moves the full original distance');
assert.equal(warrior.isKnockbackActive,false);
assert.equal(warrior.knockbackRecoveryUntil,now+WARRIOR_LANDING_RECOVERY_MS);
now+=WARRIOR_LANDING_RECOVERY_MS-1;
approach(scene,warrior);entryMove(scene,warrior);combat.updateEnemyAttack(warrior,now);
assert.equal(warrior.body.vx,0,'warrior stays still just after landing');
assert.equal(hits,0,'warrior cannot attack during landing recovery');
now+=1;
approach(scene,warrior);assert.equal(warrior.body.vx,-216,'warrior resumes original movement speed');
combat.updateEnemyAttack(warrior,now);assert.equal(hits,1,'warrior may attack again after recovery');
combat.clearKnockback(warrior);assert.equal(warrior.knockbackRecoveryUntil,0,'cleanup clears recovery state');

for(const [mode,id] of [['test','grunt'],['normal','archer']]){
  scene.runMode=mode;
  const enemy=makeEnemy(id);now=0;
  assert(combat.applyKnockback(enemy,{knockback:72}));
  now=NORMAL_ATTACK_KNOCKBACK_DURATION_MS;tween.onComplete();
  assert.equal(enemy.knockbackRecoveryUntil,0,`${mode} ${id} keeps existing behavior`);
}
console.log('PASS warrior landing recovery: full knockback, delayed movement and attack, cleanup, mode and enemy isolation');
