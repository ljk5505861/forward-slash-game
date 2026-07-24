import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS } from '../src/config/tags.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import { selectSoulDestroyingNeedleTarget } from '../src/skills/handlers/CultivationSoulDestroyingNeedleSkill.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(GAME_VERSION,'0.11.6'); assert.equal(pkg.version,'0.11.6'); assert.equal(Object.keys(SKILLS).length,42);
const cfg=SKILLS.soul_destroying_needle; assert(cfg); assert.equal(cfg.rarity,'EPIC'); assert.equal(cfg.maxLevel,9); assert.equal(cfg.passive,false); assert.equal(cfg.requiredSkillId,undefined);
[TAGS.MAGIC,TAGS.SPELL,TAGS.PROJECTILE,TAGS.ACTIVE_SKILL,TAGS.CULTIVATION,TAGS.BUILD_CULTIVATION].forEach(tag=>assert(cfg.tags.includes(tag)));
assert.deepEqual(cfg.levels.map(x=>x.damage),[72,80,90,101,113,126,141,157,175]); assert.deepEqual(cfg.levels.map(x=>x.cooldownMs),[5800,5600,5400,5200,5000,4800,4600,4400,4200]); assert.deepEqual(cfg.levels.map(x=>x.manaCost),[10,10,10,11,11,12,12,13,14]);
class Bus { constructor(){this.events=[];} emit(e,p){this.events.push({e,p});} on(){return ()=>{};} }
const v=()=>({setStrokeStyle(){return this;},setDepth(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setRotation(){return this;},setScale(){return this;},setOrigin(){return this;},destroy(){this.destroyed=true;}});
function scene({level=1,enemies=[],mana=100}={}) { let time=0; const bus=new Bus(); const s={enemies,player:{x:0,y:0},playerData:{hp:100,maxHp:100,mana,maxMana:mana,skills:[{id:'soul_destroying_needle',level}],cooldownReduction:0,skillDamageMultiplier:1},eventBus:bus,events:{on(){},once(){},off(){}},getGameplayTime:()=>time,setTime:t=>time=t,isGameplayPaused:()=>false,targeting:{valid:e=>!!e&&e.active!==false&&!e.isDefeated&&e.hp>0,isEnemyFullyInsideViewport:e=>e.visible!==false,all(){return s.enemies.filter(this.valid);},random(){return this.all()[0]||null;}},add:{circle:v,rectangle:v,line:v},tweens:{add(){},killTweensOf(){}},hud:{update(){}},skillBar:{update(){}},artifactSystem:{level:()=>0,highHpDamageMultiplier:()=>1},professionSystem:{getDamageMultiplier:()=>1,onActiveSkillCast(){s.casts=(s.casts||0)+1;},onDirectHit(){}},combatSystem:{hits:[],damageEnemy(e,d,meta){if(!s.targeting.valid(e)) return false; this.hits.push({e,d,meta});e.hp-=d;if(e.hp<=0){e.active=false;e.isDefeated=true;}return true;}}};s.skillSystem=new SkillSystem(s);return s; }
const enemy=(x,y,hp=100,more={})=>({x,y,hp,active:true,...more}); const step=(s,t)=>{s.setTime(t);s.skillSystem.update(t);};
let s=scene({enemies:[enemy(30,0,50),enemy(100,0,90,{isElite:true}),enemy(300,0,1,{isBoss:true}),enemy(1,0,999,{visible:false})]}); assert.equal(selectSoulDestroyingNeedleTarget(s).isBoss,true);
s=scene({enemies:[]}); step(s,0); assert.equal(s.playerData.mana,100);assert.equal(s.skillSystem.active.length,0);assert.equal(s.casts||0,0);assert.equal(s.eventBus.events.filter(x=>x.e===CombatEvents.SKILL_CAST_COMPLETED).length,0);
s=scene({enemies:[enemy(100,0,200)]}); step(s,0); assert.equal(s.skillSystem.active[0].needles.length,1);step(s,179);assert.equal(s.combatSystem.hits.length,0);step(s,180);assert.equal(s.combatSystem.hits.length,1);step(s,400);assert.equal(s.combatSystem.hits.length,1);assert(s.playerData.mana<=90.8);assert.equal(s.casts,1);
s=scene({level:3,enemies:[enemy(100,0,100),enemy(120,0,100,{isElite:true})]});step(s,0);s.enemies[0].active=false;step(s,180);assert.equal(s.combatSystem.hits.length,1);assert.equal(s.combatSystem.hits[0].e.isElite,true);
s=scene({level:6,enemies:[enemy(100,0,1000,{isBoss:true})]});step(s,0);step(s,180);assert.equal(s.combatSystem.hits[0].meta.defenseIgnore,.5);assert.equal(s.combatSystem.hits[0].d,Math.round(126*1.2));
s=scene({level:9,enemies:[enemy(100,0,5000)]});step(s,0);assert.equal(s.skillSystem.active[0].needles.filter(n=>n.launched).length,1);step(s,160);assert.equal(s.skillSystem.active[0].needles.filter(n=>n.launched).length,2);step(s,180);step(s,320);step(s,340);step(s,500);assert.deepEqual(s.combatSystem.hits.map(h=>h.d),[175,105,105]);assert.equal(s.casts,1);assert.equal(s.eventBus.events.filter(x=>x.e===CombatEvents.SKILL_CAST_COMPLETED).length,1);
s=scene({level:9,enemies:[enemy(100,0,5000)]});step(s,0);s.skillSystem.shiftTimers(1000,100);const n=s.skillSystem.active[0].needles;assert.equal(n[0].hitAt,1180);assert.equal(n[1].fireAt,1160);assert.equal(n[2].hitAt,1500);step(s,1179);assert.equal(s.combatSystem.hits.length,0);step(s,1180);assert.equal(s.combatSystem.hits.length,1);s.skillSystem.removeSkillRuntime();s.playerData.skills=[];step(s,2000);assert.equal(s.skillSystem.active.length,0);
console.log('v0.11.6 soul destroying needle validation passed.');
