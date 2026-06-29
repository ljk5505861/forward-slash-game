import assert from 'node:assert/strict';
import { installPostRenderTextDestroy } from '../src/utils/safeTextDestroy.js';

class Events { constructor(){ this.m=new Map(); } on(e,f){ const a=this.m.get(e)||[]; a.push(f); this.m.set(e,a); return this; } off(e,f){ const a=(this.m.get(e)||[]).filter(x=>x!==f); a.length?this.m.set(e,a):this.m.delete(e); return this; } emit(e,...args){ [...(this.m.get(e)||[])].forEach(f=>f(...args)); } count(e){ return (this.m.get(e)||[]).length; } }
function makePhaser(){ class Text { constructor(scene){ this.scene=scene; this.visible=true; this.active=true; this.alpha=1; this.input={}; this.frame={data:{drawImage(){ return 'ok'; }}}; this.originalDestroyCount=0; } setVisible(v){ this.visible=v; return this; } setActive(v){ this.active=v; return this; } setAlpha(v){ this.alpha=v; return this; } removeInteractive(){ this.input=null; return this; } destroy(){ this.originalDestroyCount+=1; this.frame.data=null; this.active=false; return this; } } return { GameObjects:{Text}, Core:{Events:{POST_RENDER:'postrender'}} }; }

{
  const Phaser=makePhaser();
  const original=Phaser.GameObjects.Text.prototype.destroy;
  assert.equal(installPostRenderTextDestroy(Phaser),true,'first install succeeds');
  const wrapped=Phaser.GameObjects.Text.prototype.destroy;
  assert.notEqual(wrapped,original);
  assert.equal(installPostRenderTextDestroy(Phaser),false,'second install is ignored');
  assert.equal(Phaser.GameObjects.Text.prototype.destroy,wrapped,'prototype is wrapped once');
}

{
  const Phaser=makePhaser(); installPostRenderTextDestroy(Phaser); const events=new Events(); const text=new Phaser.GameObjects.Text({game:{events}});
  text.destroy();
  assert.equal(text.visible,false); assert.equal(text.active,false); assert.equal(text.alpha,0); assert.equal(text.input,null); assert.equal(text.originalDestroyCount,0,'original destroy deferred'); assert.ok(text.frame.data,'frame data remains through current render'); assert.equal(text.frame.data.drawImage(),'ok'); assert.equal(events.count('postrender'),1);
  events.emit('postrender'); assert.equal(text.originalDestroyCount,1); assert.equal(text.frame.data,null); events.emit('postrender'); assert.equal(text.originalDestroyCount,1,'postrender destroy runs once');
}

{
  const Phaser=makePhaser(); installPostRenderTextDestroy(Phaser); const events=new Events(); const text=new Phaser.GameObjects.Text({game:{events}});
  text.destroy(); text.destroy(); text.destroy(); assert.equal(events.count('postrender'),1,'multiple destroys queue one listener'); events.emit('postrender'); assert.equal(text.originalDestroyCount,1,'multiple destroys call original once');
}

{
  const Phaser=makePhaser(); installPostRenderTextDestroy(Phaser); const events=new Events(); const text=new Phaser.GameObjects.Text({game:{events}});
  text.destroy(); assert.equal(events.count('postrender'),1); text.destroy(true); assert.equal(events.count('postrender'),0,'fromScene clears queued listener'); assert.equal(text.originalDestroyCount,1); events.emit('postrender'); assert.equal(text.originalDestroyCount,1,'fromScene prevents double destroy');
}

{
  const Phaser=makePhaser(); installPostRenderTextDestroy(Phaser); const text=new Phaser.GameObjects.Text({}); text.destroy(); assert.equal(text.originalDestroyCount,1,'missing game events falls back to original destroy'); assert.equal(text.frame.data,null,'fallback does not leak text forever');
}

console.log('validate-01074-ios-canvas-text-lifecycle passed');
