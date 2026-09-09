import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import '../src/skills/handlers/index.js';
import { formatSkillSelectionOption } from '../src/ui/selectionFormatters.js';
// Phaser import setup; rendered text metrics below deliberately include wrapping.
globalThis.window??={};
const context={fillRect(){},drawImage(){},getImageData(){return {data:new Uint8ClampedArray([0,0,0,255])};},putImageData(){},createImageData(){return {data:new Uint8ClampedArray(4)};},clearRect(){}};
globalThis.document??={documentElement:{style:{}},createElement:()=>({getContext:()=>context,style:{}})};
globalThis.navigator??={userAgent:'node'};
globalThis.HTMLCanvasElement??=class {};
globalThis.Image??=class { set src(_value){setTimeout(()=>this.onload?.(),0);} };
const {default:UpgradePanel}=await import('../src/ui/UpgradePanel.js');
const created=[];
function node(x=0,y=0,text='',style={}){
 const n=new EventEmitter(); Object.assign(n,{x,y,text,style,width:624,height:Math.max(1,Math.ceil(text.length/24))*31,destroyed:false});
 for(const method of ['setOrigin','setScrollFactor','setDepth','setInteractive','fillStyle','fillRect']) n[method]=(...args)=>{n[method+'Args']=args;return n;};
 n.setMask=mask=>{n.mask=mask;return n;}; n.destroy=()=>{n.destroyed=true;n.removeAllListeners();};
 n.createGeometryMask=()=>{const mask={destroyed:false,destroy(){this.destroyed=true;}};n.geometryMask=mask;return mask;};created.push(n);return n;
}
const scene={input:new EventEmitter(),events:new EventEmitter(),add:{text:node,rectangle:(x,y,w,h)=>{const n=node(x,y);n.width=w;n.height=h;return n;}},make:{graphics:()=>node()}};
const unrelated=()=>{};scene.input.on('pointermove',unrelated);
const panel=new UpgradePanel(scene);
const fmt=(type,level)=>formatSkillSelectionOption({type,skillId:'fire_seed'}, {skills:[{id:'fire_seed',level}]});
const upgrade=fmt('skillLevel',2);
assert.equal(upgrade.milestoneRows[0].activatesNow,true);
assert.equal(fmt('myriadCopySkill',3).milestoneRows[0].activatesNow,false);
assert.equal(fmt('skillLevel',3).milestoneRows[0].active,true);
panel.createDetails(upgrade);
const texts=panel.detailNodes.filter(n=>n.text);
assert.ok(texts.every(n=>n.x===48&&n.style.align==='left'&&n.setOriginArgs[0]===0));
const growth=texts.find(n=>n.text==='等级成长'),prev=texts[texts.indexOf(growth)-1];
assert.equal(growth.y-(prev.y+prev.height),32,'growth starts 32px after wrapped explanation');
assert.equal(texts.find(n=>n.text.includes('本次激活')).style.color,'#ffd166');
assert.equal(texts.find(n=>n.text.startsWith('Lv.6')).style.color,'#b6c5d8');
assert.equal(texts.find(n=>n.text===upgrade.purposeLines.join('\n')).style.color,'#f2f6ff');
for(const top of [500,650]){
 panel.detailTop=top;
 panel.createDetails({...upgrade,purposeLines:['长说明'.repeat(300)]});
 const oldNodes=[...panel.detailNodes],mask=panel.detailMask,clip=panel.detailClip;
 const hit=panel.detailNodes.find(n=>n.listenerCount('pointerdown'));
 assert.ok(hit,'long content supports scroll');
 const last=panel.detailNodes.find(n=>n.text?.startsWith('Lv.9'));
 assert.ok(last.mask===mask); const originalY=last.y;
 hit.emit('pointerdown',{id:1,y:900});scene.input.emit('pointermove',{id:1,y:-10000,isDown:true});
 assert.ok(last.y<originalY);assert.ok(last.y+last.height<=1162,'last milestone reachable');
 scene.input.emit('pointerup');
 panel.createDetails(fmt('myriadCopySkill',3));
 assert.ok(oldNodes.every(n=>n.destroyed));assert.ok(mask.destroyed&&clip.destroyed);
 assert.ok(!panel.detailNodes.some(n=>n.text?.includes('本次激活')));
}
panel.hide();assert.deepEqual(scene.input.listeners('pointermove'),[unrelated]);
assert.equal(scene.input.listenerCount('pointerup'),0);assert.equal(scene.events.listenerCount('shutdown'),0);
panel.createDetails(upgrade);const remaining=[...panel.detailNodes],mask=panel.detailMask;
scene.events.emit('shutdown');assert.ok(remaining.every(n=>n.destroyed));assert.ok(mask.destroyed);
console.log('v0.11.16 selection detail layout passed: alignment, measured gap, milestone status, scroll and cleanup.');
