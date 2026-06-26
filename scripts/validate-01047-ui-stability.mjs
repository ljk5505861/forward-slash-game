import fs from 'node:fs';
import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

assert.equal(GAME_VERSION,'0.10.47');

const skillBar=read('src/ui/SkillBar.js');
assert.match(skillBar,/SOUL_BADGE_SKILLS\s*=\s*new Set\(\['sword_wave','sword_tomb'\]\)/);
assert.match(skillBar,/swordFlow\?\.effectiveSouls/);
assert.match(skillBar,/`魂 \$\{soulCount\}`/);
assert.match(skillBar,/soulBadge\.setText\(showSouls/);

const indicators=read('src/ui/EnemyStatusIndicators.js');
assert.match(indicators,/hpBarOffsetY:30/);
assert.match(indicators,/nameOffsetY:70/);
assert.match(indicators,/levelOffsetY:50/);
assert.match(indicators,/statusRowOffsetY:15/);
assert.match(indicators,/x:enemy\.x-enemy\.width\/2/);
assert.match(indicators,/setText\(stacks>0\?`灼 \$\{stacks\}`:''\)/);

const enemy=read('src/entities/createEnemy.js');
assert.match(enemy,/top-ENEMY_UI_LAYOUT\.hpBarOffsetY/);
assert.match(enemy,/nameText[\s\S]*top-ENEMY_UI_LAYOUT\.nameOffsetY/);
assert.match(enemy,/levelText[\s\S]*top-ENEMY_UI_LAYOUT\.levelOffsetY/);
assert.ok(enemy.indexOf('nameOffsetY')<enemy.indexOf('levelOffsetY'),'enemy name is placed above level');

const sword=read('src/skills/handlers/SwordReworkSkills.js');
assert.match(sword,/SWORD_SHEATH_BACK_OFFSET_X=34/);
assert.match(sword,/SWORD_SHEATH_BACK_OFFSET_Y=48/);
assert.match(sword,/SWORD_TOMB_OFFSET_Y=138/);
assert.match(sword,/setDepth\(18\)/);
assert.match(sword,/setDepth\(19\)/);
assert.match(sword,/const tx=stable\(s\.player\.x\), ty=stable\(s\.player\.y-SWORD_TOMB_OFFSET_Y\)/);
assert.doesNotMatch(sword,/oy=.*Math\.sin/);
assert.doesNotMatch(sword,/SWORD_TOMB_OFFSET_Y.*Math\.sin/);

const flying=read('src/systems/FlyingSwordSystem.js');
assert.doesNotMatch(flying,/const bob=/);
assert.doesNotMatch(flying,/Math\.sin\(time\*0\.004/);
assert.match(flying,/sword\.view\.setPosition\?\.\(slot\.x,slot\.y\)/);
assert.match(flying,/x:stable\(player\.x\+behindDirection\*horizontal\)/);

const flame=read('src/skills/handlers/FlameCoreSkills.js');
assert.match(flame,/const primaryX=stable\(s\.player\.x\)/);
assert.match(flame,/primaryY=stable\(s\.player\.y-SOLAR_FLAME_VERTICAL_OFFSET\)/);
assert.match(flame,/secondaryX=stable\(s\.player\.x\+SOLAR_FLAME_SECONDARY_OFFSET_X\)/);

const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.scripts['validate:01047-ui-stability'],'node scripts/validate-01047-ui-stability.mjs');

console.log('validate-01047-ui-stability passed');
