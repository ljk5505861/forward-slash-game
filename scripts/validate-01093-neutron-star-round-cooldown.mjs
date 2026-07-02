import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SKILL_HANDLERS } from '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { GAME_VERSION } from '../src/config/version.js';
import { getSkillBarStateText } from '../src/ui/skillBarState.js';

assert.equal(GAME_VERSION, '0.10.96');
assert.equal(JSON.parse(fs.readFileSync('package.json','utf8')).version, '0.10.96');
assert.equal(SKILLS.neutron_star.levels.length, 9);
assert.equal(Object.keys(SKILLS).length, 35);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.roundCooldownMs), [7200,7000,6800,6600,6400,6100,5900,5700,5400]);
assert.equal(SKILLS.neutron_star.levels.some(x => 'cycleIntervalMs' in x), false);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.singlePulseDamage), [72,80,90,101,113,128,144,162,184]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.sweepDamage), [54,60,68,77,87,99,113,129,148]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.initialPulseDelayMs), [280,280,270,270,260,260,250,250,240]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.pulseTargetRetryMs), [120,120,120,120,120,120,120,120,120]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.pulseGapMs), [460,450,440,430,420,410,400,390,380]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.singlePulseVisualMs), [260,260,250,250,240,240,230,230,220]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.postSecondPulseDelayMs), [300,300,290,290,280,280,270,260,250]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.sweepWarningMs), [380,370,360,350,340,330,320,310,300]);
assert.deepEqual(SKILLS.neutron_star.levels.map(x => x.sweepDurationMs), [700,690,680,670,660,650,640,630,620]);
assert.match(fs.readFileSync('src/ui/skillBarState.js','utf8'), /neutron_star:\s*'neutronStarRuntime'/);

function visual(type) { return { type, destroyed:false, x:0, y:0, alpha:1, rotation:0, scale:1, setDepth(){return this;}, setScrollFactor(){return this;}, setStrokeStyle(){return this;}, setOrigin(){return this;}, setPosition(x,y){this.x=x; this.y=y; return this;}, setAlpha(a){this.alpha=a; return this;}, setRotation(r){this.rotation=r; return this;}, setScale(s){this.scale=s; return this;}, setLineWidth(a,b){this.lineWidth=[a,b]; return this;}, destroy(){this.destroyed=true; return this;} }; }
function events(){ const m=new Map(); return { once(n,cb){m.set(n,cb);}, off(n,cb){ if(m.get(n)===cb)m.delete(n);}, emit(n){m.get(n)?.();} }; }
function enemy(id, screenX, screenY, opts={}) { return { id, x:100+screenX, y:screenY, hp:opts.hp ?? 10000, maxHp:opts.hp ?? 10000, width:opts.width ?? 40, displayWidth:opts.width ?? 40, active: opts.active ?? true, isDefeated: opts.dead ?? false, inside: opts.inside ?? true }; }
function scene() { const created=[]; const s={ now:1000, enemies:[], player:{x:300,y:600}, balance:{groundTopY:620}, cameras:{main:{worldView:{x:100,y:0,centerX:460}}}, events:events(), created, hits:[], skillSystem:{cooldowns:new Map()}, getGameplayTime(){return this.now;}, targeting:{ all(){return s.enemies.filter(e=>e.active!==false&&!e.isDefeated&&e.hp>0);}, isEnemyFullyInsideViewport(e){return e.inside!==false;} }, add:{ circle(x=0,y=0){const o=visual('circle').setPosition(x,y); created.push(o); return o;}, line(){const o=visual('line'); created.push(o); return o;}, rectangle(x=0,y=0){const o=visual('rectangle').setPosition(x,y); created.push(o); return o;} }, combatSystem:{ damageEnemy(target,damage,meta){ if (!target || target.active===false || target.isDefeated || target.hp<=0 || target.inside===false) return false; target.hp -= Math.round(damage); if (target.hp<=0) target.isDefeated=true; s.hits.push({target, damage:Math.round(damage), meta, time:s.now}); return true;} } }; return s; }
function system(s, getLevel=()=>1){ return { scene:s, passiveUpdaters:[], getLevel(id){return id==='neutron_star'?getLevel():0;} }; }
function tick(sys, ms=0){ sys.scene.now += ms; [...sys.passiveUpdaters].forEach(fn=>fn()); }
function bind(level=1){ const s=scene(); const sys=system(s,()=>level); SKILL_HANDLERS.neutron_star.bind(sys); return {s,sys,data:SKILLS.neutron_star.levels[level-1]}; }
function rects(s){ return s.created.filter(o=>o.type==='rectangle'&&!o.destroyed); }
function bar(s){ return getSkillBarStateText(s, { id:'neutron_star', level:1 }, { maxLevel:9 }); }

// First acquisition waits a full cooldown, then an initial windup.
{
  const {s,sys,data}=bind(1); s.enemies=[enemy('a',500,555,{hp:5000}), enemy('b',450,555,{hp:4900})]; tick(sys,0);
  assert.equal(s.neutronStarRuntime.phase, 'cooldown');
  assert.equal(s.neutronStarRuntime.nextAt, 1000 + data.roundCooldownMs);
  assert.equal(s.hits.length, 0);
  tick(sys, data.initialPulseDelayMs); assert.equal(s.hits.length, 0, 'old immediate 280ms attack is gone');
  tick(sys, data.roundCooldownMs - data.initialPulseDelayMs - 1); assert.equal(s.hits.length, 0);
  assert.match(bar(s), /^冷却 1s$/);
  tick(sys, 1); assert.equal(s.neutronStarRuntime.phase, 'pulse1'); assert.equal(s.hits.length, 0); assert.equal(bar(s), '脉冲释放');
  tick(sys, data.initialPulseDelayMs); assert.equal(s.hits.length, 1); assert.equal(s.neutronStarRuntime.phase, 'pulse2');
}

// Complete round, next cooldown starts at actual sweep end; marks do not leak.
{
  const {s,sys,data}=bind(6); s.enemies=[enemy('a',500,555,{hp:5000}), enemy('b',450,555,{hp:4900})]; tick(sys,0);
  tick(sys,data.roundCooldownMs); tick(sys,data.initialPulseDelayMs); assert.equal(s.hits.length,1);
  tick(sys,data.pulseGapMs); assert.equal(s.hits.length,2); assert.equal(s.neutronStarRuntime.phase,'postSecondPulse'); assert.equal(s.neutronStarRuntime.sweepPlan,null);
  tick(sys,data.singlePulseVisualMs - 1); assert.equal(s.neutronStarRuntime.sweepPlan,null);
  tick(sys,1 + data.postSecondPulseDelayMs); assert.equal(s.neutronStarRuntime.phase,'warning'); assert.equal(rects(s).length,1); assert.equal(bar(s),'横扫释放');
  const plan=s.neutronStarRuntime.sweepPlan; assert.equal('warningEnd' in plan, false); assert(plan.startTargetScreen.x > 720); assert(plan.endTargetScreen.x < plan.startTargetScreen.x);
  tick(sys,data.sweepWarningMs); assert.equal(s.neutronStarRuntime.phase,'sweep'); const sweep=s.neutronStarRuntime.sweep;
  tick(sys,data.sweepDurationMs); assert.equal(s.neutronStarRuntime.phase,'cooldown'); assert.equal(s.neutronStarRuntime.nextAt, s.now + data.roundCooldownMs); assert.equal(s.neutronStarRuntime.pulseHits.size,0); assert.equal(s.neutronStarRuntime.sweep,null);
  tick(sys,data.roundCooldownMs - 1); assert.equal(s.neutronStarRuntime.phase,'cooldown');
  assert(sweep.hit.size <= 2, 'each visible enemy is hit at most once by the sweep');
}

// Ready state preserves completed cooldown until targets appear.
{
  const {s,sys,data}=bind(1); tick(sys,0); tick(sys,data.roundCooldownMs); assert.equal(s.neutronStarRuntime.phase,'ready'); assert.equal(bar(s),'脉冲就绪'); const next=s.neutronStarRuntime.nextAt;
  tick(sys,data.roundCooldownMs * 3); assert.equal(s.neutronStarRuntime.phase,'ready'); assert(s.neutronStarRuntime.nextAt > next, 'only retry timer moves while ready'); assert.equal(s.hits.length,0); assert.equal(rects(s).length,0);
  s.enemies=[enemy('late',500,555)]; tick(sys,data.pulseTargetRetryMs); assert.equal(s.neutronStarRuntime.phase,'pulse1'); tick(sys,data.initialPulseDelayMs); assert.equal(s.hits.length,1);
}

// Second pulse no-target retry does not replay pulse1 and finishes when a replacement appears.
{
  const {s,sys,data}=bind(1); const first=enemy('first',500,555); s.enemies=[first]; tick(sys,0); tick(sys,data.roundCooldownMs); tick(sys,data.initialPulseDelayMs); assert.equal(s.hits.length,1);
  first.active=false; tick(sys,data.pulseGapMs); assert.equal(s.neutronStarRuntime.phase,'pulse2'); assert.equal(s.hits.length,1);
  tick(sys,data.pulseTargetRetryMs); assert.equal(s.hits.length,1);
  s.enemies=[enemy('new',450,555)]; tick(sys,data.pulseTargetRetryMs); assert.equal(s.hits.length,2); assert.equal(s.neutronStarRuntime.phase,'postSecondPulse');
}

// Skill bar phases and pause timer shift.
{
  const {s,sys,data}=bind(1); tick(sys,0); assert.equal(bar(s),'冷却 8s'); const before=bar(s); const next=s.neutronStarRuntime.nextAt; s.now += 1000; SKILL_HANDLERS.neutron_star.shiftTimers(sys,1000,s.now-1000); tick(sys,0); assert.equal(s.neutronStarRuntime.nextAt,next+1000); assert.equal(bar(s),before);
  s.neutronStarRuntime.phase='ready'; assert.equal(bar(s),'脉冲就绪'); s.neutronStarRuntime.phase='pulse1'; assert.equal(bar(s),'脉冲释放'); s.neutronStarRuntime.phase='pulse2'; assert.equal(bar(s),'脉冲释放'); s.neutronStarRuntime.phase='postSecondPulse'; assert.equal(bar(s),'脉冲释放'); s.neutronStarRuntime.phase='warning'; assert.equal(bar(s),'横扫释放'); s.neutronStarRuntime.phase='sweep'; assert.equal(bar(s),'横扫释放');
  SKILL_HANDLERS.neutron_star.destroyRuntime(sys); assert.equal(s.neutronStarRuntime,null); assert.equal(bar(s),'就绪');
}

// Lv3/Lv6/Lv9 regressions and reacquire cleanup.
{
  const {s,sys,data}=bind(3); const only=enemy('only',500,555,{hp:10000}); s.enemies=[only]; tick(sys,0); tick(sys,data.roundCooldownMs); tick(sys,data.initialPulseDelayMs); tick(sys,data.pulseGapMs); assert.equal(s.hits[1].damage, Math.round(data.singlePulseDamage * 1.45));
}
{
  const {s,sys,data}=bind(9); s.enemies=[enemy('a',500,555,{hp:10000}), enemy('b',450,555,{hp:10000})]; tick(sys,0); tick(sys,data.roundCooldownMs); tick(sys,data.initialPulseDelayMs); tick(sys,data.pulseGapMs); tick(sys,data.singlePulseVisualMs + data.postSecondPulseDelayMs); tick(sys,data.sweepWarningMs); tick(sys,data.sweepDurationMs);
  const sweepHits=s.hits.filter(h=>h.meta.defenseIgnore===0.35); assert(sweepHits.length > 0); assert(sweepHits.some(h=>h.damage===Math.round(data.sweepDamage * 1.3)), 'Lv6+ pulse mark sweep bonus remains');
  SKILL_HANDLERS.neutron_star.destroyRuntime(sys); assert(s.created.every(o=>o.destroyed)); SKILL_HANDLERS.neutron_star.bind(sys); tick(sys,0); assert.equal(s.neutronStarRuntime.phase,'cooldown'); assert.equal(s.neutronStarRuntime.pulseHits.size,0);
}

console.log('v0.10.96 neutron star round cooldown validation passed');
