import assert from 'node:assert/strict';
import { GAME_VERSION } from '../src/config/version.js';

assert.equal(GAME_VERSION,'0.11.5');
globalThis.window??={};
const canvasContext={fillRect(){},drawImage(){},getImageData(){return {data:new Uint8ClampedArray([0,0,0,255])};},putImageData(){},createImageData(){return {data:new Uint8ClampedArray(4)};},clearRect(){}};
globalThis.document??={documentElement:{style:{}},createElement:()=>({getContext:()=>canvasContext,style:{}})};
globalThis.navigator??={userAgent:'iPhone Safari',appVersion:'OS 18_0'};
globalThis.HTMLCanvasElement??=class {};
globalThis.Image??=class { set src(_value){ setTimeout(()=>this.onload?.(),0); } };

await import('../src/skills/handlers/index.js');
const { default: SkillBar } = await import('../src/ui/SkillBar.js');

function node(type,x=0,y=0,text=''){
  return {type,x,y,text,width:120,height:40,children:[],handlers:{},depth:0,destroyed:false,interactive:false,originX:0.5,originY:0.5,
    setOrigin(x=0.5,y=x){this.originX=x; this.originY=y; return this;},setScrollFactor(){return this;},setDepth(v){this.depth=v;return this;},setStrokeStyle(){return this;},setFillStyle(){return this;},setVisible(v){this.visible=v;return this;},setMask(v){this.mask=v;return this;},setText(v){this.text=v;return this;},
    setInteractive(shape,contains){this.interactive=true; if(shape?.useHandCursor){ this.hitArea={x:0,y:0,width:this.width,height:this.height}; this.hitAreaCallback=(area,localX,localY)=>localX>=area.x&&localY>=area.y&&localX<=area.x+area.width&&localY<=area.y+area.height; } else { this.hitArea=shape; this.hitAreaCallback=contains; } return this;},disableInteractive(){this.interactive=false;return this;},
    on(event,fn){this.handlers[event]=fn;return this;},removeAllListeners(){this.handlers={};return this;},destroy(){this.destroyed=true;return this;},
    createGeometryMask(){return {destroy(){this.destroyed=true;}};},add(items){(Array.isArray(items)?items:[items]).forEach(item=>this.children.push(item));return this;},
    getBounds(){return {x:this.x-this.width/2,y:this.y-this.height/2,width:this.width,height:this.height};}
  };
}
function textNode(x,y,text,style){ const n=node('text',x,y,text); n.height=String(text).split('\n').length*((parseInt(style?.fontSize)||20)+(style?.lineSpacing||0)); n.width=style?.wordWrap?.width||120; return n; }
function makeScene({changeCount=1,getData=true}={}){
  const calls={show:0,pause:0,resume:0};
  const scene={playerData:{skills:[{id:'myriad_afterimage',level:1},{id:'fireball',level:1}],hp:100,myriadAfterimageSkillId:'normal_attack',myriadAfterimageChangeCount:changeCount},
    getGameplayTime:()=>1000, player:{x:10,y:20}, time:{delayedCall(){return {remove(){}};}}, upgradeSystem:null,
    beginGameplayPause(){calls.pause+=1;}, resumeModalFlow(){calls.resume+=1; this.runState='RUNNING';}, floatText(){},
    add:{rectangle:(x,y,w,h)=>{const n=node('rect',x,y); n.width=w; n.height=h; return n;}, text:textNode, container:(x,y)=>node('container',x,y)},
    upgradePanel:{last:null,show(config){calls.show+=1; this.last=config;},hide(){this.last=null;}}
  };
  scene.skillSystem={cooldowns:new Map(),passiveState:{},getData(id){return getData&&scene.playerData.skills.some(skill=>skill.id===id)?{}:null;},getLevel(id){return scene.playerData.skills.find(skill=>skill.id===id)?.level||0;},scene};
  return {scene,calls};
}
function openDetail(opts){ const {scene,calls}=makeScene(opts); const bar=new SkillBar(scene); bar.showDetail(0); return {bar,scene,calls}; }
function localPoint(node,worldX,worldY){ return {localX:worldX-(node.x-node.width*node.originX),localY:worldY-(node.y-node.height*node.originY)}; }
function hitTest(node,worldX,worldY){ const {localX,localY}=localPoint(node,worldX,worldY); return !!node.hitAreaCallback?.(node.hitArea,localX,localY); }
function dispatchPointerDownIfHit(node,pointer,event){ if(!hitTest(node,pointer.x,pointer.y)) return false; const {localX,localY}=localPoint(node,pointer.x,pointer.y); node.handlers.pointerdown?.(pointer,localX,localY,event); return true; }

let {bar,scene,calls}=openDetail();
const detail=bar.detail;
assert.ok(detail.copyButton,'myriad detail creates fixed copy button');
assert.equal(detail.body.children.includes(detail.copyButton.bg),false,'button background is not inside scroll body container');
assert.equal(detail.body.children.includes(detail.copyButton.label),false,'button label is not inside scroll body container');
assert.ok(detail.copyButton.bg.interactive,'enabled button has independent interactive background');
assert.deepEqual(detail.copyButton.bg.hitArea,{x:0,y:0,width:660,height:116},'default rectangle hitArea starts at local 0,0 and covers the full button');
assert.ok(hitTest(detail.copyButton.bg,31,787),'left-top inside point hits the button');
assert.ok(hitTest(detail.copyButton.bg,360,844),'center point hits the button');
assert.ok(hitTest(detail.copyButton.bg,689,901),'right-bottom inside point hits the button');
assert.equal(hitTest(detail.copyButton.bg,29,844),false,'left outside point misses the button');
assert.equal(hitTest(detail.copyButton.bg,691,844),false,'right outside point misses the button');
assert.equal(hitTest(detail.copyButton.bg,360,785),false,'top outside point misses the button');
assert.equal(hitTest(detail.copyButton.bg,360,903),false,'bottom outside point misses the button');
assert.ok(detail.copyButton.bg.depth>detail.body.depth,'button background is above scrolling body');
assert.ok(detail.copyButton.label.depth>detail.body.depth,'button label is above scrolling body');
assert.equal(detail.maxScroll,Math.max(0,detail.bodyText.height-300),'maxScroll uses reserved fixed-button body height');

let stopped=0;
assert.equal(dispatchPointerDownIfHit(detail.copyButton.bg,{id:7,x:360,y:844},{stopPropagation(){stopped+=1;}}),true,'center hit dispatches pointerdown');
assert.equal(stopped,1,'Phaser event parameter stops propagation on pointerdown');
assert.equal(calls.show,1,'button click opens myriad selection panel');
assert.equal(bar.detail,null,'button click closes detail before selection opens');
assert.ok(scene.upgradePanel.last,'selection panel is open after detail closes');

scene.upgradePanel.last.onCancel();
assert.ok(bar.detail,'cancel returns to refreshed skill detail');
assert.equal(scene.playerData.myriadAfterimageChangeCount,1,'cancel does not consume change count');
scene.upgradePanel.last=null;
assert.equal(dispatchPointerDownIfHit(bar.detail.copyButton.bg,{id:8,x:360,y:844},{stopPropagation(){}}),true,'confirmed replacement click is dispatched only after hit test');
assert.equal(scene.upgradePanel.last.onConfirm({skillId:'fireball'}),true,'confirming replacement succeeds');
assert.equal(scene.playerData.myriadAfterimageSkillId,'fireball');
assert.equal(scene.playerData.myriadAfterimageChangeCount,0);
assert.ok(bar.detail,'confirm returns to refreshed skill detail');
assert.match(bar.detail.copyButton.label.text,/当前复制：火球/);
assert.match(bar.detail.copyButton.label.text,/剩余更换次数：0/);

({bar}=openDetail({changeCount:0}));
assert.ok(!bar.detail.copyButton.bg.handlers.pointerdown,'zero-count button has no pointerdown handler');
assert.match(bar.detail.copyButton.label.text,/暂无更换次数/);

({bar,scene}=openDetail());
bar.startScroll({id:1,x:360,y:844});
assert.equal(bar.detail.isDragging,false,'pointerdown inside button bounds does not start dragging');
bar.startScroll({id:2,x:300,y:300});
assert.equal(bar.detail.isDragging,true,'body pointerdown still starts scroll');
bar.dragScroll({id:2,x:300,y:240});
assert.ok(bar.detail.scrollY>=0,'body drag path remains active');
const before=bar.detail.scrollY;
bar.endScroll({id:2,x:300,y:240});
assert.equal(bar.detail.isDragging,false);
bar.startScroll({id:3,x:300,y:300});
bar.dragScroll({id:3,x:360,y:844});
bar.endScroll({id:3,x:360,y:844});
assert.equal(scene.upgradePanel.last,null,'scrolling body does not invoke copy button click');

({bar,scene}=openDetail());
bar.showDetail(1);
assert.equal(bar.detail.copyButton,null,'ordinary skill detail does not show myriad copy button');

({bar,calls}=openDetail({getData:false}));
assert.equal(dispatchPointerDownIfHit(bar.detail.copyButton.bg,{id:9,x:360,y:844},{stopPropagation(){}}),true,'failed-open click is dispatched only after hit test');
assert.ok(bar.detail,'failed selection opening restores detail immediately');
assert.equal(calls.show,0,'failed opening does not leave a selection panel');

({bar}=openDetail());
const firstBg=bar.detail.copyButton.bg;
bar.hideDetail();
bar.showDetail(0);
assert.equal(firstBg.destroyed,true,'closing detail destroys old button nodes');
assert.ok(bar.detail.copyButton.bg.handlers.pointerdown,'reopened detail has exactly one active button handler');

console.log('v0.11.1 myriad detail touch validation passed.');
