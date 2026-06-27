import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../src/skills/handlers/index.js';
import { GAME_VERSION } from '../src/config/version.js';
import { SKILLS } from '../src/config/skills.js';
import { getSkillDetailData, validateSkillDetailContent } from '../src/ui/skillDetailContent.js';
import { SWORD_MYTHIC } from '../src/skills/handlers/SwordFlowState.js';

const read=p=>fs.readFileSync(new URL(`../${p}`, import.meta.url),'utf8');
const snapshot=state=>JSON.stringify(state);
const detailAt=(id,level)=>getSkillDetailData(id,{skill:{id,level}});

assert.equal(GAME_VERSION,'0.10.61');
const skillBar=read('src/ui/SkillBar.js');
assert.match(skillBar,/import\s+Phaser\s+from\s+['"]phaser['"]/);
assert.match(skillBar,/SKILL_DETAIL_LONG_PRESS_MS\s*=\s*450/);
assert.match(skillBar,/LONG_PRESS_MOVE_CANCEL_PX\s*=\s*18/);
assert.match(skillBar,/DRAG_THRESHOLD_PX\s*=\s*6/);
assert.match(skillBar,/delayedCall\(SKILL_DETAIL_LONG_PRESS_MS/);
assert.match(skillBar,/\.on\(['"]pointercancel['"],\s*\(pointer\)\s*=>\s*this\.cancelLongPress\(pointer\)\)/);
assert.match(skillBar,/this\.destroyed/);
assert.match(skillBar,/currentSkill\.id\s*!==\s*startingSkillId/);
assert.match(skillBar,/pendingReplacement/);
assert.match(skillBar,/mask\?\.destroy\?\.\(\)/);
assert.match(skillBar,/removeAllListeners/);
assert.match(skillBar,/Clamp\([^,]+,[^,]*0,[^)]*maxScroll/);
for(const ev of ['pointerdown','pointermove','pointerup','pointerupoutside','pointercancel','wheel']) assert.ok(skillBar.includes(ev),ev);

const keys=Object.keys(SKILLS);
assert.equal(keys.length,27);
assert.deepEqual(validateSkillDetailContent(),[]);
for(const id of keys){
  const cfg=SKILLS[id];
  for(let level=1;level<=cfg.maxLevel;level+=1){
    const detail=detailAt(id,level);
    assert.ok(detail.description?.length>8,`${id} description`);
    assert.ok(detail.currentEffects?.length>0,`${id} level ${level} current effects`);
    assert.match(detail.currentEffects.join(' '),/\d/,`${id} level ${level} current effects must contain real values`);
    assert.equal(detail.milestones.length,3,`${id} milestones`);
    assert.deepEqual(detail.milestones.map(item=>item.level),[3,6,9],`${id} milestone levels`);
    detail.milestones.forEach(item=>assert.ok(item.text.length>6&&!item.text.includes('解锁新的战斗表现'),`${id} milestone ${item.level}`));
    if(level<cfg.maxLevel){
      assert.ok(detail.nextLevelPreview?.length>0,`${id} level ${level} next preview`);
      assert.ok(!detail.nextLevelPreview.includes('已达到最高等级'),`${id} level ${level} premature max label`);
      assert.match(detail.nextLevelPreview.join(' '),/[\d是否全部]/,`${id} level ${level} next preview must contain a concrete change`);
    } else assert.deepEqual(detail.nextLevelPreview,['已达到最高等级'],`${id} max level preview`);
  }
}

const giant=detailAt('giant_force',1).currentEffects.join('|');
assert.ok(giant.includes('基础力量+4'));
assert.ok(giant.includes('每点总力量增加3最大生命'));
const bloodthirst=detailAt('bloodthirst',1).currentEffects.join('|');
assert.ok(bloodthirst.includes('普通攻击吸血：5%'));
assert.ok(bloodthirst.includes('持续时间：5秒'));
const sheath=detailAt('sword_sheath',1).currentEffects.join('|');
assert.ok(sheath.includes('温养时间：6秒'));
assert.ok(sheath.includes('剑体尺寸倍率：0.95倍'));
assert.ok(detailAt('last_stand',1).currentEffects.join('|').includes('物理暴击率+15%'));
assert.ok(detailAt('poison_king',1).currentEffects.join('|').includes('撕咬伤害')||detailAt('poison_king',1).currentEffects.join('|').includes('生命'));
const mountain=detailAt('immovable_mountain',1).currentEffects.join('|');
assert.ok(mountain.includes('每层防御加成：3'));
const solar=detailAt('solar_flame',1).currentEffects.join('|');
assert.ok(solar.includes('燃爆伤害：78'));
assert.ok(solar.includes('燃爆范围：100'));
assert.ok(solar.includes('法力消耗：0'));
assert.ok(detailAt('fire_seed',1).currentEffects.join('|').includes('法力消耗：5'));
assert.ok(detailAt('sword_tomb',1).nextLevelPreview.join('|').includes('斩杀线：10% → 11%'));

const detailSource=read('src/ui/skillDetailContent.js');
assert.ok(!detailSource.includes('tryPromoteSwordTomb'));
assert.ok(!detailSource.includes('refreshSwordQuality'));
assert.ok(!detailSource.includes('mainSwordStats('));
assert.ok(detailSource.includes('mainSwordStatsReadOnly'));
assert.ok(detailSource.includes('tombStatsReadOnly'));
assert.ok(detailSource.includes('data.executeRatio'));
assert.ok(!detailSource.includes('executeThreshold'));
assert.ok(!detailSource.includes('eliteExecuteThreshold'));

const fakeSystem={
  passiveState:{ swordFlow:{ totalSouls:91,effectiveSouls:91,soulBreakdown:{normal:1,elite:2,boss:3},affinities:{fire:4,poison:5},mainQuality:'EPIC',mythicOwner:SWORD_MYTHIC.NONE,sheath:{readyAt:1},tomb:{nextAt:2},domain:{views:['keep']} } },
  getLevel(id){ return id==='sword_wave'||id==='sword_tomb'?9:0; },
  getData(id,level){ return SKILLS[id]?.levels?.[level-1]; },
};
const fakeScene={ skillSystem:fakeSystem,playerData:{skills:[{id:'sword_wave',level:9},{id:'sword_tomb',level:9}]} };
const before=snapshot(fakeSystem.passiveState.swordFlow);
getSkillDetailData('sword_wave',{scene:fakeScene});
const tombDetail=getSkillDetailData('sword_tomb',{scene:fakeScene});
assert.equal(snapshot(fakeSystem.passiveState.swordFlow),before,'detail reads must not mutate SwordFlowState');
const tombText=tombDetail.currentEffects.join('|');
assert.ok(tombText.includes('当前斩杀线：18%'),'sword tomb uses executeRatio');
assert.ok(tombText.includes('当前精英斩杀线：10.8%'),'elite execute ratio is executeRatio × 0.6');
for(const word of ['当前总魂魄','当前有效魂魄','当前魂斩伤害','当前魂斩间隔','当前火魂','当前毒魂','当前封神进度','神话名额','万魂剑域']) assert.ok(tombText.includes(word),word);
const swordText=getSkillDetailData('sword_wave',{scene:fakeScene}).currentEffects.join('|');
for(const word of ['当前品质','当前魂魄进度','神话名额','当前伤害','飞行速度','攻击间隔','剑体','剑光','暴击','火魂','毒魂']) assert.ok(swordText.includes(word),word);

const flame=read('src/skills/handlers/FlameCoreSkills.js');
assert.match(flame,/SOLAR_FLAME_VERTICAL_OFFSET\s*=\s*230/);
assert.match(flame,/setPosition\?\.\(s\.player\.x,s\.player\.y-SOLAR_FLAME_VERTICAL_OFFSET\)/);
assert.match(flame,/setPosition\?\.\(s\.player\.x\+SOLAR_FLAME_SECONDARY_OFFSET_X,s\.player\.y-SOLAR_FLAME_VERTICAL_OFFSET-SOLAR_FLAME_SECONDARY_OFFSET_Y\)/);
assert.ok(!flame.includes('setScrollFactor(0).setDepth(900)'));
const ind=read('src/ui/EnemyStatusIndicators.js');
assert.ok(!ind.includes('StatusEffectSystem'));
assert.ok(ind.includes('IconPlaceholder'));
assert.ok(ind.includes('StackText'));
assert.match(ind,/burnStacks\s*=\s*0/);
assert.match(ind,/poisonStacks\s*=\s*0/);
assert.match(ind,/setVisible\(false\).*setAlpha\(0\).*setStrokeStyle\(0/s);
assert.match(ind,/setText\(burn>0\?String\(burn\):''\)/);
assert.match(ind,/setText\(poison>0\?String\(poison\):''\)/);
assert.match(ind,/setVisible\(burn>0\|\|poison>0\)/);
const status=read('src/systems/StatusEffectSystem.js');
assert.match(status,/export const POISON_STACK_CAP=15/);
assert.match(status,/syncStatusIndicators\(target\)/);
assert.match(status,/this\.getStackCount\(target,StatusEffects\.POISON\)/);
assert.match(status,/syncBurnIndicator\(target\)/);
assert.match(status,/syncPoisonIndicator\(target\)/);
assert.ok(!fs.existsSync(new URL('../src/entities/EnemyStatusIndicators.js',import.meta.url)));

const swordState=read('src/skills/handlers/SwordFlowState.js');
assert.match(swordState,/SOUL_THRESHOLDS = \[0,12,36,80\]/);
assert.match(swordState,/mainSwordStatsReadOnly/);
assert.match(swordState,/tombStatsReadOnly/);
assert.match(swordState,/const LV3 = \{ speed:1\.25, interval:0\.85 \}/);
assert.match(swordState,/const LV6 = \{ critChance:0\.15, critMultiplierBonus:0\.5 \}/);
assert.match(swordState,/const LV9 = \{ finalDamage:1\.5, bodySize:1\.3, glowSize:1\.3 \}/);
assert.match(flame,/\[8,0\.0,1,900,0,0\]/);
assert.match(flame,/burnDamage:5,burnMs:3400,burnIntervalMs:600/);
console.log('validate-01046-skill-detail-ui passed on v0.10.60');
