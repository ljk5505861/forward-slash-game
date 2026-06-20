import { LEGACY_TAG_ALIASES } from '../config/tags.js';

export const normalizeTag = (tag) => LEGACY_TAG_ALIASES[tag] || tag;

export const getTags = (target) => {
  if (!target) return [];
  const tags = Array.isArray(target) ? target : target.tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter(Boolean).map(normalizeTag);
};

export const hasTag = (target, tag) => {
  if (!tag) return false;
  return getTags(target).includes(normalizeTag(tag));
};

export const hasAnyTag = (target, tags) => getTags(tags).some(tag => hasTag(target, tag));

export const hasAllTags = (target, tags) => {
  const needed = getTags(tags);
  return needed.length > 0 && needed.every(tag => hasTag(target, tag));
};

export const mergeTags = (...tagGroups) => {
  const merged = [];
  tagGroups.forEach(group => {
    getTags(group).forEach(tag => {
      if (!merged.includes(tag)) merged.push(tag);
    });
  });
  return merged;
};
