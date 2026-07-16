import { SKILLS } from '../../config/skills.js';
import { TAGS } from '../../config/tags.js';

export const NINEFOLD_DAO_ID = 'ninefold_dao';
export const CULTIVATION_REALMS = Object.freeze(['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫']);
export const CULTIVATION_THRESHOLDS = Object.freeze([100,500,2500,15000,100000,1000000,20000000,500000000]);
export const CULTIVATION_BASE_RATES = Object.freeze([1,1.3,1.6,2,2.5,3.1,3.8,4.6,5.5]);
export const CULTIVATION_REALM_STATS = Object.freeze([
  { maxHpPct:.05, maxMana:20, manaRegen:0.5, damageReduction:0, spell:{damageMultiplier:1,rangeMultiplier:1,cooldownMultiplier:1,manaCostMultiplier:1}},
  { maxHpPct:.10, maxMana:40, manaRegen:1, damageReduction:.03, spell:{damageMultiplier:1.3,rangeMultiplier:1.05,cooldownMultiplier:1,manaCostMultiplier:.95}},
  { maxHpPct:.20, maxMana:80, manaRegen:2, damageReduction:.05, spell:{damageMultiplier:1.8,rangeMultiplier:1.10,cooldownMultiplier:.95,manaCostMultiplier:.90}},
  { maxHpPct:.35, maxMana:140, manaRegen:3.5, damageReduction:.08, spell:{damageMultiplier:2.8,rangeMultiplier:1.20,cooldownMultiplier:.90,manaCostMultiplier:.85}},
  { maxHpPct:.55, maxMana:220, manaRegen:5.5, damageReduction:.12, spell:{damageMultiplier:4.5,rangeMultiplier:1.30,cooldownMultiplier:.85,manaCostMultiplier:.80}},
  { maxHpPct:.80, maxMana:350, manaRegen:8, damageReduction:.16, spell:{damageMultiplier:7.5,rangeMultiplier:1.45,cooldownMultiplier:.78,manaCostMultiplier:.75}},
  { maxHpPct:1.20, maxMana:550, manaRegen:12, damageReduction:.22, spell:{damageMultiplier:13,rangeMultiplier:1.65,cooldownMultiplier:.70,manaCostMultiplier:.70}},
  { maxHpPct:2.00, maxMana:900, manaRegen:18, damageReduction:.30, spell:{damageMultiplier:25,rangeMultiplier:2.00,cooldownMultiplier:.60,manaCostMultiplier:.60}},
  { maxHpPct:4.00, maxMana:1500, manaRegen:30, damageReduction:.40, spell:{damageMultiplier:60,rangeMultiplier:2.50,cooldownMultiplier:.45,manaCostMultiplier:.50}},
]);
const neutralSpell=Object.freeze({damageMultiplier:1,rangeMultiplier:1,cooldownMultiplier:1,manaCostMultiplier:1});
export const CULTIVATION_UNIVERSAL_ACTIVE_MODIFIERS=Object.freeze([
  Object.freeze({activeSkillDamageMultiplier:1.00,activeSkillCooldownMultiplier:1.00}),
  Object.freeze({activeSkillDamageMultiplier:1.03,activeSkillCooldownMultiplier:1.00}),
  Object.freeze({activeSkillDamageMultiplier:1.06,activeSkillCooldownMultiplier:.98}),
  Object.freeze({activeSkillDamageMultiplier:1.10,activeSkillCooldownMultiplier:.96}),
  Object.freeze({activeSkillDamageMultiplier:1.15,activeSkillCooldownMultiplier:.94}),
  Object.freeze({activeSkillDamageMultiplier:1.22,activeSkillCooldownMultiplier:.92}),
  Object.freeze({activeSkillDamageMultiplier:1.30,activeSkillCooldownMultiplier:.90}),
  Object.freeze({activeSkillDamageMultiplier:1.45,activeSkillCooldownMultiplier:.88}),
  Object.freeze({activeSkillDamageMultiplier:1.70,activeSkillCooldownMultiplier:.85})
]);
const neutralUniversal=Object.freeze({activeSkillDamageMultiplier:1,activeSkillCooldownMultiplier:1});
const MANA_REGEN_STEP_MS=250;
const stateOf=x=>x?.skillSystem?.passiveState?.ninefoldDao || x?.passiveState?.ninefoldDao || null;
const systemOf=x=>x?.skillSystem || x;
const levelOf=sys=>sys?.getLevel?.(NINEFOLD_DAO_ID) || 0;
const finite=n=>Number.isFinite(Number(n));
const stat=i=>CULTIVATION_REALM_STATS[Math.max(0,Math.min(8,i||0))];
const roundResource=n=>Math.round((Number(n)||0)*1000)/1000;
function rate(sys, st=stateOf(sys)){ const lv=levelOf(sys); if(!lv||!st||st.realmIndex>=8) return 0; return CULTIVATION_BASE_RATES[Math.max(0,Math.min(8,lv-1))]*(lv>=6?1.25:1)*(lv>=9?Math.min(2.6,1+(st.breakthroughCount||0)*.2):1); }
function snapshot(sys){ const st=stateOf(sys); if(!st) return { active:false, hidden:true }; const idx=st.realmIndex||0, need=CULTIVATION_THRESHOLDS[idx]??null; return { active:true, realmIndex:idx, realm:CULTIVATION_REALMS[idx], progress:st.progress||0, nextThreshold:need, isComplete:idx>=8, cycleProgressMs:st.cycleProgressMs||0, breakthroughCount:st.breakthroughCount||0, autoRate:rate(systemOf(sys),st), gainMultiplier:levelOf(systemOf(sys))>=6?1.25:1, stats:stat(idx), nextRealm:idx<8?CULTIVATION_REALMS[idx+1]:null, nextStats:idx<8?stat(idx+1):null } }
export function getCultivationSnapshot(sceneOrSystem){ return snapshot(systemOf(sceneOrSystem)); }
export function getCultivationSpellModifiers(sceneOrSystem){ const st=stateOf(sceneOrSystem); return st ? { ...stat(st.realmIndex).spell } : { ...neutralSpell }; }
export function getCultivationUniversalModifiers(sceneOrSystem){ const st=stateOf(sceneOrSystem); return st ? { ...CULTIVATION_UNIVERSAL_ACTIVE_MODIFIERS[Math.max(0,Math.min(8,st.realmIndex||0))] } : { ...neutralUniversal }; }
function applyStats(sys){ const st=stateOf(sys), p=sys?.scene?.playerData; if(!st||!p) return; p.damageReductionBonuses??={}; const baseHp=Math.max(1,(p.maxHp||0)-(st.appliedMaxHpBonus||0)); const baseMana=Math.max(0,(p.maxMana||0)-(st.appliedMaxManaBonus||0)); const s=stat(st.realmIndex); const hpBonus=Math.round(baseHp*s.maxHpPct), manaBonus=s.maxMana; const hpDiff=hpBonus-(st.appliedMaxHpBonus||0), manaDiff=manaBonus-(st.appliedMaxManaBonus||0); p.maxHp=baseHp+hpBonus; p.maxMana=baseMana+manaBonus; if(hpDiff>0) p.hp=Math.min(p.maxHp,(p.hp||0)+hpDiff); else p.hp=Math.min(p.hp||0,p.maxHp); if(manaDiff>0) p.mana=Math.min(p.maxMana,(p.mana||0)+manaDiff); else p.mana=Math.min(p.mana||0,p.maxMana); p.damageReductionBonuses[NINEFOLD_DAO_ID]=s.damageReduction; st.appliedMaxHpBonus=hpBonus; st.appliedMaxManaBonus=manaBonus; }
function removeTimer(timer){ timer?.remove?.(false); timer?.destroy?.(); }
function removeTween(tween){ tween?.stop?.(); tween?.remove?.(); tween?.destroy?.(); }
function cleanupVisuals(st){
  st?.visualTimers?.forEach(removeTimer);
  st?.visuals?.forEach(v=>v?.destroy?.());
  st?.currentVisuals?.forEach(v=>v?.destroy?.());
  removeTimer(st?.visualTimer);
  removeTween(st?.visualTween);
  if(st){ st.visualTimers=[]; st.visuals=[]; st.currentVisuals=[]; st.visualQueue=[]; st.visualTimer=null; st.visualTween=null; st.visualPlaying=false; }
}
function scheduleVisual(sys, st, delay, fn){
  const timer=sys?.scene?.time?.delayedCall?.(delay, fn);
  if(timer){ st.visualTimer=timer; st.visualTimers.push(timer); return timer; }
  if(delay<=0) fn?.();
  return null;
}
function finishCurrentVisual(sys, st){
  st.currentVisuals?.forEach(v=>v?.destroy?.());
  st.currentVisuals=[]; st.visualTween=null; st.visualPlaying=false;
  if(st.visualQueue?.length) scheduleVisual(sys, st, 210, ()=>playNextBreakthroughVisual(sys));
}
function playNextBreakthroughVisual(sys){
  const st=stateOf(sys); if(!st) return;
  removeTimer(st.visualTimer); st.visualTimer=null;
  const realm=st.visualQueue?.shift?.();
  if(!realm){ st.visualPlaying=false; return; }
  st.visualPlaying=true;
  const sc=sys?.scene;
  if(!sc?.add){ finishCurrentVisual(sys, st); return; }
  try{
    const x=sc.player?.x??360, y=(sc.player?.y??360)-90;
    const txt=sc.add.text(x,y,`突破·${realm}`,{fontFamily:'Arial',fontSize:'30px',color:'#ffd166',stroke:'#6b1200',strokeThickness:5}).setOrigin?.(.5)?.setDepth?.(2500);
    const ring=sc.add.circle?.(x,y+50,24,0xff2d2d,.18)?.setStrokeStyle?.(4,0xffd166,.9)?.setDepth?.(2499);
    st.currentVisuals=[txt,ring].filter(Boolean); st.visuals.push(...st.currentVisuals);
    const done=()=>finishCurrentVisual(sys, st);
    const tween=sc.tweens?.add?.({targets:st.currentVisuals,alpha:0,scale:1.8,duration:900,onComplete:done});
    if(tween) st.visualTween=tween; else scheduleVisual(sys, st, 900, done);
  }catch{ finishCurrentVisual(sys, st); }
}
function breakthroughVisual(sys, realm){ const st=stateOf(sys); if(!st) return; st.visualQueue??=[]; st.visualQueue.push(realm); st.visualHistory??=[]; st.visualHistory.push(realm); if(!st.visualPlaying&&!st.visualTimer) playNextBreakthroughVisual(sys); }
function cultivationCapacity(st){ if(!st||st.realmIndex>=8) return 0; let need=Math.max(0,(CULTIVATION_THRESHOLDS[st.realmIndex]||0)-(st.progress||0)); for(let i=st.realmIndex+1;i<8;i+=1) need+=CULTIVATION_THRESHOLDS[i]||0; return need; }
function addInternal(sys, amount){ const st=stateOf(sys); if(!st||st.realmIndex>=8||!finite(amount)||amount<=0) return {applied:0,breakthroughs:[],snapshot:getCultivationSnapshot(sys)}; const accepted=Math.min(Number(amount)||0,cultivationCapacity(st)); if(accepted<=0) return {applied:0,breakthroughs:[],snapshot:getCultivationSnapshot(sys)}; st.progress+=accepted; const breakthroughs=[]; while(st.realmIndex<8 && st.progress >= CULTIVATION_THRESHOLDS[st.realmIndex]){ st.progress-=CULTIVATION_THRESHOLDS[st.realmIndex]; st.realmIndex+=1; st.breakthroughCount=st.realmIndex; breakthroughs.push(CULTIVATION_REALMS[st.realmIndex]); applyStats(sys); const p=sys.scene?.playerData; if(p){ const breakthroughHeal=Math.round(p.maxHp*.3); p.hp=Math.min(p.maxHp,Math.round((p.hp||0)+breakthroughHeal)); p.mana=p.maxMana; } breakthroughVisual(sys,CULTIVATION_REALMS[st.realmIndex]); }
 if(st.realmIndex>=8) st.progress=0; sys.scene?.hud?.update?.(); sys.scene?.skillBar?.update?.(); return {applied:accepted,breakthroughs,snapshot:getCultivationSnapshot(sys)}; }
export function grantCultivation(sceneOrSystem, baseAmount, options={}){ const sys=systemOf(sceneOrSystem); if(!levelOf(sys)||!stateOf(sys)) return {applied:false,actualAmount:0,breakthroughs:[],snapshot:getCultivationSnapshot(sys)}; if(!finite(baseAmount)||baseAmount<=0) return {applied:false,actualAmount:0,breakthroughs:[],snapshot:getCultivationSnapshot(sys)}; const actual=Number(baseAmount)*(levelOf(sys)>=6&&!options.skipLv6?1.25:1); const r=addInternal(sys,actual); return {applied:r.applied>0,actualAmount:r.applied,breakthroughs:r.breakthroughs,snapshot:r.snapshot}; }
function ensure(sys){ if(levelOf(sys)<=0) return null; let st=stateOf(sys); if(st) return st; st={realmIndex:0,progress:0,cycleProgressMs:0,manaRegenProgressMs:0,lastGameplayAt:sys.scene?.getGameplayTime?.()??0,appliedMaxHpBonus:0,appliedMaxManaBonus:0,breakthroughCount:0,visualTimers:[],visuals:[],visualQueue:[],visualTimer:null,visualTween:null,currentVisuals:[],visualHistory:[],visualPlaying:false,updater:null}; sys.passiveState.ninefoldDao=st; applyStats(sys); return st; }
function ensureUpdater(sys){ const st=ensure(sys); if(!st) return null; if(!st.updater) st.updater=()=>NinefoldDaoSkill.update(sys); if(!sys.passiveUpdaters.includes(st.updater)) sys.passiveUpdaters.push(st.updater); return st; }
function updateManaRegen(sys, st, elapsed){ st.manaRegenProgressMs=Math.max(0,(st.manaRegenProgressMs||0)+elapsed); const steps=Math.floor(st.manaRegenProgressMs/MANA_REGEN_STEP_MS); if(steps<=0) return; st.manaRegenProgressMs-=steps*MANA_REGEN_STEP_MS; const amount=roundResource(stat(st.realmIndex).manaRegen*(MANA_REGEN_STEP_MS/1000)*steps); if(amount<=0) return; sys.recoverMana?.(amount); const p=sys.scene?.playerData; if(p&&finite(p.mana)) p.mana=Math.min(p.maxMana??p.mana,roundResource(p.mana)); }
export const NinefoldDaoSkill={ bind(sys){ const st=ensureUpdater(sys); return ()=>{ const current=stateOf(sys); if(current?.updater) sys.passiveUpdaters=sys.passiveUpdaters.filter(fn=>fn!==current.updater); NinefoldDaoSkill.cleanup(sys); }; }, onAcquire(sys){ ensureUpdater(sys); applyStats(sys); }, shiftTimers(sys,pausedDuration,pausedAt){ const st=stateOf(sys); const duration=Math.max(0,Number(pausedDuration)||0); const pauseStart=Number(pausedAt); if(!st||duration<=0||!Number.isFinite(pauseStart)) return; if((st.lastGameplayAt??pauseStart)<=pauseStart) st.lastGameplayAt=(st.lastGameplayAt??pauseStart)+duration; }, update(sys){ const st=ensure(sys); if(!st) return; applyStats(sys); const now=sys.scene?.getGameplayTime?.()??0; const elapsed=Math.max(0,now-(st.lastGameplayAt??now)); st.lastGameplayAt=now; if(elapsed<=0) return; if(st.realmIndex<8){ const r=rate(sys,st); if(r>0) addInternal(sys,r*elapsed/1000); if(levelOf(sys)>=3){ st.cycleProgressMs+=elapsed; while(st.realmIndex<8&&st.cycleProgressMs>=30000){ st.cycleProgressMs-=30000; addInternal(sys,r*10); } } } updateManaRegen(sys,st,elapsed); }, cleanup(sys){ const st=stateOf(sys), p=sys?.scene?.playerData; if(st&&p){ p.maxHp=Math.max(1,(p.maxHp||0)-(st.appliedMaxHpBonus||0)); p.hp=Math.min(p.hp||0,p.maxHp); p.maxMana=Math.max(0,(p.maxMana||0)-(st.appliedMaxManaBonus||0)); p.mana=Math.min(p.mana||0,p.maxMana); if(p.damageReductionBonuses) delete p.damageReductionBonuses[NINEFOLD_DAO_ID]; } if(st?.updater) sys.passiveUpdaters=sys.passiveUpdaters.filter(fn=>fn!==st.updater); cleanupVisuals(st); if(sys?.passiveState) delete sys.passiveState.ninefoldDao; sys?.scene?.hud?.update?.(); sys?.scene?.skillBar?.update?.(); } };
export function configureCultivationCoreSkill(){ SKILLS[NINEFOLD_DAO_ID]={ id:NINEFOLD_DAO_ID,name:'九转大道',rarity:'MYTHIC',handler:NINEFOLD_DAO_ID,passive:true,maxLevel:9,cooldownMs:999999,targetType:'passive',short:'道',color:0xd83a1e,tags:[TAGS.MAGIC,TAGS.CULTIVATION,TAGS.BUILD_CULTIVATION],description:'开启独立修为系统，自动修炼并突破炼气、筑基、金丹、元婴、化神、炼虚、合体、大乘、渡劫九大境界。Lv3解锁周天运转：每30秒有效游戏时间获得当前10秒自动修为。Lv6大道自然：后续修为来源提高25%，只应用一次。Lv9九转归一：按已完成突破次数提高自动修炼速度，每次+20%，最高2.6倍。',milestones:{3:'周天运转：每30秒获得10秒自动修为。',6:'大道自然：后续修为来源提高25%。',9:'九转归一：突破次数提高自动修炼速度。'},levels:CULTIVATION_BASE_RATES.map((autoRate,i)=>({autoRate,desc:`基础自动修为 ${autoRate}/秒；独立修为系统持续突破九大境界。`}))}; }
