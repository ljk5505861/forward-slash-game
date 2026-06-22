import Phaser from 'phaser';

export function makeInteractive(gameObject, hitArea = null) {
  if (!gameObject?.setInteractive) return gameObject;

  const area = hitArea || new Phaser.Geom.Rectangle(0, 0, gameObject.width || gameObject.displayWidth, gameObject.height || gameObject.displayHeight);

  gameObject.setInteractive({
    hitArea: area,
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  });

  return gameObject;
}

export function centeredHitArea(x, y, width, height) {
  return new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height);
}
