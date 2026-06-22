import { BALANCE } from '../src/config/balance.js';
import { ENEMIES } from '../src/config/enemies.js';
const p = BALANCE.enemyPopulation;
for (const key of ['earlyTarget','midTarget','lateTarget','bossMinionsTarget','hardCap']) if (!Number.isFinite(p[key])) throw new Error(`missing ${key}`);
if (!(p.earlyTarget < p.midTarget && p.midTarget < p.lateTarget && p.hardCap >= p.lateTarget)) throw new Error('bad population targets');
if (ENEMIES.grunt.hp > 30 || ENEMIES.grunt.damage > 5) throw new Error('grunt not weakened enough');
console.log('[validate:enemy-population] PASS targets and weakened normal enemies');
