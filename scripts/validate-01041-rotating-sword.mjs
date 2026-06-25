import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';

const src=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const nums=(id,key)=>SKILLS[id]?.levels?.map(level=>level[key]);
const eq=(actual,expected,label)=>assert.deepEqual(actual,expected,label);

const swordCore=src('src/skills/handlers/SwordCoreSkills.js');
const pkg=JSON.parse(src('package.json'));

eq(GAME_VERSION,'0.10.41','version is 0.10.41');
eq(nums('rotating_sword','damage'),[44,52,56,66,72,84,92,104,120],'rotating_sword damage unchanged from v0.10.40');
eq(nums('rotating_sword','pierce'),[3,3,4,4,5,5,6,6,7],'rotating_sword pierce unchanged from v0.10.40');
eq(nums('rotating_sword','range'),[430,450,470,490,510,530,550,575,610],'rotating_sword range unchanged from v0.10.40');
eq(nums('rotating_sword','cooldownMs'),[4400,4200,4050,3900,3750,3600,3450,3300,3100],'rotating_sword cooldown unchanged from v0.10.40');
assert.ok(nums('rotating_sword','outboundDurationMs').every(v=>v>=360&&v<=460),'outbound duration configured');
assert.ok(nums('rotating_sword','riseDurationMs').every(v=>v>=180&&v<=240),'rise duration configured');
assert.ok(nums('rotating_sword','returnDurationMs').every(v=>v>=420&&v<=520),'return duration configured');
assert.ok(nums('rotating_sword','returnHeight').every(v=>v>=180&&v<=260),'return height configured');
assert.doesNotMatch(swordCore,/add\.rectangle\([^\n]*data\.range[^\n]*data\.width[^\n]*\)[\s\S]{0,180}angle\s*:\s*360/,'old large rectangle 360-degree windmill effect removed');
assert.doesNotMatch(swordCore,/angle\s*:\s*360/,'no 360-degree tween remains in rotating sword source');
assert.match(swordCore,/const outboundHitTargets\s*=\s*new Set\(\)/,'outbound hit set exists');
assert.match(swordCore,/const returnHitTargets\s*=\s*new Set\(\)/,'return hit set exists');
assert.match(swordCore,/phase==='outbound'\?'outboundHitCount':'returnHitCount'/,'outbound and return use separate hit count keys');
assert.match(swordCore,/system\.hit\(target,system\.damageValue\(data\.damage,ctx\),cfg,level/,'damage logic is called from trajectory hit checks');
assert.match(swordCore,/markAttack\(sword\.id,target,\{[\s\S]*sword:true[\s\S]*phase/,'flying sword hit event is emitted with phase metadata');
assert.match(swordCore,/hitSet\.has\(target\)/,'same-phase duplicate hits are prevented');
assert.match(swordCore,/hitSet\.add\(target\)/,'same-phase hit set is recorded');
assert.match(swordCore,/removeSword\(sword\.id,'rotatingSwordEnded'\)/,'temporary flying sword is removed when flight ends');
assert.match(swordCore,/trail\.destroy\(\)[\s\S]*blade\.destroy\(\)[\s\S]*glow\.destroy\(\)/,'temporary visuals are destroyed');
assert.equal(pkg.scripts['validate:01041-rotating-sword'],'node scripts/validate-01041-rotating-sword.mjs','package script registered');
console.log('v0.10.41 rotating sword validation passed.');
