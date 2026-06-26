import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { getSkillDetailData } from '../src/ui/skillDetailContent.js';

const skillBar = readFileSync('src/ui/SkillBar.js', 'utf8');
const enemySource = readFileSync('src/entities/createEnemy.js', 'utf8');

for (const token of ['pointerdown', 'pointermove', 'pointerup', 'pointerupoutside', 'pointercancel', 'isDragging', 'dragPointerId', 'dragStartY', 'dragStartScrollY', 'threshold:6', 'Math.max(0, Math.min(scrollState.maxScroll', 'insidePanel', 'stopPropagation']) {
  assert.match(skillBar, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `SkillBar missing ${token}`);
}
assert.match(skillBar, /\.on\('wheel'/, 'SkillBar must retain wheel scrolling');
assert.match(skillBar, /body\.setMask\(mask\)/, 'scrolling body must be masked');
assert.match(skillBar, /applyScroll\(0\)/, 'scroll position must reset when opened');

const placeholders = ['自动生效', '技能说明缺失', '强化当前技能机制', '效果增强', '提升当前技能关键数值', '该等级强化'];
const ids = Object.keys(SKILLS);
assert.equal(ids.length, 31, 'current skill pool should contain 31 skills');
for (const skillId of ids) {
  const detail = getSkillDetailData(skillId, { level: 1 });
  assert.ok(detail.description.trim(), `${skillId} description must be non-empty`);
  for (const bad of placeholders) assert.ok(!detail.description.includes(bad), `${skillId} description contains placeholder ${bad}`);
  assert.equal(detail.milestones.length, 3, `${skillId} must have three milestones`);
  assert.deepEqual(detail.milestones.map((m) => m.level), [3, 6, 9], `${skillId} milestones must be 3/6/9`);
  for (const milestone of detail.milestones) {
    assert.ok(milestone.text.trim(), `${skillId} Lv.${milestone.level} text must be non-empty`);
    for (const bad of placeholders) assert.ok(!milestone.text.includes(bad), `${skillId} Lv.${milestone.level} contains placeholder ${bad}`);
  }
}

assert.match(enemySource, /statusIndicators\s*=\s*\{[^}]*IconPlaceholder[^}]*StackText/s, 'IconPlaceholder and StackText structure must exist');
assert.match(enemySource, /burnIconPlaceholder[^;]*setVisible\(false\)[^;]*setAlpha\(0\)/, 'IconPlaceholder must be invisible');
assert.match(enemySource, /burnIconPlaceholder\?\.setStrokeStyle\?\.\(0,\s*0xff8a33,\s*0\)/, 'IconPlaceholder stroke must be invisible');
assert.match(enemySource, /burnStackText\?\.setText\(stacks > 0 \? String\(stacks\) : ''\)\?\.setVisible\?\.\(stacks > 0\)/, 'StackText must show burn stacks');
assert.match(enemySource, /burnStackText\?\.setPosition\?\.\(0, 0\)/, 'StackText should not keep full icon-width gap');

console.log('validate-01046-skill-detail-ui passed');
