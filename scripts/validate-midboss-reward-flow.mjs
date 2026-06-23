import assert from 'node:assert/strict';
global.window={cordova:undefined, navigator:{userAgent:''}, addEventListener(){}, removeEventListener(){}}; global.document={documentElement:{style:{}}, createElement(){return {getContext(){return new Proxy({},{get(_,k){ if(k==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});}, style:{}};}, addEventListener(){}, removeEventListener(){}}; Object.defineProperty(globalThis,'navigator',{value:global.window.navigator, configurable:true}); global.HTMLCanvasElement=class {}; global.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } };
const { default: UpgradeSystem } = await import('../src/systems/UpgradeSystem.js');

const scene={ playerData:{skills:[],artifacts:[],professionId:null}, debugMode:false, hud:{update(){}}, eventBus:{emit(){}}, balance:{leveling:{growth:10}} };
const sys=new UpgradeSystem(scene);
for (const bossType of ['boss1','boss2','boss3']) {
  const options=sys.rollBossRewardOptions(bossType);
  assert.equal(options.length,3, `${bossType} must offer three choices`);
  assert.ok(options.every(o=>o.type==='attr'||o.skillId), `${bossType} options must be applicable rewards`);
}
assert.ok(sys.rollBossRewardOptions('boss1').length===3, 'Boss 1 rare reward flow is real option rolling');
assert.ok(sys.rollBossRewardOptions('boss2').length===3, 'Boss 2 rare/epic reward flow is real option rolling');
assert.ok(sys.rollBossRewardOptions('boss3').length===3, 'Boss 3 epic/legendary reward flow is real option rolling');
console.log('[validate:midboss-reward-flow] PASS three boss reward option rolls execute real reward logic');
