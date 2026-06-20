import Phaser from 'phaser';
import { getProfession } from '../config/professions.js';

export default class ProfessionWeaponView {
  constructor(scene){ this.scene=scene; this.container=null; this.weaponId=null; this.floatTween=null; }
  refresh(){ const cfg=getProfession(this.scene.playerData?.professionId); const id=cfg?.professionWeaponId || null; if(!id){ this.clear(); return; } if(this.weaponId===id && this.container?.active) return; this.clear(); this.weaponId=id; this.container=this.scene.add.container(this.scene.player.x,this.scene.player.y).setDepth(34); this.build(id); }
  build(id){ if(id==='wanderer_sword') this.buildSword(); else if(id==='forbidden_book') this.buildBook(); else if(id==='wild_bow') this.buildBow(); }
  buildSword(){ const s=this.scene; const blade=s.add.rectangle(38,-38,16,126,0xdfefff,1).setStrokeStyle(4,0x4968ff,1); const hilt=s.add.rectangle(20,18,54,12,0xffd37a,1).setStrokeStyle(3,0x5a3810,1); const grip=s.add.rectangle(20,34,12,35,0x7a4a20,1); const tip=s.add.triangle(38,-110,0,18,16,18,8,0,0xdfefff,1).setStrokeStyle(3,0x4968ff,1); this.container.add([blade,hilt,grip,tip]); this.container.setRotation(Phaser.Math.DegToRad(-28)); }
  buildBook(){ const s=this.scene; const cover=s.add.rectangle(36,-82,72,58,0x4b2b86,1).setStrokeStyle(5,0xd7c6ff,1); const page=s.add.rectangle(44,-82,44,46,0xe8ddc6,1); const gem=s.add.circle(18,-82,9,0x8cf6ff,1).setStrokeStyle(3,0xffffff,0.9); this.container.add([cover,page,gem]); this.floatTween=s.tweens.add({ targets:this.container, y:this.container.y-10, yoyo:true, repeat:-1, duration:900, ease:'Sine.easeInOut' }); }
  buildBow(){ const s=this.scene; const bow=s.add.arc(42,-48,42,300,60,false,0x8b5a2b,1).setStrokeStyle(8,0x8b5a2b,1); const string=s.add.line(0,0,63,-85,63,-11,0xf6f0d0,1).setLineWidth(3); const arrow=s.add.rectangle(48,-48,74,6,0xdfefff,1).setStrokeStyle(2,0x31506e,1); const head=s.add.triangle(90,-48,0,-10,18,0,0,10,0xbff5ff,1); this.container.add([bow,string,arrow,head]); }
  update(){ this.refresh(); if(!this.container) return; const p=this.scene.player; this.container.setPosition(p.x+34,p.y-18); }
  playAttack(profileId){ if(!this.container) return; const s=this.scene; if(profileId==='sword_slash') s.tweens.add({ targets:this.container, rotation:Phaser.Math.DegToRad(42), yoyo:true, duration:85, onComplete:()=>this.container?.setRotation(Phaser.Math.DegToRad(-28)) });
    if(profileId==='arcane_bolt') { const flash=s.add.circle(this.container.x+36,this.container.y-82,24,0x9ee8ff,0.75).setDepth(60); s.tweens.add({targets:flash,scale:1.5,alpha:0,duration:180,onComplete:()=>flash.destroy()}); }
    if(profileId==='hunter_arrow') s.tweens.add({ targets:this.container, scaleX:0.82, x:this.container.x-12, yoyo:true, duration:70, onComplete:()=>this.container?.setScale(1) }); }
  clear(){ this.floatTween?.stop(); this.floatTween=null; this.container?.destroy(); this.container=null; this.weaponId=null; }
  destroy(){ this.clear(); }
}
