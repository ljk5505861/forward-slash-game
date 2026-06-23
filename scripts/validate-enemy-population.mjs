import assert from 'node:assert/strict';
global.window={cordova:undefined, navigator:{userAgent:''}, addEventListener(){}, removeEventListener(){}}; global.document={documentElement:{style:{}}, createElement(){return {getContext(){return new Proxy({},{get(_,k){ if(k==='getImageData') return ()=>({data:[0,0,0,0]}); return ()=>{}; }});}, style:{}};}, addEventListener(){}, removeEventListener(){}}; Object.defineProperty(globalThis,'navigator',{value:global.window.navigator, configurable:true}); global.Image=class { set src(v){ setTimeout(()=>this.onload?.(),0); } }; global.HTMLCanvasElement=class {};
const { BALANCE } = await import('../src/config/balance.js');
const { STAGES } = await import('../src/config/stages.js');
const { ENEMIES } = await import('../src/config/enemies.js');
const { default: StageSystem } = await import('../src/systems/StageSystem.js');
const { default: EnemyBehaviorManager } = await import('../src/enemies/behaviors/EnemyBehaviorManager.js');

let now=0;
const maxNormalWidth=Math.max(...Object.values(ENEMIES).filter(e=>e.kind==='normal').map(e=>e.width));
const makeDisplayObject=(x=0,y=0,width=10,height=10)=>({ x,y,width,height,active:true,alpha:1, setStrokeStyle(){return this;}, setDepth(){return this;}, setOrigin(){return this;}, setFillStyle(){return this;}, setScale(v){this.scale=v; return this;}, setPosition(x2,y2){this.x=x2; this.y=y2; return this;}, setDisplaySize(w,h){this.displayWidth=w; this.displayHeight=h; return this;}, destroy(){this.active=false;}, removeAllListeners(){return this;} });
const makeScene=()=>{
  const scene={
    balance:BALANCE, scale:{height:1280}, time:{get now(){return now}}, player:{x:220,y:850}, enemies:[],
    cameras:{main:{scrollX:0,width:720,worldView:{right:720},setBounds(x,y,w,h){this.bounds={x,y,w,h};}}}, physics:{world:{setBounds(x,y,w,h){this.bounds={x,y,w,h};}}, add:{existing(obj){ obj.body={ width:obj.width, height:obj.height, velocity:{x:0}, setAllowGravity(){return this;}, setImmovable(){return this;}, setSize(w,h){this.width=w; this.height=h; return this;}, setOffset(){return this;}, setVelocityX(v){this.velocity.x=v; obj.velocityX=v; return this;}, reset(x,y){obj.x=x; obj.y=y; this.velocity.x=0;} }; }}},
    add:{ rectangle(x,y,w,h){return makeDisplayObject(x,y,w,h);}, text(x,y){return makeDisplayObject(x,y,0,0);}, circle(x,y,r){return makeDisplayObject(x,y,r*2,r*2);}, triangle(x,y){return makeDisplayObject(x,y,40,40);}, line(){return makeDisplayObject();} },
    tweens:{add(){}}, hud:{setStage(){},setStatus(){}}, eventBus:{emit(){}}, runStats:{startMidBossFight(){}}, statusEffects:{clearTarget(){}},
    getGameplayTime(){return now;}, isGameplayPaused(){return this.paused||false;}, queueShop(reason){this.queuedShop=reason;}, finishRun(won){this.finishedWon=won;}
  };
  scene.targeting={ isEnemyFullyInsideViewport(e){ return e.x + (e.width||0)/2 <= scene.cameras.main.worldView.right; }, shouldRecycleEnemyLeft(){ return false; } };
  scene.enemyBehaviors=new EnemyBehaviorManager(scene);
  return scene;
};
const assertOutsideRight=(x,id,scene,label)=>assert.ok(x>scene.cameras.main.worldView.right+ENEMIES[id].width/2, `${label} ${id} spawn ${x} must be outside right ${scene.cameras.main.worldView.right}`);
const drainIntroAndAssertBoss=(phaseId, enemyId, right=720)=>{
  const s=makeScene(); s.cameras.main.worldView.right=right; s.cameras.main.scrollX=right-720; const st=new StageSystem(s); st.start(); st.enterPhaseById(phaseId);
  const intro=[...st.waveQueue]; while(st.waveQueue.length){ now=st.waveQueue[0].at; st.update(now); }
  assert.equal(st.bossSpawnAt, intro.at(-1).at+BALANCE.enemyPopulation.bossIntroDelayMs, `${phaseId} uses configured 1s intro delay`);
  now=st.bossSpawnAt-1; st.update(now); assert.equal(s.enemies.filter(e=>e.isBoss).length,0, `${phaseId} 999ms has no boss`);
  now=st.bossSpawnAt; st.update(now); const boss=s.enemies.find(e=>e.enemyId===enemyId); assert.ok(boss, `${phaseId} 1000ms spawns boss`);
  assertOutsideRight(boss.x,enemyId,s,phaseId); assert.equal(s.targeting.isEnemyFullyInsideViewport(boss),false,`${phaseId} boss starts invisible`);
  s.enemyBehaviors.update(now+=16); assert.ok(boss.body.velocity.x<0,`${phaseId} boss moves left for entry`);
  const behavior=s.enemyBehaviors.items?.get(boss); if(behavior){ behavior.state='idle'; behavior.next=now+10000; behavior.nextChargeAt=now+10000; } s.cameras.main.worldView.right=boss.x+boss.width; s.player.x=boss.x-600; s.enemyBehaviors.update(now+=16); assert.ok(boss.body.velocity.x<0,`${phaseId} boss chases player after entry`);
  if(behavior){ behavior.state='idle'; behavior.next=now+10000; behavior.nextChargeAt=now+10000; } s.player.x=boss.x-(boss.attackRange-4); s.enemyBehaviors.update(now+=16); assert.equal(boss.body.velocity.x,0,`${phaseId} boss stops in attack range`);
  s.player.x=boss.x-600; s.enemyBehaviors.update(now+=16); assert.ok(boss.body.velocity.x<0,`${phaseId} boss resumes chase when player pulls away`);
  return { s, st, boss };
};

const scene=makeScene(); const sys=new StageSystem(scene); sys.start();
assert.equal(scene.enemies.length,0,'skill choice pause/opening must have no enemies');
scene.paused=true; now=10000; sys.update(now); assert.equal(scene.enemies.length,0,'paused opening timer must not advance');
scene.paused=false; now=0; sys.update(now); now=1999; sys.update(now); assert.equal(scene.enemies.length,0,'1999ms no enemies');
now=2000; sys.update(now); assert.ok(sys.waveQueue.length>0||scene.enemies.length>0,'2000ms queues first wave');
const q=[...sys.waveQueue]; assert.equal(new Set(q.map(i=>i.id)).size,2,'wave has exactly two types');
for(let i=1;i<q.length;i++) assert.ok(q[i].at>q[i-1].at,'queue times strictly increasing');
const startCount=scene.enemies.length; for (const item of q){ now=item.at; sys.update(now); }
scene.enemies.slice(startCount).forEach(e=>assertOutsideRight(e.x,e.enemyId,scene,'opening wave'));
assert.ok(scene.enemies.slice(startCount).every(e=>e.speed===ENEMIES[e.enemyId].speed),'spawned normals preserve configured speeds');
assert.equal(sys.waveQueue.length,0,'wave drains once with no refill'); assert.equal(sys.waveState,'fighting');
scene.enemies[0].isDefeated=true; scene.enemies=scene.enemies.slice(1); now+=BALANCE.enemyPopulation.waveClearDelayMs; sys.update(now); assert.notEqual(sys.waveState,'waitingNextWave','alive enemy blocks clear timer');
scene.enemies.forEach(e=>e.isDefeated=true); scene.enemies=[]; now+=1; sys.update(now); const next=sys.nextWaveAt; assert.equal(sys.waveState,'waitingNextWave','last death starts 3s timer');
sys.shiftTimers(5000, now); now=next+2999; sys.update(now); assert.equal(sys.waveQueue.length,0,'pause-shifted clear delay does not advance during modal pause');
now=sys.nextWaveAt-1; sys.update(now); assert.equal(sys.waveQueue.length,0,'2999ms no next wave'); now=sys.nextWaveAt; sys.update(now); assert.ok(sys.waveQueue.length>0,'3000ms starts next wave');


const queuedIds=(ids,extraIds=[])=>{ const s=makeScene(), st=new StageSystem(s); st.start(); st.queueTwoTypeWave(4, ids, 5000, extraIds); return st.waveQueue; };
const gapAt=(q,i)=>q[i].at-q[i-1].at;
let typeQueue=queuedIds(['grunt','charger']); assert.deepEqual(typeQueue.map(i=>i.id), ['grunt','grunt','charger','charger'], 'two melee types remain two separate groups'); assert.equal(gapAt(typeQueue,1),150,'grunt group interval 150ms'); assert.equal(gapAt(typeQueue,2),1000,'grunt to charger switch interval 1000ms'); assert.equal(gapAt(typeQueue,3),150,'charger group interval 150ms');
typeQueue=queuedIds(['bomber','healer']); assert.deepEqual(typeQueue.map(i=>i.id), ['bomber','bomber','healer','healer'], 'two ranged types remain two separate groups'); assert.equal(gapAt(typeQueue,1),150,'bomber group interval 150ms'); assert.equal(gapAt(typeQueue,2),1000,'bomber to healer switch interval 1000ms'); assert.equal(gapAt(typeQueue,3),150,'healer group interval 150ms');
for (const ids of [['bomber','grunt'],['grunt','bomber']]) { typeQueue=queuedIds(ids); assert.deepEqual(typeQueue.map(i=>i.id), ['grunt','grunt','bomber','bomber'], `${ids.join('+')} resolves to melee group before ranged group`); assert.equal(gapAt(typeQueue,2),1000,'melee to ranged switch interval 1000ms'); }
const eliteOrderQueue=queuedIds(['grunt','bomber'], ['elite']); const eliteOrder=eliteOrderQueue.map(i=>i.id); assert.deepEqual([...eliteOrder].sort(), ['bomber','bomber','elite','grunt','grunt'].sort(), 'elite wave contains only two base types plus one elite'); const firstRangedIndex=eliteOrder.indexOf('bomber'); const eliteIndex=eliteOrder.indexOf('elite'); assert.ok(eliteIndex>=0&&firstRangedIndex>eliteIndex, 'elite is grouped with frontline before ranged units'); assert.equal(gapAt(eliteOrderQueue,eliteIndex),150,'elite is 150ms from adjacent frontline unit'); assert.equal(gapAt(eliteOrderQueue,firstRangedIndex),1000,'frontline group to first ranged remains 1000ms');
const onceScene=makeScene(), onceSys=new StageSystem(onceScene); onceSys.start(); onceSys.queueNormalWave('early',0); onceSys.queueNormalWave('early',10000); onceSys.queueNormalWave('early',20000); assert.equal(onceSys.waveQueue.filter(i=>i.id==='elite').length,1,'elite still appears once per phase across normal waves');

const shopScene=makeScene(), shopSys=new StageSystem(shopScene); shopSys.start(); shopSys.enterPhaseById('postBoss2Shop'); shopSys.queueNormalWave('early',now); while(shopSys.waveQueue.length){ now=shopSys.waveQueue[0].at; shopSys.update(now); } shopScene.enemies=[]; shopSys.update(now+1); assert.equal(shopScene.queuedShop,'second','shop pre-wave clear queues shop immediately without normal delay');

const endScene=makeScene(); endScene.cameras.main.scrollX=11460; endScene.cameras.main.worldView.right=12180; const endSys=new StageSystem(endScene); endSys.start();
for (const id of ['grunt','armored_guard']) { const x=endSys.spawnXFor(id); assertOutsideRight(x,id,endScene,'late-map spawnXFor'); assert.ok(x <= STAGES[0].worldWidth-ENEMIES[id].width/2-8, `${id} spawn remains inside world`); }
const generated=endSys.spawn('armored_guard'); assertOutsideRight(generated.x,'armored_guard',endScene,'actual generated late normal'); assert.equal(endScene.targeting.isEnemyFullyInsideViewport(generated),false,'actual generated enemy starts invisible'); endScene.enemyBehaviors.update(now+=16); assert.ok(generated.body.velocity.x<0,'offscreen generated enemy moves left on behavior update');

const boss3Scene=makeScene(); boss3Scene.cameras.main.scrollX=11460; boss3Scene.cameras.main.worldView.right=12180; const boss3Sys=new StageSystem(boss3Scene); boss3Sys.start(); boss3Sys.enterPhaseById('boss3');
assert.equal(boss3Sys.bossIntroState,'spawningMinions'); const intro=[...boss3Sys.waveQueue]; assert.ok(intro.length>=6&&intro.length<=9,'boss3 intro queues 6-9 minions'); assert.equal(new Set(intro.map(i=>i.id)).size,2,'boss3 intro uses two types');
for(let i=1;i<intro.length;i++){ const gap=intro[i].at-intro[i-1].at; const switched=intro[i].id!==intro[i-1].id; assert.equal(gap, switched?1000:150, 'boss3 intro intervals are 150ms same-type / 1000ms switch'); }
const spawnedIntro=[]; while(boss3Sys.waveQueue.length){ now=boss3Sys.waveQueue[0].at; boss3Sys.update(now); spawnedIntro.push(boss3Scene.enemies.at(-1)); }
spawnedIntro.forEach(e=>assertOutsideRight(e.x,e.enemyId,boss3Scene,'boss3 intro')); assert.ok(spawnedIntro.every(e=>!boss3Scene.targeting.isEnemyFullyInsideViewport(e)),'no boss3 intro minion starts visible');
assert.equal(boss3Sys.bossSpawnAt, intro.at(-1).at+BALANCE.enemyPopulation.bossIntroDelayMs,'boss3 spawns 1s after final intro minion'); now=boss3Sys.bossSpawnAt-1; boss3Sys.update(now); assert.equal(boss3Scene.enemies.filter(e=>e.isBoss).length,0,'999ms no boss3'); now=boss3Sys.bossSpawnAt; boss3Sys.update(now); const boss3=boss3Scene.enemies.find(e=>e.enemyId==='boss'); assert.ok(boss3,'boss3 appears normally after intro delay'); assertOutsideRight(boss3.x,'boss',boss3Scene,'boss3'); assert.equal(boss3Scene.targeting.isEnemyFullyInsideViewport(boss3),false,'boss3 starts invisible'); boss3Scene.enemyBehaviors.update(now+=16); assert.ok(boss3.body.velocity.x<0,'boss3 actively enters from the right');
drainIntroAndAssertBoss('boss1','berserker_boss',5200); drainIntroAndAssertBoss('boss2','mid_boss',10000); drainIntroAndAssertBoss('boss3','boss',12800);

const lateScene=makeScene(), lateSys=new StageSystem(lateScene); lateSys.start(); lateSys.enterPhaseById('late'); lateSys.phaseWaveCounts.late=BALANCE.enemyPopulation.phaseWaveLimit.late; lateSys.waveSpawnFinished=true; lateSys.waveState='fighting'; lateScene.enemies=[]; const playerX=lateScene.player.x; lateSys.maintainPopulation(now); assert.equal(lateSys.phase().id,'boss3','late final clear immediately enters boss3'); assert.equal(lateScene.player.x,playerX,'boss3 transition does not require player movement'); assert.equal(lateSys.bossIntroState,'spawningMinions','boss3 intro queue starts immediately'); assert.ok(lateSys.waveQueue.length>0,'boss3 precursor queue is scheduled'); const queuedOnce=lateSys.waveQueue.length; lateSys.maintainPopulation(now-1); assert.equal(lateSys.waveQueue.length,queuedOnce,'boss3 precursor queue is not duplicated'); assert.equal(lateScene.enemies.filter(e=>e.enemyId==='boss').length,0,'boss3 does not duplicate before intro delay');

assert.ok(STAGES[0].worldWidth >= STAGES[0].phases.find(p=>p.id==='boss3').boss.x + 720 + ENEMIES.boss.width + BALANCE.enemies.respawnPadding, 'world reserves right-side spawn runway past boss3');
assert.equal(BALANCE.stageWorldWidth,STAGES[0].worldWidth,'balance/world stage width stays synced'); assert.equal(scene.physics.world.bounds.w,STAGES[0].worldWidth,'physics bounds cover expanded map'); assert.equal(scene.cameras.main.bounds.w,STAGES[0].worldWidth,'camera bounds cover expanded map'); assert.ok(STAGES[0].phases.find(p=>p.id==='boss3').boss.x < STAGES[0].worldWidth-720, 'boss3 has fight room before the map end');
assert.equal(STAGES[0].phases.find(p=>p.id==='boss2').boss.x-STAGES[0].phases.find(p=>p.id==='boss1').boss.x,4850,'boss1-boss2 spacing equals original segment');
assert.equal(ENEMIES.berserker_boss.hp,1000); assert.equal(ENEMIES.mid_boss.hp,1500); assert.equal(ENEMIES.boss.hp,2200);
console.log('[validate:enemy-population] PASS real StageSystem opening delay, strict waves, right-edge/end-map spawning, boss intros, map bounds, and boss values');
