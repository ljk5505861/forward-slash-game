import Phaser from 'phaser';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig.js';
import { SKILLS } from '../config/skills.js';
import { getRarity } from '../config/rarities.js';
import { makeInteractive } from './interactive.js';

const SLOTS_PER_PAGE = 3;

export default class SkillBar {
  constructor(scene) {
    this.scene = scene;
    this.page = 0;
    this.nodes = [];
    this.slotNodes = [];
    this.create();
  }

  create() {
    const y = DESIGN_HEIGHT - 112;
    const bg = this.scene.add.rectangle(DESIGN_WIDTH / 2, y, DESIGN_WIDTH - 32, 176, 0x10172a, 0.82)
      .setStrokeStyle(3, 0x40598f, 0.95)
      .setScrollFactor(0)
      .setDepth(2100);

    this.prevButton = this.createButton(54, y, '‹', () => this.turnPage(-1));
    this.nextButton = this.createButton(DESIGN_WIDTH - 54, y, '›', () => this.turnPage(1));
    this.pageText = this.scene.add.text(DESIGN_WIDTH / 2, y - 76, '', {
      fontFamily: 'Arial', fontSize: '18px', color: '#cfe0ff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2102);

    this.nodes.push(bg, this.prevButton, this.nextButton, this.pageText);
    for (let i = 0; i < SLOTS_PER_PAGE; i += 1) {
      const x = 154 + i * 206;
      const box = this.scene.add.rectangle(x, y + 10, 176, 112, 0x1f3158, 0.96)
        .setStrokeStyle(3, 0x89a8e8, 1)
        .setScrollFactor(0)
        .setDepth(2101);
      const text = this.scene.add.text(x, y + 10, '', {
        fontFamily: 'Arial', fontSize: '20px', color: '#ffffff', align: 'center', stroke: '#000', strokeThickness: 3, wordWrap: { width: 154 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2102);
      this.slotNodes.push({ box, text });
      this.nodes.push(box, text);
    }
    this.update();
  }

  createButton(x, y, label, onClick) {
    return makeInteractive(this.scene.add.text(x, y + 10, label, {
      fontFamily: 'Arial', fontSize: '42px', color: '#fff', backgroundColor: '#263a68', padding: { left: 16, right: 16, top: 4, bottom: 8 },
    }).setOrigin(0.5).setScrollFactor(0)).setDepth(2102).on('pointerdown', onClick);
  }

  turnPage(delta) {
    const pages = this.getPageCount();
    this.page = Phaser.Math.Wrap(this.page + delta, 0, pages);
    this.update();
  }

  getPageCount() {
    return Math.max(1, Math.ceil(this.scene.playerData.skills.length / SLOTS_PER_PAGE));
  }

  update() {
    const skills = this.scene.playerData.skills;
    const pages = this.getPageCount();
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    this.pageText.setText(`技能 ${this.page + 1}/${pages}`);
    this.prevButton.setAlpha(pages > 1 ? 1 : 0.35);
    this.nextButton.setAlpha(pages > 1 ? 1 : 0.35);

    this.slotNodes.forEach(({ box, text }, index) => {
      const skillData = skills[this.page * SLOTS_PER_PAGE + index];
      if (!skillData) {
        text.setText('空技能槽'); box.setStrokeStyle(3,0x89a8e8,1);
        return;
      }
      const cfg = SKILLS[skillData.id];
      const rarity = getRarity(cfg?.rarity);
      box.setStrokeStyle(4, rarity.color, 1);
      const readyAt = this.scene.skillSystem?.cooldowns.get(skillData.id) || 0;
      const remaining = Math.max(0, Math.ceil((readyAt - this.scene.getGameplayTime()) / 1000));
      text.setText(`${rarity.name} ${cfg?.name || skillData.id}\nLv.${skillData.level}\n${remaining > 0 ? `冷却 ${remaining}s` : '就绪'}`);
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
