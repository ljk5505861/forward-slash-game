import assert from 'node:assert/strict';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';

const close = (actual, expected, message, epsilon = 1e-6) => assert(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, got ${actual}`);
const between = (value, a, b, message) => assert(value > Math.min(a, b) && value < Math.max(a, b), `${message}: ${value} not between ${a} and ${b}`);

assert.equal(GAME_VERSION, '0.10.96');
assert.deepEqual(SKILLS.white_dwarf.levels.map(l=>l.contactDamage), [70,85,100,120,140,165,195,230,280]);
assert.deepEqual(SKILLS.white_dwarf.levels.map(l=>l.contactCooldownMs), [1800,1750,1700,1650,1600,1500,1400,1300,1200]);
assert.equal(SKILLS.white_dwarf.levels.some(l=>'contactKnockback' in l), false);
assert.equal(SKILLS.white_dwarf.levels[0].contactDamage, 70);
assert.deepEqual(SKILLS.white_dwarf.levels.map(l=>l.damageReduction), [.12,.13,.15,.16,.17,.19,.20,.21,.24]);
assert.deepEqual(SKILLS.white_dwarf.levels.map(l=>l.guardReduction), [.55,.57,.60,.62,.64,.68,.70,.72,.78]);
assert.deepEqual(SKILLS.white_dwarf.levels.map(l=>l.burstKnockback), [0,0,0,0,0,48,54,60,72]);
assert.equal(Object.values(SKILLS).filter(s => !s.hidden).length, 35);

function visual(type){ return { type,destroyed:false,x:0,y:0,scaleX:1,scaleY:1,scale:1,alpha:1,setDepth(){return this},setStrokeStyle(w,c,a){this.strokeStyle={w,c,a};return this},setPosition(x,y){this.x=x;this.y=y;return this},setAlpha(a){this.alpha=a;return this},setScale(x,y=x){this.scale=x;this.scaleX=x;this.scaleY=y;return this},destroy(){this.destroyed=true;return this} }; }
function enemy(id,x,y,o={}){ return { id,x,y,width:o.width??40,height:o.height??50,displayWidth:o.displayWidth??o.width??40,displayHeight:o.displayHeight??o.height??50,scaleX:o.scaleX??1,scaleY:o.scaleY??1,hp:o.hp??1000,maxHp:o.hp??1000,active:true,isDefeated:false,isElite:!!o.isElite,isBoss:!!o.isBoss,body:{x:x-20,y:y-25,width:o.width??40,height:o.height??50},setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this} }; }
function events(){ return { once(){}, off(){} }; }
function scene(){ const created=[],floats=[]; const s={now:0,enemies:[],player:{x:300,y:600},playerData:{hp:100,maxHp:100,damageReductionBonuses:{}},events:events(),created,floats,hits:[],knockbacks:[],getGameplayTime(){return this.now},targeting:{all(){return s.enemies.filter(e=>e.active!==false&&!e.isDefeated&&e.hp>0)},isEnemyFullyInsideViewport(){return true}},add:{circle(x=0,y=0){const o=visual('circle').setPosition(x,y);created.push(o);return o},ellipse(x=0,y=0){const o=visual('ellipse').setPosition(x,y);created.push(o);return o},rectangle(x=0,y=0){const o=visual('rectangle').setPosition(x,y);created.push(o);return o}},combatSystem:{damageEnemy(t,d,meta){s.hits.push({target:t,damage:Math.round(d),meta,time:s.now}); t.hp-=Math.round(d); if(t.hp<=0)t.isDefeated=true; return true},applyKnockback(t,meta){s.knockbacks.push({target:t,meta});}},floatText(x,y,text,color){floats.push({x,y,text,color,time:s.now})}}; return s; }
function system(s,levels){ return { scene:s, passiveUpdaters:[], getLevel:id=>levels[id]||0 }; }
function tick(sys,ms=0){ sys.scene.now+=ms; [...sys.passiveUpdaters].forEach(fn=>fn()); }
function starContact(sys,e,index=0){ const rt=sys.scene.whiteDwarfRuntime; e.x=rt.visuals[index].x; e.y=rt.visuals[index].y; e.body.x=e.x-20; e.body.y=e.y-25; }
function crushLines(rt){ return rt.transients.filter(t=>t.type==='crushLine'); }

// Lv1 contact: real handler, metadata, no contact knockback, cooldown, nonlethal crush timing, gravity and visual feedback.
{
 const s=scene(), sys=system(s,{white_dwarf:1}); SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,0); const rt=s.whiteDwarfRuntime;
 const far=enemy('far',s.player.x,s.player.y); s.enemies=[far]; tick(sys,0); assert.equal(s.hits.length,0,'no star contact means no damage');
 const n=enemy('normal',0,0,{scaleX:2,scaleY:1.5}); starContact(sys,n); const old={x:n.x,y:n.y,bx:n.body.x,by:n.body.y,bw:n.body.width,bh:n.body.height,w:n.width,h:n.height}; s.enemies=[n]; tick(sys,0);
 assert.equal(s.hits.length,1); assert.equal(s.hits[0].damage,70); assert.equal(s.hits[0].meta.damageKind,'gravityCrush'); assert.equal(s.hits[0].meta.allowLifeSteal,false); assert.equal(s.hits[0].meta.canTriggerArtifacts,false); assert.equal(s.hits[0].meta.noKnockback,true); assert.equal(s.knockbacks.length,0);
 close(n.scaleX,2,'nonlethal hit frame keeps original scaleX'); close(n.scaleY,1.5,'nonlethal hit frame keeps original scaleY'); assert.notEqual(n.scaleX,2*1.35,'hit frame is not final crush scale');
 assert.equal(n.x,old.x); assert.equal(n.y,old.y); assert.equal(n.body.x,old.bx); assert.equal(n.body.y,old.by); assert.equal(n.body.width,old.bw); assert.equal(n.body.height,old.bh); assert.equal(n.width,old.w); assert.equal(n.height,old.h);
 assert.deepEqual(n.gravitySources.get('white_dwarf_gravity_crush'), {sourceId:'white_dwarf_gravity_crush',moveSlow:.80,attackSlow:.50,expiresAt:500,external:true});
 assert(s.created.some(o=>o.type==='ellipse'),'impact ring created'); assert.equal(crushLines(rt).length,6,'upper/lower gravity lines created'); assert(s.floats.some(f=>f.text==='重力碾压')); assert(rt.visuals[0].crushFlashUntil>s.now);
 tick(sys,40); between(n.scaleX,2,2*1.35,'half-compressed scaleX'); between(n.scaleY,1.5,1.5*.25,'half-compressed scaleY');
 tick(sys,40); close(n.scaleX,2*1.35,'normal reaches final crushed scaleX at 80ms'); close(n.scaleY,1.5*.25,'normal reaches final crushed scaleY at 80ms');
 tick(sys,80); close(n.scaleX,2*1.35,'normal hold keeps final crushed scaleX'); close(n.scaleY,1.5*.25,'normal hold keeps final crushed scaleY');
 tick(sys,60); between(n.scaleX,2,2*1.35,'recovery scaleX between target and base'); between(n.scaleY,1.5*.25,1.5,'recovery scaleY between target and base');
 tick(sys,60); close(n.scaleX,2,'normal restores base scaleX at 280ms'); close(n.scaleY,1.5,'normal restores base scaleY at 280ms');
 tick(sys,250); assert.equal(n.gravitySources?.has('white_dwarf_gravity_crush'), false,'gravity source expires after its own duration');
}

// Different enemy independent cooldown; Lv9 two stars share enemy cooldown and do not double hit in one frame.
{
 const s=scene(), sys=system(s,{white_dwarf:9}); SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,0); const a=enemy('a',0,0), b=enemy('b',0,0); starContact(sys,a,0); starContact(sys,b,1); s.enemies=[a,b]; tick(sys,0); assert.equal(s.hits.length,2,'different enemies have independent contact cooldown');
 const c=enemy('c',0,0); tick(sys,1200); starContact(sys,c,0); s.enemies=[c]; tick(sys,0); assert.equal(s.hits.filter(h=>h.target===c).length,1,'Lv9 same frame cannot double damage one enemy');
}

// Elite and boss profiles; boss receives damage without gravity suppression.
{
 const s=scene(), sys=system(s,{white_dwarf:1}); SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,0); const elite=enemy('elite',0,0,{isElite:true}), boss=enemy('boss',0,0,{isBoss:true}); starContact(sys,elite); s.enemies=[elite]; tick(sys,0); tick(sys,80); close(elite.scaleX,1.18,'elite final compressed scaleX'); close(elite.scaleY,.55,'elite final compressed scaleY'); assert.equal(elite.gravitySources.get('white_dwarf_gravity_crush').moveSlow,.50); assert.equal(elite.gravitySources.get('white_dwarf_gravity_crush').attackSlow,.30); assert.equal(elite.gravitySources.get('white_dwarf_gravity_crush').expiresAt,350);
 tick(sys,1800); starContact(sys,boss); s.enemies=[boss]; tick(sys,0); tick(sys,45); close(boss.scaleX,1.05,'boss final compressed scaleX'); close(boss.scaleY,.82,'boss final compressed scaleY'); assert.equal(boss.gravitySources?.has('white_dwarf_gravity_crush'), undefined); assert(s.hits.some(h=>h.target===boss&&h.damage===70));
}

// Repeated crush starts from current display scale without jumping back, never compounds the base multiplier, and eventually restores the original base.
{
 const s=scene(), sys=system(s,{white_dwarf:1}); SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,0); const e=enemy('repeat',0,0,{scaleX:1.2,scaleY:.8}); starContact(sys,e); s.enemies=[e]; tick(sys,0); tick(sys,40); const beforeX=e.scaleX, beforeY=e.scaleY; s.whiteDwarfRuntime.contactReadyAtByEnemy.set(e,0); starContact(sys,e); tick(sys,0); close(e.scaleX,beforeX,'repeat trigger does not jump scaleX back to base'); close(e.scaleY,beforeY,'repeat trigger does not jump scaleY back to base'); tick(sys,80); close(e.scaleX,1.2*1.35,'repeat target still uses permanent base scaleX'); close(e.scaleY,.8*.25,'repeat target still uses permanent base scaleY'); tick(sys,200); close(e.scaleX,1.2,'repeat restores original base scaleX'); close(e.scaleY,.8,'repeat restores original base scaleY');
 e.gravitySources.set('black_hole',{sourceId:'black_hole',moveSlow:.1,attackSlow:.1,expiresAt:999,external:false}); SKILL_HANDLERS.white_dwarf.destroyRuntime(sys); assert.equal(e.gravitySources.has('white_dwarf_gravity_crush'),false); assert.equal(e.gravitySources.has('black_hole'),true);
}

// Compression-stage and recovery-stage pauses shift the entire animation timeline, so the first resumed frame is stable.
{
 const s=scene(), sys=system(s,{white_dwarf:1}); SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,0); const e=enemy('pause-compress',0,0); starContact(sys,e); s.enemies=[e]; tick(sys,0); tick(sys,40); const pausedX=e.scaleX, pausedY=e.scaleY, pausedAt=s.now; s.now+=5000; SKILL_HANDLERS.white_dwarf.shiftTimers(sys,5000,pausedAt); tick(sys,0); close(e.scaleX,pausedX,'compression pause preserves scaleX on resume'); close(e.scaleY,pausedY,'compression pause preserves scaleY on resume'); tick(sys,40); close(e.scaleX,1.35,'compression finishes only after resumed gameplay time'); close(e.scaleY,.25,'compression finishes only after resumed gameplay time');
}
{
 const s=scene(), sys=system(s,{white_dwarf:1}); SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,0); const e=enemy('pause-recover',0,0); starContact(sys,e); s.enemies=[e]; tick(sys,0); tick(sys,220); const pausedX=e.scaleX, pausedY=e.scaleY, pausedAt=s.now; s.now+=5000; SKILL_HANDLERS.white_dwarf.shiftTimers(sys,5000,pausedAt); tick(sys,0); close(e.scaleX,pausedX,'recovery pause preserves scaleX on resume'); close(e.scaleY,pausedY,'recovery pause preserves scaleY on resume'); tick(sys,60); close(e.scaleX,1,'recovery finishes only after resumed gameplay time'); close(e.scaleY,1,'recovery finishes only after resumed gameplay time');
}

// Lethal crush immediately reaches final compressed scale and stays flattened until invalid cleanup.
{
 const s=scene(), sys=system(s,{white_dwarf:1}); SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,0); const dead=enemy('dead',0,0,{hp:20}); starContact(sys,dead); s.enemies=[dead]; tick(sys,0); assert.equal(dead.isDefeated,true); close(dead.scaleX,1.35,'lethal crush immediately sets final scaleX'); close(dead.scaleY,.25,'lethal crush immediately sets final scaleY'); tick(sys,280); close(dead.scaleX,1.35,'lethal crush does not recover during death flow'); close(dead.scaleY,.25,'lethal crush does not recover during death flow'); dead.active=false; tick(sys,1000); assert.equal(s.whiteDwarfRuntime.crushStates.has(dead),false,'destroyed/invalid enemy reference is pruned');
}

// Gravity lines move toward center, fade, honor pause, expire by gameplay time, and clean up immediately when their enemy becomes invalid.
{
 const s=scene(), sys=system(s,{white_dwarf:1}); SKILL_HANDLERS.white_dwarf.bind(sys); tick(sys,0); const e=enemy('lines',0,0); starContact(sys,e); s.enemies=[e]; tick(sys,0); const rt=s.whiteDwarfRuntime; let lines=crushLines(rt); assert.equal(lines.length,6); const upper=lines.find(l=>l.startOffsetY<0), lower=lines.find(l=>l.startOffsetY>0); assert(upper.object.y<e.y,'upper line starts above enemy'); assert(lower.object.y>e.y,'lower line starts below enemy'); const upperStartY=upper.object.y, lowerStartY=lower.object.y, upperStartAlpha=upper.object.alpha;
 tick(sys,110); assert(upper.object.y>upperStartY,'upper line moves down toward center'); assert(lower.object.y<lowerStartY,'lower line moves up toward center'); assert(upper.object.alpha<upperStartAlpha,'line alpha fades');
 const pauseY=upper.object.y, pauseAlpha=upper.object.alpha, pausedAt=s.now; s.now+=5000; SKILL_HANDLERS.white_dwarf.shiftTimers(sys,5000,pausedAt); tick(sys,0); close(upper.object.y,pauseY,'gravity line pause preserves y'); close(upper.object.alpha,pauseAlpha,'gravity line pause preserves alpha');
 tick(sys,110); assert(lines.every(l=>l.object.destroyed),'gravity lines destroy at expiry');
 const e2=enemy('invalid-lines',0,0); tick(sys,1800); starContact(sys,e2); s.enemies=[e2]; tick(sys,0); lines=crushLines(rt); assert(lines.length>0); e2.active=false; tick(sys,0); assert(lines.every(l=>l.object.destroyed),'invalid enemy destroys gravity lines immediately');
}

// Lv6 mass recoil still uses knockback.
{
 const s=scene(), sys=system(s,{white_dwarf:6}); s.enemies=[enemy('burst',310,600)]; SKILL_HANDLERS.white_dwarf.bind(sys); SKILL_HANDLERS.white_dwarf.beforePlayerHpDamage(sys,{directAttack:true,hpDamage:10}); assert(s.knockbacks.some(k=>k.meta.knockback===48),'Lv6 burstKnockback preserved');
}

console.log('validate-01091-white-dwarf-gravity-crush passed');
