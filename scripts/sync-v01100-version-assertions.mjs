import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const scriptsDir = path.join(root, 'scripts');

for (const filename of fs.readdirSync(scriptsDir)) {
  if (!filename.endsWith('.mjs') || filename.startsWith('sync-v01100-')) continue;
  const filePath = path.join(scriptsDir, filename);
  const source = fs.readFileSync(filePath, 'utf8');
  const updated = source.replaceAll('0.10.99', '0.11.0');
  if (updated !== source) fs.writeFileSync(filePath, updated);
}

const packagePath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts['validate:01100-playtest-fixes'] = 'npm run validate:01100-superhero-kinetic && npm run validate:01099-playtest-fixes';
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
