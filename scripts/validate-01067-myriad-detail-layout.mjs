import assert from 'node:assert/strict';

await import('./validate-01067-myriad-detail-touch.mjs');
const { default: SkillBar } = await import('../src/ui/SkillBar.js');

function node(type,x=0,y=0,text=''){
  return {type,x,y,text,width:120,height:40,children:[],handlers:{},depth:0,destroyed:false,interactive:false,originX:0.5,originY:0.5,
    setOrigin(x=0.5,y=x){this.originX=x; this.originY=y; return this;},setScrollFactor(){return this;},setDepth(v){this.depth=v;return this;},setStrokeStyle(){return this;},setFillStyle(){return this;},setVisible(v){this.visible=v;return this;},setMask(v){this.mask=v;return this;},setText(v){this.text=v;return this;},
    setInteractive(shape,contains){this.interactive=true; this.hitArea=shape; this.hitAreaCallback=contains; return this;},disableInteractive(){this.interactive=false;return this;},
    on(event,fn){this.handlers[event]=fn;return this;},removeAllListeners(){this.handlers={};return this;},destroy(){this.destroyed=true;return this;},
    createGeometryMask(){return {destroy(){this.destroyed=true;}};},add(items){(Array.isArray(items)?items:[items]).forEach(item=>this.children.push(item));return this;},
    getBounds(){return {x:this.x-this.width/2,y:this.y-this.height/2,width:this.width,height:this.height};}
  };
}
function textNode(x,y,text,style){ const n=node('text',x,y,text); n.height=String(text).split('\n').length*((parseInt(style?.fontSize)||20)+(style?.lineSpacing||0)); n.width=style?.wordWrap?.width||120; return n; }

const scene={
  playerData:{skills:[{id:'fireball',level:1}],hp:100},
  getGameplayTime:()=>1000,
  time:{delayedCall(){return {remove(){}};}},
  upgradeSystem:null,
  add:{
    rectangle:(x,y,w,h)=>{const n=node('rect',x,y); n.width=w; n.height=h; return n;},
    text:textNode,
    container:(x,y)=>node('container',x,y)
  }
};
scene.skillSystem={
  cooldowns:new Map(),
  passiveState:{},
  getData(id){return scene.playerData.skills.some(skill=>skill.id===id)?{}:null;},
  getLevel(id){return scene.playerData.skills.find(skill=>skill.id===id)?.level||0;},
  scene
};

const bar=new SkillBar(scene);
bar.showDetail(0);
const detail=bar.detail;

assert.equal(detail.copyButton,null,'ordinary skill detail does not show the myriad copy button');
assert.equal(detail.bodyVisibleHeight,430,'ordinary skill detail keeps the original 430px body height');
assert.equal(detail.maskShape.height,430,'ordinary skill mask keeps the original height');
assert.equal(detail.maskShape.y,675,'ordinary skill mask keeps the original position');
assert.equal(detail.bodyBaseY,475,'ordinary skill body keeps the original position');
assert.equal(detail.body.y,475,'ordinary skill body starts at the original position');
assert.equal(detail.bodyText.hitArea.height,Math.max(430,detail.bodyText.height),'ordinary body interaction uses the original visible height');
assert.equal(detail.maxScroll,Math.max(0,detail.bodyText.height-430),'ordinary skill maxScroll uses the original viewport height');

console.log('v0.10.93 ordinary skill detail layout validation passed.');
