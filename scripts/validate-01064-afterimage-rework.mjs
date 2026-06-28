import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';
import { TracelessSkill } from '../src/skills/handlers/AfterimageCoreSkills.js';
import { CombatEvents } from '../src/core/CombatEvents.js';

assert.equal(GAME_VERSION,'0.10.64');
assert.equal(SKILLS.shadow_assault,undefined,'old 影袭 skill removed');
assert.equal(SKILLS.swift_shadow,undefined,'old 疾影 skill removed');
for (const id of ['shadow_fist','traceless','phantom_step','instant_step','myriad_afterimage']) {
  assert.ok(SKILLS[id],`${id} exists`);
  assert.equal(SKILLS[id].requiredSkillId,undefined,`${id} can be obtained independently`);
  assert.ok(SKILLS[id].description?.length>12,`${id} has clear description`);
}
assert.match(SKILLS.traceless.description,/闪避.*移动速度.*残影伤害/);
assert.match(SKILLS.myriad_afterimage.description,/获得或升级.*火球.*毒针.*重击.*御剑术.*锁定/);
assert.ok(SKILLS.myriad_afterimage.levels.every(l=>l.desc.includes('锁定可复制类型')));

const combat=readFileSync('src/systems/CombatSystem.js','utf8');
const entry=readFileSync('src/skills/handlers/EntryArchetypeSkills.js','utf8');
const panel=readFileSync('src/ui/PlayerInfoPanel.js','utf8');
assert.match(combat,/Math\.min\(0\.70,\(s\.playerData\.dodgeChance\|\|0\)\+sumBonuses\(s\.playerData\.dodgeChanceBonuses\)\)/,'combat dodge cap is 70%');
assert.match(entry,/Math\.min\(0\.70,p\.dodgeChance\+appliedDodge\)/,'身法 application cap is 70%');
assert.match(panel,/\['dodge',pct\(cap70\(/,'player info dodge display uses 70% cap');

let now=1000;
const listeners=new Map();
const destroyed=[];
const scene={
  playerData:{ skills:[{id:'traceless',level:1}], moveSpeedMultiplierBonuses:{}, afterimageDamageBonuses:{} },
  player:{ x:320, y:420 },
  getGameplayTime:()=>now,
  eventBus:{ on(event,fn){ listeners.set(event,fn); return ()=>listeners.delete(event); } },
  floatText(){},
  add:{ rectangle(){ return { setStrokeStyle(){ return this; }, setDepth(){ return this; }, setPosition(x,y){ this.x=x; this.y=y; return this; }, destroy(){ destroyed.push(this); } }; } }
};
const system={ scene, passiveUpdaters:[], getLevel:id=>scene.playerData.skills.find(s=>s.id===id)?.level||0, getData:id=>SKILLS[id].levels[0] };
const off=TracelessSkill.bind(system);
listeners.get(CombatEvents.PLAYER_DODGED)({});
system.passiveUpdaters.forEach(fn=>fn());
assert.equal(scene.playerData.moveSpeedMultiplierBonuses.traceless,SKILLS.traceless.levels[0].moveSpeedBonus,'无踪 applies move speed on dodge');
assert.equal(scene.playerData.afterimageDamageBonuses.traceless,SKILLS.traceless.levels[0].afterimageDamageBonus,'无踪 applies afterimage damage on dodge');
now+=SKILLS.traceless.levels[0].durationMs+1;
system.passiveUpdaters.forEach(fn=>fn());
assert.equal(scene.playerData.moveSpeedMultiplierBonuses.traceless,undefined,'无踪 cleans move speed after expiry');
assert.equal(scene.playerData.afterimageDamageBonuses.traceless,undefined,'无踪 cleans afterimage damage after expiry');
off();
assert.equal(system.passiveUpdaters.length,0,'无踪 updater cleaned up on remove');
assert.ok(destroyed.length>=1,'无踪 visual cleaned up');
console.log('v0.10.64 afterimage rework validation passed.');
