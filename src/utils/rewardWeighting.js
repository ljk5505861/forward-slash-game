import { REWARD_BIAS } from '../config/rewardBias.js';
import { collectBuildTagStats } from './buildTags.js';
import { mergeTags, getTags } from './tagUtils.js';

const safeNumber = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const uniqueTags = (...groups) => mergeTags(...groups);

export const getBuildBiasContext = ({ skills = [], artifacts = [], professionId = null, config = REWARD_BIAS } = {}) => {
  const stats = collectBuildTagStats({ skills, artifacts, professionId, dominantLimit: config.dominantTagLimit });
  return { ...stats, enabled: !!config.buildBiasEnabled, config };
};

export const calculateBuildBiasWeight = ({ baseWeight = 1, tags = [], context = null, config = REWARD_BIAS } = {}) => {
  const base = Math.max(0, safeNumber(baseWeight, 0));
  if (!base) return { weight: 0, buildMultiplier: 1, professionMultiplier: 1, matchedBuildTags: [], matchedProfessionTags: [] };
  const cfg = context?.config || config;
  const itemTags = uniqueTags(tags);
  if (!cfg.buildBiasEnabled || !context || itemTags.length === 0 || Object.keys(context.counts || {}).length === 0) {
    return { weight: base, buildMultiplier: 1, professionMultiplier: 1, matchedBuildTags: [], matchedProfessionTags: [] };
  }
  const dominant = new Set(getTags(context.dominantTags));
  const reference = new Set(getTags(context.referenceTags));
  const specific = new Set(cfg.specificTags || []);
  let buildScore = 0;
  let professionScore = 0;
  const matchedBuildTags = [];
  const matchedProfessionTags = [];
  itemTags.forEach(tag => {
    const tagScale = specific.has(tag) ? 1 : (cfg.broadTagScale?.[tag] ?? 0.55);
    if (dominant.has(tag)) {
      const countScale = clamp((context.counts?.[tag] || 1) / 3, 0.35, 1);
      buildScore += tagScale * countScale;
      matchedBuildTags.push(tag);
    }
    if (reference.has(tag)) {
      professionScore += tagScale;
      matchedProfessionTags.push(tag);
    }
  });
  const buildMultiplier = clamp(1 + buildScore * cfg.buildBiasStrength, 1, cfg.maxBuildBiasMultiplier);
  const professionMultiplier = clamp(1 + professionScore * cfg.professionBiasStrength, 1, cfg.maxProfessionBiasMultiplier);
  const weight = base * buildMultiplier * professionMultiplier;
  return { weight: Number.isFinite(weight) ? Math.max(0, weight) : base, buildMultiplier, professionMultiplier, matchedBuildTags, matchedProfessionTags };
};

export const weightedPick = (candidates = [], { random = Math.random } = {}) => {
  const items = Array.isArray(candidates) ? candidates : [];
  const weights = items.map(c => Math.max(0, safeNumber(c?.weight, 0)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const rnd = typeof random === 'function' ? random : Math.random;
  if (!items.length) return null;
  if (!Number.isFinite(total) || total <= 0) return items[Math.floor(clamp(rnd(), 0, 0.999999) * items.length)] || null;
  let roll = clamp(rnd(), 0, 0.999999) * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
};

export const createWeightedCandidates = (items = [], { count = 3, random = Math.random, uniqueKey = item => item?.id } = {}) => {
  const pool = (Array.isArray(items) ? items : []).map(item => ({ ...item, weight: Math.max(0, safeNumber(item?.weight, 0)) }));
  const picked = [];
  const seen = new Set();
  while (pool.length && picked.length < count) {
    const choice = weightedPick(pool, { random });
    if (!choice) break;
    const key = uniqueKey(choice);
    const index = pool.indexOf(choice);
    if (index >= 0) pool.splice(index, 1);
    if (key != null && seen.has(key)) continue;
    if (key != null) seen.add(key);
    picked.push(choice);
  }
  return picked;
};
