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
const burnTextBlock=indicators.slice(
  indicators.indexOf('const burnText'),
  indicators.indexOf('const poisonText')
);

assert.equal(GAME_VERSION,'0.11.4','game version is 0.11.1');
assert.match(burnTextBlock,/fontSize:'16px'/,'burn stack number is enlarged to 16px');
assert.match(burnTextBlock,/fontStyle:'bold'/,'burn stack number uses bold weight');
assert.match(burnTextBlock,/color:'#ff9a3d'/,'burn stack number uses clear orange');
assert.match(indicators,/setText\(burn>0\?String\(burn\):''\)/,'burn indicator displays only the numeric stack count');
assert.doesNotMatch(burnTextBlock,/灼/,'burn indicator no longer contains the 灼 label');
assert.doesNotMatch(burnTextBlock,/stroke:/,'burn stack number has no stroke color');
assert.doesNotMatch(burnTextBlock,/strokeThickness:/,'burn stack number has no stroke thickness');
assert.match(indicators,/STATUS_ITEM_WIDTH=18/,'status item width remains unchanged');
assert.match(indicators,/statusRowOffsetY:15/,'status row position remains unchanged');
assert.match(indicators,/setVisible\(burn>0\|\|poison>0\)/,'status row hides only when both stacks are zero');

assert.match(sword,/SWORD_SHEATH_BACK_OFFSET_X=36/,'sword sheath x position is unchanged');
assert.match(sword,/SWORD_SHEATH_BACK_OFFSET_Y=26/,'sword sheath y position is unchanged');
assert.match(skillSystem,/POST_UPDATE_EVENT=Phaser\.Scenes\?\.Events\?\.POST_UPDATE\|\|'postupdate'/,'attached visual synchronization remains unchanged');
assert.match(combat,/enemy\.nameText\?\.x \?\? enemy\.x/,'damage number origin remains unchanged');
assert.deepEqual(SKILLS.fireball.levels.map(l=>l.burnDamage),Array(9).fill(5),'fireball burn damage unchanged');
assert.deepEqual(SKILLS.burn_burst.levels.map(l=>l.burnDamage),Array(9).fill(5),'burn burst damage unchanged');

console.log('validate-01052-burn-stack-readability passed');
