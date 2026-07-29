import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { CHARGED_SLAM_DAMAGE_RATIOS, CHARGED_SLAM_RADII, CHARGED_SLAM_ATTACKS, getChargedSlamState } from '../src/skills/handlers/ChargedSlamSkill.js';
import { getSkillBarStateText } from '../src/ui/skillBarState.js';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(GAME_VERSION,'0.11.12'); assert.equal(pkg.version,'0.11.12');
const cfg=SKILLS.charged_slam; assert(cfg); assert.equal(cfg.rarity,'FINE'); assert.equal(cfg.passive,true); assert.equal(cfg.targetType,'passive'); assert.equal(cfg.maxLevel,9); assert.equal(cfg.requiredSkillId,undefined);
assert.deepEqual(cfg.levels.map(x=>x.damageRatio),CHARGED_SLAM_DAMAGE_RATIOS); assert.deepEqual(cfg.levels.map(x=>x.radius),CHARGED_SLAM_RADII); assert.deepEqual(cfg.levels.map(x=>x.attacksRequired),CHARGED_SLAM_ATTACKS);
assert.equal(Object.keys(SKILLS).length,50); assert.equal(Object.values(SKILLS).filter(x=>x.rarity==='FINE').length,6); assert.equal(new Set(Object.values(SKILLS).map(x=>x.id)).size,50);
const oldIds=['fireball','healing','poison_cloud','sword_wave','shadow_fist','spirit_wolves','spirit_bird','spirit_slime','fire_seed','burn_burst','solar_flame','sword_sheath','sword_tomb','giant_force','spinning_blade','bloodthirst','last_stand','thorn_armor','guardian_shield','traceless','phantom_step','instant_step','myriad_afterimage','parasitic_gu','poison_chain','poison_king','lightning_enchant','lightning_mark','lightning_tribulation','gravity_crush','gravity_reversal','gravity_orb','black_hole','neutron_star','white_dwarf','super_speed','laser_eyes','freezing_breath','human_god','ninefold_dao','alchemy','sky_covering_palm','soul_destroying_needle','mantra_heavenly_book']; oldIds.forEach(id=>assert(SKILLS[id],`retains ${id}`));

function harness(level=1,{dataOverride=null,damageResult=true}={}){
 let now=0;
 const listeners=new Map(),enemies=[],hits=[],knocks=[],nodes=[];
 const node=(kind,...args)=>{const value={kind,args,destroyed:false,destroy(){this.destroyed=true},setStrokeStyle(){return this},setDepth(){return this},setRotation(){return this}};nodes.push(value);return value;};
 const scene={
  playerData:{physicalDamageBonuses:{}},
  eventBus:{on(type,fn){assert.equal(type,CombatEvents.PLAYER_ATTACK_RESOLVED);assert(!listeners.has(type),'one resolved listener');listeners.set(type,fn);return()=>listeners.delete(type)}},
  getGameplayTime:()=>now,
  targeting:{all:()=>enemies,valid:e=>!!e&&e.active!==false&&e.hp>0},
  professionSystem:{getDamageMultiplier:({type})=>{assert.equal(type,'normalAttack');return 1.2}},
  combatSystem:{damageEnemy(e,n,m){hits.push({e,n,m});if(!damageResult)return false;e.hp-=n;return n>0},applyKnockback(e,m){knocks.push({e,m});return true}},
  add:{ellipse:(...args)=>node('ellipse',...args),rectangle:(...args)=>node('rectangle',...args),circle:(...args)=>node('circle',...args)},
  tweens:{add(c){return{stop(){},remove(){},config:c}}}
 };
 const system={scene,passiveState:{},passiveUpdaters:[],level,getLevel:()=>system.level,getData:()=>dataOverride||cfg.levels[system.level-1]};
 const cleanup=SKILL_HANDLERS.charged_slam.bind(system);
 return{scene,system,enemies,hits,knocks,nodes,cleanup,emit:p=>listeners.get(CombatEvents.PLAYER_ATTACK_RESOLVED)?.(p),tick:(ms=0)=>{now+=ms;[...system.passiveUpdaters].forEach(fn=>fn())},listenerCount:()=>listeners.size};
}
const charge=(h,count,target,baseDamage=100)=>{for(let i=0;i<count;i++)h.emit({enemy:target,targets:target?[target]:[],baseDamage});};
{
 const h=harness(1),primary={x:100,y:200,hp:999,active:true},near={x:150,y:200,hp:999,active:true};h.enemies.push(primary,near);
 charge(h,4,primary,101);assert.equal(h.hits.length,0);assert.deepEqual(getChargedSlamState(h.system),{count:4,required:5,ready:false});
 h.emit({enemy:primary,targets:[primary,near],baseDamage:101});assert.equal(h.hits.length,2,'multi-target attack counts once and one slam hits area');assert.equal(h.hits[0].n,97);assert.equal(h.hits[0].m.critResolved,true);assert.equal(h.hits[0].m.crit,false);assert.equal(h.hits[0].m.allowLifeSteal,false);assert.equal(h.hits[0].m.canTriggerArtifacts,false);assert.deepEqual(h.hits[0].m.tags,['physical','area']);assert.equal(h.hits[0].m.damageKind,'chargedSlam');assert(!h.hits[0].m.tags.includes('normalAttack'));
 h.cleanup();assert.equal(h.listenerCount(),0);assert.equal(h.system.passiveUpdaters.length,0);assert.equal(h.system.passiveState.chargedSlam,undefined);
}
{
 const h=harness(3),deadPrimary={x:30,y:40,hp:0,active:false},near={x:40,y:40,hp:500,active:true};h.enemies.push(deadPrimary,near);charge(h,4,null);h.emit({enemy:deadPrimary,baseDamage:100});assert.equal(h.hits.length,1,'saved dead target position still damages nearby living target');assert.equal(h.knocks.length,1);h.cleanup();
}
{
 const h=harness(3,{damageResult:false}),target={x:20,y:20,hp:500,active:true};h.enemies.push(target);charge(h,5,target);assert.equal(h.hits.length,1);assert.equal(h.knocks.length,0,'rejected or zero damage never knocks back');h.cleanup();
}
{
 const h=harness(9),boss={x:50,y:60,hp:999,isBoss:true,active:true};h.enemies.push(boss);charge(h,4,boss);assert.equal(h.hits[0].n,192);assert.equal(h.knocks.length,0,'boss never moves');h.cleanup();
}
{
 const h=harness(9),center={x:100,y:100,hp:999,active:true},inside={x:232,y:100,hp:999,active:true},outside={x:234,y:100,hp:999,active:true};h.enemies.push(center,inside,outside);charge(h,4,center);const mainRing=h.nodes.find(n=>n.kind==='ellipse');h.tick(249);assert.equal(h.hits.length,3);h.tick(1);const afterHits=h.hits.filter(x=>x.m.damageKind==='chargedSlamAftershock');assert.deepEqual(afterHits.map(x=>x.e),[center,inside],'aftershock radius is exactly 70% of main radius');assert.equal(afterHits[0].n,96,'aftershock base damage is 50% of main');const rings=h.nodes.filter(n=>n.kind==='ellipse');assert.equal(rings.length,2);assert.equal(rings[1].args[2]/mainRing.args[2],.7,'aftershock visual radius is scaled exactly once');h.cleanup();
}
{
 const custom={...cfg.levels[8],knockback:23,aftershockDelayMs:333,aftershockDamageRatio:.25,aftershockRadiusRatio:.6};const h=harness(9,{dataOverride:custom}),center={x:0,y:0,hp:999,active:true},edge={x:113,y:0,hp:999,active:true},outside={x:115,y:0,hp:999,active:true};h.enemies.push(center,edge,outside);charge(h,4,center);assert.equal(h.knocks[0].m.knockback,23);h.tick(332);assert.equal(h.hits.filter(x=>x.m.damageKind==='chargedSlamAftershock').length,0);h.tick(1);const after=h.hits.filter(x=>x.m.damageKind==='chargedSlamAftershock');assert.deepEqual(after.map(x=>x.e),[center,edge]);assert.equal(after[0].n,48,'runtime reads configured aftershock damage ratio');h.cleanup();
}
{
 const h=harness(9),target={x:0,y:0,hp:999,active:true};h.enemies.push(target);charge(h,4,target);const runtime=h.system.passiveState.chargedSlam;assert.equal(runtime.pending.length,1);assert(runtime.visuals.size>0);const created=[...h.nodes];h.cleanup();assert.equal(runtime.pending.length,0);assert.equal(runtime.visuals.size,0);assert(created.every(n=>n.destroyed),'unload destroys every active visual');h.tick(1000);assert.equal(h.hits.length,1,'unload cancels pending aftershock');
}
{
 const h=harness(1);charge(h,5,null);assert.equal(getSkillBarStateText({...h.scene,skillSystem:h.system},{id:'charged_slam',level:1},cfg),'重击 就绪');const target={x:0,y:0,hp:500,active:true};h.enemies.push(target);h.emit({enemy:target,baseDamage:100});assert.equal(getSkillBarStateText({...h.scene,skillSystem:h.system},{id:'charged_slam',level:1},cfg),'蓄势 0/5');h.cleanup();
}
{
 const h=harness(1),target={x:0,y:0,hp:999,active:true};h.enemies.push(target);charge(h,4,target);h.system.level=6;h.tick();assert.equal(getChargedSlamState(h.system).ready,true,'level six immediately recognizes existing charge');h.emit({enemy:target,baseDamage:100});assert(h.hits.length>0);h.cleanup();
}
const source=fs.readFileSync('src/skills/handlers/ChargedSlamSkill.js','utf8');assert.equal((source.match(/CombatEvents\.PLAYER_ATTACK_RESOLVED/g)||[]).length,1);assert(!source.includes('PLAYER_HIT'));assert(!/delayedCall|setTimeout|setInterval/.test(source));
console.log('validate-01109-charged-slam: ok');
