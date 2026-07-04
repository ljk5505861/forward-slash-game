import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import { SKILLS } from '../src/config/skills.js';
import { TAGS, BUILD_TAGS } from '../src/config/tags.js';
import { GAME_VERSION } from '../src/config/version.js';
import pkg from '../package.json' with { type:'json' };
import SkillSystem from '../src/systems/SkillSystem.js';
import Hud from '../src/ui/Hud.js';
import { getSkillBarStateText } from '../src/ui/skillBarState.js';
import { getSkillDetailData } from '../src/ui/skillDetailContent.js';
import { getRarity } from '../src/config/rarities.js';
import { NINEFOLD_DAO_ID, CULTIVATION_BASE_RATES, CULTIVATION_REALMS, CULTIVATION_THRESHOLDS, getCultivationSnapshot, getCultivationSpellModifiers, grantCultivation } from '../src/skills/handlers/CultivationCoreSkill.js';

const { SKILL_HANDLERS } = await import('../src/skills/handlers/index.js');
const totalCapacity = () => CULTIVATION_THRESHOLDS.reduce((sum, value) => sum + value, 0);
const advanceFrames = (context, totalMs, frames=40) => { const step=totalMs/frames; for(let i=0;i<frames;i+=1) context.advance(step); };

function visualNode(kind, payload, log) {
  return {
    kind,
    ...payload,
    destroyed:false,
    setOrigin(){ return this; }, setDepth(){ return this; }, setStrokeStyle(){ return this; }, setScrollFactor(){ return this; }, setVisible(value){ this.visible=value; return this; },
    setDisplaySize(w,h){ this.displayWidth=w; this.displayHeight=h; return this; },
    setText(value){ this.text=value; return this; },
    destroy(){ this.destroyed=true; log.destroyed.push(this); }
  };
}
function createVisualHarness(){
  const log={texts:[],circles:[],rectangles:[],destroyed:[],timers:[],tweens:[]};
  return { log,
    add:{
      text(x,y,text,style){ const node=visualNode('text',{x,y,text,style},log); log.texts.push(node); return node; },
      circle(x,y,radius,color,alpha){ const node=visualNode('circle',{x,y,radius,color,alpha},log); log.circles.push(node); return node; },
      rectangle(x,y,width,height,color,alpha){ const node=visualNode('rectangle',{x,y,width,height,color,alpha},log); log.rectangles.push(node); return node; }
    },
    time:{ delayedCall(delay, callback){ const timer={delay, callback, removed:false, remove(){ this.removed=true; }, fire(){ if(!this.removed) callback(); }}; log.timers.push(timer); return timer; } },
    tweens:{ add(config){ const tween={config, stopped:false, removed:false, stop(){ this.stopped=true; }, remove(){ this.removed=true; }, complete(){ config.onComplete?.(); }}; log.tweens.push(tween); return tween; } }
  };
}
function scene({visual=false, paused=false}={}){
  let t=0; const harness=visual?createVisualHarness():{log:{texts:[],circles:[],rectangles:[],destroyed:[],timers:[],tweens:[]},add:null,time:null,tweens:null};
  const s={
    playerData:{skills:[],hp:100,maxHp:100,mana:20,maxMana:20,stamina:100,maxStamina:100,damageReductionBonuses:{},level:1,gold:0,cooldownReduction:0,skillDamageMultiplier:1},
    player:{x:360,y:500}, enemies:[], getGameplayTime:()=>t, isGameplayPaused:()=>paused,
    setPaused(value){ paused=value; }, hud:{update(){}}, skillBar:{update(){}}, eventBus:{emit(){},on(){return ()=>{};}},
    events:{on(){},once(){},off(){}}, syncAttachedVisuals(){}, add:harness.add, time:harness.time, tweens:harness.tweens,
    targeting:{all:()=>[], nearestAhead:()=>null, random:()=>null, aroundPlayer:()=>[], isEnemyFullyInsideViewport:()=>true},
    artifactSystem:{level:()=>0, highHpDamageMultiplier:()=>1}, professionSystem:{getDamageMultiplier:()=>1,onActiveSkillCast(){},onDirectHit(){}},
    statusEffects:{add(){}}, combatSystem:{damageEnemy:()=>false}, floatText(){}, healPlayer(){return 0;}
  };
  const sys={scene:s,passiveState:{},passiveUpdaters:[],getLevel(id){return s.playerData.skills.find(x=>x.id===id)?.level||0},recoverMana(a){const p=s.playerData; const b=p.mana; p.mana=Math.min(p.maxMana,p.mana+a); return p.mana-b;}};
  s.skillSystem=sys;
  return {s,sys,log:harness.log,advance(ms){t+=ms; sys.passiveUpdaters.forEach(f=>f());},setTime(ms){t=ms;},time:()=>t};
}
function add(sys, level=1){ sys.scene.playerData.skills=[{id:NINEFOLD_DAO_ID,level}]; SKILL_HANDLERS[NINEFOLD_DAO_ID].bind(sys); SKILL_HANDLERS[NINEFOLD_DAO_ID].onAcquire(sys); }
function slotText(scene, skillData){ const cfg=SKILLS[skillData.id]; const rarity=getRarity(cfg.rarity); return `${rarity.name} ${cfg.name}\nLv.${skillData.level}　${getSkillBarStateText(scene, skillData, cfg)}`; }
function makeSkillSystemScene({paused=false}={}){ const c=scene({paused}); c.s.skillSystem=new SkillSystem(c.s); return c; }

assert.equal(GAME_VERSION,'0.11.2'); assert.equal(pkg.version,'0.11.2');
const cfg=SKILLS[NINEFOLD_DAO_ID]; assert(cfg); assert.equal(cfg.rarity,'MYTHIC'); assert.equal(cfg.passive,true); assert.equal(cfg.maxLevel,9); assert.equal(cfg.requiredSkillId,undefined); assert(cfg.tags.includes(TAGS.CULTIVATION)); assert(cfg.tags.includes(TAGS.BUILD_CULTIVATION)); assert(BUILD_TAGS.includes(TAGS.BUILD_CULTIVATION)); assert.equal(Object.values(SKILLS).filter(s=>s?.id&&!s.hidden).length,40);
['great_handprint','soul_destroying_needle','three_pure_ones','mantra_heaven_book'].forEach(id=>assert(!SKILLS[id]));
for(let i=1;i<=9;i++){ const c=scene(); add(c.sys,i); c.advance(1000); assert(Math.abs(getCultivationSnapshot(c.s).progress-CULTIVATION_BASE_RATES[i-1]*(i>=6?1.25:1))<.001); }
let c=scene(); assert.equal(getCultivationSnapshot(c.s).active,false); assert.deepEqual(getCultivationSpellModifiers(c.s),{damageMultiplier:1,rangeMultiplier:1,cooldownMultiplier:1,manaCostMultiplier:1}); add(c.sys,1); let snap=getCultivationSnapshot(c.s); assert.equal(snap.realm,'炼气'); assert.equal(snap.progress,0); assert.equal(c.s.playerData.maxHp,105); assert.equal(c.s.playerData.maxMana,40);
assert.equal(getSkillBarStateText(c.s,{id:NINEFOLD_DAO_ID,level:6},cfg),'炼气 0%'); assert.equal(slotText(c.s,{id:NINEFOLD_DAO_ID,level:6}),'神话 九转大道\nLv.6　炼气 0%'); assert.equal((slotText(c.s,{id:NINEFOLD_DAO_ID,level:6}).match(/Lv\./g)||[]).length,1);
grantCultivation(c.s,100); grantCultivation(c.s,250); assert.equal(getSkillBarStateText(c.s,{id:NINEFOLD_DAO_ID,level:6},cfg),'筑基 50%'); assert.equal(slotText(c.s,{id:NINEFOLD_DAO_ID,level:6}),'神话 九转大道\nLv.6　筑基 50%');
c=scene(); add(c.sys,3); c.advance(29000); assert(getCultivationSnapshot(c.s).progress<47); c.advance(1000); assert.equal(Math.floor(getCultivationSnapshot(c.s).progress),64); c.advance(60000); assert.equal(getCultivationSnapshot(c.s).realm,'筑基');
c=scene(); add(c.sys,6); let r=grantCultivation(c.s,100); assert.equal(r.actualAmount,125); assert.equal(getCultivationSnapshot(c.s).realm,'筑基');
c=scene(); add(c.sys,9); assert.equal(getCultivationSnapshot(c.s).autoRate,5.5*1.25); grantCultivation(c.s,100); assert.equal(getCultivationSnapshot(c.s).autoRate,5.5*1.25*1.2); grantCultivation(c.s,500); assert.equal(getCultivationSnapshot(c.s).autoRate,5.5*1.25*1.4); grantCultivation(c.s,1e10); assert.equal(getCultivationSnapshot(c.s).realm,'渡劫'); assert.equal(getCultivationSnapshot(c.s).autoRate,0); assert.equal(getSkillBarStateText(c.s,{id:NINEFOLD_DAO_ID,level:9},cfg),'渡劫 圆满'); assert.equal(slotText(c.s,{id:NINEFOLD_DAO_ID,level:9}),'神话 九转大道\nLv.9　渡劫 圆满');
const beforeComplete=getCultivationSnapshot(c.s); c.advance(90000); const afterComplete=getCultivationSnapshot(c.s); assert.equal(afterComplete.progress,beforeComplete.progress); assert.equal(afterComplete.cycleProgressMs,beforeComplete.cycleProgressMs); assert.deepEqual(getCultivationSpellModifiers(c.s),{damageMultiplier:60,rangeMultiplier:2.5,cooldownMultiplier:.45,manaCostMultiplier:.5}); r=grantCultivation(c.s,1000); assert.equal(r.applied,false); assert.equal(r.actualAmount,0);
c=scene(); add(c.sys,1); const st=c.sys.passiveState.ninefoldDao; st.realmIndex=7; st.breakthroughCount=7; st.progress=CULTIVATION_THRESHOLDS[7]-100; r=grantCultivation(c.s,100000); assert.equal(r.actualAmount,100); assert.equal(r.applied,true); assert.deepEqual(r.breakthroughs,['渡劫']); assert.equal(getCultivationSnapshot(c.s).realm,'渡劫');
c=scene({visual:true}); add(c.sys,1); r=grantCultivation(c.s,totalCapacity()); assert.deepEqual(r.breakthroughs,['筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫']); let vst=c.sys.passiveState.ninefoldDao; assert.deepEqual(vst.visualHistory,['筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫']); assert.equal(vst.currentVisuals.filter(v=>v.kind==='text'&&!v.destroyed).length,1); assert.equal(vst.visualQueue.length,7); c.log.tweens.at(-1).complete(); assert.equal(vst.currentVisuals.length,0); assert(c.log.timers.at(-1).delay>=180 && c.log.timers.at(-1).delay<=250); c.log.timers.at(-1).fire(); assert.equal(vst.currentVisuals.filter(v=>v.kind==='text'&&!v.destroyed)[0].text,'突破·金丹'); assert.equal(vst.currentVisuals.filter(v=>v.kind==='text'&&!v.destroyed).length,1); SKILL_HANDLERS[NINEFOLD_DAO_ID].cleanup(c.sys); assert.equal(vst.visualQueue.length,0); assert.equal(vst.visualTimers.every(t=>t.removed),true); assert.equal(vst.currentVisuals.length,0); assert.equal(vst.visuals.length,0); assert.equal(vst.visualTween,null); assert.equal(vst.visualTimer,null);
c=makeSkillSystemScene(); c.s.skillSystem.addOrLevel(NINEFOLD_DAO_ID); c.setTime(1000); c.s.skillSystem.update(1000); const p1=getCultivationSnapshot(c.s).progress; c.s.setPaused(true); c.setTime(3000); c.s.skillSystem.update(3000); assert.equal(getCultivationSnapshot(c.s).progress,p1); c.s.setPaused(false); c.s.playerData.hp=0; c.setTime(5000); c.s.skillSystem.update(5000); assert.equal(getCultivationSnapshot(c.s).progress,p1);
c=makeSkillSystemScene(); c.s.skillSystem.addOrLevel(NINEFOLD_DAO_ID); c.setTime(1000); c.s.skillSystem.update(1000); const pauseProgress=getCultivationSnapshot(c.s).progress; const pauseCycle=getCultivationSnapshot(c.s).cycleProgressMs; const pausedAt=c.time(); c.s.setPaused(true); c.setTime(pausedAt+10000); c.s.skillSystem.shiftTimers(10000,pausedAt); c.s.setPaused(false); c.s.skillSystem.update(c.time()); assert.equal(getCultivationSnapshot(c.s).progress,pauseProgress); assert.equal(getCultivationSnapshot(c.s).cycleProgressMs,pauseCycle); c.setTime(c.time()+1000); c.s.skillSystem.update(c.time()); assert(Math.abs(getCultivationSnapshot(c.s).progress-(pauseProgress+1))<.001);
c=makeSkillSystemScene({paused:true}); c.s.skillSystem.addOrLevel(NINEFOLD_DAO_ID); c.setTime(10000); c.s.skillSystem.shiftTimers(10000,0); c.s.setPaused(false); c.s.skillSystem.update(10000); assert.equal(getCultivationSnapshot(c.s).progress,0); assert.equal(getCultivationSnapshot(c.s).cycleProgressMs,0); assert.equal(c.s.skillSystem.passiveState.ninefoldDao.manaRegenProgressMs,0);
c=makeSkillSystemScene(); c.s.skillSystem.addOrLevel(NINEFOLD_DAO_ID); c.s.setPaused(true); c.setTime(5000); c.s.skillSystem.addOrLevel(NINEFOLD_DAO_ID); c.s.skillSystem.shiftTimers(5000,0); c.s.setPaused(false); c.s.skillSystem.update(5000); assert.equal(c.s.skillSystem.getLevel(NINEFOLD_DAO_ID),2); assert.equal(getCultivationSnapshot(c.s).progress,0);
c=scene(); add(c.sys,3); c.sys.passiveState.ninefoldDao.cycleProgressMs=29500; SKILL_HANDLERS[NINEFOLD_DAO_ID].shiftTimers(c.sys,1000,0); c.setTime(1000); c.sys.passiveUpdaters.forEach(fn=>fn()); assert.equal(c.sys.passiveState.ninefoldDao.cycleProgressMs,29500); c.advance(500); assert.equal(c.sys.passiveState.ninefoldDao.cycleProgressMs,0); assert(Math.abs(getCultivationSnapshot(c.s).progress-16.8)<.001);
c=scene(); add(c.sys,1); c.s.playerData.maxHp+=8; c.s.playerData.maxMana+=5; SKILL_HANDLERS[NINEFOLD_DAO_ID].update(c.sys); assert.equal(c.s.playerData.maxHp,113); assert.equal(c.s.playerData.maxMana,45);
c=scene(); add(c.sys,1); assert.equal(c.sys.passiveUpdaters.length,1); c.advance(1000); const first=getCultivationSnapshot(c.s).progress; SKILL_HANDLERS[NINEFOLD_DAO_ID].cleanup(c.sys); add(c.sys,1); assert.equal(c.sys.passiveUpdaters.length,1); c.advance(1000); assert(Math.abs(getCultivationSnapshot(c.s).progress-first)<.001);
c=scene(); add(c.sys,1); grantCultivation(c.s,totalCapacity()); const beforeDetail=JSON.stringify(getCultivationSnapshot(c.s)); const detail=getSkillDetailData(NINEFOLD_DAO_ID,{scene:c.s,skill:{id:NINEFOLD_DAO_ID,level:9}}); assert(detail.currentEffects.includes('当前实际自动修为/秒：0')); assert.equal(JSON.stringify(getCultivationSnapshot(c.s)),beforeDetail);
c=scene(); add(c.sys,1); c.s.playerData.hp=1; grantCultivation(c.s,100); assert.equal(Number.isInteger(c.s.playerData.hp),true);
c=scene(); add(c.sys,1); c.s.playerData.mana=0; advanceFrames(c,1000); assert.equal(c.s.playerData.mana,0.5); assert.equal(c.s.playerData.mana,Number(c.s.playerData.mana.toFixed(3)));
c=scene(); add(c.sys,1); grantCultivation(c.s,3100); c.s.playerData.mana=0; advanceFrames(c,1000); assert.equal(c.s.playerData.mana,3.5); assert.equal(c.s.playerData.mana,Number(c.s.playerData.mana.toFixed(3)));
c=scene(); add(c.sys,1); grantCultivation(c.s,totalCapacity()); c.s.playerData.mana=0; advanceFrames(c,1000); assert.equal(c.s.playerData.mana,30); SKILL_HANDLERS[NINEFOLD_DAO_ID].cleanup(c.sys); const manaAfterCleanup=c.s.playerData.mana; c.advance(1000); assert.equal(c.s.playerData.mana,manaAfterCleanup);
c=scene({visual:true}); c.s.playerData.hp=39.0000000004; c.s.playerData.maxHp=100; c.s.playerData.mana=93.50833333333334; c.s.playerData.maxMana=120; const hud=new Hud(c.s); c.s.hud=hud; hud.update(); assert.equal(hud.hpText.text,'39/100'); assert.equal(hud.mpText.text,'93.5/120'); hud.destroy();
c=scene(); add(c.sys,1); grantCultivation(c.s,101); assert.equal(getCultivationSnapshot(c.s).realm,'筑基'); assert.equal(Math.floor(getCultivationSnapshot(c.s).progress),1); assert.equal(c.s.playerData.level,1); SKILL_HANDLERS[NINEFOLD_DAO_ID].cleanup(c.sys); assert.equal(c.s.playerData.maxHp,100); assert.equal(c.s.playerData.maxMana,20); assert.equal(c.s.playerData.damageReductionBonuses[NINEFOLD_DAO_ID],undefined); assert.equal(getCultivationSnapshot(c.s).active,false); add(c.sys,1); assert.equal(getCultivationSnapshot(c.s).realm,'炼气');
assert.deepEqual(CULTIVATION_REALMS,['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫']); assert.deepEqual(CULTIVATION_THRESHOLDS,[100,500,2500,15000,100000,1000000,20000000,500000000]);
console.log('v0.11.1 ninefold dao validation passed');
