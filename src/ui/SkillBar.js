import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { SKILLS } from '../config/skills.js';
import { getRarity } from '../config/rarities.js';
import { getSkillDetailData } from './skillDetailData.js';

const SKILL_SLOT_COUNT = 6;
const COLUMNS = 3;
const SLOT_W = 196;
const SLOT_H = 88;
const SLOT_GAP_X = 224;
const SLOT_GAP_Y = 94;
export const SKILL_DETAIL_LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_CANCEL_PX = 18;

export default class SkillBar {
  constructor(scene) {
    this.scene = scene;
    this.nodes = [];
    this.slotNodes = [];
    this.longPress = null;
    this.detailNodes = [];
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
      box.setInteractive({ useHandCursor:true })
        .on('pointerdown', (pointer) => this.onSlotPointerDown(slotIndex, pointer, box))
        .on('pointermove', (pointer) => this.onSlotPointerMove(pointer, box))
        .on('pointerup', () => this.onSlotPointerUp(slotIndex))
        .on('pointerout', (pointer) => this.onSlotPointerMove(pointer, box, true));
      this.slotNodes.push({ box, text });
      this.nodes.push(box, text);
    }
    this.update();
  }


  onSlotPointerDown(slotIndex, pointer, box) {
    const skillData = this.scene.playerData.skills[slotIndex];
    this.clearLongPress();
    this.longPress = {
      slotIndex,
      pointerId: pointer?.id,
      startX: pointer?.x || 0,
      startY: pointer?.y || 0,
      triggered: false,
      timer: this.scene.time.delayedCall(SKILL_DETAIL_LONG_PRESS_MS, () => {
        if (!this.longPress || this.longPress.slotIndex !== slotIndex || !skillData) return;
        this.longPress.triggered = true;
        this.showSkillDetail(skillData.id, skillData);
      }),
      box,
    };
  }

  onSlotPointerMove(pointer, box, forceCheck = false) {
    if (!this.longPress || (pointer?.id !== undefined && pointer.id !== this.longPress.pointerId)) return;
    const dx = (pointer?.x || 0) - this.longPress.startX;
    const dy = (pointer?.y || 0) - this.longPress.startY;
    const bounds = box.getBounds?.();
    const outside = bounds && !bounds.contains(pointer?.x || 0, pointer?.y || 0);
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_CANCEL_PX || (forceCheck && outside)) this.clearLongPress();
  }

  onSlotPointerUp(slotIndex) {
    const wasLongPress = !!this.longPress?.triggered;
    this.clearLongPress();
    if (wasLongPress) return;
    if (this.scene.upgradeSystem?.pendingReplacement) this.scene.upgradeSystem.confirmReplacement(slotIndex);
  }

  clearLongPress() {
    this.longPress?.timer?.remove?.(false);
    this.longPress = null;
  }

  showSkillDetail(skillId, skillEntry) {
    const data = getSkillDetailData(skillId, { scene: this.scene, skillSystem: this.scene.skillSystem, skillEntry });
    if (!data) return;
    this.hideSkillDetail();
    const overlay = this.scene.add.rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0x000000, 0.22).setScrollFactor(0).setDepth(3200).setInteractive();
    overlay.on('pointerdown', () => this.hideSkillDetail());
    const panelW = Math.min(660, DESIGN_WIDTH - 48);
    const panelH = Math.min(760, DESIGN_HEIGHT - 280);
    const panelX = DESIGN_WIDTH / 2;
    const panelY = DESIGN_HEIGHT / 2 + 40;
    const panel = this.scene.add.rectangle(panelX, panelY, panelW, panelH, 0x13203a, 0.97).setStrokeStyle(4, 0x8fb7ff, 1).setScrollFactor(0).setDepth(3201).setInteractive();
    const close = this.scene.add.text(panelX + panelW / 2 - 30, panelY - panelH / 2 + 26, '×', { fontFamily:'Arial', fontSize:'34px', color:'#ffffff', stroke:'#000', strokeThickness:4 }).setOrigin(0.5).setScrollFactor(0).setDepth(3203).setInteractive({ useHandCursor:true });
    close.on('pointerdown', () => this.hideSkillDetail());
    const lines = [];
    lines.push(`${data.name}\n等级：${data.level}/${data.maxLevel}`);
    lines.push(`技能说明：\n${data.description}`);
    if (data.currentEffects?.length) lines.push(`当前效果：\n${data.currentEffects.map(f => `${f.label}：${f.value}`).join('\n')}`);
    if (data.mechanics?.length) lines.push(`特殊机制：\n${data.mechanics.join('\n')}`);
    lines.push(data.milestones.map(m => `${m.level}级强化（${m.unlocked ? '已解锁' : '未解锁'}）：${m.text}`).join('\n'));
    lines.push(`下一等级预览：\n${data.nextLevelPreview}`);
    const body = this.scene.add.text(panelX - panelW / 2 + 26, panelY - panelH / 2 + 24, lines.join('\n\n'), {
      fontFamily:'Arial', fontSize:'21px', color:'#eef5ff', stroke:'#000', strokeThickness:3, lineSpacing:7, wordWrap:{ width:panelW - 56 },
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(3202);
    body.setInteractive();
    const maskShape = this.scene.add.rectangle(panelX, panelY + 12, panelW - 28, panelH - 76, 0xffffff, 0).setScrollFactor(0).setVisible(false);
    const mask = maskShape.createGeometryMask();
    body.setMask(mask);
    let scrollY = 0;
    const maxScroll = () => Math.max(0, body.height - (panelH - 78));
    const applyScroll = () => body.setY(panelY - panelH / 2 + 24 - scrollY);
    panel.on('wheel', (_p, _x, _y, dy) => { scrollY = Math.max(0, Math.min(maxScroll(), scrollY + dy)); applyScroll(); });
    this.detailNodes.push(overlay, panel, close, body, maskShape);
  }

  hideSkillDetail() {
    this.detailNodes.forEach(n => { n.removeAllListeners?.(); n.destroy?.(); });
    this.detailNodes = [];
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

  destroy() {
    this.clearLongPress();
    this.hideSkillDetail();
    this.nodes.forEach((node) => {
      node.removeAllListeners?.();
      node.destroy?.();
    });
    this.nodes = [];
    this.slotNodes = [];
  }
}
