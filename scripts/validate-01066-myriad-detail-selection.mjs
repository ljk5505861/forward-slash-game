import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import '../src/skills/handlers/index.js';
import { MyriadAfterimageSkill, MYRIAD_NORMAL_ATTACK_ID, getMyriadAfterimageDetailState, selectionOptions, openMyriadAfterimageSelection } from '../src/skills/handlers/AfterimageUltimateSkills.js';

assert.equal(GAME_VERSION,'0.10.66');

function bus(){ const map=new Map(); return { on(e,fn){ const a=map.get(e)||[]; a.push(fn); map.set(e,a); return ()=>map.set(e,(map.get(e)||[]).filter(x=>x!==fn)); }, emit(e,p){ (map.get(e)||[]).slice().forEach(fn=>fn(p)); }, count(e){ return (map.get(e)||[]).length; } }; }
function sceneWith(skills){ const eventBus=bus(); const calls={show:0,pause:0,resume:0,float:0}; const scene={ playerData:{skills:skills.map(id=>({id,level:1})),hp:100}, eventBus, passiveUpdaters:[], runState:'RUNNING', getGameplayTime:()=>1000, time:{delayedCall(_d,fn){ return { remove(){}, fire:fn }; }}, afterimages:{list:[],getAll(){return this.list;},createAfterimage(o){ const a={...o,id:this.list.length+1,createdAt:1000}; this.list.push(a); return a;},removeAfterimage(id){this.list=this.list.filter(a=>a.id!==id);}}, player:{x:10,y:20}, floatText(){calls.float+=1;}, beginGameplayPause(){calls.pause+=1;}, resumeModalFlow(){calls.resume+=1;}, upgradePanel:{last:null,show(config){calls.show+=1; this.last=config;},hide(){this.last=null;}}}; const system={scene,passiveUpdaters:[],getLevel(id){return scene.playerData.skills.find(s=>s.id===id)?.level||0;},getData(id){return scene.playerData.skills.find(s=>s.id===id)?{}:null;}}; scene.skillSystem=system; return {scene,system,calls,eventBus}; }
function bind(skills){ const ctx=sceneWith(skills); ctx.off=MyriadAfterimageSkill.bind(ctx.system); return ctx; }

// 1-3: obtain never opens and default/count depends on already owned eligible skills.
let ctx=bind(['myriad_afterimage','fireball']);
ctx.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:1});
assert.equal(ctx.calls.show,0,'obtaining myriad does not auto-open selection');
assert.deepEqual(getMyriadAfterimageDetailState(ctx.scene),{skillId:MYRIAD_NORMAL_ATTACK_ID,skillName:'普通攻击',changeCount:1});
ctx.off();
ctx=bind(['myriad_afterimage']);
assert.deepEqual(getMyriadAfterimageDetailState(ctx.scene),{skillId:MYRIAD_NORMAL_ATTACK_ID,skillName:'普通攻击',changeCount:0});

// 4: later gaining a skill does not grant change count; myriad upgrade does.
ctx.scene.playerData.skills.push({id:'fireball',level:1});
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,0);
ctx.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:2});
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,1);

// 5-6,14-15: upgrades set max 1, repeated detail/wave-like state reads do not accumulate or clear.
ctx.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:3});
ctx.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:4});
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,1);
getMyriadAfterimageDetailState(ctx.scene); getMyriadAfterimageDetailState(ctx.scene);
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,1);

// 7-8: only explicit detail entry opens; candidates include normal and owned eligible skill.
assert.equal(openMyriadAfterimageSelection(ctx.scene),true);
assert.equal(ctx.calls.show,1);
assert.deepEqual(selectionOptions(ctx.system).map(o=>o.skillId),['normal_attack','fireball']);

// 9: ineligible mythic/unsupported/passive-only copy exclusions stay excluded.
ctx=bind(['myriad_afterimage','fireball','time_loan','phantom_step','instant_step','attack_15']);
assert.deepEqual(selectionOptions(ctx.system).map(o=>o.skillId),['normal_attack','fireball']);

// 10-13: close/current choice do not consume; different confirm updates id and consumes; zero count blocks.
ctx=bind(['myriad_afterimage','fireball']);
openMyriadAfterimageSelection(ctx.scene);
const config=ctx.scene.upgradePanel.last;
ctx.scene.upgradePanel.hide();
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,1,'closing selection preserves count');
assert.equal(config.onConfirm({skillId:'normal_attack'}),false,'confirming current is rejected without consuming');
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,1);
assert.equal(config.onConfirm({skillId:'fireball'}),true);
assert.deepEqual(getMyriadAfterimageDetailState(ctx.scene),{skillId:'fireball',skillName:'火球',changeCount:0});
assert.equal(openMyriadAfterimageSelection(ctx.scene),false,'zero count cannot open selection');

// 16: cleanup clears runtime state safely.
ctx.off();
assert.equal('myriadAfterimageSkillId' in ctx.scene.playerData,false);
assert.equal('myriadAfterimageChangeCount' in ctx.scene.playerData,false);
assert.equal(ctx.scene.afterimages.getAll().some(a=>a.ownerSkillId==='myriad_afterimage'),false);

// 17: public copy adapters still expose existing normal / skill / milestone-era copy paths.
for (const id of ['normal_attack','fireball','poison_cloud','spinning_blade','traceless','guardian_shield','thorn_armor']) assert.ok(MyriadAfterimageSkill.copyAdapters[id], `${id} copy adapter remains`);

console.log('v0.10.66 myriad detail selection validation passed.');
