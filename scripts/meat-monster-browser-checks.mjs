// A short rendering/runtime fixture, not a natural-run balance test.
export async function runMeatChecks(page,engine,assert){
  await page.reload();
  await page.waitForFunction(()=>window.__shopGame?.scene.getScene('GameScene')?.startMenu);
  await page.evaluate(()=>{
    const s=window.s=window.__shopGame.scene.getScene('GameScene');s.startRun('normal');
    s.stageSystem.clearEnemies();s.stageSystem.flowState='ENEMY_FIXTURE';s.gameSpeed.setSpeed(2);
    s.combatSystem.nextPlayerAttackAt=Infinity;
    s.movementSystem.update=()=>s.player.body.setVelocityX(0);
    s.playerData.dodgeChance=0;s.playerData.dodgeChanceBonuses={};s.playerData.shield=0;
    const e=window.meat=s.stageSystem.spawn('armored_guard',s.player.x+230,{speed:1});
    window.meatCheck={hits:[],x:s.player.x};
    const off=s.eventBus.on('PLAYER_DAMAGED',hit=>{
      if(hit.source==='meatKnife')window.meatCheck.hits.push({x:s.player.x,damage:hit.hpDamage});
    });
    s.events.once('shutdown',off);
  });
  await page.waitForFunction(()=>s.enemyBehaviors.items.get(meat)?.state==='windup',{},{timeout:10000});
  await page.screenshot({path:`test-artifacts/shop/${engine}-meat-windup.png`});
  await page.waitForFunction(()=>s.enemyBehaviors.items.get(meat)?.state==='outbound',{},{timeout:5000});
  await page.screenshot({path:`test-artifacts/shop/${engine}-meat-chain.png`});
  await page.waitForFunction(()=>window.meatCheck.hits.length===1&&s.enemyBehaviors.items.get(meat)?.state==='idle',{},{timeout:5000});
  const result=await page.evaluate(()=>({count:meatCheck.hits.length,dx:meatCheck.x-s.player.x,name:meat.name}));
  assert.equal(result.name,'肉怪');assert.equal(result.count,1);assert.equal(result.dx,36);
  await page.evaluate(()=>{const b=s.enemyBehaviors.items.get(meat);s.stageSystem.clearEnemies();window.meatGraphicsDestroyed=!b.graphics;});
  assert(await page.evaluate(()=>window.meatGraphicsDestroyed),'enemy cleanup removes chain graphics');
  assert.equal(await page.locator('#global-error-panel').count(),0);
  await page.reload();
  console.log(`${engine} PASS meat windup, chain throw, single hit, 36px knockback, recall and graphics cleanup`);
}
