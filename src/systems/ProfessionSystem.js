import { CombatEvents } from '../core/CombatEvents.js';
import { getProfession, getAdvancedProfession, PROFESSION_STATE_DEFAULTS, PROFESSION_SOURCE_KEYS } from '../config/professions.js';
import { sumRuntimeBonuses, getEffectiveAttack, getEffectiveDefense } from '../config/balance.js';
import { TAGS } from '../config/tags.js';
import { getSummonProfessionRule } from '../config/summonProfessionRules.js';
import { getSummonCreatureContract } from '../config/summonCreatureContracts.js';
import { SKILLS } from '../config/skills.js';

const BUCKETS=['attackMultiplierBonuses','maxHpBonuses','defenseBonuses','maxManaBonuses','manaRegenPerSecondBonuses','activeSkillDamageBonuses','cooldownReductionBonuses','activeSkillManaCostReductionBonuses','shieldGainMultiplierBonuses','attackSpeedMultiplierBonuses','critMultiplierBonuses','allDamageMultiplierBonuses','summonDamageBonuses','summonHealingBonuses','summonMaxHpBonuses','summonActionSpeedBonuses'];
const cloneState=()=>({...PROFESSION_STATE_DEFAULTS});
const setBucket=(p,bucket,key,value=0)=>{ p[bucket]??={}; if(value) p[bucket][key]=value; else delete p[bucket][key]; };
const resourceRatio=(value,max)=>max>0?Math.max(0,Math.min(1,value/max)):0;
const mergeTags=(...groups)=>[...new Set(groups.flat().filter(Boolean))];

export const berserkerDamageBonus=maxHp=>Math.min(.24,Math.floor(Math.max(0,maxHp)/100)*.02);

export default class ProfessionSystem{
  constructor(scene){
    this.scene=scene;
    this.unsubs=[];
    this.ensureBuckets();
    this.refreshSummonContract();
  }

  ensureBuckets(){
    const p=this.scene.playerData;
    BUCKETS.forEach(k=>p[k]??={});
    p.summonContractSkillId??=null;
    p.professionState??=cloneState();
  }

  currentConfig(){ return getProfession(this.scene.playerData?.professionId); }
  clearSource(key){ const p=this.scene.playerData; BUCKETS.forEach(bucket=>setBucket(p,bucket,key,0)); }

  updateResourceMax(kind,next){
    const p=this.scene.playerData;
    const maxKey=kind==='hp'?'maxHp':'maxMana';
    const ratio=resourceRatio(p[kind],p[maxKey]);
    p[maxKey]=Math.max(0,Math.round(next));
    p[kind]=Math.min(p[maxKey],Math.round(p[maxKey]*ratio));
  }

  refreshResourceMaximums(){
    const p=this.scene.playerData;
    this.updateResourceMax('hp',(p.baseMaxHp||0)+sumRuntimeBonuses(p.maxHpBonuses));
    this.updateResourceMax('mana',(p.baseMaxMana??p.maxMana??0)+sumRuntimeBonuses(p.maxManaBonuses));
  }

  applyBase(id){
    const p=this.scene.playerData;
    const b=getProfession(id)?.bonuses||{};
    const k=PROFESSION_SOURCE_KEYS.base;
    setBucket(p,'attackMultiplierBonuses',k,b.attackMultiplierBonus);
    setBucket(p,'maxHpBonuses',k,b.maxHp);
    setBucket(p,'defenseBonuses',k,b.defense);
    setBucket(p,'maxManaBonuses',k,b.maxMana);
    setBucket(p,'manaRegenPerSecondBonuses',k,b.manaRegenPerSecond);
    setBucket(p,'activeSkillDamageBonuses',k,b.activeSkillDamage);
    setBucket(p,'summonDamageBonuses',k,b.summonDamage);
    setBucket(p,'summonHealingBonuses',k,b.summonHealing);
    setBucket(p,'summonMaxHpBonuses',k,b.summonMaxHp);
    this.refreshResourceMaximums();
  }

  applyAdvanced(id){
    const p=this.scene.playerData;
    const k=PROFESSION_SOURCE_KEYS.advanced;
    if(id==='swordsman'){
      setBucket(p,'maxHpBonuses',k,70);
      setBucket(p,'defenseBonuses',k,8);
      setBucket(p,'shieldGainMultiplierBonuses',k,.25);
    }
    if(id==='blade_master'){
      setBucket(p,'allDamageMultiplierBonuses',k,.10);
      setBucket(p,'attackSpeedMultiplierBonuses',k,.10);
      setBucket(p,'critMultiplierBonuses',k,.15);
    }
    if(id==='arcanist'){
      setBucket(p,'cooldownReductionBonuses',k,.12);
      setBucket(p,'activeSkillManaCostReductionBonuses',k,.15);
    }
    if(id==='blood_demon') setBucket(p,'activeSkillDamageBonuses',k,.15);
    if(id==='spirit_horde_master'){
      setBucket(p,'summonMaxHpBonuses',k,.20);
      setBucket(p,'summonDamageBonuses',k,.10);
      setBucket(p,'summonHealingBonuses',k,.10);
    }
    if(id==='summon_commander') setBucket(p,'summonActionSpeedBonuses',k,.20);
    this.refreshResourceMaximums();
  }

  selectProfession(id){
    const cfg=getProfession(id);
    const p=this.scene.playerData;
    if(!cfg) return false;
    const weapon=p.weaponId;
    this.reset();
    p.professionId=id;
    p.professionState=cloneState();
    p.summonContractSkillId=null;
    this.applyBase(id);
    this.bind();
    this.refreshSummonContract();
    if(p.weaponId!==weapon) throw new Error('profession changed weaponId');
    this.scene.runStats?.setProfession?.(id);
    this.scene.eventBus.emit(CombatEvents.PROFESSION_CHOSEN,{professionId:id,profession:cfg});
    this.scene.hud?.update();
    return true;
  }

  selectAdvancedProfession(id){
    const cfg=getAdvancedProfession(id);
    const p=this.scene.playerData;
    if(!cfg||cfg.base!==p.professionId||p.advancedProfessionId) return false;
    p.advancedProfessionId=id;
    this.applyAdvanced(id);
    this.scene.eventBus.emit(CombatEvents.PROFESSION_CHOSEN,{professionId:id,advanced:true,profession:cfg});
    this.scene.hud?.update();
    return true;
  }

  bind(){
    this.unsubs.push(this.scene.eventBus.on(CombatEvents.SKILL_CAST_COMPLETED,e=>this.onCompletedCast(e)));
    this.unsubs.push(this.scene.eventBus.on(CombatEvents.UPGRADE_CHOSEN,()=>{
      this.refreshSummonContract();
      this.scene.hud?.update?.();
      if(this.scene.playerInfoPanel?.isOpen) this.scene.playerInfoPanel.render();
    }));
    this.wrapStatusEffects();
    this.wrapCombatDamage();
  }

  normalizeStatusOptions(type,options={}){
    const sourceSkillId=options.sourceSkillId||options.skillId||options.poisonMeta?.sourceSkillId;
    const skill=sourceSkillId&&SKILLS[sourceSkillId];
    const statusTag=type==='POISON'?TAGS.POISON:(type==='BURN'?TAGS.FIRE:null);
    if(!skill||!statusTag) return options;
    const summon=skill.tags?.includes(TAGS.SUMMON);
    return {
      ...options,
      isDebuff:true,
      debuffCategory:options.debuffCategory||'damage',
      sourceOwner:options.sourceOwner||(summon?'summon':'player'),
      sourceSkillId,
      skillId:options.skillId||sourceSkillId,
      tags:mergeTags(options.tags||[],skill.tags||[],statusTag,TAGS.DOT),
      poisonMeta:type==='POISON'?{...(options.poisonMeta||{}),sourceSkillId}:options.poisonMeta
    };
  }

  wrapStatusEffects(){
    const status=this.scene.statusEffects;
    if(!status?.add) return;
    const original=status.add;
    const owner=this;
    const wrapped=function(type,target,options={}){
      return original.call(status,type,target,owner.normalizeStatusOptions(type,options));
    };
    status.add=wrapped;
    this.unsubs.push(()=>{ if(status.add===wrapped) status.add=original; });
  }

  summonEntityForSkill(skillId){
    if(skillId==='parasitic_gu') return this.scene.parasiticGuRuntime?.first?.()||null;
    if(skillId==='poison_king') return this.scene.poisonKingRuntime?.get?.()||null;
    return null;
  }

  wrapCombatDamage(){
    const combat=this.scene.combatSystem;
    if(!combat?.damageEnemy) return;
    const original=combat.damageEnemy;
    const owner=this;
    const wrapped=function(enemy,amount,meta={}){
      let nextAmount=amount;
      let nextMeta=meta;
      const skill=SKILLS[meta.skillId];
      const tags=mergeTags(meta.tags||[],skill?.tags||[]);
      if(tags.includes(TAGS.SUMMON)){
        const rule=getSummonProfessionRule(meta.skillId);
        const direct=meta.summonDirectSingleTarget===true||(meta.summonDirectSingleTarget!==false&&!tags.includes('area')&&!tags.includes(TAGS.DOT)&&rule?.supportsCommanderSplash===true);
        nextMeta={...meta,tags,sourceOwner:meta.sourceOwner||'summon',summonDirectSingleTarget:direct};
        if(direct&&meta.professionApplied===true&&Number(meta.baseAmountBeforeProfession)>0){
          const entity=owner.summonEntityForSkill(meta.skillId);
          const native=Number(entity?.professionNativeStats?.attack);
          const finalAttack=Number(entity?.attack);
          if(native>0&&Number.isFinite(finalAttack)){
            const adjustedBase=Math.max(0,Math.round(Number(meta.baseAmountBeforeProfession)*(finalAttack/native)));
            const professionMultiplier=Number.isFinite(Number(meta.professionMultiplier))?Number(meta.professionMultiplier):1;
            nextMeta.baseAmountBeforeProfession=adjustedBase;
            nextAmount=Math.round(adjustedBase*professionMultiplier);
          }
        }
        const contractDamage=owner.summonCreatureContractMultiplier(meta.skillId,'damageMultiplier');
        if(contractDamage!==1&&nextMeta.summonContractDamageApplied!==true&&nextMeta.professionSplash!==true){
          if(nextMeta.professionApplied===true&&Number.isFinite(Number(nextMeta.baseAmountBeforeProfession))){
            const adjustedBase=Math.max(0,Math.round(Number(nextMeta.baseAmountBeforeProfession)*contractDamage));
            const professionMultiplier=Number.isFinite(Number(nextMeta.professionMultiplier))?Number(nextMeta.professionMultiplier):1;
            nextMeta={...nextMeta,baseAmountBeforeProfession:adjustedBase,summonContractDamageApplied:true};
            nextAmount=Math.round(adjustedBase*professionMultiplier);
          }else{
            nextMeta={...nextMeta,summonContractDamageApplied:true};
            nextAmount=Math.max(0,Math.round(Number(nextAmount)*contractDamage));
          }
        }
      }
      return original.call(combat,enemy,nextAmount,nextMeta);
    };
    combat.damageEnemy=wrapped;
    this.unsubs.push(()=>{ if(combat.damageEnemy===wrapped) combat.damageEnemy=original; });
  }

  onCompletedCast(e){
    const p=this.scene.playerData;
    const ctx=e?.ctx||{};
    if(p.advancedProfessionId!=='arcanist'||!ctx.isActiveSkill||ctx.fromMyriadAfterimage||ctx.isFreeCast||ctx.isCopiedCast||ctx.isExtraCast||Number(ctx.effectiveManaCost)<=0) return;
    this.scene.skillSystem?.recoverMana?.(2);
  }

  refreshSummonContract(){
    const p=this.scene.playerData;
    const next=p?.professionId==='summoner'
      ?(p.skills||[]).find(item=>getSummonCreatureContract(item?.id))?.id||null
      :null;
    p.summonContractSkillId=next;
    p.professionState??=cloneState();
    p.professionState.summonContractSkillId=next;
    return next;
  }

  bindSummonContract(skillId=null){
    const active=this.refreshSummonContract();
    return skillId===null?active===null:skillId===active;
  }

  summonContract(){ return this.refreshSummonContract(); }
  summonCreatureContract(skillId=this.summonContract()){
    return skillId&&this.summonContract()===skillId?getSummonCreatureContract(skillId):null;
  }
  summonCreatureContractMultiplier(skillId,key){
    const value=Number(this.summonCreatureContract(skillId)?.[key]);
    return Number.isFinite(value)&&value>0?value:1;
  }

  getGeneralDamageMultiplier(source={}){
    const p=this.scene.playerData;
    let bonus=sumRuntimeBonuses(p.allDamageMultiplierBonuses);
    if(p.advancedProfessionId==='berserker') bonus+=berserkerDamageBonus(p.maxHp);
    if((source.tags||[]).includes(TAGS.SUMMON)) bonus+=sumRuntimeBonuses(p.summonDamageBonuses);
    return 1+bonus;
  }

  getTargetDamageMultiplier(target){ return this.scene.playerData.advancedProfessionId==='curse_master'&&this.hasPlayerDebuff(target)?1.12:1; }
  getDamageMultiplier(source={},target=null){ return this.getGeneralDamageMultiplier(source)*this.getTargetDamageMultiplier(target); }
  activeSkillDamageMultiplier(){ return 1+sumRuntimeBonuses(this.scene.playerData.activeSkillDamageBonuses); }
  attackMultiplier(){ return 1+sumRuntimeBonuses(this.scene.playerData.attackMultiplierBonuses); }
  cooldownReduction(){ return sumRuntimeBonuses(this.scene.playerData.cooldownReductionBonuses); }
  manaCostMultiplier(){ return 1-sumRuntimeBonuses(this.scene.playerData.activeSkillManaCostReductionBonuses); }
  shieldGain(amount,{ordinary=true}={}){ return ordinary?Math.round(amount*(1+sumRuntimeBonuses(this.scene.playerData.shieldGainMultiplierBonuses))):amount; }

  onDamageDealt(actual,meta={}){
    const p=this.scene.playerData;
    if(p.advancedProfessionId!=='blood_demon'||actual<=0||meta.noProfessionLifeSteal) return;
    const tags=meta.tags||[];
    const skillId=meta.skillId||meta.sourceSkillId;
    const skill=SKILLS[skillId];
    const explicitDot=meta.statusId!==undefined||meta.source==='burn'||meta.source==='poison'||meta.isDot===true||meta.periodic===true;
    const poisonNeedleDirect=meta.source==='skill'&&skillId==='poison_cloud'&&!explicitDot;
    const dot=!poisonNeedleDirect&&(explicitDot||tags.includes(TAGS.DOT));
    const direct=!dot&&skill?.passive!==true&&!!skill;
    if(!dot&&!direct) return;
    if(dot&&!skillId) return;
    if(tags.includes(TAGS.SUMMON)||meta.sourceOwner==='summon'||['attack','normalAttack','reflect','environment'].includes(meta.source)) return;
    const raw=actual*(dot?.01:.05)+(dot?(p.professionState.dotLifeStealRemainder||0):0);
    const heal=dot?Math.floor(raw):raw;
    if(dot) p.professionState.dotLifeStealRemainder=raw-Math.floor(raw);
    if(heal>=1) this.scene.healPlayer?.(heal,'profession_lifesteal',{noProfessionLifeSteal:true});
  }

  debuffDuration(duration,target,meta={}){
    if(this.scene.playerData.advancedProfessionId!=='curse_master') return duration;
    if(meta.debuffCategory==='control'&&target?.isBoss&&target?.controlImmune&&meta.hardControl===true) return duration;
    return Math.round(duration*1.25);
  }

  hasPlayerDebuff(target){
    if(!target) return false;
    const status=this.scene.statusEffects?.getEffects?.(target)?.some(e=>e.isDebuff===true&&e.playerApplied===true&&['player','summon'].includes(e.sourceOwner));
    const external=[...(target.coldSources?.values?.()||[]),...(target.gravitySources?.values?.()||[]),...(target.playerDebuffs?.values?.()||[])].some(e=>e?.isDebuff===true&&['player','summon'].includes(e.sourceOwner));
    return !!(status||external);
  }

  summonModifiers(skill={}){
    const p=this.scene.playerData;
    const rule=getSummonProfessionRule(skill.id)||skill;
    const mode=rule.professionCountMode||'none';
    const entity=rule.summonEntityType==='entity';
    return {
      countBonus:p.advancedProfessionId==='spirit_horde_master'&&entity&&mode==='extra'?1:0,
      uniqueEffectMultiplier:p.advancedProfessionId==='spirit_horde_master'&&mode==='unique'?1.2:1,
      maxHpMultiplier:entity?1+sumRuntimeBonuses(p.summonMaxHpBonuses):1,
      damageMultiplier:1+sumRuntimeBonuses(p.summonDamageBonuses),
      healingMultiplier:1+sumRuntimeBonuses(p.summonHealingBonuses),
      actionSpeedMultiplier:1+sumRuntimeBonuses(p.summonActionSpeedBonuses),
      inheritance:p.advancedProfessionId==='symbiosis_master'?{
        attack:getEffectiveAttack(p)*.20,
        defense:getEffectiveDefense(p)*.20,
        maxHp:p.maxHp*.15,
        attackSpeedBonus:Math.max(0,(p.attackSpeedMultiplier+sumRuntimeBonuses(p.attackSpeedMultiplierBonuses))-1)*.30
      }:null
    };
  }

  summonCount(skillId,baseCount){ return Math.max(0,Math.floor(baseCount+(this.summonModifiers({id:skillId}).countBonus||0))); }

  summonSupportModifier(skillId,modifier={}){
    const professionMultiplier=this.summonModifiers({id:skillId}).uniqueEffectMultiplier||1;
    const contractMultiplier=this.summonCreatureContractMultiplier(skillId,'supportMultiplier');
    const multiplier=professionMultiplier*contractMultiplier;
    if(multiplier===1) return modifier;
    return {
      ...modifier,
      powerBonus:(modifier.powerBonus||0)*multiplier,
      maxHpBonus:(modifier.maxHpBonus||0)*multiplier,
      damageReduction:Math.min(.8,(modifier.damageReduction||0)*multiplier),
      actionSpeedBonus:(modifier.actionSpeedBonus||0)*multiplier,
      healingReceivedBonus:(modifier.healingReceivedBonus||0)*multiplier
    };
  }

  applyEntitySummonStats(entity,skillId,{
    baseAttack=entity?.baseAttack??entity?.professionNativeStats?.attack??entity?.attack??0,
    baseDefense=entity?.baseDefense??entity?.professionNativeStats?.defense??entity?.defense??0,
    baseMaxHp=entity?.baseMaxHp??entity?.professionNativeStats?.maxHp??entity?.maxHp??1
  }={}){
    if(!entity) return entity;
    const rule=getSummonProfessionRule(skillId);
    if(rule?.summonEntityType!=='entity') return entity;
    entity.professionNativeStats={attack:Number(baseAttack)||0,defense:Number(baseDefense)||0,maxHp:Math.max(1,Number(baseMaxHp)||1)};
    const base=entity.professionNativeStats;
    const mod=this.summonModifiers({id:skillId});
    const inherit=mod.inheritance||{};
    const unique=mod.uniqueEffectMultiplier||1;
    const slime=this.scene.spiritSlimeRuntime?.getModifier?.(entity)||{};
    const contractMaxHp=this.summonCreatureContractMultiplier(skillId,'maxHpMultiplier');
    const oldMax=Math.max(1,Number(entity.maxHp)||1);
    const ratio=Math.max(0,Number(entity.hp)||0)/oldMax;
    entity.attack=Math.max(0,Math.round((base.attack+(inherit.attack||0))*(rule.primaryEffect==='attack'?unique:1)));
    entity.defense=Math.max(0,Math.round(base.defense+(inherit.defense||0)));
    entity.maxHp=Math.max(1,Math.round((base.maxHp+(inherit.maxHp||0))*mod.maxHpMultiplier*unique*contractMaxHp*(1+(slime.maxHpBonus||0))));
    entity.hp=entity.hp>0?Math.max(1,Math.min(entity.maxHp,Math.round(entity.maxHp*ratio))):0;
    entity.professionAttackSpeedBonus=inherit.attackSpeedBonus||0;
    entity.professionActionSpeedMultiplier=mod.actionSpeedMultiplier;
    entity.professionPrimaryEffectMultiplier=unique;
    return entity;
  }

  summonActionInterval(skillId,baseInterval,entity=null){
    const rule=getSummonProfessionRule(skillId);
    const mod=this.summonModifiers({id:skillId});
    const professionSpeed=rule?.supportsActionSpeed===false?1:mod.actionSpeedMultiplier;
    const speed=professionSpeed*(1+(entity?.professionAttackSpeedBonus||0));
    const contractInterval=this.summonCreatureContractMultiplier(skillId,'actionIntervalMultiplier');
    return Math.max(1,Math.round(baseInterval*contractInterval/speed));
  }

  summonHealing(skillId,amount){
    const mod=this.summonModifiers({id:skillId});
    const contractHealing=this.summonCreatureContractMultiplier(skillId,'healingMultiplier');
    return Math.max(0,Math.round(amount*mod.healingMultiplier*(mod.uniqueEffectMultiplier||1)*contractHealing));
  }

  applySummonSplash(impact,actualDamage,meta={}){
    const tags=meta.tags||[];
    const rule=getSummonProfessionRule(meta.skillId);
    const direct=meta.summonDirectSingleTarget===true||(meta.summonDirectSingleTarget!==false&&tags.includes(TAGS.SUMMON)&&!tags.includes('area')&&!tags.includes(TAGS.DOT)&&rule?.supportsCommanderSplash===true);
    if(this.scene.playerData.advancedProfessionId!=='summon_commander'||!direct||meta.professionSplash||actualDamage<=0) return 0;
    const targets=this.scene.targeting?.all?.()||[];
    let hits=0;
    for(const enemy of targets){
      if(enemy===impact.target||Math.hypot(enemy.x-impact.x,enemy.y-impact.y)>100) continue;
      const amount=Math.max(1,Math.round(actualDamage*.2));
      if(this.scene.combatSystem?.damageEnemy?.(enemy,amount,{
        source:'skill',
        skillId:meta.skillId,
        damageKind:'professionSummonSplash',
        tags:[TAGS.SUMMON,'area'],
        damageAlreadyResolved:true,
        professionApplied:true,
        professionMultiplier:1,
        baseAmountBeforeProfession:amount,
        professionSplash:true,
        summonDirectSingleTarget:false,
        sourceOwner:'summon',
        allowLifeSteal:false,
        canTriggerArtifacts:false,
        noKnockback:true
      })) hits++;
    }
    return hits;
  }

  reset(){
    this.unsubs.splice(0).forEach(off=>off?.());
    const p=this.scene.playerData;
    if(!p) return;
    this.clearSource(PROFESSION_SOURCE_KEYS.base);
    this.clearSource(PROFESSION_SOURCE_KEYS.advanced);
    p.professionId=null;
    p.advancedProfessionId=null;
    p.summonContractSkillId=null;
    p.professionState=cloneState();
    this.refreshResourceMaximums();
  }

  shiftTimers(){}
  destroy(){ this.reset(); }
}
