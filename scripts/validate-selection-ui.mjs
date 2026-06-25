import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKILLS } from '../src/config/skills.js';
import { formatSkillSelectionOption, formatArtifactSelectionOption, formatProfessionSelectionOption, resolveSelectionMode, SelectionState } from '../src/ui/selectionFormatters.js';
import Hud from '../src/ui/Hud.js';
import PlayerHealthBar from '../src/ui/PlayerHealthBar.js';
const playerData={ skills:[{id:'fireball',level:1},{id:'lightning',level:3}] };
assert.equal(formatSkillSelectionOption({type:'newSkill',skillId:'healing'},playerData).title, SKILLS.healing.name);
assert.match(formatSkillSelectionOption({type:'skillLevel',skillId:'fireball'},playerData).levelText,/Lv\.1 → Lv\.2/);
assert.doesNotThrow(()=>formatSkillSelectionOption({type:'skillLevel',skillId:'lightning'},playerData));
assert.equal(formatSkillSelectionOption({type:'attr',id:'attack_15',title:'攻击强化\n攻击力 +15%'},playerData).kind,'attribute');
assert.equal(formatArtifactSelectionOption({type:'new',artifactId:'flame_heart',nextLevel:1}).title,'炎心');
assert.equal(formatArtifactSelectionOption({type:'new',artifactId:'flame_heart',nextLevel:1}).levelText,'');
const fallback=formatArtifactSelectionOption({type:'fallback',title:'临时磨炼｜通用成长型\n攻击力 +10%'});
assert.equal(resolveSelectionMode([{type:'fallback',title:'A\n攻击力 +10%'},{type:'fallback',title:'B\n最大生命 +15'},{type:'fallback',title:'C\n暴击率 +4%'}]),'icon');
assert.equal(fallback.title,'临时磨炼');
assert.ok(!fallback.title.includes('\n'));
assert.ok(fallback.detailLines.join('\n').includes('攻击力 +10%'));
assert.ok(formatArtifactSelectionOption({type:'fallback',title:'生命精粹｜通用成长型\n最大生命 +15；当前生命 +15'}).detailLines.join('\n').includes('最大生命 +15'));
assert.ok(formatArtifactSelectionOption({type:'fallback',title:'鹰眼符｜通用成长型\n暴击率 +4%'}).detailLines.join('\n').includes('暴击率 +4%'));
assert.equal(fallback.levelText,'');
assert.equal(fallback.confirmText,'');
assert.ok(!('tags' in fallback));
assert.equal(formatProfessionSelectionOption('warrior').title,'流浪剑客');
assert.doesNotThrow(()=>formatSkillSelectionOption({type:'newSkill',skillId:'missing'},{}));
assert.equal(formatArtifactSelectionOption({description:'0'}).summaryLines[0],'0');
const gameSceneSource=readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url),'utf8');
assert.match(gameSceneSource,/artifactRewardPanel\.show/);
assert.match(gameSceneSource,/if\(option\.type==='fallback'\) this\.artifactSystem\.applyFallback\(option\)/);
let count=0; const st=new SelectionState(); st.open(); assert.equal(st.selectedIndex,-1); assert.equal(st.selectOrConfirm(0,{id:'a'},()=>count++),'selected'); assert.equal(count,0); assert.equal(st.selectOrConfirm(1,{id:'b'},()=>count++),'selected'); assert.equal(count,0); assert.equal(st.selectOrConfirm(1,{id:'b'},()=>count++),'confirmed'); assert.equal(count,1); assert.equal(st.selectOrConfirm(1,{id:'b'},()=>count++),'locked'); assert.equal(st.selectOrConfirm(2,{id:'c'},()=>count++),'locked'); assert.equal(count,1); st.close(); st.open(); assert.equal(st.selectedIndex,-1);
const st2=new SelectionState(); st2.open(); assert.equal(st2.confirm(()=>count++),false); assert.equal(count,1);
const st3=new SelectionState(); st3.open(); st3.select(0,{id:'a'}); st3.select(2,{id:'c'}); let picked; st3.confirm(o=>picked=o.id); assert.equal(picked,'c'); st3.close(); st3.open(); assert.equal(st3.selectedIndex,-1);
const st4=new SelectionState(); st4.open(); assert.equal(st4.selectOrConfirm(0,{id:'retry'},()=>{ throw new Error('first click must not confirm'); }),'selected'); let retryCalls=0; assert.equal(st4.selectOrConfirm(0,{id:'retry'},()=>{ retryCalls += 1; return false; }),'rejected'); assert.equal(st4.confirmed,false); assert.equal(st4.selectedIndex,0); assert.equal(st4.selectedOption.id,'retry'); assert.equal(st4.selectOrConfirm(0,{id:'retry'},()=>{ retryCalls += 1; return true; }),'confirmed'); assert.equal(retryCalls,2); assert.equal(st4.selectOrConfirm(0,{id:'retry'},()=>{ retryCalls += 1; }),'locked'); assert.equal(retryCalls,2);

const skill=formatSkillSelectionOption({type:'skillLevel',skillId:'fireball'},playerData);
assert.ok(skill.detailLines.some(line=>line.includes('冷却')));
assert.ok(skill.detailLines.every(line=>!line.includes('伤害：30 → 42')));
assert.ok(!skill.detailLines.join('\n').includes('标签'));
assert.ok(!skill.detailLines.join('\n').includes('当前：'));
assert.ok(!skill.detailLines.join('\n').includes('目标：'));
const attr=formatSkillSelectionOption({type:'attr',id:'attack_15',title:'攻击强化\n攻击力 +15%'},playerData);
assert.ok(!attr.detailLines.join('\n').includes('冷却'));
assert.ok(!formatArtifactSelectionOption({type:'new',artifactId:'flame_heart',nextLevel:1}).detailLines.join('\n').includes('标签'));
assert.ok(!formatProfessionSelectionOption('warrior').detailLines.join('\n').includes('标签'));
const upgradePanelSource=readFileSync(new URL('../src/ui/UpgradePanel.js', import.meta.url),'utf8');
const artifactPanelSource=readFileSync(new URL('../src/ui/ArtifactRewardPanel.js', import.meta.url),'utf8');
const professionPanelSource=readFileSync(new URL('../src/ui/ProfessionPanel.js', import.meta.url),'utf8');
assert.doesNotMatch(upgradePanelSource,/createConfirm|confirmButton|确认选择|获得技能|升级技能|获得法宝/);
assert.doesNotMatch(professionPanelSource,/createConfirm|confirmButton/);
assert.match(upgradePanelSource,/0\.18/);
assert.match(professionPanelSource,/0\.20/);
assert.ok(Number(upgradePanelSource.match(/0x07101f,0\.(\d+)/)?.[1]||99) < 50);

assert.match(upgradePanelSource,/this\.hide\(\); const result=this\.onConfirm\?\.\(option\)/, 'upgrade panel closes the current selection before callbacks can open the next panel');
assert.match(upgradePanelSource,/if\(result===false\)\{ this\.show\(this\.lastConfig\); this\.state\.select\(index,option\); this\.updateDebug\(\); \}/, 'upgrade panel restores retry state when a confirmation is rejected');
assert.match(professionPanelSource,/result==='rejected'\)\{ this\.updateDebug\(\); return; \}/);
assert.match(gameSceneSource,/if\(!selected\)\{ this\.claimingProfession=false;/);
assert.match(artifactPanelSource,/获得一个法宝奖励/);
assert.doesNotMatch(formatArtifactSelectionOption({type:'new',artifactId:'flame_heart',nextLevel:1}).detailLines.join('\n'),/Lv\.|升级|标签|再次点击/);
assert.doesNotMatch(formatSkillSelectionOption({type:'newSkill',skillId:'healing'},playerData).detailLines.join('\n'),/再次点击/);
assert.doesNotMatch(formatProfessionSelectionOption('warrior').detailLines.join('\n'),/再次点击/);

assert.doesNotMatch(upgradePanelSource,/再次点击确认/);
assert.doesNotMatch(upgradePanelSource,/f\.rarity\|\|f\.subtitle|y\+70/);
assert.match(upgradePanelSource,/config\.hideTitle\?null/);
const hudSource=readFileSync(new URL('../src/ui/Hud.js', import.meta.url),'utf8');
const gameSceneUiSource=gameSceneSource;
assert.doesNotMatch(hudSource,/HP \${p\.hp}|MP \${p\.mana|XP \${p\.xp}|阶段：/);
assert.match(hudSource,/Lv\.\$\{p\.level\|\|1\}/);
assert.match(hudSource,/hpFill/);
assert.match(hudSource,/mpFill/);
assert.match(hudSource,/GAME_VERSION_LABEL/);
assert.match(gameSceneUiSource,/hideTitle:true/);
assert.doesNotMatch(gameSceneUiSource,/setStatus\('选择开局技能'\)|upgradePanel\.show\('开局技能三选一'/);
const playerHealthBarSource=readFileSync(new URL('../src/ui/PlayerHealthBar.js', import.meta.url),'utf8');
assert.match(playerHealthBarSource,/class PlayerHealthBar/);
assert.match(playerHealthBarSource,/playerBodyX/);
assert.match(playerHealthBarSource,/p\.hp\/p\.maxHp/);
assert.doesNotMatch(hudSource,/\bPhaser\b/);
assert.doesNotMatch(playerHealthBarSource,/\bPhaser\b/);

const makeNode=()=>({
  width:0, height:0, displayWidth:0, displayHeight:0, visible:true, text:'', x:0, y:0,
  setOrigin(){ return this; }, setScrollFactor(){ return this; }, setDepth(){ return this; }, setStrokeStyle(){ return this; },
  setDisplaySize(w,h){ this.displayWidth=w; this.displayHeight=h; return this; },
  setText(text){ this.text=text; return this; }, setPosition(x,y){ this.x=x; this.y=y; return this; },
  setVisible(v){ this.visible=v; return this; }, destroy(){ this.destroyed=true; return this; }
});
const makeScene=()=>({
  playerData:{ hp:120, maxHp:120, mana:0, maxMana:0, xp:0, xpToNext:50, gold:0 },
  enemies:[],
  player:{ x:220, y:850, width:45, height:78, active:true },
  add:{
    rectangle(x,y,w,h){ const n=makeNode(); n.x=x; n.y=y; n.width=w; n.height=h; n.displayWidth=w; n.displayHeight=h; return n; },
    text(x,y,text){ const n=makeNode(); n.x=x; n.y=y; n.text=text; return n; }
  }
});
const assertWidthInRange=(node,max,label)=>assert.ok(node.displayWidth>=0&&node.displayWidth<=max, `${label} width ${node.displayWidth} should be within 0..${max}`);
const hudScene=makeScene();
const hud=new Hud(hudScene);
assert.doesNotThrow(()=>hud.update());
assertWidthInRange(hud.hpFill,210,'hud hp full');
hudScene.playerData.hp=0; assert.doesNotThrow(()=>hud.update()); assertWidthInRange(hud.hpFill,210,'hud hp zero');
hudScene.playerData.hp=180; hudScene.playerData.maxHp=120; assert.doesNotThrow(()=>hud.update()); assertWidthInRange(hud.hpFill,210,'hud hp over max'); assert.equal(hud.hpFill.displayWidth,210);
hudScene.playerData.maxHp=0; assert.doesNotThrow(()=>hud.update()); assertWidthInRange(hud.hpFill,210,'hud max hp zero'); assert.equal(hud.hpFill.displayWidth,0);
const healthScene=makeScene();
const playerHealthBar=new PlayerHealthBar(healthScene);
assert.doesNotThrow(()=>playerHealthBar.update());
assertWidthInRange(playerHealthBar.fill,56,'player health full');
healthScene.playerData.hp=0; assert.doesNotThrow(()=>playerHealthBar.update()); assertWidthInRange(playerHealthBar.fill,56,'player health zero'); assert.equal(playerHealthBar.fill.visible,false);
healthScene.playerData.hp=180; healthScene.playerData.maxHp=120; assert.doesNotThrow(()=>playerHealthBar.update()); assertWidthInRange(playerHealthBar.fill,56,'player health over max'); assert.equal(playerHealthBar.fill.displayWidth,56);
healthScene.playerData.maxHp=0; assert.doesNotThrow(()=>playerHealthBar.update()); assertWidthInRange(playerHealthBar.fill,82,'player max hp zero'); assert.equal(playerHealthBar.fill.displayWidth,0);

assert.doesNotMatch(artifactPanelSource,/再次点击确认|通用成长型|独立机制型/);
assert.doesNotMatch(professionPanelSource,/再次点击确认/);
assert.doesNotMatch(upgradePanelSource,/const name=this\.makeText/);
assert.doesNotMatch(upgradePanelSource,/setStrokeStyle\(3,0x46639b/);
assert.doesNotMatch(artifactPanelSource,/setStrokeStyle\(3,0x46639b/);
assert.match(artifactPanelSource,/DESIGN_WIDTH\/2-200\+i\*200/);
assert.match(artifactPanelSource,/0x0b1020,0\.82/);
const artifactPanelY=Number(artifactPanelSource.match(/rectangle\(DESIGN_WIDTH\/2,(\d+),650,360/)?.[1]||0);
const artifactOptionY=Number(artifactPanelSource.match(/const x=DESIGN_WIDTH\/2-200\+i\*200,y=(\d+)/)?.[1]||0);
const artifactDetailTitleY=Number(artifactPanelSource.match(/titleNode=this\.scene\.add\.text\(DESIGN_WIDTH\/2,(\d+),title/)?.[1]||0);
const artifactDetailBodyY=Number(artifactPanelSource.match(/bodyNode=this\.scene\.add\.text\(DESIGN_WIDTH\/2,(\d+),body/)?.[1]||0);
assert.ok(artifactPanelY>=500 && artifactPanelY<=540, `artifact panel y ${artifactPanelY} should be near visual center`);
assert.ok(artifactOptionY>=510 && artifactOptionY<=540, `artifact option y ${artifactOptionY} should be in screen middle`);
assert.ok(artifactDetailTitleY>=700 && artifactDetailTitleY<=740, `artifact detail title y ${artifactDetailTitleY} should follow popup`);
assert.ok(artifactDetailBodyY>=755 && artifactDetailBodyY<=800, `artifact detail body y ${artifactDetailBodyY} should follow title`);
console.log('selection ui validation passed');
