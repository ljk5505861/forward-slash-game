import { CombatEvents } from '../core/CombatEvents.js';

const DEFAULTS = Object.freeze({ orbitRadius:72, orbitSpeed:1.8, damageScale:1, temporary:false, inheritedTags:[], affinities:[] });
const STANDARD_AFFINITIES = Object.freeze(['fire','poison','blood','shield','afterimage']);
const normalizeAffinity = (affinity) => (typeof affinity === 'string' && affinity.trim()) ? affinity.trim() : '';
const normalizeAffinities = (affinities=[]) => [...new Set((Array.isArray(affinities)?affinities:[]).map(normalizeAffinity).filter(Boolean))];

export default class FlyingSwordSystem {
  constructor(scene){ this.scene=scene; this.swords=[]; this.nextId=1; }

  createSword(options={}){
    const config={ ...DEFAULTS, ...options };
    const sword={ id:this.nextId++, type:config.type||'base', ownerSkillId:config.ownerSkillId||'', temporary:!!config.temporary, damageScale:config.damageScale, flightSpeed:config.flightSpeed||1, bodyScale:config.bodyScale||1, glowScale:config.glowScale||1, state:'orbit', target:null, angle:config.angle??0, orbitRadius:config.orbitRadius, orbitSpeed:config.orbitSpeed, expiresAt:config.durationMs?this.scene.getGameplayTime()+config.durationMs:0, inheritedTags:[...(config.inheritedTags||[])], affinities:normalizeAffinities(config.affinities), shadowSword:!!config.shadowSword, sourceAfterimageId:config.sourceAfterimageId||null, view:null };
    if(config.visible!==false){ sword.view=this.scene.add.rectangle(this.scene.player.x-58,this.scene.player.y-72,config.shadowSword?34:44,config.shadowSword?6:8,config.color??0xcff5ff,config.shadowSword?0.55:0.95).setStrokeStyle(2,config.shadowSword?0xc8c2ff:0xffffff,config.shadowSword?0.45:0.8).setDepth(145); }
    this.swords.push(sword);
    this.scene.eventBus?.emit?.(CombatEvents.SWORD_CREATED,{ sword });
    return sword;
  }

  getAll(){ return [...this.swords]; }
  getById(id){ return this.swords.find(s=>s.id===id)||null; }

  addAffinity(swordId, affinity){
    const sword=this.getById(swordId);
    const value=normalizeAffinity(affinity);
    if(!sword||!value) return false;
    sword.affinities=normalizeAffinities(sword.affinities);
    if(sword.affinities.includes(value)) return true;
    sword.affinities.push(value);
    return true;
  }

  removeAffinity(swordId, affinity){
    const sword=this.getById(swordId);
    const value=normalizeAffinity(affinity);
    if(!sword||!value) return false;
    sword.affinities=normalizeAffinities(sword.affinities);
    const before=sword.affinities.length;
    sword.affinities=sword.affinities.filter(item=>item!==value);
    return sword.affinities.length!==before;
  }

  hasAffinity(swordId, affinity){
    const sword=this.getById(swordId);
    const value=normalizeAffinity(affinity);
    return !!sword&&!!value&&normalizeAffinities(sword.affinities).includes(value);
  }

  getAffinitySnapshot(swords=this.getAll()){
    const affinityCounts=Object.fromEntries(STANDARD_AFFINITIES.map(key=>[key,0]));
    const validSwords=(Array.isArray(swords)?swords:[]).filter(sword=>sword&&!sword.shadowSword&&this.getById(sword.id));
    let normalSwordCount=0;
    validSwords.forEach(sword=>{
      const affinities=normalizeAffinities(sword.affinities);
      if(!affinities.length){ normalSwordCount+=1; return; }
      affinities.forEach(affinity=>{ affinityCounts[affinity]=(affinityCounts[affinity]||0)+1; });
    });
    return { totalSwordCount:validSwords.length, normalSwordCount, affinityCounts:{ ...affinityCounts } };
  }

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

  formationPosition(index,time,sword=null){
    if(sword?.shadowSword&&sword.sourceAfterimageId){
      const a=this.scene.afterimages?.getById?.(sword.sourceAfterimageId);
      const v=a?.view;
      if(v) return { x:v.x-22+Math.sin(time*0.004+index)*8, y:v.y-34+Math.cos(time*0.004+index)*5, rotation:-0.12 };
    }
    const player=this.scene.player;
    const facingLeft=!!player.flipX;
    const behindDirection=facingLeft?1:-1;
    const row=index%4;
    const column=Math.floor(index/4);
    const horizontal=58+row*24+column*18;
    const vertical=-92+row*22-column*10;
    const bob=Math.sin(time*0.004+index*0.85)*4;
    return { x:player.x+behindDirection*horizontal, y:player.y+vertical+bob, rotation:facingLeft?Math.PI:0 };
  }

  update(time){
    const player=this.scene.player;
    if(!player) return;
    this.swords.slice().forEach((sword,index)=>{
      if(sword.expiresAt&&time>=sword.expiresAt){ this.removeSword(sword.id,'expired'); return; }
      if(sword.state==='gathered') return;
      if(!sword.view) return;
      if(sword.state==='orbit'){
        const slot=this.formationPosition(index,time,sword);
        sword.view.x+=(slot.x-sword.view.x)*0.24;
        sword.view.y+=(slot.y-sword.view.y)*0.24;
        sword.view.rotation+=(slot.rotation-sword.view.rotation)*0.28;
      } else if(sword.state==='attack'&&this.scene.targeting?.valid?.(sword.target)){
        const factor=Math.min(0.62,0.20*(sword.flightSpeed||1));
        sword.view.x+=(sword.target.x-sword.view.x)*factor;
        sword.view.y+=((sword.target.y-48)-sword.view.y)*factor;
        sword.view.rotation=Math.atan2((sword.target.y-48)-sword.view.y,sword.target.x-sword.view.x); sword.view.setScale?.(sword.bodyScale||1,(sword.glowScale||sword.bodyScale||1));
      } else this.returnToOrbit(sword.id);
    });
  }

  shiftTimers(pausedDuration,pausedAt){ this.swords.forEach(s=>{ if(s.expiresAt>pausedAt) s.expiresAt+=pausedDuration; }); }
  reset(){ this.swords.slice().forEach(s=>this.removeSword(s.id,'reset')); this.nextId=1; }
  destroy(){ this.reset(); }
}
