import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window={ cordova: undefined, navigator:{ userAgent:'' }, addEventListener(){}, removeEventListener(){}, location:{search:''}, updateGameDebugStatus(){} };
const canvasContext=new Proxy({}, { get:(target,prop)=> prop==='getImageData' ? (()=>({data:[0,0,0,0]})) : (()=>{}) });
globalThis.document={ documentElement:{}, createElement:()=>({ getContext:()=>canvasContext, style:{}, addEventListener(){}, removeEventListener(){} }), addEventListener(){}, removeEventListener(){}, body:{} };
globalThis.HTMLCanvasElement=class {};
globalThis.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } };
Object.defineProperty(globalThis, 'navigator', { value: globalThis.window.navigator, configurable:true });
const [
  { default: PlayerInfoPanel },
  { default: UpgradePanel },
  { default: ArtifactRewardPanel },
  { default: ProfessionPanel },
  { SelectionState },
  { createPlayerRuntime },
  { GAME_VERSION }
] = await Promise.all([
  import('../src/ui/PlayerInfoPanel.js'),
  import('../src/ui/UpgradePanel.js'),
  import('../src/ui/ArtifactRewardPanel.js'),
  import('../src/ui/ProfessionPanel.js'),
  import('../src/ui/selectionFormatters.js'),
  import('../src/config/balance.js'),
  import('../src/config/version.js')
]);
assert.equal(GAME_VERSION,'0.11.0');
assert.equal(new SelectionState().selectedIndex,-1,'SelectionState is instantiated through the real class');

const src = readFileSync(new URL('../src/ui/PlayerInfoPanel.js', import.meta.url),'utf8');
assert.doesNotMatch(src,/SKILLS/,'PlayerInfoPanel no longer imports/reads SKILLS');
assert.doesNotMatch(src,/playerData\.skills|p\.skills/,'second page no longer reads playerData.skills');
assert.match(src,/setInteractive\(\)/,'full-screen mask is interactive');
assert.match(src,/REFRESH_INTERVAL_MS=100/,'refresh interval is 100ms');

let nextNodeId=1;
class Node { constructor(text=''){ this.text=text; this.destroyed=false; this.destroyCount=0; this.depth=0; this.input=null; this.listeners={}; this.id=nextNodeId++; this.x=0; this.y=0; this.alpha=1; this.style={}; }
  setScrollFactor(){return this} setDepth(d){this.depth=d;return this} setStrokeStyle(){return this} setOrigin(){return this}
  setInteractive(){this.input={enabled:true};return this} disableInteractive(){ if(this.input) this.input.enabled=false; return this; } clear(){return this} fillStyle(){return this} beginPath(){return this} moveTo(){return this} lineTo(){return this} closePath(){return this} fillPath(){return this} lineStyle(){return this} strokePoints(){return this} lineBetween(){return this} fillTriangle(){return this}
  on(e,fn){this.listeners[e]=fn;return this} removeAllListeners(){this.listeners={};return this}
  destroy(){this.destroyed=true; this.destroyCount+=1} setText(t){this.text=t;return this} setAlpha(v){this.alpha=v;return this}
}
function addNode(scene,node,x=0,y=0,style={}){ node.x=x; node.y=y; node.style=style; scene.createdNodes.push(node); return node; }
function makeScene(){ const scene={ playerData:createPlayerRuntime(), killCount:0, runState:'RUNNING', paused:0, resumed:0, debugMode:false, createdNodes:[], campfirePanelOpen:false,
  beginGameplayPause(){this.paused++}, resumeModalFlow(){this.resumed++}, onProfessionPanelClosed(){this.professionClosed=(this.professionClosed||0)+1},
  stageSystem:{phase:()=>({name:'测试阶段'})}, artifactSystem:{highHpDamageMultiplier:()=>1}, tweens:{add(){}},
  add:{ text:(x,y,t,style={})=>addNode(scene,new Node(t),x,y,style), rectangle:(x,y)=>addNode(scene,new Node('rect'),x,y), circle:(x,y)=>addNode(scene,new Node('circle'),x,y), graphics:()=>addNode(scene,new Node('graphics')) }
}; return scene; }
function attachGameSceneOpenLogic(scene){ scene.isRewardChoiceModalOpen=function(){ return !!(this.upgradePanel?.isOpen||this.artifactRewardPanel?.isOpen||this.professionPanel?.isOpen); }; scene.hasNonRewardBlockingModal=function(){ return !!(this.resultPanel?.isOpen||this.playtestPanel?.isOpen||this.restPanel?.isOpen||this.shopPanel?.isOpen||this.campfirePanelOpen||(this.upgradeSystem?.panelOpen&&!this.upgradePanel?.isOpen)); }; scene.openPlayerInfoPanel=function(){ if(this.playerInfoPanel?.isOpen) return false; if(this.hasNonRewardBlockingModal()) return false; if(this.hasBlockingModal()&&!this.isRewardChoiceModalOpen()) return false; this.playerInfoPanel?.show(); return true; }; scene.hasBlockingModal=function(){ return !!(this.upgradePanel?.isOpen||this.artifactRewardPanel?.isOpen||this.resultPanel?.isOpen||this.playtestPanel?.isOpen||this.restPanel?.isOpen||this.professionPanel?.isOpen||this.playerInfoPanel?.isOpen||this.shopPanel?.isOpen||this.upgradeSystem?.panelOpen); }; return scene; }

let s=makeScene(); let p=s.playerData; let panel=new PlayerInfoPanel(s);
panel.show();
assert.equal(panel.isOpen,true);
assert.equal(s.paused,1);
assert.equal(panel.valueNodes.get('attack').text,'攻击力：10（基础10＋力量0）');
p.strengthBonuses.test=4; panel.render();
assert.equal(panel.valueNodes.get('attack').text,'攻击力：14（基础10＋力量4）');
assert.equal(panel.valueNodes.get('strength').text,'力量：4');
assert.equal(p.attack,10,'display does not mutate base attack');
p.strength=10; panel.render();
assert.equal(panel.valueNodes.get('attack').text,'攻击力：24（基础10＋力量14）');
assert.equal(panel.valueNodes.get('strength').text,'力量：14');
const attackNode=panel.valueNodes.get('attack'), strengthNode=panel.valueNodes.get('strength');
assert.equal(attackNode._layout.fullWidth,true,'attack row is marked as full width');
assert.ok(attackNode._layout.width>=500,'attack row has at least 500px available width');
assert.notEqual(attackNode._layout.y,strengthNode._layout.y,'attack and strength are not on the same row');
for(const n of panel.content) assert.ok((n.y??442)<=900,'page content stays within visible panel area');
const sameAttackNode=attackNode; p.strengthBonuses.test=8; panel.render(); assert.equal(panel.valueNodes.get('attack'),sameAttackNode,'attack node is reused during strength updates');

p.critChance=.05; p.physicalCritChanceBonuses.last_stand=.50;
p.critMultiplier=1.5; p.physicalCritMultiplierBonuses.last_stand=1.5;
p.physicalLifeStealBonuses.bloodthirst=.12;
p.attackSpeedMultiplierBonuses={}; p.defenseBonuses={}; p.dodgeChanceBonuses={};
p.attackSpeedMultiplierBonuses.swift=.25; p.defenseBonuses.armor=7; p.dodgeChanceBonuses.dodge=.2;
p.hp=77; p.mana=33; const hpNode=panel.valueNodes.get('hp'); const count=panel.nodes.length; const contentCount=panel.content.length;
panel.update(99); assert.equal(hpNode.text,'当前生命：500','does not refresh before interval');
panel.update(101);
assert.equal(hpNode.text,'当前生命：77');
assert.equal(panel.valueNodes.get('critChance').text,'暴击率：55%');
assert.equal(panel.valueNodes.get('critMultiplier').text,'暴击伤害：300%');
assert.equal(panel.valueNodes.get('lifeSteal').text,'吸血：12%');
assert.equal(panel.valueNodes.get('attackSpeed').text,'攻击速度：125%');
assert.equal(panel.valueNodes.get('defense').text,'护甲：7');
assert.equal(panel.valueNodes.get('dodge').text,'闪避率：20%');
assert.equal(panel.valueNodes.get('hp'),hpNode,'text node object is reused');
assert.equal(panel.nodes.length,count); assert.equal(panel.content.length,contentCount);
for(let i=0;i<100;i++) panel.update(202+i);
assert.equal(panel.nodes.length,count,'unchanged data does not rebuild nodes');

const firstPageNodeCount=panel.nodes.length;
panel.flip(1); const secondPageNodeCount=panel.nodes.length;
const page2Text=panel.valueNodes.get('buildText').text;
assert.notEqual(page2Text[0],'：','second page does not start with an extra colon');
assert.ok(page2Text.startsWith('当前阶段：'),'second page starts with current phase');
assert.match(page2Text,/职业：/); assert.match(page2Text,/法宝：/); assert.doesNotMatch(page2Text,/技能：|fireball|last_stand/);
for(let i=0;i<100;i++) panel.flip(i%2?1:-1);
assert.ok([firstPageNodeCount,secondPageNodeCount].includes(panel.nodes.length),'nodes count remains at a stable page size after repeated flips');
assert.equal(panel.nodes.some(n=>n.destroyed),false,'destroyed page nodes are removed from nodes');
panel.hide();
assert.equal(new Set(s.createdNodes.filter(n=>n.destroyed)).size,s.createdNodes.filter(n=>n.destroyed).length,'hide does not duplicate-destroy retained nodes');
assert.equal(s.createdNodes.some(n=>n.destroyCount>1),false,'no node is destroyed more than once');
assert.equal(panel.nodes.length,0); assert.equal(panel.content.length,0); assert.equal(panel.valueNodes.size,0); assert.equal(panel.valueSnapshot.size,0);
const oldText=hpNode.text; p.hp=1; panel.update(1000); assert.equal(hpNode.text,oldText,'closed panel does not update old nodes');
for(let i=0;i<10;i++){ panel.show(); panel.hide(); } assert.equal(panel.nodes.length,0);

function skillOptions(){ return [{skillId:'fireball',level:1,type:'skill'},{skillId:'lightning',level:1,type:'skill'},{skillId:'spinning_blade',level:1,type:'skill'}]; }
function artifactOptions(){ return [{artifactId:'blood_jade',id:'blood_jade'},{artifactId:'thunder_orb',id:'thunder_orb'},{artifactId:'whetstone',id:'whetstone'}]; }
function wrapPanelCounters(panel){ const counts={show:0,hide:0,select:0}; const show=panel.show.bind(panel), hide=panel.hide.bind(panel), select=panel.select.bind(panel); panel.show=(...a)=>{counts.show++; return show(...a);}; panel.hide=(...a)=>{counts.hide++; return hide(...a);}; panel.select=(...a)=>{counts.select++; return select(...a);}; return counts; }
function assertChoicePreserved({scene,choicePanel,counts,options,selectedIndex=1}){ const optionRefs=options.slice(0,3); choicePanel.select(selectedIndex); assert.equal(choicePanel.state.selectedIndex,selectedIndex); counts.show=0; counts.hide=0; counts.select=0; const ok=scene.openPlayerInfoPanel(); assert.equal(ok,true); assert.equal(scene.playerInfoPanel.isOpen,true); assert.equal(choicePanel.isOpen,true); assert.equal(choicePanel.options,options); assert.deepEqual(choicePanel.options.slice(0,3),optionRefs); assert.equal(choicePanel.state.selectedIndex,selectedIndex); assert.equal(counts.show,0,'opening player info does not re-show choice panel'); assert.equal(counts.hide,0,'opening player info does not hide choice panel'); scene.playerInfoPanel.hide(); assert.equal(choicePanel.isOpen,true); assert.equal(choicePanel.state.selectedIndex,selectedIndex); choicePanel.select(selectedIndex); assert.equal(choicePanel.isOpen,false,'second click confirms original card'); }
function makeChoiceScene(){ const sc=attachGameSceneOpenLogic(makeScene()); sc.playerInfoPanel=new PlayerInfoPanel(sc); sc.resultPanel={isOpen:false}; sc.playtestPanel={isOpen:false}; sc.restPanel={isOpen:false}; sc.shopPanel={isOpen:false}; sc.upgradeSystem={panelOpen:false}; return sc; }

// Starting skill choice.
s=makeChoiceScene(); s.upgradePanel=new UpgradePanel(s); s.artifactRewardPanel={isOpen:false}; s.professionPanel={isOpen:false}; let options=skillOptions(); let confirmed=0; let counts=wrapPanelCounters(s.upgradePanel); s.upgradePanel.show({title:'',hideTitle:true,options,onConfirm:()=>{confirmed++;}}); assert.equal(s.upgradePanel.isOpen,true); assertChoicePreserved({scene:s,choicePanel:s.upgradePanel,counts,options}); assert.equal(confirmed,1);
// Normal skill choice.
s=makeChoiceScene(); s.upgradePanel=new UpgradePanel(s); s.artifactRewardPanel={isOpen:false}; s.professionPanel={isOpen:false}; s.upgradeSystem.panelOpen=true; options=skillOptions(); confirmed=0; counts=wrapPanelCounters(s.upgradePanel); s.upgradePanel.show('升级奖励',options,()=>{confirmed++;}); assertChoicePreserved({scene:s,choicePanel:s.upgradePanel,counts,options}); assert.equal(confirmed,1);
// Artifact choice.
s=makeChoiceScene(); s.upgradePanel={isOpen:false}; s.artifactRewardPanel=new ArtifactRewardPanel(s); s.professionPanel={isOpen:false}; options=artifactOptions(); confirmed=0; counts=wrapPanelCounters(s.artifactRewardPanel); s.artifactRewardPanel.show({title:'获得一个法宝奖励',options,onConfirm:()=>{confirmed++;}}); assertChoicePreserved({scene:s,choicePanel:s.artifactRewardPanel,counts,options}); assert.equal(confirmed,1);
// Initial profession choice.
s=makeChoiceScene(); s.upgradePanel={isOpen:false}; s.artifactRewardPanel={isOpen:false}; s.professionPanel=new ProfessionPanel(s); confirmed=0; counts=wrapPanelCounters(s.professionPanel); s.professionPanel.show(()=>{confirmed++;}); options=s.professionPanel.options; assertChoicePreserved({scene:s,choicePanel:s.professionPanel,counts,options}); assert.equal(confirmed,1);
// Advanced profession choice.
s=makeChoiceScene(); s.playerData.professionId='warrior'; s.upgradePanel={isOpen:false}; s.artifactRewardPanel={isOpen:false}; s.professionPanel=new ProfessionPanel(s); confirmed=0; counts=wrapPanelCounters(s.professionPanel); s.professionPanel.show(()=>{confirmed++;},{advanced:true}); options=s.professionPanel.options; assertChoicePreserved({scene:s,choicePanel:s.professionPanel,counts,options}); assert.equal(confirmed,1);

// Click-through/depth.
s=makeChoiceScene(); s.upgradePanel=new UpgradePanel(s); s.artifactRewardPanel={isOpen:false}; s.professionPanel={isOpen:false}; options=skillOptions(); counts=wrapPanelCounters(s.upgradePanel); s.upgradePanel.show('升级奖励',options,()=>{}); s.openPlayerInfoPanel(); const before=counts.select; s.playerInfoPanel.mask.listeners.pointerdown?.({x:360,y:1000}); s.playerInfoPanel.mask.listeners.pointerup?.({x:360,y:1000}); assert.equal(counts.select,before,'mask click does not select underlying card'); assert.ok(s.playerInfoPanel.mask.depth>Math.max(...s.upgradePanel.cards.flatMap(c=>c.nodes.map(n=>n.depth)))); assert.ok(Math.max(...s.playerInfoPanel.nodes.map(n=>n.depth))>s.playerInfoPanel.mask.depth); s.playerInfoPanel.hide(); s.upgradePanel.select(0); assert.equal(counts.select,before+1,'after close, card select works normally');

// Non-reward blocking modals always win, even with stale reward state.
for(const key of ['resultPanel','shopPanel','restPanel','playtestPanel']){ s=makeChoiceScene(); s.upgradePanel={isOpen:true}; s.artifactRewardPanel={isOpen:false}; s.professionPanel={isOpen:false}; s[key]={isOpen:true}; assert.equal(s.openPlayerInfoPanel(),false,`${key} blocks player info over stale reward panel`); }
s=makeChoiceScene(); s.upgradePanel={isOpen:true}; s.artifactRewardPanel={isOpen:false}; s.professionPanel={isOpen:false}; s.campfirePanelOpen=true; assert.equal(s.openPlayerInfoPanel(),false,'campfire blocks player info over stale reward panel');
s=makeChoiceScene(); s.upgradePanel={isOpen:false}; s.artifactRewardPanel={isOpen:false}; s.professionPanel={isOpen:false}; s.upgradeSystem.panelOpen=true; assert.equal(s.openPlayerInfoPanel(),false,'stale upgradeSystem.panelOpen without UpgradePanel is not an allowed reward choice');

const game = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url),'utf8');
assert.match(game,/hasNonRewardBlockingModal\(\)/);
assert.match(game,/setDepth\(4250\)/,'role button depth is 4250');
assert.match(game,/playerInfoPanel\?\.update\(time\)/,'GameScene update calls PlayerInfoPanel.update');
console.log('validate-01061-player-info-panel behavior passed.');
