import fs from 'node:fs';
import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import '../src/skills/handlers/index.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const sword=read('src/skills/handlers/SwordReworkSkills.js');
const indicators=read('src/ui/EnemyStatusIndicators.js');
const skillSystem=read('src/systems/SkillSystem.js');
const scene=read('src/scenes/GameScene.js');
const combat=read('src/systems/CombatSystem.js');
const burnTextBlock=indicators.slice(
  indicators.indexOf('const burnText'),
  indicators.indexOf('const poisonText')
);

assert.equal(GAME_VERSION,'0.10.94','game version is 0.10.94');
assert.match(sword,/export const SWORD_SHEATH_BACK_OFFSET_X=36;/,'sheath remains farther behind the player');
assert.match(sword,/export const SWORD_SHEATH_BACK_OFFSET_Y=26;/,'sheath y remains unchanged');
assert.doesNotMatch(sword,/export const SWORD_SHEATH_BACK_OFFSET_X=28;/,'old overlapping x offset remains removed');
assert.match(sword,/rotation:0/,'sheath rotation remains fixed');
assert.match(sword,/x:player\.x-dir\*SWORD_SHEATH_BACK_OFFSET_X/,'sheath still swaps behind the player by facing direction');
const sheathBlock=sword.slice(sword.indexOf('export const SwordSheathSkill'),sword.indexOf('export const SwordTombSkill'));
assert.doesNotMatch(sheathBlock,/Math\.sin|lerp|tweens\.add|setScale\(/i,'sheath standby remains motionless');
assert.match(skillSystem,/POST_UPDATE_EVENT=Phaser\.Scenes\?\.Events\?\.POST_UPDATE\|\|'postupdate'/,'post-physics attached sync remains unchanged');
assert.match(scene,/syncAttachedVisuals\(\)\{ this\.afterimages\?\.syncAttachedVisuals\?\.\(\); this\.skillSystem\?\.syncAttachedVisuals\?\.\(\); this\.flyingSwords\?\.syncAttachedVisuals\?\.\(\); \}/,'attached visual sync order remains unchanged');

assert.match(burnTextBlock,/fontSize:'16px'/,'burn text is enlarged to 16px');
assert.match(burnTextBlock,/fontStyle:'bold'/,'burn text uses bold weight');
assert.match(burnTextBlock,/color:'#ff9a3d'/,'burn text uses clearer orange');
assert.doesNotMatch(burnTextBlock,/color:'#ffb36b'/,'previous pale-orange color is removed');
assert.doesNotMatch(burnTextBlock,/stroke:/,'burn text has no stroke color');
assert.doesNotMatch(burnTextBlock,/strokeThickness:/,'burn text has no stroke thickness');
assert.match(indicators,/setText\(burn>0\?String\(burn\):''\)/,'burn text displays only the numeric stack count');
assert.doesNotMatch(burnTextBlock,/灼/,'burn text no longer contains the 灼 label');
assert.match(indicators,/STATUS_ITEM_WIDTH=18/,'status slot width remains unchanged');

assert.match(combat,/enemy\.nameText\?\.x \?\? enemy\.x/,'damage number origin remains unchanged');
assert.deepEqual(SKILLS.sword_sheath.levels.map(l=>l.damage),[32,38,44,52,60,70,82,96,104],'sword sheath damage unchanged');
assert.deepEqual(SKILLS.sword_sheath.levels.map(l=>l.warmupMs),[6000,5700,5200,5000,4700,4500,4300,4100,4000],'sword sheath warmup unchanged');
assert.deepEqual(SKILLS.burn_burst.levels.map(l=>l.burnDamage),[5,5,5,5,5,5,5,5,5],'burn damage unchanged');

console.log('validate-01051-sheath-x-burn-text passed');
