import fs from 'node:fs';
import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import '../src/skills/handlers/index.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const sword=read('src/skills/handlers/SwordReworkSkills.js');
const indicators=read('src/ui/EnemyStatusIndicators.js');
const combat=read('src/systems/CombatSystem.js');
const scene=read('src/scenes/GameScene.js');
const skillSystem=read('src/systems/SkillSystem.js');
const flame=read('src/skills/handlers/FlameCoreSkills.js');
const skillsConfig=read('src/config/skills.js');
const balanceConfig=read('src/config/balance.js');
const enemiesConfig=read('src/config/enemies.js');
const burnTextBlock=indicators.slice(
  indicators.indexOf('const burnText'),
  indicators.indexOf('const poisonText')
);

assert.equal(GAME_VERSION,'0.10.72','game version is 0.10.72');

assert.match(sword,/export const SWORD_SHEATH_BACK_OFFSET_X=36;/,'sheath x offset remains at the v0.10.51 position');
assert.match(sword,/export const SWORD_SHEATH_BACK_OFFSET_Y=26;/,'sheath y offset remains unchanged');
assert.doesNotMatch(sword,/export const SWORD_SHEATH_BACK_OFFSET_X=28;/,'old sheath x offset stays removed');
assert.match(sword,/rotation:0/,'sword sheath anchor rotation is 0');
assert.match(sword,/const sheathAnchor=player=>\{ const dir=player\.flipX\?-1:1; return \{ dir, x:player\.x-dir\*SWORD_SHEATH_BACK_OFFSET_X, y:player\.y-SWORD_SHEATH_BACK_OFFSET_Y, rotation:0 \}; \};/,'sheath anchor still uses fixed body-relative offsets');
const sheathBlock=sword.slice(sword.indexOf('export const SwordSheathSkill'),sword.indexOf('export const SwordTombSkill'));
assert.doesNotMatch(sheathBlock,/Math\.sin/,'sheath standby has no sine bob');
assert.doesNotMatch(sheathBlock,/tweens\.add|tween/i,'sheath standby has no tween animation');
assert.doesNotMatch(sheathBlock,/lerp/i,'sheath standby has no lerp follow');
assert.doesNotMatch(sheathBlock,/setScale\(/,'sheath standby has no per-frame scale animation');
assert.match(sheathBlock,/container=s\.add\.container\(anchor\.x,anchor\.y\)\.setDepth\(18\)\.setRotation\(0\)/,'sheath container stays fixed rotation with existing depth');
assert.match(sword,/st\.sheath\.container\.setPosition\(anchor\.x,anchor\.y\)\.setRotation\(0\)/,'sheath sync still snaps to current anchor without lag');

assert.deepEqual(SKILLS.sword_sheath.levels.map(l=>l.damage),[32,38,44,52,60,70,82,96,104],'sword_sheath damage unchanged');
assert.deepEqual(SKILLS.sword_sheath.levels.map(l=>l.warmupMs),[6000,5700,5200,5000,4700,4500,4300,4100,4000],'sword_sheath warmup unchanged');
assert.deepEqual(SKILLS.sword_sheath.levels.map(l=>l.range),[560,590,620,650,690,725,760,800,840],'sword_sheath range unchanged');
assert.deepEqual(SKILLS.sword_sheath.levels.map(l=>l.sizeScale),[0.95,1.00,1.05,1.10,1.15,1.20,1.25,1.30,1.35],'sword_sheath sizeScale unchanged');
assert.equal(SKILLS.sword_sheath.levels[8].volley,2,'sword_sheath double volley unchanged');
assert.equal(SKILLS.sword_sheath.levels[8].secondDelayMs,200,'sword_sheath second delay unchanged');
assert.deepEqual(SKILLS.sword_tomb.levels.map(l=>l.executeRatio),[0.10,0.11,0.12,0.13,0.14,0.15,0.16,0.17,0.18],'sword_tomb execute ratios unchanged');
assert.deepEqual(SKILLS.sword_wave.levels.map(l=>l.damage),[34,42,50,58,68,78,90,102,116],'main sword damage unchanged');
assert.deepEqual(SKILLS.fireball.levels.map(l=>l.damage),[30,34,38,42,46,42,46,50,54],'entry fireball damage unchanged');
assert.deepEqual(SKILLS.burn_burst.levels.map(l=>l.burnDamage),[5,5,5,5,5,5,5,5,5],'burn burst burn damage unchanged');

assert.match(indicators,/setText\(burn>0\?String\(burn\):''\)/,'burn indicator displays only the numeric stack count');
assert.doesNotMatch(burnTextBlock,/灼/,'burn indicator no longer includes the 灼 label');
assert.match(burnTextBlock,/fontSize:'16px'/,'burn status font size is 16px');
assert.match(burnTextBlock,/fontStyle:'bold'/,'burn status uses bold weight');
assert.match(indicators,/STATUS_ITEM_WIDTH=18/,'status row remains compact 18px slots');
assert.match(burnTextBlock,/color:'#ff9a3d'/,'burn status color is a clearer orange');
assert.doesNotMatch(burnTextBlock,/color:'#ffb36b'/,'burn status no longer uses the previous pale orange');
assert.doesNotMatch(burnTextBlock,/stroke:/,'burn status has no text stroke');
assert.doesNotMatch(burnTextBlock,/strokeThickness:/,'burn status has no stroke thickness');
assert.match(indicators,/statusRowOffsetY:15/,'enemy status row vertical position unchanged');
assert.match(indicators,/return \{ x:enemy\.x-enemy\.width\/2, y:top-ENEMY_UI_LAYOUT\.statusRowOffsetY \}/,'enemy status row still starts from left edge below hp bar');

assert.match(combat,/enemy\.nameText\?\.x \?\? enemy\.x/,'damage number x origin remains nameText-compatible');
assert.match(combat,/enemy\.nameText\?\.y \?\? enemy\.y-100/,'damage number y origin remains nameText-compatible');
assert.match(scene,/floatText\(x,y,text,color\)\{ const t=this\.add\.text\(x,y,text,[\s\S]*this\.tweens\.add\(\{targets:t,y:y-42,alpha:0,duration:650/,'damage float animation position remains unchanged');
assert.match(skillSystem,/POST_UPDATE_EVENT=Phaser\.Scenes\?\.Events\?\.POST_UPDATE\|\|'postupdate'/,'post-update sync event unchanged');
assert.match(skillSystem,/postUpdateAttachedVisualSync=\(\)=>this\.scene\.syncAttachedVisuals\?\.\(\)/,'attached visual sync callback unchanged');
assert.match(scene,/syncAttachedVisuals\(\)\{ this\.afterimages\?\.syncAttachedVisuals\?\.\(\); this\.skillSystem\?\.syncAttachedVisuals\?\.\(\); this\.flyingSwords\?\.syncAttachedVisuals\?\.\(\); \}/,'scene attached visual sync order unchanged');
assert.match(flame,/durationMs:data\.burnMs,intervalMs:data\.burnIntervalMs,value:data\.burnDamage,stacks:1,maxStacks:5/,'solar flame burn application values unchanged');
assert.match(skillsConfig,/burnDamage:5,burnMs:3200,burnIntervalMs:600,maxStacks:5/,'entry fire burn rules unchanged');
assert.match(balanceConfig,/attack:10/,'player base combat balance remains present');
assert.match(enemiesConfig,/grunt: \{[^\n]*hp:16, damage:3/,'enemy combat stats remain present');

console.log('validate-01050-sheath-burn-visual-tune passed');
