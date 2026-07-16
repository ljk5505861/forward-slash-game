import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS } from '../src/config/tags.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import SkillSystem from '../src/systems/SkillSystem.js';

assert.equal(GAME_VERSION,'0.11.3');
assert.equal(JSON.parse(fs.readFileSync('package.json','utf8')).version,'0.11.3');
assert.equal(Object.keys(SKILLS).length,40);
const cfg=SKILLS.lightning_tribulation;
assert(cfg); assert.equal(cfg.name,'雷劫兵主'); assert.equal(cfg.rarity,'MYTHIC'); assert.equal(cfg.ultimateSkill,true); assert.equal(cfg.passive,true); assert.equal(cfg.maxLevel,9); assert.equal(cfg.handler,'lightning_tribulation'); assert.equal(cfg.requiredSkillId,undefined);
[TAGS.MAGIC,TAGS.LIGHTNING,TAGS.NORMAL_ATTACK,TAGS.BUILD_WEAPON,'mythicSkill'].forEach(t=>assert(cfg.tags.includes(t),`missing tag ${t}`));
assert.deepEqual(cfg.levels.map(x=>x.damageRatio),[0.12,0.14,0.16,0.18,0.20,0.30,0.33,0.36,0.40]);
assert.deepEqual(cfg.levels.map(x=>x.explosionRadius),[0,0,90,96,102,110,118,126,135]);
assert.deepEqual(cfg.levels.map(x=>x.boltCount),[1,1,1,1,1,1,1,1,3]);
assert.match(cfg.milestones[3],/雷爆/); assert.match(cfg.milestones[6],/雷威/); assert.match(cfg.milestones[9],/九霄雷劫/);

class Bus{constructor(){this.m=new Map();this.emits=[];} on(e,fn){const a=this.m.get(e)||[];a.push(fn);this.m.set(e,a);return()=>this.m.set(e,(this.m.get(e)||[]).filter(x=>x!==fn));} emit(e,p){this.emits.push({e,p});(this.m.get(e)||[]).slice().forEach(fn=>fn(p));} count(e){return (this.m.get(e)||[]).length;}}
const obj=()=>({destroyed:false,active:true,alpha:1,setDepth(){return this;},setStrokeStyle(){return this;},setOrigin(){return this;},setScale(){return this;},destroy(){this.destroyed=true;this.active=false;return this;}});
function scene(enemies=[]){ const bus=new Bus(); const tweens=[]; const s={player:{x:0,y:0},playerData:{hp:100,skills:[],artifacts:[],upgradesChosen:[]},enemies,eventBus:bus,events:{on(){},once(){}},targeting:{valid:e=>!!e&&e.active!==false&&!e.destroyed,isEnemyFullyInsideViewport:e=>e?.inside!==false,all:()=>enemies.filter(e=>e.active!==false&&!e.destroyed)},add:{graphics(){const g=obj();g.lineStyle=()=>g;g.lineBetween=()=>g;return g;},circle(){return obj();}},tweens:{add(c){const t={stop(){this.stopped=true;},remove(){this.removed=true;}};tweens.push({t,c}); return t;},killTweensOf(){}},getGameplayTime:()=>0}; s.combatSystem={hits:[],damageEnemy(e,d,m){assert(e&&e.hp>0,'no damage to dead/invalid targets'); this.hits.push({e,d,m}); e.hp=Math.max(0,e.hp-d); if(e.hp<=0)e.isDefeated=true; return true;}}; s._tweens=tweens; return s; }
const enemy=(id,x,y=0,hp=100,extra={})=>({id,x,y,hp,active:true,...extra});
function make(level=0,enemies=[enemy('a',100)]){ const s=scene(enemies); const sys=new SkillSystem(s); if(level) s.playerData.skills.push({id:'lightning_tribulation',level}); return {s,sys,enemies}; }
function attack(s,p={}){ s.eventBus.emit(CombatEvents.PLAYER_ATTACK_RESOLVED,{enemy:s.enemies[0],targets:[s.enemies[0]],baseDamage:100,actualDamage:999,...p}); }

{ const {s,sys}=make(0); attack(s); assert.equal(s.combatSystem.hits.length,0); assert.equal(s._tweens.length,0); assert(sys.passiveState.lightningTribulation); }
{ const {s}=make(1); s.eventBus.emit(CombatEvents.PLAYER_HIT,{enemy:s.enemies[0],actualDamage:100,tags:[TAGS.NORMAL_ATTACK]}); assert.equal(s.combatSystem.hits.length,0); attack(s); assert.equal(s.combatSystem.hits.length,1); attack(s,{targets:[s.enemies[0],enemy('b',110)]}); assert.equal(s.combatSystem.hits.length,2); attack(s,{targets:[],enemy:null}); assert.equal(s.combatSystem.hits.length,2); attack(s,{baseDamage:0}); assert.equal(s.combatSystem.hits.length,2); assert.equal(s.eventBus.emits.filter(x=>x.e===CombatEvents.PLAYER_HIT).length,1); assert.equal(s.eventBus.emits.filter(x=>x.e===CombatEvents.PLAYER_ATTACK_RESOLVED).length,4); }
for(let lv=1;lv<=9;lv++){ const {s}=make(lv); attack(s,{baseDamage:101}); const expected=Math.max(1,Math.round(101*cfg.levels[lv-1].damageRatio)); assert.equal(s.combatSystem.hits[0].d,expected,`lv${lv} damage uses baseDamage`); assert.notEqual(s.combatSystem.hits[0].d,Math.round(999*cfg.levels[lv-1].damageRatio)); assert.equal(s.combatSystem.hits[0].m.damageAlreadyResolved,true); assert.equal(s.combatSystem.hits[0].m.crit,false); assert.equal(s.combatSystem.hits[0].m.allowLifeSteal,false); assert.equal(s.combatSystem.hits[0].m.noKnockback,true); assert.equal(s.combatSystem.hits[0].m.canTriggerArtifacts,false); assert(!s.combatSystem.hits[0].m.tags.includes(TAGS.NORMAL_ATTACK)); assert(!('noDeathExplosion' in s.combatSystem.hits[0].m)); assert(!('noPoisonSpread' in s.combatSystem.hits[0].m)); }
{ const {s}=make(1,[enemy('a',0),enemy('b',89),enemy('c',90)]); attack(s); assert.equal(s.combatSystem.hits.length,1); }
{ const {s}=make(3,[enemy('a',0),enemy('b',89),enemy('c',90),enemy('d',91)]); attack(s); assert.deepEqual(s.combatSystem.hits.map(h=>h.e.id),['a','b','c']); assert.equal(new Set(s.combatSystem.hits.map(h=>h.e)).size,3); }
{ const data=cfg.levels[8]; assert.equal(data.explosionRadius,135); const {s}=make(9,[enemy('boss',0,0,500,{isBoss:true})]); attack(s); assert.equal(s.combatSystem.hits.filter(h=>h.e.id==='boss').length,3,'same enemy can be hit by independent Lv9 bolts'); }
{ const {s}=make(9,[enemy('a',0),enemy('b',50),enemy('c',100),enemy('d',130)]); attack(s); const centers=s.combatSystem.hits.filter(h=>h.d===40).slice(0,3).map(h=>h.e.id); assert(new Set(centers).size>=3,'Lv9 prefers distinct centers when available'); }
{ const {s}=make(9,[enemy('boss',0,0,500,{isBoss:true})]); attack(s); assert.equal(s.combatSystem.hits.length,3,'single boss receives all three bolts'); }
{ const {s}=make(9,[enemy('a',0,0,1),enemy('b',200),enemy('c',260)]); attack(s); assert(s.combatSystem.hits.some(h=>h.e.id==='b'),'retargets after first target dies'); }
{ const dead=enemy('dead',0,0,0); dead.isDefeated=true; const live=enemy('live',40); const {s}=make(1,[dead,live]); attack(s,{enemy:dead,targets:[dead]}); assert.equal(s.combatSystem.hits[0].e.id,'live'); }
{ const dead=enemy('dead',0,0,0); dead.isDefeated=true; const {s}=make(1,[dead]); attack(s,{enemy:dead,targets:[dead]}); assert.equal(s.combatSystem.hits.length,0); }
{ const {s,sys}=make(9); const before=s.eventBus.count(CombatEvents.PLAYER_ATTACK_RESOLVED); assert(before>=1); sys.removeSkillRuntime('lightning_tribulation'); assert.equal(s.eventBus.count(CombatEvents.PLAYER_ATTACK_RESOLVED),before-1); assert.doesNotThrow(()=>sys.removeSkillRuntime('lightning_tribulation')); attack(s); assert.equal(s.combatSystem.hits.length,0); sys.addOrLevel('lightning_tribulation'); assert.equal(s.eventBus.count(CombatEvents.PLAYER_ATTACK_RESOLVED),before); attack(s); assert.equal(s.combatSystem.hits.length,3); sys.reset(); assert.equal(s.eventBus.count(CombatEvents.PLAYER_ATTACK_RESOLVED),0); }
{ const source=fs.readFileSync('src/skills/handlers/WeaponCoreSkills.js','utf8'); assert.match(source,/PLAYER_ATTACK_RESOLVED/); assert.doesNotMatch(source,/fromLightningTribulation[^]*emit\(CombatEvents\.PLAYER_HIT/); assert.doesNotMatch(source,/requiredSkillId\s*:/); assert.doesNotMatch(source,/noDeathExplosion\s*:/); assert.doesNotMatch(source,/noPoisonSpread\s*:/); ['noSwordTrigger','noHeavenSplit','noInstantStep'].forEach(x=>assert(source.includes(x))); }
{ const mythics=Object.values(SKILLS).filter(s=>s.rarity==='MYTHIC'||s.ultimateSkill); assert.equal(mythics.length,9); assert(mythics.some(s=>s.id==='lightning_tribulation')); assert.equal(Object.values(SKILLS).filter(s=>s.tags?.includes(TAGS.BUILD_WEAPON)).length,3); ['lightning_enchant','lightning_mark','lightning_tribulation'].forEach(id=>assert(SKILLS[id])); }
console.log('validate-01085-lightning-tribulation: ok');
