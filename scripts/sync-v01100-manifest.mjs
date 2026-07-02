import fs from 'node:fs';

const packagePath = new URL('../package.json', import.meta.url);
const lockPath = new URL('../package-lock.json', import.meta.url);

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.version = '0.11.0';
pkg.scripts['validate:01100-superhero-kinetic'] = 'node scripts/validate-01100-version.mjs && node scripts/validate-01100-superhero-kinetic.mjs';
pkg.scripts['validate:01100-playtest-fixes'] = 'npm run validate:01100-superhero-kinetic && node scripts/run-legacy-01099-regressions.mjs';
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
lock.version = '0.11.0';
lock.packages[''].version = '0.11.0';
fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
