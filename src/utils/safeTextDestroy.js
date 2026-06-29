const pendingTextDestroys = new WeakMap();
const INSTALL_FLAG = '__postRenderTextDestroyInstalled';

export function installPostRenderTextDestroy(Phaser) {
  const textPrototype = Phaser?.GameObjects?.Text?.prototype;
  const postRenderEvent = Phaser?.Core?.Events?.POST_RENDER || 'postrender';

  if (!textPrototype || typeof textPrototype.destroy !== 'function') {
    return false;
  }

  if (textPrototype[INSTALL_FLAG]) {
    return false;
  }

  const immediateDestroy = textPrototype.destroy;

  Object.defineProperty(textPrototype, INSTALL_FLAG, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: true,
  });

  textPrototype.destroy = function destroyTextAfterCurrentRender(fromScene, ...args) {
    const text = this;
    const queued = pendingTextDestroys.get(text);

    if (fromScene === true) {
      if (queued) {
        queued.events.off?.(postRenderEvent, queued.run);
        pendingTextDestroys.delete(text);
      }
      if (text.__postRenderTextDestroyed) return text;
      Object.defineProperty(text, '__postRenderTextDestroyed', { configurable: true, enumerable: false, writable: true, value: true });
      return immediateDestroy.call(text, fromScene, ...args);
    }

    if (text.__postRenderTextDestroyed) return text;
    if (queued) return text;

    text.setVisible?.(false);
    text.setActive?.(false);
    text.setAlpha?.(0);
    text.removeInteractive?.();

    const events = text.scene?.game?.events;
    if (typeof events?.on !== 'function' || typeof events?.off !== 'function') {
      Object.defineProperty(text, '__postRenderTextDestroyed', { configurable: true, enumerable: false, writable: true, value: true });
      return immediateDestroy.call(text, fromScene, ...args);
    }

    const run = () => {
      const pending = pendingTextDestroys.get(text);
      if (!pending) return;
      pending.events.off?.(postRenderEvent, run);
      pendingTextDestroys.delete(text);
      if (text.__postRenderTextDestroyed) return;
      Object.defineProperty(text, '__postRenderTextDestroyed', { configurable: true, enumerable: false, writable: true, value: true });
      immediateDestroy.call(text, fromScene, ...args);
    };

    pendingTextDestroys.set(text, { events, run });
    events.on(postRenderEvent, run);
    return text;
  };

  return true;
}
