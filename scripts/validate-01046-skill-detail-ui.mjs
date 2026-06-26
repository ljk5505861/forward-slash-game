import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { getSkillDetailData, validateSkillDetailContent } from '../src/ui/skillDetailContent.js';

const read=p=>fs.readFileSync(new URL(`../${p}`, import.meta.url),'utf8');
assert.equal(GAME_VERSION,'0.10.46');
const skillBar=read('src/ui/SkillBar.js');
assert.match(skillBar,/SKILL_DETAIL_LONG_PRESS_MS\s*=\s*450/);
assert.match(skillBar,/LONG_PRESS_MOVE_CANCEL_PX\s*=\s*18/);
assert.match(skillBar,/delayedCall\(SKILL_DETAIL_LONG_PRESS_MS/);
for (const ev of ['pointerdown','pointermove','pointerup','pointerupoutside','pointercancel','wheel']) assert.ok(skillBar.includes(ev), ev);
assert.match(skillBar,/if\(triggered\) return|if\s*\(triggered\)\s*return/);
assert.match(skillBar,/DRAG_THRESHOLD_PX\s*=\s*6/);
assert.match(skillBar,/Clamp\([^,]+,[^,]*0,[^)]*maxScroll/);
const keys=Object.keys(SKILLS); assert.equal(keys.length,31);
assert.deepEqual(validateSkillDetailContent(),[]);
for (const id of keys){ const d=getSkillDetailData(id,{}); assert.ok(d.description?.length>8,id); assert.equal(d.milestones.length,3,id); assert.deepEqual(d.milestones.map(m=>m.level),[3,6,9],id); d.milestones.forEach(m=>assert.ok(m.text.length>6,`${id} milestone`)); }
const sword=JSON.stringify(getSkillDetailData('sword_wave',{})); for (const word of ['当前品质','当前魂魄进度','神话名额','当前伤害','飞行速度','攻击间隔','剑体','剑光','暴击','火魂','毒魂']) assert.ok(sword.includes(word),word);
const tomb=JSON.stringify(getSkillDetailData('sword_tomb',{})); for (const word of ['当前总魂魄','当前有效魂魄','当前斩杀线','当前精英斩杀线','当前魂斩伤害','当前魂斩间隔','当前火魂','当前毒魂','当前封神进度','神话名额','万魂剑域']) assert.ok(tomb.includes(word),word);
const flame=read('src/skills/handlers/FlameCoreSkills.js'); assert.match(flame,/SOLAR_FLAME_VERTICAL_OFFSET\s*=\s*230/); assert.match(flame,/setPosition\?\.\(s\.player\.x\s*,\s*s\.player\.y-SOLAR_FLAME_VERTICAL_OFFSET\)/);
const ind=read('src/ui/EnemyStatusIndicators.js'); assert.ok(ind.includes('StatusIndicator')||ind.includes('statusIndicatorContainer')); assert.ok(ind.includes('IconPlaceholder')); assert.ok(ind.includes('StackText')); assert.match(ind,/getStackCount\?\.\(enemy,StatusEffects\.BURN\)/); assert.match(ind,/stacks>0/); assert.match(ind,/setVisible\(false\).*setAlpha\(0\).*setStrokeStyle\(0/s); assert.match(ind,/setText\(stacks>0\?String\(stacks\):''\)/);
assert.ok(!fs.existsSync(new URL('../src/entities/EnemyStatusIndicators.js', import.meta.url)));
const swordState=read('src/skills/handlers/SwordFlowState.js'); assert.match(swordState,/SOUL_THRESHOLDS = \[0,12,36,80\]/); assert.match(swordState,/const LV3 = \{ speed:1\.25, interval:0\.85 \}/); assert.match(swordState,/const LV6 = \{ critChance:0\.15, critMultiplierBonus:0\.5 \}/); assert.match(swordState,/const LV9 = \{ finalDamage:1\.5, bodySize:1\.3, glowSize:1\.3 \}/);
assert.match(flame,/\[8,0\.0,1,900,0,0\]/); assert.match(flame,/burnDamage:5,burnMs:3400,burnIntervalMs:600/);
console.log('validate-01046-skill-detail-ui passed');
