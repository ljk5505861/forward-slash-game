import fs from 'node:fs';
import path from 'node:path';

const scriptsDir = new URL('./', import.meta.url);
const fromVersion = '0.10.68';
const toVersion = '0.10.69';

for (const name of fs.readdirSync(scriptsDir)) {
  if (!name.endsWith('.mjs') || name === 'bump-version-assertions.mjs') continue;
  const filePath = path.join(scriptsDir.pathname, name);
  const source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes(fromVersion)) continue;
  fs.writeFileSync(filePath, source.replaceAll(fromVersion, toVersion));
}

console.log(`Updated version assertions: ${fromVersion} -> ${toVersion}`);
