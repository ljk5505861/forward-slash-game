import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import { createPlayerRuntime, getEffectiveAttack, getEffectiveDefense, getEffectiveDamageReduction, getTotalStrength } from '../src/config/balance.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS } from '../src/config/tags.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { getHumanGodActualStats, getHumanGodSolarMultiplier } from '../src/skills/handlers/HumanGodSkill.js';
import { getSkillDetailData } from '../src/ui/skillDetailContent.js';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(GAME_VERSION,'0.11.13'); assert.equal(pkg.version,'0.11.13'); assert.equal(Object.keys(SKILLS).length,50);
const cfg=SKILLS.human_god;
assert(cfg); assert.equal(cfg.name,'人间之神'); assert.equal(cfg.rarity,'LEGENDARY'); assert.equal(cfg.passive,true); assert.equal(cfg.ultimateSkill,true); assert.equal(cfg.maxLevel,9); assert(cfg.tags.includes(TAGS.SUPERPOWER)); assert(cfg.tags.includes(TAGS.BUILD_SUPERHERO)); assert.equal(cfg.handler,'human_god'); assert(SKILL_HANDLERS.human_god);
const expected={strength:[4,5,7,9,11,14,16,18,22],defense:[3,4,6,7,9,11,13,15,18],maxHpBonus:[30,40,60,75,90,115,130,145,180],moveSpeedBonus:[.03,.04,.05,.06,.07,.08,.09,.10,.12],attackSpeedBonus:[.03,.04,.05,.06,.07,.08,.09,.10,.12],damageReduction:[0,0,.02,.02,.03,.05,.05,.06,.08]};
for(const [key,values] of Object.entries(expected)) assert.deepEqual(cfg.levels.map(level=>level[key]),values,key);

function makeSystem(levels={}){
 const player=createPlayerRuntime(); player.moveSpeedMultiplierBonuses={other:.2}; player.attackSpeedMultiplierBonuses={super_speed:.3}; player.strengthBonuses.other=2; player.defenseBonuses.other=5; player.damageReductionBonuses.other=.04; player.maxHpBonuses={giant_force:21}; player.maxHp=521; player.hp=260;
 const scene={playerData:player,hud:{update(){}},playerHealthBar:{update(){}},playerInfoPanel:{isOpen:false}};
 return {scene,passiveState:{},passiveUpdaters:[],levels,getLevel(id){return this.levels[id]||0},getData(id,level=this.getLevel(id)){return SKILLS[id]?.levels?.[level-1]}};
}
const tick=sys=>[...sys.passiveUpdaters].forEach(fn=>fn());
const own=(sys,id,level)=>{sys.levels[id]=level;};
const sourceSnapshot=p=>({strength:p.strengthBonuses.human_god,defense:p.defenseBonuses.human_god,maxHp:p.maxHpBonuses.human_god,move:p.moveSpeedMultiplierBonuses.human_god,attackSpeed:p.attackSpeedMultiplierBonuses.human_god,reduction:p.damageReductionBonuses.human_god});

{
 const sys=makeSystem({human_god:1}), p=sys.scene.playerData, cleanup=SKILL_HANDLERS.human_god.bind(sys); const ratio=260/521;
 assert.deepEqual(sourceSnapshot(p),{strength:4,defense:3,maxHp:30,move:.03,attackSpeed:.03,reduction:0}); assert.equal(p.maxHp,551); assert.equal(p.hp,Math.round(551*ratio));
 assert.equal(getTotalStrength(p),6); assert.equal(getEffectiveAttack(p),16); assert.equal(getEffectiveDefense(p),8); assert.equal(getEffectiveDamageReduction(p),.04);
 const once=sourceSnapshot(p); tick(sys); tick(sys); assert.deepEqual(sourceSnapshot(p),once,'updater is idempotent');
 own(sys,'human_god',9); tick(sys); assert.deepEqual(sourceSnapshot(p),{strength:22,defense:18,maxHp:180,move:.12,attackSpeed:.12,reduction:.08},'upgrade replaces source values');
 own(sys,'solar_flame',1); tick(sys); assert.equal(getHumanGodSolarMultiplier(sys),1.25); assert.deepEqual(sourceSnapshot(p),{strength:28,defense:23,maxHp:225,move:.15,attackSpeed:.15,reduction:.1});
 own(sys,'solar_flame',9); tick(sys); assert.equal(getHumanGodSolarMultiplier(sys),1.4); assert.deepEqual(sourceSnapshot(p),{strength:31,defense:25,maxHp:252,move:.168,attackSpeed:.168,reduction:.112}); assert.notEqual(getHumanGodSolarMultiplier(sys),1.25*1.15);
 assert.equal(p.strengthBonuses.other,2); assert.equal(p.maxHpBonuses.giant_force,21); assert.equal(p.attackSpeedMultiplierBonuses.super_speed,.3);
 own(sys,'solar_flame',0); tick(sys); assert.equal(p.strengthBonuses.human_god,22,'solar removal restores base');
 const beforeCleanupRatio=p.hp/p.maxHp; cleanup(); assert.equal(p.maxHp,521); assert(Math.abs(p.hp/p.maxHp-beforeCleanupRatio)<.002); assert.equal(p.strengthBonuses.human_god,undefined); assert.equal(p.strengthBonuses.other,2); assert.equal(p.maxHpBonuses.giant_force,21); assert.equal(p.attackSpeedMultiplierBonuses.super_speed,.3); assert.equal(sys.passiveUpdaters.length,0); assert.equal(sys.passiveState.humanGod,undefined); cleanup();
}
{
 const solarFirst=makeSystem({solar_flame:9,human_god:1}); const godFirst=makeSystem({human_god:1}); const offA=SKILL_HANDLERS.human_god.bind(solarFirst); const offB=SKILL_HANDLERS.human_god.bind(godFirst); own(godFirst,'solar_flame',9); tick(godFirst); assert.deepEqual(sourceSnapshot(solarFirst.scene.playerData),sourceSnapshot(godFirst.scene.playerData)); offA(); offB();
}
assert.deepEqual(getHumanGodActualStats(cfg.levels[8],1.4),{strength:31,defense:25,maxHpBonus:252,moveSpeedBonus:.168,attackSpeedBonus:.168,damageReduction:.112});
const detailSystem=makeSystem({human_god:9,solar_flame:9}); detailSystem.scene.playerData.skills=[{id:'human_god',level:9},{id:'solar_flame',level:9}]; const detail=getSkillDetailData('human_god',{scene:{...detailSystem.scene,skillSystem:detailSystem}}); assert(detail.currentEffects.includes('移动速度：+16.8%')); assert(detail.currentEffects.some(line=>line.includes('当前拥有2颗太阳')));
const source=fs.readFileSync('src/skills/handlers/HumanGodSkill.js','utf8'); assert(!/setScale|delayedCall|tweens?\.|Timer|time\.addEvent/.test(source));
console.log('v0.11.8 human god validation passed.');
