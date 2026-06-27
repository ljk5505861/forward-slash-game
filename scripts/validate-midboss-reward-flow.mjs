import { strict as assert } from 'node:assert';
import StageSystem from '../src/systems/StageSystem.js';
import { BALANCE, createPlayerRuntime } from '../src/config/balance.js';

const scene={ balance:BALANCE, scale:{height:1280}, playerData:createPlayerRuntime(), enemies:[], physics:{world:{setBounds(){}}}, cameras:{main:{setBounds(){},worldView:{right:720},width:720,scrollX:0}}, hud:{setStage(){},setStatus(){},update(){}}, eventBus:{emit(){}}, queueArtifactReward(_e,meta){this.artifacts.push(meta.afterBoss);}, resumeModalFlow(){this.resumes+=1;}, showProfessionChoice(){this.professions+=1;}, showCampfire(src){this.campfires.push(src);}, finishRun(won){this.wins+=won?1:0;}, artifacts:[], resumes:0, professions:0, campfires:[], wins:0 };
const stage=new StageSystem(scene); scene.stageSystem=stage; stage.start();
stage.activeRush='boss1'; stage.onBossKilled('boss1'); stage.onBossKilled('boss1'); assert.deepEqual(scene.artifacts,['boss1']); stage.beginAfterBossReward('boss1'); stage.beginAfterBossReward('boss1'); assert.deepEqual(scene.campfires,['boss1']);
stage.activeRush='boss2'; stage.onBossKilled('boss2'); stage.onBossKilled('boss2'); assert.deepEqual(scene.artifacts,['boss1','boss2']); stage.beginAfterBossReward('boss2'); stage.beginAfterBossReward('boss2'); assert.equal(scene.professions,1); stage.onProfessionChosen(); stage.onProfessionChosen(); assert.deepEqual(scene.campfires,['boss1','boss2']);
stage.activeRush='boss6'; stage.onBossKilled('boss6'); stage.onBossKilled('boss6'); assert.equal(scene.wins,1);
console.log('[validate:midboss-reward-flow] PASS Boss rewards are StageSystem-owned and unique');
