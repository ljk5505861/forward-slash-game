import { SHIELD_GUARD_TUNING as GUARD } from '../../config/enemies.js';
import { isEnemyFrozen } from '../../systems/EnemyColdControl.js';
import { isGravityReversalControlled } from '../../systems/EnemyGravityControl.js';

const alive = e => e?.active && !e.isDefeated;

// Normal-mode elite only. Defense is temporary, never knockback immunity.
// Use the existing approach/targeting and gameplay clock; no event/tween timers.
export default class ShieldGuardBehavior {
  constructor(scene, enemy, helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    this.state='idle'; this.nextGuard=null; this.until=0; this.baseReduction=0;
    this.graphics=scene.add.graphics().setDepth(23);
  }
  lower(t) {
    if(this.state!=='guard') return;
    this.e.damageReduction=this.baseReduction;
    this.state='idle'; this.until=0;
    this.nextGuard=t+GUARD.cooldown;
    this.e.nextAttackAt=Math.max(this.e.nextAttackAt||0,t+GUARD.recovery);
  }
  expire(t) { if(this.state==='guard'&&t>=this.until) this.lower(t); }
  interrupt(t,reason) {
    this.expire(t);
    // A normal hit still launches the guard with the original knockback arc.
    // It does not refresh defense. Freeze/reversal cancel the defensive stance.
    if(reason==='gravityReversal'||isEnemyFrozen(this.e,t)||isGravityReversalControlled(this.e)) this.lower(t);
  }
  syncVisual() {
    if(!this.graphics) return;
    this.expire(this.scene.getGameplayTime?.()||0);
    const g=this.graphics,e=this.e; g.clear();
    if(!alive(e)) return;
    const raised=this.state==='guard',w=raised?46:34,h=raised?82:66;
    const x=e.x-e.width*0.38-w/2,y=e.y-h/2+(raised?-8:10);
    g.fillStyle(raised?0x94bed8:0x53697e,0.95).fillRoundedRect(x,y,w,h,7);
    g.lineStyle(4,raised?0xffdc88:0xb8c8d6,1).strokeRoundedRect(x,y,w,h,7);
    g.lineStyle(3,0xd8e4ec,1).lineBetween(x+w/2,y+10,x+w/2,y+h-10);
  }
  update(t) {
    if(!alive(this.e)||!this.graphics) return;
    const e=this.e,s=this.scene;
    this.expire(t);
    if(this.nextGuard===null) this.nextGuard=t+GUARD.first;
    if(this.state==='idle'&&t>=this.nextGuard) {
      this.baseReduction=e.damageReduction||0;
      e.damageReduction=1-(1-this.baseReduction)*(1-GUARD.reduction);
      this.state='guard'; this.until=t+GUARD.duration;
    }
    this.h.approach(s,e,e.attackRange);
    if(this.state==='guard') {
      e.body?.setVelocityX?.((e.body?.velocity?.x||0)*GUARD.moveMultiplier);
    } else {
      const victim=this.h.chooseTarget(s,e,e.attackRange);
      if(victim?.isAlive?.()&&t>=(e.nextAttackAt||0)) {
        e.nextAttackAt=t+this.h.getEnemyAttackDelay(e,e.attackIntervalMs,t);
        this.h.targetDamage(s,victim,e,e.damage,{source:'shieldGuardMelee'});
      }
    }
    this.syncVisual(); // Damage callbacks may synchronously destroy this behavior.
  }
  onRecycle() {
    this.lower(this.scene.getGameplayTime?.()||0);
    this.state='idle'; this.nextGuard=null; this.until=0; this.e.nextAttackAt=0;
    this.graphics?.clear();
  }
  shiftTimers(delta,after) {
    for(const key of ['nextGuard','until']) if(Number.isFinite(this[key])&&this[key]>after) this[key]+=delta;
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() {
    this.lower(this.scene.getGameplayTime?.()||0);
    this.graphics?.destroy(); this.graphics=null; this.state='idle'; this.nextGuard=null; this.until=0;
  }
}
