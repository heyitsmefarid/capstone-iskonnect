# Scholar Enrollment Status Toggle — Design

## Problem

Scholar records carry an `enrollmentStatus` field that [Reports.jsx](../../../admin-ui/src/pages/Reports.jsx) already
reads (Enrollment Verification Report, Agreement Monitoring Report's "HEI
Certification Status"), falling back to inferred text ('Verified' /
'Not Enrolled' / 'For Verification') when it's unset. Nothing in the admin UI
ever sets this field — it's `undefined` for every scholar today, so those
reports always show inferred defaults instead of a real admin confirmation.

## Design

Add an "Enrollment Status" control to the Academic Information section of the
Scholar Profile modal in [Scholars.jsx](../../../admin-ui/src/pages/Scholars.jsx):

- **Display:** a badge showing `VERIFIED` (green) when
  `selectedScholar.enrollmentStatus === 'Verified'`, otherwise
  `FOR VERIFICATION` (neutral/gray) as the default for anyone not yet toggled.
- **Button:** label flips with state — **"Mark as Enrolled"** when not yet
  verified (sets `enrollmentStatus: 'Verified'`), **"Mark as Not Enrolled"**
  when verified (sets `enrollmentStatus: 'Not Enrolled'`).
- **On click:** calls the existing `updateApplicant(selectedScholar.id, { enrollmentStatus: newValue })`
  (already used by the financial-edit Save button in this same modal — handles
  the Firestore write and audit log), merges the new value into
  `selectedScholar` state so the modal reflects it immediately without
  closing, and shows a brief success toast matching the existing
  `Swal.fire({ icon: 'success', timer: 1500 })` pattern already used nearby.

No new context function or Firestore schema change is needed — `updateApplicant`
and the underlying `buildUserDocFromApplicant` mapping already pass arbitrary
fields like this through untouched.

## Out of scope

- The separate idea of enrolling a scholar into the *current active term*
  (creating an `enrolledSemesters` entry / fixing "Semester Records: 0") was
  considered and explicitly rejected in favor of this simpler status flag.
