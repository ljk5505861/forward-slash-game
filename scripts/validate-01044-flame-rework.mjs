import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { TUNING } from '../src/config/tuning.js';
import { createPlayerRuntime } from '../src/config/balance.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import StatusEffectSystem, { StatusEffects } from '../src/systems/StatusEffectSystem.js';
import { TAGS } from '../src/config/tags.js';

assert.equal(GAME_VERSION,'0.11.7');
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
assert.equal(TUNING.leveling.initialPlayerMana,100); assert.equal(TUNING.leveling.playerManaRegenPerSecond,2); assert.equal(TUNING.leveling.playerManaPerLevel,5); const p=createPlayerRuntime(); assert.equal(p.mana,100); assert.equal(p.maxMana,100);
for (const s of [fb,seed,burst,solar]) { assert(s.tags.includes(TAGS.MAGIC) && s.tags.includes(TAGS.SPELL), `${s.id} is magic/spell`); assert(!s.tags.includes('physical'), `${s.id} not physical`); }
for (const l of [...fb.levels,...seed.levels,...burst.levels,...solar.levels]) if ('maxStacks' in l) assert.equal(l.maxStacks,5);
assert.ok(seed.levels.every(l=>l.maxSplitGeneration>=1 && l.maxSeedsPerCast>=9),'fire seed has generation and per-cast caps');
assert.deepEqual(solar.levels[0].fireSeedBonus,{splitCountBonus:1,maxGenerationBonus:1,speedMultiplier:1.25},'solar fire seed boost defined once');

const statusHarness=()=>{ let now=1000, burstDamage=0, texts=0, destroyed=0, tweenCount=0; const enemy={hp:100,x:0,y:0}; const scene={getGameplayTime:()=>now,targeting:{valid:e=>e===enemy,all:()=>[enemy]},eventBus:{emit(){}},combatSystem:{damageEnemy(e,d){burstDamage+=d; e.hp-=d; return true;}},add:{circle(){ return {destroy(){destroyed++}, setStrokeStyle(){return this}, setDepth(){return this}};}},tweens:{add(cfg){ tweenCount++; cfg.onComplete?.(); }},floatText(){texts++;},playerData:{}}; return {scene,enemy,effects:new StatusEffectSystem(scene),get now(){return now},set now(v){now=v},get burstDamage(){return burstDamage},get texts(){return texts},get destroyed(){return destroyed},get tweenCount(){return tweenCount}}; };
let h=statusHarness(); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'fireball',stacks:5,maxStacks:5,value:1}); assert.equal(h.effects.getStackCount(h.enemy,StatusEffects.BURN),5,'plain fireball burn holds at five stacks'); assert.equal(h.burstDamage,0); assert.equal(h.texts,0);
h=statusHarness(); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'fire_seed',stacks:5,maxStacks:5,value:1}); assert.equal(h.effects.getStackCount(h.enemy,StatusEffects.BURN),5,'plain fire seed burn holds at five stacks'); assert.equal(h.burstDamage,0);
h=statusHarness(); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'zero',stacks:5,maxStacks:5,value:1,igniteBurstEnabled:true,burnBurstDamage:0}); assert.equal(h.effects.getStackCount(h.enemy,StatusEffects.BURN),5,'zero-damage ignite burst does not clear'); assert.equal(h.texts,0);
h=statusHarness(); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'burn_burst_zone',stacks:5,maxStacks:5,value:1,igniteBurstEnabled:true,burnBurstDamage:12,burnBurstRadius:50}); assert.equal(h.burstDamage,12,'burn burst zone triggers ignite burst'); assert.equal(h.effects.getStackCount(h.enemy,StatusEffects.BURN),0); assert.equal(h.destroyed,1,'ignite burst visual is destroyed after tween'); assert.equal(h.tweenCount,1);
h=statusHarness(); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'burn_burst_zone_l9',stacks:5,maxStacks:5,value:1,igniteBurstEnabled:true,burnBurstDamage:12,burnBurstRadius:50,retainBurnStacksAfterBurst:1}); assert.equal(h.effects.getStackCount(h.enemy,StatusEffects.BURN),1,'level 9 burn burst retains one stack');
h=statusHarness(); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'solar_flame',stacks:5,maxStacks:5,value:1,igniteBurstEnabled:true,burnBurstDamage:10,burnBurstRadius:50}); assert.equal(h.burstDamage,10,'solar burn triggers ignite burst');
h=statusHarness(); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'fireball',stacks:4,maxStacks:5,value:1}); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'solar_flame',stacks:1,maxStacks:5,value:1,igniteBurstEnabled:true,burnBurstDamage:9,burnBurstRadius:50}); assert.equal(h.burstDamage,9,'fireball four plus solar one triggers solar ignite burst'); assert.equal(h.effects.getStackCount(h.enemy,StatusEffects.BURN),0,'ignite burst clears all burn sources');
h=statusHarness(); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'fire_seed',stacks:3,maxStacks:5,value:1}); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'burn_burst_zone',stacks:2,maxStacks:5,value:1,igniteBurstEnabled:true,burnBurstDamage:11,burnBurstRadius:50}); assert.equal(h.burstDamage,11,'fire seed three plus burn zone two triggers ignite burst'); assert.equal(h.effects.getStackCount(h.enemy,StatusEffects.BURN),0);
h=statusHarness(); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'fireball',stacks:3,maxStacks:5,value:1}); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'fire_seed',stacks:3,maxStacks:5,value:1}); assert.equal(h.effects.getStackCount(h.enemy,StatusEffects.BURN),5,'mixed plain burn sources are capped at five total stacks'); assert.equal(h.burstDamage,0,'plain mixed burn cap does not ignite');
h=statusHarness(); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'fireball',stacks:4,maxStacks:5,value:1}); h.effects.add(StatusEffects.BURN,h.enemy,{sourceId:'burn_burst_zone_l9',stacks:1,maxStacks:5,value:2,intervalMs:600,durationMs:3000,igniteBurstEnabled:true,burnBurstDamage:12,burnBurstRadius:50,retainBurnStacksAfterBurst:1,tags:[TAGS.MAGIC,TAGS.SPELL,TAGS.FIRE,TAGS.DOT]}); assert.equal(h.effects.getStackCount(h.enemy,StatusEffects.BURN),1,'level 9 mixed-source ignite leaves exactly one unified burn stack'); assert.equal(h.effects.getEffects(h.enemy,StatusEffects.BURN).length,1,'level 9 mixed-source ignite leaves only one burn effect');

const fireballPrimary={hp:200,x:100,y:100}, splash={hp:200,x:130,y:100}; let primaryBurnAdds=0, splashBurnAdds=0; const castScene={playerData:{mana:100,maxMana:100,hp:100,skills:[]},player:{x:0,y:100},hud:{update(){}},getGameplayTime:()=>1000,isGameplayPaused:()=>false,eventBus:{emit(){},on(){return ()=>{}}},professionSystem:{getDamageMultiplier:()=>1,onActiveSkillCast(){},onDirectHit(){}},artifactSystem:{highHpDamageMultiplier:()=>1},targeting:{all:()=>[fireballPrimary,splash],nearestAhead:()=>fireballPrimary,isEnemyFullyInsideViewport:()=>true,valid:()=>true},combatSystem:{damageEnemy(e,d){e.hp-=d; return true;}},statusEffects:{add(type,target){ if(target===fireballPrimary) primaryBurnAdds++; if(target===splash) splashBurnAdds++; }, getStackCount:()=>0},add:{circle(){return {destroy(){},setStrokeStyle(){return this},setDepth(){return this}}}},tweens:{add(cfg){cfg.onComplete?.();}}};
const sys=new SkillSystem(castScene); sys.castFireball(fb,fb.levels[8],9,{damageMultiplier:1,baseDamageMultiplierWithoutProfession:1,professionMultiplier:1,castId:77}); assert.equal(primaryBurnAdds,1,'level 9 fireball primary gets only one burn stack per projectile'); assert.equal(splashBurnAdds,1,'level 9 fireball splash applies burn to nearby enemy');
assert.equal(sys.canSpendMana(101),false); assert.equal(sys.spendMana(3),true); assert.equal(castScene.playerData.mana,97); sys.recoverMana(2); assert.equal(castScene.playerData.mana,99);

const core=fs.readFileSync('src/skills/handlers/FlameCoreSkills.js','utf8'); assert.match(core,/igniteBurstEnabled:true/); assert.doesNotMatch(core,/maxStacks:18/);
console.log('v0.10.60 flame rework validation passed.');
