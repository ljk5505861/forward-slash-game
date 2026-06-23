import { strict as assert } from 'node:assert';
import StageSystem, { FLOW_GROUPS } from '../src/systems/StageSystem.js';
import { BALANCE, createPlayerRuntime } from '../src/config/balance.js';

const node=(x=0,y=0,w=10,h=10)=>({x,y,width:w,height:h,active:true,setStrokeStyle(){return this;},setDepth(){return this;},setOrigin(){return this;},setPosition(x2,y2){this.x=x2;this.y=y2;return this;},setDisplaySize(){return this;},destroy(){},body:{owner:null,setAllowGravity(){},setImmovable(){},setSize(){},setOffset(){},setVelocityX(){},reset(x2,y2){this.owner.x=x2;this.owner.y=y2;}}});
const scene={balance:BALANCE,scale:{height:1280},playerData:createPlayerRuntime(),enemies:[],physics:{world:{setBounds(){}},add:{existing(o){o.body.owner=o;}}},cameras:{main:{setBounds(){},worldView:{right:720},width:720,scrollX:0}},add:{rectangle:(x,y,w,h)=>node(x,y,w,h),text:(x,y)=>node(x,y),circle:(x,y,r)=>node(x,y,r*2,r*2)},hud:{setStage(){},setStatus(){},update(){}},eventBus:{emit(){}},enemyBehaviors:{attach(){},update(){}},statusEffects:{clearTarget(){}},isGameplayPaused(){return false;},showSkillReward(){},queueShop(){},getGameplayTime(){return 0;}};
const stage=new StageSystem(scene); stage.start();
assert.equal(FLOW_GROUPS[0].waves[0],3); stage.update(0); assert.equal(stage.waveQueue.length,3,'group 1 wave 1 queues 3 enemies immediately');
assert.deepEqual(stage.makeWaveIds(['grunt','charger'],4,0).map(x=>x.id).filter(id=>id==='bomber'||id==='healer'),[],'group 2 can force zero ranged');
assert.equal(stage.makeWaveIds(['grunt','bomber'],5,1).filter(x=>x.role==='back').length,1,'group 3 allows at most one ranged');
assert.equal(stage.makeWaveIds(['grunt','bomber'],6,2).filter(x=>x.role==='back').length,2,'group 4 fixed two ranged');
assert.equal(stage.makeWaveIds(['charger','bomber'],7,3).filter(x=>x.role==='back').length,3,'group 5 supports three ranged');
const wave6=stage.makeWaveIds(['elite','grunt','bomber','healer'],8,2); assert.equal(wave6.length,8); assert.equal(wave6.filter(x=>x.id==='elite').length,1); assert.equal(wave6.filter(x=>x.id==='healer').length,1); assert(wave6.findIndex(x=>x.role==='back')>0,'front line enters before back line');
console.log('[validate:enemy-population] PASS fixed counts, ranged counts, healer/elite accounting, spawn order');
