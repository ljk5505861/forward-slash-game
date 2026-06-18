export default function createPlayer(scene, cfg, groundTopY) {
  const player = scene.add.rectangle(cfg.startX, cfg.startY, cfg.width, cfg.height, 0x1687ff, 1).setStrokeStyle(8, 0x0b4fb3, 1).setDepth(20);
  scene.physics.add.existing(player); player.body.setCollideWorldBounds(true); player.body.setAllowGravity(true); player.body.setSize(cfg.width, cfg.height); player.body.setMaxVelocity(260, 1600); player.groundY = groundTopY - cfg.height / 2; return player;
}
