import assert from 'node:assert/strict';
import { installPostRenderSceneRestart } from '../src/utils/safeSceneRestart.js';

class Events {
  constructor(){ this.listeners=new Map(); }
  once(type,fn){
    const wrapped=(...args)=>{ this.off(type,wrapped); fn(...args); };
    this.on(type,wrapped);
    return this;
  }
  on(type,fn){
    const list=this.listeners.get(type)||[];
    list.push(fn);
    this.listeners.set(type,list);
    return this;
  }
  off(type,fn){
    const list=(this.listeners.get(type)||[]).filter(listener=>listener!==fn);
    if(list.length) this.listeners.set(type,list);
    else this.listeners.delete(type);
    return this;
  }
  emit(type,...args){
    [...(this.listeners.get(type)||[])].forEach(fn=>fn(...args));
  }
  count(type){ return (this.listeners.get(type)||[]).length; }
}

class FakeScenePlugin {
  constructor(scene){ this.scene=scene; }
  restart(){
    assert.equal(this.scene.rendering,false,'restart must not destroy canvas frames during render');
    this.scene.restartCount+=1;
    return this;
  }
}

const Phaser={
  Scenes:{ ScenePlugin:FakeScenePlugin, Events:{ SHUTDOWN:'shutdown' } },
  Core:{ Events:{ POST_RENDER:'postrender' } },
};

assert.equal(installPostRenderSceneRestart(Phaser),true);
assert.equal(installPostRenderSceneRestart(Phaser),false,'guard installs only once');

// Reproduce the reported path: the restart button fires while the current
// Phaser frame is still being processed. The original synchronous restart
// would throw here; the patched restart waits for postrender.
{
  const gameEvents=new Events();
  const sceneEvents=new Events();
  const scene={
    rendering:true,
    restartCount:0,
    game:{events:gameEvents},
    events:sceneEvents,
  };
  const plugin=new FakeScenePlugin(scene);

  assert.doesNotThrow(()=>plugin.restart());
  assert.equal(scene.restartCount,0,'restart is deferred during the active frame');
  assert.equal(gameEvents.count('postrender'),1);

  plugin.restart();
  assert.equal(gameEvents.count('postrender'),1,'double taps queue only one restart');

  scene.rendering=false;
  gameEvents.emit('postrender');
  assert.equal(scene.restartCount,1);
  gameEvents.emit('postrender');
  assert.equal(scene.restartCount,1,'queued restart runs once');
}

// If the scene shuts down for another reason before postrender, the queued
// restart is cancelled and cannot act on a destroyed scene.
{
  const gameEvents=new Events();
  const sceneEvents=new Events();
  const scene={
    rendering:true,
    restartCount:0,
    game:{events:gameEvents},
    events:sceneEvents,
  };
  const plugin=new FakeScenePlugin(scene);

  plugin.restart();
  assert.equal(gameEvents.count('postrender'),1);
  sceneEvents.emit('shutdown');
  assert.equal(gameEvents.count('postrender'),0);
  scene.rendering=false;
  gameEvents.emit('postrender');
  assert.equal(scene.restartCount,0);
}

console.log('validate-01063-safe-restart passed');
