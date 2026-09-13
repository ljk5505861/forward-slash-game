import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../src/skills/handlers/index.js';
import Hud from '../src/ui/Hud.js';
import SkillSystem from '../src/systems/SkillSystem.js';
import { EntryIronWallSkill } from '../src/skills/handlers/EntryArchetypeSkills.js';
import { createPlayerRuntime, BALANCE } from '../src/config/balance.js';
import { EventEmitter } from 'node:events';
class EventBus extends EventEmitter {
  on(name,fn){ super.on(name,fn); return ()=>this.off(name,fn); }
}

const source=fs.readFileSync(new URL('../src/scenes/GameScene.js',import.meta.url),'utf8');
const methods=source.slice(source.indexOf('  clearRunUiReferences(){'),source.indexOf('  create(){'));
const Scene=vm.runInNewContext(`(class {${methods}})`);
assert.match(source,/create\(\)\{ try \{ this\.clearRunUiReferences\(\);/,'clear references before any constructor runs');
function harness(){
  const s=new Scene();
  s.balance=BALANCE;s.playerData=createPlayerRuntime();s.enemies=[];s.player={x:100,y:100};
  s.eventBus=new EventBus();s.events={on(){},once(){},off(){}};s.getGameplayTime=()=>0;
  s.writes=0;
  const node=()=>{
    const target={height:10,dead:false,destroy(){this.dead=true;}};
    let proxy;
    proxy=new Proxy(target,{get(obj,key){if(key in obj)return obj[key];return ()=>{
      if(obj.dead)throw new TypeError('drawImage: destroyed Text canvas');s.writes++;return proxy;
    };}});
    return proxy;
  };
  s.add={rectangle:node,text:node};return s;
}
// Reproduce the reported path without owning a skill: global iron-wall binding
// refreshes an old HUD whose Phaser nodes have already been destroyed.
{
  const s=harness();s.hud=new Hud(s);s.hud.nodes.forEach(n=>n.destroy());
  assert.throws(()=>EntryIronWallSkill.bind({scene:s,passiveUpdaters:[],getData(){return undefined;}}),/destroyed Text/);
  s.clearRunUiReferences();
  assert.doesNotThrow(()=>{s.skillSystem=new SkillSystem(s);});
}
for(const mode of ['normal','test']){
  const s=harness();s.runMode=mode;
  for(let run=0;run<5;run++){
    s.clearRunUiReferences();s.playerData=createPlayerRuntime();s.eventBus=new EventBus();
    s.skillSystem=new SkillSystem(s);s.hud=new Hud(s);s.hud.update();
    if(run%2)s.skillSystem.addOrLevel('healing');
    s.skillSystem.reset();
    const old=s.hud;old.destroy();assert.equal(s.hud,null);
    const writes=s.writes;assert.doesNotThrow(()=>{old.update();old.setGameSpeed(2);old.destroy();});assert.equal(s.writes,writes);
    s.hud=new Hud(s);old.destroy();assert.notEqual(s.hud,null,'stale destroy must not detach new HUD');
    s.hud.update();assert(s.writes>writes,'new HUD still updates');s.hud.destroy();
  }
}
console.log('restart stale HUD: real global skill bind, repeated lifecycle and new HUD passed');
