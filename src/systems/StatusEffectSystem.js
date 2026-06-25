import { TAGS } from '../config/tags.js';
import { CombatEvents } from '../core/CombatEvents.js';

export const StatusEffects = Object.freeze({ BURN:'BURN', POISON:'POISON', DAMAGE_REDUCTION:'DAMAGE_REDUCTION', SHIELD:'SHIELD' });

export default class StatusEffectSystem {
  constructor(scene){ this.scene=scene; this.effects=new Map(); this.nextId=1; }

  reset(){
    this.effects.clear();
    this.nextId=1;
    const p=this.scene.playerData;
    if(p){ p.temporaryDamageReduction=0; p.shield=0; p.permanentShield=0; }
  }

  shiftTimers(pausedDuration, pausedAt){
    this.effects.forEach(e=>{
      if(e.expiresAt>pausedAt) e.expiresAt+=pausedDuration;
      if(e.nextTickAt&&e.nextTickAt>pausedAt) e.nextTickAt+=pausedDuration;
    });
  }

  emit(event, payload){ this.scene.eventBus?.emit?.(event,payload); }

  add(type,target,options={}){
    const { sourceId='', durationMs=1000, intervalMs=0, stacks=1, value=0, maxStacks=5 }=options;
    if(!target) return null;
    const now=this.scene.getGameplayTime();
    const shieldKey=type===StatusEffects.SHIELD?`${sourceId || 'shield'}:${this.nextId}`:sourceId;
    const old=type===StatusEffects.SHIELD?null:[...this.effects.values()].find(e=>e.type===type&&e.target===target&&e.sourceId===sourceId);
    if(old){
      const previousStacks=old.stacks||1;
      old.durationMs=durationMs;
      old.expiresAt=now+durationMs;
      old.stacks=Math.min(maxStacks,previousStacks+stacks);
      old.value=value||old.value;
      const { stacks:_ignoredStacks, ...restOptions }=options;
      Object.assign(old, restOptions);
      if(old.stacks!==previousStacks){
        this.emit(CombatEvents.STATUS_STACK_CHANGED,{ effect:old, target, type, previousStacks, stacks:old.stacks, delta:old.stacks-previousStacks, sourceId:old.sourceId });
      }
      this.syncPlayerDerived();
      return old;
    }

    const e={ id:this.nextId++, type, target, sourceId:shieldKey, durationMs, expiresAt:now+durationMs, nextTickAt:intervalMs?now+intervalMs:0, intervalMs, stacks, value, ...options };
    if(type===StatusEffects.SHIELD){
      const p=this.scene.playerData;
      const room=Math.max(0,p.maxShield-(p.shield||0));
      e.remainingValue=Math.min(room,Math.max(0,options.remainingValue ?? value));
      e.initialValue=e.remainingValue;
      e.absorbedTotal=0;
      if(e.remainingValue<=0) return null;
    }
    this.effects.set(e.id,e);
    this.emit(CombatEvents.STATUS_APPLIED,{ effect:e, target, type, stacks:e.stacks||1, sourceId:e.sourceId });
    if(type===StatusEffects.SHIELD){
      this.emit(CombatEvents.SHIELD_GAINED,{ effect:e, target, amount:e.remainingValue, initialValue:e.initialValue, sourceId:e.sourceId });
    }
    this.syncPlayerDerived();
    return e;
  }

  update(time){
    if(this.scene.isGameplayPaused?.()) return;
    this.effects.forEach(e=>{
      if(!this.validTarget(e.target)){
        this.removeEffect(e,'invalidTarget');
        return;
      }
      if(e.intervalMs){
        while(time>=e.nextTickAt && time<e.expiresAt && this.validTarget(e.target)){
          const source=e.type===StatusEffects.BURN?'burn':'poison';
          const amount=Math.round(e.value*(e.stacks||1)*(e.damageMultiplier||1));
          const hpBefore=e.target.hp;
          this.scene.combatSystem.damageEnemy(e.target,amount,{ source, tags:[source,TAGS.DOT], canTriggerArtifacts:false, statusId:e.id, professionApplied:!!e.professionApplied, professionMultiplier:e.professionMultiplier||1, baseAmountBeforeProfession:Math.round(e.value*(e.stacks||1)*(e.baseDamageMultiplierWithoutProfession||e.damageMultiplier||1)) });
          const actualDamage=Math.max(0,hpBefore-(e.target.hp||0));
          this.emit(CombatEvents.STATUS_TICK,{ effect:e, statusId:e.id, target:e.target, type:e.type, source, sourceId:e.sourceId, stacks:e.stacks||1, attemptedDamage:amount, actualDamage, killed:e.target.hp<=0 });
          e.nextTickAt+=e.intervalMs;
        }
      }
      if(time>=e.expiresAt || (e.type===StatusEffects.SHIELD && e.remainingValue<=0)){
        if(e.type===StatusEffects.BURN&&e.burnBurst) this.triggerBurnBurst(e);
        this.removeEffect(e,time>=e.expiresAt?'expired':'depleted');
      }
    });
    this.syncPlayerDerived();
  }

  validTarget(t){ return t===this.scene.playerData || this.scene.targeting?.valid(t); }

  triggerBurnBurst(e){
    const target=e.target;
    const radius=e.burnBurstRadius||80;
    const damage=e.burnBurstDamage||0;
    if(!target||damage<=0) return;
    this.scene.targeting?.all?.().filter(x=>x!==target&&Math.hypot(x.x-target.x,x.y-target.y)<=radius).forEach(x=>this.scene.combatSystem.damageEnemy(x,damage,{source:'burn_burst',tags:[TAGS.FIRE,TAGS.DOT],noDeathExplosion:true,professionApplied:!!e.professionApplied,professionMultiplier:e.professionMultiplier||1,baseAmountBeforeProfession:damage}));
  }

  removeEffect(effect,reason='removed'){
    if(!effect||!this.effects.has(effect.id)) return false;
    this.effects.delete(effect.id);
    this.emit(CombatEvents.STATUS_REMOVED,{ effect, target:effect.target, type:effect.type, sourceId:effect.sourceId, reason });
    return true;
  }

  clearTarget(target){
    [...this.effects.values()].forEach(e=>{
      if(e.target!==target) return;
      if(e.type===StatusEffects.BURN&&e.burnBurst) this.triggerBurnBurst(e);
      this.removeEffect(e,'targetCleared');
    });
    this.syncPlayerDerived();
  }

  clearNegativeEffects(target){
    [...this.effects.values()].forEach(e=>{
      if(e.target===target&&(e.type===StatusEffects.BURN||e.type===StatusEffects.POISON)) this.removeEffect(e,'cleansed');
    });
    this.syncPlayerDerived();
  }

  has(target,type){ return this.getEffects(target,type).length>0; }
  getEffects(target,type){ return [...this.effects.values()].filter(e=>e.target===target&&e.type===type); }
  getStackCount(target,type){ return this.getEffects(target,type).reduce((sum,e)=>sum+(e.stacks||1),0); }

  setStacks(target,type,count){
    const effects=this.getEffects(target,type);
    if(!effects.length) return 0;
    const primary=effects[0];
    const previousStacks=primary.stacks||1;
    primary.stacks=Math.max(0,Math.min(primary.maxStacks||Number.MAX_SAFE_INTEGER,Math.round(count)));
    effects.slice(1).forEach(e=>this.removeEffect(e,'mergedStacks'));
    if(primary.stacks<=0) this.removeEffect(primary,'stacksConsumed');
    else if(primary.stacks!==previousStacks) this.emit(CombatEvents.STATUS_STACK_CHANGED,{ effect:primary, target, type, previousStacks, stacks:primary.stacks, delta:primary.stacks-previousStacks, sourceId:primary.sourceId });
    return Math.max(0,primary.stacks||0);
  }

  addStacks(target,type,count){ return this.setStacks(target,type,this.getStackCount(target,type)+count); }
  consumeStacks(target,type,count){
    const before=this.getStackCount(target,type);
    const after=this.setStacks(target,type,Math.max(0,before-count));
    return before-after;
  }

  transferEffect(effectId,newTarget,options={}){
    const effect=this.effects.get(effectId);
    if(!effect||!newTarget) return null;
    const remainingMs=Math.max(1,effect.expiresAt-this.scene.getGameplayTime());
    const copy={ ...effect, ...options, durationMs:options.durationMs??remainingMs, stacks:options.stacks??effect.stacks, sourceId:options.sourceId??effect.sourceId };
    delete copy.id;
    delete copy.target;
    delete copy.expiresAt;
    delete copy.nextTickAt;
    this.removeEffect(effect,'transferred');
    return this.add(effect.type,newTarget,copy);
  }

  absorbShield(damage,context={}){
    const p=this.scene.playerData;
    let remaining=damage;
    const shields=this.getEffects(p,StatusEffects.SHIELD).sort((a,b)=>a.expiresAt-b.expiresAt);
    for(const e of shields){
      if(remaining<=0) break;
      const before=e.remainingValue||0;
      const used=Math.min(before,remaining);
      e.remainingValue=before-used;
      e.absorbedTotal=(e.absorbedTotal||0)+used;
      remaining-=used;
      if(used>0) this.emit(CombatEvents.SHIELD_DAMAGED,{ effect:e, target:p, absorbed:used, remainingValue:e.remainingValue, initialValue:e.initialValue||before, absorbedTotal:e.absorbedTotal, sourceId:e.sourceId, ...context });
      if(e.remainingValue<=0){
        this.emit(CombatEvents.SHIELD_BROKEN,{ effect:e, target:p, absorbed:used, previousShield:before, remainingShield:e.remainingValue, incomingDamage:damage, remainingDamage:remaining, broken:true, initialValue:e.initialValue||before, absorbedTotal:e.absorbedTotal, sourceId:e.sourceId, ...context });
        this.removeEffect(e,'broken');
      }
    }
    if(remaining>0 && (p.permanentShield||0)>0){
      const used=Math.min(p.permanentShield,remaining);
      p.permanentShield-=used;
      remaining-=used;
    }
    this.syncPlayerDerived();
    return { absorbed:damage-remaining, remainingDamage:remaining };
  }

  addPermanentShield(amount){
    const p=this.scene.playerData;
    p.permanentShield=Math.min(p.maxShield,(p.permanentShield||0)+amount);
    this.syncPlayerDerived();
  }

  syncPlayerDerived(){
    const p=this.scene.playerData;
    if(!p) return;
    p.temporaryDamageReduction=0;
    this.effects.forEach(e=>{
      if(e.target===p&&e.type===StatusEffects.DAMAGE_REDUCTION) p.temporaryDamageReduction=Math.max(p.temporaryDamageReduction,e.value);
    });
    const temp=this.getEffects(p,StatusEffects.SHIELD).reduce((sum,e)=>sum+(e.remainingValue||0),0);
    const capped=Math.min(p.maxShield,temp+(p.permanentShield||0));
    if(temp+(p.permanentShield||0)>p.maxShield) p.permanentShield=Math.max(0,p.maxShield-temp);
    p.shield=capped;
  }
}
