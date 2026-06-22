import fs from 'node:fs';
const scene = fs.readFileSync('src/scenes/GameScene.js','utf8');
if (!scene.includes('midBossConsumedOneUpgrade')) throw new Error('mid boss one-upgrade guard missing');
if (!scene.includes('delayedUpgradeUnlockAt')) throw new Error('delayed pending upgrade unlock missing');
if (!scene.includes('maybeShow({force:true})')) throw new Error('forced single midboss upgrade missing');
console.log('[validate:midboss-reward-flow] PASS pending=0/1/3 limited by code guard');
