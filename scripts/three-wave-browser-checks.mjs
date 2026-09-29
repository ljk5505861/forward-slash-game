// Accelerate only enemy deaths; use real wave queues, corpse settlement,
// UpgradePanel touch confirmation, modal handoff, ShopPanel and boss-rush flow.
export async function runThreeWaveChecks(page,engine,assert){
  const tap=async(x,y)=>{
    const box=await page.locator('canvas').first().boundingBox();
    await page.touchscreen.tap(box.x+x*box.width/720,box.y+y*box.height/1280);
    await page.waitForTimeout(100);
  };
  for(const group of [1,3]){
    await page.reload();
    await page.waitForFunction(()=>window.__shopGame?.scene.getScene('GameScene')?.startMenu);
    await page.evaluate(group=>{
      const s=window.s=window.__shopGame.scene.getScene('GameScene');s.startRun('normal');
      const st=s.stageSystem;st.groupIndex=group-1;st.currentGroup=group;st.currentEnemyLevel=group;s.playerData.level=group;
      s.upgradeSystem.rollOptions=()=>[
        {type:'newSkill',id:'new_fireball',skillId:'fireball',nextLevel:1},
        {type:'newSkill',id:'new_poison_cloud',skillId:'poison_cloud',nextLevel:1},
        {type:'newSkill',id:'new_healing',skillId:'healing',nextLevel:1},
      ];
      window.flowEvents=[];
      s.eventBus.on('COMBAT_STARTED',p=>window.flowEvents.push(p.kind));
    },group);
    for(let wave=1;wave<=3;wave++){
      await page.waitForFunction(wave=>s.stageSystem.currentWave===wave,wave);
      assert(await page.evaluate(()=>s.stageSystem.wavesPerGroup()===3&&!s.upgradePanel.isOpen&&!s.shopPanel.isOpen));
      await page.evaluate(()=>{
        const st=s.stageSystem;
        st.drainWaveQueue(s.getGameplayTime()+10000);
        for(const enemy of [...s.enemies]) if(!enemy.isDefeated) s.combatSystem.killEnemy(enemy);
        st.updateGroup(s.getGameplayTime());
      });
      assert(await page.evaluate(()=>!s.upgradePanel.isOpen&&!s.shopPanel.isOpen),'corpse settlement does not immediately open a modal');
    }
    if(group===1){
      await page.waitForFunction(()=>s.upgradePanel.isOpen);
      assert(await page.evaluate(()=>s.stageSystem.currentWave===3&&s.stageSystem.flowState==='SKILL_REWARD'&&s.shopSystem.visits===0));
      await page.screenshot({path:`test-artifacts/shop/${engine}-group-${group}-third-wave-reward.png`});
      await tap(170,294);await tap(170,294);
      assert(await page.evaluate(()=>s.playerData.skills.some(x=>x.id==='fireball')&&!s.upgradePanel.isOpen&&!s.shopPanel.isOpen&&!s.isGameplayPaused()&&s.stageSystem.groupIndex===1&&s.shopSystem.visits===0&&s.playerData.level===2),'skill-only group resumes without shop');
    }else{
      await page.waitForFunction(()=>s.shopPanel.isOpen);
      assert(await page.evaluate(()=>!s.upgradePanel.isOpen&&s.playerData.skills.length===0&&s.isGameplayPaused()&&s.stageSystem.flowState==='SHOP'&&s.shopSystem.visits===1&&s.playerData.level===3),'boss prep opens shop instead of skill selection');
      await page.screenshot({path:`test-artifacts/shop/${engine}-group-${group}-boss-prep-shop.png`});
      await tap(537,1022);
      assert(await page.evaluate(()=>!s.shopPanel.isOpen&&!s.isGameplayPaused()&&s.playerData.level===4&&s.stageSystem.currentEnemyLevel===4&&s.shopSystem.visits===1&&s.stageSystem.flowState==='BOSS_RUSH'),'shop leave advances once to retained boss rush');
    }
    if(group===3){
      await page.waitForFunction(()=>s.stageSystem.rushSpawned&&s.enemies.length>0);
      await page.screenshot({path:`test-artifacts/shop/${engine}-retained-boss-rush.png`});
    }
  }
  console.log(engine+' PASS three-wave skill-only / boss-prep shop touch flow, per-group levels and retained boss rush');
  await page.reload();
  await page.waitForFunction(()=>window.__shopGame?.scene.getScene('GameScene')?.startMenu);
}
