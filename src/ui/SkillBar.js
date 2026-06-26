import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { SKILLS } from '../config/skills.js';
import { getRarity } from '../config/rarities.js';
import { getSkillDetailData } from './skillDetailContent.js';

const SKILL_SLOT_COUNT = 6;
const COLUMNS = 3;
const SLOT_W = 196;
const SLOT_H = 88;
const SLOT_GAP_X = 224;
const SLOT_GAP_Y = 94;

export default class SkillBar {
  constructor(scene) {
    this.scene = scene;
    this.nodes = [];
    this.slotNodes = [];
    this.detailNodes = [];
    this.detailScroll = null;
    this.create();
  }

  create() {
    const centerY = DESIGN_HEIGHT - 118;
    const bg = this.scene.add.rectangle(DESIGN_WIDTH / 2, centerY, DESIGN_WIDTH - 28, 218, 0x10172a, 0.84)
      .setStrokeStyle(3, 0x40598f, 0.95)
      .setScrollFactor(0)
      .setDepth(2100);
    const title = this.scene.add.text(DESIGN_WIDTH / 2, centerY - 98, '', {
      fontFamily: 'Arial', fontSize: '17px', color: '#cfe0ff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2102);

    this.nodes.push(bg, title);
    this.title = title;

    for (let i = 0; i < SKILL_SLOT_COUNT; i += 1) {
      const column = i % COLUMNS;
      const row = Math.floor(i / COLUMNS);
      const x = DESIGN_WIDTH / 2 + (column - 1) * SLOT_GAP_X;
      const y = centerY - 42 + row * SLOT_GAP_Y;
      const box = this.scene.add.rectangle(x, y, SLOT_W, SLOT_H, 0x1f3158, 0.96)
        .setStrokeStyle(3, 0x89a8e8, 1)
        .setScrollFactor(0)
        .setDepth(2101);
      const text = this.scene.add.text(x, y, '', {
        fontFamily: 'Arial', fontSize: '17px', color: '#ffffff', align: 'center', stroke: '#000', strokeThickness: 3, wordWrap: { width: SLOT_W - 14 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2102);
      const slotIndex = i;
      box.setInteractive({ useHandCursor:true }).on('pointerdown', () => {
        if (this.scene.upgradeSystem?.pendingReplacement) this.scene.upgradeSystem.confirmReplacement(slotIndex);
        else if (this.scene.playerData.skills[slotIndex]) this.showDetail(this.scene.playerData.skills[slotIndex]);
      });
      this.slotNodes.push({ box, text });
      this.nodes.push(box, text);
    }
    this.update();
  }

  update() {
    const skills = this.scene.playerData.skills;
    const replacing = !!this.scene.upgradeSystem?.pendingReplacement;
    this.title.setText(replacing ? '请选择要替换的技能' : `技能槽 ${Math.min(skills.length, SKILL_SLOT_COUNT)}/${SKILL_SLOT_COUNT}`);

    this.slotNodes.forEach(({ box, text }, index) => {
      const skillData = skills[index];
      if (!skillData) {
        text.setText('空技能槽');
        box.setFillStyle(0x1f3158, 0.96);
        box.setStrokeStyle(replacing ? 5 : 3, replacing ? 0xffd166 : 0x89a8e8, 1);
        return;
      }
      const cfg = SKILLS[skillData.id];
      const rarity = getRarity(cfg?.rarity);
      box.setFillStyle(0x1f3158, 0.96);
      box.setStrokeStyle(replacing ? 5 : 4, replacing ? 0xffd166 : rarity.color, 1);
      const readyAt = this.scene.skillSystem?.cooldowns.get(skillData.id) || 0;
      const remaining = Math.max(0, Math.ceil((readyAt - this.scene.getGameplayTime()) / 1000));
      const state = skillData.level >= (cfg?.maxLevel || 1) ? '已满级' : (remaining > 0 ? `冷却 ${remaining}s` : '就绪');
      text.setText(`${rarity.name} ${cfg?.name || skillData.id}\nLv.${skillData.level}　${state}`);
    });
  }

  stopEvent(pointer) {
    pointer?.event?.stopPropagation?.();
  }

  hideDetail() {
    this.detailNodes.forEach((node) => { node.removeAllListeners?.(); node.destroy?.(); });
    this.detailNodes = [];
    this.detailScroll = null;
  }

  showDetail(skillData) {
    this.hideDetail();
    const data = getSkillDetailData(skillData.id, { skill: skillData, level: skillData.level });
    const s = this.scene;
    const x = DESIGN_WIDTH / 2;
    const y = DESIGN_HEIGHT / 2;
    const panelW = 650;
    const panelH = 820;
    const bodyX = x - panelW / 2 + 34;
    const bodyY = y - panelH / 2 + 128;
    const bodyW = panelW - 68;
    const bodyH = panelH - 178;
    const overlay = s.add.rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0x020814, 0.52).setScrollFactor(0).setDepth(5000).setInteractive();
    const panel = s.add.rectangle(x, y, panelW, panelH, 0x0b1020, 0.98).setStrokeStyle(4, 0x8fb4ff, 0.95).setScrollFactor(0).setDepth(5001).setInteractive();
    const title = s.add.text(x - panelW / 2 + 34, y - panelH / 2 + 34, `${data.name}  Lv.${data.level}/${data.maxLevel}`, { fontFamily:'Arial', fontSize:'31px', color:'#ffffff', stroke:'#000', strokeThickness:4 }).setScrollFactor(0).setDepth(5002);
    const close = s.add.text(x + panelW / 2 - 34, y - panelH / 2 + 30, '关闭', { fontFamily:'Arial', fontSize:'22px', color:'#fff', backgroundColor:'#334155', padding:{ left:12, right:12, top:8, bottom:8 } }).setOrigin(1, 0).setScrollFactor(0).setInteractive({ useHandCursor:true }).setDepth(5003);
    const lines = [
      '能力说明', data.description, '',
      '当前效果', data.currentEffect || '无', '',
      '特殊机制', data.specialRules, '',
      '3/6/9级强化', ...data.milestones.map((m) => `${m.unlocked ? '已解锁' : '未解锁'} Lv.${m.level}：${m.text}`), '',
      '下一等级预览', data.nextPreview,
    ];
    const body = s.add.text(bodyX, bodyY, lines.join('\n'), { fontFamily:'Arial', fontSize:'22px', color:'#eaf2ff', stroke:'#000', strokeThickness:3, lineSpacing:9, wordWrap:{ width:bodyW, useAdvancedWrap:true } }).setScrollFactor(0).setDepth(5002);
    const maskShape = s.add.graphics().setScrollFactor(0).setDepth(5002);
    maskShape.fillStyle(0xffffff, 1).fillRect(bodyX, bodyY, bodyW, bodyH);
    const mask = maskShape.createGeometryMask();
    body.setMask(mask);
    const hit = s.add.rectangle(bodyX + bodyW / 2, bodyY + bodyH / 2, bodyW, bodyH, 0xffffff, 0.001).setScrollFactor(0).setDepth(5004).setInteractive();
    const scrollState = { scrollY:0, maxScroll:Math.max(0, body.height - bodyH), isDragging:false, hasDragged:false, dragPointerId:null, dragStartY:0, dragStartScrollY:0, threshold:6 };
    const applyScroll = (value) => { scrollState.scrollY = Math.max(0, Math.min(scrollState.maxScroll, value)); body.y = bodyY - scrollState.scrollY; };
    const insidePanel = (pointer) => pointer.x >= x - panelW / 2 && pointer.x <= x + panelW / 2 && pointer.y >= y - panelH / 2 && pointer.y <= y + panelH / 2;
    overlay.on('pointerdown', (pointer) => { if (!insidePanel(pointer)) this.hideDetail(); });
    [panel, hit, body, title].forEach((node) => node.on?.('pointerdown', (pointer) => this.stopEvent(pointer)));
    close.on('pointerdown', (pointer) => { this.stopEvent(pointer); this.hideDetail(); });
    panel.on('wheel', (pointer, dx, dy) => { this.stopEvent(pointer); applyScroll(scrollState.scrollY + dy); });
    hit.on('wheel', (pointer, dx, dy) => { this.stopEvent(pointer); applyScroll(scrollState.scrollY + dy); });
    hit.on('pointerdown', (pointer) => { this.stopEvent(pointer); scrollState.isDragging = true; scrollState.hasDragged = false; scrollState.dragPointerId = pointer.id; scrollState.dragStartY = pointer.y; scrollState.dragStartScrollY = scrollState.scrollY; });
    hit.on('pointermove', (pointer) => {
      if (!scrollState.isDragging || pointer.id !== scrollState.dragPointerId) return;
      this.stopEvent(pointer);
      const deltaY = pointer.y - scrollState.dragStartY;
      if (Math.abs(deltaY) >= scrollState.threshold) scrollState.hasDragged = true;
      if (scrollState.hasDragged) applyScroll(scrollState.dragStartScrollY - deltaY);
    });
    const endDrag = (pointer) => { if (pointer?.id === scrollState.dragPointerId) { this.stopEvent(pointer); scrollState.isDragging = false; scrollState.dragPointerId = null; } };
    hit.on('pointerup', endDrag);
    hit.on('pointerupoutside', endDrag);
    hit.on('pointercancel', endDrag);
    this.detailNodes = [overlay, panel, title, close, body, maskShape, hit];
    this.detailScroll = scrollState;
    applyScroll(0);
  }

  destroy() {
    this.hideDetail();
    this.nodes.forEach((node) => {
      node.removeAllListeners?.();
      node.destroy?.();
    });
    this.nodes = [];
    this.slotNodes = [];
  }
}
