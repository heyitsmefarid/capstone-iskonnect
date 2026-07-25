# Reports accuracy fixes + CED letterhead on PDF exports

## Context

`admin-ui/src/pages/Reports.jsx` already implements every report type from
`List-of-Reports_BFCSP-System.pdf` (Master List, per-HEI, financial,
academic, compliance, enrollment, analytical, and dashboard summaries — 26
reports total across 7 categories). Two problems remain:

1. A few reports compute numbers from placeholder/hardcoded values instead
   of real scholar data.
2. PDF exports (`exportToPDF`, `Reports.jsx:996`) are a bare jsPDF table
   with no institutional branding. The user supplied
   `CED-Letter-Template_8.5-x-12.pdf` (City Education Department letterhead)
   and wants report PDFs to carry it.

## Part 1 — Data accuracy fixes

All three fixes are localized to report-generator functions in
`Reports.jsx`; no data model or Firestore schema changes.

### 1a. Funds Remaining report (`generateFundsRemaining`, line ~860)

Currently hardcodes `TOTAL_BUDGET = 10000000` ("₱10M example budget" per
its own comment) as the denominator for the overall utilization %.

Note the per-HEI rows in this same function are *already* real, just under
different names than the neighboring `hei-fund-allocation` report: each
HEI's `Allocated Funds` = Σ `amountGranted` for its scholars (regardless of
status), `Released Funds` = Σ `amountGranted` where `disbursementStatus ===
'Completed'`, and `Remaining Funds` = allocated − disbursed. Only the
*overall* total (`TOTAL_BUDGET`, `remaining`, `utilizationRate`) is fake —
so the fix stays inside that same basis rather than importing
`hei-fund-allocation`'s different tuition-based "required funds" concept:

- `Total Program Budget` (the old `TOTAL_BUDGET`) becomes the sum of the
  already-computed per-HEI `Allocated Funds` across all HEIs in scope.
- `Overall Remaining Budget` = that total − total disbursed (already
  computed today via `totalDisbursed`, unchanged).
- `Utilization Rate` = totalDisbursed / totalAllocated (× 100), guarding
  against divide-by-zero when totalAllocated is 0.

This is a one-constant swap — replace `TOTAL_BUDGET` with a `reduce` over
`byHEI`'s own `Allocated Funds` — and makes the overall figures consistent
with the per-HEI rows this function already produces correctly.

### 1b. Year-to-Year Growth report (`generateYearToYearGrowth`, line ~730)

Currently hardcodes `const years = ['2023-2024', '2024-2025', '2025-2026']`.

Fix: replace with the real `academicYearOptions` array already computed in
the component (line ~423, sourced from the School Year Management catalog
plus any `schoolYear` value actually present on a scholar record), sorted
ascending. If it's empty (no data yet), the report legitimately shows zero
rows rather than three fabricated years — same "no data" empty-state the
rest of the page already handles.

### 1c. Semester defaults (3 reports)

`generateSemesterDisbursement`, `generateEnrollmentVerification`, and
`generateOutstandingPayments` all stamp every row with
`filterSemester || '1st Semester'`, ignoring each scholar's actual term.

Fix: each scholar record already carries a real `semester` field
(`AppContext.jsx:210`, defaulted only at record-creation time, not at
report time). Change all three to `s.semester || filterSemester || 'N/A'` —
prefer the scholar's own recorded semester, fall back to the active filter
only if that scholar record is genuinely missing one, and never silently
assume "1st Semester."

## Part 2 — CED letterhead on PDF exports

### Assets

Extracted directly from the supplied `CED-Letter-Template_8.5-x-12.pdf`
(a portrait US Letter page, 612×792pt) rather than redrawn — this is a
pixel-accurate copy of the original graphics, not a recreation:

- `admin-ui/src/assets/report-letterhead-header.jpg` (1708×328px) — the
  green banner with both seals, "REPUBLIC OF THE PHILIPPINES / CALAPAN
  CITY, ORIENTAL MINDORO / CITY EDUCATION DEPARTMENT," and the "Maayos na
  Bayan Sigurado / Aksyon Agad II" logo.
- `admin-ui/src/assets/report-letterhead-footer.png` (796×80px) — the
  footer band with the education quote and
  `cityeducation.calapan2025@gmail.com`.

Both already committed to `admin-ui/src/assets/`.

### Orientation problem and resolution

Report PDFs export landscape A4 (297×210mm) to fit wide tables (Master
List alone has 12 columns); the source letterhead is portrait Letter. The
header/footer band images are wider than they are tall (aspect ratios
5.21:1 and 9.95:1) — a byproduct of being thin bands on a narrower portrait
page.

Resolution: scale each band image **uniformly** (identical factor on both
axes) so its width fills the full landscape page width. Because both axes
scale by the same factor, the round seals stay circular — nothing is
stretched non-uniformly. Concretely, at full A4-landscape width (297mm):
- Header renders at 297mm × (328/1708 × 297mm) ≈ 297 × 57mm.
- Footer renders at 297mm × (80/796 × 297mm) ≈ 297 × 30mm.

This means the banners take a larger proportion of a landscape page (~41%
combined) than they did on the original portrait letter (~25% combined) —
expected, since we're preserving the same image undistorted on a
differently-shaped page. This is intentional and matches how official
letterheads commonly look when reused across paper orientations; it can be
revisited after a first look if it reads as too heavy.

### Implementation approach

`exportToPDF` (`Reports.jsx:996`) currently calls `autoTable(doc, {...})`
directly. jspdf-autotable (already a dependency, v5.0.2) supports a
`didDrawPage(data)` hook that fires once per page — this is the existing,
supported mechanism for repeating headers/footers, so no change to the
underlying jsPDF/autoTable pagination logic is needed:

1. Load both images once (as base64 or via jsPDF's image cache) before
   calling `autoTable`.
2. Pass `margin: { top: <header height + gap>, bottom: <footer height +
   gap> }` so table rows never render under the bands on any page.
3. In `didDrawPage`, call `doc.addImage(...)` for the header at the top of
   every page and the footer at the bottom of every page (both stretched
   to `doc.internal.pageSize.getWidth()`, uniformly scaled per above).
4. Move the existing title/"Generated: ..." text below the header band
   instead of at the current fixed y=15/22, and set `startY` accordingly.

No change to `exportToExcel` — the letterhead is a print/PDF concern only,
consistent with how the existing BFCSP application form's official
template only applies to that PDF generator, not spreadsheet exports.

### Scope boundaries

- Only `exportToPDF` in `Reports.jsx` changes. The unrelated
  `generateApplicationFormPdf` (official BFCSP form, a different template
  entirely) is untouched.
- No new Firestore fields, no new Cloud Function, no System Settings UI —
  everything needed already exists in scholar records or the School Year
  catalog.
