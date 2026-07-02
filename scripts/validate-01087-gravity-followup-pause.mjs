import assert from 'node:assert/strict';

globalThis.window ??= { navigator:{ maxTouchPoints:0, userAgent:'node' }, addEventListener(){}, removeEventListener(){} };
const ctx={ fillRect(){}, clearRect(){}, getImageData(){return {data:[0,0,0,0]}}, putImageData(){}, drawImage(){}, createImageData(){return []}, measureText(){return {width:0}}, fillText(){}, save(){}, restore(){}, translate(){}, scale(){}, rotate(){}, beginPath(){}, arc(){}, fill(){}, stroke(){} };
globalThis.document ??= { documentElement:{style:{}}, createElement:()=>({getContext:()=>ctx,style:{}}), addEventListener(){}, removeEventListener(){} };
globalThis.HTMLCanvasElement ??= class {};
globalThis.Image ??= class {};

const { SKILLS } = await import('../src/config/skills.js');
const { SKILL_HANDLERS } = await import('../src/skills/handlers/index.js');

const node=(x=0,y=0)=>({x,y,active:true,setDepth(){return this},setStrokeStyle(){return this},setPosition(nx,ny){this.x=nx;this.y=ny;return this},destroy(){this.active=false}});
const target={id:'target',x:100,y:100,hp:9999,maxHp:9999,active:true,isDefeated:false,width:40,height:60,body:{setVelocityX(){}}};
const scene={
  now:0,
  enemies:[target],
  player:{x:0,y:300},
  gravityRuntime:null,
  getGameplayTime(){return this.now},
  targeting:{isEnemyFullyInsideViewport(){return true}},
  add:{circle:(x,y)=>node(x,y),rectangle:(x,y)=>node(x,y)},
  tweens:{killTweensOf(){}},
  events:{once(){},off(){}},
  hits:[]
};
const system={
  scene,
  passiveState:{},
  passiveUpdaters:[],
  getLevel:id=>id==='gravity_crush'?9:0,
  getData:(id,level)=>SKILLS[id]?.levels[level-1],
  hit(enemy,damage){scene.hits.push({enemy,damage,at:scene.now})},
  damageValue:value=>Math.round(value),
  baseDamageValue:value=>Math.round(value)
};
const update=elapsed=>{ scene.now+=elapsed; [...system.passiveUpdaters].forEach(fn=>fn()); };

const data=SKILLS.gravity_crush.levels[8];
SKILL_HANDLERS.gravity_crush.cast(system,SKILLS.gravity_crush,data,9,{castId:99});
const tasks=[...scene.gravityRuntime.pendingStrikes].sort((a,b)=>(a.warningAt??0)-(b.warningAt??0));
const second=tasks[1];
const third=tasks[2];
assert.equal(second.warningAt,180);
assert.equal(third.warningAt,360);

update(100);
SKILL_HANDLERS.black_hole.shiftTimers(system,3000,100);
assert.equal(second.warningAt,3180,'second warning must shift exactly once');
assert.equal(third.warningAt,3360,'third warning must shift exactly once');

update(3079);
assert.equal(second.gravityWarningStarted,false);
update(1);
assert.equal(second.gravityWarningStarted,true,'second warning must resume after its original remaining 80ms');
assert.equal(third.gravityWarningStarted,false);
update(180);
assert.equal(third.gravityWarningStarted,true,'third warning must preserve its original relative delay');

console.log('v0.10.93 staged gravity warning pause validation passed');
