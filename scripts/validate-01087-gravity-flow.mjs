import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.window ??= {}; globalThis.navigator ??= { maxTouchPoints:0, userAgent:'node' }; const ctx={fillRect(){},clearRect(){},getImageData(){return {data:[0,0,0,0]}},putImageData(){},drawImage(){},createImageData(){return []},measureText(){return {width:0}},fillText(){},save(){},restore(){},translate(){},scale(){},rotate(){},beginPath(){},arc(){},fill(){},stroke(){}}; globalThis.document ??= { documentElement:{}, createElement:()=>({getContext:()=>ctx,style:{}}) }; globalThis.HTMLCanvasElement ??= class {}; globalThis.Image ??= class {};
const { GAME_VERSION } = await import('../src/config/version.js');
const { SKILLS } = await import('../src/config/skills.js');
const { TAGS, BUILD_TAGS } = await import('../src/config/tags.js');
await import('../src/skills/handlers/index.js');
const { SKILL_HANDLERS } = await import('../src/skills/handlers/index.js');
const { validateSkillDetailContent, getSkillDetailData } = await import('../src/ui/skillDetailContent.js');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(GAME_VERSION,'0.10.94'); assert.equal(pkg.version,'0.10.94');
assert.match(pkg.scripts['validate:01087-gravity-flow'],/validate-01087-gravity-flow-runtime\.mjs/,'runtime validation is part of the gravity gate');
assert.equal(Object.keys(SKILLS).length,35); assert.equal(Object.values(SKILLS).filter(s=>s.rarity==='RARE'&&s.tags.includes(TAGS.GRAVITY)).length,2); assert.equal(Object.values(SKILLS).filter(s=>s.rarity==='EPIC'&&s.tags.includes(TAGS.GRAVITY)).length,1); assert.equal(Object.values(SKILLS).filter(s=>s.rarity==='MYTHIC'&&s.tags.includes(TAGS.GRAVITY)).length,1);
assert.equal(TAGS.GRAVITY,'gravity'); assert.equal(TAGS.CELESTIAL,'celestial'); assert.equal(TAGS.BUILD_GRAVITY,'buildGravity'); assert(BUILD_TAGS.includes(TAGS.BUILD_GRAVITY));
const expected={gravity_crush:{rarity:'RARE',milestone9:'天穹连坠：每次释放连续降下三次重压。',damage:[68,75,84,93,102,114,126,138,150],cooldownMs:[4800,4650,4500,4350,4200,3950,3800,3650,3400]},gravity_field:{rarity:'RARE',fieldCount:[1,1,1,1,1,1,1,1,2],moveSlow:[.20,.22,.25,.26,.28,.30,.31,.33,.36]},gravity_orb:{rarity:'EPIC',orbCount:[1,1,1,1,1,2,2,2,2],blastRadius:[145,150,170,175,180,190,195,200,215]},black_hole:{rarity:'MYTHIC',collapseDamage:[120,135,150,170,190,220,245,270,300],coreHalfWidth:[170,180,195,205,215,235,255,275,300]}};
for (const id of Object.keys(expected)){ const s=SKILLS[id]; assert(s,`missing ${id}`); assert.equal(s.rarity,expected[id].rarity); assert.equal(s.requiredSkillId,undefined); assert.equal(s.levels.length,9); for(const t of [TAGS.MAGIC,TAGS.GRAVITY,TAGS.BUILD_GRAVITY]) assert(s.tags.includes(t)); assert(SKILL_HANDLERS[s.handler]); for(const [k,v] of Object.entries(expected[id])) if(Array.isArray(v)) assert.deepEqual(s.levels.map(x=>x[k]),v,`${id}.${k}`); }
for (const id of ['gravity_crush','gravity_field','gravity_orb']) assert(SKILLS[id].tags.includes(TAGS.ACTIVE_SKILL)); assert(SKILLS.gravity_orb.tags.includes(TAGS.PROJECTILE)); assert(SKILLS.black_hole.tags.includes(TAGS.CELESTIAL)); assert(SKILLS.black_hole.tags.includes('mythicSkill')); assert.equal(SKILLS.black_hole.passive,true); assert.equal(SKILLS.black_hole.ultimateSkill,true); assert.equal(typeof SKILL_HANDLERS.black_hole.shiftTimers,'function');
assert.match(fs.readFileSync('src/systems/ShopSystem.js','utf8'),/^import Phaser from 'phaser';/,'shop keeps real Phaser shuffle');
assert.match(fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8'),/^import Phaser from 'phaser';/,'enemy behavior keeps real Phaser helpers');
const gravityFix=fs.readFileSync('src/skills/handlers/GravityFlowFollowupFixes.js','utf8');
assert.match(gravityFix,/warningAt=castAt\+index\*\(data\.followupDelayMs\|\|0\)/,'follow-up warnings use their own scheduled warning time');
assert.match(gravityFix,/task\.centerAt=\(\)=>task\.lockedCenter/,'strike impact stays on its displayed warning location');
assert.match(gravityFix,/groundTopY\?\?620\)-260/,'black hole collapse visual uses hovering height');
assert.doesNotMatch(gravityFix,/warningAt\+=d/,'staged warning time must not be shifted twice');
const gravityControl=fs.readFileSync('src/systems/EnemyGravityControl.js','utf8');
assert.match(gravityControl,/pullImmuneStates=new Set\(\['windup','charge'/,'charger windup is pull immune');
const handlerRegistry=fs.readFileSync('src/skills/handlers/index.js','utf8');
assert.match(handlerRegistry,/gravity_crush:GravityCrushFixedSkill/,'fixed gravity crush handler is registered');
assert.match(handlerRegistry,/black_hole:BlackHoleFixedSkill/,'fixed black hole handler is registered');

function assertBlackHoleDetail(level, required){ const d=getSkillDetailData('black_hole',{skill:{id:'black_hole',level}}); const text=[...(d.currentEffects||[]),...(d.nextLevelPreview||[])].join(' '); for(const part of ['外围吸引速度','核心吸引速度','中心吸引停止距离','坍塌蓄力时间','坍塌吸引距离','精英吸引','Boss',...required]) assert(text.includes(part),`black hole level ${level} detail missing ${part}`); }
for(const level of [1,3,6,9]) assertBlackHoleDetail(level,[]);
assertBlackHoleDetail(1,['外围吸引速度：70像素/秒','核心吸引速度：130像素/秒','坍塌蓄力时间：0.6秒','坍塌吸引距离：140','精英吸引比例：50%','Boss位置吸引：免疫']);
assertBlackHoleDetail(9,['外围吸引速度：150像素/秒','核心吸引速度：280像素/秒','坍塌蓄力时间：0.48秒','坍塌吸引距离：280','终极坍塌蓄力时间：0.7秒','终极坍塌吸引倍率：1.35倍','终极坍塌频率']);
assert.deepEqual(validateSkillDetailContent(), []); for(const id of Object.keys(expected)) for(const level of [1,3,6,8,9]){ const d=getSkillDetailData(id,{skill:{id,level}}); const text=[...(d.currentEffects||[]),...(d.nextLevelPreview||[])].join(' '); assert.match(text,/\d/); }
await import('./validate-01087-gravity-followup-pause.mjs');
console.log('v0.10.94 gravity flow config validation passed');
