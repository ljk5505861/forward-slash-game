import { CombatEvents } from '../core/CombatEvents.js';

const DEFAULTS = Object.freeze({ durationMs:5000, attackRatio:0.35, attackSpeedBonus:0, visible:true });

export default class AfterimageSystem {
  constructor(scene){ this.scene=scene; this.afterimages=[]; this.echoHandlers=new Map(); this.nextId=1; this.appliedAttackSpeedBonus=0; }

  createAfterimage(options={}){
    const config={ ...DEFAULTS, ...options };
    const afterimage={ id:this.nextId++, ownerSkillId:config.ownerSkillId||'', createdAt:this.scene.getGameplayTime(), expiresAt:config.durationMs?this.scene.getGameplayTime()+config.durationMs:0, attackRatio:config.attackRatio, attackSpeedBonus:config.attackSpeedBonus, inheritedSkills:[...(config.inheritedSkills||[])], view:null };
    if(config.visible!==false){ afterimage.view=this.scene.add.rectangle(this.scene.player.x-20,this.scene.player.y-52,34,76,config.color??0x7777ff,0.24).setStrokeStyle(2,0xb9c5ff,0.35).setDepth(95); }
    this.afterimages.push(afterimage);
    this.recalculateAttackSpeed();
    this.scene.eventBus?.emit?.(CombatEvents.AFTERIMAGE_CREATED,{ afterimage });
    return afterimage;
  }

  getAll(){ return [...this.afterimages]; }
  getById(id){ return this.afterimages.find(a=>a.id===id)||null; }

  registerEchoHandler(skillId,handler){ if(!skillId||typeof handler!=='function') return false; this.echoHandlers.set(skillId,handler); return true; }
  unregisterEchoHandler(skillId){ return this.echoHandlers.delete(skillId); }

  triggerEcho(skillId,payload={}){
    const handler=this.echoHandlers.get(skillId);
    if(!handler) return 0;
    let triggered=0;
    this.afterimages.forEach((afterimage,index)=>{ const result=handler({ afterimage, index, total:this.afterimages.length, ...payload }); if(result!==false) triggered+=1; });
    return triggered;
  }

  removeAfterimage(id,reason='removed'){
    const index=this.afterimages.findIndex(a=>a.id===id);
    if(index<0) return false;
    const [afterimage]=this.afterimages.splice(index,1);
    afterimage.view?.destroy?.();
    this.recalculateAttackSpeed();
    this.scene.eventBus?.emit?.(CombatEvents.AFTERIMAGE_REMOVED,{ afterimage, reason });
    return true;
  }

  recalculateAttackSpeed(){
    const playerData=this.scene.playerData;
    if(!playerData) return;
    const current=Math.max(0.2,playerData.attackSpeedMultiplier||1);
    const base=Math.max(0.2,current-this.appliedAttackSpeedBonus);
    this.appliedAttackSpeedBonus=this.afterimages.reduce((sum,a)=>sum+(a.attackSpeedBonus||0),0);
    playerData.attackSpeedMultiplier=Math.max(0.2,base+this.appliedAttackSpeedBonus);
  }

  update(time){
    const player=this.scene.player;
    if(!player) return;
    this.afterimages.slice().forEach((afterimage,index)=>{
      if(afterimage.expiresAt&&time>=afterimage.expiresAt){ this.removeAfterimage(afterimage.id,'expired'); return; }
      if(!afterimage.view) return;
      const row=index%3;
      const column=Math.floor(index/3);
      const targetX=player.x-42-(row*38)-(column*14);
      const targetY=player.y-52+(row-1)*18;
      afterimage.view.x+=(targetX-afterimage.view.x)*0.22;
      afterimage.view.y+=(targetY-afterimage.view.y)*0.22;
      afterimage.view.flipX=player.flipX;
    });
  }

  shiftTimers(pausedDuration,pausedAt){ this.afterimages.forEach(a=>{ if(a.expiresAt>pausedAt) a.expiresAt+=pausedDuration; }); }

  reset(){
    this.afterimages.slice().forEach(a=>this.removeAfterimage(a.id,'reset'));
    this.echoHandlers.clear();
    this.nextId=1;
    if(this.scene.playerData&&this.appliedAttackSpeedBonus){ this.scene.playerData.attackSpeedMultiplier=Math.max(0.2,(this.scene.playerData.attackSpeedMultiplier||1)-this.appliedAttackSpeedBonus); }
    this.appliedAttackSpeedBonus=0;
  }

  destroy(){ this.reset(); }
}
