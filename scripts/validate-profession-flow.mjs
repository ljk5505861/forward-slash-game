import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gameScene = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
const professionPanel = readFileSync(new URL('../src/ui/ProfessionPanel.js', import.meta.url), 'utf8');
const movementSystem = readFileSync(new URL('../src/systems/MovementSystem.js', import.meta.url), 'utf8');

assert.match(gameScene, /continueAfterProfessionChoice\(\)/, 'profession success continues through a dedicated handoff');
assert.match(gameScene, /this\.time\.delayedCall\(0,\(\)=>this\.continueAfterProfessionChoice\(\)\)/, 'continuation waits until panel confirm hide completes');
assert.match(gameScene, /continueAfterProfessionChoice\(\)\{ if\(this\.professionPanel\?\.isOpen\) return;/, 'profession panel must be closed before rewards advance');
assert.match(gameScene, /if\(!selected\)\{ this\.claimingProfession=false;/, 'failed profession claim unlocks retry');
assert.match(professionPanel, /result==='rejected'\)\{ this\.updateDebug\(\); return; \}/, 'failed callback keeps profession panel open');
assert.match(gameScene, /this\.upgradeSystem\?\.pending>0/, 'pending level ups remain part of resume flow');
assert.match(gameScene, /showActualMidBossReward\(\)/, 'high-quality mid-boss reward still starts after pending upgrades');
assert.match(gameScene, /this\.midBossRewardOpen=false; this\.midBossPostFightFlowStarted=false; this\.claimingProfession=false; this\.runState=RunStates\.RUNNING;/, 'mid-boss reward completion clears blockers and restores running state');
assert.match(gameScene, /this\.stageSystem\?\.enterPhaseById\('late'\)/, 'late phase is entered after high-quality reward');
assert.match(gameScene, /this\.endGameplayPause\(\)/, 'flow uses unified gameplay pause ending');
assert.match(gameScene, /professionFlowSnapshot\(\)/, 'debug resume snapshot is available');
assert.match(gameScene, /\[PROF_FLOW\] \$\{message\}/, 'debug-only profession flow logs are gated by profLog');
assert.match(gameScene, /artifactRewardPanel/, 'artifact panel participates in blocking modal checks');
assert.match(movementSystem, /setVelocityX/, 'movement system remains responsible for player velocity after pause');
assert.doesNotMatch(gameScene, /body\.setVelocityX\([^0][^)]*\).*profession/s, 'profession fix does not hard-code forward velocity in the profession flow');
console.log('profession flow validation passed');
