import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import EliteBerserkerBehavior from '../src/enemies/behaviors/EliteBerserkerBehavior.js';
import StageSystem,{ FLOW_GROUPS } from '../src/systems/StageSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';
import { ENEMIES, ELITE_BERSERKER_TUNING as AXE } from '../src/config/enemies.js';
import { BALANCE } from '../src/config/balance.js';
import { getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,updateGravityPull } from '../src/systems/EnemyGravityControl.js';
import { isEnemyFrozen,shiftEnemyColdTimers } from '../src/systems/EnemyColdControl.js';

const scene={runMode:'normal'},stage=new StageSystem(scene),catalog=JSON.stringify(FLOW_GROUPS);
const newIds=['elite_berserker','elite_war_drum_priest','elite_sharpshooter','elite_thunder_mage'];
for(const level of [1,11,19,100]) {
  stage.currentEnemyLevel=level;const e=stage.tunedEnemy('elite_berserker'),offset=level-1;
  assert.equal(e.name,'狂战士');assert.equal(e.kind,'elite');assert.equal(e.behavior,'eliteBerserker');
  assert.equal(e.hp,Math.round(104*(1+offset*0.06)));assert.equal(e.damage,Math.round(10*(1+offset*0.10)));
  assert.equal(e.attackIntervalMs,Math.round(1800/(1+Math.min(0.15,offset*0.01))));
  assert.equal(e.speed,300);assert.equal(e.attackRange,110);
}
let first=null,gold=0,oldGold=0;
for(const group of FLOW_GROUPS)for(let wave=0;wave<4;wave+=1) {
  stage.currentGroup=group.group;stage.currentWave=wave+1;scene.runMode='normal';
  const items=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  scene.runMode='test';const legacy=stage.makeWaveIds(group.ids[wave],group.waves[wave],group.rangedCounts[wave]);
  const expected=group.group>=11&&group.group%3===2&&group.ids[wave].includes('elite')?1:0;
  assert.equal(items.filter(v=>v.id==='elite_berserker').length,expected);
  assert.equal(items.length,group.waves[wave]);assert.equal(items.length,legacy.length);
  assert.deepEqual(items.map(v=>newIds.includes(v.id)?'elite':v.id).sort(),legacy.map(v=>v.id).sort(),'only existing elite slot changes');
  assert(!legacy.some(v=>newIds.includes(v.id)),'test mode keeps old lineup');
  if(expected){first??=`${group.group}-${wave+1}`;assert.equal(items[0].id,'elite_berserker');assert.equal(items[0].role,'front');}
  if(wave<3){const income=arr=>arr.reduce((n,v)=>n+(ENEMIES[v.id].kind==='elite'?15:1),0);gold+=income(items);oldGold+=income(legacy);}
}
assert.equal(first,'11-3');assert.equal(gold,oldGold);assert.equal(JSON.stringify(FLOW_GROUPS),catalog);

function fixture() {
  const g={destroyed:false,clears:0,destroy(){this.destroyed=true;},clear(){this.clears++;return this;}};
  for(const name of ['setDepth','lineStyle','lineBetween','strokeRect'])g[name]=()=>g;
  const e={...ENEMIES.elite_berserker,enemyId:'elite_berserker',isElite:true,isBoss:false,x:500,y:400,active:true,nextAttackAt:0,damageReduction:0};
  e.body={velocity:{x:0},setVelocityX(n){this.velocity.x=n;},reset(x,y){e.x=x;e.y=y;}};
  const target={x:400,y:400,type:'player',live:true,isAlive(){return this.live;}};
  const targets=[target],hits=[],s={runMode:'normal',now:0,getGameplayTime(){return this.now;},enemies:[e],player:target,
    playerData:{hp:100,maxHp:100},balance:BALANCE,add:{graphics:()=>g},floatText(){},eventBus:{emit(){}},
    targeting:{valid:v=>v?.active&&!v.isDefeated,isEnemyFullyInsideViewport:()=>true,
      shouldRecycleEnemyLeft:()=>false,getEnemyRightRespawnX:()=>900},
    tweens:{items:[],add(cfg){this.items.push(cfg);return {stop(){},remove(){}};}}};
  const choose=(v,range)=>targets.find(t=>t.isAlive()&&Math.hypot(v.x-t.x,v.y-t.y)<=range);
  s.combatSystem={getOrLockEnemyTarget:()=>targets.find(t=>t.isAlive()),chooseEnemyAttackTarget:choose,
    damageAttackTarget:(victim,damage,meta)=>hits.push({victim,damage,meta,t:s.now})};
  const h={getEnemyAttackDelay,approach(_s,v){v.body.setVelocityX(Math.hypot(v.x-target.x,v.y-target.y)>v.attackRange?-getEnemyMoveSpeed(v,v.speed,s.now):0);},
    chooseTarget:(_s,v,range)=>choose(v,range),targetDamage:(_s,victim,_e,damage,meta)=>hits.push({victim,damage,meta,t:s.now})};
  const b=new EliteBerserkerBehavior(s,e,h),tick=t=>{s.now=t;b.update(t);};
  return {s,e,g,target,targets,h,hits,b,tick};
}
{
  const f=fixture();f.tick(0);f.tick(1799);assert.equal(f.hits.length,1);f.tick(1800);assert.equal(f.hits.length,2);
  f.tick(3200);assert.equal(f.b.state,'windup');assert.equal(f.e.body.velocity.x,0);
  f.tick(3749);assert.equal(f.hits.length,2);f.tick(3750);assert.equal(f.b.swings,1);
  f.tick(3999);assert.equal(f.b.swings,1);f.tick(4000);assert.equal(f.b.swings,2);f.tick(4250);assert.equal(f.b.swings,3);
  assert.equal(f.b.state,'recovery');assert.equal(f.hits.length,5);
  const cuts=f.hits.filter(v=>v.meta.source==='eliteBerserkerSlash');
  assert.deepEqual(cuts.map(v=>v.t),[3750,4000,4250]);assert(cuts.every(v=>v.damage===10&&v.meta.knockbackDistance===0));
  f.tick(5149);assert.equal(f.b.state,'recovery');f.tick(5150);assert.equal(f.b.state,'idle');
  assert.equal(f.b.nextCombo,11350);f.tick(6949);assert.equal(f.hits.length,5);f.tick(6950);assert.equal(f.hits.length,6);
  f.b.destroy();
}
{
  const f=fixture();f.target.x=250;f.tick(0);assert.equal(f.e.body.velocity.x,-300);assert.equal(f.hits.length,0);
  f.target.x=380;f.tick(3200);assert.equal(f.b.state,'windup');f.tick(3750);assert.equal(f.hits.length,1,'combo range extends beyond ordinary melee');
  f.target.x=250;f.tick(4000);assert.equal(f.hits.length,1,'second strike misses after target leaves range');
  f.target.x=400;f.tick(4250);assert.equal(f.hits.length,2,'third strike independently finds in-range target');f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(3200);f.target.live=false;f.tick(3750);
  assert.equal(f.b.state,'idle');assert.equal(f.b.nextCombo,3200,'failed first strike does not spend cooldown');
  const replacement={x:420,y:400,isAlive:()=>true};f.targets.push(replacement);f.tick(3800);f.tick(4350);
  assert.equal(f.hits.at(-1).victim,replacement,'replacement target can be hit');f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(3200);f.tick(3750);const count=f.hits.length;f.target.live=false;
  f.tick(4000);f.tick(4250);assert.equal(f.hits.length,count,'dead/no target cannot be damaged');
  assert.equal(f.b.swings,3,'later missing cuts are still spent');assert.equal(f.b.state,'recovery');f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(3200);f.tick(3750);f.tick(6000);
  assert.equal(f.b.swings,2,'lag does not deliver two cuts in one update');f.tick(6250);assert.equal(f.b.swings,3);f.b.destroy();
}
{
  const f=fixture();f.tick(0);f.tick(3200);f.b.shiftTimers(1000,3300);f.tick(3750);assert.equal(f.b.state,'windup');
  f.tick(4750);assert.equal(f.b.swings,1);f.b.shiftTimers(500,4800);f.tick(5000);assert.equal(f.b.swings,1);
  f.tick(5500);assert.equal(f.b.swings,2);f.tick(5750);assert.equal(f.b.swings,3);f.b.destroy();
}
for(const during of ['normal','first','second','third']) {
  const f=fixture();if(during!=='normal'){f.tick(0);f.tick(3200);if(during==='second')f.tick(3750);if(during==='third'){f.tick(3750);f.tick(4000);}}
  f.h.targetDamage=()=>{f.hits.push(1);f.e.isDefeated=true;f.b.destroy();};
  f.tick(during==='normal'?0:during==='first'?3750:during==='second'?4000:4250);
  assert.equal(f.b.graphics,null);assert(f.g.destroyed,'synchronous reflected death cleans visual');
}

const source=fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8')
  .replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export default class EnemyBehaviorManager','class EnemyBehaviorManager');
const Manager=vm.runInNewContext(source+'\nEnemyBehaviorManager',{
  EliteBerserkerBehavior,WarDrumPriestBehavior:class {},DoctorBehavior:class {},SharpshooterBehavior:class {},ShieldGuardBehavior:class {},MasterBehavior:class {},MeatBehavior:class {},
  Phaser:{Math:{Between:()=>0}},getEnemyMoveSpeed,getEnemyAttackDelay,isGravityReversalControlled,isEnemyFrozen,updateGravityPull,shiftEnemyColdTimers
});
for(const control of ['knockback','freeze','gravity'])for(const started of [false,true]) {
  const f=fixture();f.b.destroy();f.g.destroyed=false;const m=new Manager(f.s);m.attach(f.e);const b=m.items.get(f.e);
  assert(b instanceof EliteBerserkerBehavior);const tick=t=>{f.s.now=t;m.update(t);};tick(0);tick(3200);if(started)tick(3750);
  const t=started?3800:3300,count=f.hits.length;
  if(control==='knockback')f.e.isKnockbackActive=true;
  if(control==='freeze')f.e.coldSources=new Map([['freeze',{expiresAt:9000,frozenUntil:9000}]]);
  if(control==='gravity'){m.interruptGravityReversal(f.e,t);f.e.gravityReversalState={};}
  tick(t);tick(t+50);assert.equal(f.hits.length,count,'control cancels remaining strikes');
  if(!started)assert.equal(b.nextCombo,3200,'unreleased combo remains ready');else assert(b.nextCombo>t+AXE.cooldown,'released combo keeps cooldown');
  f.e.isKnockbackActive=false;f.e.coldSources?.clear();delete f.e.gravityReversalState;
  m.recycleEnemy(f.e);assert.equal(f.e.x,900);assert.equal(b.nextCombo,null);assert.equal(b.effectUntil,0);
  m.pause();tick(10000);assert.equal(b.nextCombo,null);m.resume();
  f.e.isDefeated=true;tick(11000);assert.equal(m.items.size,0);assert(f.g.destroyed);m.destroy();
}
// Real Combat path: no extra generic melee, no player displacement, normal elite knockback stays valid.
{
  const f=fixture(),combat=new CombatSystem(f.s);
  combat.updateEnemyAttack(f.e,0);assert.equal(f.s.playerData.hp,100,'behavior owns melee');
  f.s.player.setX=()=>assert.fail('slash must not knock back player');
  combat.damagePlayer(f.e,10,{source:'eliteBerserkerSlash',attackType:'melee',knockbackDistance:0});
  assert.equal(f.s.playerData.hp,90);assert.equal(f.target.x,400);
  f.e.hp=f.e.maxHp=104;assert(combat.applyKnockback(f.e,{knockback:72}),'elite combo is not knockback immune');
  const tween=f.s.tweens.items.at(-1);tween.targets.t=0.5;tween.onUpdate();assert(f.e.isKnockbackActive);
}
// Real spawn -> createEnemy -> behavior registration, and scene shutdown destroys visuals.
{
  const f=fixture();f.b.destroy();f.s.enemies=[];
  const node=(x=0,y=0,w=0,h=0)=>({x,y,width:w,height:h,active:true,
    setStrokeStyle(){return this;},setDepth(){return this;},setOrigin(){return this;},setPosition(){return this;},
    setVisible(){return this;},setAlpha(){return this;},setText(){return this;},add(){return this;},
    body:{setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}}});
  f.s.physics={add:{existing(){}}};Object.assign(f.s.add,{rectangle:node,text:(x,y)=>node(x,y),container:node});
  const m=new Manager(f.s);f.s.enemyBehaviors=m;const st=new StageSystem(f.s);st.currentEnemyLevel=11;
  const e=st.spawn('elite_berserker',600);assert.equal(e.hp,166);assert.equal(e.damage,20);assert.equal(e.name,'狂战士');assert(e.isElite&&!e.isBoss);
  assert(m.items.get(e) instanceof EliteBerserkerBehavior);m.destroy();assert(f.g.destroyed);
  f.s.runMode='test';const legacy={...f.e,active:true,isDefeated:false,enemyId:'elite',behavior:undefined};m.attach(legacy);
  assert.equal(m.items.size,0,'test-mode original generic elite remains generic');m.destroy();
}
console.log('PASS berserker growth/real spawn/mode isolation, unchanged counts/gold, melee/burst exclusion, three spaced strikes, per-strike range and target death/replacement, misses/lag, zero knockback, control interruption, timers, pause/recycle/scene cleanup and synchronous reflected death');
