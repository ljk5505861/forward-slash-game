import assert from 'node:assert/strict';
import fs from 'node:fs';
import CombatSystem from '../src/systems/CombatSystem.js';
import { GAME_VERSION } from '../src/config/version.js';

assert.equal(GAME_VERSION,'0.10.75');
const wolfSrc=fs.readFileSync('src/skills/handlers/SpiritWolvesSkill.js','utf8');
assert.match(wolfSrc,/WOLF_KNOCKBACK_SLIDE_SPEED=180/);
assert.match(wolfSrc,/LEFT_MARGIN=8/);
assert.match(wolfSrc,/RIGHT_MARGIN=48/);
assert.match(wolfSrc,/pendingKnockbackDistance/);
assert.doesNotMatch(wolfSrc,/w\.x-=dist/);
const combatSrc=fs.readFileSync('src/systems/CombatSystem.js','utf8');
assert.match(combatSrc,/getOrLockEnemyTarget/);
assert.match(combatSrc,/forcePlayerTargetUntilHit/);
assert.match(combatSrc,/singleTarget:false/);
const behaviorSrc=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8');
assert.match(behaviorSrc,/getOrLockEnemyTarget/);
assert.match(fs.readFileSync('src/entities/createEnemy.js','utf8'),/lockedAttackTarget:null/);
assert.match(fs.readFileSync('src/systems/StageSystem.js','utf8'),/chooseEnemyAttackTarget[\s\S]*damageAttackTarget[\s\S]*bossKnockbackCounter/);

function makeScene(){
  const player={x:100,y:100};
  const playerData={hp:100,maxHp:100,dodgeChance:0};
  return {player,playerData,enemies:[],isGameplayPaused:()=>false,floatText(){},finishRun(){},hud:{update(){}},eventBus:{emit(){}},skillSystem:{passiveState:{spiritWolves:{wolves:[]}},beforePlayerDamage:()=>null,beforePlayerHpDamage:()=>null},statusEffects:{absorbShield:d=>({absorbed:0,remainingDamage:d})}};
}
const scene=makeScene();
const combat=new CombatSystem(scene); scene.combatSystem=combat;
const wolfA={type:'spiritWolf',x:130,y:100,hp:30,active:true,isAlive(){return this.hp>0},takeDamage(n){this.hp-=n;}};
const wolfB={type:'spiritWolf',x:120,y:100,hp:30,active:true,isAlive(){return this.hp>0},takeDamage(n){this.hp-=n;}};
scene.skillSystem.passiveState.spiritWolves.wolves=[wolfA,wolfB];
const enemy={x:160,y:100,active:true,isDefeated:false,damage:5,attackRange:50};
assert.equal(combat.getOrLockEnemyTarget(enemy),wolfA,'first lock chooses nearest frontline wolf');
wolfB.x=145;
assert.equal(combat.getOrLockEnemyTarget(enemy),wolfA,'lock does not switch to closer second wolf');
wolfA.x=90;
assert.equal(combat.getOrLockEnemyTarget(enemy).type,'player','wolf behind player triggers breach to player');
assert.equal(enemy.forcePlayerTargetUntilHit,true);
assert.equal(combat.chooseEnemyAttackTarget(enemy,100).type,'player','attack uses same locked player target');
const hp=scene.playerData.hp;
combat.damageAttackTarget(combat.getPlayerAttackTarget(),5,{enemy,source:'enemyMelee',attackType:'melee',dodgeable:true,singleTarget:true});
assert.equal(scene.playerData.hp,hp-5,'player damage flow resolves');
assert.equal(enemy.forcePlayerTargetUntilHit,false,'single-target player hit clears breach');
assert.equal(enemy.lockedAttackTarget,null,'single-target player hit clears lock');
assert.equal(combat.damageTargetsInRadius(100,100,60,3,{enemy,source:'bomb',attackType:'bomb',singleTarget:false}).some(h=>h.target===wolfA),true,'radius attacks still include behind wolf');
console.log('v0.10.75 wolf knockback target lock validation passed.');
