import { EMPEROR_TUNING as E } from '../../config/enemies.js';
import { isGravityReversalControlled } from '../../systems/EnemyGravityControl.js';

const alive=enemy=>!!(enemy?.active&&!enemy.isDefeated&&enemy.hp>0);
const valid=target=>!!(target?.isAlive?.()&&target.active!==false&&!target.isDefeated);
const skillStates=new Set(['stabWindup','stabRelease','kickWindup','kickRelease','enchantWindup','enchantRelease']);

// Normal Boss5. Knockback immunity never implies damage or cold/gravity immunity.
export default class EmperorBehavior {
  constructor(scene,enemy,helpers) {
    this.scene=scene;this.e=enemy;this.h=helpers;this.state='idle';this.until=0;
    const t=scene.getGameplayTime?.()||0;
    for(const name of ['Stab','Kick','Enchant'])this['next'+name]=t+E[name.toLowerCase()+'First'];
    this.nextAttack=0;this.direction=-1;this.area=null;this.effect=null;this.effectUntil=0;
    this.fireUntil=0;this.fireEndPending=false;
    this.graphics=scene.add.graphics().setDepth(23);this.setState('idle');
  }
  live() {return alive(this.e)&&!!this.graphics&&!this.scene.isGameplayPaused?.();}
  delay(ms,t) {return this.h.getEnemyAttackDelay(this.e,ms,t);}
  setState(state) {
    const e=this.e;this.state=state;e.behaviorState=e.attackState=state;
    e.bossSkillKnockbackImmune=alive(e);
    e.casting=e.isCasting=e.skillActive=skillStates.has(state);
    e.charging=e.isCharging=e.dashing=e.isDashing=false;
  }
  swordDamage(t,multiplier=1) {
    return Math.max(1,Math.round(this.e.damage*multiplier*(this.fireUntil>t?E.enchantSwordMultiplier:1)));
  }
  startArea(target) {
    this.direction=Math.sign(target.x-this.e.x)||this.direction;
    this.area={x:this.e.x,y:this.e.y,direction:this.direction};
  }
  strikeTarget(area,range,height) {
    if(!area)return null;
    return this.scene.combatSystem.getAttackableTargets(this.e).filter(valid).filter(target=>{
      const forward=(target.x-area.x)*area.direction;
      return forward>=0&&forward<=range&&Math.abs(target.y-area.y)<=height;
    }).sort((a,b)=>Math.hypot(a.x-area.x,a.y-area.y)-Math.hypot(b.x-area.x,b.y-area.y))[0]||null;
  }
  finishRecovery(t) {
    if(['recovery','attackRecovery','fireEndRecovery'].includes(this.state)&&t>=this.until)this.setState('idle');
    if(this.fireEndPending&&['idle','attackWindup','attackRecovery'].includes(this.state)) {
      this.fireEndPending=false;this.area=null;this.effect=null;
      this.setState('fireEndRecovery');this.until=t+E.enchantEndRecovery;
      this.e.body?.setVelocityX?.(0);
    }
  }
  readySkill(t) {
    if(!['idle','attackWindup','attackRecovery'].includes(this.state))return false;
    const names=['Stab','Kick','Enchant'].filter(name=>t>=this['next'+name])
      .sort((a,b)=>this['next'+a]-this['next'+b]);
    for(const name of names) {
      const key=name.toLowerCase(),range=key==='enchant'?Infinity:E[key+'Range'];
      const target=this.h.chooseAnyTarget(this.scene,this.e,range);
      if(!valid(target)||(key==='enchant'&&this.fireUntil>t))continue;
      this.startArea(target);this.effect=null;this.setState(key+'Windup');this.until=t+E[key+'Windup'];
      this.scene.combatSystem?.clearKnockback?.(this.e);this.e.body?.setVelocityX?.(0);return true;
    }
    return false;
  }
  recover(t,key) {
    this.area=null;this.setState('recovery');this.until=t+E[key+'Recovery'];this.e.body?.setVelocityX?.(0);
  }
  releaseStrike(t,key) {
    const area=this.area,target=this.strikeTarget(area,E[key+'Range'],E[key+'Height']);
    this.area=null;this.effect={kind:key,area};this.effectUntil=t+E.flash;
    if(!valid(target)){this.recover(t,key);return;} // Lost/empty area: leave the independent clock unspent.
    const name=key[0].toUpperCase()+key.slice(1);
    this['next'+name]=t+this.delay(E[key+'Cooldown'],t);
    this.setState(key+'Release');this.until=t+E.flash;
    const kick=key==='kick',damage=kick?Math.max(1,Math.round(this.e.damage*E.kickDamageMultiplier)):
      this.swordDamage(t,E.stabDamageMultiplier);
    // Commit state, cooldown and flash before synchronous damage/death callbacks.
    this.h.targetDamage(this.scene,target,this.e,damage,{source:kick?'emperorKick':'emperorStab',
      attackType:kick?'melee':'pierce',singleTarget:true,
      knockbackDistance:kick?E.kickKnockback:0,knockbackDirection:area.direction});
  }
  releaseEnchant(t) {
    if(!valid(this.h.chooseAnyTarget(this.scene,this.e,Infinity))){this.recover(t,'enchant');return;}
    this.nextEnchant=t+this.delay(E.enchantCooldown,t);this.fireUntil=t+E.enchantDuration;
    this.fireEndPending=false;this.e.emperorFireSwordActive=true;
    this.area=null;this.effect={kind:'enchant'};this.effectUntil=t+E.flash;
    this.setState('enchantRelease');this.until=t+E.flash;
  }
  releaseAttack(t) {
    const target=this.h.chooseTarget(this.scene,this.e,this.e.attackRange);
    this.area=null;
    if(!valid(target)){this.setState('idle');this.until=0;return;}
    this.direction=Math.sign(target.x-this.e.x)||this.direction;
    this.nextAttack=t+this.delay(this.e.attackIntervalMs,t);
    this.setState('attackRecovery');this.until=t+E.attackRecovery;
    this.effect={kind:'attack',area:{x:this.e.x,y:this.e.y,direction:this.direction}};this.effectUntil=t+E.flash;
    this.h.targetDamage(this.scene,target,this.e,this.swordDamage(t),
      {source:'emperorSword',attackType:'melee',knockbackDistance:0});
  }
  advanceEffects(t) {
    if(!this.live()||isGravityReversalControlled(this.e))return;
    if(this.effect&&t>=this.effectUntil)this.effect=null;
    if(this.fireUntil>0&&t>=this.fireUntil) {
      this.fireUntil=0;this.e.emperorFireSwordActive=false;this.fireEndPending=true;
    }
  }
  update(t) {
    if(!this.live())return;
    this.advanceEffects(t);this.finishRecovery(t);
    if(this.readySkill(t)){this.syncVisual();return;}
    if(this.state==='idle') {
      this.h.approach(this.scene,this.e,this.e.attackRange);
      const target=this.h.chooseTarget(this.scene,this.e,this.e.attackRange);
      if(t>=this.nextAttack&&valid(target)) {
        this.startArea(target);this.setState('attackWindup');this.until=t+E.attackWindup;
        this.e.body?.setVelocityX?.(0);
      }
    } else {
      this.e.body?.setVelocityX?.(0);
      if(t>=this.until) {
        if(this.state==='stabWindup')this.releaseStrike(t,'stab');
        else if(this.state==='kickWindup')this.releaseStrike(t,'kick');
        else if(this.state==='enchantWindup')this.releaseEnchant(t);
        else if(this.state==='attackWindup')this.releaseAttack(t);
        else if(['stabRelease','kickRelease','enchantRelease'].includes(this.state))
          this.recover(t,this.state.replace('Release',''));
      }
    }
    this.syncVisual();
  }
  syncVisual() {
    const g=this.graphics,e=this.e;if(!g)return;
    g.clear();if(!alive(e))return;
    const t=this.scene.getGameplayTime?.()||0,fire=this.fireUntil>t,dir=this.direction;
    e.emperorFireSwordActive=fire;
    const wind=this.state.endsWith('Windup'),raised=this.state==='stabWindup';
    e.setFillStyle?.(wind?0xe0bf7f:e.baseColor);
    const grip={x:e.x+dir*32,y:e.y-18},tip=raised?{x:grip.x,y:e.y-112}:
      this.state==='attackWindup'?{x:e.x+dir*68,y:e.y-86}:{x:e.x+dir*130,y:e.y+18};
    if(fire)g.lineStyle(19,0xff7b29,.8).lineBetween(grip.x,grip.y,tip.x,tip.y);
    g.lineStyle(12,fire?0xffd18b:0xdad5b7,1).lineBetween(grip.x,grip.y,tip.x,tip.y);
    g.lineStyle(6,0x76572c,1).lineBetween(grip.x-dir*15,grip.y-10,grip.x+dir*15,grip.y+10);
    if(this.area&&['stabWindup','kickWindup'].includes(this.state)) {
      const key=this.state.replace('Windup',''),a=this.area,range=E[key+'Range'],height=E[key+'Height'];
      g.lineStyle(2,key==='stab'?0xf6cf92:0xf5a882,.65)
        .strokeRect(Math.min(a.x,a.x+a.direction*range),a.y-height,range,height*2);
    }
    const effect=this.effect;
    if(effect?.area) {
      const a=effect.area;
      if(effect.kind==='stab')g.lineStyle(12,fire?0xff8b36:0xffdf9c,1)
        .lineBetween(a.x+a.direction*110,a.y-90,a.x+a.direction*110,a.y+80);
      else g.lineStyle(effect.kind==='kick'?9:6,effect.kind==='kick'?0xf0a56e:0xf1d9a1,1)
        .lineBetween(a.x,a.y+20,a.x+a.direction*(effect.kind==='kick'?E.kickRange:e.attackRange),a.y+20);
    }
    if(this.state==='enchantWindup'||this.state==='enchantRelease')
      g.lineStyle(4,0xffb64c,.9).strokeCircle(grip.x,grip.y,36);
  }
  interrupt() {
    // Cold/gravity retain existing handling; no knockback-only timer reset or immunity window.
    if(this.state==='attackWindup'){this.area=null;this.setState('idle');this.until=0;}
    this.syncVisual();
  }
  onRecycle() {
    const key=this.state.replace(/Windup|Release/,'');
    if(skillStates.has(this.state))this.recover(this.scene.getGameplayTime?.()||0,key);
    else if(this.state==='attackWindup'){this.setState('idle');this.until=0;}
    this.area=null;this.effect=null;this.effectUntil=0;this.direction=-1;this.graphics?.clear();
    // Released fire duration and every independent skill clock survive recycling.
  }
  shiftTimers(delta,after) {
    for(const key of ['nextAttack','nextStab','nextKick','nextEnchant','until','effectUntil','fireUntil'])
      if(this[key]>after)this[key]+=delta;
    this.e.emperorFireSwordActive=this.fireUntil>(this.scene.getGameplayTime?.()||0);
  }
  pause() {this.e.body?.setVelocityX?.(0);}
  resume() {}
  destroy() {
    this.area=this.effect=null;this.fireUntil=this.effectUntil=0;this.fireEndPending=false;
    this.graphics?.destroy();this.graphics=null;this.setState('idle');
    this.e.bossSkillKnockbackImmune=false;delete this.e.emperorFireSwordActive;
    this.e.setFillStyle?.(this.e.baseColor);this.e.body?.setVelocityX?.(0);
  }
}
