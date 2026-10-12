import { ABYSS_APOSTLE_TUNING as A } from '../../config/enemies.js';
import { isGravityReversalControlled } from '../../systems/EnemyGravityControl.js';
import { syncEnemyUi } from '../../entities/createEnemy.js';

const alive=e=>!!(e?.active&&!e.isDefeated&&e.hp>0);
const valid=t=>!!(t?.isAlive?.()&&t.active!==false&&!t.isDefeated);
const skills=['Release','Blood','Chain','Slam'];
const immuneStates=new Set(['releaseWindup','releaseChannel','bloodWindup','bloodRelease',
  'chainWindup','chain','slamWindup','slamRelease']);

export const abyssDamageMultiplier=(enemy,t)=>enemy?.behavior==='abyssApostle'
  &&alive(enemy)&&enemy.abyssBloodUntil>t?1-A.bloodReduction:1;

// Called after marking a body defeated, before any synchronous death/reward callbacks.
export function claimAbyssVictory(enemy) {
  const fight=enemy.abyssFight;
  if(!fight)return true;
  if(fight.settled||[...fight.members].some(alive))return false;
  fight.settled=true;return true;
}

export default class AbyssApostleBehavior {
  constructor(scene,enemy,helpers) {
    this.scene=scene;this.e=enemy;this.h=helpers;this.state='idle';this.until=0;
    const t=scene.getGameplayTime?.()||0;
    for(const name of skills)this['next'+name]=t+A[name.toLowerCase()+'First'];
    this.nextAttack=0;this.direction=-1;this.area=null;this.effect=null;this.effectUntil=0;
    this.hazards=[];this.nextTentacle=0;this.channelUntil=0;this.chainRemaining=0;this.chainSpent=false;
    enemy.abyssFight={members:new Set([enemy]),split:false,settled:false};
    enemy.abyssBloodUntil=0;enemy.abyssSkillGateUntil=0;
    this.graphics=scene.add.graphics().setDepth(23);this.setState('idle');
  }
  live() {return alive(this.e)&&!!this.graphics&&!this.scene.isGameplayPaused?.();}
  delay(ms,t) {return this.h.getEnemyAttackDelay(this.e,ms,t);}
  setState(state) {
    const e=this.e;this.state=state;e.behaviorState=e.attackState=state;
    e.bossSkillKnockbackImmune=immuneStates.has(state);
    e.casting=e.isCasting=e.skillActive=e.bossSkillKnockbackImmune;
    e.charging=e.isCharging=e.dashing=e.isDashing=false;
  }
  tentacleDamage(t,multiplier=1) {
    return Math.max(1,Math.round(this.e.damage*(multiplier+
      (this.e.abyssBloodUntil>t?A.bloodAddedDamageMultiplier:0))));
  }
  clearAttacks() {
    this.area=this.effect=null;this.effectUntil=0;this.hazards=[];
    this.nextTentacle=this.channelUntil=this.chainRemaining=0;this.chainSpent=false;
  }
  trySplit(t) {
    const e=this.e,fight=e.abyssFight;
    if(!this.live()||!fight||fight.split||fight.settled||e.hp>e.maxHp*A.splitHpFraction
      ||isGravityReversalControlled(e)||!this.scene.enemies.includes(e)
      ||!this.scene.targeting?.isEnemyFullyInsideViewport(e))return false;
    const x=Math.min(this.scene.balance.stageWorldWidth-e.width/2-8,e.x+A.twinGap);
    const twin=this.scene.stageSystem?.spawn('abyss_apostle',x);
    if(!twin)return false; // Population cap: retry without reducing health or consuming the split.
    const other=this.scene.enemyBehaviors?.items.get(twin);
    if(!other)throw new Error('Abyss twin requires its normal-mode behavior');
    const hp=e.hp/2,maxHp=e.maxHp/2;
    fight.split=true;fight.members.add(twin);twin.abyssFight=fight;
    e.hp=twin.hp=hp;e.maxHp=twin.maxHp=maxHp;
    for(const key of ['level','damage','attackIntervalMs','baseAttackIntervalMs','speed','attackRange','defense','damageReduction'])twin[key]=e[key];
    twin.y=e.y;twin.body?.reset?.(twin.x,twin.y);twin.flowBossType=e.flowBossType||'boss6';twin.isFinalBoss=true;
    twin.abyssBloodUntil=e.abyssBloodUntil;
    for(const name of skills)other['next'+name]=Math.max(t,this['next'+name])+A.twinStagger;
    other.nextAttack=Math.max(t,this.nextAttack)+A.twinStagger;
    this.clearAttacks();other.clearAttacks();this.scene.combatSystem?.clearKnockback?.(e);
    this.setState('recovery');this.until=t+A.splitRecovery;
    other.setState('recovery');other.until=t+A.splitRecovery+A.twinStagger;
    e.abyssSkillGateUntil=t+A.splitRecovery;
    e.name='深渊使徒·甲';twin.name='深渊使徒·乙';
    e.nameText?.setText(e.name);twin.nameText?.setText(twin.name);twin.levelText?.setText(`Lv.${twin.level}`);
    e.body?.setVelocityX?.(0);twin.body?.setVelocityX?.(0);syncEnemyUi(e);syncEnemyUi(twin);
    this.scene.hud?.setStatus('深渊使徒：双生，全部击败才能通关');return true;
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
  startSkill(t) {
    if(!['idle','attackWindup','attackRecovery'].includes(this.state))return false;
    if([...this.e.abyssFight.members].some(e=>alive(e)&&e.abyssSkillGateUntil>t))return false;
    const names=skills.filter(name=>t>=this['next'+name]).sort((a,b)=>this['next'+a]-this['next'+b]);
    for(const name of names) {
      const key=name.toLowerCase(),range=key==='chain'?A.chainRange:key==='slam'?A.slamRange:Infinity;
      if(key==='blood'&&this.e.abyssBloodUntil>t)continue;
      const target=this.h.chooseAnyTarget(this.scene,this.e,range);if(!valid(target))continue;
      this.startArea(target);
      if(key==='slam')this.area={x:target.x,y:target.y};
      this.e.abyssSkillGateUntil=t+A.twinStagger;
      this.effect=null;this.setState(key+'Windup');this.until=t+A[key+'Windup'];
      this.scene.combatSystem?.clearKnockback?.(this.e);this.e.body?.setVelocityX?.(0);return true;
    }
    return false;
  }
  recover(t,key) {
    this.area=null;this.setState('recovery');this.until=t+A[key+'Recovery'];this.e.body?.setVelocityX?.(0);
  }
  releaseBlood(t) {
    if(!valid(this.h.chooseAnyTarget(this.scene,this.e,Infinity))){this.recover(t,'blood');return;}
    this.nextBlood=t+this.delay(A.bloodCooldown,t);this.e.abyssBloodUntil=t+A.bloodDuration;
    this.area=null;this.setState('bloodRelease');this.until=t+A.flash;
  }
  releaseChannel(t) {
    const target=this.h.chooseAnyTarget(this.scene,this.e,Infinity);
    if(!valid(target)){this.recover(t,'release');return;}
    this.nextRelease=t+this.delay(A.releaseCooldown,t);this.channelUntil=t+A.releaseDuration;
    this.nextTentacle=t;this.area=null;this.setState('releaseChannel');this.until=this.channelUntil;
    this.advanceEffects(t);
  }
  chainHit(t) {
    const area=this.area,target=this.strikeTarget(area,A.chainRange,A.chainHeight);
    this.chainRemaining-=1;this.until=t+A.chainInterval;this.setState('chain');
    this.effect={kind:'chain',area};this.effectUntil=t+A.flash;
    if(!valid(target))return;
    if(!this.chainSpent){this.chainSpent=true;this.nextChain=t+this.delay(A.chainCooldown,t);}
    this.h.targetDamage(this.scene,target,this.e,this.tentacleDamage(t,A.chainDamageMultiplier),
      {source:'abyssChain',attackType:'melee',knockbackDistance:0});
  }
  damageArea(area,radius,damage,meta) {
    // Snapshot targets; damage can synchronously kill this boss or end the whole run.
    const targets=this.scene.combatSystem.getAttackableTargets(this.e).filter(valid)
      .filter(target=>Math.hypot(target.x-area.x,target.y-area.y)<=radius);
    for(const target of targets) {
      if(!this.live()||isGravityReversalControlled(this.e))break;
      if(valid(target))this.h.targetDamage(this.scene,target,this.e,damage,
        {singleTarget:false,attackType:'ground',dodgeable:false,knockbackDistance:0,...meta});
    }
    return targets.length>0;
  }
  releaseSlam(t) {
    const area=this.area;
    this.area=null;this.effect={kind:'slam',area};this.effectUntil=t+A.flash;
    this.setState('slamRelease');this.until=t+A.flash;
    const targets=this.scene.combatSystem.getAttackableTargets(this.e).filter(valid)
      .filter(target=>Math.hypot(target.x-area.x,target.y-area.y)<=A.slamRadius);
    if(!targets.length){this.recover(t,'slam');return;}
    this.nextSlam=t+this.delay(A.slamCooldown,t);
    this.damageArea(area,A.slamRadius,this.tentacleDamage(t,A.slamDamageMultiplier),{source:'abyssSlam'});
  }
  releaseAttack(t) {
    const target=this.h.chooseTarget(this.scene,this.e,this.e.attackRange);this.area=null;
    if(!valid(target)){this.setState('idle');this.until=0;return;}
    this.direction=Math.sign(target.x-this.e.x)||this.direction;
    this.nextAttack=t+this.delay(this.e.attackIntervalMs,t);this.setState('attackRecovery');this.until=t+A.attackRecovery;
    this.effect={kind:'attack',area:{x:this.e.x,y:this.e.y,direction:this.direction}};this.effectUntil=t+A.flash;
    this.h.targetDamage(this.scene,target,this.e,this.tentacleDamage(t),
      {source:'abyssTentacle',attackType:'melee',knockbackDistance:0});
  }
  advanceEffects(t) {
    if(!this.live()||isGravityReversalControlled(this.e))return;
    if(this.trySplit(t))return;
    if(this.effect&&t>=this.effectUntil)this.effect=null;
    if(this.e.abyssBloodUntil>0&&t>=this.e.abyssBloodUntil)this.e.abyssBloodUntil=0;
    if(this.state==='releaseChannel'&&t<this.channelUntil&&t>=this.nextTentacle) {
      const target=this.h.chooseAnyTarget(this.scene,this.e,Infinity);
      if(valid(target))this.hazards.push({x:target.x,y:target.y,hitAt:t+A.releaseWarning,hit:false,until:0});
      this.nextTentacle=t+A.releaseInterval; // No catch-up burst after a long frame.
    }
    for(const hazard of [...this.hazards]) {
      if(!this.live())return;
      if(!hazard.hit&&t>=hazard.hitAt) {
        hazard.hit=true;hazard.until=t+A.flash;
        this.damageArea(hazard,A.releaseRadius,this.tentacleDamage(t,A.releaseDamageMultiplier),{source:'abyssRelease'});
      }
      if(!this.live())return;
      if(hazard.hit&&t>=hazard.until)this.hazards=this.hazards.filter(h=>h!==hazard);
    }
  }
  finishRecovery(t) {
    if(['recovery','attackRecovery'].includes(this.state)&&t>=this.until)this.setState('idle');
  }
  updateWhileKnockedBack(t) {
    if(this.live()){this.finishRecovery(t);this.startSkill(t);}
  }
  update(t) {
    if(!this.live())return;
    this.advanceEffects(t);
    if(!this.live())return;
    this.finishRecovery(t);
    if(this.startSkill(t)){this.syncVisual();return;}
    if(this.state==='idle') {
      this.h.approach(this.scene,this.e,this.e.attackRange);
      const target=this.h.chooseTarget(this.scene,this.e,this.e.attackRange);
      if(t>=this.nextAttack&&valid(target)) {
        this.startArea(target);this.setState('attackWindup');this.until=t+A.attackWindup;this.e.body?.setVelocityX?.(0);
      }
    } else {
      this.e.body?.setVelocityX?.(0);
      if(t>=this.until) {
        if(this.state==='releaseWindup')this.releaseChannel(t);
        else if(this.state==='bloodWindup')this.releaseBlood(t);
        else if(this.state==='chainWindup'){this.chainRemaining=A.chainCount;this.chainSpent=false;this.chainHit(t);}
        else if(this.state==='chain'){if(this.chainRemaining>0)this.chainHit(t);else this.recover(t,'chain');}
        else if(this.state==='slamWindup')this.releaseSlam(t);
        else if(this.state==='attackWindup')this.releaseAttack(t);
        else if(this.state==='releaseChannel')this.recover(t,'release');
        else if(['bloodRelease','slamRelease'].includes(this.state))this.recover(t,this.state.replace('Release',''));
      }
    }
    this.syncVisual();
  }
  syncVisual() {
    const g=this.graphics,e=this.e;if(!g)return;g.clear();if(!alive(e))return;
    const t=this.scene.getGameplayTime?.()||0,blood=e.abyssBloodUntil>t,dir=this.direction;
    e.setFillStyle?.(this.state.endsWith('Windup')?0x916176:e.baseColor);
    g.lineStyle(5,blood?0xd34e63:0xb284a9,.9).strokeCircle(e.x,e.y-34,18);
    for(const offset of [-16,16])g.lineStyle(9,blood?0xd34e63:0x9a7398,1)
      .lineBetween(e.x+dir*25,e.y+offset,e.x+dir*72,e.y+offset-24)
      .lineBetween(e.x+dir*72,e.y+offset-24,e.x+dir*130,e.y+offset+20);
    if(blood||this.state==='bloodWindup')g.lineStyle(4,0xe36276,.85)
      .strokeRect(e.x-dir*38-26,e.y-58,52,116);
    if(this.area&&['chainWindup','chain'].includes(this.state)) {
      const a=this.area;g.lineStyle(2,0xde91b8,.6)
        .strokeRect(Math.min(a.x,a.x+a.direction*A.chainRange),a.y-A.chainHeight,A.chainRange,A.chainHeight*2);
    }
    if(this.area&&this.state==='slamWindup')g.lineStyle(3,0xee7799,.8).strokeCircle(this.area.x,this.area.y,A.slamRadius);
    for(const h of this.hazards) {
      if(!h.hit)g.lineStyle(2,0xe499c0,.8).strokeCircle(h.x,h.y,A.releaseRadius);
      else g.lineStyle(12,0xc2679f,1).lineBetween(h.x,h.y-110,h.x,h.y+25);
    }
    const a=this.effect?.area;
    if(a) {
      if(this.effect.kind==='slam')g.lineStyle(27,0xd672a5,1).lineBetween(a.x,a.y-190,a.x,a.y+20)
        .lineStyle(4,0xf4a5cb,.85).strokeCircle(a.x,a.y,A.slamRadius);
      else g.lineStyle(this.effect.kind==='chain'?11:7,blood?0xee697e:0xd8a0c8,1)
        .lineBetween(a.x,a.y+12,a.x+a.direction*(this.effect.kind==='chain'?A.chainRange:e.attackRange),a.y+12);
    }
  }
  interrupt() {
    if(this.state==='attackWindup'){this.area=null;this.setState('idle');this.until=0;}
    this.syncVisual(); // Knockback never delays the four independent skill clocks.
  }
  onRecycle() {
    this.clearAttacks();this.setState('idle');this.until=0;this.direction=-1;this.graphics?.clear();
    // One-time split, blood duration and independent cooldowns survive existing left->right recycling.
  }
  shiftTimers(delta,after) {
    for(const key of ['nextAttack','nextRelease','nextBlood','nextChain','nextSlam','until','effectUntil','nextTentacle','channelUntil'])
      if(this[key]>after)this[key]+=delta;
    for(const key of ['abyssBloodUntil','abyssSkillGateUntil'])if(this.e[key]>after)this.e[key]+=delta;
    for(const h of this.hazards)for(const key of ['hitAt','until'])if(h[key]>after)h[key]+=delta;
  }
  pause() {this.e.body?.setVelocityX?.(0);}
  resume() {}
  destroy() {
    this.clearAttacks();this.graphics?.destroy();this.graphics=null;this.setState('idle');
    this.e.abyssBloodUntil=this.e.abyssSkillGateUntil=0;
    this.e.setFillStyle?.(this.e.baseColor);this.e.body?.setVelocityX?.(0);
  }
}
