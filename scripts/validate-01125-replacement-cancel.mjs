import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import UpgradeSystem, { RewardSources } from '../src/systems/UpgradeSystem.js';
import { SKILLS } from '../src/config/skills.js';
import { MAX_SKILL_SLOTS } from '../src/systems/SkillSystem.js';
import { SelectionState, resolveSelectionMode, formatSkillSelectionOption, formatArtifactSelectionOption, SELECTION_ICON_STYLE } from '../src/ui/selectionFormatters.js';
function node(kind,args){
  let proxy;
  const target={kind,x:args[0],y:args[1],text:kind==='text'?args[2]:'',height:28,callbacks:{},
    on(event,fn){this.callbacks[event]=fn;return proxy;},removeAllListeners(){this.callbacks={};},destroy(){this.dead=true;}};
  proxy=new Proxy(target,{get(o,k){return k in o?o[k]:(()=>proxy);}});return proxy;
}
const source=fs.readFileSync(process.env.REPLACEMENT_PANEL_SOURCE || new URL('../src/ui/UpgradePanel.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default class','class')+'\nUpgradePanel;';
const UpgradePanel=vm.runInNewContext(source,{DESIGN_WIDTH:720,DESIGN_HEIGHT:1280,SKILLS,MAX_SKILL_SLOTS,SelectionState,resolveSelectionMode,formatSkillSelectionOption,formatArtifactSelectionOption,SELECTION_ICON_STYLE,drawRarityFrame(){},rarityStyle:()=>({}),makeInteractive:n=>n,centeredHitArea:()=>({})});
for(const runMode of ['normal','test']) for(const slot of [4,5]){
  const ids=['fireball','poison_cloud','shadow_fist','spinning_blade','healing','parasitic_gu'];
  const scene={runMode,playerData:{level:8,gold:37,skills:ids.map(id=>({id,level:1})),upgradesChosen:[]},
    add:Object.fromEntries(['text','rectangle','graphics','circle'].map(kind=>[kind,(...args)=>node(kind,args)])),
    tweens:{add(){}},events:{once(){},off(){}},beginGameplayPause(){this.paused=true;},
    resumeModalFlow(){this.resumes=(this.resumes||0)+1;this.paused=false;},eventBus:{emit(){}},
    stageSystem:{onSkillRewardClosed(){scene.advances=(scene.advances||0)+1;}},
    skillSystem:{addOrLevel(id){const own=scene.playerData.skills.find(s=>s.id===id);if(own){own.level++;return {applied:true};}return {needsReplacement:true};},replaceSkill(index,id){scene.playerData.skills[index]={id,level:1};return {applied:true};}}};
  scene.upgradePanel=new UpgradePanel(scene);scene.upgradeSystem=new UpgradeSystem(scene);
  const options=[{type:'newSkill',id:'new_sword_wave',skillId:'sword_wave'},{type:'skillLevel',id:'lv_fireball',skillId:'fireball',nextLevel:2},{type:'newSkill',id:'new_black_hole',skillId:'black_hole'}];
  scene.upgradeSystem.rollOptions=()=>options;
  scene.upgradeSystem.requestSkillReward();
  const p=scene.upgradePanel, before=JSON.stringify(scene.playerData);
  for(let attempt=0;attempt<3;attempt++){
    // Real panel select -> confirm -> real UpgradeSystem -> replacement panel.
    p.select(0);p.select(0);
    assert(scene.upgradeSystem.pendingReplacement,'pending replacement exists');
    const cancel=p.nodes.find(n=>n.text==='取消 / 返回');
    assert(cancel,'replacement cancel survives originating confirmation callback');
    assert.equal(p.nodes.filter(n=>n.kind==='rectangle'&&n.callbacks.pointerdown).length,6,'all six slots rendered');
    const oldNodes=p.nodes.slice();cancel.callbacks.pointerdown();
    assert.equal(scene.upgradeSystem.pendingReplacement,null);
    assert.deepEqual(p.options,options,'same three rewards, no reroll');
    assert.equal(scene.upgradeSystem.pending,1,'reward retained');
    assert.equal(JSON.stringify(scene.playerData),before,'cancel changes no skills, gold or choices');
    assert.equal(scene.advances||0,0);assert(scene.paused);assert(oldNodes.every(n=>n.dead));
  }
  if(slot===4){p.select(1);p.select(1);assert.equal(scene.playerData.skills[0].level,2,'choose a different reward after cancelling');}
  else {p.select(0);p.select(0);const slots=p.nodes.filter(n=>n.kind==='rectangle'&&n.callbacks.pointerdown);slots[slot].callbacks.pointerdown();assert.equal(scene.playerData.skills[slot].id,'sword_wave');}
  assert.equal(scene.upgradeSystem.pending,0);assert.equal(scene.advances,1);assert.equal(scene.resumes,1);assert(!p.isOpen);
}
// A genuine rejected choice still reopens its original options.
{
 const scene={playerData:{skills:[]},add:Object.fromEntries(['text','rectangle','graphics','circle'].map(kind=>[kind,(...args)=>node(kind,args)])),tweens:{add(){}},events:{once(){},off(){}}};
 const p=new UpgradePanel(scene);p.show({options:[{type:'newSkill',skillId:'fireball'}],onConfirm:()=>false});p.select(0);p.select(0);assert(p.isOpen);assert.equal(p.options[0].skillId,'fireball');
}
console.log('PASS: real reward-panel replacement transition, repeated cancel, unchanged rewards/resources, six slots, alternative reward, completion and rejected choice fallback');
