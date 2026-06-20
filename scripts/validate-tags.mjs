import assert from 'node:assert/strict';
import { SKILLS } from '../src/config/skills.js';
import { ARTIFACTS } from '../src/config/artifacts.js';
import { PROFESSIONS } from '../src/config/professions.js';
import { CORE_TAGS, LEGACY_TAG_ALIASES } from '../src/config/tags.js';
import { hasTag, hasAnyTag, hasAllTags, mergeTags } from '../src/utils/tagUtils.js';
import { collectBuildTagStats } from '../src/utils/buildTags.js';

const defined = new Set([...CORE_TAGS, ...Object.keys(LEGACY_TAG_ALIASES), 'physical', 'area', 'shadow', 'curse', 'burst', 'holy', 'time', 'burn', 'damage', 'speed', 'survival', 'magic', 'mark', 'damageTaken', 'allDamage', 'activeSkillCast', 'activeSkillDamage', 'normalAttackHit', 'activeSkillDirectHit']);
const assertTagsDefined = (owner, tags = []) => tags.forEach(tag => assert.ok(defined.has(tag), `${owner} has undefined tag ${tag}`));
Object.values(SKILLS).forEach(skill => assertTagsDefined(`skill:${skill.id}`, skill.tags));
Object.values(ARTIFACTS).forEach(artifact => ['tags', 'affectedTags', 'supportedTags', 'synergyTags'].forEach(field => assertTagsDefined(`artifact:${artifact.id}.${field}`, artifact[field] || [])));
Object.values(PROFESSIONS).forEach(profession => ['supportedTags', 'triggerTags'].forEach(field => assertTagsDefined(`profession:${profession.id}.${field}`, profession[field] || [])));

const original = ['fire', 'heal'];
assert.equal(hasTag({ tags: original }, 'healing'), true);
assert.equal(hasAnyTag({ tags: ['fire'] }, ['poison', 'fire']), true);
assert.equal(hasAllTags({ tags: ['fire', 'projectile'] }, ['fire', 'projectile']), true);
assert.deepEqual(original, ['fire', 'heal']);
assert.deepEqual(mergeTags(null, undefined, [], ['fire', 'heal'], { tags: ['fire', 'projectile'] }), ['fire', 'healing', 'projectile']);

assert.deepEqual(collectBuildTagStats({}).counts, {});
assert.deepEqual(collectBuildTagStats({ skills: [], artifacts: [], professionId: null }).dominantTags, []);
const stats = collectBuildTagStats({ skills: [{ id: 'fireball' }, { id: 'fireball' }], artifacts: [{ id: 'flame_heart' }], professionId: null });
assert.equal(stats.counts.fire, 3);
assert.equal(stats.counts.activeSkill, 2);
assert.ok(stats.dominantTags.includes('fire'));
console.log('tag validation passed');
