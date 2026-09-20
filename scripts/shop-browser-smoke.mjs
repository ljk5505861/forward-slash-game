import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { runNormalEnemyChecks } from './normal-enemy-browser-checks.mjs';
import { runThreeWaveChecks } from './three-wave-browser-checks.mjs';
import { runWarriorHalfPressureChecks } from './warrior-half-pressure-browser-checks.mjs';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE);
fs.mkdirSync('test-artifacts/shop',{recursive:true});
const entry='src/shop-smoke-entry.js',html='shop-smoke.html';
fs.writeFileSync(entry,fs.readFileSync('src/main.js','utf8').replace('const game = new Phaser.Game(gameConfig);','const game = window.__shopGame = new Phaser.Game(gameConfig);'));
fs.writeFileSync(html,fs.readFileSync('index.html','utf8').replace('/src/main.js','/src/shop-smoke-entry.js'));
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4173','--strictPort','--base','/'],{stdio:'pipe'});
server.stderr.on('data',chunk=>process.stderr.write(chunk));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  let ready=false;
  for(let i=0;i<80;i++){try{ready=(await fetch('http://127.0.0.1:4173/shop-smoke.html')).ok;}catch{}if(ready)break;await pause(250);}
  assert(ready,'Vite server ready');
  for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await engine.launch({headless:true});
    try {
      const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:4173/shop-smoke.html');
      await runNormalEnemyChecks(page,name,assert);
      await runWarriorHalfPressureChecks(page,name,assert);
      await runThreeWaveChecks(page,name,assert);
      await page.waitForFunction(()=>window.__shopGame?.scene.getScene('GameScene')?.startMenu);
      await page.evaluate(()=>{window.s=window.__shopGame.scene.getScene('GameScene');s.startRun('normal');});
      // Reproduce the full reward UI path: selecting a new skill must not overwrite replacement UI.
      for(const mode of ['normal','test']) for(const slot of [4,5]){
        await page.evaluate(({mode})=>{
          s.runMode=mode;s.skillSystem.reset();s.stageSystem.clearEnemies();s.stageSystem.reset();s.shopSystem.reset();
          s.stageSystem.currentWave=mode==='normal'?3:2;
          s.playerData.skills=['fireball','poison_cloud','shadow_fist','spinning_blade','healing','parasitic_gu'].map(id=>({id,level:1}));
          s.stageSystem.flowState='SKILL_REWARD';s.stageSystem.awaitingSkillRewardClose=true;
          s.upgradeSystem.pending=0;s.upgradeSystem.panelOpen=false;
          window.originalRoll=s.upgradeSystem.rollOptions;
          s.upgradeSystem.rollOptions=()=>[{type:'newSkill',id:'new_sword_wave',skillId:'sword_wave'},{type:'skillLevel',id:'lv_fireball',skillId:'fireball',nextLevel:2},{type:'newSkill',id:'new_black_hole',skillId:'black_hole'}];
          s.upgradeSystem.requestSkillReward();s.upgradeSystem.rollOptions=window.originalRoll;
          window.beforeCancel=JSON.stringify({skills:s.playerData.skills,gold:s.playerData.gold,choices:s.playerData.upgradesChosen});
        },{mode});
        const rewardTap=async(x,y)=>{const box=await page.locator('canvas').first().boundingBox();await page.touchscreen.tap(box.x+x*box.width/720,box.y+y*box.height/1280);await pause(100);};
        for(let attempt=0;attempt<2;attempt++){
          await rewardTap(170,294);await rewardTap(170,294);
          assert(await page.evaluate(()=>s.upgradePanel.nodes.some(n=>n.text==='取消 / 返回')),'real reward confirmation keeps replacement cancel visible');
          await page.screenshot({path:'test-artifacts/shop/'+name+'-'+mode+'-reward-replace.png'});
          await rewardTap(360,260);
          assert(await page.evaluate(()=>!s.upgradeSystem.pendingReplacement&&s.upgradeSystem.pending===1&&s.upgradePanel.options.length===3&&s.isGameplayPaused()&&!s.shopPanel.isOpen&&s.shopSystem.visits===0&&window.beforeCancel===JSON.stringify({skills:s.playerData.skills,gold:s.playerData.gold,choices:s.playerData.upgradesChosen})),'touch cancel restores same rewards without consuming resources, opening shop or resuming');
        }
        await page.screenshot({path:'test-artifacts/shop/'+name+'-'+mode+'-reward-cancel.png'});
        await rewardTap(170,294);await rewardTap(170,294);await rewardTap(140+(slot%3)*220,604);
        assert(await page.evaluate(({slot,mode})=>s.playerData.skills[slot].id==='sword_wave'&&s.upgradeSystem.pending===0&&!s.upgradePanel.isOpen&&(mode==='normal'?(s.shopPanel.isOpen&&s.isGameplayPaused()&&s.shopSystem.visits===1):!s.isGameplayPaused()),{slot,mode}),'fifth/sixth slot opens normal shop once; test mode resumes combat');
        if(mode==='normal') await rewardTap(537,1022);
      }
      await page.evaluate(()=>{s.runMode='normal';s.skillSystem.reset();s.playerData.skills=[];});
      await page.evaluate(async()=>{
        const {SHOP_ITEMS}=await import('/src/config/shopItems.js');
        const {SKILLS}=await import('/src/config/skills.js');
        window.shopCatalog=SHOP_ITEMS;window.skillCatalog=SKILLS;
        s.playerData.gold=200;s.shopSystem.open('browser_first');
        s.shopSystem.currentItems=['iron_blade','life_stone','hourglass_shard'].map(id=>{
          const item=SHOP_ITEMS.find(i=>i.id===id);return {...item,itemId:id,id:'browser_'+id};
        });
        const cfg=SKILLS.healing;
        s.shopSystem.currentItems.push({id:'browser_skill',itemId:cfg.id,skillId:cfg.id,kind:'skill',
          name:cfg.name,description:cfg.description,icon:cfg.short,rarity:cfg.rarity,price:20,locked:false,type:'newSkill'});
        s.shopPanel.render();
      });
      const tap=async(x,y)=>{
        const box=await page.locator('canvas').first().boundingBox();
        await page.touchscreen.tap(box.x+x*box.width/720,box.y+y*box.height/1280);
        await pause(80);
      };
      await tap(111,410);await page.screenshot({path:'test-artifacts/shop/'+name+'-buy.png'});
      await tap(360,808);
      assert.equal(await page.evaluate(()=>s.shopSystem.inventory.length),1,'touch buys item');
      assert.equal(await page.evaluate(()=>s.playerData.gold),192);
      await tap(277,566);assert(await page.evaluate(()=>s.shopSystem.currentItems[1].locked),'touch locks');
      await tap(537,934);assert.equal(await page.evaluate(()=>s.playerData.gold),188);
      assert.equal(await page.evaluate(()=>s.shopSystem.currentItems[1].itemId),'life_stone');
      await tap(183,934);await tap(111,410);
      await page.screenshot({path:'test-artifacts/shop/'+name+'-sell.png'});
      await tap(360,808);assert.equal(await page.evaluate(()=>s.shopSystem.inventory.length),0);
      assert.equal(await page.evaluate(()=>s.playerData.gold),192);
      await tap(183,934);
      // Real skill acquire / upgrade / replacement through touch, with deterministic offers.
      await page.evaluate(()=>{
        const cfg=skillCatalog.healing;
        s.shopSystem.currentItems[0]={id:'healing_offer',skillId:cfg.id,itemId:cfg.id,kind:'skill',name:cfg.name,
          icon:cfg.short,rarity:cfg.rarity,price:20,locked:false,type:'newSkill'};
        s.shopPanel.render();
      });
      await tap(111,410);await tap(132,808);
      assert.deepEqual(await page.evaluate(()=>s.shopPanel.nodes.filter(n=>n.type==='Text'&&[662,668].includes(n.y)&&n.getBounds().bottom>780).map(n=>n.text)),[],'skill details must stay above purchase buttons');
      await page.screenshot({path:'test-artifacts/shop/'+name+'-skill-details.png'});
      await tap(360,808);assert.equal(await page.evaluate(()=>s.skillSystem.getLevel('healing')),1);
      await page.evaluate(()=>{
        s.shopSystem.purchased.delete('healing_offer');s.shopPanel.selectedId='healing_offer';s.shopPanel.render();
      });
      await tap(360,808);assert.equal(await page.evaluate(()=>s.skillSystem.getLevel('healing')),2);
      await page.evaluate(()=>{
        s.skillSystem.reset();
        s.playerData.skills=Object.keys(skillCatalog).filter(id=>id!=='healing').slice(0,6).map(id=>({id,level:1}));
        s.shopSystem.purchased.delete('healing_offer');s.shopPanel.render();
        window.beforeReplaceGold=s.playerData.gold;
      });
      await tap(360,808);assert.equal(await page.evaluate(()=>s.shopPanel.mode),'replace');
      await tap(190,850);assert.equal(await page.evaluate(()=>s.shopPanel.mode),'buy');
      assert(await page.evaluate(()=>s.playerData.gold===beforeReplaceGold),'cancel costs nothing');
      await tap(360,808);await tap(580,590);
      await page.screenshot({path:'test-artifacts/shop/'+name+'-replacement.png'});
      await tap(530,850);assert.equal(await page.evaluate(()=>s.playerData.skills[5].id),'healing');
      assert(await page.evaluate(()=>s.playerData.gold===beforeReplaceGold-20));
      assert.deepEqual(await page.evaluate(()=>{
        const overflow=[];
        for(const cfg of Object.values(skillCatalog)){
          const offer={id:'layout_'+cfg.id,skillId:cfg.id,itemId:cfg.id,kind:'skill',name:cfg.name,
            icon:cfg.short,rarity:cfg.rarity,price:20,type:'newSkill'};
          s.shopSystem.currentItems=[offer];s.shopPanel.selectedId=offer.id;
          for(const expanded of [false,true]){
            s.shopPanel.expanded=expanded;s.shopPanel.detailPage=0;s.shopPanel.render();
            const pages=expanded?Number(s.shopPanel.nodes.find(n=>n.type==='Text'&&n.text.includes(' 下一页'))?.text.match(/\/(\d+)/)?.[1]||1):1;
            for(let index=0;index<pages;index++){
              s.shopPanel.detailPage=index;s.shopPanel.render();
              for(const node of s.shopPanel.nodes.filter(n=>n.type==='Text'&&[662,668].includes(n.y))){
                const b=node.getBounds();if(b.bottom>780||b.right>700)overflow.push({id:cfg.id,expanded,index,text:node.text});
              }
            }
          }
        }
        return overflow;
      }),[],'all skill detail pages stay clear of buttons and screen edges');
      // Every pictogram and lengthy description must fit inside the portrait viewport.
      await page.evaluate(()=>{
        for(const item of shopCatalog){
          const unit={...item,itemId:item.id,id:'extra_'+item.id};
          s.shopSystem.currentItems=[unit];s.playerData.gold=1000;s.shopSystem.buy(unit.id);
        }
        s.shopPanel.mode='sell';s.shopPanel.selectedId=null;s.shopPanel.page=0;s.shopPanel.render();
      });
      for(let i=0;i<4;i++){
        await page.screenshot({path:'test-artifacts/shop/'+name+'-items-'+i+'.png'});
        assert.deepEqual(await page.evaluate(()=>s.shopPanel.nodes.filter(n=>n.type==='Text').filter(n=>{
          const b=n.getBounds();return b.left<20||b.right>700||b.bottom>1100;
        }).map(n=>n.text)),[],'text stays inside safe width');
        assert.deepEqual(await page.evaluate(()=>s.shopPanel.nodes.filter(n=>n.type==='Text'&&n.text.startsWith('×')&&n.getBounds().bottom>557).map(n=>n.text)),[],'owned counts must stay above pagination buttons');
        if(i<3)await tap(472,584);
      }
      await tap(537,1022);
      assert.equal(await page.evaluate(()=>s.shopPanel.isOpen),false);
      assert.equal(await page.evaluate(()=>s.shopSystem.currentShopReason),null);
      assert.equal(await page.evaluate(()=>s.isGameplayPaused()),false);
      await pause(250);
      assert.equal(await page.locator('#global-error-panel').count(),0);
      assert.deepEqual(errors,[]);
      console.log(name+': real phone-size touch buying, refresh, lock, sale, acquire, upgrade, sixth-slot replacement, pagination, leave and text bounds PASS');
    } finally {await browser.close();}
  }
} finally {
  server.kill('SIGTERM');fs.rmSync(entry,{force:true});fs.rmSync(html,{force:true});
}
