import { ENEMIES, WAR_DRUM_TUNING as DRUM } from '../../config/enemies.js';

const alive = e => e?.active && !e.isDefeated;

// A pulse changes only ordinary attack intervals, not movement, damage, skill
// cooldowns or pending attacks. Sources share one baseline: no compounded buffs.
export default class WarDrumPriestBehavior {
  constructor(scene, enemy, helpers) {
    this.scene=scene; this.e=enemy; this.h=helpers;
    this.state='idle'; this.nextDrum=null; this.nextMelee=0; this.until=0;
    this.buffed=new Set(); this.graphics=scene.add.graphics().setDepth(23);
  }
  targets() {
    const e=this.e,s=this.scene;
    return (s.enemies||[]).filter(v=>alive(v)&&!v.isElite&&!v.isBoss&&
      ENEMIES[v.enemyId]?.kind==='normal'&&v.attackIntervalMs>0&&
      s.targeting?.isEnemyFullyInsideViewport?.(v)!==false&&Math.hypot(v.x-e.x,v.y-e.y)<=DRUM.range);
  }
  removeBuff(v) {
    const buff=v.warDrumBuff;
    if(buff) {
      buff.sources.delete(this);
      if(!buff.sources.size) { v.attackIntervalMs=buff.baseInterval; delete v.warDrumBuff; }
    }
    this.buffed.delete(v);
  }
  clearBuffs() { for(const v of [...this.buffed])this.removeBuff(v); }
  expireBuffs(t) {
    for(const v of [...this.buffed]) {
      const until=v.warDrumBuff?.sources.get(this);
      if(!alive(this.e)||!alive(v)||!Number.isFinite(until)||t>=until)this.removeBuff(v);
    }
  }
  pulse(targets,t) {
    for(const v of targets) {
      const buff=v.warDrumBuff ||= {baseInterval:v.attackIntervalMs,sources:new Map()};
      buff.sources.set(this,t+DRUM.duration);
      v.attackIntervalMs=Math.round(buff.baseInterval/(1+DRUM.attackSpeedBonus));
      this.buffed.add(v);
    }
  }
  syncVisual() {
    const t=this.scene.getGameplayTime?.()||0,g=this.graphics,e=this.e;
    this.expireBuffs(t);
    if(!g)return;
    g.clear(); if(!alive(e))return;
    const wind=this.state==='windup';
    g.lineStyle(wind?5:3,wind?0xffdf83:0xe7bf7f,1)
      .strokeRect(e.x-27,e.y-12,34,27)
      .lineBetween(e.x-28,e.y-6,e.x-42,e.y-(wind?36:20))
      .lineBetween(e.x+8,e.y-6,e.x+21,e.y-(wind?36:20));
    for(const v of this.buffed) {
      const y=v.y-(v.height||80)/2-6;
      g.lineStyle(3,0xffda73,0.9).lineBetween(v.x-6,y+5,v.x,y-1).lineBetween(v.x,y-1,v.x+6,y+5);
    }
  }
  update(t) {
    if(!alive(this.e)||!this.graphics)return;
    this.expireBuffs(t);
    const e=this.e,s=this.scene;
    if(this.nextDrum===null)this.nextDrum=t+DRUM.first;
    if(this.state==='windup') {
      e.body?.setVelocityX?.(0);
      if(t>=this.until) {
        const targets=this.targets();
        if(!targets.length)this.state='idle';
        else {
          this.pulse(targets,t); this.state='recovery'; this.until=t+DRUM.recovery;
          this.nextDrum=this.until+this.h.getEnemyAttackDelay(e,DRUM.cooldown,t);
          this.nextMelee=this.until+this.h.getEnemyAttackDelay(e,e.attackIntervalMs,t);
        }
      }
    } else if(this.state==='recovery') {
      e.body?.setVelocityX?.(0); if(t>=this.until)this.state='idle';
    } else {
      this.h.approach(s,e,e.attackRange,e.preferredRange);
      if(t>=this.nextDrum&&this.targets().length) {
        this.state='windup'; this.until=t+DRUM.windup; e.body?.setVelocityX?.(0);
      } else if(t>=this.nextMelee) {
        const victim=this.h.chooseTarget(s,e,DRUM.meleeRange);
        if(victim?.isAlive?.()) {
          this.nextMelee=t+this.h.getEnemyAttackDelay(e,e.attackIntervalMs,t);
          this.h.targetDamage(s,victim,e,e.damage,{source:'warDrumMelee'});
        }
      }
    }
    this.syncVisual();
  }
  interrupt() {
    this.clearBuffs();
    if(this.state==='windup')this.state='idle';
    this.graphics?.clear();
  }
  onRecycle() {
    this.clearBuffs(); this.state='idle'; this.nextDrum=null; this.nextMelee=0; this.until=0;
    this.graphics?.clear();
  }
  shiftTimers(delta,after) {
    for(const key of ['nextDrum','nextMelee','until'])if(Number.isFinite(this[key])&&this[key]>after)this[key]+=delta;
    for(const v of this.buffed) {
      const sources=v.warDrumBuff?.sources,until=sources?.get(this);
      if(until>after)sources.set(this,until+delta);
    }
  }
  pause() { this.e.body?.setVelocityX?.(0); }
  resume() {}
  destroy() { this.clearBuffs(); this.graphics?.destroy(); this.graphics=null; this.state='idle'; }
}
