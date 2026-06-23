import { strict as assert } from 'node:assert';
import { GAME_VERSION } from '../src/config/version.js';
import { BALANCE, createPlayerRuntime } from '../src/config/balance.js';
import { FLOW_GROUPS, LevelFlowStates } from '../src/systems/StageSystem.js';
import StageSystem from '../src/systems/StageSystem.js';
import UpgradeSystem, { skillMilestoneText } from '../src/systems/UpgradeSystem.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import { SKILLS } from '../src/config/skills.js';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { getAdvancedProfessionChoices } from '../src/config/professions.js';

const noop = () => {};
const makeNode = (x=0,y=0,w=10,h=10) => ({ x,y,y: y, width:w, height:h, active:true, setStrokeStyle(){return this;}, setDepth(){return this;}, setOrigin(){return this;}, setScrollFactor(){return this;}, setDisplaySize(){return this;}, setPosition(x2,y2){this.x=x2;this.y=y2;return this;}, destroy(){this.active=false;}, removeAllListeners(){}, setInteractive(){return this;}, on(){return this;}, body:{ setAllowGravity(){}, setImmovable(){}, setSize(){}, setOffset(){}, setVelocityX(){}, reset(x2,y2){ this.owner.x=x2; this.owner.y=y2; }, enable:true } });
function makeScene(){
  const scene={ balance:BALANCE, scale:{height:1280}, playerData:createPlayerRuntime(), enemies:[], currentTarget:null, killCount:0, runState:'RUNNING', player:{x:220,y:850,body:{setVelocityX(){}}}, cameras:{main:{worldView:{right:720}, scrollX:0, width:720, setBounds(){}}}, physics:{world:{setBounds(){}}, add:{existing(o){ o.body.owner=o; } }}, add:{ rectangle:(x,y,w,h)=>makeNode(x,y,w,h), text:(x,y)=>makeNode(x,y,10,10), circle:(x,y,r)=>makeNode(x,y,r*2,r*2), arc:(x,y,r)=>makeNode(x,y,r*2,r*2), graphics:()=>makeNode() }, tweens:{add({onComplete}={}){ onComplete?.(); }}, eventBus:{events:[], emit(type,payload){ this.events.push({type,payload}); }, on(){ return noop; }}, hud:{setStage(v){this.stage=v;}, setStatus(v){this.status=v;}, update(){}}, enemyBehaviors:{attach(){}, update(){}, pause(){}, resume(){}, shiftTimers(){}, destroyEnemy(){}}, statusEffects:{clearTarget(){}, add(){}, reset(){}}, targeting:{valid:e=>!!e&&!e.isDefeated, all(){return scene.enemies.filter(e=>!e.isDefeated);}, nearestAhead(){return scene.enemies.find(e=>!e.isDefeated);}, random(){return scene.enemies.find(e=>!e.isDefeated);}, aroundPlayer(){return scene.enemies.filter(e=>!e.isDefeated);}, isEnemyFullyInsideViewport(){return true;}}, getGameplayTime(){return 0;}, isGameplayPaused(){return false;}, beginGameplayPause(){}, resumeModalFlow(){}, queueArtifactReward(_enemy,meta){ scene.artifactRequests.push(meta.afterBoss); }, queueShop(reason){ scene.shopRequests.push(reason); }, showSkillReward(title){ scene.skillRewards.push(title); }, showAdvancedProfessionChoice(){ scene.advancedChoices+=1; }, showProfessionChoice(){ scene.professionChoices+=1; }, showCampfire(source){ scene.campfires.push(source); }, finishRun(won){ scene.victories += won ? 1 : 0; }, awardGold(){}, floatText(){}, artifactRequests:[], shopRequests:[], skillRewards:[], professionChoices:0, advancedChoices:0, campfires:[], victories:0 };
  scene.skillSystem=new SkillSystem(scene); scene.upgradeSystem=new UpgradeSystem(scene); scene.combatSystem={damageEnemy(){}};
  return scene;
}

assert.equal(GAME_VERSION, '0.10.0');
assert.equal(BALANCE.camera.playerScreenAnchorX, 0.15);
assert.equal(BALANCE.enemies.entrySpeed, 280);
assert.equal(BALANCE.enemyPopulation.waveClearDelayMs, 1500);
assert.deepEqual(FLOW_GROUPS.map(g=>g.waves), [[3,3,3],[4,4,4],[5,5,5],[6,6,6],[7,7,7],[8,8,8],[9,9,9],[10,10,10],[11,12,12]]);
['GROUP_COMBAT','SKILL_REWARD','SHOP','BOSS_RUSH','BOSS_FIGHT','ARTIFACT_REWARD','PROFESSION_REWARD','ADVANCED_PROFESSION_STATUE','CAMPFIRE','VICTORY'].forEach(k=>assert.equal(LevelFlowStates[k], k));

Object.values(SKILLS).forEach(skill=>{ assert.equal(skill.maxLevel,9, `${skill.id} maxLevel`); assert.equal(skill.levels.length,9, `${skill.id} levels`); [3,6,9].forEach(lv=>{ assert(skill.levels[lv-1], `${skill.id} Lv${lv}`); assert.equal(skillMilestoneText(skill,lv), skill.milestones[lv]); }); });
assert(SKILLS.fireball.levels[1].damage !== SKILLS.fireball.levels[0].damage); assert(SKILLS.fireball.levels[2].radius>0); assert(SKILLS.fireball.levels[5].shots>SKILLS.fireball.levels[4].shots); assert(SKILLS.fireball.levels[8].burnBurst);
assert(SKILLS.lightning.levels[2].hits>SKILLS.lightning.levels[1].hits); assert(SKILLS.lightning.levels[5].repeatScale>SKILLS.lightning.levels[4].repeatScale); assert(SKILLS.lightning.levels[8].chainRadius);
assert(SKILLS.shadow_fist.levels[2].ratio>SKILLS.shadow_fist.levels[0].ratio); assert(SKILLS.shadow_fist.levels[5].radius); assert(SKILLS.shadow_fist.levels[8].fists>1); assert(SKILL_HANDLERS.shadow_fist?.bind);

const scene=makeScene();
scene.skillSystem.addOrLevel('fireball'); assert.equal(scene.skillSystem.getLevel('fireball'),1);
scene.skillSystem.addOrLevel('fireball'); assert.equal(scene.skillSystem.getLevel('fireball'),2);
scene.playerData.skills=[{id:'fireball',level:1},{id:'mirror_march',level:1},{id:'shadow_fist',level:1},{id:'poison_cloud',level:1}];
scene.skillSystem.cooldowns.set('mirror_march',999); scene.skillSystem.passiveState.mirrorClones=[{destroy(){this.destroyed=true;}}]; scene.skillSystem.active=[{skillId:'mirror_march',onEnd(){this.ended=true;}},{skillId:'fireball'}];
const beforeOthers=scene.playerData.skills.filter(s=>s.id!=='mirror_march').map(s=>s.id).join(',');
scene.skillSystem.replaceSkill(1,'sword_wave');
assert.equal(scene.skillSystem.getLevel('mirror_march'),0); assert(!scene.skillSystem.cooldowns.has('mirror_march')); assert.equal(scene.playerData.skills[1].id,'sword_wave'); assert.equal(scene.playerData.skills[1].level,1); assert.equal(scene.playerData.skills.filter(s=>s.id!=='sword_wave').map(s=>s.id).join(','), beforeOthers);
let opts=scene.upgradeSystem.rollOptions(); assert.equal(new Set(opts.map(o=>o.skillId)).size, opts.length);
scene.playerData.skills=[{id:'fireball',level:9},{id:'lightning',level:1},{id:'spinning_blade',level:1},{id:'poison_cloud',level:1}]; opts=scene.upgradeSystem.rollOptions(); assert(!opts.some(o=>o.skillId==='fireball'&&o.type==='skillLevel'));

const stageScene=makeScene(); const stage=new StageSystem(stageScene); stageScene.stageSystem=stage; stage.start(); stage.update(0); assert.equal(stage.waveQueue.length,3); assert.equal(stage.makeWaveIds(['grunt','bomber'],5,1).filter(x=>x.role==='back').length,1); assert(stage.makeWaveIds(['grunt','bomber'],6,2).slice(0,4).every(x=>x.role==='front')); assert(stage.makeWaveIds(['grunt','bomber'],6,2).slice(4).every(x=>x.role==='back'));
for(let i=0;i<3;i+=1){ stage.currentWave=i+1; stage.waveSpawnFinished=true; stage.waveQueue=[]; stageScene.enemies=[]; if(i<2){ stage.updateGroup(i*2000); assert.equal(stage.flowState,LevelFlowStates.GROUP_COMBAT); } }
stage.finishGroup(); assert.equal(stage.flowState,LevelFlowStates.SKILL_REWARD); assert.equal(stageScene.skillRewards.length,1); stage.onSkillRewardClosed(); assert.equal(stage.groupIndex,1);
stage.groupIndex=2; stage.currentWave=3; stage.finishGroup(); stage.onSkillRewardClosed(); assert.deepEqual(stageScene.shopRequests,['first']); stage.onShopClosed('first'); assert.equal(stage.flowState,LevelFlowStates.BOSS_RUSH); stage.onBossKilled('boss1'); stage.onBossKilled('boss1'); assert.deepEqual(stageScene.artifactRequests,['boss1']); stage.beginAfterBossReward('boss1'); assert.deepEqual(stageScene.campfires,['boss1']); stage.onCampfireClosed('boss1'); assert.equal(stage.groupIndex,3);
stage.onBossKilled('boss2'); stage.onBossKilled('boss2'); assert.deepEqual(stageScene.artifactRequests,['boss1','boss2']); stage.beginAfterBossReward('boss2'); assert.equal(stageScene.professionChoices,1); stage.onProfessionChosen(); assert.deepEqual(stageScene.campfires,['boss1','boss2']);
stage.enterAdvancedStatue(); assert.equal(stageScene.advancedChoices,1); stage.onAdvancedProfessionChosen(); assert.deepEqual(stageScene.campfires,['boss1','boss2','advanced']); stage.onCampfireClosed('advanced'); assert.equal(stage.flowState,LevelFlowStates.BOSS_RUSH); stage.onBossKilled('boss3'); stage.onBossKilled('boss3'); assert.equal(stageScene.victories,1);

const p=createPlayerRuntime(); p.hp=50; p.mana=20; p.stamina=30; assert(!('xp' in p)); assert(!('xpToNext' in p));
assert.deepEqual(getAdvancedProfessionChoices('warrior').map(p=>p.id), ['berserker','guardian','swordmaster']);
assert.deepEqual(getAdvancedProfessionChoices('mage').map(p=>p.id), ['elementalist','arcanist','blood_mage']);
assert.deepEqual(getAdvancedProfessionChoices('ranger').map(p=>p.id), ['sharpshooter','beast_hunter','shadow_dancer']);
console.log('[validate-010-gameplay-loop] PASS real SkillSystem, 9-level skills, runtime replacement cleanup, ranged ordering, StageSystem flow, boss reward uniqueness');
