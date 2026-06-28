import fs from 'node:fs';
import path from 'node:path';

const [fromVersion, toVersion, outputRoot = 'version-assertions'] = process.argv.slice(2);
if (!fromVersion || !toVersion) throw new Error('fromVersion and toVersion are required');

const scriptsDir = path.resolve('scripts');
const outputDir = path.resolve(outputRoot, 'scripts');
fs.rmSync(path.resolve(outputRoot), { recursive: true, force: true });

for (const name of fs.readdirSync(scriptsDir)) {
  if (!name.endsWith('.mjs')) continue;
  const source = fs.readFileSync(path.join(scriptsDir, name), 'utf8');
  if (!source.includes(fromVersion)) continue;
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, name), source.split(fromVersion).join(toVersion));
}
