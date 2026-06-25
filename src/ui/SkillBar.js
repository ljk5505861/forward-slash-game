import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { SKILLS } from '../config/skills.js';
import { getRarity } from '../config/rarities.js';

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

  destroy() {
    this.nodes.forEach((node) => {
      node.removeAllListeners?.();
      node.destroy?.();
    });
    this.nodes = [];
    this.slotNodes = [];
  }
}
