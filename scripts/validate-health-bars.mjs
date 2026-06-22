import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';


const { default: Hud } = await import('../src/ui/Hud.js');
const { default: PlayerHealthBar } = await import('../src/ui/PlayerHealthBar.js');

const hudSource = readFileSync(new URL('../src/ui/Hud.js', import.meta.url), 'utf8');
const healthBarSource = readFileSync(new URL('../src/ui/PlayerHealthBar.js', import.meta.url), 'utf8');
assert.doesNotMatch(hudSource, /\bPhaser\b/);
assert.doesNotMatch(healthBarSource, /\bPhaser\b/);

function makeNode() {
  return {
    width: 0,
    height: 16,
    displayHeight: 16,
    text: '',
    setScrollFactor() { return this; },
    setDepth() { return this; },
    setOrigin() { return this; },
    setStrokeStyle() { return this; },
    setDisplaySize(width, height) { this.width = width; this.displayWidth = width; this.displayHeight = height; return this; },
    setText(text) { this.text = text; return this; },
    destroy() { this.destroyed = true; },
  };
}

function makeScene(playerData) {
  return {
    playerData,
    enemies: [],
    add: {
      text: () => makeNode(),
      rectangle: () => makeNode(),
    },
  };
}

for (const playerData of [
  { level: 1, hp: 0, maxHp: 100, xp: 0, xpToNext: 10 },
  { level: 1, hp: 150, maxHp: 100, xp: 0, xpToNext: 10 },
  { level: 1, hp: 50, maxHp: 0, xp: 0, xpToNext: 10 },
]) {
  const scene = makeScene(playerData);
  const hud = new Hud(scene);
  assert.doesNotThrow(() => hud.update());
  assert.ok(hud.playerHealthBar.fill.width >= 0);
  assert.ok(hud.playerHealthBar.fill.width <= hud.playerHealthBar.maxWidth);
  hud.destroy();

  const bar = new PlayerHealthBar(makeScene(playerData));
  assert.doesNotThrow(() => bar.update());
  assert.ok(bar.fill.width >= 0);
  assert.ok(bar.fill.width <= bar.maxWidth);
  bar.destroy();
}

console.log('health bar validation passed');
