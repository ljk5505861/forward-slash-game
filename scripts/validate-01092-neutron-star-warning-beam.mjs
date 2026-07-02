import assert from 'node:assert/strict';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';

assert.equal(GAME_VERSION, '0.10.98');
assert.equal(SKILLS.neutron_star.levels.length, 9);
assert.equal(Object.keys(SKILLS).length, 38);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.singlePulseDamage), [72,80,90,101,113,128,144,162,184]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.sweepDamage), [54,60,68,77,87,99,113,129,148]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.initialPulseDelayMs), [280,280,270,270,260,260,250,250,240]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.pulseGapMs), [460,450,440,430,420,410,400,390,380]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.singlePulseVisualMs), [260,260,250,250,240,240,230,230,220]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.postSecondPulseDelayMs), [300,300,290,290,280,280,270,260,250]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.sweepWarningMs), [380,370,360,350,340,330,320,310,300]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.sweepDurationMs), [700,690,680,670,660,650,640,630,620]);
assert.equal(SKILLS.neutron_star.levels.some(x => 'sweepChargeMs' in x || 'sweepHalfAngleDeg' in x || 'fullViewportSweep' in x), false);

function visual(type) { return { type, destroyed:false, x:0, y:0, alpha:1, rotation:0, scale:1, setDepth(){return this;}, setScrollFactor(){return this;}, setStrokeStyle(){return this;}, setOrigin(){return this;}, setPosition(x,y){this.x=x; this.y=y; return this;}, setAlpha(a){this.alpha=a; return this;}, setRotation(r){this.rotation=r; return this;}, setScale(s){this.scale=s; return this;}, setLineWidth(a,b){this.lineWidth=[a,b]; return this;}, destroy(){this.destroyed=true; return this;} }; }
function events(){ const m=new Map(); return { once(n,cb){m.set(n,cb);}, off(n,cb){ if(m.get(n)===cb)m.delete(n);}, emit(n){m.get(n)?.();}, count(n){return m.has(n)?1:0;} }; }
function enemy(id, screenX, screenY, opts={}) { return { id, x:100+screenX, y:screenY, hp:opts.hp ?? 10000, maxHp:opts.hp ?? 10000, width:opts.width ?? 40, displayWidth:opts.width ?? 40, active: opts.active ?? true, isDefeated: opts.dead ?? false, inside: opts.inside ?? true }; }
function scene() { const created=[]; const s={ now:0, enemies:[], player:{x:300,y:600}, balance:{groundTopY:620}, cameras:{main:{worldView:{x:100,y:0,centerX:460}}}, events:events(), created, hits:[], getGameplayTime(){return this.now;}, targeting:{ all(){return s.enemies.filter(e=>e.active!==false&&!e.isDefeated&&e.hp>0);}, isEnemyFullyInsideViewport(e){return e.inside!==false;} }, add:{ circle(x=0,y=0){const o=visual('circle').setPosition(x,y); created.push(o); return o;}, line(){const o=visual('line'); created.push(o); return o;}, rectangle(x=0,y=0){const o=visual('rectangle').setPosition(x,y); created.push(o); return o;} }, combatSystem:{ damageEnemy(target,damage,meta){ if (!target || target.active===false || target.isDefeated || target.hp<=0 || target.inside===false) return false; target.hp -= Math.round(damage); if (target.hp<=0) target.isDefeated=true; s.hits.push({target, damage:Math.round(damage), meta, time:s.now}); return true;} } }; return s; }
function system(s, level=1){ return { scene:s, passiveUpdaters:[], getLevel(id){return id==='neutron_star'?level:0;} }; }
function tick(sys, ms=0){ sys.scene.now += ms; [...sys.passiveUpdaters].forEach(fn=>fn()); }
function bind(level=1){ const s=scene(); const sys=system(s,level); SKILL_HANDLERS.neutron_star.bind(sys); return {s,sys,data:SKILLS.neutron_star.levels[level-1]}; }
function activeRectangles(s){ return s.created.filter(o => o.type === 'rectangle' && !o.destroyed); }
function close(actual, expected, message, epsilon=1e-9){ assert(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, got ${actual}`); }

// Sequence and no-target retry.
{
  const {s,sys,data}=bind(1);
  tick(sys,data.roundCooldownMs);
  assert.equal(s.hits.length,0,'acquisition only creates body; no first-frame attack');
  assert.equal(s.neutronStarRuntime.phase,'ready');
  tick(sys,data.initialPulseDelayMs);
  assert.equal(s.hits.length,0,'no target keeps completed cooldown ready');
  assert.equal(s.neutronStarRuntime.phase,'ready');
  const high=enemy('high',500,555,{hp:5000}); const near=enemy('near',220,555,{hp:3000});
  s.enemies=[near, high];
  tick(sys,data.pulseTargetRetryMs);
  assert.equal(s.neutronStarRuntime.phase,'pulse1');
  tick(sys,data.initialPulseDelayMs);
  assert.equal(s.hits.at(-1).target.id,'high','first pulse chooses highest hp');
  assert.equal(s.neutronStarRuntime.phase,'pulse2');
  s.enemies=[high];
  tick(sys,data.pulseGapMs);
  assert.equal(s.hits.at(-1).target.id,'high','single valid enemy can be hit twice');
  assert.equal(s.neutronStarRuntime.phase,'postSecondPulse');
  assert.equal(s.neutronStarRuntime.sweepPlan,null,'second pulse visual does not overlap warning');
  assert(s.neutronStarRuntime.pulseFlashUntil > s.now,'flash persists after pulse frame');
  tick(sys,data.singlePulseVisualMs-1);
  assert.equal(s.neutronStarRuntime.sweepPlan,null);
  tick(sys,1+data.postSecondPulseDelayMs);
  assert.equal(s.neutronStarRuntime.phase,'warning');
  assert(s.neutronStarRuntime.sweepPlan,'warning appears after post-pulse pause');
  assert(s.neutronStarRuntime.sweepPlan.warningStart && !s.neutronStarRuntime.sweepPlan.warningStart.destroyed, 'warningStart exists during warning');
  assert.equal('warningEnd' in s.neutronStarRuntime.sweepPlan, false, 'sweepPlan does not retain a warningEnd field');
  close(s.neutronStarRuntime.sweepPlan.warningStart.rotation, s.neutronStarRuntime.sweepPlan.startAngle, 'warning beam points to sweep start');
  assert(Math.abs(s.neutronStarRuntime.sweepPlan.warningStart.rotation - s.neutronStarRuntime.sweepPlan.endAngle) > 0.001, 'warning beam is not endpoint direction');
  tick(sys,data.sweepWarningMs);
  assert.equal(s.neutronStarRuntime.phase,'sweep');
  assert(s.hits.length >= 2,'two successful single pulses happened before sweep');
}

// Second pulse target preference, Lv3 same-target bonus, invalid/offscreen rejection.
{
  const {s,sys,data}=bind(3);
  const a=enemy('a',500,555,{hp:5000}); const b=enemy('b',450,555,{hp:4900}); const off=enemy('off',650,555,{hp:9999,inside:false});
  s.enemies=[a,b,off]; tick(sys,data.roundCooldownMs); tick(sys,data.initialPulseDelayMs);
  assert.equal(s.hits.at(-1).target.id,'a');
  tick(sys,data.pulseGapMs);
  assert.equal(s.hits.at(-1).target.id,'b','second pulse prefers a different legal enemy');
  assert(!s.hits.some(h=>h.target.id==='off'));
}
{
  const {s,sys,data}=bind(3); const only=enemy('only',500,555,{hp:10000});
  s.enemies=[only]; tick(sys,data.roundCooldownMs); tick(sys,data.initialPulseDelayMs); tick(sys,data.pulseGapMs);
  assert.equal(s.hits[1].damage, Math.round(data.singlePulseDamage * 1.45));
}

// Warning beam lifecycle: one start warning, one moving sweep, no endpoint residue.
{
  const {s,sys,data}=bind(1);
  s.enemies=[enemy('a',500,555,{hp:5000}), enemy('b',450,555,{hp:4900})];
  tick(sys,data.roundCooldownMs);
  tick(sys,data.initialPulseDelayMs);
  tick(sys,data.pulseGapMs);
  assert.equal(s.neutronStarRuntime.sweepPlan,null,'second pulse success does not immediately create warning');
  tick(sys,data.singlePulseVisualMs - 1);
  assert.equal(s.neutronStarRuntime.sweepPlan,null,'second pulse visual ending has not created warning');
  const beforeWarningRects = activeRectangles(s).length;
  tick(sys,1 + data.postSecondPulseDelayMs);
  const plan = s.neutronStarRuntime.sweepPlan;
  assert(plan,'warning plan exists');
  assert(plan.warningStart && !plan.warningStart.destroyed,'warningStart is active');
  assert.equal('warningEnd' in plan, false, 'warningEnd field is removed, not merely undefined');
  assert.equal(activeRectangles(s).length - beforeWarningRects, 1, 'warning stage creates exactly one rectangle beam');
  close(plan.warningStart.rotation, plan.startAngle, 'only warning beam uses start angle');
  assert(Math.abs(plan.warningStart.rotation - plan.endAngle) > 0.001, 'only warning beam is not locked to end angle');
  const pausedAt=s.now;
  s.now += 500;
  SKILL_HANDLERS.neutron_star.shiftTimers(sys,500,pausedAt);
  tick(sys,0);
  assert(!plan.warningStart.destroyed,'pause does not destroy warningStart early');
  assert.equal(activeRectangles(s).length, beforeWarningRects + 1, 'pause does not create a second warning beam');
  tick(sys,data.sweepWarningMs - 1);
  assert(s.neutronStarRuntime.sweepPlan,'shifted warning time has not been skipped');
  tick(sys,1);
  assert.equal(plan.warningStart.destroyed,true,'warningStart is destroyed when sweep starts');
  assert.equal(s.neutronStarRuntime.sweepPlan,null,'sweepPlan cleared at formal sweep start');
  const sweep=s.neutronStarRuntime.sweep;
  assert(sweep?.beam && !sweep.beam.destroyed,'formal sweep beam exists');
  assert.equal(activeRectangles(s).length - beforeWarningRects, 1, 'formal sweep has exactly one active rectangle beam');
  close(sweep.beam.rotation, sweep.startAngle, 'formal sweep first frame starts at startAngle');
  tick(sys,Math.floor(data.sweepDurationMs/2));
  assert(sweep.beam.rotation > sweep.startAngle && sweep.beam.rotation < sweep.endAngle, 'mid-sweep angle is between start and end');
  assert.equal(activeRectangles(s).filter(o => Math.abs(o.rotation - sweep.endAngle) < 1e-9).length, 0, 'no fixed endpoint beam exists mid-sweep');
  tick(sys,data.sweepDurationMs);
  close(sweep.lastAngle, sweep.endAngle, 'completed sweep reaches endAngle', 0.001);
  assert.equal(sweep.beam.destroyed,true,'formal sweep beam destroyed after completion');
  assert.equal(s.neutronStarRuntime.sweep,null,'runtime sweep cleared after completion');
  assert.equal(activeRectangles(s).length, beforeWarningRects, 'no warning or formal sweep rectangles remain');
  SKILL_HANDLERS.neutron_star.destroyRuntime(sys);
  assert(s.created.every(o=>o.destroyed),'scene cleanup destroys all neutron visuals');
  SKILL_HANDLERS.neutron_star.bind(sys); tick(sys,0);
  assert.equal(s.neutronStarRuntime.sweepPlan,null,'reacquire starts fresh without old warning object');
}

// Sweep path, hit area, low FPS crossing, Lv6/Lv9 bonuses.
{
  const {s,sys,data}=bind(6);
  const right=enemy('right',710,555); const mid=enemy('mid',500,555); const front=enemy('front',320,555); const back=enemy('back',210,555); const out=enemy('out',760,555,{inside:false});
  s.enemies=[right,mid,front,back,out]; tick(sys,data.roundCooldownMs); tick(sys,data.initialPulseDelayMs); tick(sys,data.pulseGapMs); tick(sys,data.singlePulseVisualMs+data.postSecondPulseDelayMs); tick(sys,data.sweepWarningMs);
  const sweep=s.neutronStarRuntime.sweep;
  assert(Math.abs(sweep.startAngle - sweep.beam.rotation) < 1e-9,'first sweep frame points to right edge');
  const before=s.hits.length;
  tick(sys,data.sweepDurationMs);
  const hits=s.hits.slice(before);
  assert.deepEqual(new Set(hits.map(h=>h.target.id)), new Set(['right','mid','front']));
  assert.equal(hits.length,3,'each enemy is hit at most once and no full-screen catch-up damage occurs');
  assert(!hits.some(h=>h.target.id==='back'||h.target.id==='out'));
  assert(hits.some(h=>h.damage === Math.round(data.sweepDamage * 1.3)),'Lv6 applies marked sweep bonus to real pulse hit');
  const finalAngle=s.neutronStarRuntime.sweep?.lastAngle ?? sweep.endAngle;
  assert(Math.abs(finalAngle - sweep.endAngle) < 0.001,'last sweep frame reaches player-front endpoint');
}
{
  const {s,sys,data}=bind(9); s.enemies=[enemy('right',710,555),enemy('mid',500,555),enemy('front',320,555),enemy('back',210,555)];
  tick(sys,data.roundCooldownMs); tick(sys,data.initialPulseDelayMs); tick(sys,data.pulseGapMs); tick(sys,data.singlePulseVisualMs+data.postSecondPulseDelayMs); tick(sys,data.sweepWarningMs);
  const before=s.hits.length; tick(sys,data.sweepDurationMs); const hits=s.hits.slice(before);
  assert.deepEqual(new Set(hits.map(h=>h.target.id)), new Set(['right','mid','front']));
  assert(hits.every(h=>h.meta.defenseIgnore === .35),'Lv9 sweep keeps 35% defense ignore');
}

// Pause shifting and cleanup/reacquire.
{
  const {s,sys,data}=bind(1); s.enemies=[enemy('p',500,555)]; tick(sys,data.roundCooldownMs);
  const before=s.neutronStarRuntime.nextAt; SKILL_HANDLERS.neutron_star.shiftTimers(sys,1000,s.now); assert.equal(s.neutronStarRuntime.nextAt,before+1000);
  tick(sys,data.initialPulseDelayMs+1000); const expires=s.neutronStarRuntime.transients[0].expiresAt; SKILL_HANDLERS.neutron_star.shiftTimers(sys,1000,s.now); assert.equal(s.neutronStarRuntime.transients[0].expiresAt,expires+1000);
  SKILL_HANDLERS.neutron_star.destroyRuntime(sys); assert.equal(s.neutronStarRuntime,null); assert(s.created.every(o=>o.destroyed),'replacement/cleanup destroys body, ring, pulse visuals, warning, and sweep objects');
  SKILL_HANDLERS.neutron_star.bind(sys); tick(sys,0); assert.equal(s.neutronStarRuntime.phase,'cooldown'); assert.equal(s.neutronStarRuntime.pulseHits.size,0); assert.equal(s.neutronStarRuntime.sweep,null);
}

console.log('v0.10.98 neutron star warning beam validation passed');
