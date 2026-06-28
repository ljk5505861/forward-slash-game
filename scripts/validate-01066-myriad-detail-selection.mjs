import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';
import { CombatEvents } from '../src/core/CombatEvents.js';
import '../src/skills/handlers/index.js';
import { formatSkillSelectionOption } from '../src/ui/selectionFormatters.js';
import { MyriadAfterimageSkill, MYRIAD_NORMAL_ATTACK_ID, getMyriadAfterimageDetailState, selectionOptions, openMyriadAfterimageSelection } from '../src/skills/handlers/AfterimageUltimateSkills.js';

assert.equal(GAME_VERSION,'0.10.69');
globalThis.window??={};
const canvasContext={fillRect(){},drawImage(){},getImageData(){return {data:new Uint8ClampedArray([0,0,0,255])};},putImageData(){},createImageData(){return {data:new Uint8ClampedArray(4)};},clearRect(){}};
globalThis.document??={documentElement:{style:{}},createElement:()=>({getContext:()=>canvasContext,style:{}})};
globalThis.navigator??={userAgent:'node'};
globalThis.HTMLCanvasElement??=class {};
globalThis.Image??=class { set src(_value){ setTimeout(()=>this.onload?.(),0); } };
const { default:UpgradePanel } = await import('../src/ui/UpgradePanel.js');

function bus(){ const map=new Map(); return { on(e,fn){ const a=map.get(e)||[]; a.push(fn); map.set(e,a); return ()=>map.set(e,(map.get(e)||[]).filter(x=>x!==fn)); }, emit(e,p){ (map.get(e)||[]).slice().forEach(fn=>fn(p)); } }; }
function node(x=0,y=0,text=''){ return {x,y,text,width:120,height:40,handlers:{},setOrigin(){return this;},setScrollFactor(){return this;},setDepth(){return this;},setStrokeStyle(){return this;},setInteractive(){return this;},removeAllListeners(){this.handlers={};return this;},destroy(){this.destroyed=true;return this;},on(event,fn){this.handlers[event]=fn;return this;},disableInteractive(){return this;},setAlpha(){return this;},setScale(){return this;},clear(){return this;},fillStyle(){return this;},beginPath(){return this;},moveTo(){return this;},lineTo(){return this;},closePath(){return this;},fillPath(){return this;},lineStyle(){return this;},strokePoints(){return this;},lineBetween(){return this;},fillTriangle(){return this;},setText(value){this.text=value;return this;}}; }
function sceneWith(skills){ const eventBus=bus(); const calls={show:0,pause:0,resume:0,float:0,detail:0}; const scene={ playerData:{skills:skills.map(id=>({id,level:1})),hp:100}, eventBus, passiveUpdaters:[], runState:'RUNNING', getGameplayTime:()=>1000, time:{delayedCall(_d,fn){ return { remove(){}, fire:fn }; }}, afterimages:{list:[],getAll(){return this.list;},createAfterimage(o){ const a={...o,id:this.list.length+1,createdAt:1000}; this.list.push(a); return a;},removeAfterimage(id){this.list=this.list.filter(a=>a.id!==id);}}, player:{x:10,y:20}, floatText(){calls.float+=1;}, beginGameplayPause(){calls.pause+=1;}, resumeModalFlow(){calls.resume+=1; this.runState='RUNNING';}, add:{rectangle:(x,y)=>node(x,y),circle:(x,y)=>node(x,y),text:(x,y,text)=>node(x,y,text),graphics:()=>node()}, tweens:{add(){}}, upgradePanel:null}; const system={scene,passiveUpdaters:[],getLevel(id){return scene.playerData.skills.find(s=>s.id===id)?.level||0;},getData(id){return scene.playerData.skills.find(s=>s.id===id)?{}:null;}}; scene.skillSystem=system; scene.upgradePanel={last:null,show(config){calls.show+=1; this.last=config;},hide(){this.last=null;}}; return {scene,system,calls,eventBus}; }
function bind(skills){ const ctx=sceneWith(skills); ctx.off=MyriadAfterimageSkill.bind(ctx.system); return ctx; }
function clickRealCancel(config, scene){ const panel=new UpgradePanel(scene); panel.show({...config,options:[]}); const cancel=panel.nodes.find(item=>String(item.text||'').includes('取消')); assert.ok(cancel,'real cancel button exists'); cancel.handlers.pointerdown(); assert.equal(panel.isOpen,false,'real cancel click closes the selection panel'); }

// Global passive bind before ownership must not initialize state; later fireball -> myriad obtain gets 1 change.
let ctx=bind([]);
assert.equal('myriadAfterimageSkillId' in ctx.scene.playerData,false);
assert.equal('myriadAfterimageChangeCount' in ctx.scene.playerData,false);
ctx.scene.playerData.skills.push({id:'fireball',level:1});
ctx.scene.playerData.skills.push({id:'myriad_afterimage',level:1});
ctx.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:1});
assert.equal(ctx.calls.show,0,'obtaining myriad does not auto-open selection');
assert.deepEqual(getMyriadAfterimageDetailState(ctx.scene),{skillId:MYRIAD_NORMAL_ATTACK_ID,skillName:'普通攻击',changeCount:1});
ctx.off();

// First obtain without eligible non-normal skills gets 0 and later gaining fireball does not grant until upgrade.
ctx=bind([]);
ctx.scene.playerData.skills.push({id:'myriad_afterimage',level:1});
ctx.eventBus.emit(CombatEvents.STARTING_SKILL_CHOSEN,{skillId:'myriad_afterimage'});
assert.deepEqual(getMyriadAfterimageDetailState(ctx.scene),{skillId:MYRIAD_NORMAL_ATTACK_ID,skillName:'普通攻击',changeCount:0});
ctx.scene.playerData.skills.push({id:'fireball',level:1});
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,0);
ctx.scene.playerData.skills.find(s=>s.id==='myriad_afterimage').level=2;
ctx.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:2});
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,1);

// Upgrades set max 1, repeated detail reads / normal rebind do not recalculate or accumulate.
ctx.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:3});
ctx.eventBus.emit(CombatEvents.UPGRADE_CHOSEN,{skillId:'myriad_afterimage',level:4});
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,1);
getMyriadAfterimageDetailState(ctx.scene); getMyriadAfterimageDetailState(ctx.scene);
const offRebind=MyriadAfterimageSkill.bind(ctx.system);
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,1);
offRebind();
ctx.scene.playerData.myriadAfterimageSkillId='normal_attack'; ctx.scene.playerData.myriadAfterimageChangeCount=1;

// Detail entry opens candidates and excludes ineligible skills.
assert.equal(openMyriadAfterimageSelection(ctx.scene),true);
assert.equal(ctx.calls.show,1);
assert.deepEqual(selectionOptions(ctx.system).map(o=>o.skillId),['normal_attack','fireball']);
ctx=bind(['myriad_afterimage','fireball','time_loan','phantom_step','instant_step','attack_15']);
assert.deepEqual(selectionOptions(ctx.system).map(o=>o.skillId),['normal_attack','fireball']);

// Current markers survive formatting for normal attack and formal skills like fireball.
let formatted=selectionOptions(ctx.system).map(o=>formatSkillSelectionOption(o,ctx.scene.playerData));
assert.equal(formatted[0].title,'普通攻击（当前）');
assert.equal(formatted[0].subtitle,'当前');
ctx.scene.playerData.myriadAfterimageSkillId='fireball';
formatted=selectionOptions(ctx.system).map(o=>formatSkillSelectionOption(o,ctx.scene.playerData));
assert.equal(formatted.find(o=>o.skillId==='fireball').title,'火球（当前）');
assert.equal(formatted.find(o=>o.skillId==='fireball').subtitle,'当前');

// Real cancel button: preserves state/count, restores modal, exits selection, and returns to detail.
ctx.scene.playerData.myriadAfterimageSkillId='normal_attack'; ctx.scene.playerData.myriadAfterimageChangeCount=1; ctx.scene.runState='RUNNING';
openMyriadAfterimageSelection(ctx.scene,()=>{ ctx.calls.detail+=1; });
const cancelConfig=ctx.scene.upgradePanel.last;
clickRealCancel(cancelConfig,ctx.scene);
assert.deepEqual(getMyriadAfterimageDetailState(ctx.scene),{skillId:'normal_attack',skillName:'普通攻击',changeCount:1});
assert.equal(ctx.scene.runState,'RUNNING');
assert.equal(ctx.calls.resume,1);
assert.equal(ctx.calls.detail,1);

// Current choice does not consume and does not trap the player; then different confirm consumes and zero count blocks.
openMyriadAfterimageSelection(ctx.scene);
const config=ctx.scene.upgradePanel.last;
assert.equal(config.onConfirm({skillId:'normal_attack'}),false,'confirming current is rejected without consuming');
assert.equal(getMyriadAfterimageDetailState(ctx.scene).changeCount,1);
config.onCancel();
assert.equal(ctx.scene.runState,'RUNNING');
openMyriadAfterimageSelection(ctx.scene);
assert.equal(ctx.scene.upgradePanel.last.onConfirm({skillId:'fireball'}),true);
assert.deepEqual(getMyriadAfterimageDetailState(ctx.scene),{skillId:'fireball',skillName:'火球',changeCount:0});
assert.equal(openMyriadAfterimageSelection(ctx.scene),false,'zero count cannot open selection');

// Cleanup clears runtime state safely.
ctx.off();
assert.equal('myriadAfterimageSkillId' in ctx.scene.playerData,false);
assert.equal('myriadAfterimageChangeCount' in ctx.scene.playerData,false);
assert.equal(ctx.scene.afterimages.getAll().some(a=>a.ownerSkillId==='myriad_afterimage'),false);

// Existing copy adapters remain available.
for (const id of ['normal_attack','fireball','poison_cloud','spinning_blade','traceless','guardian_shield','thorn_armor']) assert.ok(MyriadAfterimageSkill.copyAdapters[id], `${id} copy adapter remains`);

console.log('v0.10.69 myriad detail selection validation passed.');
