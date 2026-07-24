import Phaser from 'phaser';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { SKILLS } from '../config/skills.js';
import { getRarity } from '../config/rarities.js';
import { getSkillDetailData } from './skillDetailContent.js';
import { MYRIAD_AFTERIMAGE_SKILL_ID, getMyriadAfterimageDetailState, openMyriadAfterimageSelection } from '../skills/handlers/AfterimageUltimateSkills.js';
import { getSkillBarStateText } from './skillBarState.js';
import { MANTRA_HEAVENLY_BOOK_ID, openMantraHeavenlyBookSelection } from '../skills/handlers/MantraHeavenlyBookSkill.js';

export const SKILL_DETAIL_LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_CANCEL_PX = 18;
const DRAG_THRESHOLD_PX = 6;
const DEFAULT_DETAIL_BODY_VISIBLE_HEIGHT = 430;
const MYRIAD_DETAIL_BODY_VISIBLE_HEIGHT = 300;
const DETAIL_COPY_BUTTON_HEIGHT = 116;
const DETAIL_COPY_BUTTON_WIDTH = 660;
const SKILL_SLOT_COUNT = 6;
const COLUMNS = 3;
const SLOT_W = 196;
const SLOT_H = 88;
const SLOT_GAP_X = 224;
const SLOT_GAP_Y = 94;
const SOUL_BADGE_SKILLS = new Set(['sword_wave','sword_tomb']);

export default class SkillBar {
  constructor(scene) { this.scene = scene; this.nodes = []; this.slotNodes = []; this.longPress = null; this.detail = null; this.destroyed = false; this.create(); }

  create() {
    const centerY = DESIGN_HEIGHT - 118;
    const bg = this.scene.add.rectangle(DESIGN_WIDTH / 2, centerY, DESIGN_WIDTH - 28, 218, 0x10172a, 0.84).setStrokeStyle(3, 0x40598f, 0.95).setScrollFactor(0).setDepth(2100);
    const title = this.scene.add.text(DESIGN_WIDTH / 2, centerY - 98, '', { fontFamily: 'Arial', fontSize: '17px', color: '#cfe0ff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(2102);
    this.nodes.push(bg, title); this.title = title;
    for (let i = 0; i < SKILL_SLOT_COUNT; i += 1) {
      const column = i % COLUMNS, row = Math.floor(i / COLUMNS);
      const x = DESIGN_WIDTH / 2 + (column - 1) * SLOT_GAP_X, y = centerY - 42 + row * SLOT_GAP_Y;
      const box = this.scene.add.rectangle(x, y, SLOT_W, SLOT_H, 0x1f3158, 0.96).setStrokeStyle(3, 0x89a8e8, 1).setScrollFactor(0).setDepth(2101);
      const text = this.scene.add.text(x, y, '', { fontFamily: 'Arial', fontSize: '17px', color: '#ffffff', align: 'center', stroke: '#000', strokeThickness: 3, wordWrap: { width: SLOT_W - 14 } }).setOrigin(0.5).setScrollFactor(0).setDepth(2102);
      const soulBadge = this.scene.add.text(x + SLOT_W / 2 - 8, y - SLOT_H / 2 + 6, '', { fontFamily:'Arial', fontSize:'15px', color:'#ffd166', stroke:'#000', strokeThickness:4 }).setOrigin(1,0).setScrollFactor(0).setDepth(2103).setVisible(false);
      const slotIndex = i;
      box.setInteractive({ useHandCursor:true })
        .on('pointerdown', (pointer) => this.onSlotPointerDown(slotIndex, pointer, box))
        .on('pointermove', (pointer) => this.onSlotPointerMove(slotIndex, pointer, box))
        .on('pointerup', (pointer) => this.onSlotPointerUp(slotIndex, pointer))
        .on('pointerupoutside', (pointer) => this.cancelLongPress(pointer))
        .on('pointercancel', (pointer) => this.cancelLongPress(pointer))
        .on('pointerout', (pointer) => this.cancelLongPress(pointer));
      this.slotNodes.push({ box, text, soulBadge }); this.nodes.push(box, text, soulBadge);
    }
    this.update();
  }

  onSlotPointerDown(slotIndex, pointer, box) {
    if (this.scene.upgradeSystem?.pendingReplacement) return;
    const skillData = this.scene.playerData.skills[slotIndex]; if (!skillData) return;
    const startingSkillId = skillData.id;
    this.cancelLongPress();
    const timer = this.scene.time.delayedCall(SKILL_DETAIL_LONG_PRESS_MS, () => {
      const currentSkill = this.scene.playerData.skills[slotIndex];
      if (this.destroyed || !this.longPress || this.longPress.pointerId !== pointer.id || this.longPress.slotIndex !== slotIndex) return;
      if (!currentSkill || currentSkill.id !== startingSkillId || this.scene.upgradeSystem?.pendingReplacement) { this.cancelLongPress(pointer); return; }
      this.longPress.triggered = true; this.showDetail(slotIndex);
    });
    this.longPress = { slotIndex, pointerId:pointer.id, startX:pointer.x, startY:pointer.y, triggered:false, timer, box };
  }
  onSlotPointerMove(slotIndex, pointer, box) {
    const lp=this.longPress; if(!lp || lp.pointerId!==pointer.id || lp.slotIndex!==slotIndex || lp.triggered) return;
    const moved=Math.hypot(pointer.x-lp.startX, pointer.y-lp.startY);
    const b=box.getBounds();
    if(moved>LONG_PRESS_MOVE_CANCEL_PX || !Phaser.Geom.Rectangle.Contains(b,pointer.x,pointer.y)) this.cancelLongPress(pointer);
  }
  onSlotPointerUp(slotIndex, pointer) {
    const lp=this.longPress;
    if (this.scene.upgradeSystem?.pendingReplacement) { this.cancelLongPress(pointer); this.scene.upgradeSystem.confirmReplacement(slotIndex); return; }
    if(!lp || lp.pointerId!==pointer.id) return;
    const triggered=lp.triggered; this.cancelLongPress(pointer); if(triggered) return;
    if(this.scene.playerData.skills[slotIndex]?.id===MANTRA_HEAVENLY_BOOK_ID) openMantraHeavenlyBookSelection(this.scene);
  }
  cancelLongPress(pointer=null){ if(pointer&&this.longPress&&this.longPress.pointerId!==pointer.id) return; this.longPress?.timer?.remove?.(false); this.longPress=null; }

  showDetail(slotIndex){ const skill=this.scene.playerData.skills[slotIndex]; if(!skill) return; const data=getSkillDetailData(skill.id,{ scene:this.scene, skill }); if(!data) return; this.hideDetail(); this.detailScrollY=0; this.detailData=data; const depth=5000;
    const hasFixedCopyButton=skill.id===MYRIAD_AFTERIMAGE_SKILL_ID;
    const bodyVisibleHeight=hasFixedCopyButton?MYRIAD_DETAIL_BODY_VISIBLE_HEIGHT:DEFAULT_DETAIL_BODY_VISIBLE_HEIGHT;
    const maskCenterY=DESIGN_HEIGHT/2+(hasFixedCopyButton?-30:35);
    const bodyBaseY=DESIGN_HEIGHT/2-(hasFixedCopyButton?180:165);
    const overlay=this.scene.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,DESIGN_WIDTH,DESIGN_HEIGHT,0x000000,0.55).setScrollFactor(0).setDepth(depth).setInteractive();
    const panel=this.scene.add.rectangle(DESIGN_WIDTH/2,DESIGN_HEIGHT/2,760,560,0x132039,0.98).setStrokeStyle(4,0x8fb3ff,1).setScrollFactor(0).setDepth(depth+1).setInteractive();
    const title=this.scene.add.text(DESIGN_WIDTH/2-340,DESIGN_HEIGHT/2-250,`${data.name}\n等级：${data.level}/${data.maxLevel}`,{fontFamily:'Arial',fontSize:'24px',color:'#ffffff',stroke:'#000',strokeThickness:4}).setScrollFactor(0).setDepth(depth+3);
    const close=this.scene.add.text(DESIGN_WIDTH/2+330,DESIGN_HEIGHT/2-250,'×',{fontFamily:'Arial',fontSize:'34px',color:'#fff',backgroundColor:'#7f1d1d',padding:{left:12,right:12,top:2,bottom:2}}).setOrigin(0.5).setScrollFactor(0).setDepth(depth+6).setInteractive({useHandCursor:true});
    const maskShape=this.scene.add.rectangle(DESIGN_WIDTH/2,maskCenterY,700,bodyVisibleHeight,0xffffff,0).setScrollFactor(0).setVisible(false);
    const mask=maskShape.createGeometryMask();
    const body=this.scene.add.container(DESIGN_WIDTH/2-340,bodyBaseY).setScrollFactor(0).setDepth(depth+2).setMask(mask);
    const bodyText=this.scene.add.text(0,0,this.formatDetail(data),{fontFamily:'Arial',fontSize:'20px',color:'#eaf2ff',stroke:'#000',strokeThickness:3,lineSpacing:8,wordWrap:{width:680}}).setOrigin(0,0);
    body.add(bodyText);
    const nodes=[overlay,panel,title,close,maskShape,body];
    const contentHeight=bodyText.height;
    const copyButton=this.createMyriadCopyButton(skill.id, slotIndex, depth);
    if(copyButton) nodes.push(...copyButton.nodes);
    this.detail={overlay,panel,title,close,maskShape,mask,body,bodyText,copyButton,bodyBaseY,bodyVisibleHeight,scrollY:0,maxScroll:Math.max(0,contentHeight-bodyVisibleHeight),isDragging:false,dragPointerId:null,dragStartY:0,dragStartScrollY:0,hasDragged:false,nodes};
    overlay.on('pointerdown',()=>this.hideDetail()); close.on('pointerdown',()=>this.hideDetail());
    panel.on('pointerdown',(p)=>this.startScroll(p)); panel.on('pointermove',(p)=>this.dragScroll(p)); panel.on('pointerup',(p)=>this.endScroll(p)); panel.on('pointerupoutside',(p)=>this.endScroll(p)); panel.on('pointercancel',(p)=>this.endScroll(p)); panel.on('wheel',(_p,_dx,dy)=>this.wheelScroll(dy));
    bodyText.setInteractive(new Phaser.Geom.Rectangle(0,0,700,Math.max(bodyVisibleHeight,bodyText.height)), Phaser.Geom.Rectangle.Contains).on('pointerdown',(p)=>this.startScroll(p)).on('pointermove',(p)=>this.dragScroll(p)).on('pointerup',(p)=>this.endScroll(p)).on('pointerupoutside',(p)=>this.endScroll(p)).on('pointercancel',(p)=>this.endScroll(p)).on('wheel',(_p,_dx,dy)=>this.wheelScroll(dy));
    this.applyScroll(); }
  createMyriadCopyButton(skillId, slotIndex, depth){
    if(skillId!==MYRIAD_AFTERIMAGE_SKILL_ID) return null;
    const state=getMyriadAfterimageDetailState(this.scene);
    const enabled=state.changeCount>0;
    const x=DESIGN_WIDTH/2, y=DESIGN_HEIGHT/2+204;
    const bg=this.scene.add.rectangle(x,y,DETAIL_COPY_BUTTON_WIDTH,DETAIL_COPY_BUTTON_HEIGHT,enabled?0x2f4f86:0x263044,enabled?0.96:0.72).setStrokeStyle(3,enabled?0xd8b4fe:0x697086,1).setScrollFactor(0).setDepth(depth+3);
    const label=this.scene.add.text(x,y,`【残影复制】\n当前复制：${state.skillName}\n剩余更换次数：${state.changeCount}\n${enabled?'点击此处更换复制技能':'暂无更换次数'}`,{fontFamily:'Arial',fontSize:'20px',color:enabled?'#ffffff':'#9ca3af',align:'center',stroke:'#000',strokeThickness:3,lineSpacing:7}).setOrigin(0.5).setScrollFactor(0).setDepth(depth+4);
    const openSelection=(_pointer,_localX,_localY,event)=>{
      event?.stopPropagation?.();
      const detailSlotIndex=slotIndex;
      this.hideDetail();
      const reopen=()=>this.showDetail(detailSlotIndex);
      const opened=openMyriadAfterimageSelection(this.scene,reopen,reopen);
      if(!opened) reopen();
    };
    if(enabled){
      bg.setInteractive({useHandCursor:true}).on('pointerdown',openSelection);
    }
    return {nodes:[bg,label],bg,label,bounds:new Phaser.Geom.Rectangle(x-DETAIL_COPY_BUTTON_WIDTH/2,y-DETAIL_COPY_BUTTON_HEIGHT/2,DETAIL_COPY_BUTTON_WIDTH,DETAIL_COPY_BUTTON_HEIGHT)};
  }
  formatDetail(d){ const secs=[['技能说明',[d.description]],['当前效果',d.currentEffects],['特殊机制',d.mechanics],['3/6/9级强化',d.milestones.map(m=>`${m.unlocked?'✓':'○'} ${m.level}级：${m.text}`)],['下一等级预览',d.nextLevelPreview]]; return secs.map(([h,arr])=>`【${h}】\n${(arr||[]).join('\n')}`).join('\n\n'); }
  startScroll(pointer){ if(!this.detail || this.isPointerInCopyButton(pointer)) return; this.detail.isDragging=true; this.detail.dragPointerId=pointer.id; this.detail.dragStartY=pointer.y; this.detail.dragStartScrollY=this.detail.scrollY; this.detail.hasDragged=false; }
  dragScroll(pointer){ const d=this.detail; if(!d?.isDragging||d.dragPointerId!==pointer.id) return; const delta=pointer.y-d.dragStartY; if(Math.abs(delta)>DRAG_THRESHOLD_PX) d.hasDragged=true; if(d.hasDragged){ d.scrollY=Phaser.Math.Clamp(d.dragStartScrollY-delta,0,d.maxScroll); this.applyScroll(); } }
  endScroll(pointer){ const d=this.detail; if(!d||d.dragPointerId!==pointer.id) return; d.isDragging=false; d.dragPointerId=null; }
  wheelScroll(deltaY){ if(!this.detail) return; this.detail.scrollY=Phaser.Math.Clamp(this.detail.scrollY+deltaY,0,this.detail.maxScroll); this.applyScroll(); }
  applyScroll(){ if(this.detail) this.detail.body.y=this.detail.bodyBaseY-this.detail.scrollY; }
  isPointerInCopyButton(pointer){ const bounds=this.detail?.copyButton?.bounds; return !!bounds&&Phaser.Geom.Rectangle.Contains(bounds,pointer.x,pointer.y); }
  hideDetail(){ if(!this.detail) return; const detail=this.detail; this.detail=null; [detail.overlay,detail.panel,detail.close,detail.bodyText].forEach(n=>n?.removeAllListeners?.()); detail.mask?.destroy?.(); detail.nodes.forEach(n=>n?.destroy?.()); }

  update() { const skills = this.scene.playerData.skills; const replacing = !!this.scene.upgradeSystem?.pendingReplacement; const soulCount=Math.floor(Number(this.scene.skillSystem?.passiveState?.swordFlow?.effectiveSouls)||0); this.title.setText(replacing ? '请选择要替换的技能' : `技能槽 ${Math.min(skills.length, SKILL_SLOT_COUNT)}/${SKILL_SLOT_COUNT}`);
    this.slotNodes.forEach(({ box, text, soulBadge }, index) => { const skillData = skills[index]; if (!skillData) { text.setText('空技能槽'); soulBadge.setText('').setVisible(false); box.setFillStyle(0x1f3158, 0.96); box.setStrokeStyle(replacing ? 5 : 3, replacing ? 0xffd166 : 0x89a8e8, 1); return; } const cfg = SKILLS[skillData.id]; const rarity = getRarity(cfg?.rarity); box.setFillStyle(0x1f3158, 0.96); box.setStrokeStyle(replacing ? 5 : 4, replacing ? 0xffd166 : rarity.color, 1); const state = getSkillBarStateText(this.scene, skillData, cfg); const mantra=skillData.id===MANTRA_HEAVENLY_BOOK_ID?(this.scene.playerData.mantraHeavenlyBookMode||'未选'):''; text.setText(`${rarity.name} ${cfg?.name || skillData.id}${mantra?`·${mantra}`:''}\nLv.${skillData.level}　${state}`); const showSouls=SOUL_BADGE_SKILLS.has(skillData.id); soulBadge.setText(showSouls?`魂 ${soulCount}`:'').setVisible(showSouls); }); }
  destroy() { this.destroyed = true; this.cancelLongPress(); this.hideDetail(); this.nodes.forEach((node) => { node.removeAllListeners?.(); node.destroy?.(); }); this.nodes = []; this.slotNodes = []; }
}
