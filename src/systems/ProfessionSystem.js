import { CombatEvents } from '../core/CombatEvents.js';
import { getProfession, getAdvancedProfession, PROFESSION_STATE_DEFAULTS, PROFESSION_SOURCE_KEYS } from '../config/professions.js';
import { sumRuntimeBonuses, getEffectiveAttack, getEffectiveDefense } from '../config/balance.js';
import { TAGS } from '../config/tags.js';
import { getSummonProfessionRule } from '../config/summonProfessionRules.js';

const BUCKETS=['attackMultiplierBonuses','maxHpBonuses','defenseBonuses','maxManaBonuses','manaRegenPerSecondBonuses','activeSkillDamageBonuses','cooldownReductionBonuses','activeSkillManaCostReductionBonuses','shieldGainMultiplierBonuses','attackSpeedMultiplierBonuses','critMultiplierBonuses','allDamageMultiplierBonuses','summonDamageBonuses','summonHealingBonuses','summonMaxHpBonuses','summonActionSpeedBonuses'];
const cloneState=()=>({...PROFESSION_STATE_DEFAULTS});
const setBucket=(p,bucket,key,value=0)=>{ p[bucket]??={}; if(value) p[bucket][key]=value; else delete p[bucket][key]; };
const resourceRatio=(value,max)=>max>0?Math.max(0,Math.min(1,value/max)):0;

export const berserkerDamageBonus=maxHp=>Math.min(.24,Math.floor(Math.max(0,maxHp)/100)*.02);

export default class ProfessionSystem{
  constructor(scene){this.scene=scene;this.unsubs=[];this.ensureBuckets();}
  ensureBuckets(){const p=this.scene.playerData;BUCKETS.forEach(k=>p[k]??={});p.summonContractSkillId??=null;p.professionState??=cloneState();}
  currentConfig(){return getProfession(this.scene.playerData?.professionId);}
  clearSource(key){const p=this.scene.playerData;BUCKETS.forEach(bucket=>setBucket(p,bucket,key,0));}
  updateResourceMax(kind,next){const p=this.scene.playerData,maxKey=kind==='hp'?'maxHp':'maxMana',ratio=resourceRatio(p[kind],p[maxKey]);p[maxKey]=Math.max(0,Math.round(next));p[kind]=Math.min(p[maxKey],Math.round(p[maxKey]*ratio));}
  refreshResourceMaximums(){const p=this.scene.playerData;this.updateResourceMax('hp',(p.baseMaxHp||0)+sumRuntimeBonuses(p.maxHpBonuses));this.updateResourceMax('mana',(p.baseMaxMana??p.maxMana??0)+sumRuntimeBonuses(p.maxManaBonuses));}
  applyBase(id){const p=this.scene.playerData,b=getProfession(id)?.bonuses||{},k=PROFESSION_SOURCE_KEYS.base;setBucket(p,'attackMultiplierBonuses',k,b.attackMultiplierBonus);setBucket(p,'maxHpBonuses',k,b.maxHp);setBucket(p,'defenseBonuses',k,b.defense);setBucket(p,'maxManaBonuses',k,b.maxMana);setBucket(p,'manaRegenPerSecondBonuses',k,b.manaRegenPerSecond);setBucket(p,'activeSkillDamageBonuses',k,b.activeSkillDamage);setBucket(p,'summonDamageBonuses',k,b.summonDamage);setBucket(p,'summonHealingBonuses',k,b.summonHealing);setBucket(p,'summonMaxHpBonuses',k,b.summonMaxHp);this.refreshResourceMaximums();}
  applyAdvanced(id){const p=this.scene.playerData,k=PROFESSION_SOURCE_KEYS.advanced;if(id==='swordsman'){setBucket(p,'maxHpBonuses',k,70);setBucket(p,'defenseBonuses',k,8);setBucket(p,'shieldGainMultiplierBonuses',k,.25);}if(id==='blade_master'){setBucket(p,'allDamageMultiplierBonuses',k,.10);setBucket(p,'attackSpeedMultiplierBonuses',k,.10);setBucket(p,'critMultiplierBonuses',k,.15);}if(id==='arcanist'){setBucket(p,'cooldownReductionBonuses',k,.12);setBucket(p,'activeSkillManaCostReductionBonuses',k,.15);}if(id==='blood_demon')setBucket(p,'activeSkillDamageBonuses',k,.15);if(id==='spirit_horde_master'){setBucket(p,'summonMaxHpBonuses',k,.20);setBucket(p,'summonDamageBonuses',k,.10);setBucket(p,'summonHealingBonuses',k,.10);}if(id==='summon_commander')setBucket(p,'summonActionSpeedBonuses',k,.20);this.refreshResourceMaximums();}
  selectProfession(id){const cfg=getProfession(id),p=this.scene.playerData;if(!cfg)return false;const weapon=p.weaponId;this.reset();p.professionId=id;p.professionState=cloneState();p.summonContractSkillId=null;this.applyBase(id);this.bind();if(p.weaponId!==weapon)throw new Error('profession changed weaponId');this.scene.runStats?.setProfession?.(id);this.scene.eventBus.emit(CombatEvents.PROFESSION_CHOSEN,{professionId:id,profession:cfg});this.scene.hud?.update();return true;}
  selectAdvancedProfession(id){const cfg=getAdvancedProfession(id),p=this.scene.playerData;if(!cfg||cfg.base!==p.professionId||p.advancedProfessionId)return false;p.advancedProfessionId=id;this.applyAdvanced(id);this.scene.eventBus.emit(CombatEvents.PROFESSION_CHOSEN,{professionId:id,advanced:true,profession:cfg});this.scene.hud?.update();return true;}
  bind(){this.unsubs.push(this.scene.eventBus.on(CombatEvents.SKILL_CAST_COMPLETED,e=>this.onCompletedCast(e)));}
  onCompletedCast(e){const p=this.scene.playerData,ctx=e?.ctx||{};if(p.advancedProfessionId!=='arcanist'||!ctx.isActiveSkill||ctx.fromMyriadAfterimage||ctx.isFreeCast||ctx.isCopiedCast||ctx.isExtraCast||Number(ctx.effectiveManaCost)<=0)return;this.scene.skillSystem?.recoverMana?.(2);}
  bindSummonContract(skillId){const p=this.scene.playerData;if(p.professionId!=='summoner')return false;p.summonContractSkillId=skillId||null;p.professionState.summonContractSkillId=p.summonContractSkillId;this.scene.hud?.update();return true;}
  summonContract(){return this.scene.playerData?.summonContractSkillId||null;}
  getDamageMultiplier(source={},target=null){const p=this.scene.playerData;let bonus=sumRuntimeBonuses(p.allDamageMultiplierBonuses);if(p.advancedProfessionId==='berserker')bonus+=berserkerDamageBonus(p.maxHp);if(p.advancedProfessionId==='curse_master'&&this.hasPlayerDebuff(target))bonus+=.12;if((source.tags||[]).includes(TAGS.SUMMON))bonus+=sumRuntimeBonuses(p.summonDamageBonuses);return 1+bonus;}
  activeSkillDamageMultiplier(){return 1+sumRuntimeBonuses(this.scene.playerData.activeSkillDamageBonuses);}
  attackMultiplier(){return 1+sumRuntimeBonuses(this.scene.playerData.attackMultiplierBonuses);}
  cooldownReduction(){return sumRuntimeBonuses(this.scene.playerData.cooldownReductionBonuses);}
  manaCostMultiplier(){return 1-sumRuntimeBonuses(this.scene.playerData.activeSkillManaCostReductionBonuses);}
  shieldGain(amount,{ordinary=true}={}){return ordinary?Math.round(amount*(1+sumRuntimeBonuses(this.scene.playerData.shieldGainMultiplierBonuses))):amount;}
  onDamageDealt(actual,meta={}){const p=this.scene.playerData;if(p.advancedProfessionId!=='blood_demon'||actual<=0||meta.noProfessionLifeSteal)return;const tags=meta.tags||[],dot=tags.includes(TAGS.DOT),direct=meta.source==='skill'&&!dot;if(!dot&&!direct)return;if(tags.includes(TAGS.SUMMON)||['attack','normalAttack','reflect','environment'].includes(meta.source))return;const raw=actual*(dot?.01:.05)+(dot?(p.professionState.dotLifeStealRemainder||0):0),heal=dot?Math.floor(raw):raw;if(dot)p.professionState.dotLifeStealRemainder=raw-Math.floor(raw);if(heal>=1)this.scene.healPlayer?.(heal,'profession_lifesteal',{noProfessionLifeSteal:true});}
  debuffDuration(duration,target){if(this.scene.playerData.advancedProfessionId!=='curse_master')return duration;if(target?.isBoss&&target?.controlImmune)return duration;return Math.round(duration*1.25);}
  hasPlayerDebuff(target){return !!target&&!!this.scene.statusEffects?.getEffects?.(target)?.some(e=>e.isDebuff!==false&&e.target!==this.scene.playerData);}
  summonModifiers(skill={}){const p=this.scene.playerData,rule=getSummonProfessionRule(skill.id)||skill,mode=rule.professionCountMode||'none',entity=rule.summonEntityType==='entity';return {countBonus:p.advancedProfessionId==='spirit_horde_master'&&entity&&mode==='extra'?1:0,uniqueEffectMultiplier:p.advancedProfessionId==='spirit_horde_master'&&mode==='unique'?1.2:1,maxHpMultiplier:entity?1+sumRuntimeBonuses(p.summonMaxHpBonuses):1,damageMultiplier:1+sumRuntimeBonuses(p.summonDamageBonuses),healingMultiplier:1+sumRuntimeBonuses(p.summonHealingBonuses),actionSpeedMultiplier:1+sumRuntimeBonuses(p.summonActionSpeedBonuses),inheritance:p.advancedProfessionId==='symbiosis_master'?{attack:getEffectiveAttack(p)*.20,defense:getEffectiveDefense(p)*.20,maxHp:p.maxHp*.15,attackSpeedBonus:Math.max(0,(p.attackSpeedMultiplier+sumRuntimeBonuses(p.attackSpeedMultiplierBonuses))-1)*.30}:null};}
  reset(){this.unsubs.splice(0).forEach(off=>off?.());const p=this.scene.playerData;if(!p)return;this.clearSource(PROFESSION_SOURCE_KEYS.base);this.clearSource(PROFESSION_SOURCE_KEYS.advanced);p.professionId=null;p.advancedProfessionId=null;p.summonContractSkillId=null;p.professionState=cloneState();this.refreshResourceMaximums();}
  shiftTimers(){}
  destroy(){this.reset();}
}
