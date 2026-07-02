import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';

assert.equal(GAME_VERSION, '0.11.0');
assert.equal(SKILLS.white_dwarf.levels.length, 9);
assert.equal(SKILLS.white_dwarf.description, '白矮星永久围绕玩家旋转，提供常驻减伤和护体；触碰敌人时以强重力造成高额魔法伤害，并将敌人瞬间压扁。');
assert.equal(SKILLS.white_dwarf.levels.some(l => 'guardTriggerMaxHpRatio' in l || 'criticalHpRatio' in l), false);
assert.deepEqual(SKILLS.white_dwarf.levels.map(l => l.contactDamage), [70,85,100,120,140,165,195,230,280]);
assert.deepEqual(SKILLS.white_dwarf.levels.map(l => l.contactCooldownMs), [1800,1750,1700,1650,1600,1500,1400,1300,1200]);
assert.equal(SKILLS.white_dwarf.levels.some(l => 'contactKnockback' in l), false);
assert.deepEqual(SKILLS.white_dwarf.levels.map(l => l.contactPadding), [8,8,9,9,10,11,12,13,14]);
assert.equal(Object.values(SKILLS).filter(s => !s.hidden).length, 38);
assert.equal(['solar_flame','myriad_afterimage','poison_king','lightning_tribulation','black_hole','neutron_star','white_dwarf'].filter(id => SKILLS[id]?.rarity === 'MYTHIC').length, 7);

const detailSource = readFileSync(new URL('../src/ui/skillDetailContent.js', import.meta.url), 'utf8');
assert(!detailSource.includes('guardTriggerMaxHpRatio'));
assert(!detailSource.includes('criticalHpRatio'));

function visual(type) { return { type, destroyed:false, x:0, y:0, alpha:1, scale:1, setDepth(){return this;}, setScrollFactor(){return this;}, setStrokeStyle(width,color,alpha){this.strokeStyle={width,color,alpha};return this;}, setOrigin(){return this;}, setPosition(x,y){this.x=x;this.y=y;return this;}, setAlpha(a){this.alpha=a;return this;}, setRotation(r){this.rotation=r;return this;}, setScale(s){this.scale=s;return this;}, destroy(){this.destroyed=true;return this;} }; }
function events(){ const m=new Map(); return { once(n,cb){m.set(n,cb);}, off(n,cb){ if(m.get(n)===cb)m.delete(n);}, emit(n){m.get(n)?.();}, count(n){return m.has(n)?1:0;} }; }
function enemy(id,x,y,o={}){ return { id,x,y,width:o.width??40,displayWidth:o.displayWidth??o.width??40,hp:o.hp??1000,maxHp:o.hp??1000,active:o.active??true,inside:o.inside??true,isDefeated:false,isElite:!!o.isElite,isBoss:!!o.isBoss,charging:!!o.charging,casting:!!o.casting,jumping:!!o.jumping,attackState:o.attackState,body:{width:o.width??40} }; }
function scene(){ const created=[]; const floats=[]; const s={ now:0,enemies:[],player:{x:300,y:600},playerData:{hp:100,maxHp:100,damageReductionBonuses:{},skills:[]},events:events(),created,floats,hits:[],knockbacks:[],getGameplayTime(){return this.now;},targeting:{valid:t=>!!t&&t.active!==false&&!t.isDefeated&&t.hp>0,all(){return s.enemies.filter(this.valid);},isEnemyFullyInsideViewport:t=>t.inside!==false},add:{circle(x=0,y=0){const o=visual('circle').setPosition(x,y);created.push(o);return o;},line(){const o=visual('line');created.push(o);return o;},rectangle(x=0,y=0){const o=visual('rectangle').setPosition(x,y);created.push(o);return o;}},combatSystem:{damageEnemy(t,d,meta){const resolved=Math.round(d);t.hp-=resolved;if(t.hp<=0)t.isDefeated=true;s.hits.push({target:t,damage:resolved,meta,time:s.now});return true;},applyKnockback(t,meta){s.knockbacks.push({target:t,meta,time:s.now});return true;}},floatText(x,y,text,color){floats.push({x,y,text,color,time:s.now});} }; return s; }
function system(s,levels={}){ return { scene:s, passiveUpdaters:[], getLevel:id=>levels[id]||0, getData:(id,l=levels[id])=>SKILLS[id].levels[l-1] }; }
function tick(sys,ms=0){ sys.scene.now+=ms; [...sys.passiveUpdaters].forEach(fn=>fn()); }

// Guard trigger and lifecycle.
{
  const s=scene(); const levels={}; const sys=system(s,levels);
  SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,1000);
  assert.equal(s.whiteDwarfRuntime, undefined, 'unowned white dwarf creates no runtime or reduction');
  assert.equal(s.playerData.damageReductionBonuses.white_dwarf, undefined);
  levels.white_dwarf=1; SKILL_HANDLERS.white_dwarf.onAcquire(sys);
  const rt=s.whiteDwarfRuntime;
  assert.equal(rt.charges.length,1); assert.equal(rt.charges[0].readyAt, s.now);
  assert.equal(rt.visuals.length,1); assert(rt.visuals[0].core && rt.visuals[0].glow, 'star has core and glow');
  assert.equal(SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:false,hpDamage:80}), null);
  for (const source of ['poison','burn','ground','environment']) assert.equal(SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:false,hpDamage:50,source}), null);
  let result=SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:5});
  assert.deepEqual({hpDamage:result.hpDamage,blockedDamage:result.blockedDamage},{hpDamage:2,blockedDamage:3});
  assert.match(s.floats.at(-1).text,/^简并护体 -3$/);
  assert(rt.charges[0].readyAt>s.now);
  assert.equal(SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:50}), null, 'same hit window has no second charge');
  tick(sys,4000); const rem=rt.charges[0].readyAt-s.now; const pausedAt=s.now; s.now+=5000; SKILL_HANDLERS.white_dwarf.shiftTimers(sys,5000,pausedAt); tick(sys,0); assert.equal(rt.charges[0].readyAt-s.now, rem, 'real pause shift preserves remaining guard recharge');
  tick(sys,4500); assert.equal(rt.getSkillBarState().text,'护体 1/1');
  result=SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:1});
  assert.equal(result.hpDamage,0, 'tiny damage may round to zero while consuming charge');
  SKILL_HANDLERS.white_dwarf.destroyRuntime(sys);
  assert.equal(s.whiteDwarfRuntime,null); assert.equal(s.playerData.damageReductionBonuses.white_dwarf, undefined);
}

// Contact uses star coordinates, per-enemy cooldown, shared Lv9 cooldown, tags/meta and knockback gates.
{
  const s=scene(); const levels={white_dwarf:9}; const sys=system(s,levels);
  SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,0);
  const rt=s.whiteDwarfRuntime; const data=SKILLS.white_dwarf.levels[8];
  const star=rt.visuals[0];
  const nearPlayerFarStar=enemy('near-player',s.player.x,s.player.y,{hp:1000});
  const normal=enemy('normal',star.x+data.whiteDwarfVisualRadius+20,s.player.y,{hp:1000});
  s.enemies=[nearPlayerFarStar,normal]; tick(sys,0);
  assert.equal(s.hits.some(h=>h.target.id==='near-player'), false, 'player center proximity is not contact');
  assert.equal(s.hits.filter(h=>h.target.id==='normal').length, 1, 'star coordinate contact deals damage');
  const hit=s.hits.find(h=>h.target.id==='normal');
  assert.equal(hit.damage,280); assert.equal(hit.meta.allowLifeSteal,false); assert.equal(hit.meta.noKnockback,true); assert.deepEqual(hit.meta.tags, ['magic','celestial','buildCelestial']);
  assert.deepEqual(s.knockbacks.map(k=>k.target.id), []);
  tick(sys,100); assert.equal(s.hits.filter(h=>h.target.id==='normal').length,1,'same enemy cooldown blocks repeats');
  const other=enemy('other',rt.visuals[1].x,rt.visuals[1].y,{hp:1000}); s.enemies.push(other); tick(sys,0); assert.equal(s.hits.filter(h=>h.target.id==='other').length,1,'different enemy has own cooldown');
  s.now += data.contactCooldownMs; tick(sys,0); normal.x=rt.visuals[0].x; normal.y=rt.visuals[0].y; tick(sys,0); assert.equal(s.hits.filter(h=>h.target.id==='normal').length,2,'cooldown expiry allows next hit');
  tick(sys,data.contactCooldownMs); const boss=enemy('boss',rt.visuals[0].x,rt.visuals[0].y,{isBoss:true,hp:1000}); const protectedEnemy=enemy('protected',rt.visuals[1].x,rt.visuals[1].y,{charging:true,hp:1000}); s.enemies.push(boss,protectedEnemy); tick(sys,0);
  assert(s.hits.some(h=>h.target.id==='boss')); assert(s.hits.some(h=>h.target.id==='protected'));
  assert(!s.knockbacks.some(k=>k.target.id==='boss'||k.target.id==='protected'), 'boss/protected enemies take damage without movement');
  tick(sys,data.contactCooldownMs); const doomed=enemy('doomed',rt.visuals[0].x,rt.visuals[0].y,{hp:1}); s.enemies.push(doomed); tick(sys,0); assert(rt.contactReadyAtByEnemy.has(doomed)); doomed.active=false; tick(sys,1000); assert(!rt.contactReadyAtByEnemy.has(doomed),'dead/invalid contact map entries are pruned');
  SKILL_HANDLERS.white_dwarf.destroyRuntime(sys); assert.equal(rt.contactReadyAtByEnemy.size,0);
}

// Milestones.
{
  const s=scene(); const levels={white_dwarf:6}; const sys=system(s,levels); s.enemies=[enemy('a',310,600),enemy('b',330,600,{isBoss:true}),enemy('c',340,600,{casting:true})];
  SKILL_HANDLERS.white_dwarf.bind(sys);
  const r1=SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:50});
  assert.equal(r1.hpDamage,16); assert.equal(s.playerData.damageReductionBonuses.white_dwarf_guard,.16);
  const until=s.whiteDwarfRuntime.guardUntil; s.whiteDwarfRuntime.charges[0].readyAt=s.now; SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:50}); assert.equal(s.whiteDwarfRuntime.guardUntil, until, 'same-time post-guard reduction refreshes, not stacks');
  const burstHits=s.hits.filter(h=>h.meta.skillId==='white_dwarf'&&h.meta.tags.includes('area'));
  assert(burstHits.length>=3); assert(burstHits.every(h=>h.meta.allowLifeSteal===false));
  assert(s.knockbacks.some(k=>k.target.id==='a'));
}
{
  const s=scene(); const levels={white_dwarf:9}; const sys=system(s,levels); s.playerData.hp=30; s.playerData.maxHp=100;
  SKILL_HANDLERS.white_dwarf.bind(sys);
  assert.equal(s.whiteDwarfRuntime.charges.length,2);
  const r=SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:20});
  assert.equal(r.hpDamage,2); assert.equal(r.emergency,true); assert.equal(s.whiteDwarfRuntime.charges.filter(c=>c.readyAt<=s.now).length,1); assert(s.floats.some(f=>f.text==='临界稳定'));
  s.whiteDwarfRuntime.charges[0].readyAt=s.now; s.playerData.hp=5; const death=SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:100}); assert(death.hpDamage>5, 'critical stability is not death immunity');
}


// Pause shifting, persistent flashes, guard rings, and Lv9 next-recharge skillbar.
{
  const s=scene(); const levels={white_dwarf:1}; const sys=system(s,levels);
  SKILL_HANDLERS.white_dwarf.bind(sys);
  const rt=s.whiteDwarfRuntime;
  const beforeCreated=s.created.length;
  SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:10});
  const ringsAfterGuard=s.created.filter(o=>o.strokeStyle).length;
  assert.equal(ringsAfterGuard,1,'Lv1 guard creates a defense ripple');
  const consumeCoreScale=rt.visuals[0].core.scale;
  SKILL_HANDLERS.white_dwarf.syncAttachedVisuals(sys);
  assert.equal(rt.visuals[0].core.scale, consumeCoreScale, 'syncAttachedVisuals preserves consume flash state');
  tick(sys,221);
  assert.equal(rt.visuals[0].core.scale,.86,'consume flash falls back to charging scale');
  const transient=rt.transients[0];
  const visualRemaining=transient.expiresAt-s.now;
  const rechargeRemaining=rt.charges[0].readyAt-s.now;
  const angleBeforePause=rt.angle;
  const lastBeforePause=rt.last;
  const pausedAt=s.now;
  s.now+=5000;
  SKILL_HANDLERS.white_dwarf.shiftTimers(sys,5000,pausedAt);
  tick(sys,0);
  assert.equal(rt.charges[0].readyAt-s.now,rechargeRemaining,'shiftTimers freezes guard recharge across real time jump');
  assert.equal(transient.expiresAt-s.now,visualRemaining,'shiftTimers freezes guard ripple expiration');
  assert.equal(transient.object.destroyed,false,'pause does not destroy ripple early');
  assert(Math.abs(rt.angle-angleBeforePause)<1e-9,'first update after shifted pause does not advance orbit by pause duration');
  assert.equal(rt.last,lastBeforePause+5000,'runtime.last is shifted by paused duration');
  tick(sys,visualRemaining-1);
  assert.equal(transient.object.destroyed,false,'ripple survives until remaining gameplay time elapses');
  tick(sys,1);
  assert.equal(transient.object.destroyed,true,'ripple expires after remaining gameplay time');
  tick(sys,rt.charges[0].readyAt-s.now);
  const readyFlashUntil=rt.charges[0].flashUntil;
  assert(readyFlashUntil>s.now,'recharge completion starts ready flash');
  const readyScale=rt.visuals[0].core.scale;
  tick(sys,0);
  assert.equal(rt.charges[0].flashUntil,readyFlashUntil,'same ready event only flashes once');
  assert.equal(rt.visuals[0].core.scale,readyScale,'repeat update keeps same ready flash state');
  const createdAfterStable=s.created.length;
  tick(sys,16); tick(sys,16); tick(sys,16);
  assert.equal(s.created.length,createdAfterStable,'steady updates do not create extra visuals');
  tick(sys,181);
  assert(rt.visuals[0].core.scale < readyScale,'ready flash returns to normal ready pulse');
  assert(s.created.length>=beforeCreated+1);
}
{
  const s=scene(); const levels={white_dwarf:6}; const sys=system(s,levels);
  s.enemies=[enemy('burst-target',310,600,{hp:1000})];
  SKILL_HANDLERS.white_dwarf.bind(sys);
  SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:20});
  assert.equal(s.created.filter(o=>o.strokeStyle).length,1,'Lv6 guard creates exactly one defense ripple');
  assert(s.hits.some(h=>h.meta.tags.includes('area')),'Lv6 still performs mass recoil damage');
}
{
  const s=scene(); const levels={white_dwarf:9}; const sys=system(s,levels);
  SKILL_HANDLERS.white_dwarf.bind(sys);
  const rt=s.whiteDwarfRuntime;
  rt.charges[0].readyAt=s.now+2000;
  rt.charges[1].readyAt=s.now+5000;
  assert.equal(rt.getSkillBarState().text,'护体 0/2 · 2s');
  tick(sys,2000);
  assert.equal(rt.getSkillBarState().text,'护体 1/2 · 3s');
  tick(sys,3000);
  assert.equal(rt.getSkillBarState().text,'护体 2/2');
}
{
  const s=scene(); const levels={white_dwarf:3}; const sys=system(s,levels);
  SKILL_HANDLERS.white_dwarf.bind(sys);
  SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:20});
  const rt=s.whiteDwarfRuntime;
  const guardRemaining=rt.guardUntil-s.now;
  const pausedAt=s.now;
  s.now+=5000;
  SKILL_HANDLERS.white_dwarf.shiftTimers(sys,5000,pausedAt);
  tick(sys,0);
  assert.equal(rt.guardUntil-s.now,guardRemaining,'shiftTimers freezes Lv3 shell duration');
  assert.equal(s.playerData.damageReductionBonuses.white_dwarf_guard,.12);
  tick(sys,guardRemaining-1);
  assert.equal(s.playerData.damageReductionBonuses.white_dwarf_guard,.12);
  tick(sys,1);
  assert.equal(s.playerData.damageReductionBonuses.white_dwarf_guard,undefined,'Lv3 shell expires after remaining gameplay time');
}
{
  const s=scene(); const levels={white_dwarf:1}; const sys=system(s,levels);
  SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,0);
  const rt=s.whiteDwarfRuntime; const data=SKILLS.white_dwarf.levels[0];
  const target=enemy('cooldown-target',rt.visuals[0].x,rt.visuals[0].y,{hp:1000});
  s.enemies=[target]; tick(sys,0);
  assert.equal(s.hits.filter(h=>h.target===target).length,1);
  const contactRemaining=rt.contactReadyAtByEnemy.get(target)-s.now;
  const pausedAt=s.now;
  s.now+=5000;
  SKILL_HANDLERS.white_dwarf.shiftTimers(sys,5000,pausedAt);
  tick(sys,0);
  assert.equal(rt.contactReadyAtByEnemy.get(target)-s.now,contactRemaining,'shiftTimers freezes contact cooldown');
  target.x=rt.visuals[0].x; target.y=rt.visuals[0].y;
  tick(sys,0);
  assert.equal(s.hits.filter(h=>h.target===target).length,1,'paused contact cooldown cannot hit immediately');
  tick(sys,contactRemaining);
  target.x=rt.visuals[0].x; target.y=rt.visuals[0].y;
  tick(sys,0);
  assert.equal(s.hits.filter(h=>h.target===target).length,2,'contact can hit after remaining gameplay cooldown');
  assert.equal(data.contactCooldownMs,1800);
}

console.log('validate-01089-white-dwarf-feedback passed');
