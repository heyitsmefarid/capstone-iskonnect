'use strict';

// Steps backward (activeSemesters - 1) terms from the current term. Each step
// moves 2nd sem -> 1st sem of the same year, or 1st sem -> 2nd sem of the
// PREVIOUS year. The current term itself counts as one of activeSemesters,
// so a scholar with exactly 1 active semester needs 0 steps.
function computeGrantSchoolYear(currentYearStart, currentSemesterIndex, activeSemesters) {
  let yearStart = currentYearStart;
  let semIndex = currentSemesterIndex;
  const steps = Math.max(0, (Number(activeSemesters) || 1) - 1);

  for (let i = 0; i < steps; i++) {
    if (semIndex === 2) {
      semIndex = 1;
    } else {
      semIndex = 2;
      yearStart -= 1;
    }
  }

  return `${yearStart}-${yearStart + 1}`;
}

module.exports = { computeGrantSchoolYear };
