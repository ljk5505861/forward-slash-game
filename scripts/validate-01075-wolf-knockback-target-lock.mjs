import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.window={cordova:undefined,navigator:{userAgent:''},addEventListener(){},removeEventListener(){}};
globalThis.document={documentElement:{style:{}},createElement:()=>({getContext:()=>({fillRect(){},clearRect(){},drawImage(){},getImageData:()=>({data:[0,0,0,255]}),putImageData(){},createImageData:()=>({data:[0,0,0,0]})})})};
Object.defineProperty(globalThis,'navigator',{value:globalThis.window.navigator,configurable:true});
globalThis.HTMLCanvasElement=class {};
globalThis.Image=class {};
const { default: CombatSystem, FRONTLINE_SWITCH_THRESHOLD } = await import('../src/systems/CombatSystem.js');
const { default: EnemyBehaviorManager } = await import('../src/enemies/behaviors/EnemyBehaviorManager.js');
const { GAME_VERSION } = await import('../src/config/version.js');

assert.equal(GAME_VERSION,'0.11.2');
assert.equal(FRONTLINE_SWITCH_THRESHOLD,18);
const src = {
  wolf: fs.readFileSync('src/skills/handlers/SpiritWolvesSkill.js','utf8'),
  combat: fs.readFileSync('src/systems/CombatSystem.js','utf8'),
  enemy: fs.readFileSync('src/entities/createEnemy.js','utf8'),
  behavior: fs.readFileSync('src/enemies/behaviors/EnemyBehaviorManager.js','utf8'),
  stage: fs.readFileSync('src/systems/StageSystem.js','utf8')
};
assert.doesNotMatch(Object.values(src).join('\n'),new RegExp('force'+'PlayerTargetUntilHit'),'obsolete breach state is fully removed');
assert.match(src.combat,/getFrontmostEnemyAttackTarget/);
assert.match(src.combat,/FRONTLINE_SWITCH_THRESHOLD\s*=\s*18/);
assert.match(src.stage,/chooseEnemyAttackTarget[\s\S]*damageAttackTarget/);
assert.doesNotMatch(src.wolf,/w\.x>=before/,'dt=0 no longer clears pending knockback');

function target(type,x,y=100){ return {type,x,y,hp:40,maxHp:40,active:true,isDefeated:false,height:80,isAlive(){return this.hp>0&&this.active!==false&&!this.isDefeated;},takeDamage(n){this.hp=Math.max(0,this.hp-n);}}; }
function body(){ return {vx:0,velocity:{x:0},setVelocityX(v){this.vx=v;this.velocity.x=v;}}; }
function sceneWith(targets=[]){ const scene={ player:target('player',200), playerData:{hp:100,maxHp:100,dodgeChance:0}, enemies:[], balance:{enemies:{rangeBuffer:24},enemyFadeMs:1}, isGameplayPaused:()=>false, floatText(){}, finishRun(){}, hud:{update(){},setStatus(){}}, eventBus:{emit(){}}, tweens:{add(c){c.onComplete?.();return{};}}, targeting:{valid:e=>!!e?.active&&!e.isDefeated,isEnemyFullyInsideViewport:()=>true,shouldRecycleEnemyLeft:()=>false,getEnemyRightRespawnX:()=>900}, statusEffects:{clearTarget(){},getEffects:()=>[],absorbShield:d=>({absorbed:0,remainingDamage:d})}, skillSystem:{passiveState:{spiritWolves:{wolves:targets.filter(t=>t.type==='spiritWolf')}},beforePlayerDamage:()=>null,beforePlayerHpDamage:()=>null} }; scene.combatSystem=new CombatSystem(scene); return scene; }
const enemy=(x=360,range=70)=>({x,y:100,active:true,destroy(){this.active=false;},isDefeated:false,hp:50,maxHp:50,damage:5,attackRange:range,attackIntervalMs:100,nextAttackAt:0,speed:40,body:body(),behavior:'grunt'});

// A. frontline target priority and debounce
{ const wolfA=target('spiritWolf',300), wolfB=target('spiritWolf',260); const s=sceneWith([wolfA,wolfB]); const e=enemy(); assert.equal(s.combatSystem.getOrLockEnemyTarget(e),wolfA); wolfA.x=280; wolfB.x=270; assert.equal(s.combatSystem.getOrLockEnemyTarget(e),wolfA,'10px lead does not switch'); wolfA.x=240; wolfB.x=270; assert.equal(s.combatSystem.getOrLockEnemyTarget(e),wolfB,'30px lead switches'); wolfA.x=190; wolfB.x=180; e.lockedAttackTarget=null; assert.equal(s.combatSystem.getOrLockEnemyTarget(e).type,'player','player is frontmost when wolves are behind'); wolfA.x=240; assert.equal(s.combatSystem.getOrLockEnemyTarget(e),wolfA,'wolf retakes aggro after moving 40px ahead of player'); e.lockedAttackTarget=s.player; wolfA.x=210; wolfB.x=205; assert.equal(s.combatSystem.getOrLockEnemyTarget(e).type,'player','10px lead keeps current player lock'); e.lockedAttackTarget=null; assert.equal(s.combatSystem.getOrLockEnemyTarget(e),wolfA,'first lock picks max x even within threshold'); wolfA.hp=0; assert.equal(s.combatSystem.getOrLockEnemyTarget(e),wolfB,'dead target causes immediate frontline reselection'); }

// B. real CombatSystem + EnemyBehaviorManager movement/attack flow
{ const wolfA=target('spiritWolf',300), wolfB=target('spiritWolf',260); const s=sceneWith([wolfA,wolfB]); const e=enemy(390,50); s.enemies=[e]; const m=new EnemyBehaviorManager(s); m.updateEnemyApproach(e); assert.equal(e.lockedAttackTarget,wolfA); assert.equal(e.body.vx,-40,'enemy moves toward front wolf outside range'); e.x=340; m.updateEnemyApproach(e); assert.equal(e.body.vx,0,'enemy stops in attack range'); s.combatSystem.updateEnemyAttack(e,0); assert.equal(wolfA.hp,35,'enemy attacks locked front wolf'); wolfA.x=280; wolfB.x=270; e.x=340; m.updateEnemyApproach(e); assert.equal(e.lockedAttackTarget,wolfA,'still follows A while A remains effectively front'); wolfA.x=240; wolfB.x=270; m.updateEnemyApproach(e); assert.equal(e.lockedAttackTarget,wolfB,'switches to B when B is clearly front'); wolfA.x=190; wolfB.x=180; e.lockedAttackTarget=wolfB; m.updateEnemyApproach(e); assert.equal(e.lockedAttackTarget.type,'player','player naturally becomes target when frontmost'); e.x=240; e.nextAttackAt=0; s.combatSystem.updateEnemyAttack(e,0); assert.equal(s.playerData.hp,95,'player is attacked when frontmost'); wolfA.x=240; e.nextAttackAt=0; s.combatSystem.updateEnemyAttack(e,100); assert.equal(e.lockedAttackTarget,wolfA,'wolf retakes blocking after running ahead'); assert.equal(wolfA.hp,30); }

// C. wolf smooth knockback source-level invariants, including dt=0 fix
assert.match(src.wolf,/pendingKnockbackDistance=\(Number\(w\.pendingKnockbackDistance\)\|\|0\)\+dist/);
assert.match(src.wolf,/if\(step>0\)\{ w\.x-=step; w\.pendingKnockbackDistance-=step; \}/);
assert.match(src.wolf,/WOLF_KNOCKBACK_SLIDE_SPEED=360/);
assert.match(src.wolf,/enemy\?\.isBoss\?32:\(enemy\?\.isElite\?42:48\)/);
assert.match(src.behavior,/knockbackDistance:12/);

// D. archer single hit and frontline retargeting
{ const wolfA=target('spiritWolf',300), wolfB=target('spiritWolf',260); const s=sceneWith([wolfA,wolfB]); const calls=[]; s.add={rectangle(){return {setDepth(){return this},destroy(){this.destroyed=true}}}}; s.tweens={add(c){c.onComplete?.();return c;},killTweensOf(){}}; const archer={...enemy(700,450),behavior:'archer',width:55,height:86,attackIntervalMs:2000,setFillStyle(){}}; s.enemies=[archer]; const original=s.combatSystem.damageAttackTarget.bind(s.combatSystem); s.combatSystem.damageAttackTarget=(t,a,m)=>{calls.push({t,a,m}); return original(t,a,m);}; const m=new EnemyBehaviorManager(s); m.attach(archer); m.update(0); assert.equal(calls.length,1); assert.equal(calls[0].t,wolfA); assert.equal(calls[0].m.source,'archerArrow'); assert.equal(calls[0].m.knockbackDistance,12); m.update(1000); assert.equal(calls.length,1,'arrow cooldown prevents duplicate melee/arrow hit'); wolfA.x=240; wolfB.x=270; m.update(2100); assert.equal(calls.at(-1).t,wolfB,'archer switches when another target is clearly front'); }

// E/F. boss/radius/recycle cleanup invariants
{ const wolf=target('spiritWolf',240), behind=target('spiritWolf',180); const s=sceneWith([wolf,behind]); const boss={...enemy(360,155),isBoss:true,isKnockbackActive:true,attackIntervalMs:1000,nextAttackAt:0}; assert.equal(s.combatSystem.chooseEnemyAttackTarget(boss,275),wolf,'boss counter chooses front wolf'); wolf.x=170; boss.lockedAttackTarget=wolf; assert.equal(s.combatSystem.chooseEnemyAttackTarget(boss,275).type,'player','boss can switch to player when player is front'); wolf.x=240; assert.equal(s.combatSystem.chooseEnemyAttackTarget(boss,275),wolf,'boss does not permanently lock player'); const hits=s.combatSystem.damageTargetsInRadius(200,100,80,3,{enemy:boss,source:'midBossSlam',attackType:'ground',singleTarget:false}); assert.ok(hits.some(h=>h.target===behind),'radius damage still hits behind wolf'); boss.lockedAttackTarget=wolf; s.combatSystem.killEnemy(boss); assert.equal(boss.lockedAttackTarget,null,'death clears locked target'); const recycler=new EnemyBehaviorManager(s); const e=enemy(); e.lockedAttackTarget=wolf; s.targeting.getEnemyRightRespawnX=()=>900; recycler.recycleEnemy(e); assert.equal(e.lockedAttackTarget,null,'recycle clears locked target'); }

console.log('v0.11.1 frontline target priority and wolf knockback validation passed.');
