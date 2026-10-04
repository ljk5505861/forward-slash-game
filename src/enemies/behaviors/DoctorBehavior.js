import { DOCTOR_TUNING } from '../../config/enemies.js';

const alive = e => e?.active && !e.isDefeated;
export const doctorHealAmount = e => Math.max(1, Math.round(e.healAmount * (1 + Math.max(0, (e.level || 1) - 1) * DOCTOR_TUNING.healGrowth)));

// Normal-mode healer only. Existing approach/recycling and gameplay clock stay
// authoritative; one reusable graphic, no timers or tweens to leak on restart.
export default class DoctorBehavior {
  constructor(scene, enemy, helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    this.next=null; this.nextHeal=0; this.target=null; this.effectUntil=0;
    this.graphics=scene.add.graphics().setDepth(23);
  }
  syncVisual() {
    const g=this.graphics;
    if (!g) return;
    g.clear();
    if (!alive(this.e) || !alive(this.target) || (this.scene.getGameplayTime?.() || 0)>=this.effectUntil) {
      this.target=null; return;
    }
    g.lineStyle(4,0x58ff8a,0.9).lineBetween(this.e.x,this.e.y-30,this.target.x,this.target.y-30);
  }
  update(t) {
    if (!alive(this.e) || !this.graphics) return;
    const e=this.e,s=this.scene;
    this.h.approach(s,e,e.attackRange,e.preferredRange);
    // Drum attack speed must not also accelerate healing.
    const delay=this.h.getEnemyAttackDelay(e,e.warDrumBuff?.baseInterval??e.attackIntervalMs,t);
    if (this.next===null) this.next=t+delay;
    if (t<this.next) return;
    const targets=s.enemies.filter(target=>alive(target)&&target!==e&&target.maxHp>0&&target.hp>0&&target.hp<target.maxHp&&
      Math.hypot(target.x-e.x,target.y-e.y)<=DOCTOR_TUNING.healRange);
    targets.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp || Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y));
    const target=targets[0];
    if (target) {
      if(t<this.nextHeal)return;
      const amount=Math.min(target.maxHp-target.hp,doctorHealAmount(e));
      this.next=t+delay;
      this.nextHeal=this.next;
      target.hp+=amount;
      this.target=target; this.effectUntil=t+DOCTOR_TUNING.effectMs;
      this.syncVisual();
      s.floatText(target.x,target.y-70,`+${amount}`,'#5cff8d');
    } else {
      const victim=this.h.chooseTarget(s,e,DOCTOR_TUNING.meleeRange);
      if (victim?.isAlive?.()) {
        this.next=t+this.h.getEnemyAttackDelay(e,e.attackIntervalMs,t);
        this.nextHeal=t+delay;
        this.h.targetDamage(s,victim,e,e.damage,{source:'doctorMelee'});
      }
    }
  }
  onRecycle() { this.next=null; this.nextHeal=0; this.target=null; this.effectUntil=0; this.graphics?.clear(); }
  shiftTimers(delta,after) {
    if (this.next>after) this.next+=delta;
    if (this.nextHeal>after) this.nextHeal+=delta;
    if (this.effectUntil>after) this.effectUntil+=delta;
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() { this.graphics?.destroy(); this.graphics=null; this.target=null; }
}
