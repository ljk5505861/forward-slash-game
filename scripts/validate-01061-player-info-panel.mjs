import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';


globalThis.window={ cordova: undefined, navigator:{ userAgent:'' }, addEventListener(){}, removeEventListener(){}, location:{search:''} };
const canvasContext=new Proxy({}, { get:(target,prop)=> prop==='getImageData' ? (()=>({data:[0,0,0,0]})) : (()=>{}) });
globalThis.document={ documentElement:{}, createElement:()=>({ getContext:()=>canvasContext, style:{}, addEventListener(){}, removeEventListener(){} }), addEventListener(){}, removeEventListener(){}, body:{} };
globalThis.HTMLCanvasElement=class {};
globalThis.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } };
Object.defineProperty(globalThis, 'navigator', { value: globalThis.window.navigator, configurable:true });
const [{ default: PlayerInfoPanel }, { createPlayerRuntime }, { GAME_VERSION }] = await Promise.all([
  import('../src/ui/PlayerInfoPanel.js'),
  import('../src/config/balance.js'),
  import('../src/config/version.js')
]);
assert.equal(GAME_VERSION,'0.10.61');
const src = readFileSync(new URL('../src/ui/PlayerInfoPanel.js', import.meta.url),'utf8');
assert.doesNotMatch(src,/SKILLS/,'PlayerInfoPanel no longer imports/reads SKILLS');
assert.doesNotMatch(src,/playerData\.skills|p\.skills/,'second page no longer reads playerData.skills');
assert.match(src,/setInteractive\(\)/,'full-screen mask is interactive');
assert.match(src,/REFRESH_INTERVAL_MS=100/,'refresh interval is 100ms');

class Node { constructor(text=''){ this.text=text; this.destroyed=false; this.depth=0; this.input=null; this.listeners={}; }
  setScrollFactor(){return this} setDepth(d){this.depth=d;return this} setStrokeStyle(){return this} setOrigin(){return this}
  setInteractive(){this.input={enabled:true};return this} on(e,fn){this.listeners[e]=fn;return this} removeAllListeners(){this.listeners={};return this}
  destroy(){this.destroyed=true} setText(t){this.text=t;return this}
}
function makeScene(){ const scene={ playerData:createPlayerRuntime(), killCount:0, runState:'RUNNING', paused:0, resumed:0,
  beginGameplayPause(){this.paused++}, resumeModalFlow(){this.resumed++},
  stageSystem:{phase:()=>({name:'测试阶段'})}, artifactSystem:{highHpDamageMultiplier:()=>1},
  add:{ text:(x,y,t)=>new Node(t), rectangle:()=>new Node('rect') }
}; return scene; }

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
panel.hide(); const oldText=hpNode.text; p.hp=1; panel.update(1000); assert.equal(hpNode.text,oldText,'closed panel does not update old nodes');
for(let i=0;i<10;i++){ panel.show(); panel.hide(); } assert.equal(panel.nodes.length,0);

s=makeScene(); s.playerData.skills=[{id:'fireball',level:9},{id:'last_stand',level:9}]; s.playerData.artifacts=['jade']; s.playerData.professionId='warrior'; panel=new PlayerInfoPanel(s); panel.show(); panel.flip(1);
const page2=[...panel.valueNodes.values()].map(n=>n.text).join('\n');
assert.doesNotMatch(page2,/技能：|fireball|last_stand/); assert.match(page2,/职业：|法宝：/);

const game = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url),'utf8');
assert.match(game,/isRewardChoiceModalOpen\(\).*upgradePanel\?\.isOpen.*artifactRewardPanel\?\.isOpen.*professionPanel\?\.isOpen/s);
assert.match(game,/hasBlockingModal\(\)&&!this\.isRewardChoiceModalOpen\(\)/);
assert.match(game,/setDepth\(4250\)/,'role button depth is 4250');
assert.match(game,/playerInfoPanel\?\.update\(time\)/,'GameScene update calls PlayerInfoPanel.update');
console.log('validate-01061-player-info-panel behavior passed.');
