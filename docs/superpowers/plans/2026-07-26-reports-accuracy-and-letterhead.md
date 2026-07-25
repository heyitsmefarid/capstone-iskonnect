# Reports Accuracy Fixes + CED Letterhead Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove hardcoded/placeholder values from three Reports.jsx report generators, and add the CED letterhead banners (extracted from `CED-Letter-Template_8.5-x-12.pdf`) to every PDF report export.

**Architecture:** All data-accuracy fixes are one-line/one-block edits inside existing report-generator functions in `admin-ui/src/pages/Reports.jsx` — no new state, no schema changes. The letterhead is added via a new small utility module (`admin-ui/src/utils/reportLetterhead.js`) that loads two pre-extracted banner images and draws them on every page of a jsPDF document via `jspdf-autotable`'s `didDrawPage` hook; `exportToPDF` becomes async to await the (cached) image load.

**Tech Stack:** React 19 + Vite (admin-ui), jsPDF 3.x, jspdf-autotable 5.0.2 (already installed — do not add new PDF libraries).

## Global Constraints

- This project has **no automated test framework** (no jest/vitest/`*.test.*` files anywhere in `admin-ui`). Verification steps in this plan use `npm run build`, `npm run lint`, and manual browser checks against the dev server (`npm run dev`) — this matches how the rest of the codebase is verified. Do not introduce a test framework as part of this work.
- Only `admin-ui/src/pages/Reports.jsx` and the new `admin-ui/src/utils/reportLetterhead.js` change. Do not touch `generateApplicationFormPdf`, `bfcspApplicationForm.js`, or `exportToExcel` — the letterhead is a PDF-export-only concern.
- The two letterhead images already exist at `admin-ui/src/assets/report-letterhead-header.jpg` (1708×328px) and `admin-ui/src/assets/report-letterhead-footer.png` (796×80px), extracted pixel-for-pixel from the supplied PDF. Task 4 commits them; do not regenerate or re-extract them.
- Spec: `docs/superpowers/specs/2026-07-26-reports-accuracy-and-letterhead-design.md`.

---

### Task 1: Fix hardcoded budget in Funds Remaining report

**Files:**
- Modify: `admin-ui/src/pages/Reports.jsx:860-889` (`generateFundsRemaining`)

**Interfaces:**
- Consumes: `getFilteredScholars()`, `schoolOptions` (both already defined earlier in the component; unchanged).
- Produces: same row shape as today (`HEI`, `Allocated Funds`, `Released Funds`, `Remaining Funds`, `Total Program Budget`, `Overall Remaining Budget`, `Utilization Rate`) — callers (`generateReportData`'s `'funds-remaining'` case) are unaffected.

- [ ] **Step 1: Replace the hardcoded `TOTAL_BUDGET` with a real sum**

Find this exact block in `admin-ui/src/pages/Reports.jsx`:

```jsx
  const generateFundsRemaining = () => {
    const TOTAL_BUDGET = 10000000; // ₱10M example budget
    const scholars = getFilteredScholars();
    const byHEI = schoolOptions.map(schoolName => {
      const schoolScholars = scholars.filter(a => a.school === schoolName);
      const disbursed = schoolScholars
        .filter(a => a.disbursementStatus === 'Completed')
        .reduce((sum, s) => sum + (s.amountGranted || 0), 0);
      const allocated = schoolScholars.reduce((sum, s) => sum + (s.amountGranted || 0), 0);
      const remaining = Math.max(allocated - disbursed, 0);

      return {
        'HEI': schoolName,
        'Allocated Funds': `₱${allocated.toLocaleString()}`,
        'Released Funds': `₱${disbursed.toLocaleString()}`,
        'Remaining Funds': `₱${remaining.toLocaleString()}`,
      };
    });

    const totalDisbursed = byHEI.reduce((sum, row) => sum + Number(row['Released Funds'].replace(/[₱,]/g, '')), 0);
    const remaining = TOTAL_BUDGET - totalDisbursed;
    const utilizationRate = TOTAL_BUDGET > 0 ? ((totalDisbursed / TOTAL_BUDGET) * 100).toFixed(1) : '0.0';

    return byHEI.map(row => ({
      ...row,
      'Total Program Budget': `₱${TOTAL_BUDGET.toLocaleString()}`,
      'Overall Remaining Budget': `₱${remaining.toLocaleString()}`,
      'Utilization Rate': `${utilizationRate}%`,
    }));
  };
```

Replace it with:

```jsx
  const generateFundsRemaining = () => {
    const scholars = getFilteredScholars();
    const byHEI = schoolOptions.map(schoolName => {
      const schoolScholars = scholars.filter(a => a.school === schoolName);
      const disbursed = schoolScholars
        .filter(a => a.disbursementStatus === 'Completed')
        .reduce((sum, s) => sum + (s.amountGranted || 0), 0);
      const allocated = schoolScholars.reduce((sum, s) => sum + (s.amountGranted || 0), 0);
      const remaining = Math.max(allocated - disbursed, 0);

      return {
        'HEI': schoolName,
        'Allocated Funds': `₱${allocated.toLocaleString()}`,
        'Released Funds': `₱${disbursed.toLocaleString()}`,
        'Remaining Funds': `₱${remaining.toLocaleString()}`,
      };
    });

    const totalAllocated = byHEI.reduce((sum, row) => sum + Number(row['Allocated Funds'].replace(/[₱,]/g, '')), 0);
    const totalDisbursed = byHEI.reduce((sum, row) => sum + Number(row['Released Funds'].replace(/[₱,]/g, '')), 0);
    const remaining = totalAllocated - totalDisbursed;
    const utilizationRate = totalAllocated > 0 ? ((totalDisbursed / totalAllocated) * 100).toFixed(1) : '0.0';

    return byHEI.map(row => ({
      ...row,
      'Total Program Budget': `₱${totalAllocated.toLocaleString()}`,
      'Overall Remaining Budget': `₱${remaining.toLocaleString()}`,
      'Utilization Rate': `${utilizationRate}%`,
    }));
  };
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev` (from `admin-ui/`), open the Reports page, select **Funds Remaining Report**. Confirm:
- "Total Program Budget" is no longer a flat ₱10,000,000 — it should equal the sum of every row's "Allocated Funds" column shown in the table.
- Changing the HEI/Status filters changes "Total Program Budget" accordingly (it no longer stays fixed).

- [ ] **Step 3: Commit**

```bash
git add admin-ui/src/pages/Reports.jsx
git commit -m "fix: derive Funds Remaining total budget from real scholar data"
```

---

### Task 2: Fix hardcoded year list in Year-to-Year Growth report

**Files:**
- Modify: `admin-ui/src/pages/Reports.jsx:730-749` (`generateYearToYearGrowth`)

**Interfaces:**
- Consumes: `academicYearOptions` (already defined at `Reports.jsx:423-426`, sorted array of real academic-year label strings like `"2024-2025"`, sourced from the School Year Management catalog plus any `schoolYear` value present on a scholar record).
- Produces: same row shape as today; if `academicYearOptions` is empty, returns `[]` (the page's existing "No data available for this report" empty state already handles this).

- [ ] **Step 1: Replace the hardcoded years array**

Find this exact line in `generateYearToYearGrowth`:

```jsx
    const years = ['2023-2024', '2024-2025', '2025-2026'];
```

Replace it with:

```jsx
    const years = academicYearOptions;
```

The rest of the function (the `years.map(...)` body) is unchanged.

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, open Reports, select **Year-to-Year Program Growth Report**. Confirm the "Academic Year" rows shown match exactly the academic years visible on the **School Year Management** page (no invented years, no missing real years).

- [ ] **Step 3: Commit**

```bash
git add admin-ui/src/pages/Reports.jsx
git commit -m "fix: derive Year-to-Year Growth years from real academic-year data"
```

---

### Task 3: Fix hardcoded "1st Semester" default in three reports

**Files:**
- Modify: `admin-ui/src/pages/Reports.jsx:541-554` (`generateSemesterDisbursement`)
- Modify: `admin-ui/src/pages/Reports.jsx:695-706` (`generateEnrollmentVerification`)
- Modify: `admin-ui/src/pages/Reports.jsx:708-728` (`generateOutstandingPayments`)

**Interfaces:**
- Consumes: each scholar record's own `s.semester` field (already populated on every applicant/scholar record — see `AppContext.jsx:210`, `:328`).
- Produces: same row shape as today; only the `'Semester'` field's source value changes.

- [ ] **Step 1: Fix `generateSemesterDisbursement`**

Find:

```jsx
      'Semester': filterSemester || '1st Semester',
```

inside `generateSemesterDisbursement` (the one directly after `'Academic Year': s.schoolYear || filterAY || 'All',`). Replace with:

```jsx
      'Semester': s.semester || filterSemester || 'N/A',
```

- [ ] **Step 2: Fix `generateEnrollmentVerification`**

Find the same pattern inside `generateEnrollmentVerification`:

```jsx
      'Semester': filterSemester || '1st Semester',
```

Replace with:

```jsx
      'Semester': s.semester || filterSemester || 'N/A',
```

- [ ] **Step 3: Fix `generateOutstandingPayments`**

Find the same pattern inside `generateOutstandingPayments`:

```jsx
        'Semester': filterSemester || '1st Semester',
```

(note the extra indentation level — this one is inside a `scholars.map(s => { ... return {...} })` block). Replace with:

```jsx
        'Semester': s.semester || filterSemester || 'N/A',
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open Reports. For each of the three reports (**Semester Disbursement**, **Enrollment Verification**, **Outstanding Payment Report**):
- With no Semester filter selected, confirm scholars known to be in "2nd Semester" (check their record in the Scholars page) now show "2nd Semester" in the report, not a blanket "1st Semester".
- Select the Semester filter dropdown to "2nd Semester" and confirm rows still show each scholar's real semester (unaffected by the filter, since the filter only controls which scholars are *included*, not what the semester column displays).

- [ ] **Step 5: Commit**

```bash
git add admin-ui/src/pages/Reports.jsx
git commit -m "fix: use each scholar's real semester instead of a hardcoded default"
```

---

### Task 4: Add CED letterhead to PDF exports

**Files:**
- Create: `admin-ui/src/utils/reportLetterhead.js`
- Modify: `admin-ui/src/pages/Reports.jsx:1-25` (imports)
- Modify: `admin-ui/src/pages/Reports.jsx:996-1022` (`exportToPDF`)
- Commit (already on disk, untracked): `admin-ui/src/assets/report-letterhead-header.jpg`, `admin-ui/src/assets/report-letterhead-footer.png`

**Interfaces:**
- Produces (from `reportLetterhead.js`):
  - `loadLetterheadImages(): Promise<{ header: string, footer: string }>` — cached data-URL loader.
  - `getLetterheadLayout(doc: jsPDF): { pageWidth: number, headerHeight: number, footerHeight: number }` — all in the doc's page units (mm).
  - `drawLetterheadBands(doc: jsPDF, images: { header: string, footer: string }): void` — draws both bands on the doc's *current* page.
- Consumes (in `Reports.jsx`): all three of the above, imported from `../utils/reportLetterhead`.

- [ ] **Step 1: Create the letterhead utility module**

Create `admin-ui/src/utils/reportLetterhead.js`:

```js
import headerUrl from '../assets/report-letterhead-header.jpg';
import footerUrl from '../assets/report-letterhead-footer.png';

// Aspect ratios (height / width) of the two banner images, extracted
// pixel-for-pixel from the CED letterhead PDF (a portrait Letter page).
// Reports export landscape to fit wide tables, so these bands are scaled
// UNIFORMLY (same factor on both axes) to fill the page width — this keeps
// the round seals circular instead of stretching them into ovals.
const HEADER_ASPECT = 328 / 1708;
const FOOTER_ASPECT = 80 / 796;

let cachedImages = null;

function toDataUrl(url) {
  return fetch(url)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    );
}

/** Loads (and caches) the CED letterhead banner images as data URLs for jsPDF. */
export function loadLetterheadImages() {
  if (!cachedImages) {
    cachedImages = Promise.all([toDataUrl(headerUrl), toDataUrl(footerUrl)]).then(
      ([header, footer]) => ({ header, footer })
    );
  }
  return cachedImages;
}

/** Header/footer band heights (in the doc's page units) for the doc's current page width. */
export function getLetterheadLayout(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  return {
    pageWidth,
    headerHeight: pageWidth * HEADER_ASPECT,
    footerHeight: pageWidth * FOOTER_ASPECT,
  };
}

/** Draws the CED letterhead header/footer bands on the doc's current page. */
export function drawLetterheadBands(doc, images) {
  const { pageWidth, headerHeight, footerHeight } = getLetterheadLayout(doc);
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.addImage(images.header, 'JPEG', 0, 0, pageWidth, headerHeight);
  doc.addImage(images.footer, 'PNG', 0, pageHeight - footerHeight, pageWidth, footerHeight);
}
```

- [ ] **Step 2: Wire it into `exportToPDF`**

In `admin-ui/src/pages/Reports.jsx`, add this import directly after the existing `import autoTable from 'jspdf-autotable';` line:

```jsx
import { loadLetterheadImages, getLetterheadLayout, drawLetterheadBands } from '../utils/reportLetterhead';
```

Then find the full `exportToPDF` function. Note: lines 998, 1003, and 1020 in
the current file are not truly blank — they each hold 4 trailing spaces. If
your editor's exact-match replace fails on whitespace, re-read
`Reports.jsx:996-1022` first and match its literal content (including that
trailing whitespace) in the "find" side of the edit.

```jsx
  const exportToPDF = (data, title, filename) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      // jsPDF's built-in fonts only support WinAnsi encoding, which has no ₱
      // glyph — it silently renders as "±" instead. Swap in an ASCII-safe
      // "PHP" prefix for the PDF only; Excel/on-screen keep the real ₱ symbol.
      const toPdfSafe = (val) => (typeof val === 'string' ? val.replace(/₱/g, 'PHP ') : val);
      const rows = data.map(row => headers.map(header => toPdfSafe(row[header])));

      autoTable(doc, {
        startY: 28,
        head: [headers],
        body: rows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [27, 77, 92] },
      });
    }
    
    doc.save(`${filename}.pdf`);
  };
```

Replace it with:

```jsx
  const exportToPDF = async (data, title, filename) => {
    const images = await loadLetterheadImages();
    const doc = new jsPDF('l', 'mm', 'a4');
    const { headerHeight, footerHeight } = getLetterheadLayout(doc);

    doc.setFontSize(16);
    doc.text(title, 14, headerHeight + 8);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, headerHeight + 14);

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      // jsPDF's built-in fonts only support WinAnsi encoding, which has no ₱
      // glyph — it silently renders as "±" instead. Swap in an ASCII-safe
      // "PHP" prefix for the PDF only; Excel/on-screen keep the real ₱ symbol.
      const toPdfSafe = (val) => (typeof val === 'string' ? val.replace(/₱/g, 'PHP ') : val);
      const rows = data.map(row => headers.map(header => toPdfSafe(row[header])));

      autoTable(doc, {
        startY: headerHeight + 20,
        head: [headers],
        body: rows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [27, 77, 92] },
        margin: { top: headerHeight + 20, bottom: footerHeight + 4 },
        didDrawPage: () => drawLetterheadBands(doc, images),
      });
    } else {
      drawLetterheadBands(doc, images);
    }

    doc.save(`${filename}.pdf`);
  };
```

Note: `exportToPDF` is now `async`. Its only caller is the existing button handler
`onClick={() => exportToPDF(reportData.data, info?.name || reportData.name, reportData.name)}`
(around `Reports.jsx:1200`) — this does not need to change; React event handlers
don't need to await async calls they fire.

- [ ] **Step 3: Run the build to catch import/syntax errors**

Run (from `admin-ui/`): `npm run build`
Expected: build succeeds (exit code 0), output lists the usual chunks plus the two new image assets under `dist/assets/`.

- [ ] **Step 4: Verify manually in the browser**

Run: `npm run dev`, open the Reports page.

1. Select **Master List of Scholars (All HEIs)** (widest report, 12 columns — and long enough to likely span multiple pages if there's more than ~45 scholars; if your dataset is small, temporarily note the single-page look is still valid to check). Export to PDF and open it. Confirm:
   - The green header banner (both seals + "CITY EDUCATION DEPARTMENT" + the "Aksyon Agad" logo) spans the full page width, seals are circular (not stretched into ovals).
   - The footer banner (quote + email) spans the full width at the bottom.
   - The report title and "Generated:" timestamp sit clearly below the header band, not overlapping it.
   - Table rows never overlap either band, on every page.
   - If the report spans multiple pages, both bands repeat identically on every page.
2. Select a report containing peso amounts (e.g. **Semester Disbursement Report**) and confirm the "PHP" substitution still renders correctly alongside the new layout.
3. Select a report with very few rows (e.g. **Gender Distribution Report**) and confirm the single-page layout still looks correct (bands present, no leftover blank space issues).

- [ ] **Step 5: Commit**

```bash
git add admin-ui/src/assets/report-letterhead-header.jpg admin-ui/src/assets/report-letterhead-footer.png admin-ui/src/utils/reportLetterhead.js admin-ui/src/pages/Reports.jsx
git commit -m "feat: add CED letterhead banners to PDF report exports"
```

---

## Final check

- [ ] Run `npm run lint` (from `admin-ui/`) and confirm no new errors were introduced by these changes.
- [ ] Confirm all four commits from this plan are present: `git log --oneline -4`.
