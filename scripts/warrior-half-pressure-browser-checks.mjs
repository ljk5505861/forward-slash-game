import fs from 'node:fs';

// Real three-warrior combat at starting attack speed and 2x attack speed.
// Never inject damage or prevent valid hits; sample the first 3 seconds after combat starts.
export async function runWarriorHalfPressureChecks(page,engine,assert){
  const results=[];
  const cases=[1,2].map(attackSpeed=>({seed:1126,count:3,gameSpeed:2,attackSpeed}));
  for(const config of cases){
    const {seed,count,gameSpeed,attackSpeed}=config;
    await page.reload();
    await page.waitForFunction(()=>window.__shopGame?.scene.getScene('GameScene')?.startMenu);
    // A newly created camera can have an uninitialized worldView before render.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(({seed,count,gameSpeed,attackSpeed})=>{
      let randomSeed=seed;Math.random=()=>{randomSeed=(1664525*randomSeed+1013904223)>>>0;return randomSeed/4294967296;};
      const s=window.s=window.__shopGame.scene.getScene('GameScene');s.startRun('normal');
      s.stageSystem.clearEnemies();s.stageSystem.flowState='WARRIOR_PRESSURE_FIXTURE';s.gameSpeed.setSpeed(gameSpeed);
      s.playerData.attackSpeedMultiplier=attackSpeed;
      const r=window.warriorPressure={seed,count,gameSpeed,attackSpeed,start:s.getGameplayTime(),firstAttack:null,hits:[],initial:[],finished:false};
      const spawn=s.stageSystem.spawn.bind(s.stageSystem);
      s.stageSystem.spawn=(...args)=>{
        const e=spawn(...args);if(!e)return e;
        e.fixtureId=r.initial.length;
        r.initial.push({id:e.enemyId,x:e.x,speed:e.speed,hp:e.hp,damage:e.damage,range:e.attackRange,interval:e.attackIntervalMs});return e;
      };
      s.stageSystem.queueGroupWave(s.getGameplayTime());
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
    },{seed,count,gameSpeed,attackSpeed});
    await page.waitForFunction(()=>window.warriorPressure.finished,null,{timeout:60000});
    const result=await page.evaluate(()=>window.warriorPressure);results.push(result);
    fs.writeFileSync(`test-artifacts/shop/${engine}-warrior-three.json`,JSON.stringify(results,null,2));
    assert.equal(result.initial.length,count);assert(result.initial[0].x>=800);
    assert(result.initial.every(e=>e.id==='grunt'&&e.speed===216&&e.hp===64&&e.damage===2&&e.range===86&&e.interval===2800));
    assert.equal(result.remaining,0,'all three warriors are defeated');
    assert(result.firstAttack!==null&&result.combatMs>0);
    assert(result.hits.every(h=>!h.knockback&&h.damage===2),'no attacks while under knockback control, unchanged per-hit damage');
    assert.equal(await page.locator('#global-error-panel').count(),0);
  }
  const openingHits=r=>r.hits.filter(h=>r.firstAttack!==null&&h.at>=r.firstAttack&&h.at<r.firstAttack+3000).length;
  const [normal,fast]=results;
  console.log(`${engine} three-warrior opening `+JSON.stringify(results.map(r=>({attackSpeed:r.attackSpeed,openingHits:openingHits(r),totalHits:r.hits.length,combatMs:r.combatMs}))));
  assert(openingHits(normal)>=1&&openingHits(normal)<=2,'three warriors hit 1–2 times in the first 3 seconds at starting attack speed');
  assert.equal(openingHits(fast),0,'three warriors cannot hit in the first 3 seconds at 2x attack speed');
  await page.reload();
  await page.waitForFunction(()=>window.__shopGame?.scene.getScene('GameScene')?.startMenu);
}
