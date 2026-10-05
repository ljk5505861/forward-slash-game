// Only voluntary movement is restricted. Attack, spell and healing clocks are untouched.
export const isForeseerBound = (entity,time) => {
  const binding=entity?.foreseerBinding,owner=binding?.owner;
  return !!(binding&&binding.endAt>time&&owner?.active&&!owner.isDefeated&&owner.hp>0);
};

export function releaseForeseerBinding(binding) {
  if(binding?.entity?.foreseerBinding===binding)delete binding.entity.foreseerBinding;
}
