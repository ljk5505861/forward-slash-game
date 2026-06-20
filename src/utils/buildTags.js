import { SKILLS } from '../config/skills.js';
import { ARTIFACTS } from '../config/artifacts.js';
import { getProfession } from '../config/professions.js';
import { getTags, mergeTags } from './tagUtils.js';

const entryId = (entry) => typeof entry === 'string' ? entry : entry?.id;
const addCounts = (counts, tags, weight = 1) => {
  getTags(tags).forEach(tag => { counts[tag] = (counts[tag] || 0) + weight; });
};

export const collectBuildTagStats = ({ skills = [], artifacts = [], professionId = null, dominantLimit = 3 } = {}) => {
  const counts = {};
  skills.forEach(skillEntry => addCounts(counts, SKILLS[entryId(skillEntry)]?.tags));
  artifacts.forEach(artifactEntry => {
    const artifact = ARTIFACTS[entryId(artifactEntry)];
    if (!artifact) return;
    addCounts(counts, mergeTags(artifact.tags, artifact.supportedTags, artifact.affectedTags, artifact.synergyTags));
  });
  const dominantTags = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, dominantLimit).map(([tag]) => tag);
  const profession = getProfession(professionId);
  return { counts, dominantTags, referenceTags: mergeTags(profession?.supportedTags) };
};
