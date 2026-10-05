import { UNCROWNED_KING_TUNING as KING } from '../../config/enemies.js';

const alive = e => e?.active && !e.isDefeated;
const valid = target => target?.isAlive?.() && target.active!==false && !target.isDefeated;
const skillStates = new Set(['thrustWindup','thrust','thrustEnd','cleaveWindup','cleaveStrike',
  'rainWindup','rain','shadowWindup','shadow','shadowAttackWindup','shadowAttackRecovery']);
const ordinaryWindups = new Set(['attackWindup','shadowAttackWindup']);

// Normal-mode Boss 3: independent skill clocks, one action at a time.
export default class UncrownedKingBehavior {
  constructor(scene,enemy,helpers) {
    this.scene=scene;this.e=enemy;this.h=helpers;
    const t=scene.getGameplayTime?.()||0;
    for(const skill of ['Thrust','Cleave','Rain','Shadow'])this['next'+skill]=t+KING[skill.toLowerCase()+'First'];
    this.nextAttack=0;this.until=0;this.nextStrike=0;this.strikes=0;
    this.state='idle';this.direction=-1;this.point=null;
    this.spears=[];this.impacts=[];this.effectUntil=0;
    this.graphics=scene.add.graphics().setDepth(23);
    enemy.uncrownedShadowUntil=0;this.setState('idle');
  }
  live() { return alive(this.e)&&!!this.graphics&&!this.scene.isGameplayPaused?.(); }
  shadowActive(t=this.scene.getGameplayTime?.()||0) { return this.e.uncrownedShadowUntil>t; }
  delay(ms,t) { return this.h.getEnemyAttackDelay(this.e,ms,t); }
  setState(state) {
    this.state=state;const e=this.e;
    e.behaviorState=e.attackState=state;e.bossSkillKnockbackImmune=skillStates.has(state);
    e.casting=e.isCasting=skillStates.has(state);e.skillActive=skillStates.has(state);
    e.charging=e.isCharging=e.dashing=e.isDashing=false;
  }
  finishRecovery(t) {
    if(['recovery','attackRecovery'].includes(this.state)&&t>=this.until)this.setState('idle');
    else if(this.state==='shadowAttackRecovery'&&t>=this.until)this.setState('shadow');
  }
  readySkill(t) {
    if(!['idle','attackWindup','attackRecovery'].includes(this.state)||this.spears.length||this.shadowActive(t))return false;
    const due=['Thrust','Cleave','Rain','Shadow'].filter(name=>t>=this['next'+name])
      .sort((a,b)=>this['next'+a]-this['next'+b]);
    for(const name of due) {
      const skill=name.toLowerCase(),range=skill==='thrust'?KING.thrustRange:skill==='cleave'?KING.cleaveRange:Infinity;
      const target=this.h.chooseAnyTarget(this.scene,this.e,range);
      if(!valid(target))continue;
      this.direction=Math.sign(target.x-this.e.x)||-1;
      this.point=skill==='rain'?{x:target.x,y:target.y}:null;
      this.setState(skill+'Windup');this.until=t+KING[skill+'Windup'];this.effectUntil=0;
      this.scene.combatSystem?.clearKnockback?.(this.e);this.e.body?.setVelocityX?.(0);return true;
    }
    return false;
  }
  updateWhileKnockedBack(t) { if(this.live()){this.finishRecovery(t);this.readySkill(t);} }
  recover(t,ms) {
    this.setState('recovery');this.until=t+ms;this.nextAttack=Math.max(this.nextAttack,this.until);
    this.e.body?.setVelocityX?.(0);
  }
  stab(t,shadow=false) {
    const e=this.e,target=this.h.chooseTarget(this.scene,e,e.attackRange);
    if(!valid(target)||Math.hypot(target.x-e.x,target.y-e.y)>e.attackRange) {
      this.setState(shadow?'shadow':'idle');this.until=0;return;
    }
    this.direction=Math.sign(target.x-e.x)||this.direction;this.effectUntil=t+KING.effectMs;
    this.nextAttack=t+this.delay(e.attackIntervalMs,t);
    this.setState(shadow?'shadowAttackRecovery':'attackRecovery');this.until=t+KING.attackRecovery;
    this.h.targetDamage(this.scene,target,e,e.damage,
      {source:'uncrownedKingStab',attackType:'melee',knockbackDistance:0});
  }
  thrust(t,first=false) {
    const e=this.e,target=this.h.chooseTarget(this.scene,e,KING.thrustRange);
    const legal=valid(target)&&Math.hypot(target.x-e.x,target.y-e.y)<=KING.thrustRange;
    if(first&&!legal){this.setState('idle');this.until=0;return;} // Failed first cast spends no cooldown.
    if(first){this.strikes=0;this.nextThrust=t+this.delay(KING.thrustCooldown,t);}
    this.strikes++;this.nextStrike=t+KING.thrustInterval; // Never catch up several melee hits in one frame.
    this.effectUntil=t+KING.effectMs;
    this.setState(this.strikes>=KING.thrustCount?'thrustEnd':'thrust');this.until=this.effectUntil;
    if(!legal)return; // Later empty thrusts have their own range check and do not hurt stale targets.
    this.direction=Math.sign(target.x-e.x)||this.direction;
    this.h.targetDamage(this.scene,target,e,Math.max(1,Math.round(e.damage*KING.thrustDamageMultiplier)),
      {source:'uncrownedKingThrust',attackType:'melee',knockbackDistance:0});
  }
  cleave(t) {
    const e=this.e,x=e.x,y=e.y,dir=this.direction;
    this.nextCleave=t+this.delay(KING.cleaveCooldown,t);this.effectUntil=t+KING.effectMs;
    this.setState('cleaveStrike');this.until=this.effectUntil;
    for(const target of this.scene.combatSystem.getAttackableTargets(e).filter(valid)) {
      if(!this.live())break;
      const forward=(target.x-x)*dir;
      if(valid(target)&&forward>=0&&forward<=KING.cleaveRange&&Math.abs(target.y-y)<=KING.cleaveHeight)
        this.h.targetDamage(this.scene,target,e,Math.max(1,Math.round(e.damage*KING.cleaveDamageMultiplier)),
          {source:'uncrownedKingCleave',attackType:'melee',singleTarget:false,
            knockbackDistance:KING.cleaveKnockback,knockbackDirection:dir});
    }
  }
  rain(t) {
    if(!this.point){this.setState('idle');return;}
    const point=this.point;this.point=null;this.spears=[];
    for(let batch=0;batch<KING.rainBatches;batch++)for(const offset of KING.rainOffsets) {
      const warnAt=t+batch*KING.rainBatchInterval,fallAt=warnAt+KING.rainWarning;
      this.spears.push({x:point.x+offset,y:point.y,warnAt,fallAt,landAt:fallAt+KING.rainFall,
        damage:Math.max(1,Math.round(this.e.damage*KING.rainDamageMultiplier))});
    }
    this.nextRain=t+this.delay(KING.rainCooldown,t);this.setState('rain');
  }
  enterShadow(t) {
    this.nextShadow=t+this.delay(KING.shadowCooldown,t);
    this.e.uncrownedShadowUntil=t+KING.shadowDuration;this.setState('shadow');
    this.e.setAlpha?.(.3);this.effectUntil=0;
  }
  advanceEffects(t) {
    if(!this.live())return;
    if(this.e.uncrownedShadowUntil&&t>=this.e.uncrownedShadowUntil) {
      this.e.uncrownedShadowUntil=0;this.e.setAlpha?.(1);this.effectUntil=0;
      this.recover(t,KING.shadowRecovery);
    }
    this.impacts=this.impacts.filter(p=>p.endAt>t);
    const due=this.spears.filter(p=>t>=p.landAt);
    this.spears=this.spears.filter(p=>t<p.landAt); // Consume every scheduled spear before callbacks.
    if(due.length&&this.spears.length===0)this.recover(t,KING.rainRecovery);
    for(const point of due) {
      if(!this.live())break;
      this.impacts.push({...point,endAt:t+KING.effectMs});
      for(const target of this.scene.combatSystem.getAttackableTargets(this.e).filter(valid)) {
        if(!this.live())break;
        if(valid(target)&&Math.hypot(target.x-point.x,target.y-point.y)<=KING.rainRadius)
          this.h.targetDamage(this.scene,target,this.e,point.damage,
            {source:'uncrownedKingRain',attackType:'ground',dodgeable:false,singleTarget:false,knockbackDistance:0});
      }
    }
    if(due.length)this.syncVisual();
  }
  update(t) {
    if(!this.live())return;
    this.advanceEffects(t);if(!this.live())return;
    this.finishRecovery(t);if(this.readySkill(t)){this.syncVisual();return;}
    const e=this.e,s=this.scene;
    if(this.state==='idle'||this.state==='shadow') {
      const shadow=this.state==='shadow';this.h.approach(s,e,e.attackRange);
      const target=this.h.chooseTarget(s,e,e.attackRange);
      if(t>=this.nextAttack&&valid(target)) {
        this.direction=Math.sign(target.x-e.x)||-1;this.setState(shadow?'shadowAttackWindup':'attackWindup');
        this.until=t+KING.attackWindup;e.body?.setVelocityX?.(0);
      }
    } else {
      e.body?.setVelocityX?.(0);
      if(this.state==='thrust'&&t>=this.nextStrike)this.thrust(t);
      else if(t>=this.until) {
        if(this.state==='thrustWindup')this.thrust(t,true);
        else if(this.state==='thrustEnd')this.recover(t,KING.thrustRecovery);
        else if(this.state==='cleaveWindup')this.cleave(t);
        else if(this.state==='cleaveStrike')this.recover(t,KING.cleaveRecovery);
        else if(this.state==='rainWindup')this.rain(t);
        else if(this.state==='shadowWindup')this.enterShadow(t);
        else if(ordinaryWindups.has(this.state))this.stab(t,this.state==='shadowAttackWindup');
      }
    }
    this.syncVisual();
  }
  syncVisual() {
    const g=this.graphics,e=this.e;if(!g)return;
    g.clear();if(!alive(e))return;
    const t=this.scene.getGameplayTime?.()||0,dir=this.direction,wind=this.state.endsWith('Windup');
    const shade=this.shadowActive(t),alpha=shade?0.4:1;
    e.setFillStyle?.(wind?0x555767:e.baseColor);
    const y=e.y-16,handX=e.x+dir*(wind?-5:24),extended=t<this.effectUntil;
    const tipX=extended?e.x+dir*KING.thrustRange:handX+dir*142;
    g.lineStyle(5,0x8b7757,alpha).lineBetween(handX-dir*28,y,tipX,y);
    g.lineStyle(4,0xd6d9e0,alpha).lineBetween(tipX-dir*20,y-9,tipX,y).lineBetween(tipX,y,tipX-dir*20,y+9);
    const crownY=e.y-e.height/2+22; // Keep the crown on the helmet, below the shared status row.
    g.lineStyle(4,0xe0bb64,alpha).lineBetween(e.x-22,crownY,e.x-22,crownY-15)
      .lineBetween(e.x-22,crownY-15,e.x-10,crownY-7).lineBetween(e.x-10,crownY-7,e.x,crownY-22)
      .lineBetween(e.x,crownY-22,e.x+10,crownY-7).lineBetween(e.x+10,crownY-7,e.x+22,crownY-15)
      .lineBetween(e.x+22,crownY-15,e.x+22,crownY).lineBetween(e.x+22,crownY,e.x-22,crownY);
    if(extended&&this.state==='cleaveStrike')g.lineStyle(7,0xe5d3b3,.9)
      .lineBetween(e.x+dir*35,e.y-110,e.x+dir*KING.cleaveRange,e.y+40);
    else if(extended)g.lineStyle(5,0xe7eaf3,alpha).lineBetween(e.x+dir*35,y,tipX,y);
    for(const p of this.spears)if(t>=p.warnAt) {
      g.lineStyle(3,0xd5b97b,.85).strokeCircle(p.x,p.y,KING.rainRadius);
      if(t>=p.fallAt) {
        const u=Math.min(1,(t-p.fallAt)/KING.rainFall),tipY=p.y-220*(1-u);
        g.lineStyle(4,0xd8dcea,1).lineBetween(p.x,tipY-100,p.x,tipY)
          .lineBetween(p.x-7,tipY-14,p.x,tipY).lineBetween(p.x,tipY,p.x+7,tipY-14);
      }
    }
    for(const p of this.impacts)g.lineStyle(5,0xf6dea5,.9).strokeCircle(p.x,p.y,KING.rainRadius);
    if(shade)g.lineStyle(5,0x62637e,.7).strokeCircle(e.x,e.y+e.height/2-10,38);
  }
  interrupt() {
    this.effectUntil=0;
    if(this.state==='attackWindup'){this.setState('idle');this.until=0;}
    this.syncVisual();
  }
  onRecycle() {
    const t=this.scene.getGameplayTime?.()||0;
    if(this.shadowActive(t))this.setState('shadow'); // Preserve remaining duration, never renew it.
    else if(this.spears.length)this.setState('rain'); // Released warnings keep their world coordinates.
    else if(skillStates.has(this.state))this.recover(t,KING.shadowRecovery);
    else if(this.state==='attackWindup')this.setState('idle');
    this.point=null;this.effectUntil=0;this.strikes=0;this.direction=-1;this.graphics?.clear();
  }
  shiftTimers(delta,after) {
    for(const key of ['nextThrust','nextCleave','nextRain','nextShadow','nextAttack','until','nextStrike','effectUntil'])
      if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
    if(this.e.uncrownedShadowUntil>0&&this.e.uncrownedShadowUntil>after)this.e.uncrownedShadowUntil+=delta;
    for(const p of this.spears)for(const key of ['warnAt','fallAt','landAt'])p[key]+=delta;
    for(const p of this.impacts)p.endAt+=delta;
  }
  pause() {this.e.body?.setVelocityX?.(0);}
  resume() {}
  destroy() {
    this.e.uncrownedShadowUntil=0;this.e.setAlpha?.(1);this.e.setFillStyle?.(this.e.baseColor);
    this.point=null;this.spears=[];this.impacts=[];this.effectUntil=0;this.strikes=0;
    this.graphics?.destroy();this.graphics=null;this.setState('idle');this.e.body?.setVelocityX?.(0);
  }
}
