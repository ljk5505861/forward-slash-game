import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN, selectChecks } from './pr-validation-scope.mjs';
const plan = { reason: 'Meat behavior and shared damage integration',
  files: ['src/enemies/behaviors/MeatBehavior.js', 'src/systems/CombatSystem.js'],
  tests: ['scripts/validate-01131-meat-monster.mjs'] };
test('docs and CI changes do not start game checks', () => {
  assert.equal(selectChecks(['AGENTS.md', '.agents/skills/example/SKILL.md', '.github/workflows/pr-validation.yml', 'scripts/pr-validation-scope.mjs']).mode, 'none');
});
test('meat selects only declared checks, with build enabled by task mode', () => {
  assert.deepEqual(selectChecks([PLAN, ...plan.files], plan), { mode: 'task', tests: plan.tests, reason: plan.reason });
});
test('missing, stale and incomplete plans fail', () => {
  assert.throws(() => selectChecks(plan.files, plan), /updated/);
  assert.throws(() => selectChecks([PLAN, ...plan.files], null), /needs/);
  assert.throws(() => selectChecks([PLAN, ...plan.files, 'src/ui/ShopPanel.js'], plan), /missing/);
  assert.throws(() => selectChecks([PLAN, ...plan.files], { ...plan, tests: [] }), /needs/);
});
test('deleted/renamed files and dependency changes need coverage', () => {
  for (const file of ['src/old.js', 'src/new.js', 'package.json', 'package-lock.json']) {
    assert.throws(() => selectChecks([PLAN, file], plan), /missing/);
  }
});
test('commands and path traversal are rejected', () => {
  for (const path of ['npm test', 'scripts/../evil.mjs', 'scripts/validate-ok.mjs;echo x']) {
    assert.throws(() => selectChecks([PLAN, ...plan.files], { ...plan, tests: [path] }), /explicit/);
  }
});
test('manual full validation remains available', () => {
  assert.equal(selectChecks(['src/unknown.js'], null, true).mode, 'full');
});
