import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { RunStates } from '../src/core/CombatEvents.js';
const source=fs.readFileSync(new URL('../src/scenes/GameScene.js',import.meta.url),'utf8');
const methods=source.slice(source.indexOf('  showStartMenu(){'),source.indexOf('  queueArtifactReward('));
const Entry=vm.runInNewContext(`(class { ${methods} })`,{RunStates,DESIGN_WIDTH:720,DESIGN_HEIGHT:1280,GAME_VERSION_LABEL:'v0.11.23'});
function harness(){
 const s=new Entry();s.created=[];s.starts=0;s.choices=0;s.added=[];
 const object=(text)=>{const o={text,list:[],visible:true,interactive:false,handlers:{},add(items){this.list.push(...(Array.isArray(items)?items:[items]));return this;},on(name,fn){this.handlers[name]=fn;return this;},destroy(){this.destroyed=true;},setVisible(v){this.visible=v;return this;},setInteractive(){this.interactive=true;return this;},disableInteractive(){this.interactive=false;return this;}};for(const k of ['setScrollFactor','setDepth','setOrigin','setStrokeStyle'])o[k]=()=>o;s.created.push(o);return o;};
 s.add={container:()=>object(),rectangle:()=>object(),text:(_x,_y,text)=>object(text)};
 s.beginGameplayPause=()=>{s.paused=true;};s.endGameplayPause=()=>{s.paused=false;};
 s.stageSystem={start(){s.starts++;}};s.hud={setStatus(){}};
 s.upgradeSystem={rollStartingOptions(){s.choices++;return [{skillId:'fireball'}];}};
 s.upgradePanel={show(config){s.choice=config;},hide(){s.choice=null;}};
 s.skillSystem={addOrLevel(id){s.added.push(id);}};
 return s;
}
for(const mode of ['normal','test']){
 const s=harness();s.showStartMenu();assert.equal(s.paused,true);assert.equal(s.starts,0);assert.equal(s.choices,0);
 const start=s.created.find(o=>o.handlers.pointerup);start.handlers.pointerup();const count=s.created.length;start.handlers.pointerup();assert.equal(s.created.length,count,'double start tap cannot duplicate buttons');
 const buttons=s.created.filter(o=>o.handlers.pointerup);buttons[mode==='normal'?1:2].handlers.pointerup();
 assert.equal(s.starts,1);assert.equal(s.startMenu,null);assert.equal(s.runMode,mode);assert.equal(s.startRun(mode),false);assert.equal(s.starts,1);
 if(mode==='normal'){assert.equal(s.choices,0);assert.equal(s.paused,false);assert.equal(s.runState,RunStates.RUNNING);assert.deepEqual(s.added,[]);}
 else{assert.equal(s.choices,1);assert.equal(s.paused,true);assert.equal(s.runState,RunStates.STARTING);s.choice.onConfirm({skillId:'fireball'});assert.deepEqual(s.added,['fireball']);assert.equal(s.paused,false);}
 s.showStartMenu();assert.equal(s.runMode,null);assert.equal(s.paused,true);assert.equal(s.modeChoicesShown,false);
}
console.log('start menu and normal/test entry passed');
