import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_VERSION } from '../src/config/version.js';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { SpiritWolvesSkill, inheritRatioForLevel, basePlayerStats } from '../src/skills/handlers/SpiritWolvesSkill.js';

function node(x=0,y=0){ return {x,y,active:true,setStrokeStyle(){return this},setDepth(){return this},setOrigin(){return this},setScale(x){this.scale=x;return this},setPosition(x,y){this.x=x;this.y=y;return this},destroy(){this.active=false}}; }
function scene(){ let now=0; const calls={damage:[],crits:0,lifeSteal:0,attack:0,artifact:0}; const enemies=[]; const bus={handlers:{},emit(n,p){ (this.handlers[n]||[]).forEach(fn=>fn(p)); if(n==='PLAYER_CRIT')calls.crits++; if(n==='PLAYER_HIT'||n==='PLAYER_ATTACK')calls.attack++;},on(n,fn){(this.handlers[n]??=[]).push(fn); return()=>this.handlers[n]=this.handlers[n].filter(x=>x!==fn);}}; return { calls,enemies,eventBus:bus,player:{x:100,y:100},playerData:{hp:100,maxHp:999,baseAttack:100,baseMaxHp:500,baseDefense:20,attack:999,maxHp:999,defense:99,skills:[{id:'spirit_wolves',level:1}],critChance:1,lifeSteal:1,skillDamageMultiplier:99,cooldownReduction:0},getGameplayTime:()=>now,setTime:t=>now=t,add:{circle:(x,y)=>node(x,y),rectangle:(x,y)=>node(x,y)},tweens:{add(){}},floatText(){},targeting:{valid:e=>e&&e.hp>0&&!e.isDefeated,all:()=>enemies,isEnemyFullyInsideViewport:()=>true},combatSystem:{damageEnemy(e,amount,meta){ calls.damage.push({e,amount,meta}); e.hp=Math.max(0,e.hp-amount); return amount>0; }}}; }
function system(s=scene()){ return {scene:s,cooldowns:new Map(),passiveState:{},passiveUpdaters:[],getLevel:id=>s.playerData.skills.find(x=>x.id===id)?.level||0,getData:(id,l)=>SKILLS[id].levels[(l??1)-1]}; }
function bindAt(level=1){ const s=scene(); s.playerData.skills[0].level=level; const sys=system(s); const off=SpiritWolvesSkill.bind(sys); return {s,sys,off,state:()=>sys.passiveState.spiritWolves}; }

assert.equal(GAME_VERSION,'0.10.71');
assert.equal(Object.keys(SKILLS).length,24);
assert.ok(SKILLS.spirit_wolves);
assert.equal(SKILLS.spirit_wolves.requiredSkillId,undefined);
assert.equal(SKILLS.spirit_wolves.rarity,'EPIC');
assert.equal(SKILLS.spirit_wolves.levels.length,9);
assert.equal(fs.existsSync('src/player_idle.png'),true);
assert.ok(!fs.readFileSync('src/entities/createPlayer.js','utf8').includes('spirit_wolves'),'player image hookup is untouched by spirit wolf skill');
assert.deepEqual(basePlayerStats({baseAttack:100,baseMaxHp:500,baseDefense:20,attack:999,maxHp:999,defense:99}),{attack:100,maxHp:500,defense:20});

{
  const {s,sys,state}=bindAt(1); const cfg=SKILLS.spirit_wolves,data=cfg.levels[0];
  assert.deepEqual(SpiritWolvesSkill.canCast(sys,cfg,data,1),{failed:true});
  assert.equal(sys.cooldowns.get('spirit_wolves'),8000);
  s.setTime(8000); SpiritWolvesSkill.cast(sys,cfg,data,1);
  assert.equal(state().wolves.length,2);
  for(const w of state().wolves){ assert.equal(w.attack,20); assert.equal(w.maxHp,100); assert.equal(w.defense,4); }
  assert.deepEqual(SpiritWolvesSkill.cast(sys,cfg,data,1),{failed:true},'no duplicate summons while wolves live');
  state().wolves[0].takeDamage(999,{enemy:{x:0,isElite:false},attackType:'melee'});
  assert.equal(state().wolves.length,1); assert.equal(sys.cooldowns.has('spirit_wolves'),true,'one wolf death does not start a new cooldown');
  sys.cooldowns.delete('spirit_wolves'); state().wolves[0].takeDamage(999,{enemy:{x:0,isElite:false},attackType:'melee'});
  assert.equal(state().wolves.length,0); assert.equal(sys.cooldowns.get('spirit_wolves'),16000); assert.equal(state().cooldownStarts,1);
  s.setTime(16000); SpiritWolvesSkill.cast(sys,cfg,data,1); assert.equal(state().wolves.length,2);
}

{
  const {s,sys,state}=bindAt(3); const cfg=SKILLS.spirit_wolves; SpiritWolvesSkill.canCast(sys,cfg,cfg.levels[2],3); s.setTime(8000); SpiritWolvesSkill.cast(sys,cfg,cfg.levels[2],3); s.enemies.push({x:190,y:100,hp:100},{x:220,y:100,hp:100},{x:190,y:100,hp:100}); state().wolves[0].x=150; state().wolves[0].y=100; state().wolves[0].nextAttackAt=0; sys.passiveUpdaters[0](); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonMelee')); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonSplash')); assert.equal(s.calls.damage.filter(d=>d.e===s.enemies[0]).length,1,'primary target is not splashed again');
}
{
  const {s,sys,state}=bindAt(2); const cfg=SKILLS.spirit_wolves; SpiritWolvesSkill.canCast(sys,cfg,cfg.levels[1],2); s.setTime(8000); SpiritWolvesSkill.cast(sys,cfg,cfg.levels[1],2); s.enemies.push({x:100,y:100,hp:100}); state().wolves[0].takeDamage(999,{enemy:{x:0},attackType:'melee'}); assert.equal(s.calls.damage.some(d=>d.meta.damageKind==='summonDeathBurst'),false);
}
{
  const {s,sys,state}=bindAt(6); const cfg=SKILLS.spirit_wolves; SpiritWolvesSkill.canCast(sys,cfg,cfg.levels[5],6); s.setTime(8000); SpiritWolvesSkill.cast(sys,cfg,cfg.levels[5],6); s.enemies.push({x:100,y:100,hp:100}); state().wolves[0].takeDamage(999,{enemy:{x:0},attackType:'melee'}); assert.ok(s.calls.damage.some(d=>d.meta.damageKind==='summonDeathBurst')); const damageCount=s.calls.damage.length; SpiritWolvesSkill.cleanup(sys); assert.equal(s.calls.damage.length,damageCount,'cleanup does not explode'); assert.equal(state().wolves.length,0);
}
{
  const {s,sys,state}=bindAt(9); const cfg=SKILLS.spirit_wolves; SpiritWolvesSkill.canCast(sys,cfg,cfg.levels[8],9); s.setTime(8000); SpiritWolvesSkill.cast(sys,cfg,cfg.levels[8],9); const w=state().wolves[0]; assert.equal(w.attack,30); assert.equal(w.maxHp,150); assert.equal(w.defense,6); assert.equal(w.view.scale,1.15);
}
{
  const {s,sys,state}=bindAt(1); const cfg=SKILLS.spirit_wolves; SpiritWolvesSkill.canCast(sys,cfg,cfg.levels[0],1); s.setTime(8000); SpiritWolvesSkill.cast(sys,cfg,cfg.levels[0],1); const w=state().wolves[0]; w.takeDamage(5,{enemy:{x:w.x-10,isElite:true},attackType:'melee'}); assert.ok(w.knockbackUntil>0); s.setTime(w.knockbackUntil+1); s.enemies.push({x:w.x+30,y:w.y,hp:100}); sys.passiveUpdaters[0](); assert.ok(w.target,'wolf resumes targeting after knockback'); assert.equal(s.calls.crits,0); assert.equal(s.calls.lifeSteal,0); assert.equal(s.calls.attack,0); assert.ok(s.calls.damage.every(d=>d.meta.allowLifeSteal===false&&d.meta.crit===false&&d.meta.canTriggerArtifacts===false));
  const old=state().wolves; s.playerData.skills[0].level=9; SpiritWolvesSkill.canCast(sys,cfg,cfg.levels[8],9); assert.deepEqual(state().wolves,old,'upgrade does not refresh live wolves'); assert.equal(state().wolves.length,2);
  SpiritWolvesSkill.cleanup(sys); assert.equal(state().wolves.length,0); assert.equal(sys.cooldowns.has('spirit_wolves'),false);
}
assert.equal(inheritRatioForLevel(1),.20); assert.equal(inheritRatioForLevel(9),.30);
console.log('v0.10.71 spirit wolves validation passed.');
