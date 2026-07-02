import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS, BUILD_TAGS } from '../src/config/tags.js';
import { GAME_VERSION } from '../src/config/version.js';
import pkg from '../package.json' with { type:'json' };
import { NINEFOLD_DAO_ID, CULTIVATION_BASE_RATES, CULTIVATION_REALMS, CULTIVATION_THRESHOLDS, getCultivationSnapshot, getCultivationSpellModifiers, grantCultivation } from '../src/skills/handlers/CultivationCoreSkill.js';

function scene(){ let t=0; const s={ playerData:{skills:[],hp:100,maxHp:100,mana:20,maxMana:20,damageReductionBonuses:{},level:1}, getGameplayTime:()=>t, isGameplayPaused:()=>false, hud:{update(){}}, skillBar:{update(){}}, add:null, tweens:null }; const sys={scene:s,passiveState:{},passiveUpdaters:[],getLevel(id){return s.playerData.skills.find(x=>x.id===id)?.level||0},recoverMana(a){const p=s.playerData; const b=p.mana; p.mana=Math.min(p.maxMana,p.mana+a); return p.mana-b;}}; s.skillSystem=sys; return {s,sys,advance(ms){t+=ms; sys.passiveUpdaters.forEach(f=>f());}}; }
const { SKILL_HANDLERS } = await import('../src/skills/handlers/index.js');
function add(sys, level=1){ sys.scene.playerData.skills=[{id:NINEFOLD_DAO_ID,level}]; SKILL_HANDLERS[NINEFOLD_DAO_ID].bind(sys); }

assert.equal(GAME_VERSION,'0.11.1'); assert.equal(pkg.version,'0.11.1');
const cfg=SKILLS[NINEFOLD_DAO_ID]; assert(cfg); assert.equal(cfg.rarity,'MYTHIC'); assert.equal(cfg.passive,true); assert.equal(cfg.maxLevel,9); assert.equal(cfg.requiredSkillId,undefined); assert(cfg.tags.includes(TAGS.CULTIVATION)); assert(cfg.tags.includes(TAGS.BUILD_CULTIVATION)); assert(BUILD_TAGS.includes(TAGS.BUILD_CULTIVATION)); assert.equal(Object.values(SKILLS).filter(s=>s?.id&&!s.hidden).length,39);
['alchemy','great_handprint','soul_destroying_needle','three_pure_ones','mantra_heaven_book'].forEach(id=>assert(!SKILLS[id]));
for(let i=1;i<=9;i++){ const c=scene(); add(c.sys,i); c.advance(1000); assert(Math.abs(getCultivationSnapshot(c.s).progress-CULTIVATION_BASE_RATES[i-1]*(i>=6?1.25:1))<.001); }
let c=scene(); assert.equal(getCultivationSnapshot(c.s).active,false); assert.deepEqual(getCultivationSpellModifiers(c.s),{damageMultiplier:1,rangeMultiplier:1,cooldownMultiplier:1,manaCostMultiplier:1}); add(c.sys,1); let snap=getCultivationSnapshot(c.s); assert.equal(snap.realm,'炼气'); assert.equal(snap.progress,0); assert.equal(c.s.playerData.maxHp,105); assert.equal(c.s.playerData.maxMana,40);
c=scene(); add(c.sys,3); c.advance(29000); assert(getCultivationSnapshot(c.s).progress<47); c.advance(1000); assert.equal(Math.floor(getCultivationSnapshot(c.s).progress),64); c.advance(60000); assert.equal(getCultivationSnapshot(c.s).realm,'筑基');
c=scene(); add(c.sys,6); let r=grantCultivation(c.s,100); assert.equal(r.actualAmount,125); assert.equal(getCultivationSnapshot(c.s).realm,'筑基');
c=scene(); add(c.sys,9); assert.equal(getCultivationSnapshot(c.s).autoRate,5.5*1.25); grantCultivation(c.s,100); assert.equal(getCultivationSnapshot(c.s).autoRate,5.5*1.25*1.2); grantCultivation(c.s,500); assert.equal(getCultivationSnapshot(c.s).autoRate,5.5*1.25*1.4); grantCultivation(c.s,1e10); assert.equal(getCultivationSnapshot(c.s).realm,'渡劫'); assert.equal(getCultivationSnapshot(c.s).autoRate,5.5*1.25*2.6);
c=scene(); add(c.sys,1); grantCultivation(c.s,101); assert.equal(getCultivationSnapshot(c.s).realm,'筑基'); assert.equal(Math.floor(getCultivationSnapshot(c.s).progress),1); assert.equal(c.s.playerData.level,1); SKILL_HANDLERS[NINEFOLD_DAO_ID].cleanup(c.sys); assert.equal(c.s.playerData.maxHp,100); assert.equal(c.s.playerData.maxMana,20); assert.equal(c.s.playerData.damageReductionBonuses[NINEFOLD_DAO_ID],undefined); assert.equal(getCultivationSnapshot(c.s).active,false); add(c.sys,1); assert.equal(getCultivationSnapshot(c.s).realm,'炼气');
assert.deepEqual(CULTIVATION_REALMS,['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫']); assert.deepEqual(CULTIVATION_THRESHOLDS,[100,500,2500,15000,100000,1000000,20000000,500000000]);
console.log('v0.11.1 ninefold dao validation passed');
