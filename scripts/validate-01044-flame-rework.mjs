import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { TUNING } from '../src/config/tuning.js';
import { createPlayerRuntime } from '../src/config/balance.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import StatusEffectSystem, { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import { TAGS } from '../src/config/tags.js';

assert.equal(GAME_VERSION,'0.10.44');
const flameIds=Object.values(SKILLS).filter(s=>s.tags?.includes(TAGS.BUILD_FIRE)).map(s=>s.id).sort();
assert.deepEqual(flameIds,['burn_burst','fire_seed','fireball','solar_flame'].sort(),'fire build exposes exactly four formal skills');
for (const removed of ['flame_spray','wildfire','meteor','eternal_flame_heart']) assert.equal(SKILLS[removed],undefined,`${removed} removed from skill pool`);
for (const skill of Object.values(SKILLS)) assert(!['flame_spray','wildfire','meteor','eternal_flame_heart'].includes(skill.requiredSkillId),`no old requiredSkillId for ${skill.id}`);

const fb=SKILLS.fireball, seed=SKILLS.fire_seed, burst=SKILLS.burn_burst, solar=SKILLS.solar_flame;
assert.equal(fb.maxLevel,9); assert.equal(fb.levels[2].cooldownMs < fb.levels[1].cooldownMs,true); assert.equal(fb.levels[5].shots,2); assert.ok(fb.levels[8].radius>0);
assert.equal(seed.levels[2].splitCount,3); assert.equal(seed.levels[5].maxSplitGeneration,2); assert.equal(seed.levels[8].extraSeedOnBurning,true);
assert.ok(burst.levels[2].radius>burst.levels[1].radius); assert.ok(burst.levels[5].durationMs>burst.levels[4].durationMs); assert.equal(burst.levels[8].retainBurnStacksAfterBurst,1);
assert.equal(solar.passive,true); assert.equal(solar.levels[2].damageBonus,0.3); assert.equal(solar.levels[5].healRatio,0.01); assert.equal(solar.levels[8].suns,2); assert.equal(solar.levels[8].secondarySunDamageMultiplier,0.6);
assert.deepEqual([fb.levels[0].manaCost,seed.manaCost,burst.manaCost,solar.manaCost],[3,5,8,0]);
assert.equal(TUNING.leveling.initialPlayerMana,100); assert.equal(TUNING.leveling.playerManaRegenPerSecond,2); const p=createPlayerRuntime(); assert.equal(p.mana,100); assert.equal(p.maxMana,100);
for (const s of [fb,seed,burst,solar]) { assert(s.tags.includes(TAGS.MAGIC) && s.tags.includes(TAGS.SPELL), `${s.id} is magic/spell`); assert(!s.tags.includes('physical'), `${s.id} not physical`); }
for (const l of [...fb.levels,...seed.levels,...burst.levels,...solar.levels]) if ('maxStacks' in l) assert.equal(l.maxStacks,5);
assert.ok(seed.levels.every(l=>l.maxSplitGeneration>=1 && l.maxSeedsPerCast>=9),'fire seed has generation and per-cast caps');
assert.deepEqual(solar.levels[0].fireSeedBonus,{splitCountBonus:1,maxGenerationBonus:1,speedMultiplier:1.25},'solar fire seed boost defined once');

const scene={playerData:{mana:2,maxMana:100,hp:100,skills:[]},hud:{update(){}},getGameplayTime:()=>0,isGameplayPaused:()=>false,targeting:{nearestAhead:()=>({}),all:()=>[{}],isEnemyFullyInsideViewport:()=>true,valid:()=>true},eventBus:{emit(){},on(){return ()=>{}}},professionSystem:{getDamageMultiplier:()=>1,onActiveSkillCast(){}},artifactSystem:{highHpDamageMultiplier:()=>1},add:{circle(){return {setStrokeStyle(){return this},setDepth(){return this}}}},tweens:{add(){}},player:{x:0,y:0}};
const sys=new SkillSystem(scene); assert.equal(sys.canSpendMana(3),false); sys.cooldowns.set('fireball',0); assert.equal(sys.cooldowns.get('fireball'),0,'insufficient mana does not advance cooldown by helper contract');
scene.playerData.mana=50; assert.equal(sys.spendMana(3),true); assert.equal(scene.playerData.mana,47); sys.recoverMana(2); assert.equal(scene.playerData.mana,49);

const enemy={hp:100,x:0,y:0}; let burstDamage=0; let now=1000; const statusScene={getGameplayTime:()=>now,targeting:{valid:e=>e===enemy,all:()=>[enemy]},eventBus:{emit(){}},combatSystem:{damageEnemy(e,d){burstDamage+=d; e.hp-=d; return true;}},add:{circle(){return {setStrokeStyle(){return this},setDepth(){return this}}}},floatText(){},playerData:{}};
const effects=new StatusEffectSystem(statusScene); effects.add(StatusEffects.BURN,enemy,{sourceId:'test',stacks:5,maxStacks:5,value:1,burnBurstDamage:12,burnBurstRadius:50}); assert.equal(burstDamage,12,'5 burn stacks trigger unified ignite burst'); assert.equal(effects.getStackCount(enemy,StatusEffects.BURN),0);
now=2000; effects.add(StatusEffects.BURN,enemy,{sourceId:'test2',stacks:5,maxStacks:5,value:1,burnBurstDamage:12,burnBurstRadius:50,retainBurnStacksAfterBurst:1}); assert.equal(effects.getStackCount(enemy,StatusEffects.BURN),1,'retain one stack after level 9-style burst');

const core=fs.readFileSync('src/skills/handlers/FlameCoreSkills.js','utf8'); assert.match(core,/triggerIgniteBurst/); assert.doesNotMatch(core,/maxStacks:18/);
console.log('v0.10.44 flame rework validation passed.');
