import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { CHARGED_SLAM_DAMAGE_RATIOS, CHARGED_SLAM_RADII, CHARGED_SLAM_ATTACKS, getChargedSlamState } from '../src/skills/handlers/ChargedSlamSkill.js';
import { getSkillBarStateText } from '../src/ui/skillBarState.js';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(GAME_VERSION,'0.11.9'); assert.equal(pkg.version,'0.11.9');
const cfg=SKILLS.charged_slam; assert(cfg); assert.equal(cfg.rarity,'FINE'); assert.equal(cfg.passive,true); assert.equal(cfg.targetType,'passive'); assert.equal(cfg.maxLevel,9); assert.equal(cfg.requiredSkillId,undefined);
assert.deepEqual(cfg.levels.map(x=>x.damageRatio),CHARGED_SLAM_DAMAGE_RATIOS); assert.deepEqual(cfg.levels.map(x=>x.radius),CHARGED_SLAM_RADII); assert.deepEqual(cfg.levels.map(x=>x.attacksRequired),CHARGED_SLAM_ATTACKS);
assert.equal(Object.keys(SKILLS).length,45); assert.equal(Object.values(SKILLS).filter(x=>x.rarity==='FINE').length,3); assert.equal(new Set(Object.values(SKILLS).map(x=>x.id)).size,45);
const oldIds=['fireball','healing','poison_cloud','sword_wave','shadow_fist','spirit_wolves','spirit_bird','spirit_slime','fire_seed','burn_burst','solar_flame','sword_sheath','sword_tomb','giant_force','spinning_blade','bloodthirst','last_stand','thorn_armor','guardian_shield','traceless','phantom_step','instant_step','myriad_afterimage','parasitic_gu','poison_chain','poison_king','lightning_enchant','lightning_mark','lightning_tribulation','gravity_crush','gravity_reversal','gravity_orb','black_hole','neutron_star','white_dwarf','super_speed','laser_eyes','freezing_breath','human_god','ninefold_dao','alchemy','sky_covering_palm','soul_destroying_needle','mantra_heavenly_book']; oldIds.forEach(id=>assert(SKILLS[id],`retains ${id}`));

function harness(level=1){let now=0;const listeners=new Map(),enemies=[],hits=[],knocks=[];const node=()=>({destroy(){this.destroyed=true},setStrokeStyle(){return this},setDepth(){return this},setRotation(){return this}});const scene={playerData:{physicalDamageBonuses:{}},eventBus:{on(type,fn){assert.equal(type,CombatEvents.PLAYER_ATTACK_RESOLVED);assert(!listeners.has(type),'one resolved listener');listeners.set(type,fn);return()=>listeners.delete(type)}},getGameplayTime:()=>now,targeting:{all:()=>enemies,valid:e=>!!e&&e.active!==false&&e.hp>0},professionSystem:{getDamageMultiplier:({type})=>{assert.equal(type,'normalAttack');return 1.2}},combatSystem:{damageEnemy(e,n,m){hits.push({e,n,m});e.hp-=n;return true},applyKnockback(e,m){knocks.push({e,m});return true}},add:{ellipse:node,rectangle:node,circle:node},tweens:{add(c){return{stop(){},remove(){},config:c}}}};const system={scene,passiveState:{},passiveUpdaters:[],level,getLevel:()=>system.level,getData:()=>cfg.levels[system.level-1]};const cleanup=SKILL_HANDLERS.charged_slam.bind(system);return{scene,system,enemies,hits,knocks,cleanup,emit:p=>listeners.get(CombatEvents.PLAYER_ATTACK_RESOLVED)?.(p),tick:(ms=0)=>{now+=ms;[...system.passiveUpdaters].forEach(fn=>fn())},listenerCount:()=>listeners.size};}
{
 const h=harness(1),primary={x:100,y:200,hp:999,active:true},near={x:150,y:200,hp:999,active:true};h.enemies.push(primary,near);
 for(let i=0;i<4;i++)h.emit({enemy:primary,targets:[primary,near],baseDamage:101}); assert.equal(h.hits.length,0); assert.deepEqual(getChargedSlamState(h.system),{count:4,required:5,ready:false});
 h.emit({enemy:primary,targets:[primary,near],baseDamage:101}); assert.equal(h.hits.length,2,'multi-target attack counts once and one slam hits area'); assert.equal(h.hits[0].n,97); assert.equal(h.hits[0].m.critResolved,true); assert.equal(h.hits[0].m.crit,false); assert.equal(h.hits[0].m.allowLifeSteal,false); assert.equal(h.hits[0].m.canTriggerArtifacts,false); assert.deepEqual(h.hits[0].m.tags,['physical','area']); assert.equal(h.hits[0].m.damageKind,'chargedSlam'); assert(!h.hits[0].m.tags.includes('normalAttack'));
 h.cleanup(); assert.equal(h.listenerCount(),0); assert.equal(h.system.passiveUpdaters.length,0); assert.equal(h.system.passiveState.chargedSlam,undefined);
}
{
 const h=harness(3),deadPrimary={x:30,y:40,hp:0,active:false},near={x:40,y:40,hp:500,active:true};h.enemies.push(deadPrimary,near);for(let i=0;i<5;i++)h.emit({enemy:i===4?deadPrimary:null,baseDamage:100});assert.equal(h.hits.length,1,'saved dead target position still damages nearby living target');assert.equal(h.knocks.length,1);h.cleanup();
}
{
 const h=harness(9),boss={x:50,y:60,hp:999,isBoss:true,active:true};h.enemies.push(boss);for(let i=0;i<4;i++)h.emit({targets:[boss],baseDamage:100});assert.equal(h.hits[0].n,192);assert.equal(h.knocks.length,0,'boss never moves');h.tick(249);assert.equal(h.hits.length,1);h.tick(1);assert.equal(h.hits[1].n,96);assert.equal(h.hits[1].m.damageKind,'chargedSlamAftershock');assert.equal(h.knocks.length,0);h.cleanup();h.tick(1000);assert.equal(h.hits.length,2,'cleanup clears pending aftershocks');
}
{
 const h=harness(1);for(let i=0;i<5;i++)h.emit({baseDamage:100});assert.equal(getSkillBarStateText({...h.scene,skillSystem:h.system},{id:'charged_slam',level:1},cfg),'重击 就绪');const target={x:0,y:0,hp:500,active:true};h.enemies.push(target);h.emit({enemy:target,baseDamage:100});assert.equal(getSkillBarStateText({...h.scene,skillSystem:h.system},{id:'charged_slam',level:1},cfg),'蓄势 0/5');h.cleanup();
}
{
 const h=harness(1),target={x:0,y:0,hp:999,active:true};h.enemies.push(target);for(let i=0;i<4;i++)h.emit({enemy:target,baseDamage:100});h.system.level=6;h.tick();assert.equal(getChargedSlamState(h.system).ready,true,'level six immediately recognizes existing charge');h.emit({enemy:target,baseDamage:100});assert(h.hits.length>0);h.cleanup();
}
const source=fs.readFileSync('src/skills/handlers/ChargedSlamSkill.js','utf8');assert.equal((source.match(/CombatEvents\.PLAYER_ATTACK_RESOLVED/g)||[]).length,1);assert(!source.includes('PLAYER_HIT'));assert(!/delayedCall|setTimeout|setInterval/.test(source));
console.log('validate-01109-charged-slam: ok');
