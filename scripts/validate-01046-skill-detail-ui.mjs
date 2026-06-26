import fs from 'node:fs';
import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import '../src/skills/handlers/index.js';
import { getSkillDetailData } from '../src/ui/skillDetailData.js';
import { StatusEffects } from '../src/systems/StatusEffectSystem.js';

const src = p => fs.readFileSync(p, 'utf8');
const skillBar = src('src/ui/SkillBar.js');
const detail = src('src/ui/skillDetailData.js');
const flame = src('src/skills/handlers/FlameCoreSkills.js');
const indicators = src('src/ui/EnemyStatusIndicators.js');
const combat = src('src/systems/CombatSystem.js');
const pkg = JSON.parse(src('package.json'));

assert.equal(GAME_VERSION, '0.10.46', 'game version is 0.10.46');
assert.equal(pkg.scripts['validate:01046-skill-detail-ui'], 'node scripts/validate-01046-skill-detail-ui.mjs');
assert.match(skillBar, /SKILL_DETAIL_LONG_PRESS_MS\s*=\s*450/, 'skill bar has 450ms long press threshold');
assert.match(skillBar, /pointerdown[\s\S]*pointermove[\s\S]*pointerup/, 'skill bar handles mouse/touch pointer long press lifecycle');
assert.match(skillBar, /LONG_PRESS_MOVE_CANCEL_PX/, 'long press cancels on movement');
assert.match(skillBar, /wasLongPress[\s\S]*return/, 'long press does not also trigger click replacement');
assert.match(detail, /export function getSkillDetailData/, 'unified skill detail data entry exists');

const base = getSkillDetailData('fireball', { scene:{ playerData:{ skills:[{id:'fireball',level:6}] } } });
assert.ok(base.name && base.level && base.maxLevel && base.description, 'detail includes name, level, and description');
assert.ok(base.currentEffects.length, 'detail includes current effects');
assert.deepEqual(base.milestones.map(m => m.level), [3,6,9], 'detail includes fixed 3/6/9 milestones');

const scene = { playerData:{ skills:[{id:'sword_wave',level:6},{id:'sword_tomb',level:9}] }, statusEffects:{ getStackCount(){ return 0; } }, getGameplayTime(){ return 0; } };
const system = { scene, passiveState:{ swordFlow:{ totalSouls:52, effectiveSouls:52, soulBreakdown:{}, affinities:{fire:3,poison:2}, mainQuality:'EPIC', mythicOwner:'none' } }, getLevel(id){ return scene.playerData.skills.find(s => s.id === id)?.level || 0; }, getData(id, level){ return SKILLS[id]?.levels[(level || this.getLevel(id) || 1)-1]; } };
const sword = getSkillDetailData('sword_wave', { scene, skillSystem:system });
assert.ok(sword.currentEffects.some(f => f.label === '当前品质'), 'sword detail reads runtime quality');
assert.ok(sword.currentEffects.some(f => f.label === '魂魄进度' && String(f.value).includes('52')), 'sword detail reads runtime souls');
const tomb = getSkillDetailData('sword_tomb', { scene, skillSystem:system });
assert.ok(tomb.currentEffects.some(f => f.label === '当前总魂魄'), 'tomb detail reads runtime souls');
assert.ok(tomb.currentEffects.some(f => f.label === '当前斩杀线'), 'tomb detail reads execute line');

assert.match(flame, /SOLAR_FLAME_VERTICAL_OFFSET\s*=\s*230/, 'solar position uses independent vertical offset');
assert.match(flame, /setPosition\?\.\(s\.player\.x,s\.player\.y-SOLAR_FLAME_VERTICAL_OFFSET\)/, 'solar follows player with offset');
assert.match(indicators, /StatusIndicatorContainer[\s\S]*BurnIndicator[\s\S]*IconPlaceholder[\s\S]*StackText/, 'status indicator structure is extensible');
assert.match(indicators, /getStackCount\?\.\(target, StatusEffects\.BURN\)/, 'burn indicator reads real status data');
assert.match(indicators, /STATUS_REMOVED/, 'status disappearance updates marker');
assert.match(combat, /enemyStatusIndicators\?\.clear\?\.\(enemy\)/, 'enemy death clears marker');
assert.deepEqual(SKILLS.sword_tomb.levels.map(l => l.executeRatio), [0.10,0.11,0.12,0.13,0.14,0.15,0.16,0.17,0.18], 'sword tomb execute ratios unchanged');
assert.deepEqual(SKILLS.solar_flame.levels.map(l => l.damage), [8,9,10,11,12,13,14,15,16], 'solar flame damage unchanged');
assert.equal(StatusEffects.BURN, 'BURN');
console.log('v0.10.46 skill detail UI validation passed.');
