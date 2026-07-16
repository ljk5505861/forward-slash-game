import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS } from '../src/config/tags.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import { selectSkyCoveringPalmCenter } from '../src/skills/handlers/CultivationActiveSkills.js';
import { getEnemyMoveSpeed, getEnemyAttackDelay } from '../src/systems/EnemyGravityControl.js';
import { CombatEvents } from '../src/core/CombatEvents.js';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(GAME_VERSION,'0.11.4'); assert.equal(pkg.version,'0.11.4'); assert.equal(Object.keys(SKILLS).length,41);
const cfg=SKILLS.sky_covering_palm; assert(cfg); assert.equal(Object.values(SKILLS).filter(s=>s.id==='sky_covering_palm').length,1);
assert.equal(cfg.rarity,'EPIC'); assert.equal(cfg.maxLevel,9); assert.equal(cfg.passive,false); assert.equal(cfg.targetType,'random');
[TAGS.MAGIC,TAGS.SPELL,TAGS.ACTIVE_SKILL,TAGS.CULTIVATION,TAGS.BUILD_CULTIVATION].forEach(t=>assert(cfg.tags.includes(t)));
assert.deepEqual(cfg.levels.map(l=>l.damage),[48,54,62,71,81,93,106,121,138]);
assert.deepEqual(cfg.levels.map(l=>l.radius),[110,115,130,135,145,155,165,175,185]);
assert.deepEqual(cfg.levels.map(l=>l.cooldownMs),[6500,6300,6100,5900,5700,5400,5200,5000,4600]);
assert.deepEqual(cfg.levels.map(l=>l.manaCost),[12,12,12,13,13,13,14,14,15]);
assert(cfg.milestones[3].includes('掌纹震荡')); assert(cfg.milestones[6].includes('镇压山河')); assert(cfg.milestones[9].includes('一掌遮天'));

class Bus{constructor(){this.events=[]} emit(e,p){this.events.push({e,p})} on(){return()=>{}}}
const visual=()=>({destroyed:false,setStrokeStyle(){return this},setDepth(){return this},setFillStyle(){return this},setScale(){return this},setPosition(x,y){this.x=x;this.y=y;return this},setOrigin(){return this},destroy(){this.destroyed=true}});
function scene({skills=[{id:'sky_covering_palm',level:1}],enemies=[],mana=100,realmSnapshot=null,alchemy=false,prof=1,skillMult=1,battle=0}={}){let t=0; const bus=new Bus(); const s={now:0,enemies,player:{x:0,y:0},playerData:{hp:100,maxHp:100,mana,maxMana:mana,skills,cooldownReduction:0,skillDamageMultiplier:skillMult,battleMarkStacks:battle},passiveState:{},eventBus:bus,events:{on(){},once(){},off(){}},isGameplayPaused:()=>false,getGameplayTime(){return t},setTime(v){t=v;this.now=v},targeting:{valid:e=>!!e&&e.active!==false&&!e.isDefeated&&e.hp>0,isEnemyFullyInsideViewport:e=>e.visible!==false,all(){return s.enemies.filter(this.valid)},random(){return this.all()[0]||null}},add:{circle(){return visual()},ellipse(){return visual()},rectangle(){return visual()},line(){return visual()},text(){return visual()},graphics(){return visual()}},tweens:{add(o){return {stop(){},remove(){}}},killTweensOf(){}},cameras:{main:{shake(){s.shaken=true}}},hud:{update(){}},skillBar:{update(){}},floatText(){},artifactSystem:{level:id=>id==='battle_mark'?2:0,highHpDamageMultiplier:()=>1,has:()=>false},professionSystem:{casts:0,getDamageMultiplier:()=>prof,onActiveSkillCast(){this.casts++},onDirectHit(){}},combatSystem:{hits:[],damageEnemy(e,d,meta){if(!s.targeting.valid(e))return false; this.hits.push({e,d,meta}); e.hp-=d; if(e.hp<=0){e.active=false;e.isDefeated=true} return true;},clearKnockback(){}}}; if(realmSnapshot) s.passiveState.ninefoldDao=realmSnapshot; if(alchemy) s.passiveState.alchemy={alchemyBuffUntil:99999}; s.skillSystem=new SkillSystem(s); s.skillSystem.passiveState={...s.passiveState}; return s;}
function step(s,time){s.setTime(time); s.skillSystem.update(time);} const e=(x,y,hp=100,extra={})=>({x,y,hp,maxHp:hp,active:true,...extra});
let sc=scene({enemies:[e(100,0,10),e(120,0,20),e(500,0,100),e(520,0,100)]}); assert.deepEqual(selectSkyCoveringPalmCenter(sc.skillSystem,50),{x:500,y:0});
sc=scene({enemies:[e(100,0,10),e(120,0,10),e(300,0,60),e(320,0,60)]}); assert.deepEqual(selectSkyCoveringPalmCenter(sc.skillSystem,50),{x:300,y:0});
sc=scene({enemies:[e(100,0,20),e(120,0,20),e(140,0,20),e(500,0,20),e(520,0,20),e(480,0,20)]}); assert.deepEqual(selectSkyCoveringPalmCenter(sc.skillSystem,50),{x:100,y:0});
sc=scene({enemies:[e(10,0,1,{visible:false}),e(20,0,1,{hp:0})]}); assert.equal(selectSkyCoveringPalmCenter(sc.skillSystem,50),null);

sc=scene({enemies:[e(100,0,100)]}); step(sc,0); assert.equal(sc.playerData.mana,88); assert(sc.skillSystem.cooldowns.get('sky_covering_palm')>0); assert.equal(sc.eventBus.events.filter(x=>x.e===CombatEvents.SKILL_CAST_COMPLETED).length,1); assert.equal(sc.professionSystem.casts,1);
sc=scene({enemies:[],mana:50,battle:5}); step(sc,0); assert.equal(sc.playerData.mana,50); assert.equal(sc.skillSystem.cooldowns.has('sky_covering_palm'),false); assert.equal(sc.eventBus.events.filter(x=>x.e===CombatEvents.SKILL_CAST_COMPLETED).length,0); assert.equal(sc.professionSystem.casts,0); assert.equal(sc.playerData.battleMarkStacks,5);

sc=scene({enemies:[e(100,0,1000)],prof:2,skillMult:3}); step(sc,0); step(sc,599); assert.equal(sc.combatSystem.hits.length,0); step(sc,616); assert.equal(sc.combatSystem.hits.length,1); assert.equal(sc.combatSystem.hits[0].d,288); const castId=sc.combatSystem.hits[0].meta.skillId; assert.equal(castId,'sky_covering_palm'); const completed=sc.eventBus.events.filter(x=>x.e===CombatEvents.SKILL_CAST_COMPLETED).length; step(sc,850); step(sc,1050); assert.equal(sc.eventBus.events.filter(x=>x.e===CombatEvents.SKILL_CAST_COMPLETED).length,completed);
sc=scene({skills:[{id:'sky_covering_palm',level:3}],enemies:[e(100,0,1000),e(250,0,1000)]}); step(sc,0); step(sc,616); assert.equal(sc.combatSystem.hits.length,1); step(sc,849); assert.equal(sc.combatSystem.hits.length,1); step(sc,866); assert.equal(sc.combatSystem.hits.length,3);
sc=scene({skills:[{id:'sky_covering_palm',level:9}],enemies:[e(100,0,1000),e(250,0,1000)]}); step(sc,0); const locked={...sc.skillSystem.active[0].lockedCenter}; sc.enemies[0].x=1000; step(sc,616); step(sc,866); step(sc,1066); assert.equal(sc.combatSystem.hits.length,3); assert.deepEqual(sc.skillSystem.active[0]?.lockedCenter||locked,locked);
assert(sc.combatSystem.hits.every(h=>h.meta.skillId==='sky_covering_palm'));

sc=scene({skills:[{id:'sky_covering_palm',level:6}],enemies:[e(100,0,1000),e(120,0,1000,{isElite:true}),e(140,0,1000,{isBoss:true})]}); step(sc,0); step(sc,616); const [n,el,b]=sc.enemies; assert.equal(getEnemyMoveSpeed(n,100,600),70); assert.equal(Math.round(getEnemyAttackDelay(n,1000,600)),1333); assert.equal(getEnemyMoveSpeed(el,100,600),85); assert.equal(Math.round(getEnemyAttackDelay(el,1000,600)),1136); assert.equal(b.gravitySources?.has('sky_covering_palm_suppression'),undefined);
step(sc,700); const exp=n.gravitySources.get('sky_covering_palm_suppression').expiresAt; step(sc,900); const exp2=n.gravitySources.get('sky_covering_palm_suppression').expiresAt; assert(exp2>=exp); assert.equal(getEnemyMoveSpeed(n,100,900),70);
sc=scene({skills:[{id:'sky_covering_palm',level:9}],enemies:[e(100,0,1000)]}); step(sc,0); step(sc,616); const srcCount=sc.enemies[0].gravitySources?.size||0; step(sc,850); step(sc,1050); assert.equal(sc.enemies[0].gravitySources?.size||0,srcCount);

sc=scene({skills:[{id:'sky_covering_palm',level:9}],enemies:[e(100,0,1000)]}); step(sc,0); assert.equal(sc.skillSystem.active.length,1); sc.skillSystem.removeSkillRuntime('sky_covering_palm'); sc.playerData.skills=[]; step(sc,2000); assert.equal(sc.combatSystem.hits.length,0); assert.equal(sc.skillSystem.active.length,0);
sc=scene({enemies:[e(100,0,1000)]}); step(sc,0); sc.skillSystem.reset(); sc.playerData.skills=[]; step(sc,2000); assert.equal(sc.combatSystem.hits.length,0); assert.equal(sc.skillSystem.active.length,0);
assert.equal(Object.keys(SKILLS).length,41);
console.log('v0.11.4 sky covering palm validation passed.');
