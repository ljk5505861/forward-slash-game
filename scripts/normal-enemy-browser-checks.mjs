import fs from 'node:fs';

// Call with an existing phone-size Playwright page. Uses actual physics, attack
// targeting, knockback and enemy approach; no injected damage or invulnerability.
export async function runNormalEnemyChecks(page, engine, assert){
  const results=[];
  for(const config of [
    {label:'single-warrior',count:1,speed:1},
    {label:'ten-warriors',count:10,speed:1},
    {label:'ten-warriors-fast-attack',count:10,speed:2},
    {label:'warriors-and-archers',count:10,archers:2,speed:1},
    // Same seed, stats and real combat; only restore the pre-v0.11.27 interval.
    {label:'ten-warriors-old-interval',count:10,speed:1,warriorInterval:1650},
  ]){
    await page.reload();
    await page.waitForFunction(()=>window.__shopGame?.scene.getScene('GameScene')?.startMenu);
    await page.evaluate(config=>{
      let seed=1126;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
      const s=window.s=window.__shopGame.scene.getScene('GameScene');s.startRun('normal');
      s.stageSystem.clearEnemies();s.stageSystem.flowState='ENEMY_FIXTURE';
      s.playerData.attackSpeedMultiplier=config.speed;
      s.gameSpeed.setSpeed(2);
      const positions=s.stageSystem.assignWaveSpawnXs([
        ...Array.from({length:config.count},()=>({id:'grunt'})),
        ...Array.from({length:config.archers||0},()=>({id:'archer'})),
      ]);
      window.enemyCheck={label:config.label,start:s.getGameplayTime(),hits:[],initial:[],samples:[],maxInMelee:0,finished:false};
      positions.forEach(({id,x},i)=>{
        const e=s.stageSystem.spawn(id,x);e.fixtureId=i;
        if(id==='grunt'&&config.warriorInterval){
          e.attackIntervalMs=e.baseAttackIntervalMs=config.warriorInterval;
        }
        window.enemyCheck.initial.push({id:e.enemyId,name:e.name,hp:e.hp,damage:e.damage,interval:e.attackIntervalMs,speed:e.speed});
      });
      const off=s.eventBus.on('PLAYER_DAMAGED',p=>{
        if(p.hpDamage>0) window.enemyCheck.hits.push({at:s.getGameplayTime()-window.enemyCheck.start,id:p.enemy?.enemyId,unit:p.enemy?.fixtureId,damage:p.hpDamage});
      });
      const tick=()=>{
        const r=window.enemyCheck;
        const near=s.enemies.filter(e=>!e.isDefeated&&Math.hypot(e.x-s.player.x,e.y-s.player.y)<=e.attackRange).length;
        r.maxInMelee=Math.max(r.maxInMelee,near);
        const elapsed=s.getGameplayTime()-r.start;
        if(elapsed>=30000||s.playerData.hp<=0||!s.enemies.some(e=>!e.isDefeated)){
          r.elapsed=elapsed;r.hp=s.playerData.hp;r.gold=s.playerData.gold;
          r.remaining=s.enemies.filter(e=>!e.isDefeated).length;r.finished=true;
          off();s.events.off('update',tick);s.beginGameplayPause();
        }
      };
      s.events.on('update',tick);s.events.once('shutdown',()=>{off();s.events.off('update',tick);});
    },config);
    await page.waitForFunction(()=>window.enemyCheck?.hits.length>0||window.enemyCheck?.finished,{},{timeout:35000});
    await page.screenshot({path:'test-artifacts/shop/'+engine+'-'+config.label+'.png'});
    await page.waitForFunction(()=>window.enemyCheck?.finished,{},{timeout:35000});
    const result=await page.evaluate(()=>window.enemyCheck);results.push(result);
    assert(result.initial.filter(e=>e.id==='grunt').every(e=>e.name==='战士'&&e.hp===64&&e.damage===2&&e.interval===(config.warriorInterval||2800)));
    // Verify the live melee cooldown, not just the configured number.
    const previousHit=new Map();
    for(const hit of result.hits.filter(h=>h.id==='grunt')){
      if(previousHit.has(hit.unit)) assert(hit.at-previousHit.get(hit.unit)>=(config.warriorInterval||2800)-1,'individual warrior respects its attack interval');
      previousHit.set(hit.unit,hit.at);
    }
    assert.equal(await page.locator('#global-error-panel').count(),0);
  }
  const [single,ten,fast,mixed,oldTen]=results;
  assert.equal(single.hits.length,0,'one warrior can be suppressed by base normal attacks');
  assert(ten.hits.length>0,'ten warriors naturally hit the player without a special counterattack rule');
  assert(new Set(ten.hits.map(h=>h.unit)).size>=2,'multiple surviving warriors find attack gaps');
  assert(ten.hits.every(h=>h.damage===2),'crowd pressure remains low per-hit damage');
  assert(ten.hits.length<oldTen.hits.length,'longer interval reduces actual crowd hits against the old-interval control');
  assert(ten.hp>oldTen.hp,'longer interval reduces total crowd damage');
  assert.equal(ten.remaining,0,'base character can still clear ten warriors');
  assert.equal(oldTen.remaining,0,'old-interval control also clears, allowing a whole-fight comparison');
  assert(fast.hits.length<=ten.hits.length,'faster attacks do not make a scripted counterattack more frequent');
  assert(mixed.hits.some(h=>h.id==='archer'&&h.damage===6),'archer supplies ranged damage in actual combat');
  assert(mixed.initial.filter(e=>e.id==='archer').every(e=>e.hp===30&&e.interval===2000&&e.speed===360),'archer movement speed retained');
  fs.writeFileSync('test-artifacts/shop/'+engine+'-enemy-combat.json',JSON.stringify(results,null,2));
  console.log(engine+' normal enemy combat '+JSON.stringify(results.map(r=>({label:r.label,hits:r.hits.length,hp:r.hp,elapsed:r.elapsed,remaining:r.remaining,maxInMelee:r.maxInMelee}))));
  // Reload also tests shutdown while enemy behaviors/tweens may still be present.
  await page.reload();
  await page.waitForFunction(()=>window.__shopGame?.scene.getScene('GameScene')?.startMenu);
}
