import assert from 'node:assert/strict';
global.window={cordova:undefined, navigator:{userAgent:''}, addEventListener(){}, removeEventListener(){}}; global.document={documentElement:{style:{}}, createElement(){return {getContext(){return new Proxy({},{get(_,k){ if(k==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});}, style:{}};}, addEventListener(){}, removeEventListener(){}}; Object.defineProperty(globalThis,'navigator',{value:global.window.navigator, configurable:true}); global.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } }; global.HTMLCanvasElement=class {}; 
const { BALANCE } = await import('../src/config/balance.js');
const { STAGES } = await import('../src/config/stages.js');
const { ENEMIES } = await import('../src/config/enemies.js');
const { default: StageSystem } = await import('../src/systems/StageSystem.js');

let now=0;
const spawned=[];
const makeScene=()=>({
  balance:BALANCE, scale:{height:1280}, time:{get now(){return now}}, player:{x:220}, enemies:[],
  cameras:{main:{scrollX:0,width:720,worldView:{right:720},setBounds(){}}}, physics:{world:{setBounds(){}}},
  hud:{setStage(){},setStatus(){}}, eventBus:{emit(){}}, runStats:{startMidBossFight(){}},
  enemyBehaviors:{attach(){},update(){},destroyEnemy(){}}, statusEffects:{clearTarget(){}},
  getGameplayTime(){return now;}, isGameplayPaused(){return this.paused||false;}, queueShop(reason){this.queuedShop=reason;}, finishRun(won){this.finishedWon=won;}
});
const scene=makeScene(); const sys=new StageSystem(scene); sys.spawn=(id,x)=>{ const cfg=ENEMIES[id]; const e={id:`${id}_${spawned.length}`,enemyId:id,active:true,isDefeated:false,isBoss:cfg.kind==='boss',isElite:cfg.kind==='elite',isMidBoss:id==='mid_boss',isFinalBoss:id==='boss',width:cfg.width,x:x??sys.spawnXFor(id),speed:cfg.speed,hp:cfg.hp,maxHp:cfg.hp,damage:cfg.damage}; scene.enemies.push(e); spawned.push({id,at:now,x:e.x,speed:e.speed}); return e; };
sys.start();
assert.equal(scene.enemies.length,0,'skill choice pause/opening must have no enemies');
scene.paused=true; now=10000; sys.update(now); assert.equal(scene.enemies.length,0,'paused opening timer must not advance');
scene.paused=false; now=0; sys.update(now); now=2999; sys.update(now); assert.equal(scene.enemies.length,0,'2999ms no enemies');
now=3000; sys.update(now); assert.ok(sys.waveQueue.length>0||scene.enemies.length>0,'3000ms queues first wave');
const q=[...sys.waveQueue]; assert.ok(new Set(q.map(i=>i.id)).size<=2,'wave has at most two types'); assert.ok(new Set(q.map(i=>i.id)).size===2,'wave has exactly two types');
for(let i=1;i<q.length;i++) assert.ok(q[i].at>q[i-1].at,'queue times strictly increasing');
for (const item of q){ now=item.at; sys.update(now); }
assert.ok(spawned.every(s=>s.x>720+ENEMIES[s.id].width/2),'spawns are outside camera right edge');
assert.ok(spawned.every(s=>s.speed===ENEMIES[s.id].speed),'spawned normals preserve configured speeds');
assert.equal(sys.waveQueue.length,0,'wave drains once with no refill');
assert.equal(sys.waveState,'fighting');
scene.enemies[0].isDefeated=true; scene.enemies=scene.enemies.slice(1); now+=5000; sys.update(now); assert.notEqual(sys.waveState,'waitingNextWave','alive enemy blocks clear timer');
scene.enemies.forEach(e=>e.isDefeated=true); scene.enemies=[]; now+=1; sys.update(now); const next=sys.nextWaveAt; assert.equal(sys.waveState,'waitingNextWave','last death starts 5s timer');
now=next-1; sys.update(now); assert.equal(sys.waveQueue.length,0,'4999ms no next wave');
now=next; sys.update(now); assert.ok(sys.waveQueue.length>0,'5000ms starts next wave');
for (const phase of ['boss1','boss2','boss3']) { scene.enemies=[]; sys.enterPhaseById(phase); assert.equal(sys.bossIntroState,'spawningMinions'); const intro=[...sys.waveQueue]; assert.ok(intro.length>= (phase==='boss3'?6:5) && intro.length <= (phase==='boss3'?9:7)); const last=intro.at(-1).at; now=last; while(sys.waveQueue.length){ now=sys.waveQueue[0].at; sys.update(now); } assert.equal(sys.bossSpawnAt, last+5000); now=sys.bossSpawnAt-1; sys.update(now); assert.equal(scene.enemies.filter(e=>e.isBoss).length,0); now=sys.bossSpawnAt; sys.update(now); assert.equal(scene.enemies.filter(e=>e.isBoss).length,1,`${phase} spawns once after intro delay`); }
assert.equal(STAGES[0].worldWidth,12400,'map width extended');
assert.equal(STAGES[0].phases.find(p=>p.id==='boss2').boss.x-STAGES[0].phases.find(p=>p.id==='boss1').boss.x,4850,'boss1-boss2 spacing equals original segment');
assert.equal(ENEMIES.berserker_boss.hp,1000); assert.equal(ENEMIES.mid_boss.hp,1500); assert.equal(ENEMIES.boss.hp,2200);
console.log('[validate:enemy-population] PASS real StageSystem opening delay, strict waves, right-edge spawning, boss intros, map and boss values');
