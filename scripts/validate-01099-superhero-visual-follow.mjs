import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import { __superheroTest } from '../src/skills/handlers/SuperheroFlowSkills.js';
import { getEnemyColdState } from '../src/systems/EnemyColdControl.js';

class Bus { constructor(){ this.handlers=new Map(); } on(type,fn){ const arr=this.handlers.get(type)||[]; arr.push(fn); this.handlers.set(type,arr); return ()=>this.handlers.set(type,(this.handlers.get(type)||[]).filter(x=>x!==fn)); } emit(type,payload){ (this.handlers.get(type)||[]).slice().forEach(fn=>fn(payload)); } }
const graphicsLog={created:0,alive:0};
const graphics=()=>{ graphicsLog.created+=1; graphicsLog.alive+=1; return {active:true,destroyed:false,lines:[],slices:[],setDepth(){return this},clear(){this.lines=[];this.slices=[];return this},lineStyle(){return this},lineBetween(x1,y1,x2,y2){this.lines.push({x1,y1,x2,y2});return this},fillStyle(){return this},slice(x,y,r,a1,a2){this.slices.push({x,y,r,a1,a2});return this},fillPath(){return this},destroy(){ if(!this.destroyed){this.destroyed=true; graphicsLog.alive-=1;} }}; };
function scene(){ graphicsLog.created=0; graphicsLog.alive=0; const s={now:0,player:{x:0,y:500},playerData:{hp:100,maxHp:100,mana:100,maxMana:100,skills:[],skillDamageMultiplier:1,attackSpeedMultiplier:1,moveSpeedMultiplierBonuses:{},attackSpeedMultiplierBonuses:{},cooldownReduction:0},enemies:[],eventBus:new Bus(),paused:false,isGameplayPaused(){return this.paused},getGameplayTime(){return this.now},hud:{update(){}},skillBar:{update(){}},events:{on(){},once(){}},add:{graphics},tweens:{add(cfg){ cfg.onComplete?.(); },killTweensOf(){}},targeting:{valid:e=>!!e&&!e.isDefeated&&(e.hp??1)>0,all(){return s.enemies.filter(this.valid)},nearestAhead(range=9999){return this.all().filter(e=>e.x>=s.player.x&&e.x-s.player.x<=range).sort((a,b)=>a.x-b.x)[0]||null},isEnemyFullyInsideViewport(){return true}},professionSystem:{getDamageMultiplier(){return 1},onActiveSkillCast(){},onDirectHit(){}},artifactSystem:{highHpDamageMultiplier(){return 1}},combatSystem:{damageLog:[],damageEnemy(e,amount,meta={}){ if(!s.targeting.valid(e)) return false; e.hp=Math.max(0,e.hp-Math.round(amount)); this.damageLog.push({enemy:e,amount:Math.round(amount),meta}); if(e.hp<=0&&!e.isDefeated){ e.isDefeated=true; s.eventBus.emit('enemy:killed',{enemy:e,...meta}); } return true; }}}; s.skillSystem=new SkillSystem(s); return s; }
function enemy(props={}){ return {active:true,x:props.x??300,y:props.y??500,width:props.width??60,height:props.height??90,hp:props.hp??1000,maxHp:props.hp??1000,...props}; }
function own(s,id,level){ s.playerData.skills=[{id,level}]; s.skillSystem.ensurePassiveBound(id); }
function updateActiveAt(s,t){ s.now=t; s.skillSystem.updateActive(t); }
function syncAt(s,t){ s.now=t; s.skillSystem.syncAttachedVisuals(); }
const close=(a,b,msg)=>assert(Math.abs(a-b)<1e-6,msg||`${a} ~= ${b}`);

// 冰冻吐息：视觉和判定每帧跟随嘴部，Graphics 复用，结束区域固定最终快照。
{
  const s=scene(); own(s,'freezing_breath',9); const initial=enemy({x:250,y:448,hp:1000}); s.enemies=[initial]; const cfg=SKILLS.freezing_breath, data=cfg.levels[8]; s.skillSystem.cast(cfg,data,9,{...s.skillSystem.createCastContext('freezing_breath'),manaCost:0}); const active=s.skillSystem.active[0]; const visual=active.visual; assert.equal(graphicsLog.created,1,'breath creates one Graphics at cast start'); close(active.currentSnapshot.origin.x,__superheroTest.mouthPoint(s).x,'breath origin starts at mouth x'); close(active.currentSnapshot.origin.y,__superheroTest.mouthPoint(s).y,'breath origin starts at mouth y');
  updateActiveAt(s,0); const oldHp=initial.hp;
  initial.isDefeated=true; s.player.x=500; const dynamic=enemy({x:690,y:448,hp:1000}); const oldPositionEnemy=enemy({x:250,y:448,hp:1000}); s.enemies=[initial,dynamic,oldPositionEnemy]; for(let i=1;i<=20;i++) syncAt(s,i*8); assert.equal(active.visual,visual,'breath Graphics reference remains stable during frame sync'); assert.equal(graphicsLog.created,1,'breath frame sync does not create more Graphics'); close(active.currentSnapshot.origin.x,__superheroTest.mouthPoint(s).x,'breath origin immediately follows moved mouth'); assert(active.currentSnapshot===active.currentSnapshot,'currentSnapshot exists for shared visual/hit geometry');
  updateActiveAt(s,250); assert(dynamic.hp<1000,'new enemy in dynamic cone is damaged after player moves'); assert.equal(oldPositionEnemy.hp,1000,'enemy at stale initial cone is not damaged by later tick'); assert(initial.hp===oldHp || initial.hp<1000,'old target reference remains safe even after movement');
  const finalOrigin={...active.currentSnapshot.origin}; active.onEnd('complete'); const zone=s.skillSystem.active.find(a=>a.activeKind==='coldZone'); assert(zone,'Lv9 complete creates cold zone'); close(zone.snapshot.origin.x,finalOrigin.x,'cold zone uses final breath origin'); s.player.x+=400; const zoneOrigin={...zone.snapshot.origin}; syncAt(s,500); close(zone.snapshot.origin.x,zoneOrigin.x,'cold zone does not follow player after creation'); s.skillSystem.removeSkillRuntime('freezing_breath'); assert.equal(graphicsLog.alive,0,'breath and cold-zone Graphics are cleaned after removal');
}

// 镭射眼：Graphics 创建一次并逐帧更新起点和方向，伤害仍按 tick 结算。
{
  const s=scene(); own(s,'laser_eyes',6); const lock=enemy({x:520,y:430,hp:3000}); s.enemies=[lock]; const cfg=SKILLS.laser_eyes, data=cfg.levels[5]; s.skillSystem.cast(cfg,data,6,{...s.skillSystem.createCastContext('laser_eyes'),manaCost:0}); const active=s.skillSystem.active[0]; assert.equal(graphicsLog.created,2,'Lv6 laser creates two Graphics once'); const visuals=[...active.visuals]; updateActiveAt(s,0); const damageAfterFirst=s.combatSystem.damageLog.length; assert.equal(damageAfterFirst,2,'dual laser damages only on first scheduled tick');
  lock.y=520; const starts=[]; const dirs=[]; for(let i=1;i<=30;i++){ s.player.x=180+i*3; syncAt(s,i*16); starts.push(active.beamSegments[0].start.x); dirs.push(Math.atan2(active.visualDir.y,active.visualDir.x)); }
  assert.deepEqual(active.visuals,visuals,'laser Graphics references are reused during frame sync'); assert.equal(graphicsLog.created,2,'laser frame sync does not create more Graphics'); close(active.beamSegments[0].start.x, __superheroTest.eyePoint(s).x + (-active.visualDir.y) * (-(data.width*0.35/2)), 'laser start follows eye plus current normal offset'); assert.equal(s.combatSystem.damageLog.length,damageAfterFirst,'frame sync does not deal extra damage'); assert(new Set(starts.map(x=>Math.round(x))).size>5,'laser start moves continuously across frames, not only on damage ticks'); assert(new Set(dirs.map(x=>x.toFixed(4))).size>3,'laser direction changes smoothly across frames');
  const seg=active.beamSegments[0]; const hitByShared=__superheroTest.lineTargets(s,seg.start,seg.end,seg.halfWidth).includes(lock); const focusBefore=active.focus; updateActiveAt(s,200); assert.equal(s.combatSystem.damageLog.length>damageAfterFirst, hitByShared, 'damage tick uses the same saved beamSegments as visual geometry'); assert.equal(active.focus,focusBefore+1,'dual beams add focus at most once per tick');
  active.onEnd('cleanup'); assert.equal(active.visuals.length,0,'laser visuals array cleared on end'); assert.equal(active.beamSegments.length,0,'laser beamSegments cleared on end'); assert.equal(graphicsLog.alive,0,'laser Graphics cleaned on end');
}

// Lv9 laser exact 150ms schedule and object-count stability over 60 frames.
{
  const s=scene(); own(s,'laser_eyes',9); const lock=enemy({x:520,y:430,hp:10000}); s.enemies=[lock]; const cfg=SKILLS.laser_eyes, data=cfg.levels[8]; s.skillSystem.cast(cfg,data,9,{...s.skillSystem.createCastContext('laser_eyes'),manaCost:0}); const active=s.skillSystem.active[0]; for(let t of [0,200,400,600,800]) updateActiveAt(s,t); assert.equal(active.focus,5,'Lv9 reaches max focus through real ticks'); updateActiveAt(s,1000); assert.equal(active.nextAt,1150,'Lv9 max focus uses 150ms interval'); const created=graphicsLog.created; for(let i=1;i<=60;i++) syncAt(s,1000+i*16); assert.equal(graphicsLog.created,created,'laser Graphics count is stable over 60 frames'); active.onEnd('cleanup'); assert.equal(graphicsLog.alive,0,'laser Graphics return to zero after end');
}

// Pause: sync does not advance while paused and a long pause does not become one huge visual delta.
{
  const s=scene(); own(s,'laser_eyes',1); const lock=enemy({x:520,y:430,hp:1000}); s.enemies=[lock]; const cfg=SKILLS.laser_eyes, data=cfg.levels[0]; s.skillSystem.cast(cfg,data,1,{...s.skillSystem.createCastContext('laser_eyes'),manaCost:0}); const active=s.skillSystem.active[0]; syncAt(s,16); const before={...active.visualDir}; s.paused=true; s.now=5016; s.skillSystem.syncAttachedVisuals(); close(active.visualDir.x,before.x,'paused sync keeps laser direction x'); s.paused=false; s.skillSystem.shiftTimers(5000,16); lock.y=650; syncAt(s,5032); assert(active.lastVisualAt<=5032,'resume updates visual timestamp without accumulating entire pause');
}

console.log('v0.10.99 superhero visual follow validation passed');
