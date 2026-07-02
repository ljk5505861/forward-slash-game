import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS } from '../src/config/tags.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import CombatSystem from '../src/systems/CombatSystem.js';

class Bus{constructor(){this.map=new Map();this.events=[]}on(e,f){const a=this.map.get(e)||[];a.push(f);this.map.set(e,a);return()=>this.off(e,f)}off(e,f){this.map.set(e,(this.map.get(e)||[]).filter(x=>x!==f))}emit(e,p={}){this.events.push({type:e,payload:p});[...(this.map.get(e)||[])].forEach(f=>f(p))}count(e){return (this.map.get(e)||[]).length}}
const node=(x=0,y=0,text='')=>({x,y,text,destroyed:false,children:[],setDepth(){return this},setStrokeStyle(){return this},setOrigin(){return this},setText(t){this.text=t;return this},setPosition(x,y){this.x=x;this.y=y;return this},setVisible(v){this.visible=v;return this},add(o){this.children.push(o);return this},destroy(){this.destroyed=true}});
function scene(){ const bus=new Bus(), tweens=[]; const s={now:0,player:{x:0,y:0},playerData:{hp:100,skills:[]},enemies:[],eventBus:bus,isGameplayPaused(){return false},getGameplayTime(){return this.now},floatText(){},hud:{update(){}},skillBar:{update(){}},events:{on(){},once(){}},add:{container:(x,y)=>node(x,y),circle:(x,y)=>node(x,y),text:(x,y,t)=>node(x,y,t),rectangle:(x,y)=>node(x,y),graphics:()=>node()},tweens:{add(c){tweens.push(c); const t={stop(){},remove(){}}; return t},killTweensOf(){}},targeting:{valid:e=>!!e&&!e.isDefeated&&(e.hp??1)>0,isEnemyFullyInsideViewport:()=>true,all(){return s.enemies.filter(this.valid)}},combatSystem:{hits:[],damageEnemy(e,a,m){ if(!s.targeting.valid(e)) return false; this.hits.push({enemy:e,amount:a,meta:m}); e.hp=Math.max(0,e.hp-a); return a>0; }}}; s.skillSystem=new SkillSystem(s); return s; }
const enemy=(x=0,y=0,hp=100)=>({x,y,hp,isDefeated:false});
const hit=(s,e,actual=10,tags=[TAGS.NORMAL_ATTACK])=>s.eventBus.emit(CombatEvents.PLAYER_HIT,{source:'attack',enemy:e,actualDamage:actual,damage:999,tags});
const st=e=>e[Object.getOwnPropertySymbols(e).find(sym=>String(sym).includes('lightningMarkState'))];

assert.equal(GAME_VERSION,'0.10.94');
assert.equal(JSON.parse(fs.readFileSync('package.json','utf8')).version,'0.10.94');
assert.equal(Object.keys(SKILLS).length,35);
const cfg=SKILLS.lightning_mark;
assert.equal(cfg.name,'雷印'); assert.equal(cfg.rarity,'RARE'); assert.equal(cfg.passive,true); assert.equal(cfg.maxLevel,9); assert.equal(cfg.handler,'lightning_mark'); assert.equal(cfg.requiredSkillId,undefined);
for (const tag of [TAGS.MAGIC,TAGS.LIGHTNING,TAGS.NORMAL_ATTACK,TAGS.BUILD_WEAPON]) assert(cfg.tags.includes(tag));
assert.deepEqual(cfg.levels.map(x=>x.stackThreshold),[5,5,4,4,4,4,4,4,3]);
assert.deepEqual(cfg.levels.map(x=>x.explosionRatio),[0.25,0.28,0.32,0.36,0.40,0.45,0.50,0.56,0.65]);
assert.deepEqual(cfg.levels.map(x=>x.explosionRadius),[90,96,108,114,120,132,140,148,160]);
assert.deepEqual(cfg.levels.map(x=>x.spreadMarks),[0,0,0,0,0,1,1,1,2]);
assert.deepEqual(SKILLS.lightning_enchant.levels.map(x=>x.damageRatio),[0.12,0.14,0.18,0.20,0.22,0.24,0.27,0.30,0.34]);

let s=scene(), a=enemy(); s.enemies=[a]; hit(s,a); assert.equal(st(a),undefined); assert.equal(s.combatSystem.hits.length,0);
s.skillSystem.addOrLevel('lightning_mark'); for(let i=0;i<4;i++) hit(s,a,[20,22,18,25][i]); assert.equal(st(a).stacks,4); assert.equal(st(a).storedActualDamage,85); assert.equal(s.combatSystem.hits.length,0); hit(s,a,15); assert.equal(s.combatSystem.hits.length,1); assert.equal(s.combatSystem.hits[0].amount,25); assert.equal(st(a),undefined); const lightningMarkMeta=s.combatSystem.hits[0].meta; assert.equal(lightningMarkMeta.damageAlreadyResolved,true); assert.equal(lightningMarkMeta.crit,false); assert(!lightningMarkMeta.tags.includes(TAGS.NORMAL_ATTACK)); assert.equal(lightningMarkMeta.noDeathExplosion,undefined); assert.equal(lightningMarkMeta.noPoisonSpread,undefined);
hit(s,a,10); assert.equal(st(a).stacks,1,'restarts after explosion');

function deathScene({burn=false,poison=null}={}){ const bus=new Bus(), adds=[]; let nearby=[]; const s={playerData:{hp:100},enemies:nearby,eventBus:bus,targeting:{all(){return nearby}},statusEffects:{has(target,type){return burn&&type==='BURN'},getEffects(target,type){return type==='POISON'&&poison?[poison]:[]},add(type,target,config){adds.push({type,target,config})}},floatText(){},professionSystem:{getDamageMultiplier(){return 1}},artifactSystem:{highHpDamageMultiplier(){return 1}},tweens:{add(){return{}}},balance:{enemyFadeMs:1}}; const combat=new CombatSystem(s); const damageCalls=[]; combat.damageEnemy=(target,amount,meta={})=>{ damageCalls.push({target,amount,meta}); return true; }; return {s,combat,bus,adds,damageCalls,setNearby(list){nearby=list; s.enemies=nearby;}}; }
const lmMeta=lightningMarkMeta;
const burned={x:0,y:0}, burnNeighbor={x:94,y:0,hp:100}; let death=deathScene({burn:true}); death.setNearby([burnNeighbor]); death.combat.handleDeathReactions(burned,lmMeta); assert.equal(death.damageCalls.length,1,'lightning mark meta does not block burn death burst'); assert.equal(death.damageCalls[0].meta.source,'burn_burst'); assert.equal(death.bus.count(CombatEvents.PLAYER_HIT),0,'burn death reaction does not emit PLAYER_HIT');
const poisonEffect={canSpread:true,spreadRadius:105,spreadDurationMs:2200,spreadDamage:5,damageMultiplier:1,baseDamageMultiplierWithoutProfession:1,professionMultiplier:1,professionApplied:true}; const poisoned={x:0,y:0}, poisonNeighbor={x:100,y:0,hp:100}; death=deathScene({poison:poisonEffect}); death.setNearby([poisonNeighbor]); death.combat.handleDeathReactions(poisoned,lmMeta); assert.equal(death.adds.length,1,'lightning mark meta does not block poison spread'); assert.equal(death.adds[0].type,'POISON'); assert.equal(death.adds[0].config.sourceId,'poison_spread'); assert.equal(death.adds[0].config.canSpread,false); assert.equal(death.bus.count(CombatEvents.PLAYER_HIT),0,'poison death reaction does not emit PLAYER_HIT');
const blocked={x:0,y:0}, blockedNeighbor={x:50,y:0,hp:100}; death=deathScene({burn:true,poison:poisonEffect}); death.setNearby([blockedNeighbor]); death.combat.handleDeathReactions(blocked,{noDeathExplosion:true,noPoisonSpread:true}); assert.equal(death.damageCalls.length,0,'control meta still blocks burn death burst'); assert.equal(death.adds.length,0,'control meta still blocks poison spread');
const weaponCoreSource=fs.readFileSync('src/skills/handlers/WeaponCoreSkills.js','utf8'); const markMetaSource=weaponCoreSource.slice(weaponCoreSource.indexOf('const markMeta='),weaponCoreSource.indexOf('function getMarkState')); assert(!markMetaSource.includes('noDeathExplosion'), 'markMeta source does not include noDeathExplosion'); assert(!markMetaSource.includes('noPoisonSpread'), 'markMeta source does not include noPoisonSpread');


s=scene(); a=enemy(); s.enemies=[a]; s.skillSystem.addOrLevel('lightning_mark'); hit(s,a,10,['skill']); hit(s,a,0); s.eventBus.emit(CombatEvents.PLAYER_HIT,{source:'skill',enemy:a,actualDamage:10,tags:[TAGS.NORMAL_ATTACK]}); assert.equal(st(a),undefined,'source isolation');

s=scene(); a=enemy(0,0,1000); const b=enemy(90,0,1000), c=enemy(91,0,1000); s.enemies=[a,b,c]; s.skillSystem.addOrLevel('lightning_mark'); [20,20,20,20,20].forEach(d=>hit(s,a,d)); assert.deepEqual(s.combatSystem.hits.map(h=>h.enemy),[a,b]); assert.equal(s.combatSystem.hits.every(h=>h.amount===25),true);

s=scene(); a=enemy(0,0,1000); const d=enemy(100,0,1000); s.enemies=[a,d]; s.skillSystem.addOrLevel('lightning_mark'); for(let i=1;i<6;i++) s.skillSystem.addOrLevel('lightning_mark'); [10,10,10,10].forEach(x=>hit(s,a,x)); assert.equal(st(d).stacks,1); assert.equal(st(d).storedActualDamage,0); assert.equal(s.combatSystem.hits.length,2);

s=scene(); a=enemy(0,0,1000); const e2=enemy(159,0,1000), e3=enemy(161,0,1000); s.enemies=[a,e2,e3]; s.skillSystem.addOrLevel('lightning_mark'); for(let i=1;i<9;i++) s.skillSystem.addOrLevel('lightning_mark'); [10,10,10].forEach(x=>hit(s,a,x)); assert.deepEqual(s.combatSystem.hits.map(h=>h.enemy),[a,e2]); assert.equal(st(e2).stacks,2); hit(s,e2,10); assert.equal(s.combatSystem.hits.length,5,'next real weapon hit triggers propagated mark once without recursive spread explosion');

s=scene(); a=enemy(0,0,1000); s.enemies=[a]; s.skillSystem.addOrLevel('lightning_enchant'); s.skillSystem.addOrLevel('lightning_mark'); hit(s,a,1); const before=s.skillSystem.passiveState.lightningEnchant.phaseEndsAt; hit(s,a,10); assert.equal(st(a).stacks,4); assert.equal(s.skillSystem.passiveState.lightningEnchant.phaseEndsAt,before); s.now=9000; hit(s,a,10); assert.equal(st(a),undefined,'cooldown adds one and triggers pending 5-stack explosion');

s=scene(); a=enemy(5,6,0); a.isDefeated=true; s.enemies=[]; s.skillSystem.addOrLevel('lightning_mark'); const symState=st(a)??null; hit(s,a,10); assert.equal(st(a),undefined); // no pre-state no leak
// death order with preexisting state
s=scene(); a=enemy(10,20,1000); const near=enemy(20,20,1000); s.enemies=[near]; s.skillSystem.addOrLevel('lightning_mark'); s.enemies=[a,near]; [10,10,10,10].forEach(x=>hit(s,a,x)); s.enemies=[near]; a.isDefeated=true; s.eventBus.emit(CombatEvents.ENEMY_KILLED,{enemy:a}); hit(s,a,10); assert.equal(s.combatSystem.hits.length,1); assert.equal(s.combatSystem.hits[0].enemy,near); assert.equal(st(a),undefined);

const hitListeners=s.eventBus.count(CombatEvents.PLAYER_HIT), killListeners=s.eventBus.count(CombatEvents.ENEMY_KILLED); assert(hitListeners>=1); assert(killListeners>=1); s.skillSystem.removeSkillRuntime('lightning_mark'); assert.equal(s.eventBus.count(CombatEvents.PLAYER_HIT),hitListeners-1); assert.equal(s.eventBus.count(CombatEvents.ENEMY_KILLED),killListeners-1); assert.doesNotThrow(()=>s.skillSystem.removeSkillRuntime('lightning_mark'));
assert(Object.values(SKILLS).filter(x=>x.rarity==='RARE').length>=8); assert(Object.values(SKILLS).filter(x=>x.rarity==='MYTHIC'||x.ultimateSkill).length>0); assert(SKILLS.lightning_enchant&&SKILLS.lightning_mark);
console.log('v0.10.94 lightning mark validation passed.');
