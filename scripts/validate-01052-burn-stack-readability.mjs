import fs from 'node:fs';
import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import '../src/skills/handlers/index.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const indicators=read('src/ui/EnemyStatusIndicators.js');
const sword=read('src/skills/handlers/SwordReworkSkills.js');
const combat=read('src/systems/CombatSystem.js');
const skillSystem=read('src/systems/SkillSystem.js');

assert.equal(GAME_VERSION,'0.10.53','game version is 0.10.53');
assert.match(indicators,/fontSize:'16px'/,'burn stack number is enlarged to 16px');
assert.match(indicators,/fontStyle:'bold'/,'burn stack number uses bold weight');
assert.match(indicators,/color:'#ff9a3d'/,'burn stack number uses clear orange');
assert.match(indicators,/setText\(stacks>0\?String\(stacks\):''\)/,'burn indicator displays only the numeric stack count');
assert.doesNotMatch(indicators,/灼/,'burn indicator no longer contains the 灼 label');
assert.doesNotMatch(indicators,/stroke:/,'burn stack number has no stroke color');
assert.doesNotMatch(indicators,/strokeThickness:/,'burn stack number has no stroke thickness');
assert.match(indicators,/STATUS_ITEM_WIDTH=18/,'status item width remains unchanged');
assert.match(indicators,/statusRowOffsetY:15/,'status row position remains unchanged');
assert.match(indicators,/setVisible\(stacks>0\)/,'zero stacks remain hidden');

assert.match(sword,/SWORD_SHEATH_BACK_OFFSET_X=36/,'sword sheath x position is unchanged');
assert.match(sword,/SWORD_SHEATH_BACK_OFFSET_Y=26/,'sword sheath y position is unchanged');
assert.match(skillSystem,/POST_UPDATE_EVENT=Phaser\.Scenes\?\.Events\?\.POST_UPDATE\|\|'postupdate'/,'attached visual synchronization remains unchanged');
assert.match(combat,/enemy\.nameText\?\.x \?\? enemy\.x/,'damage number origin remains unchanged');
assert.deepEqual(SKILLS.fireball.levels.map(l=>l.burnDamage),Array(9).fill(5),'fireball burn damage unchanged');
assert.deepEqual(SKILLS.burn_burst.levels.map(l=>l.burnDamage),Array(9).fill(5),'burn burst damage unchanged');

console.log('validate-01052-burn-stack-readability passed');
