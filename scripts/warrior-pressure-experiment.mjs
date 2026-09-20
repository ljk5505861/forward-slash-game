// TEST BRANCH ONLY. Runtime fixture overrides, no production configuration edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
const engines=await import(process.env.PLAYWRIGHT_MODULE);
const engine=process.env.EXPERIMENT_BROWSER||'chromium';
assert(['chromium','webkit'].includes(engine));
const dir=`test-artifacts/warrior-pressure/${engine}`;
fs.mkdirSync(dir,{recursive:true});
const entry='src/pressure-experiment-entry.js',html='pressure-experiment.html';
for(const p of [entry,html]) assert(!fs.existsSync(p),'do not overwrite an existing file');
fs.writeFileSync(entry,fs.readFileSync('src/main.js','utf8').replace('const game = new Phaser.Game(gameConfig);','const game = window.__pressureGame = new Phaser.Game(gameConfig);'));
fs.writeFileSync(html,fs.readFileSync('index.html','utf8').replace('/src/main.js','/src/pressure-experiment-entry.js'));
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4175','--strictPort','--base','/'],{stdio:'pipe'});
server.stderr.on('data',b=>process.stderr.write(b));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
const results=[];
try{
  let ready=false;
  for(let n=0;n<80;n++){try{ready=(await fetch('http://127.0.0.1:4175/'+html)).ok;}catch{}if(ready)break;await pause(250);}
  assert(ready);
  browser=await engines[engine].launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function run(config){
    const id=`${config.label}-s${config.seed}-n${config.count}-a${config.attackSpeed}`;
    await page.goto('http://127.0.0.1:4175/'+html);
    await page.waitForFunction(()=>window.__pressureGame?.scene.getScene('GameScene')?.startMenu);
    await page.evaluate(async config=>{
      let seed=config.seed;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
      const {WEAPONS}=await import('/src/config/weapons.js');
      const constants=await import('/src/systems/CombatSystem.js');
      const s=window.s=window.__pressureGame.scene.getScene('GameScene');s.startRun('normal');
      s.stageSystem.clearEnemies();s.stageSystem.flowState='PRESSURE_EXPERIMENT';
      s.playerData.attackSpeedMultiplier=config.attackSpeed;s.gameSpeed.setSpeed(2);
      const r=window.pressure={config,start:s.getGameplayTime(),hits:[],attacks:[],knockbacks:[],initial:[],finished:false,
        constants:{distance:WEAPONS.short_sword.knockback,duration:constants.NORMAL_ATTACK_KNOCKBACK_DURATION_MS,lift:constants.NORMAL_ATTACK_KNOCKBACK_LIFT_PX},
        controlledEnemyMs:0,aliveEnemyMs:0,maxNear:0,last:s.getGameplayTime()};
      const c=s.combatSystem,originalKnockback=c.applyKnockback.bind(c);
      c.applyKnockback=(e,meta)=>{
        const before={at:s.getGameplayTime()-r.start,unit:e.fixtureId,x:e.x,y:e.y,restart:!!e.isKnockbackActive,distance:meta?.knockback};
        const result=originalKnockback(e,meta);
        if(result&&e.enemyId==='grunt'){e.lastFixtureKnockback=s.getGameplayTime();r.knockbacks.push({...before,until:e.knockbackUntil-r.start});}
        return result;
      };
      const positions=s.stageSystem.assignWaveSpawnXs(Array.from({length:config.count},()=>({id:'grunt'})));
      positions.forEach(({x},i)=>{
        const e=s.stageSystem.spawn('grunt',x);e.fixtureId=i;
        // Restore effective pre-redesign Lv1 stats for the control, not raw config HP.
        if(config.legacy){e.hp=e.maxHp=32;e.attackIntervalMs=e.baseAttackIntervalMs=1650;}
        e.speed=config.speed;e.attackRange=config.range;
        r.initial.push({unit:i,hp:e.hp,damage:e.damage,speed:e.speed,range:e.attackRange,interval:e.attackIntervalMs});
      });
      const offAttack=s.eventBus.on('PLAYER_ATTACK',p=>r.attacks.push({at:s.getGameplayTime()-r.start,unit:p.enemy?.fixtureId}));
      const offHit=s.eventBus.on('PLAYER_DAMAGED',p=>{
        if(p.hpDamage<=0)return;const e=p.enemy;
        r.hits.push({at:s.getGameplayTime()-r.start,unit:e?.fixtureId,damage:p.hpDamage,kb:!!e?.isKnockbackActive,
          dx:e?.x-s.player.x,dy:e?.y-s.player.y,sinceKnockback:e?.lastFixtureKnockback===undefined?null:s.getGameplayTime()-e.lastFixtureKnockback});
      });
      const tick=()=>{
        const alive=s.enemies.filter(e=>!e.isDefeated),now=s.getGameplayTime(),dt=now-r.last;r.last=now;
        r.aliveEnemyMs+=dt*alive.length;r.controlledEnemyMs+=dt*alive.filter(e=>e.isKnockbackActive).length;
        r.maxNear=Math.max(r.maxNear,alive.filter(e=>Math.hypot(e.x-s.player.x,e.y-s.player.y)<=e.attackRange).length);
        if(now-r.start>=45000||!alive.length||s.playerData.hp<=0){
          r.finished=true;r.elapsed=now-r.start;r.hp=s.playerData.hp;r.remaining=alive.length;
          offAttack();offHit();s.events.off('update',tick);
          s.stageSystem.flowState='EXPERIMENT_DONE';s.beginGameplayPause();
        }
      };
      s.events.on('update',tick);s.events.once('shutdown',()=>{offAttack();offHit();s.events.off('update',tick);});
    },config);
    await page.waitForFunction(()=>window.pressure?.hits.length>0||window.pressure?.finished,null,{timeout:60000});
    if(config.seed===1126)await page.screenshot({path:`${dir}/${id}.png`});
    await page.waitForFunction(()=>window.pressure?.finished,null,{timeout:60000});
    const r=await page.evaluate(()=>window.pressure);
    fs.writeFileSync(`${dir}/${id}.json`,JSON.stringify(r,null,2));
    assert.deepEqual(r.constants,{distance:72,duration:440,lift:24});
    assert(r.hits.every(h=>!h.kb),'warriors never attack while knockback control is active');
    assert.equal(await page.locator('#global-error-panel').count(),0);
    assert.deepEqual(errors,[]);
    const summary={...config,hits:r.hits.length,damage:500-r.hp,seconds:+(r.elapsed/1000).toFixed(2),remaining:r.remaining,
      suppression:+(r.controlledEnemyMs/Math.max(1,r.aliveEnemyMs)).toFixed(3),restarts:r.knockbacks.filter(k=>k.restart).length,
      hitBeforeAnyKnockback:r.hits.filter(h=>h.sinceKnockback===null).length,hitAfterLanding:r.hits.filter(h=>h.sinceKnockback!==null).length};
    results.push(summary);fs.writeFileSync(`${dir}/summary.json`,JSON.stringify(results,null,2));
    console.log('RESULT '+engine+' '+JSON.stringify(summary));
    return summary;
  }
  const current={label:'current',speed:216,range:86,legacy:false};
  const old={label:'old-effective-stats',speed:216,range:86,legacy:true};
  // Screening includes slower and faster approach, without touching knockback visuals.
  const grid=[];
  for(const speed of [144,216,288])for(const range of [48,64,86])grid.push({label:`speed${speed}-range${range}`,speed,range,legacy:false});
  const screening=[];
  for(const cfg of [old,current,...grid.filter(c=>c.speed!==216||c.range!==86)]){
    const r=await run({...cfg,seed:1126,count:10,attackSpeed:1});
    if(!cfg.legacy)screening.push(r);
  }
  const best=screening.filter(r=>r.remaining===0).sort((a,b)=>Math.abs(a.hits-3.5)-Math.abs(b.hits-3.5)).slice(0,2)
    .map(({label,speed,range,legacy})=>({label,speed,range,legacy}));
  fs.writeFileSync(`${dir}/selected.json`,JSON.stringify(best,null,2));
  // Report all outcomes, including zero hits or >4; never loosen a target assertion or pick a lucky seed.
  const validation=[old,current,...best.filter(c=>c.label!=='current')];
  for(const cfg of validation)for(const seed of [1126,2026,7]){
    if(seed!==1126)await run({...cfg,seed,count:10,attackSpeed:1});
    await run({...cfg,seed,count:1,attackSpeed:1});
    await run({...cfg,seed,count:10,attackSpeed:2});
  }
  console.log('COMPLETE '+engine+' '+results.length+' fights');
}finally{
  await browser?.close();server.kill('SIGTERM');
  fs.rmSync(entry,{force:true});fs.rmSync(html,{force:true});
}
