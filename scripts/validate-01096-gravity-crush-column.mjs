import assert from 'node:assert/strict';

globalThis.window={cordova:undefined,navigator:{maxTouchPoints:0,userAgent:'node'},addEventListener(){},removeEventListener(){}};
const ctx={fillRect(){},clearRect(){},getImageData(){return {data:[0,0,0,0]}},putImageData(){},drawImage(){},createImageData(){return []},measureText(){return {width:0}},fillText(){},save(){},restore(){},translate(){},scale(){},rotate(){},beginPath(){},arc(){},fill(){},stroke(){}};
globalThis.document={documentElement:{style:{}},createElement:()=>({getContext:()=>ctx,style:{}}),addEventListener(){},removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:globalThis.window.navigator,configurable:true});
globalThis.HTMLCanvasElement=class {}; globalThis.Image=class { set src(v){ this._src=v; this.onload?.(); } };

const { GAME_VERSION } = await import('../src/config/version.js');
const { SKILLS } = await import('../src/config/skills.js');
await import('../src/skills/handlers/index.js');
const { SKILL_HANDLERS } = await import('../src/skills/handlers/index.js');
const { mostDense, mostDenseHorizontal, GRAVITY_CRUSH_COLUMN_HEIGHT, GRAVITY_CRUSH_PRESS_DURATION_MS, GRAVITY_CRUSH_START_OFFSET_Y, GRAVITY_CRUSH_IMPACT_OFFSET_Y } = await import('../src/skills/handlers/GravityFlowSkills.js');
const { applyEnemyGravity } = await import('../src/systems/EnemyGravityControl.js');
import pkg from '../package.json' with { type:'json' };
assert.equal(GAME_VERSION,'0.11.3'); assert.equal(pkg.version,'0.11.3');
assert.equal(GRAVITY_CRUSH_COLUMN_HEIGHT,240); assert.equal(GRAVITY_CRUSH_PRESS_DURATION_MS,120); assert.equal(GRAVITY_CRUSH_START_OFFSET_Y,-250); assert.equal(GRAVITY_CRUSH_IMPACT_OFFSET_Y,-80);

function node(type,x=0,y=0,w=0,h=0,color=0,alpha=1){ return {type,x,y,width:w,height:h,color,alpha,fillAlpha:alpha,active:true,destroyed:false,stroke:null,setDepth(d){this.depth=d;return this},setStrokeStyle(width,color,alpha){this.stroke={width,color,alpha};return this},setScrollFactor(){return this},setFillStyle(c,a){this.color=c;this.alpha=a;this.fillAlpha=a;return this},setPosition(x,y){this.x=x;this.y=y;return this},setScale(v){this.scale=v;return this},add(items){this.children=items;return this},destroy(){this.destroyed=true;this.active=false;return this}}; }
function enemy(id,x,y=100,hp=1000,extra={}){ return {id,x,y,hp,maxHp:hp,active:true,isDefeated:false,width:40,height:60,body:{setVelocityX(){}},...extra}; }
function events(){ const listeners=new Map(); return {once(n,fn){listeners.set(n,fn)},off(n,fn){if(listeners.get(n)===fn)listeners.delete(n)},emit(n){const fn=listeners.get(n);listeners.delete(n);fn?.()}}; }
function makeScene(){ const s={now:0,enemies:[],created:[],player:{x:0,y:300},balance:{groundTopY:620},cameras:{main:{worldView:{centerX:500}}},events:events(),getGameplayTime(){return this.now},targeting:{isEnemyFullyInsideViewport:e=>e.inside!==false},add:{circle:(x,y,r,c,a)=>{const n=node('circle',x,y,r*2,r*2,c,a); n.radius=r; s.created.push(n); return n;},rectangle:(x,y,w,h,c,a)=>{const n=node('rect',x,y,w,h,c,a); s.created.push(n); return n;},container:(x,y)=>node('container',x,y)},tweens:{killTweensOf(){}},hits:[]}; return s; }
function makeSystem(scene,skills={}){ return {scene,passiveState:{},passiveUpdaters:[],getLevel:id=>skills[id]||0,getData(id,lvl=skills[id]||0){return SKILLS[id]?.levels[lvl-1]},hit(e,d){ if(!e.active||e.isDefeated||e.hp<=0) return; e.hp-=Math.round(d); scene.hits.push({e,d:Math.round(d),t:scene.now}); if(e.hp<=0)e.isDefeated=true;},damageValue:v=>Math.round(v),baseDamageValue:v=>Math.round(v)}; }
function tick(sys,ms){ sys.scene.now+=ms; [...sys.passiveUpdaters].forEach(fn=>fn()); }
function task(scene,i=0){ return [...scene.gravityRuntime.pendingStrikes].sort((a,b)=>a.executeAt-b.executeAt)[i]; }
function close(a,b,msg){ assert(Math.abs(a-b)<=0.001,`${msg}: ${a} !== ${b}`); }

// Visual creation, no circles, dimensions and initial lock.
{ const s=makeScene(); s.enemies=[enemy('a',200,400)]; const sys=makeSystem(s,{gravity_crush:1}), data=SKILLS.gravity_crush.levels[0]; assert(SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,1,{castId:1})); const p=task(s); assert(p.columnVisual); assert.equal(s.created.filter(n=>n.type==='circle').length,0); assert.equal(p.columnVisual.type,'rect'); assert.equal(p.columnVisual.width,250); assert.equal(p.columnVisual.height,240); assert.equal(p.columnVisual.x,200); assert.equal(p.columnVisual.y,150); assert(p.columnVisual.alpha>=.16&&p.columnVisual.alpha<=.20); assert.equal(p.columnVisual.stroke.color,0xa78bfa); }
{ const s=makeScene(); s.enemies=[enemy('a',200,400)]; const sys=makeSystem(s,{gravity_crush:9}), data=SKILLS.gravity_crush.levels[8]; SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,9,{}); assert.equal(task(s).columnVisual.width,370); }

// Hover timing, press animation, damage only at executeAt.
{ const s=makeScene(); const e=enemy('a',200,400); s.enemies=[e]; const sys=makeSystem(s,{gravity_crush:1}), data=SKILLS.gravity_crush.levels[0]; SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,1,{}); const p=task(s), startY=p.columnVisual.y; tick(sys,399); close(p.columnVisual.y,startY,'lv1 hover through 399ms'); assert.equal(s.hits.length,0); tick(sys,1); close(p.columnVisual.y,startY,'lv1 press starts at 400ms'); tick(sys,60); close(p.columnVisual.y,startY+85,'lv1 halfway press'); const alpha=p.columnVisual.alpha; tick(sys,59); assert.equal(s.hits.length,0); assert(p.columnVisual.y>startY+85); assert(p.columnVisual.alpha>alpha); tick(sys,1); close(p.columnVisual.y,320,'lv1 impact y'); assert.equal(s.hits.length,1); tick(sys,10); assert.equal(s.hits.length,1); }
{ const s=makeScene(); const e=enemy('a',200,400); s.enemies=[e]; const sys=makeSystem(s,{gravity_crush:9}), data=SKILLS.gravity_crush.levels[8]; SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,9,{}); const p=task(s); tick(sys,299); close(p.columnVisual.y,150,'lv9 hover'); tick(sys,1); close(p.columnVisual.y,150,'lv9 press start after 300ms'); }

// Rectangular main hit ignores Y, includes boundary, excludes +1.
{ const s=makeScene(); const a=enemy('same-x',200,-1000), b=enemy('edge',325,999), c=enemy('out',326,400); s.enemies=[a,b,c]; const sys=makeSystem(s,{gravity_crush:1}), data=SKILLS.gravity_crush.levels[0]; SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,1,{}); const cx=task(s).lockedCenter.x; a.x=cx; b.x=cx+data.radius; c.x=cx+data.radius+1; tick(sys,data.warningMs); assert(s.hits.some(h=>h.e===a)); assert(s.hits.some(h=>h.e===b)); assert(!s.hits.some(h=>h.e===c)); }

// Lv3 shock is rectangular damage and rectangular visual.
{ const s=makeScene(); const main=enemy('main',200,100), outer=enemy('outer',390,100), out=enemy('out',406,100); s.enemies=[main,outer,out]; const sys=makeSystem(s,{gravity_crush:3}), data=SKILLS.gravity_crush.levels[2]; SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,3,{}); const cx=task(s).lockedCenter.x; main.x=cx; outer.x=cx+data.radius+45; out.x=cx+data.radius+61; tick(sys,data.warningMs); assert.equal(s.hits.find(h=>h.e===main).d,data.damage); assert.equal(s.hits.find(h=>h.e===outer).d,Math.round(data.damage*.4)); assert(!s.hits.some(h=>h.e===out)); const flashes=s.created.filter(n=>n.type==='rect'&&n.height===56); assert.equal(flashes.at(-1).width,(data.radius+60)*2); assert.equal(s.created.filter(n=>n.type==='circle').length,0); }

// Lv6 suppression bonus remains 40% for main and shock.
{ const s=makeScene(); const a=enemy('a',200,100), b=enemy('b',201,100), c=enemy('c',390,100), d=enemy('d',391,100); s.enemies=[a,b,c,d]; const sys=makeSystem(s,{gravity_crush:6}), data=SKILLS.gravity_crush.levels[5]; applyEnemyGravity(b,{sourceId:'pre',moveSlow:.2,attackSlow:.1,expiresAt:9999,external:true}); applyEnemyGravity(d,{sourceId:'pre',moveSlow:.2,attackSlow:.1,expiresAt:9999,external:true}); SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,6,{}); const cx=task(s).lockedCenter.x; a.x=cx; b.x=cx+1; c.x=cx+data.radius+25; d.x=cx+data.radius+26; tick(sys,data.warningMs); assert.equal(s.hits.find(h=>h.e===a).d,data.damage); assert.equal(s.hits.find(h=>h.e===b).d,Math.round(data.damage*1.4)); assert.equal(s.hits.find(h=>h.e===c).d,Math.round(data.damage*.4)); assert.equal(s.hits.find(h=>h.e===d).d,Math.round(data.damage*.4*1.4)); }

// Lv9 staged followups retarget horizontally and do not pre-create later visuals.
{ const s=makeScene(); const e=enemy('a',100,100); s.enemies=[e]; const sys=makeSystem(s,{gravity_crush:9}), data=SKILLS.gravity_crush.levels[8]; SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,9,{}); let tasks=[...s.gravityRuntime.pendingStrikes].sort((a,b)=>a.executeAt-b.executeAt); assert(tasks[0].columnVisual); assert.equal(tasks[1].visuals.length,0); assert.equal(tasks[2].visuals.length,0); tick(sys,179); tick(sys,1); assert.equal(tasks[1].lockedCenter.x,100); e.x=400; tick(sys,179); tick(sys,1); assert.equal(tasks[2].lockedCenter.x,400); s.enemies=[enemy('first',100,100), enemy('later',400,100)]; tick(sys,60); assert.equal(s.hits.length,1); tick(sys,180); assert.equal(s.hits.length,2); assert.equal(s.hits[1].d,Math.round(data.damage*data.followupDamageRatio)); tick(sys,180); assert.equal(s.hits.length,3); assert.equal(s.created.filter(n=>n.type==='circle').length,0); }

// Horizontal density differs from circular density; field/orb helper remains circular.
{ const s=makeScene(); s.enemies=[enemy('h1',100,0),enemy('h2',110,1000),enemy('h3',120,2000),enemy('c1',500,0),enemy('c2',620,0)]; assert.equal(mostDenseHorizontal(s,125).x,100); assert.equal(mostDense(s,125).x,500); }

// Pause shifts executeAt only; dynamic pressStart preserves position and remaining time.
{ const s=makeScene(); const e=enemy('p',200,400); s.enemies=[e]; const sys=makeSystem(s,{gravity_crush:1}), data=SKILLS.gravity_crush.levels[0]; SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,1,{}); const p=task(s); tick(sys,200); const y=p.columnVisual.y; SKILL_HANDLERS.black_hole.shiftTimers(sys,5000,200); tick(sys,5000); close(p.columnVisual.y,y,'pause hover no jump'); assert.equal(s.hits.length,0); tick(sys,319); assert.equal(s.hits.length,0); tick(sys,1); assert.equal(s.hits.length,1); }
{ const s=makeScene(); const e=enemy('p',200,400); s.enemies=[e]; const sys=makeSystem(s,{gravity_crush:1}), data=SKILLS.gravity_crush.levels[0]; SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,1,{}); const p=task(s); tick(sys,460); const y=p.columnVisual.y; SKILL_HANDLERS.black_hole.shiftTimers(sys,5000,460); tick(sys,5000); close(p.columnVisual.y,y,'pause mid-press no jump'); assert.equal(s.hits.length,0); tick(sys,59); assert.equal(s.hits.length,0); tick(sys,1); assert.equal(s.hits.length,1); }

// Lifecycle cleanup removes pending task and visuals; release creates fresh visual.
{ const s=makeScene(); s.enemies=[enemy('a',200,400)]; const sys=makeSystem(s,{gravity_crush:1}), data=SKILLS.gravity_crush.levels[0]; SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,1,{}); const first=task(s).columnVisual; SKILL_HANDLERS.gravity_crush.cleanup(sys); assert.equal(s.gravityRuntime.pendingStrikes.size,0); assert(first.destroyed); tick(sys,1000); SKILL_HANDLERS.gravity_crush.cast(sys,SKILLS.gravity_crush,data,1,{}); assert.notEqual(task(s).columnVisual,first); s.events.emit('shutdown'); assert.equal(s.gravityRuntime,null); }

console.log('v0.11.1 gravity crush column validation passed');
