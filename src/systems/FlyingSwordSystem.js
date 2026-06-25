import { CombatEvents } from '../core/CombatEvents.js';

const DEFAULTS = Object.freeze({ orbitRadius:72, orbitSpeed:1.8, damageScale:1, temporary:false, inheritedTags:[] });

export default class FlyingSwordSystem {
  constructor(scene){ this.scene=scene; this.swords=[]; this.nextId=1; }

  createSword(options={}){
    const config={ ...DEFAULTS, ...options };
    const sword={ id:this.nextId++, type:config.type||'base', ownerSkillId:config.ownerSkillId||'', temporary:!!config.temporary, damageScale:config.damageScale, state:'orbit', target:null, angle:config.angle??(this.swords.length*Math.PI*2/Math.max(1,this.swords.length+1)), orbitRadius:config.orbitRadius, orbitSpeed:config.orbitSpeed, expiresAt:config.durationMs?this.scene.getGameplayTime()+config.durationMs:0, inheritedTags:[...(config.inheritedTags||[])], view:null };
    if(config.visible!==false){ sword.view=this.scene.add.rectangle(this.scene.player.x,this.scene.player.y-64,44,8,config.color??0xcff5ff,0.95).setStrokeStyle(2,0xffffff,0.8).setDepth(145); }
    this.swords.push(sword);
    this.scene.eventBus?.emit?.(CombatEvents.SWORD_CREATED,{ sword });
    return sword;
  }

  getAll(){ return [...this.swords]; }
  getById(id){ return this.swords.find(s=>s.id===id)||null; }

  setState(id,state,target=null){ const sword=this.getById(id); if(!sword) return null; sword.state=state; sword.target=target; return sword; }

  markAttack(id,target,meta={}){
    const sword=this.getById(id);
    if(!sword) return false;
    sword.state='attack';
    sword.target=target||null;
    this.scene.eventBus?.emit?.(CombatEvents.SWORD_ATTACKED,{ sword, target, ...meta });
    return true;
  }

  returnToOrbit(id){ const sword=this.getById(id); if(!sword) return false; sword.state='orbit'; sword.target=null; return true; }

  removeSword(id,reason='removed'){
    const index=this.swords.findIndex(s=>s.id===id);
    if(index<0) return false;
    const [sword]=this.swords.splice(index,1);
    sword.view?.destroy?.();
    this.scene.eventBus?.emit?.(CombatEvents.SWORD_DESTROYED,{ sword, reason });
    return true;
  }

  update(time){
    const player=this.scene.player;
    if(!player) return;
    this.swords.slice().forEach((sword,index)=>{
      if(sword.expiresAt&&time>=sword.expiresAt){ this.removeSword(sword.id,'expired'); return; }
      if(!sword.view) return;
      if(sword.state==='orbit'){
        sword.angle+=sword.orbitSpeed/60;
        const spread=this.swords.length>1?(index/this.swords.length)*Math.PI*2:0;
        const angle=sword.angle+spread;
        sword.view.x=player.x+Math.cos(angle)*sword.orbitRadius;
        sword.view.y=player.y-64+Math.sin(angle)*sword.orbitRadius*0.42;
        sword.view.rotation=angle+Math.PI/2;
      } else if(sword.state==='attack'&&this.scene.targeting?.valid?.(sword.target)){
        sword.view.x+=(sword.target.x-sword.view.x)*0.28;
        sword.view.y+=((sword.target.y-48)-sword.view.y)*0.28;
        sword.view.rotation=Math.atan2((sword.target.y-48)-sword.view.y,sword.target.x-sword.view.x);
      } else this.returnToOrbit(sword.id);
    });
  }

  shiftTimers(pausedDuration,pausedAt){ this.swords.forEach(s=>{ if(s.expiresAt>pausedAt) s.expiresAt+=pausedDuration; }); }
  reset(){ this.swords.slice().forEach(s=>this.removeSword(s.id,'reset')); this.nextId=1; }
  destroy(){ this.reset(); }
}
