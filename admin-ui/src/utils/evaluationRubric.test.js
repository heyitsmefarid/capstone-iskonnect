import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rubricMaxPoints,
  rubricColor,
  computeTotalScore,
  cleanRubricRows,
  cleanCustomCriteria,
  newCriterionId,
} from './evaluationRubric.js';

const requirementsRubric = [
  { label: 'Complete & Organized', points: 20, description: 'x' },
  { label: 'Complete but Slightly Lacking', points: 15, description: 'x' },
  { label: 'Incomplete (Minor)', points: 10, description: 'x' },
  { label: 'Incomplete (Major)', points: 5, description: 'x' },
  { label: 'Non-compliant', points: 0, description: 'x' },
];

const economicRubric = [
  { label: 'Highly Disadvantaged', points: 30, description: 'x' },
  { label: 'Financially Capable', points: 10, description: 'x' },
];

// Matches the shipped defaults: weight equals the rubric's own max points, so
// scaling is a no-op — existing totals must not change under this config.
const defaultConfig = {
  requirementsRubric,
  economicRubric,
  requirementsWeight: 20,
  economicWeight: 30,
  examWeight: 50,
};

test('rubricMaxPoints returns the highest points value', () => {
  assert.equal(rubricMaxPoints(requirementsRubric), 20);
  assert.equal(rubricMaxPoints([]), 0);
  assert.equal(rubricMaxPoints(undefined), 0);
});

test('rubricMaxPoints works regardless of row order', () => {
  const shuffled = [requirementsRubric[3], requirementsRubric[0], requirementsRubric[2]];
  assert.equal(rubricMaxPoints(shuffled), 20);
});

test('rubricColor assigns colors by rank, not by a specific point value', () => {
  // An admin who edited the points to non-standard values still gets a
  // best-to-worst color gradient.
  const edited = [
    { label: 'A', points: 25 },
    { label: 'B', points: 18 },
    { label: 'C', points: 9 },
  ];
  assert.equal(rubricColor(edited, 25), '#22c55e'); // best
  assert.equal(rubricColor(edited, 18), '#3b82f6');
  assert.equal(rubricColor(edited, 9), '#f59e0b');
});

test('rubricColor falls back to the worst-tier color for an unscored/unmatched value', () => {
  assert.equal(rubricColor(requirementsRubric, 0), '#ef4444');
  assert.equal(rubricColor(requirementsRubric, null), '#ef4444');
  assert.equal(rubricColor(requirementsRubric, 999), '#ef4444');
});

test('computeTotalScore combines requirements + economic + weighted exam, under default weights', () => {
  const applicant = { requirementsScore: 18, economicScore: 25, examScore: 88 };
  // With weight == rubric max (the shipped defaults), scaling is a no-op:
  // 18 + 25 + (88 * 0.5) = 87 — same formula as before weights existed.
  assert.equal(computeTotalScore(applicant, defaultConfig), 87);
});

test('computeTotalScore respects a non-default exam weight', () => {
  const applicant = { requirementsScore: 18, economicScore: 25, examScore: 88 };
  // 18 + 25 + (88 * 0.4) = 78.2
  assert.equal(computeTotalScore(applicant, { ...defaultConfig, examWeight: 40 }), 78.2);
});

test('computeTotalScore treats missing scores as zero', () => {
  assert.equal(computeTotalScore({}, defaultConfig), 0);
  assert.equal(computeTotalScore(undefined, defaultConfig), 0);
});

test('computeTotalScore proportionally scales a rubric score onto an edited weight', () => {
  // requirementsScore 20 is the rubric's own max (20) — raising the weight to
  // 25 without touching the rubric's points should scale the full-marks score
  // up to the new weight, not leave it capped at the old max.
  const applicant = { requirementsScore: 20, economicScore: 0, examScore: 0 };
  assert.equal(computeTotalScore(applicant, { ...defaultConfig, requirementsWeight: 25 }), 25);
});

test('computeTotalScore scales a partial rubric score proportionally, not just the max', () => {
  // 15 out of a 20-point rubric, weight raised to 40: (15/20)*40 = 30
  const applicant = { requirementsScore: 15, economicScore: 0, examScore: 0 };
  assert.equal(computeTotalScore(applicant, { ...defaultConfig, requirementsWeight: 40 }), 30);
});

test('computeTotalScore is unaffected by weight when the rubric is empty (no max to scale from)', () => {
  const applicant = { requirementsScore: 20, economicScore: 0, examScore: 0 };
  const config = { ...defaultConfig, requirementsRubric: [], requirementsWeight: 25 };
  assert.equal(computeTotalScore(applicant, config), 0);
});

test('computeTotalScore handles a missing rubricConfig without throwing', () => {
  assert.equal(computeTotalScore({ requirementsScore: 10 }, undefined), 0);
});

test('cleanRubricRows trims text, floors negative points at 0, and sorts high-to-low', () => {
  const rows = [
    { label: '  Low  ', points: -5, description: ' d1 ' },
    { label: 'High', points: 30, description: 'd2' },
  ];
  const result = cleanRubricRows(rows);
  assert.deepEqual(result, [
    { label: 'High', points: 30, description: 'd2' },
    { label: 'Low', points: 0, description: 'd1' },
  ]);
});

test('cleanRubricRows drops rows with no label — clearing the label deletes the row', () => {
  const rows = [
    { label: 'Keep', points: 10, description: '' },
    { label: '   ', points: 5, description: '' },
  ];
  assert.deepEqual(cleanRubricRows(rows), [{ label: 'Keep', points: 10, description: '' }]);
});

test('cleanRubricRows carries extra keys (e.g. economic rubric cedula/electric)', () => {
  const rows = [{ label: 'Highly Disadvantaged', points: 30, cedula: ' ₱5–₱150 ', electric: ' low ' }];
  const result = cleanRubricRows(rows, ['cedula', 'electric']);
  assert.deepEqual(result, [
    { label: 'Highly Disadvantaged', points: 30, description: '', cedula: '₱5–₱150', electric: 'low' },
  ]);
});

test('newCriterionId returns a unique-looking string each call', () => {
  const a = newCriterionId();
  const b = newCriterionId();
  assert.notEqual(a, b);
  assert.match(a, /^custom-/);
});

test('computeTotalScore adds a raw-type custom criterion, weighted like Examination', () => {
  const config = {
    ...defaultConfig,
    requirementsWeight: 0,
    economicWeight: 0,
    examWeight: 0,
    customCriteria: [{ id: 'interview', name: 'Interview', type: 'raw', weight: 10 }],
  };
  const applicant = { customCriteriaScores: { interview: 80 } };
  // 80 * (10/100) = 8
  assert.equal(computeTotalScore(applicant, config), 8);
});

test('computeTotalScore adds a rubric-type custom criterion, scaled like Requirements', () => {
  const config = {
    ...defaultConfig,
    requirementsWeight: 0,
    economicWeight: 0,
    examWeight: 0,
    customCriteria: [{
      id: 'interview',
      name: 'Interview',
      type: 'rubric',
      weight: 10,
      rubric: [{ label: 'Excellent', points: 5, description: '' }, { label: 'Poor', points: 0, description: '' }],
    }],
  };
  // full marks (5/5) scaled onto weight 10 => 10
  const applicant = { customCriteriaScores: { interview: 5 } };
  assert.equal(computeTotalScore(applicant, config), 10);
});

test('computeTotalScore sums multiple custom criteria alongside the built-in three', () => {
  const config = {
    ...defaultConfig, // requirementsWeight 20, economicWeight 30, examWeight 50
    customCriteria: [
      { id: 'a', name: 'A', type: 'raw', weight: 5 },
      { id: 'b', name: 'B', type: 'raw', weight: 5 },
    ],
  };
  const applicant = {
    requirementsScore: 20, economicScore: 30, examScore: 0,
    customCriteriaScores: { a: 100, b: 100 },
  };
  // 20 + 30 + 0 + 5 + 5 = 60
  assert.equal(computeTotalScore(applicant, config), 60);
});

test('computeTotalScore ignores a custom criterion with no recorded score for this applicant', () => {
  const config = {
    ...defaultConfig,
    customCriteria: [{ id: 'interview', name: 'Interview', type: 'raw', weight: 10 }],
  };
  const applicant = { requirementsScore: 0, economicScore: 0, examScore: 0 };
  assert.equal(computeTotalScore(applicant, config), 0);
});

test('cleanCustomCriteria trims names, floors weight, and cleans nested rubric rows', () => {
  const criteria = [
    {
      id: 'x', name: '  Interview  ', type: 'rubric', weight: -5,
      rubric: [{ label: '  Great  ', points: '9', description: '' }],
    },
  ];
  const result = cleanCustomCriteria(criteria);
  assert.deepEqual(result, [
    { id: 'x', name: 'Interview', type: 'rubric', weight: 0, rubric: [{ label: 'Great', points: 9, description: '' }] },
  ]);
});

test('cleanCustomCriteria drops a criterion with no name', () => {
  const criteria = [{ id: 'x', name: '   ', type: 'raw', weight: 10 }];
  assert.deepEqual(cleanCustomCriteria(criteria), []);
});

test('cleanCustomCriteria drops a rubric-type criterion left with zero levels', () => {
  const criteria = [{ id: 'x', name: 'Interview', type: 'rubric', weight: 10, rubric: [] }];
  assert.deepEqual(cleanCustomCriteria(criteria), []);
});

test('cleanCustomCriteria assigns an id when one is missing', () => {
  const [result] = cleanCustomCriteria([{ name: 'Interview', type: 'raw', weight: 10 }]);
  assert.ok(result.id);
  assert.match(result.id, /^custom-/);
});

test('cleanCustomCriteria defaults an unrecognized type to raw', () => {
  const [result] = cleanCustomCriteria([{ id: 'x', name: 'Interview', type: 'bogus', weight: 10 }]);
  assert.equal(result.type, 'raw');
  assert.equal('rubric' in result, false);
});
