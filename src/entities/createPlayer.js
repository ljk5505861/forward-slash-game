const PLAYER_TEXTURE_KEY = 'player-idle';
const PLAYER_FRAME_KEY = 'trimmed-v01070';
const PLAYER_FRAME = { x: 0, y: 0, width: 127, height: 176 };
const PLAYER_VISUAL_HEIGHT_SCALE = 1.55;
const PLAYER_TEXTURE_URL = new URL('../player_idle.png', import.meta.url).href;

export default function createPlayer(scene, cfg, groundTopY) {
  const player = scene.add
    .rectangle(
      cfg.startX,
      groundTopY - cfg.height / 2,
      cfg.width,
      cfg.height,
      0x1687ff,
      1,
    )
    .setStrokeStyle(8, 0x0b4fb3, 1)
    .setDepth(20);

  scene.physics.add.existing(player);
  player.body.setCollideWorldBounds(true);
  player.body.setAllowGravity(true);
  player.body.setSize(
    cfg.bodyWidth || Math.round(cfg.width * 0.72),
    cfg.bodyHeight || Math.round(cfg.height * 0.9),
  );
  player.body.setOffset(
    (cfg.width - player.body.width) / 2,
    cfg.height - player.body.height,
  );
  player.body.setMaxVelocity(260, 1600);
  player.groundY = groundTopY - cfg.height / 2;

  if (!scene.load?.image || !scene.textures || !scene.add?.image) return player;

  let visual = null;
  let cleanedUp = false;

  const syncVisual = () => {
    if (!visual?.active || !player.active) return;
    visual
      .setPosition(player.x, player.y)
      .setAlpha(player.alpha)
      .setVisible(player.visible)
      .setRotation(player.rotation)
      .setDepth(player.depth + 1);
    visual.setScale(visual.baseScaleX * player.scaleX, visual.baseScaleY * player.scaleY);
  };

  const attachVisual = () => {
    if (cleanedUp || visual?.active || !scene.textures.exists(PLAYER_TEXTURE_KEY)) return;
    const texture = scene.textures.get(PLAYER_TEXTURE_KEY);
    if (!texture.has(PLAYER_FRAME_KEY)) {
      texture.add(
        PLAYER_FRAME_KEY,
        0,
        PLAYER_FRAME.x,
        PLAYER_FRAME.y,
        PLAYER_FRAME.width,
        PLAYER_FRAME.height,
      );
    }

    const visualHeight = Math.round(
      cfg.visualHeight || cfg.height * PLAYER_VISUAL_HEIGHT_SCALE,
    );
    const visualWidth = Math.round(
      visualHeight * (PLAYER_FRAME.width / PLAYER_FRAME.height),
    );
    const originY = 1 - cfg.height / 2 / visualHeight;

    visual = scene.add
      .image(player.x, player.y, PLAYER_TEXTURE_KEY, PLAYER_FRAME_KEY)
      .setDisplaySize(visualWidth, visualHeight)
      .setOrigin(0.5, originY)
      .setDepth(player.depth + 1);
    visual.baseScaleX = visual.scaleX;
    visual.baseScaleY = visual.scaleY;
    player.visual = visual;

    player.setFillStyle(0xffffff, 0).setStrokeStyle(0, 0x000000, 0);
    syncVisual();
  };

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    scene.events?.off('postupdate', syncVisual);
    scene.load?.off(`filecomplete-image-${PLAYER_TEXTURE_KEY}`, attachVisual);
    if (visual?.active) visual.destroy();
    visual = null;
  };

  scene.events?.on('postupdate', syncVisual);
  scene.events?.once('shutdown', cleanup);
  player.once?.('destroy', cleanup);

  if (scene.textures.exists(PLAYER_TEXTURE_KEY)) {
    attachVisual();
  } else {
    scene.load.once(`filecomplete-image-${PLAYER_TEXTURE_KEY}`, attachVisual);
    scene.load.image(PLAYER_TEXTURE_KEY, PLAYER_TEXTURE_URL);
    if (!scene.load.isLoading()) scene.load.start();
  }

  return player;
}
