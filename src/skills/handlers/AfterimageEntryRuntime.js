export const EntryMovementSkill = {
  bind(system) {
    const player = system.scene.playerData;
    const update = () => {
      const data = system.getData('shadow_fist');
      player.dodgeChanceBonuses ??= {};
      player.attackSpeedMultiplierBonuses ??= {};
      if (data) {
        player.dodgeChanceBonuses.shadow_fist = data.dodgeChance || 0;
        player.attackSpeedMultiplierBonuses.shadow_fist = data.attackSpeedBonus || 0;
      } else {
        Reflect.deleteProperty(player.dodgeChanceBonuses, 'shadow_fist');
        Reflect.deleteProperty(player.attackSpeedMultiplierBonuses, 'shadow_fist');
      }
    };
    system.passiveUpdaters.push(update);
    update();
    return () => {
      Reflect.deleteProperty(player.dodgeChanceBonuses || {}, 'shadow_fist');
      Reflect.deleteProperty(player.attackSpeedMultiplierBonuses || {}, 'shadow_fist');
      system.passiveUpdaters = system.passiveUpdaters.filter(fn => fn !== update);
    };
  }
};
