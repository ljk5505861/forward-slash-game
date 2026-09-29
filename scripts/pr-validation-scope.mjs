import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PLAN = '.github/validation-plan.json';
const infrastructure = new Set([PLAN, '.github/workflows/pr-validation.yml',
  'scripts/pr-validation-scope.mjs', 'scripts/test-pr-validation-scope.mjs']);
const nonGame = file => file.endsWith('.md') || file.startsWith('.agents/skills/') || infrastructure.has(file);

// Explicit plans are reviewed with the PR. Unknown files fail closed.
export function selectChecks(files, plan, full = false) {
  if (full) return { mode: 'full', tests: [] };
  const changed = files.filter(file => !nonGame(file));
  if (!changed.length) return { mode: 'none', tests: [] };
  if (!files.includes(PLAN)) throw new Error('Game changes require an updated ' + PLAN);
  if (!plan || typeof plan.reason !== 'string' || !plan.reason.trim() ||
      !Array.isArray(plan.files) || !Array.isArray(plan.tests) || !plan.tests.length) {
    throw new Error('Task plan needs reason, exact files and at least one test');
  }
  const missing = changed.filter(file => !plan.files.includes(file));
  if (missing.length) throw new Error('Files missing from task plan: ' + missing.join(', '));
  for (const test of plan.tests) {
    if (typeof test !== 'string' || !/^scripts\/validate-[a-zA-Z0-9-]+\.mjs$/.test(test)) {
      throw new Error('Only explicit scripts/validate-*.mjs test paths are allowed');
    }
  }
  return { mode: 'task', tests: [...new Set(plan.tests)], reason: plan.reason };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, base, head] = process.argv.slice(2);
  if (!['select', 'run'].includes(command) || !base || !head) throw new Error('Usage: select|run BASE HEAD');
  const files = execFileSync('git', ['diff', '--name-only', '-z', base + '...' + head], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const plan = fs.existsSync(PLAN) ? JSON.parse(fs.readFileSync(PLAN, 'utf8')) : null;
  const selection = selectChecks(files, plan, process.env.FULL_VALIDATION === 'true');
  for (const test of selection.tests) if (!fs.existsSync(test)) throw new Error('Missing test: ' + test);
  console.log(JSON.stringify(selection, null, 2));
  if (command === 'select' && process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'mode=' + selection.mode + '\n');
  if (command === 'select' && process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '### Validation scope: ' + selection.mode + '\n\n' + (selection.reason || 'Documentation/infrastructure only, or manually requested full validation.') +
    '\n\n' + selection.tests.map(test => '- ' + test).join('\n') + '\n');
  if (command === 'run') for (const test of selection.tests) {
    const result = spawnSync(process.execPath, [test], { stdio: 'inherit', timeout: 120000 });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
