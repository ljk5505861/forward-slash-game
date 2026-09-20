import fs from 'node:fs';

// Actual current production speed versus v0.11.28's speed, same real combat.
// Never inject damage, prevent valid hits, or enforce a per-fight hit quota.
export async function runWarriorHalfPressureChecks(page,engine,assert){
  const results=[];
  const cases=[...[1126,2026,7].map(seed=>({seed,count:10,gameSpeed:2})),{seed:1126,count:10,gameSpeed:1},{seed:1126,count:3,gameSpeed:1}];
  for(const config of cases)for(const baseline of [true,false]){
    const {seed,count,gameSpeed}=config;
    await page.reload();
    await page.waitForFunction(()=>window.__shopGame?.scene.getScene('GameScene')?.startMenu);
    // A newly created camera can have an uninitialized worldView before render.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(({seed,baseline,count,gameSpeed})=>{
      let randomSeed=seed;Math.random=()=>{randomSeed=(1664525*randomSeed+1013904223)>>>0;return randomSeed/4294967296;};
      const s=window.s=window.__shopGame.scene.getScene('GameScene');s.startRun('normal');
      s.stageSystem.clearEnemies();s.stageSystem.flowState='WARRIOR_PRESSURE_FIXTURE';s.gameSpeed.setSpeed(gameSpeed);
      const r=window.warriorPressure={seed,baseline,count,gameSpeed,start:s.getGameplayTime(),firstAttack:null,hits:[],initial:[],finished:false};
      const spawn=s.stageSystem.spawn.bind(s.stageSystem);
      s.stageSystem.spawn=(...args)=>{
        const e=spawn(...args);if(!e)return e;
        if(baseline)e.speed=216;
        e.fixtureId=r.initial.length;
        r.initial.push({id:e.enemyId,x:e.x,speed:e.speed,hp:e.hp,damage:e.damage,range:e.attackRange,interval:e.attackIntervalMs});return e;
      };
      if(count===3)s.stageSystem.queueGroupWave(s.getGameplayTime());
      else {
        const positions=s.stageSystem.assignWaveSpawnXs(Array.from({length:count},()=>({id:'grunt'})));
        s.stageSystem.waveQueue=positions.map(({x},i)=>({at:s.getGameplayTime()+i*s.balance.enemyPopulation.sameTypeSpawnIntervalMs,id:'grunt',x}));
        s.stageSystem.waveState='spawning';
      }
      const offAttack=s.eventBus.on('PLAYER_ATTACK',()=>{r.firstAttack??=s.getGameplayTime();});
      const offHit=s.eventBus.on('PLAYER_DAMAGED',p=>{
        if(p.hpDamage>0)r.hits.push({unit:p.enemy?.fixtureId,at:s.getGameplayTime(),damage:p.hpDamage,knockback:!!p.enemy?.isKnockbackActive});
      });
      const tick=()=>{
        const alive=s.enemies.filter(e=>!e.isDefeated);
        if(s.getGameplayTime()-r.start>=45000||(!alive.length&&!s.stageSystem.waveQueue.length&&r.initial.length===count)){
          r.finished=true;r.elapsed=s.getGameplayTime()-r.start;r.combatMs=s.getGameplayTime()-r.firstAttack;r.remaining=alive.length;
          offAttack();offHit();s.events.off('update',tick);s.beginGameplayPause();
        }
      };
      s.events.on('update',tick);s.events.once('shutdown',()=>{offAttack();offHit();s.events.off('update',tick);});
    },{seed,baseline,count,gameSpeed});
    await page.waitForFunction(()=>window.warriorPressure?.hits.length>0||window.warriorPressure?.finished,null,{timeout:60000});
    if(seed===1126)await page.screenshot({path:`test-artifacts/shop/${engine}-warrior-${baseline?'baseline':'slower'}-n${count}-g${gameSpeed}.png`});
    await page.waitForFunction(()=>window.warriorPressure.finished,null,{timeout:60000});
    const result=await page.evaluate(()=>window.warriorPressure);results.push(result);
    // Save even on a later failed assertion, for diagnosis rather than rerolling.
    fs.writeFileSync(`test-artifacts/shop/${engine}-warrior-half-pressure.json`,JSON.stringify(results,null,2));
    assert.equal(result.initial.length,count);assert(result.initial[0].x>=800);
    assert(result.initial.every(e=>e.id==='grunt'&&e.speed===(baseline?216:38)&&e.hp===64&&e.damage===2&&e.range===86&&e.interval===2800));
    assert.equal(result.remaining,0,'both sides finish the fight');
    assert(result.firstAttack!==null&&result.combatMs>0);
    assert(result.hits.every(h=>!h.knockback&&h.damage===2),'no attacks while under knockback control, unchanged per-hit damage');
    assert.equal(await page.locator('#global-error-panel').count(),0);
  }
  const aggregate=baseline=>{
    const rows=results.filter(r=>r.baseline===baseline&&r.count===10&&r.gameSpeed===2);
    const hits=rows.reduce((n,r)=>n+r.hits.length,0),combatMs=rows.reduce((n,r)=>n+r.combatMs,0);
    return {hits,combatMs,rate:hits/combatMs,elapsed:rows.reduce((n,r)=>n+r.elapsed,0)};
  };
  const old=aggregate(true),now=aggregate(false),ratio=now.rate/old.rate;
  console.log(`${engine} warrior half-pressure `+JSON.stringify({ratio,baseline:old,current:now,cases:results.map(r=>({seed:r.seed,baseline:r.baseline,count:r.count,gameSpeed:r.gameSpeed,hits:r.hits.length,combatMs:r.combatMs,elapsed:r.elapsed}))}));
  assert(ratio>=0.35&&ratio<=0.65,'three-seed aggregate hit rate should be near half (35–65% of baseline), not a fixed hit quota');
  assert(now.hits<old.hits,'actual total damage falls as well as frequency');
  assert(now.elapsed<old.elapsed*1.2,'do not achieve lower frequency by greatly extending fights');
  const normalSpeed=results.filter(r=>r.count===10&&r.gameSpeed===1);
  const normalRatio=(normalSpeed[1].hits.length/normalSpeed[1].combatMs)/(normalSpeed[0].hits.length/normalSpeed[0].combatMs);
  assert(normalRatio>=0.3&&normalRatio<=0.7,'default game speed also reduces hit frequency substantially');
  const opening=results.filter(r=>r.count===3);
  assert(opening[1].hits.length<=opening[0].hits.length,'real three-warrior opening must not deal more damage');
  await page.reload();
  await page.waitForFunction(()=>window.__shopGame?.scene.getScene('GameScene')?.startMenu);
}
