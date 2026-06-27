const pendingRestarts = new WeakMap();

/**
 * Phaser Text objects own transient canvas-backed texture frames. Restarting a
 * scene synchronously from an input callback can destroy those frames while the
 * current frame is still rendering, which is especially visible in iOS Safari.
 * Queue scene restarts until the current render has completed instead.
 */
export function installPostRenderSceneRestart(Phaser) {
  const scenePluginPrototype = Phaser?.Scenes?.ScenePlugin?.prototype;
  const postRenderEvent = Phaser?.Core?.Events?.POST_RENDER || 'postrender';
  const shutdownEvent = Phaser?.Scenes?.Events?.SHUTDOWN || 'shutdown';

  if (!scenePluginPrototype || typeof scenePluginPrototype.restart !== 'function') {
    return false;
  }

  if (scenePluginPrototype.__postRenderRestartInstalled) {
    return false;
  }

  const immediateRestart = scenePluginPrototype.restart;

  Object.defineProperty(scenePluginPrototype, '__postRenderRestartInstalled', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: true,
  });

  scenePluginPrototype.restart = function restartAfterCurrentRender(...args) {
    const plugin = this;
    const scene = plugin.scene;
    const gameEvents = scene?.game?.events;
    const sceneEvents = scene?.events;

    if (
      !scene
      || typeof gameEvents?.on !== 'function'
      || typeof gameEvents?.off !== 'function'
    ) {
      return immediateRestart.apply(plugin, args);
    }

    if (pendingRestarts.has(scene)) {
      return plugin;
    }

    const cancel = () => {
      const pending = pendingRestarts.get(scene);
      if (!pending) return;
      gameEvents.off(postRenderEvent, pending.run);
      pendingRestarts.delete(scene);
    };

    const run = () => {
      if (!pendingRestarts.has(scene)) return;
      gameEvents.off(postRenderEvent, run);
      pendingRestarts.delete(scene);
      sceneEvents?.off?.(shutdownEvent, cancel);
      immediateRestart.apply(plugin, args);
    };

    pendingRestarts.set(scene, { run, cancel });
    gameEvents.on(postRenderEvent, run);
    sceneEvents?.once?.(shutdownEvent, cancel);

    return plugin;
  };

  return true;
}
