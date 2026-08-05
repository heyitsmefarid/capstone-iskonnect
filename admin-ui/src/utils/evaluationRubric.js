// Pure helpers for the applicant-evaluation rubric (Applications.jsx's
// scoring UI, Reports.jsx's labels, and the Evaluation Criteria admin tab in
// SystemSettings.jsx). Kept here — not inline in any one page — so the total
// score formula and rubric coloring can't drift between consumers.

export const RUBRIC_TIER_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];

// Highest points value in a rubric — the scale a level's raw score is picked
// on (e.g. rows worth 20/15/10/5/0). This is deliberately independent of the
// category's weight in the total score (see computeTotalScore) — an admin
// can renumber rubric levels to any scale without it silently changing how
// much the category counts.
export function rubricMaxPoints(rubric) {
  return Math.max(0, ...(rubric || []).map((r) => Number(r.points) || 0));
}

// Color by rank (best..worst) within the rubric, not by a specific point
// value — an edited rubric may no longer use round numbers like 20/15/10/5/0,
// but there are still ordered tiers to color consistently. Falls back to the
// worst-tier color for a score that doesn't match any row (e.g. 0/unscored).
export function rubricColor(rubric, points) {
  const sorted = [...(rubric || [])].sort((a, b) => b.points - a.points);
  const idx = sorted.findIndex((r) => r.points === points);
  return RUBRIC_TIER_COLORS[idx] ?? RUBRIC_TIER_COLORS[RUBRIC_TIER_COLORS.length - 1];
}

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Scales a raw rubric-picked score (0-max, whatever scale the rubric itself
// uses) onto the category's actual weight in the total (0-weight). With the
// defaults (requirementsWeight 20 matching a 0-20 rubric, economicWeight 30
// matching a 0-30 rubric) this is a no-op — score in, same score out — so
// existing data and totals are unaffected until an admin actually edits a
// weight in Evaluation Criteria.
function scaleToWeight(rawScore, maxPoints, weight) {
  if (maxPoints <= 0) return 0;
  return (toNumber(rawScore) / maxPoints) * toNumber(weight);
}

// One raw score contribution for a single custom criterion: a 'rubric' type
// is scaled from its own rubric's points onto its weight, same as
// Requirements/Economic; a 'raw' type is a directly-entered 0-100 score
// weighted like Examination.
function customCriterionContribution(criterion, rawScore) {
  if (criterion?.type === 'rubric') {
    return scaleToWeight(rawScore, rubricMaxPoints(criterion.rubric), criterion.weight);
  }
  return toNumber(rawScore) * (toNumber(criterion?.weight) / 100);
}

// Combined score out of 100: Requirements + Economic Background (each a
// rubric-picked raw score, proportionally scaled from the rubric's own point
// scale onto that category's weight) + Examination (a raw 0-100 score scaled
// by examWeight) + any admin-added custom criteria (see
// customCriterionContribution). All weights are editable in Evaluation
// Criteria and are expected to sum to 100, though this doesn't enforce that.
export function computeTotalScore(applicant, rubricConfig) {
  const {
    requirementsRubric,
    economicRubric,
    requirementsWeight,
    economicWeight,
    examWeight,
    customCriteria,
  } = rubricConfig || {};

  const requirements = scaleToWeight(
    applicant?.requirementsScore,
    rubricMaxPoints(requirementsRubric),
    requirementsWeight
  );
  const economic = scaleToWeight(
    applicant?.economicScore,
    rubricMaxPoints(economicRubric),
    economicWeight
  );
  const exam = toNumber(applicant?.examScore) * (toNumber(examWeight) / 100);

  const custom = (customCriteria || []).reduce((sum, criterion) => {
    const rawScore = applicant?.customCriteriaScores?.[criterion.id];
    return sum + customCriterionContribution(criterion, rawScore);
  }, 0);

  return Math.round((requirements + economic + exam + custom) * 10) / 10;
}

// A short, sufficiently-unique id for a new custom criterion — stable once
// created, since it's used as the key into an applicant's
// customCriteriaScores map.
export function newCriterionId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Normalizes custom criteria before saving: trims the name, floors weight at
// 0, cleans nested rubric rows for 'rubric'-type criteria (dropping the
// criterion entirely if that leaves it with zero levels), and drops any
// criterion left with no name (an admin who cleared the name is deleting it).
export function cleanCustomCriteria(criteria) {
  return (criteria || [])
    .map((c) => {
      const base = {
        id: c.id || newCriterionId(),
        name: (c.name || '').trim(),
        type: c.type === 'rubric' ? 'rubric' : 'raw',
        weight: Math.max(0, Number(c.weight) || 0),
      };
      if (base.type === 'rubric') {
        base.rubric = cleanRubricRows(c.rubric);
      }
      return base;
    })
    .filter((c) => c.name && (c.type !== 'rubric' || c.rubric.length > 0));
}

// Normalizes rubric rows before saving: trims text, floors points at 0,
// drops rows with no label (an admin who cleared a row's label is deleting
// it, not saving a blank one), and sorts high-to-low so rubricMaxPoints/
// rubricColor's rank convention holds regardless of edit order.
export function cleanRubricRows(rows, extraKeys = []) {
  return (rows || [])
    .map((r) => ({
      label: (r.label || '').trim(),
      points: Math.max(0, Number(r.points) || 0),
      description: (r.description || '').trim(),
      ...Object.fromEntries(extraKeys.map((k) => [k, (r[k] || '').trim()])),
    }))
    .filter((r) => r.label)
    .sort((a, b) => b.points - a.points);
}
