import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { KINETIC_RELEASE_DAMAGE_RATIOS, KINETIC_RELEASE_THRESHOLDS, KINETIC_RELEASE_RADII, getKineticReleaseState } from '../src/skills/handlers/KineticReleaseSkill.js';
import { getSkillBarStateText } from '../src/ui/skillBarState.js';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(GAME_VERSION,'0.11.12');assert.equal(pkg.version,'0.11.12');
const cfg=SKILLS.kinetic_release;assert(cfg);assert.equal(cfg.rarity,'FINE');assert.equal(cfg.passive,true);assert.equal(cfg.targetType,'passive');assert.equal(cfg.maxLevel,9);assert.equal(cfg.requiredSkillId,undefined);
assert.deepEqual(cfg.levels.map(x=>x.damageRatio),KINETIC_RELEASE_DAMAGE_RATIOS);assert.deepEqual(cfg.levels.map(x=>x.kineticRequired),KINETIC_RELEASE_THRESHOLDS);assert.deepEqual(cfg.levels.map(x=>x.radius),KINETIC_RELEASE_RADII);
assert.equal(Object.keys(SKILLS).length,50);assert.equal(Object.values(SKILLS).filter(x=>x.rarity==='FINE').length,6);assert.equal(new Set(Object.values(SKILLS).map(x=>x.id)).size,50);
const oldIds=Object.keys(SKILLS).filter(id=>id!=='kinetic_release');assert.equal(oldIds.length,49);

function harness(level=1,{damageResult=true}={}){let now=0,paused=false;const listeners=new Map(),enemies=[],hits=[],knocks=[],nodes=[];const node=(kind,...args)=>{const n={kind,args,destroyed:false,destroy(){this.destroyed=true},setStrokeStyle(){return this},setDepth(){return this},setRotation(){return this}};nodes.push(n);return n;};const scene={player:{x:100,y:200},playerData:{hp:100,weaponId:'short_sword',moveSpeedMultiplierBonuses:{}},getGameplayTime:()=>now,isGameplayPaused:()=>paused,eventBus:{on(event,fn){const set=listeners.get(event)||new Set();set.add(fn);listeners.set(event,set);return()=>set.delete(fn)},emit(event,payload){listeners.get(event)?.forEach(fn=>fn(payload))}},targeting:{all:()=>enemies,valid:e=>!!e?.active&&e.hp>0,isEnemyFullyInsideViewport:e=>e.inside!==false},professionSystem:{currentAttackProfile:()=>null,getDamageMultiplier:()=>1.5},combatSystem:{calcNonCritAttackBaseDamage:()=>100,damageEnemy(e,n,m){hits.push({e,n,m});return damageResult},applyKnockback(e,m){knocks.push({e,m})}},add:{circle:(...a)=>node('circle',...a),rectangle:(...a)=>node('rectangle',...a)},tweens:{add(config){const tween={stop(){},remove(){}};return tween}}};const system={scene,level,passiveState:{},passiveUpdaters:[],getLevel:()=>system.level,getData:()=>cfg.levels[system.level-1]};const cleanup=SKILL_HANDLERS.kinetic_release.bind(system);return {scene,system,enemies,hits,knocks,nodes,cleanup,setPaused(value){paused=value},tick(ms=0){now+=ms;system.passiveUpdaters.forEach(fn=>fn())},emitAttack(){scene.eventBus.emit(CombatEvents.PLAYER_ATTACK_RESOLVED,{source:'attackResolved'})},emitDodge(payload={}){scene.eventBus.emit(CombatEvents.PLAYER_DODGED,{enemy:payload.enemy||{},forced:false,directAttack:true,...payload})}};}
{
 const h=harness();h.scene.player.x+=68;h.tick();assert.equal(getKineticReleaseState(h.system).kinetic,68);h.scene.player.x-=20;h.tick();assert.equal(getKineticReleaseState(h.system).kinetic,68);h.setPaused(true);h.scene.player.x+=50;h.tick();assert.equal(getKineticReleaseState(h.system).kinetic,68,'paused coordinate changes do not add kinetic');h.setPaused(false);h.tick();assert.equal(getKineticReleaseState(h.system).kinetic,68,'resume does not backfill paused displacement');h.emitAttack();assert.equal(getKineticReleaseState(h.system).kinetic,103);assert.equal(getSkillBarStateText({...h.scene,skillSystem:h.system},{id:'kinetic_release',level:1},cfg),'动能 25%');h.cleanup();
}
{
 const h=harness();h.emitDodge();assert.equal(getKineticReleaseState(h.system).kinetic,0);h.system.level=6;const enemy={};h.emitDodge({enemy});assert.equal(getKineticReleaseState(h.system).kinetic,120);h.emitDodge({enemy});assert.equal(getKineticReleaseState(h.system).kinetic,120,'same attack dodge is counted once');h.emitDodge({forced:true,enemy:{}});assert.equal(getKineticReleaseState(h.system).kinetic,120);h.cleanup();
}
{
 const h=harness(3),enemy={x:120,y:200,hp:1000,active:true,body:{}};for(let i=0;i<12;i++)h.emitAttack();assert.equal(getKineticReleaseState(h.system).ready,true);h.tick();assert.equal(h.hits.length,0,'ready charge waits without a target');h.enemies.push(enemy);h.tick();assert.equal(h.hits.length,1);assert.equal(h.hits[0].n,Math.round(100*1.1*1.5));assert.deepEqual(h.hits[0].m.tags,['physical','area']);assert.equal(h.hits[0].m.crit,false);assert.equal(h.hits[0].m.allowLifeSteal,false);assert.equal(h.hits[0].m.canTriggerArtifacts,false);assert.equal(h.knocks.length,1);assert.equal(getKineticReleaseState(h.system).kinetic,0);assert.equal(h.nodes.find(n=>n.kind==='circle').args[0],100);h.cleanup();
}
{
 const h=harness(3,{damageResult:false}),enemy={x:100,y:200,hp:1000,active:true,body:{}};h.enemies.push(enemy);for(let i=0;i<12;i++)h.emitAttack();h.tick();assert.equal(h.knocks.length,0);h.cleanup();
}
{
 const h=harness(9),boss={x:100,y:200,hp:1000,active:true,isBoss:true,body:{}};h.enemies.push(boss);h.scene.playerData.moveSpeedMultiplierBonuses={a:.5,b:-.2};for(let i=0;i<8;i++)h.emitAttack();h.tick();assert.equal(h.hits[0].n,Math.round(Math.round(100*2.15*1.3)*1.5));assert.equal(h.knocks.length,0);h.tick(699);for(let i=0;i<8;i++)h.emitAttack();h.tick();assert.equal(h.hits.length,1,'minimum release interval is 700ms');h.tick(1);assert.equal(h.hits.length,2);const runtime=h.system.passiveState.kineticRelease,created=[...h.nodes];h.cleanup();assert.equal(h.system.passiveState.kineticRelease,undefined);assert.equal(h.system.passiveUpdaters.length,0);assert.equal(runtime.visuals.size,0);assert(created.every(n=>n.destroyed));h.emitAttack();assert.equal(getKineticReleaseState(h.system),null);
}

{
 const cases=[{bonuses:{a:-.2,b:.1},multiplier:1,label:'negative net movement gives no bonus'},{bonuses:{a:1,b:-.1},multiplier:1.75,label:'movement bonus remains capped at 75%'}];for(const test of cases){const h=harness(9),enemy={x:100,y:200,hp:1000,active:true};h.enemies.push(enemy);h.scene.playerData.moveSpeedMultiplierBonuses=test.bonuses;for(let i=0;i<8;i++)h.emitAttack();h.tick();assert.equal(h.hits[0].n,Math.round(Math.round(100*2.15*test.multiplier)*1.5),test.label);h.cleanup();}
}
{
 const h=harness(1);h.system.passiveState.kineticRelease.kinetic=300;h.system.level=9;h.tick();assert.equal(getKineticReleaseState(h.system).ready,true,'upgrade immediately applies lower threshold');assert.equal(getSkillBarStateText({...h.scene,skillSystem:h.system},{id:'kinetic_release',level:9},cfg),'动能 就绪');h.cleanup();
}
const source=fs.readFileSync('src/skills/handlers/KineticReleaseSkill.js','utf8');assert.equal((source.match(/CombatEvents\.PLAYER_ATTACK_RESOLVED/g)||[]).length,1);assert.equal((source.match(/CombatEvents\.PLAYER_DODGED/g)||[]).length,1);assert(!source.includes('MovementSystem'));assert(!source.includes('PLAYER_ATTACK,{'));
console.log('validate-01110-kinetic-release: ok');
