import assert from 'node:assert/strict';
import { ENEMIES, NORMAL_ENEMY_PROFILES } from '../src/config/enemies.js';
import { TUNING } from '../src/config/tuning.js';
import { BALANCE } from '../src/config/balance.js';
import StageSystem from '../src/systems/StageSystem.js';

const before=JSON.stringify(ENEMIES);
const scene={runMode:'normal'};
const stage=new StageSystem(scene);
const tune=(id,level,mode='normal',overrides=null)=>{
  scene.runMode=mode;stage.currentEnemyLevel=level;return stage.tunedEnemy(id,overrides);
};
const legacy=(id,level,overrides=null)=>{
  const base={...ENEMIES[id],...(overrides||{})}, offset=level-1;
  return {...base,level,hp:Math.round(base.hp*(TUNING.difficulty[base.kind+'HpMultiplier']||1)*(1+offset*TUNING.leveling.enemyHpGrowthPerLevel)),
    damage:Math.max(1,Math.round(base.damage*(TUNING.difficulty[base.kind+'DamageMultiplier']||1)*(1+offset*TUNING.leveling.enemyDamageGrowthPerLevel))),xp:0};
};
assert.deepEqual(Object.keys(NORMAL_ENEMY_PROFILES),['grunt','archer']);
for(const level of [1,2,4,10,19,21,99]){
  for(const id of Object.keys(ENEMIES)){
    assert.deepEqual(tune(id,level,'test'),legacy(id,level),'test mode keeps exact original stats: '+id);
    assert.deepEqual(tune(id,level,null),legacy(id,level),'unspecified mode preserves old harness behavior');
    if(!NORMAL_ENEMY_PROFILES[id]) assert.deepEqual(tune(id,level),legacy(id,level),'unmigrated enemies unchanged: '+id);
  }
  const warrior=tune('grunt',level), archer=tune('archer',level), offset=level-1;
  assert.equal(warrior.name,'战士');assert.equal(warrior.id,'grunt');
  assert.equal(warrior.hp,Math.round(64*(1+offset*0.18)));
  assert.equal(warrior.damage,Math.round(2*(1+offset*0.03)));
  assert.equal(warrior.attackIntervalMs,2800);
  assert.equal(warrior.speed,216,'normal warrior restores original approach speed');
  assert.equal(archer.hp,Math.round(30*(1+offset*0.04)));
  assert.equal(archer.damage,Math.round(6*(1+offset*0.12)));
  assert.equal(archer.attackIntervalMs,Math.round(2000/(1+Math.min(0.2,offset*0.01))));
  for(const cfg of [warrior,archer]) for(const key of ['behavior','speed','attackRange','width','height','bodyWidth','bodyHeight','color','stroke']){
    assert.equal(cfg[key],ENEMIES[cfg.id][key],'unchanged movement/visual/attack contract: '+key);
  }
  assert(warrior.hp>archer.hp);assert(archer.damage>warrior.damage);
}
assert.equal(tune('grunt',1).hp,64,'no legacy x2 multiplier');
assert.equal(tune('grunt',1,'test').attackIntervalMs,1650,'test mode retains original warrior cadence');
assert.equal(tune('archer',1).damage,6,'no legacy x0.75 damage multiplier');
assert.equal(tune('archer',200).attackIntervalMs,1667,'20% attack SPEED cap, not 20% interval reduction');
assert.equal(tune('grunt',1,'normal',{hp:100,damage:5}).hp,100,'explicit overrides remain supported');
assert.equal(JSON.stringify(ENEMIES),before,'shared legacy catalog is not mutated');

// Real spawn() -> createEnemy() propagates tuned values into live runtime fields.
const node=(x=0,y=0,w=0,h=0)=>({x,y,width:w,height:h,active:true,
  setStrokeStyle(){return this;},setDepth(){return this;},setOrigin(){return this;},setPosition(){return this;},setVisible(){return this;},setAlpha(){return this;},setText(){return this;},add(){return this;},
  body:{setAllowGravity(){},setImmovable(){},setSize(w,h){this.width=w;this.height=h;},setOffset(){}}});
Object.assign(scene,{balance:BALANCE,enemies:[],physics:{add:{existing(){}}},
  add:{rectangle:node,text:(x,y)=>node(x,y),circle:node,container:node},enemyBehaviors:{attach(e){e.attached=true;}},eventBus:{emit(){}}});
for(const mode of ['normal','test']) for(const level of [1,10,19]){
  scene.runMode=mode;stage.currentEnemyLevel=level;
  for(const id of ['grunt','archer']){
    scene.enemies=[];const expected=stage.tunedEnemy(id), enemy=stage.spawn(id,600);
    for(const field of ['name','hp','damage','attackRange','attackIntervalMs','speed','level']) assert.equal(enemy[field],expected[field]);
    assert.equal(enemy.maxHp,expected.hp);assert.equal(enemy.baseAttackIntervalMs,expected.attackIntervalMs);assert(enemy.attached);
  }
}
console.log('PASS normal warrior/archer: linear independent growth, effective Lv1 stats, attack-speed cap, legacy mode/other enemies unchanged, actual spawn propagation');
