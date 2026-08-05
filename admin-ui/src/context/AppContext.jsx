import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, updateDoc, arrayUnion, getDocs, writeBatch } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { initializeFirebase } from '../services/firebase';
import { logAudit } from '../services/auditLog';
import { DEFAULT_SCHOOLS, DEFAULT_PROGRAMS } from '../services/localSettingsStore';
import { syncCatalogToFirestore } from '../services/seedFirestoreCatalog';
import { matchesExact } from '../utils/filtering';
import { computeDesiredSchoolMemberships, membershipUnchanged, autoGroupDocId } from '../utils/autoGroupChat';

const AppContext = createContext();
const SCHOLARSHIP_CAP = 25000;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Caps at the SPECIFIC program's configured Tuition Cap (from the real
// School/Program catalog) when a match is found, falling back to the flat
// SCHOLARSHIP_CAP otherwise — same matching order as resolvePerSemGrant, so
// every place that reflects a grant amount agrees with each other.
const computeReflectedAmount = (tuitionFee, school, program, programs = []) => {
  const normalizedTuition = Math.max(0, toNumber(tuitionFee));
  const match =
    programs.find((p) => p.name === program && p.school === school) ||
    programs.find((p) => p.name === program);
  const cap = match?.tuitionCap != null ? Math.max(0, toNumber(match.tuitionCap)) : SCHOLARSHIP_CAP;
  return Math.min(normalizedTuition, cap);
};

const normalizeApplicantFinancialFields = (applicant, programs = []) => {
  const tuitionFee = Math.max(0, toNumber(applicant?.tuitionFee));
  return {
    ...applicant,
    tuitionFee,
    amountGranted: computeReflectedAmount(tuitionFee, applicant?.school, applicant?.program, programs),
  };
};

// Legacy cache key — kept only so we can clear any stale copy on startup.
// Applicants/scholars are now read live from Firestore (no localStorage cache),
// so the lists always reflect the real database (empty database = empty lists).
const APPLICANTS_STORAGE_KEY = 'ced-applicants';

const APPLICATION_STATUS_MAP = {
  pending: 'pending',
  submitted: 'pending',
  for_exam: 'pending',
  for_interview: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  active: 'active',
  terminated: 'terminated',
};

// Treat "Calapan", "Calapan City", "calapan city", etc. all as eligible Calapan residents
const normalizeCity = (city) => {
  const value = String(city || '').trim();
  return /calapan/i.test(value) ? 'Calapan' : value;
};

// Map Flutter requirement records (status per document) into the admin's { key: bool } shape
const REQUIREMENT_KEY_MAP = {
  applicationForm: 'applicationForm',
  idPictures: 'idPictures',
  form137: 'form137',
  goodMoral: 'goodMoral',
  votersId: 'votersId',
  barangayResidency: 'barangayResidency',
  electricBills: 'electricBills',
  cedula: 'cedula',
};

const SUBMITTED_STATUSES = new Set([
  'submitted', 'resubmitted', 'underreview', 'approved', 'verified',
  'Submitted', 'Verified',
]);

const isSubmittedValue = (v) => {
  if (v === true) return true;
  if (typeof v === 'string') return SUBMITTED_STATUSES.has(v);
  if (v && typeof v === 'object') {
    return v.submitted === true
      || (typeof v.status === 'string' && SUBMITTED_STATUSES.has(v.status));
  }
  return false;
};

// Returns a record object for submitted requirements (carrying fileUrl/fileName)
// or null when not submitted. Object values are truthy, so the admin's
// "X/8 submitted" counters keep working while also exposing the real file.
const toRequirementRecord = (v) => {
  if (!isSubmittedValue(v)) return null;
  if (v && typeof v === 'object') {
    return {
      submitted: true,
      fileUrl: v.fileUrl || null,
      fileName: v.fileName || null,
      status: v.status || 'submitted',
    };
  }
  return { submitted: true, fileUrl: null, fileName: null, status: 'submitted' };
};

const mapRequirements = (student) => {
  const source = student.requirements || student.documents;
  if (!source) return {};
  const result = {};
  // Accept either a map { key: status/bool/record } or a list of records
  if (Array.isArray(source)) {
    source.forEach((rec) => {
      const key = REQUIREMENT_KEY_MAP[rec.id] || rec.id;
      const record = toRequirementRecord(rec);
      if (key && record) result[key] = record;
    });
  } else if (typeof source === 'object') {
    Object.entries(source).forEach(([k, v]) => {
      const key = REQUIREMENT_KEY_MAP[k] || k;
      const record = toRequirementRecord(v);
      if (record) result[key] = record;
    });
  }
  return result;
};

// A freshly-registered scholar-app user is NOT yet an applicant: they only
// belong in the Applications/Scholars lists (and Dashboard counts) once they've
// actually submitted their application — or once an admin has taken them into
// the pipeline. We keep registered-but-not-submitted users out until then.
// Surname connector words that belong WITH the surname when splitting a single
// "Full Name" cell, so compound surnames (Dela Cruz, De Los Santos) stay whole.
const SURNAME_PARTICLES = new Set([
  'de', 'dela', 'del', 'dels', 'delos', 'delas', 'san', 'sta', 'sto',
  'santa', 'santo', 'los', 'las', 'da', 'di', 'la', 'le', 'van', 'von',
  'der', 'den', 'mac', 'mc', 'bin', 'al',
]);

const hasSubmittedApplication = (student) => {
  // Admin manually created or acted on this record (Add Applicant, approval, …).
  if (student.adminStatus) return true;
  // The applicant submitted, or otherwise moved past the initial registration
  // state, in the scholar app (e.g. 'submitted', 'approved', 'for_exam', …).
  const appStatus = String(student.applicationStatus || '').trim().toLowerCase();
  if (appStatus && appStatus !== 'pending') return true;
  // They've submitted at least one requirement (including the application form).
  if (Object.keys(mapRequirements(student)).length > 0) return true;
  return false;
};

// An approved applicant becomes an active City Scholar — the two statuses mean
// the same thing here, so 'approved' is collapsed into 'active' on read.
const normalizeScholarStatus = (status) => (status === 'approved' ? 'active' : status);

// The per-semester grant for a scholar: their explicit amountGranted wins,
// otherwise the capped reflection of their program's tuition cap (from the
// shared Academic Programs catalog passed in).
const resolvePerSemGrant = (applicant, programs = []) => {
  const explicit = Math.max(0, Number(applicant?.amountGranted) || 0);
  if (explicit > 0) return Math.min(explicit, SCHOLARSHIP_CAP);
  const explicitTuition = Math.max(0, Number(applicant?.tuitionFee) || 0);
  if (explicitTuition > 0) return Math.min(explicitTuition, SCHOLARSHIP_CAP);
  const match =
    programs.find((p) => p.name === applicant?.program && p.school === applicant?.school) ||
    programs.find((p) => p.name === applicant?.program);
  return Math.min(Math.max(0, Number(match?.tuitionCap) || 0), SCHOLARSHIP_CAP);
};

// Composes the scholar's full address from the registration fields the scholar
// app stores (house no., street, barangay, city, province).
const buildAddress = (student) =>
  [student.houseNo, student.street, student.barangay, normalizeCity(student.city), student.province]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');

// Formats the stored ISO birth date into a readable date; falls back to the raw
// value if it can't be parsed, and to '' when absent.
const formatBirthDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const mapStudentToApplicant = (student) => {
  const fullName = [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(' ');
  const dateStr = (() => {
    const c = student.createdAt;
    if (typeof c === 'string' && c.includes('T')) return c.split('T')[0];
    if (typeof c === 'string' && c) return c;
    // Firestore Timestamp object { seconds } or {_seconds}
    const secs = c?.seconds ?? c?._seconds;
    if (typeof secs === 'number') return new Date(secs * 1000).toISOString().split('T')[0];
    return new Date().toISOString().split('T')[0];
  })();
  return {
    firestoreId: student.id,
    name: fullName,
    firstName: student.firstName || '',
    middleName: student.middleName || '',
    lastName: student.lastName || '',
    suffix: student.suffix || '',
    school: student.schoolName || '',
    program: student.academicProgram || '',
    schoolYear: student.academicYear || '',
    // New applicants default to 1st Year / 1st Semester.
    yearLevel: parseInt(student.yearLevel, 10) || 1,
    semester: student.semester || '1st Semester',
    gender: student.gender || '',
    // adminStatus (written back by the admin) wins; otherwise map the app's
    // status. 'approved' and 'active' are the same thing (an active City
    // Scholar), so collapse 'approved' into 'active' everywhere.
    status: normalizeScholarStatus(
      student.adminStatus || APPLICATION_STATUS_MAP[student.applicationStatus] || 'pending'
    ),
    email: student.email || '',
    contactNumber: student.contactNumber || '',
    // Profile fields the Scholar Profile reads directly. Composed from the same
    // Firestore user doc the scholar app writes during registration.
    phone: student.contactNumber || '',
    address: buildAddress(student),
    birthDate: formatBirthDate(student.dateOfBirth),
    profilePicture: student.profilePicture || '',
    city: normalizeCity(student.city),
    barangay: student.barangay || '',
    createdAt: dateStr,
    // Admin-managed fields are persisted on the Firestore user doc so they
    // survive refreshes and sync across devices.
    scholarId: student.scholarId ?? null,
    uid: student.uid ?? null,
    accountDisabled: student.accountDisabled === true,
    ranking: student.ranking ?? null,
    attendance: Array.isArray(student.attendance) ? student.attendance : [],
    grades: Array.isArray(student.grades) ? student.grades : [],
    // Certificates of Grades the scholar uploads per semester (carries fileUrl).
    cogSubmissions: Array.isArray(student.cogSubmissions) ? student.cogSubmissions : [],
    // Admin's per-semester grade confirmation/evaluation, keyed by
    // `${schoolYear}::${semester}`.
    gradesEvaluation:
      student.gradesEvaluation && typeof student.gradesEvaluation === 'object'
        ? student.gradesEvaluation
        : {},
    // COR uploads — the scholar app writes these under `corSubmissions`
    // (see CorSubmissionsNotifier in grades_provider.dart).
    corSubmissions: Array.isArray(student.corSubmissions) ? student.corSubmissions : [],
    // Semesters the scholar has been enrolled into as the admin advanced the
    // active term. Drives Semester Records and Granted-per-Semester.
    enrolledSemesters: Array.isArray(student.enrolledSemesters) ? student.enrolledSemesters : [],
    requirements: mapRequirements(student),
    examScore: student.examScore ?? null,
    requirementsScore: student.requirementsScore ?? null,
    economicScore: student.economicScore ?? null,
    // Scores for admin-added custom evaluation criteria (Administration >
    // Evaluation Criteria), keyed by criterion id. Round-tripped the same way
    // as the fields above — see buildUserDocFromApplicant below.
    customCriteriaScores: student.customCriteriaScores ?? {},
    // Round-tripped so the admin UI still shows the reason it wrote after a
    // page refresh (buildUserDocFromApplicant below persists it the same way).
    rejectionReason: student.rejectionReason ?? null,
    interviewStatus: student.interviewStatus ?? null,
    gwa: student.gwa ?? null,
    semestersUsed: student.semestersUsed ?? 0,
    // Every (schoolYear::semester) this scholar's Semesters Used has already
    // been advanced for — a set, not just the most recent one, so
    // re-activating an *earlier* already-counted term (e.g. an admin
    // toggling back and forth while testing, or correcting a mistake) is
    // correctly a no-op instead of counting it again. Without persisting
    // this, the Firestore listener echoes back a version missing it, the
    // idempotency check in enrollActiveScholarsInSemester never holds, and
    // the count runs away on every snapshot update.
    countedTerms: Array.isArray(student.countedTerms) ? student.countedTerms : [],
    // Legacy single-value marker, read-only here — only used by the one-time
    // migration below to reconstruct `countedTerms` for scholars who predate
    // it. Never written back (buildUserDocFromApplicant no longer persists
    // it); safe to ignore once every scholar has been migrated.
    legacyLastCountedTerm: student.lastCountedTerm ?? null,
    disbursementStatus: student.disbursementStatus ?? null,
    tuitionFee: student.tuitionFee ?? 0,
    amountGranted: student.amountGranted ?? 0,
    yearAwarded: student.yearAwarded ?? new Date().getFullYear(),
    // Set when an admin restores a scholar from history — exempts them from the
    // 8-semester auto-graduation so a restored graduate stays active.
    gradExempt: student.gradExempt === true,
    // Admin's manual confirmation that the scholar is enrolled for the term —
    // 'Verified' unlocks Add COG/COR/Subject on the scholar app's Grades screen.
    enrollmentStatus: student.enrollmentStatus ?? null,
    // Why the admin marked the scholar as not enrolled, when enrollmentStatus
    // is 'Not Enrolled'.
    enrollmentNotEnrolledReason: student.enrollmentNotEnrolledReason ?? null,
  };
};

// Maps the admin's status onto fields the scholar app understands, so an
// approval/termination in the admin is reflected in the student's app.
const ADMIN_STATUS_TO_APP = {
  pending: { applicationStatus: 'pending' },
  approved: { applicationStatus: 'approved', studentType: 'scholar', scholarshipStatus: 'Active' },
  active: { applicationStatus: 'approved', studentType: 'scholar', scholarshipStatus: 'Active' },
  rejected: { applicationStatus: 'rejected' },
  'on-hold': { applicationStatus: 'pending', scholarshipStatus: 'On Hold' },
  graduated: { applicationStatus: 'approved', studentType: 'scholar', scholarshipStatus: 'Graduated' },
  terminated: { applicationStatus: 'rejected', studentType: 'scholar', scholarshipStatus: 'Terminated' },
};

// Maps an admin-side applicant object into the Firestore `users` document shape
// (the same field names the scholar app and mapStudentToApplicant use). Writing
// the identity/profile fields — not just status — means a record created or
// edited in one browser shows its full data (incl. name) in every other browser
// and on the scholar app.
const buildUserDocFromApplicant = (applicant) => {
  const statusFields = ADMIN_STATUS_TO_APP[applicant.status] || {};
  const docData = {
    // Admin-managed status & scholarship fields (always written)
    adminStatus: applicant.status ?? 'pending',
    ...statusFields,
    scholarId: applicant.scholarId ?? null,
    examScore: applicant.examScore ?? null,
    requirementsScore: applicant.requirementsScore ?? null,
    economicScore: applicant.economicScore ?? null,
    // Scores for admin-added custom evaluation criteria — see the matching
    // field in mapStudentToApplicant above.
    customCriteriaScores: applicant.customCriteriaScores ?? {},
    // The admin's typed-in reason for rejecting this applicant (see the two
    // "Reject" flows in Applications.jsx). This was previously written into
    // this component's own local `applicants` state only — it was never
    // included in the Firestore user-doc shape this function builds, so
    // `setDoc(..., {merge:true})` silently never wrote it, and the scholar
    // app (which only ever reads that Firestore doc) had no way to receive it
    // no matter what the admin typed.
    rejectionReason: applicant.rejectionReason ?? null,
    interviewStatus: applicant.interviewStatus ?? null,
    ranking: applicant.ranking ?? null,
    gwa: applicant.gwa ?? null,
    semestersUsed: applicant.semestersUsed ?? 0,
    // The scholar app reads `semestersCompleted` for its "x/8 sem" badge, so
    // keep it in lockstep with the admin's semestersUsed.
    semestersCompleted: applicant.semestersUsed ?? 0,
    // Must be persisted — see the matching field in mapStudentToApplicant
    // for why dropping this causes a runaway increment loop.
    countedTerms: Array.isArray(applicant.countedTerms) ? applicant.countedTerms : [],
    disbursementStatus: applicant.disbursementStatus ?? null,
    tuitionFee: applicant.tuitionFee ?? 0,
    amountGranted: applicant.amountGranted ?? 0,
    yearAwarded: applicant.yearAwarded ?? null,
    yearLevel: applicant.yearLevel ?? 1,
    semester: applicant.semester ?? '1st Semester',
    attendance: Array.isArray(applicant.attendance) ? applicant.attendance : [],
    grades: Array.isArray(applicant.grades) ? applicant.grades : [],
    // Admin's per-semester grade confirmation/evaluation, persisted so it
    // survives refresh and is readable by the scholar app.
    gradesEvaluation:
      applicant.gradesEvaluation && typeof applicant.gradesEvaluation === 'object'
        ? applicant.gradesEvaluation
        : {},
    enrolledSemesters: Array.isArray(applicant.enrolledSemesters) ? applicant.enrolledSemesters : [],
    gradExempt: applicant.gradExempt ?? false,
    enrollmentStatus: applicant.enrollmentStatus ?? null,
    enrollmentNotEnrolledReason: applicant.enrollmentNotEnrolledReason ?? null,
  };

  // Identity/profile fields are only written when present, so a sync never
  // overwrites a real name in Firestore with a blank value.
  const setIfPresent = (key, value) => {
    if (value !== undefined && value !== null && value !== '') docData[key] = value;
  };
  setIfPresent('firstName', applicant.firstName);
  setIfPresent('middleName', applicant.middleName);
  setIfPresent('lastName', applicant.lastName);
  setIfPresent('suffix', applicant.suffix);
  setIfPresent('schoolName', applicant.school);
  setIfPresent('academicProgram', applicant.program);
  setIfPresent('academicYear', applicant.schoolYear);
  setIfPresent('gender', applicant.gender);
  setIfPresent('email', applicant.email);
  setIfPresent('contactNumber', applicant.contactNumber);
  setIfPresent('city', applicant.city);
  setIfPresent('barangay', applicant.barangay);

  return docData;
};

// Writes the admin's changes for an applicant back to the Firestore user doc.
const syncApplicantToFirestore = async (applicant) => {
  if (!applicant?.firestoreId) return;
  const { db, isReady } = initializeFirebase();
  if (!isReady || !db) return;
  try {
    await setDoc(
      doc(db, 'users', applicant.firestoreId),
      buildUserDocFromApplicant(applicant),
      { merge: true }
    );
  } catch (_) {
    // Keep the admin UI responsive even if the write fails.
  }
};

// ── History / Archiving ──────────────────────────────────────────────────
// Only rejected applicants are immediately archived on status change.
// Graduated/terminated scholars stay in the list until the semester ends
// (endOfSemesterScholarsCleanup moves them to Scholar History at that point).
const ARCHIVE_STATUSES = ['rejected'];

// Default applicant-evaluation rubric — seeds `system_config/evaluationRubric`
// the first time an admin opens Administration > Evaluation Criteria, and is
// the fallback used everywhere the rubric is read before that doc exists.
// Every consumer (Applications.jsx's scoring UI, Reports.jsx's labels, the
// Evaluation Criteria admin page) reads from `evaluationRubric` below instead
// of hardcoding these — so editing a row here is a one-time seed, not a
// second place that needs to match if an admin tweaks a label/point value.
const DEFAULT_EVALUATION_RUBRIC = {
  requirementsRubric: [
    { label: 'Complete & Organized', points: 20, description: 'All requirements submitted on time; complete, accurate, and properly organized' },
    { label: 'Complete but Slightly Lacking', points: 15, description: 'All requirements submitted but with minor errors or formatting issues' },
    { label: 'Incomplete (Minor)', points: 10, description: 'Missing 1-2 minor requirements or with noticeable inconsistencies' },
    { label: 'Incomplete (Major)', points: 5, description: 'Several missing or incorrect documents' },
    { label: 'Non-compliant', points: 0, description: 'Failed to submit majority of required documents' },
  ],
  economicRubric: [
    { label: 'Highly Disadvantaged', points: 30, cedula: '₱5 – ₱150', electric: '₱500 and below', description: 'Very low declared income; minimal electricity use; 4+ dependents; irregular/no stable income' },
    { label: 'Disadvantaged', points: 25, cedula: '₱151 – ₱500', electric: '₱501 – ₱1,000', description: 'Low declared income; low consumption; 3-4 dependents; limited financial capacity' },
    { label: 'Moderately Disadvantaged', points: 20, cedula: '₱501 – ₱1,000', electric: '₱1,001 – ₱2,000', description: 'Modest declared income; average consumption; 1-2 dependents' },
    { label: 'Slightly Disadvantaged', points: 15, cedula: '₱1,001 – ₱2,000', electric: '₱2,001 – ₱3,500', description: 'Stable income; above-average consumption; 1-2 dependents' },
    { label: 'Financially Capable', points: 10, cedula: 'Above ₱2,000', electric: 'Above ₱3,500', description: 'Higher declared income; high consumption; few or no dependents' },
  ],
  // Each category's real weight in the total score — independent of the
  // rubric's own point scale above (see evaluationRubric.js's
  // computeTotalScore). Defaults match the rubrics' current max points
  // (20 and 30) so nothing changes for anyone who hasn't touched Evaluation
  // Criteria yet.
  requirementsWeight: 20,
  economicWeight: 30,
  examWeight: 50,
  // Admin-added scoring categories beyond the three built-in ones — see
  // evaluationRubric.js's cleanCustomCriteria/computeTotalScore. Empty by
  // default; nothing changes until an admin adds one in Evaluation Criteria.
  customCriteria: [],
};

// A subject is considered failing/INC based solely on its remarks field.
// Any remarks value other than "Passed" (e.g. Failed, Incomplete, Other)
// puts the scholar on hold — numeric grade is not used for this decision.
// When `term` is given, only that (schoolYear, semester)'s entries are
// checked — a failing grade from an already-closed semester shouldn't keep
// evaluating (and blocking reactivation) once a new term has started.
const hasFailingOrIncGrades = (grades, term = null) => {
  const relevant = term
    ? (grades || []).filter((e) => e.schoolYear === term.schoolYear && e.semester === term.semester)
    : (grades || []);
  return relevant.some((entry) =>
    (entry.subjects || []).some((sub) => {
      const r = String(sub.remarks || '').trim().toUpperCase();
      return r !== '' && r !== 'PASSED';
    })
  );
};

// An event only counts toward absence once its end time has actually
// passed — a scholar shouldn't be marked absent for an event that's still
// upcoming or in progress. Events without an endTime (saved before this
// field existed) fall back to end-of-day. Mirrors the same helper in
// Attendance.jsx.
const hasEventEnded = (event) => {
  if (!event?.date) return false;
  const endDateTime = new Date(`${event.date}T${event.endTime || '23:59'}:00`);
  if (Number.isNaN(endDateTime.getTime())) return false;
  return Date.now() > endDateTime.getTime();
};

// Chronological sort key for a (schoolYear, semester) term — used to order
// and range-filter terms when reconstructing a scholar's semester history.
const termSortKey = (schoolYear, semester) => {
  const year = parseInt(String(schoolYear).split('-')[0], 10) || 0;
  return year * 10 + (semester === '2nd Semester' ? 2 : 1);
};

// Human-readable reason for why an applicant landed in Applicant History.
const APPLICANT_ARCHIVE_REASONS = {
  rejected: 'Rejected',
  not_approved: 'Not Approved (School Year Ended)',
  inactive: 'Inactive / Expired',
};

const todayISO = () => new Date().toISOString();
const dateOnly = (iso) => String(iso || '').split('T')[0];

// Builds the Applicant History snapshot document. The snapshot carries every
// display field so the History page stays accurate even after the source user
// doc changes, and `snapshot` holds the full record for "view details" / restore.
const buildApplicantHistoryDoc = (applicant, reason) => ({
  applicantId: applicant.firestoreId || applicant.scholarId || String(applicant.id || ''),
  fullName: applicant.name
    || [applicant.firstName, applicant.middleName, applicant.lastName].filter(Boolean).join(' '),
  email: applicant.email || '',
  contactNumber: applicant.contactNumber || applicant.phone || '',
  applicationDate: dateOnly(applicant.createdAt) || dateOnly(todayISO()),
  schoolYear: applicant.schoolYear || '',
  reason: reason || APPLICANT_ARCHIVE_REASONS.inactive,
  archivedDate: todayISO(),
  snapshot: applicant,
});

// Builds the Scholar History snapshot document.
const buildScholarHistoryDoc = (scholar, status) => ({
  scholarId: scholar.scholarId || scholar.firestoreId || String(scholar.id || ''),
  applicantId: scholar.firestoreId || '',
  fullName: scholar.name
    || [scholar.firstName, scholar.middleName, scholar.lastName].filter(Boolean).join(' '),
  course: scholar.program || '',
  school: scholar.school || '',
  scholarshipStartDate: scholar.yearAwarded ? `${scholar.yearAwarded}` : '',
  scholarshipEndDate: dateOnly(todayISO()),
  status: status === 'graduated' ? 'graduated' : 'terminated',
  schoolYear: scholar.schoolYear || '',
  archivedDate: todayISO(),
  snapshot: scholar,
});

// Initial mock data - 25+ applicants with varied data
const initialApplicants = [];

const initialApplicantSamples = [];

const initialSchools = [
  { id: 1, name: 'Divine Word College', code: 'DWC', tuitionCap: 25000 },
  { id: 2, name: 'Luna Colleges', code: 'LUNA', tuitionCap: 25000 },
  { id: 3, name: 'South Colleges', code: 'SOUTH', tuitionCap: 25000 },
  { id: 4, name: 'St. Mark College', code: 'STM', tuitionCap: 25000 },
  { id: 5, name: 'St. Anthony College', code: 'STA', tuitionCap: 25000 },
  { id: 6, name: 'ACLC College', code: 'ACLC', tuitionCap: 25000 },
  { id: 7, name: 'St. Augustine Academy', code: 'SAA', tuitionCap: 25000, specialCase: 'gradesOnly' },
];

const SYSTEM_SETTINGS_STORAGE_KEY = 'ced-system-settings';
const defaultSystemSettings = {
  organizationName: 'City Education Department',
  contactEmail: 'ced@calapancity.gov.ph',
  defaultAcademicYear: '2026-2027',
  defaultSemester: '1st Semester',
  tuitionFeeDefault: 25000,
  numberOfSemesters: 8,
  academicPrograms: [
    'Bachelor of Science in Nursing',
    'Bachelor of Science in Information Technology',
    'Bachelor of Science in Computer Science',
  ],
  sessionTimeoutMinutes: 60,
  enableAutoEvaluation: true,
  requireQrSignature: true,
  enablePushNotifications: true,
  allowApplicantResubmission: true,
};

const parseSystemSettings = () => {
  if (typeof window === 'undefined') {
    return defaultSystemSettings;
  }

  try {
    const raw = localStorage.getItem(SYSTEM_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return defaultSystemSettings;
    }

    const parsed = JSON.parse(raw);
    return {
      ...defaultSystemSettings,
      ...parsed,
    };
  } catch (_) {
    return defaultSystemSettings;
  }
};

export function AppProvider({ children }) {
  const [applicants, setApplicants] = useState([]);
  // Always-current snapshot of applicants for user-triggered callbacks (manual
  // sync / cleanup), so they never act on a stale closure.
  const applicantsRef = useRef(applicants);
  useEffect(() => {
    applicantsRef.current = applicants;
  }, [applicants]);
  const [applicantHistory, setApplicantHistory] = useState([]);
  const [scholarHistory, setScholarHistory] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  // Always-current snapshot for read-modify-write CRUD (add/edit/delete
  // semester, set-active) so those never act on a stale closure.
  const schoolYearsRef = useRef(schoolYears);
  useEffect(() => {
    schoolYearsRef.current = schoolYears;
  }, [schoolYears]);

  // The currently active School Year + Semester, or null if none configured.
  // Used to scope grade/attendance evaluation to the term that's actually
  // running, instead of a scholar's entire history.
  const getActiveTerm = () => {
    const activeSy = schoolYearsRef.current.find((s) => s.isActive);
    const activeSem = activeSy?.semesters?.find((s) => s.isActive);
    return activeSy && activeSem ? { schoolYear: activeSy.label, semester: activeSem.name } : null;
  };

  const [schools, setSchools] = useState(initialSchools);
  // Eligible schools/programs catalog — Firestore-backed so edits made in one
  // browser reach every admin device and the scholar app (which reads the same
  // `schools`/`programs` collections). The tuition cap here drives a scholar's
  // per-semester grant.
  const [catalogSchools, setCatalogSchools] = useState([]);
  const [catalogPrograms, setCatalogPrograms] = useState([]);
  // Always-current programs snapshot for the grant lookup inside enrollment.
  const catalogProgramsRef = useRef(catalogPrograms);
  useEffect(() => {
    catalogProgramsRef.current = catalogPrograms;
  }, [catalogPrograms]);
  // Scheduled events (formerly local-only "activities") — shared Firestore
  // collection so a created event persists and is readable by the scholar
  // app and the QR scanner, same pattern as announcements below.
  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [systemSettings, setSystemSettings] = useState(parseSystemSettings);
  // Scholar ID card template — the images/mayor-name the Flutter app renders
  // onto a scholar's digital ID. A single Firestore doc (like `system_config/
  // settings` above) so every admin device and the scholar app read the same
  // active template.
  const [idCardTemplate, setIdCardTemplate] = useState(null);
  // Applicant-evaluation rubric (Requirements/Economic Background rows +
  // exam weight) — editable in Administration > Evaluation Criteria. Defaults
  // until the admin saves their own version.
  const [evaluationRubric, setEvaluationRubric] = useState(DEFAULT_EVALUATION_RUBRIC);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Anonymous sign-in must complete before any Firestore listener attaches,
  // otherwise the listeners query unauthenticated and Firestore terminates them
  // with permission-denied (which does not auto-retry).
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const { auth, isReady } = initializeFirebase();
    if (!isReady || !auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setAuthReady(true);
    });
    signInAnonymously(auth).catch((e) =>
      console.error('Admin anonymous sign-in failed:', e)
    );
    return () => unsub();
  }, []);

  // School Years — shared Firestore collection so the active school
  // year/semester (and the archiving it triggers) is consistent across every
  // open tab/device instead of living in one browser's localStorage.
  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const ref = collection(db, 'school_years');
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const list = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.startYear || 0) - (b.startYear || 0));
      setSchoolYears(list);
    }, (error) => console.error('Firestore school_years listener error:', error));
    return () => unsubscribe();
  }, [authReady]);

  // Eligible schools & programs catalog — shared Firestore collections.
  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const sortByOrderName = (a, b) =>
      (a.order ?? 0) - (b.order ?? 0) || String(a.name || '').localeCompare(String(b.name || ''));
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snap) => {
      setCatalogSchools(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortByOrderName));
    }, (error) => console.error('Firestore schools listener error:', error));
    const unsubPrograms = onSnapshot(collection(db, 'programs'), (snap) => {
      setCatalogPrograms(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortByOrderName));
    }, (error) => console.error('Firestore programs listener error:', error));
    return () => { unsubSchools(); unsubPrograms(); };
  }, [authReady]);

  // Announcements — shared Firestore collection (admin writes, scholar app reads)
  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const ref = collection(db, 'announcements');
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const list = snapshot.docs
        .map((d) => ({ firestoreId: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setAnnouncements(list);
    });
    return () => unsubscribe();
  }, [authReady]);

  const addAnnouncement = async (data) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    // Tagged with the term active at posting time so the scholar app can
    // reset its announcement list once a new semester starts, instead of
    // showing every announcement ever posted forever.
    const activeTerm = getActiveTerm();
    await addDoc(collection(db, 'announcements'), {
      title: data.title,
      message: data.message,
      target: data.target,
      isImportant: !!data.isImportant,
      attachments: data.attachments || [],
      author: 'Admin',
      // Full timestamp (not date-only) so the scholar app can display the
      // actual posting time — a date-only string parses with a midnight
      // time-of-day, which is why announcements always showed "12:00 AM".
      date: new Date().toISOString(),
      createdAt: Date.now(),
      schoolYear: activeTerm?.schoolYear || '',
      semester: activeTerm?.semester || '',
    });
  };

  const updateAnnouncement = async (firestoreId, data) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !firestoreId) return;
    await setDoc(
      doc(db, 'announcements', firestoreId),
      {
        title: data.title,
        message: data.message,
        target: data.target,
        isImportant: !!data.isImportant,
        attachments: data.attachments || [],
      },
      { merge: true }
    );
  };

  const deleteAnnouncement = async (firestoreId) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !firestoreId) return;
    await deleteDoc(doc(db, 'announcements', firestoreId));
  };

  // Events — shared Firestore collection (admin schedules, scholar app and
  // the QR scanner read the same collection).
  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const ref = collection(db, 'events');
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const list = snapshot.docs
        .map((d) => ({ firestoreId: d.id, ...d.data() }))
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      setEvents(list);
    });
    return () => unsubscribe();
  }, [authReady]);

  const addEvent = async (data) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    await addDoc(collection(db, 'events'), {
      name: data.name,
      date: data.date,
      // "HH:mm" strings — kept separate from `date` since that field is
      // consumed as a date-only string/day-truncated DateTime by the scholar
      // app and QR scanner already; combining them would break both.
      startTime: data.startTime || '',
      endTime: data.endTime || '',
      required: !!data.required,
      schoolYear: data.schoolYear || '',
      semester: data.semester || '',
      createdAt: Date.now(),
    });
  };

  const updateEvent = async (firestoreId, data) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !firestoreId) return;
    await setDoc(
      doc(db, 'events', firestoreId),
      {
        name: data.name,
        date: data.date,
        startTime: data.startTime || '',
        endTime: data.endTime || '',
        required: !!data.required,
        schoolYear: data.schoolYear || '',
        semester: data.semester || '',
      },
      { merge: true }
    );
  };

  // Deletes an event AND the attendance it produced.
  //
  // A scholar's attendance is not stored on the event — it lives in an
  // `attendance` array on that scholar's own user document, keyed by the event
  // NAME. Deleting only the event document therefore orphaned those entries,
  // and because Attendance.jsx counts any record whose activity no longer
  // matches a scheduled event as "extra" attendance (the path meant for QR
  // scans not tied to a scheduled event), deleted events kept showing up in
  // scholars' totals — e.g. "0/3" with no events left on the page. The delete
  // confirmation already promised these records would be removed.
  //
  // Matching is by name because that is the only link the attendance records
  // carry; two events sharing a name would clear each other's records, which
  // is the same assumption the rest of this screen already makes.
  const deleteEvent = async (firestoreId) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !firestoreId) return;

    const eventName = events.find((e) => e.firestoreId === firestoreId)?.name;

    await deleteDoc(doc(db, 'events', firestoreId));
    if (!eventName) return;

    const hasRecord = (a) =>
      (a.attendance || []).some((r) => r.activity === eventName);
    const stripped = (a) => ({
      ...a,
      attendance: (a.attendance || []).filter((r) => r.activity !== eventName),
    });

    // Persist first, then update local state, so a failed write cannot leave
    // the UI showing records that still exist in Firestore.
    await Promise.all(
      applicants.filter(hasRecord).map((a) => syncApplicantToFirestore(stripped(a)))
    );
    setApplicants((prev) => prev.map((a) => (hasRecord(a) ? stripped(a) : a)));
  };

  // Direct messages — shared `messages` collection (admin ↔ scholar, two-way)
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const ref = collection(db, 'messages');
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ firestoreId: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [authReady]);

  // Group chats — shared `group_chats` collection so groups persist across
  // refreshes and reach the scholar app. Messages are stored as an array field
  // on each group doc to keep a single real-time listener.
  const [groupChats, setGroupChats] = useState([]);

  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const ref = collection(db, 'group_chats');
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ firestoreId: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setGroupChats(list);
      },
      (error) => console.error('Group chats listener error:', error)
    );
    return () => unsubscribe();
  }, [authReady]);

  // Creates a group chat. `memberIds` are Firestore user ids (firestoreId).
  const createGroupChat = async ({ name, memberIds = [] }) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return null;
    const ref = await addDoc(collection(db, 'group_chats'), {
      name,
      memberIds,
      messages: [],
      createdAt: Date.now(),
      createdBy: 'admin',
    });
    return ref.id;
  };

  const sendGroupMessage = async (groupFirestoreId, text, attachments = []) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !groupFirestoreId || !text) return;
    await updateDoc(doc(db, 'group_chats', groupFirestoreId), {
      messages: arrayUnion({
        id: Date.now(),
        sender: 'Admin',
        senderId: 'admin',
        text,
        timestamp: new Date().toISOString(),
        attachments,
      }),
    });
  };

  const addGroupMembers = async (groupFirestoreId, memberIds = []) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !groupFirestoreId || memberIds.length === 0) return;
    await updateDoc(doc(db, 'group_chats', groupFirestoreId), {
      memberIds: arrayUnion(...memberIds),
    });
  };

  const deleteGroupChat = async (groupFirestoreId) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !groupFirestoreId) return;
    await deleteDoc(doc(db, 'group_chats', groupFirestoreId));
  };

  // Auto-managed per-school group chats. One group per ELIGIBLE school (the
  // same catalog managed in Administration > System Settings > Eligible
  // Schools) — created upfront even before that school has any scholars, so
  // the Messages list always shows every school, not just the ones that
  // happen to have an active scholar yet. Membership is reconciled to
  // exactly that school's currently-active scholars (approved/active/
  // on-hold) every time `applicants` changes — so an approval adds the new
  // scholar and a termination/graduation removes them, no matter which of
  // the several code paths above changed their status (manual admin action,
  // the auto-graduation sweep, the auto on-hold/reactivate sweeps, the
  // auto-absence sweep, or archiving to Scholar History). `autoManaged: true`
  // + `school` tag these groups so admin-created manual groups (even one that
  // happens to share a school's name) are never touched by this sweep.
  const autoGroupCreatingRef = useRef(new Set());

  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;

    const bySchool = computeDesiredSchoolMemberships(applicants);
    // Union of the eligible-schools catalog and any school name that actually
    // appears on a scholar record — mirrors the same catalog-plus-actual
    // pattern already used for the "Scholars per HEI" chart and Reports'
    // school filter, so a school with a scholar but a not-yet-cataloged name
    // still gets a group instead of being silently skipped.
    const allSchoolNames = new Set([
      ...(catalogSchools || []).map((s) => s?.name).filter(Boolean),
      ...bySchool.keys(),
    ]);

    allSchoolNames.forEach((school) => {
      const desired = bySchool.get(school) || [];
      const groupId = autoGroupDocId(school);
      const group = groupChats.find((g) => g.firestoreId === groupId);

      if (!group) {
        if (autoGroupCreatingRef.current.has(groupId)) return;
        autoGroupCreatingRef.current.add(groupId);
        // setDoc + merge on a deterministic id, not addDoc — see autoGroupDocId's
        // comment for why (this is what makes concurrent/repeated creation safe).
        // Deliberately omits `messages`/`createdAt`: `!group` only means "not in
        // this tab's local groupChats snapshot yet", which can be true even when
        // the doc already exists server-side (the `group_chats` listener just
        // hasn't caught up) — merge:true only touches fields present in the
        // payload, so leaving these two out means a real message history or
        // original creation date can never be clobbered by this write, even if
        // it fires against an already-existing doc.
        setDoc(
          doc(db, 'group_chats', groupId),
          {
            name: `${school} Scholars`,
            school,
            autoManaged: true,
            memberIds: desired,
            createdBy: 'admin',
          },
          { merge: true }
        )
          .catch(() => {})
          .finally(() => autoGroupCreatingRef.current.delete(groupId));
        return;
      }

      if (membershipUnchanged(group.memberIds, desired)) return;
      updateDoc(doc(db, 'group_chats', group.firestoreId), { memberIds: desired }).catch(() => {});
    });
  }, [authReady, applicants, groupChats, catalogSchools]);

  // Publish the active academic year + semester so the scholar app can
  // auto-assign grades/COR to the current period. Mirrors whichever term is
  // actually active in School Year Management — NOT the static System
  // Settings defaults (defaultAcademicYear/defaultSemester never change once
  // set, which left the scholar app frozen on the initial term forever,
  // regardless of what admin later activated via "Set Active").
  useEffect(() => {
    if (!authReady) return;
    const activeSy = schoolYears.find((s) => s.isActive);
    const activeSem = activeSy?.semesters?.find((s) => s.isActive);
    if (!activeSy || !activeSem) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    setDoc(
      doc(db, 'system_config', 'academic'),
      {
        activeSchoolYear: activeSy.label,
        activeSemester: activeSem.name,
      },
      { merge: true }
    ).catch(() => {});
  }, [authReady, schoolYears]);

  // Sends a message from the admin to a student (the scholar app reads it).
  const sendDirectMessage = async (toUserId, body, subject = 'Message from CED', attachments = []) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !toUserId || !body) return;
    await addDoc(collection(db, 'messages'), {
      fromUserId: 'admin',
      toUserId,
      subject,
      body,
      createdAt: new Date().toISOString(),
      readBy: ['admin'],
      attachments,
    });
  };

  // Clear any stale applicants cache from older builds so it can never resurrect
  // deleted records. The list is sourced live from Firestore below.
  useEffect(() => {
    try { localStorage.removeItem(APPLICANTS_STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  // Firestore real-time listener — activates automatically once .env credentials are added
  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const fromFirestore = [];
        const archivedApplicants = [];
        const archivedScholars = [];
        snapshot.docs.forEach((docSnap) => {
          try {
            const d = docSnap.data();
            // Include applicants and scholars (an approved applicant becomes a
            // scholar), but skip the admin record and removed records.
            // Staff/admin/viewer accounts live in this same collection — exclude
            // them so they never leak into the Scholars/Applications lists.
            if (['admin', 'staff', 'viewer', 'super_admin'].includes(d.role)) return;
            const type = d.studentType;
            if (type && type !== 'applicant' && type !== 'scholar') return;
            if (d.adminStatus === 'removed') return;
            // Archived records live in the History module — keep them out of the
            // active Applicants/Scholars lists so those pages stay clean, and
            // build the History lists straight from the (already-readable) user
            // docs so History works without a separate collection/rules deploy.
            if (d.archived === true) {
              const record = normalizeApplicantFinancialFields(
                mapStudentToApplicant({ ...d, id: docSnap.id }),
                catalogProgramsRef.current
              );
              if (d.archiveType === 'scholar') {
                archivedScholars.push({
                  historyId: docSnap.id,
                  ...buildScholarHistoryDoc(record, d.archiveReason || record.status),
                  archivedDate: d.archivedDate || record.createdAt,
                });
              } else {
                archivedApplicants.push({
                  historyId: docSnap.id,
                  ...buildApplicantHistoryDoc(record, d.archiveReason),
                  archivedDate: d.archivedDate || record.createdAt,
                });
              }
              return;
            }
            // Skip users who registered but haven't submitted an application yet
            // (and weren't added/managed by an admin) — they shouldn't appear as
            // applicants or be counted until they actually submit.
            if (!hasSubmittedApplication(d)) return;
            // Pass the doc id so firestoreId is always set, even for docs whose
            // data has no `id` field (admin-created) — otherwise admin writes
            // (status, semester enrollment, …) would silently no-op.
            fromFirestore.push(normalizeApplicantFinancialFields(mapStudentToApplicant({ ...d, id: docSnap.id }), catalogProgramsRef.current));
          } catch (err) {
            console.error('Skipping malformed user doc', docSnap.id, err);
          }
        });

        const byArchivedDesc = (a, b) =>
          String(b.archivedDate || '').localeCompare(String(a.archivedDate || ''));
        setApplicantHistory(archivedApplicants.sort(byArchivedDesc));
        setScholarHistory(archivedScholars.sort(byArchivedDesc));

        setApplicants(prev => {
          // Firestore is the source of truth for synced applicants; keep any
          // admin-only rows that have no Firestore id.
          const prevById = new Map(
            prev.filter(a => a.firestoreId).map(a => [a.firestoreId, a])
          );
          // Preserve locally-known identity fields when the Firestore doc is
          // missing them, so a record never loses its name to a blank remote
          // copy (the auto-sync then pushes the name back up for everyone).
          const merged = fromFirestore.map((f) => {
            const local = prevById.get(f.firestoreId);
            if (!local) return f;
            return {
              ...f,
              name: f.name || local.name || '',
              firstName: f.firstName || local.firstName || '',
              middleName: f.middleName || local.middleName || '',
              lastName: f.lastName || local.lastName || '',
              suffix: f.suffix || local.suffix || '',
              school: f.school || local.school || '',
              program: f.program || local.program || '',
            };
          });
          const adminOnly = prev.filter(a => !a.firestoreId);
          return [...merged, ...adminOnly].map((a, i) => ({ ...a, id: i + 1 }));
        });
      },
      (error) => {
        console.error('Firestore users listener error:', error);
      }
    );

    return () => unsubscribe();
  }, [authReady]);

  // NOTE: The History lists (applicantHistory / scholarHistory) are derived
  // directly from the archived `users` docs in the listener above, so the
  // History pages work using the already-deployed `users` rules. The dedicated
  // `applicant_history` / `scholar_history` collections are still written to
  // best-effort for reporting once their rules are deployed, but are not
  // required for the History pages to display data.

  // Migration: applicants with no school year inherit the currently active
  // school year (so a new registrant lands in the real current term, not a
  // hardcoded past year). Falls back to the current calendar year if no active
  // school year is configured yet.
  useEffect(() => {
    const activeSy = schoolYears.find(s => s.isActive);
    const y = new Date().getFullYear();
    const activeYearLabel = activeSy?.label || `${y}-${y + 1}`;

    const needsMigration = applicants.some(a => !a.schoolYear);
    const needsFinancialSync = applicants.some((a) => {
      const normalizedTuition = Math.max(0, toNumber(a?.tuitionFee));
      return toNumber(a?.amountGranted) !== computeReflectedAmount(normalizedTuition, a?.school, a?.program, catalogProgramsRef.current);
    });

    if (needsMigration || needsFinancialSync) {
      const migratedApplicants = applicants.map(applicant => {
        const wasBlank = !applicant.schoolYear;
        const migrated = {
          ...normalizeApplicantFinancialFields(applicant, catalogProgramsRef.current),
          schoolYear: applicant.schoolYear || activeYearLabel,
        };
        // Persist a newly-assigned school year so it sticks and the scholar app
        // shows the right academic year — but only when we have a real active
        // school year (not the calendar-year fallback).
        if (wasBlank && activeSy && migrated.firestoreId) {
          syncApplicantToFirestore(migrated);
        }
        return migrated;
      });
      setApplicants(migratedApplicants);
    }
  }, [applicants, schoolYears]);

  // Backfill: every scholar (an approved applicant) must have a Scholar ID.
  // Approved applicants synced from Firestore don't pass through addApplicant,
  // so their scholarId can be null — assign and persist one here.
  useEffect(() => {
    const SCHOLAR_STATUSES = ['approved', 'active', 'on-hold', 'graduated', 'terminated'];
    const missing = applicants.filter(
      (a) => SCHOLAR_STATUSES.includes(a.status) && !a.scholarId
    );
    if (missing.length === 0) return;

    const currentYear = new Date().getFullYear();
    const existingNums = applicants
      .filter((a) => a.scholarId && String(a.scholarId).startsWith(String(currentYear)))
      .map((a) => parseInt(String(a.scholarId).split('-')[1], 10))
      .filter((n) => !Number.isNaN(n));
    let next = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;

    setApplicants((prev) =>
      prev.map((a) => {
        if (SCHOLAR_STATUSES.includes(a.status) && !a.scholarId) {
          const scholarId = `${currentYear}-${String(next).padStart(5, '0')}`;
          next += 1;
          const updated = { ...a, scholarId };
          syncApplicantToFirestore(updated); // persist so it survives refresh
          return updated;
        }
        return a;
      })
    );
  }, [applicants]);

  // Theme management
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ced-theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ced-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      SYSTEM_SETTINGS_STORAGE_KEY,
      JSON.stringify(systemSettings)
    );
  }, [systemSettings]);

  // Firestore-backed system config — keeps numberOfSemesters (and any other
  // persisted settings) in sync across browsers and dev-server restarts.
  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const unsubscribe = onSnapshot(
      doc(db, 'system_config', 'settings'),
      (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        if (data.numberOfSemesters != null) {
          setSystemSettings(prev => ({ ...prev, numberOfSemesters: data.numberOfSemesters }));
        }
      },
      () => { /* ignore permission errors on undeployed rules */ }
    );
    return () => unsubscribe();
  }, [authReady]);

  // Scholar ID card template — a single Firestore doc holding the front/back
  // background images, the mayor's name/signature, and the two logo images the
  // scholar app composites onto a scholar's digital ID card.
  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const unsubscribe = onSnapshot(
      doc(db, 'system_config', 'scholarIdCardTemplate'),
      (snap) => setIdCardTemplate(snap.exists() ? snap.data() : null),
      (error) => console.error('Firestore scholarIdCardTemplate listener error:', error)
    );
    return () => unsubscribe();
  }, [authReady]);

  const saveIdCardTemplate = async (templateData) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    await setDoc(
      doc(db, 'system_config', 'scholarIdCardTemplate'),
      { ...templateData, isActive: true, updatedAt: Date.now(), updatedBy: 'Admin' },
      { merge: true }
    );
  };

  // Rolls back to the plain, template-less fallback card for every scholar
  // without touching the saved images/mayor details, so an admin who activated
  // a broken/wrong template can undo it without re-uploading anything.
  const deactivateIdCardTemplate = async () => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    await setDoc(
      doc(db, 'system_config', 'scholarIdCardTemplate'),
      { isActive: false, updatedAt: Date.now(), updatedBy: 'Admin' },
      { merge: true }
    );
  };

  // Applicant-evaluation rubric — a single Firestore doc so every admin
  // device (and Reports.jsx's labels) stay in sync with whatever an admin
  // last saved in Administration > Evaluation Criteria.
  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const unsubscribe = onSnapshot(
      doc(db, 'system_config', 'evaluationRubric'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setEvaluationRubric({
          requirementsRubric: Array.isArray(data.requirementsRubric) && data.requirementsRubric.length > 0
            ? data.requirementsRubric
            : DEFAULT_EVALUATION_RUBRIC.requirementsRubric,
          economicRubric: Array.isArray(data.economicRubric) && data.economicRubric.length > 0
            ? data.economicRubric
            : DEFAULT_EVALUATION_RUBRIC.economicRubric,
          requirementsWeight: typeof data.requirementsWeight === 'number'
            ? data.requirementsWeight
            : DEFAULT_EVALUATION_RUBRIC.requirementsWeight,
          economicWeight: typeof data.economicWeight === 'number'
            ? data.economicWeight
            : DEFAULT_EVALUATION_RUBRIC.economicWeight,
          examWeight: typeof data.examWeight === 'number' ? data.examWeight : DEFAULT_EVALUATION_RUBRIC.examWeight,
          customCriteria: Array.isArray(data.customCriteria)
            ? data.customCriteria
            : DEFAULT_EVALUATION_RUBRIC.customCriteria,
        });
      },
      (error) => console.error('Firestore evaluationRubric listener error:', error)
    );
    return () => unsubscribe();
  }, [authReady]);

  const updateEvaluationRubric = async (updates) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    await setDoc(
      doc(db, 'system_config', 'evaluationRubric'),
      { ...updates, updatedAt: Date.now(), updatedBy: 'Admin' },
      { merge: true }
    );
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const updateSystemSettings = (updates) => {
    setSystemSettings(prev => ({
      ...prev,
      ...updates,
    }));
    // Persist numberOfSemesters to Firestore so it survives browser/server restarts.
    if ('numberOfSemesters' in updates) {
      const { db, isReady } = initializeFirebase();
      if (isReady && db) {
        setDoc(
          doc(db, 'system_config', 'settings'),
          { numberOfSemesters: updates.numberOfSemesters },
          { merge: true }
        ).catch(() => {});
      }
    }
  };

  const resetSystemSettings = () => {
    setSystemSettings(defaultSystemSettings);
  };



  // Generate Scholar ID in format: Year-5digits (e.g., 2026-00234)
  const generateScholarId = () => {
    const currentYear = new Date().getFullYear();
    const existingIds = applicants
      .filter(a => a.scholarId && a.scholarId.startsWith(currentYear.toString()))
      .map(a => parseInt(a.scholarId.split('-')[1]))
      .filter(num => !isNaN(num));
    
    const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const paddedNumber = String(nextNumber).padStart(5, '0');
    
    return `${currentYear}-${paddedNumber}`;
  };

  // Applicant CRUD
  const addApplicant = (applicant) => {
    const scholarId = applicant.scholarId || generateScholarId();

    // Reserve a Firestore document id up front so the new record persists to
    // Firestore (and therefore appears in every other browser / device), not
    // just this browser's localStorage.
    const { db, isReady } = initializeFirebase();
    let firestoreId = applicant.firestoreId || null;
    let userRef = null;
    if (isReady && db) {
      userRef = firestoreId ? doc(db, 'users', firestoreId) : doc(collection(db, 'users'));
      firestoreId = userRef.id;
    }

    const newApplicant = normalizeApplicantFinancialFields({
      ...applicant,
      id: Math.max(0, ...applicants.map(a => a.id)) + 1,
      firestoreId,
      scholarId,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'pending',
      ranking: null,
      attendance: [],
      grades: [],
      yearAwarded: applicant.yearAwarded || new Date().getFullYear(),
    }, catalogProgramsRef.current);

    if (userRef) {
      setDoc(
        userRef,
        {
          ...buildUserDocFromApplicant(newApplicant),
          studentType: 'applicant',
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => { /* keep UI responsive */ });
    }

    setApplicants([...applicants, newApplicant]);
    logAudit({
      action: 'CREATE',
      collection: 'users',
      documentId: newApplicant.firestoreId || newApplicant.scholarId || String(newApplicant.id),
      details: `Created record for ${newApplicant.name || 'applicant'}`,
    });
    return newApplicant;
  };

  // Writes a record into its History collection, flags the source user doc as
  // archived (so it leaves the active lists), and records the action in the
  // Audit Trail. `reason` only applies to applicant archives.
  const writeRecordToHistory = (record, { reason } = {}) => {
    const { db, isReady } = initializeFirebase();
    const isScholarArchive = record.status === 'graduated' || record.status === 'terminated';

    if (isReady && db) {
      const historyCollection = isScholarArchive ? 'scholar_history' : 'applicant_history';
      const historyDoc = isScholarArchive
        ? buildScholarHistoryDoc(record, record.status)
        : buildApplicantHistoryDoc(record, reason);
      addDoc(collection(db, historyCollection), historyDoc).catch(() => {});

      // Flag the source user doc archived (and sync the status so the scholar
      // app reflects graduation/termination) without hard-deleting the account.
      if (record.firestoreId) {
        setDoc(
          doc(db, 'users', record.firestoreId),
          {
            ...buildUserDocFromApplicant(record),
            archived: true,
            archivedDate: todayISO(),
            archiveType: isScholarArchive ? 'scholar' : 'applicant',
            archiveReason: isScholarArchive ? record.status : (reason || ''),
          },
          { merge: true }
        ).catch(() => {});
      }
    }

    logAudit({
      action: 'ARCHIVE',
      collection: isScholarArchive ? 'scholar_history' : 'applicant_history',
      documentId: record.firestoreId || record.scholarId || String(record.id),
      details: isScholarArchive
        ? `Archived scholar ${record.name || ''} to Scholar History (${record.status})`
        : `Archived applicant ${record.name || ''} to Applicant History (${reason || 'inactive'})`,
    });
  };

  const updateApplicant = (id, updates) => {
    let edited = null;
    let archived = null;
    const next = [];

    applicants.forEach((a) => {
      if (a.id !== id) {
        next.push(a);
        return;
      }

      let updated = normalizeApplicantFinancialFields({ ...a, ...updates }, catalogProgramsRef.current);

      // Auto-evaluate when grades or attendance are explicitly updated.
      // Only applies to active/approved scholars — never overrides a manual
      // status change made in the same update.
      const evalOnGradesOrAttendance =
        ('grades' in updates || 'attendance' in updates) &&
        !('status' in updates) &&
        (updated.status === 'active' || updated.status === 'approved');

      if (evalOnGradesOrAttendance) {
        const activeTerm = getActiveTerm();
        // Excessive absences → auto-terminate. Only events scheduled for the
        // currently active term count — an absence from a semester that has
        // already ended shouldn't keep counting once a new term has started.
        if (!updated.isStAugustine) {
          const termEvents = activeTerm
            ? events.filter((e) => e.schoolYear === activeTerm.schoolYear && e.semester === activeTerm.semester)
            : [];
          const absences = termEvents.filter((event) => {
            if (!hasEventEnded(event)) return false;
            const rec = (updated.attendance || []).find((a) => a.activity === event.name);
            return !rec || !rec.present;
          }).length;
          if (absences > 2) {
            updated = {
              ...updated,
              status: 'terminated',
              terminationReason: `Exceeded absence limit (${absences} absences)`,
            };
          }
        }
        // Failing / INC subject → auto on-hold (only if not already terminated)
        if (updated.status !== 'terminated' && hasFailingOrIncGrades(updated.grades, activeTerm)) {
          updated = { ...updated, status: 'on-hold' };
        }
      }

      edited = updated;

      // Only rejected applicants are immediately archived. Graduated/terminated
      // scholars stay visible until the semester ends.
      const becameArchived =
        ARCHIVE_STATUSES.includes(updated.status) && !ARCHIVE_STATUSES.includes(a.status);

      if (becameArchived) {
        archived = updated;
        // omit from `next` — it now belongs to the History module
      } else {
        // Push admin changes (approval, scores, scholar id, etc.) to Firestore
        // so the scholar app reflects them.
        syncApplicantToFirestore(updated);
        next.push(updated);
      }
    });

    setApplicants(next);

    if (archived) {
      writeRecordToHistory(archived, {
        reason: archived.status === 'rejected' ? APPLICANT_ARCHIVE_REASONS.rejected : undefined,
      });
    } else if (edited) {
      // Record WHO edited the saved record and WHEN, for the Audit Trail.
      logAudit({
        action: 'UPDATE',
        collection: 'users',
        documentId: edited.firestoreId || edited.scholarId || String(edited.id),
        details: `Edited record for ${edited.name || 'applicant'}`,
      });
    }
  };

  // Manually archive an applicant to Applicant History (used for "school year
  // ended & not approved" and "inactive / expired" cases that aren't a rejection).
  const archiveApplicant = (id, reasonKey = 'inactive') => {
    const target = applicants.find((a) => a.id === id);
    if (!target) return;
    const reason = APPLICANT_ARCHIVE_REASONS[reasonKey] || APPLICANT_ARCHIVE_REASONS.inactive;
    setApplicants((prev) => prev.filter((a) => a.id !== id));
    writeRecordToHistory({ ...target, status: 'rejected' }, { reason });
  };

  // Reconstructs the historical range for a legacy scholar (predates
  // countedTerms, only has the old single-value legacyLastCountedTerm):
  // every currently-configured term between when they started
  // (schoolYear/semester) and the last term they were counted for under the
  // old scheme, inclusive. Shared by enrollActiveScholarsInSemester's bump
  // (below) and the one-time countedTerms repair effect (further below).
  const reconstructLegacyTerms = (a) => {
    const startKey = termSortKey(a.schoolYear, a.semester || '1st Semester');
    const endKey = a.legacyLastCountedTerm
      ? termSortKey(...a.legacyLastCountedTerm.split('::'))
      : startKey;
    return schoolYearsRef.current
      .flatMap((sy) => (sy.semesters || []).map((sem) => ({
        key: `${sy.label}::${sem.name}`,
        sortKey: termSortKey(sy.label, sem.name),
      })))
      .filter((t) => t.sortKey >= startKey && t.sortKey <= endKey)
      .map((t) => t.key);
  };

  // Advances the active term: every active/approved/on-hold scholar's
  // Semesters Used ticks up simply because a new term has started — this is
  // a program-timeline counter, not a reward for individual verification, so
  // it advances the same way for an on-hold scholar, a scholar marked "Not
  // Enrolled", or one just restored from Scholar History. It also resets
  // enrollmentStatus for a fresh check ("Verified" was for the term that
  // just ended) — but that reset is now purely about the enrollment
  // badge/financial grant (see grantSemesterIfNeeded), a separate concern
  // from the count. `countedTerms` (the SET of every term ever counted, not
  // just the most recent one) keeps this idempotent per-term — re-activating
  // an already-counted term (e.g. toggling back to a previous term) is
  // correctly a no-op instead of counting it again.
  const enrollActiveScholarsInSemester = (schoolYear, semester) => {
    if (!schoolYear || !semester) return { enrolled: 0 };
    const termKey = `${schoolYear}::${semester}`;
    const semLimit = systemSettings.numberOfSemesters || 8;

    const needsCounting = (a) => {
      const isActiveScholar = a.status === 'approved' || a.status === 'active' || a.status === 'on-hold';
      return isActiveScholar && !(a.countedTerms || []).includes(termKey);
    };

    const bump = (a) => {
      let baseCountedTerms = Array.isArray(a.countedTerms) ? a.countedTerms : [];
      // Union in the reconstructed historical range for scholars with a
      // legacy legacyLastCountedTerm marker — a Set union is safe/idempotent
      // regardless of whatever's already in countedTerms, and self-heals if
      // it was ever incompletely populated (e.g. a scholar whose countedTerms
      // only ever picked up the term active at the moment they were first
      // touched under this scheme, before this reconstruction existed).
      if (a.legacyLastCountedTerm || (a.semestersUsed || 0) > 0) {
        baseCountedTerms = Array.from(new Set([...baseCountedTerms, ...reconstructLegacyTerms(a)]));
      }

      const nextCountedTerms = baseCountedTerms.includes(termKey)
        ? baseCountedTerms
        : [...baseCountedTerms, termKey];
      const newSemestersUsed = Math.min(semLimit, nextCountedTerms.length);
      return {
        ...a,
        semestersUsed: newSemestersUsed,
        yearLevel: Math.ceil(newSemestersUsed / 2),
        countedTerms: nextCountedTerms,
        // A new term means a fresh enrollment check — the admin's previous
        // "Verified" confirmation was for the term that just ended.
        enrollmentStatus: null,
        enrollmentNotEnrolledReason: null,
      };
    };

    // Computed synchronously from applicantsRef.current — NOT by mutating an
    // outer `count`/`toSync` from inside the setApplicants updater below.
    // React doesn't guarantee that a functional updater runs synchronously at
    // the call site, so mutating outer variables there and reading them right
    // after (the previous approach) silently read stale initial values: the
    // in-memory bump still applied correctly (which is why the admin's own
    // session always rendered the right number), but syncApplicantToFirestore
    // never actually fired, so Firestore itself never advanced.
    const toSync = applicantsRef.current.filter(needsCounting).map(bump);
    if (toSync.length === 0) return { enrolled: 0 };

    // Functional update, re-checking each condition against the LIVE `prev`
    // entry (not the snapshot used above) — this can run in the same batch as
    // other functional updates (e.g. the repair migration below), and a
    // non-functional `setApplicants(value)` here would silently clobber
    // whichever of the two runs first instead of composing with it.
    setApplicants((prev) => prev.map((a) => (needsCounting(a) ? bump(a) : a)));

    toSync.forEach((a) => syncApplicantToFirestore(a));
    logAudit({
      action: 'UPDATE',
      collection: 'users',
      documentId: 'multiple',
      details: `Advanced ${toSync.length} scholar(s) into ${semester} (${schoolYear})`,
    });
    return { enrolled: toSync.length };
  };

  // One-time repair: reconstructs countedTerms for scholars whose count was
  // already touched under this scheme before reconstruction was inlined into
  // enrollActiveScholarsInSemester's bump — their countedTerms only ever
  // picked up whatever term was active at that moment (e.g. from admin
  // toggling "Set Active" back and forth between two terms while testing,
  // which used to increment Semesters Used every single time). Same union
  // logic as bump, so it's safe to run repeatedly and self-limiting: once
  // fully reconstructed, the union is a no-op.
  useEffect(() => {
    const keyOf = (a) => a.firestoreId || a.scholarId || String(a.id);
    const semLimit = systemSettings.numberOfSemesters || 8;
    const toFix = applicants.filter((a) => {
      if (!a.legacyLastCountedTerm && !(a.semestersUsed > 0)) return false;
      const reconstructed = reconstructLegacyTerms(a);
      const current = new Set(a.countedTerms || []);
      return reconstructed.some((t) => !current.has(t));
    });
    if (toFix.length === 0) return;

    const fixKeys = new Set(toFix.map(keyOf));
    setApplicants((prev) =>
      prev.map((a) => {
        if (!fixKeys.has(keyOf(a))) return a;
        const merged = Array.from(new Set([...(a.countedTerms || []), ...reconstructLegacyTerms(a)]));
        if (merged.length === (a.countedTerms || []).length) return a;
        const newSemestersUsed = Math.min(semLimit, merged.length);
        const next = {
          ...a,
          countedTerms: merged,
          semestersUsed: newSemestersUsed,
          yearLevel: Math.max(1, Math.ceil(newSemestersUsed / 2)),
        };
        syncApplicantToFirestore(next);
        return next;
      })
    );
  }, [applicants, schoolYears, systemSettings.numberOfSemesters]);

  // Safety net: guarantees the currently active term's scholars get counted
  // even if the active term changed through a path other than "Add
  // Term"/"Set Active" (e.g. the very first school year ever added becomes
  // active automatically, with no explicit "Set Active" click to hang this
  // off of). Idempotent via countedTerms, so this only ever acts once per
  // scholar per term regardless of how many times it fires.
  useEffect(() => {
    const activeSy = schoolYears.find((s) => s.isActive);
    const activeSem = activeSy?.semesters?.find((s) => s.isActive);
    if (!activeSy || !activeSem) return;
    enrollActiveScholarsInSemester(activeSy.label, activeSem.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicants, schoolYears]);

  // Grants a specific (schoolYear, semester) to a scholar if it isn't already
  // recorded — the one place enrolledSemesters/the scholarship grant gets a
  // new entry. This is purely financial and does NOT touch Semesters Used —
  // that count advances on its own whenever a term starts (see
  // enrollActiveScholarsInSemester), independent of verification. Shared by
  // verifyScholarEnrollment ("Evaluate Enrollment" → Enrolled) and
  // confirming a scholar's grades in Academic Records — either is solid
  // evidence the semester actually happened, so either can grant the money.
  // Returns the applicant unchanged if already granted or at the semester cap.
  const grantSemesterIfNeeded = (applicant, schoolYear, semester) => {
    if (!schoolYear || !semester) return applicant;
    const existing = Array.isArray(applicant.enrolledSemesters) ? applicant.enrolledSemesters : [];
    const semLimit = systemSettings.numberOfSemesters || 8;
    const alreadyGranted = existing.some((e) => e.schoolYear === schoolYear && e.semester === semester);
    if (alreadyGranted || existing.length >= semLimit) return applicant;

    const isOnHold = applicant.status === 'on-hold';
    const perSemGrant = isOnHold ? 0 : resolvePerSemGrant(applicant, catalogProgramsRef.current);
    return {
      ...applicant,
      enrolledSemesters: [
        ...existing,
        {
          schoolYear,
          semester,
          grantedAmount: perSemGrant,
          status: isOnHold ? 'on_hold' : 'disbursed',
          enrolledAt: todayISO(),
        },
      ],
      ...(!isOnHold && { amountGranted: perSemGrant }),
    };
  };

  // Grants a scholar their currently-active term once an admin confirms
  // enrollment via "Evaluate Enrollment".
  const verifyScholarEnrollment = (id, status, reason = '') => {
    const target = applicantsRef.current.find((a) => a.id === id);
    if (!target) return;

    let next = {
      ...target,
      enrollmentStatus: status,
      enrollmentNotEnrolledReason: status === 'Not Enrolled' ? (reason || '') : null,
    };

    if (status === 'Verified') {
      const activeSy = schoolYearsRef.current.find((s) => s.isActive);
      const activeSem = activeSy?.semesters?.find((s) => s.isActive);
      if (activeSy && activeSem) {
        next = grantSemesterIfNeeded(next, activeSy.label, activeSem.name);
      }
    }

    setApplicants((prev) => prev.map((a) => (a.id === id ? next : a)));
    syncApplicantToFirestore(next);
    logAudit({
      action: 'UPDATE',
      collection: 'users',
      documentId: next.firestoreId || next.scholarId || String(next.id),
      details: `Set enrollment status to ${status} for ${next.name || 'scholar'}`,
    });
    return next;
  };

  // Persists a scholar's per-semester grade confirmation/revision map and,
  // when a period is being newly confirmed, also grants that semester (see
  // grantSemesterIfNeeded) in the SAME state update — a scholar's grades
  // being confirmed is solid evidence the semester happened, so this
  // shouldn't need a separate "Evaluate Enrollment" click to count toward
  // Semesters Used / Financial Information. Doing both in one functional
  // update (rather than a separate grant call alongside updateApplicant)
  // avoids one write clobbering the other.
  const setGradesEvaluation = (id, gradesEvaluation, grantIfConfirmed) => {
    let result = null;
    setApplicants((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        let next = { ...a, gradesEvaluation };
        if (grantIfConfirmed) {
          next = grantSemesterIfNeeded(next, grantIfConfirmed.schoolYear, grantIfConfirmed.semester);
        }
        result = next;
        return next;
      })
    );
    if (!result) return;
    syncApplicantToFirestore(result);
    logAudit({
      action: 'UPDATE',
      collection: 'users',
      documentId: result.firestoreId || result.scholarId || String(result.id),
      details: `Updated grade evaluation for ${result.name || 'scholar'}`,
    });
  };

  // Cleanup: verifyScholarEnrollment always sets "Verified" together with the
  // matching enrolledSemesters entry for the current term, so the two should
  // never be out of sync — but a scholar restored from history before the
  // restore reset existed (or any other stale-data edge case) can end up
  // "Verified" with no grant to back it up, leaving them stuck showing
  // "ENROLLED" without ever having been checked for the term that's actually
  // running. Clear the stale flag so they correctly show "FOR VERIFICATION".
  useEffect(() => {
    const activeSy = schoolYears.find((s) => s.isActive);
    const activeSem = activeSy?.semesters?.find((s) => s.isActive);
    if (!activeSy || !activeSem) return;

    const keyOf = (a) => a.firestoreId || a.scholarId || String(a.id);
    const toFix = applicants.filter((a) => {
      if (a.enrollmentStatus !== 'Verified') return false;
      const enrolled = Array.isArray(a.enrolledSemesters) ? a.enrolledSemesters : [];
      return !enrolled.some((e) => e.schoolYear === activeSy.label && e.semester === activeSem.name);
    });
    if (toFix.length === 0) return;

    const fixKeys = new Set(toFix.map(keyOf));
    setApplicants((prev) =>
      prev.map((a) => {
        if (!fixKeys.has(keyOf(a))) return a;
        const next = { ...a, enrollmentStatus: null, enrollmentNotEnrolledReason: null };
        syncApplicantToFirestore(next);
        return next;
      })
    );
  }, [applicants, schoolYears]);

  // One-time reconciliation: a scholar's grades could be confirmed in
  // Academic Records without an admin ever separately clicking "Evaluate
  // Enrollment" for that period — before setGradesEvaluation granted on
  // confirm, that gap left Semesters Used / Financial Information
  // permanently understated for an otherwise fully-evaluated semester. Grant
  // any confirmed period that's still missing its enrolledSemesters entry.
  useEffect(() => {
    const toGrant = new Map();
    applicants.forEach((a) => {
      const evalMap = a.gradesEvaluation || {};
      const enrolled = Array.isArray(a.enrolledSemesters) ? a.enrolledSemesters : [];
      Object.entries(evalMap).forEach(([key, ev]) => {
        if (ev?.status !== 'confirmed') return;
        const [schoolYear, semester] = key.split('::');
        if (!schoolYear || !semester) return;
        if (enrolled.some((e) => e.schoolYear === schoolYear && e.semester === semester)) return;
        if (!toGrant.has(a.id)) toGrant.set(a.id, []);
        toGrant.get(a.id).push({ schoolYear, semester });
      });
    });
    if (toGrant.size === 0) return;

    setApplicants((prev) =>
      prev.map((a) => {
        const grants = toGrant.get(a.id);
        if (!grants) return a;
        // Grant in chronological order so Semesters Used advances sensibly
        // for a scholar with more than one confirmed-but-ungranted gap.
        let next = grants
          .sort((x, y) => x.schoolYear.localeCompare(y.schoolYear) || x.semester.localeCompare(y.semester))
          .reduce((acc, g) => grantSemesterIfNeeded(acc, g.schoolYear, g.semester), a);
        if (next !== a) syncApplicantToFirestore(next);
        return next;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicants]);

  // One-time data fix for scholars already affected by the pre-verification-
  // gating bug (granted a term automatically the moment it started, before
  // enrolledSemesters required a confirmed enrollment): their earliest
  // enrolledSemesters entry is mislabeled "2nd Semester" because that was the
  // next term added after them, with the true 1st Semester of that same
  // school year never recorded. Backfill the missing entry whenever that 1st
  // Semester term was actually configured.
  useEffect(() => {
    const keyOf = (a) => a.firestoreId || a.scholarId || String(a.id);
    const earliestOf = (enrolled) =>
      [...enrolled].sort((x, y) => String(x.enrolledAt || '').localeCompare(String(y.enrolledAt || '')))[0];

    const toFix = applicants.filter((a) => {
      const enrolled = Array.isArray(a.enrolledSemesters) ? a.enrolledSemesters : [];
      if (enrolled.length === 0) return false;
      const earliest = earliestOf(enrolled);
      if (earliest.semester !== '2nd Semester') return false;
      const alreadyHasFirst = enrolled.some(
        (e) => e.schoolYear === earliest.schoolYear && e.semester === '1st Semester'
      );
      if (alreadyHasFirst) return false;
      const sy = schoolYears.find((s) => s.label === earliest.schoolYear);
      return (sy?.semesters || []).some((s) => s.name === '1st Semester');
    });
    if (toFix.length === 0) return;

    const fixKeys = new Set(toFix.map(keyOf));
    setApplicants((prev) =>
      prev.map((a) => {
        if (!fixKeys.has(keyOf(a))) return a;
        const enrolled = a.enrolledSemesters || [];
        // Guard against the cleanup-revert effect (above) having already
        // stripped this scholar's only entry in the same batch.
        if (enrolled.length === 0) return a;
        const earliest = earliestOf(enrolled);
        const perSemGrant = resolvePerSemGrant(a, catalogProgramsRef.current);
        const backfilled = {
          schoolYear: earliest.schoolYear,
          semester: '1st Semester',
          grantedAmount: earliest.status === 'on_hold' ? 0 : perSemGrant,
          status: earliest.status || 'disbursed',
          enrolledAt: earliest.enrolledAt || todayISO(),
        };
        // Financial backfill only — Semesters Used is a separate, term-based
        // counter (see enrollActiveScholarsInSemester) and isn't touched here.
        const next = { ...a, enrolledSemesters: [backfilled, ...enrolled] };
        syncApplicantToFirestore(next);
        return next;
      })
    );
  }, [applicants, schoolYears]);

  // Auto-graduation: marks scholars as 'graduated' when they reach the semester
  // limit, but keeps them in the active list. They move to Scholar History when
  // the admin ends the semester via endOfSemesterScholarsCleanup.
  const graduatedSweepRef = useRef(new Set());
  useEffect(() => {
    const keyOf = (a) => a.firestoreId || a.scholarId || String(a.id);
    const maxSemesters = systemSettings.numberOfSemesters || 8;
    const toGraduate = applicants.filter(
      (a) =>
        (a.status === 'active' || a.status === 'approved') &&
        (a.semestersUsed || 0) >= maxSemesters &&
        a.gradExempt !== true &&
        !graduatedSweepRef.current.has(keyOf(a))
    );
    if (toGraduate.length === 0) return;
    toGraduate.forEach((a) => graduatedSweepRef.current.add(keyOf(a)));
    setApplicants((prev) =>
      prev.map((a) => {
        if (!toGraduate.some((g) => keyOf(g) === keyOf(a))) return a;
        const graduated = { ...a, status: 'graduated' };
        syncApplicantToFirestore(graduated);
        return graduated;
      })
    );
  }, [applicants]);

  // Auto on-hold sweep: any active/approved scholar whose CURRENT term's grade
  // entries contain a non-Passed remark is placed on hold and their grant is
  // cleared to 0. Scoped to the active term only — a failing grade from an
  // already-closed semester shouldn't keep re-triggering hold in a new one.
  // This effect catches grades submitted directly from the Flutter scholar app
  // (which write to Firestore and bypass the admin's updateApplicant) as well
  // as grades added via the admin Academic Records form.
  useEffect(() => {
    const activeTerm = getActiveTerm();
    const keyOf = (a) => a.firestoreId || a.scholarId || String(a.id);
    const toHold = applicants.filter(
      (a) =>
        (a.status === 'active' || a.status === 'approved') &&
        hasFailingOrIncGrades(a.grades, activeTerm)
    );
    if (toHold.length === 0) return;

    const holdKeys = new Set(toHold.map(keyOf));
    setApplicants((prev) =>
      prev.map((a) => {
        if (!holdKeys.has(keyOf(a))) return a;
        // Clear the grant so the scholar app shows ₱0 while on hold.
        const onHold = { ...a, status: 'on-hold', amountGranted: 0 };
        syncApplicantToFirestore(onHold);
        return onHold;
      })
    );
  }, [applicants, schoolYears]);

  // Auto-reactivation sweep: an on-hold scholar who has at least one grade on
  // record for the CURRENT term and all of that term's grades are now passing
  // is automatically restored to active with their per-semester grant
  // reinstated. Scoped to the active term so a stale failing grade from an
  // already-closed semester can't keep blocking reactivation. This mirrors the
  // on-hold sweep so that grade corrections (or new grades submitted from the
  // Flutter app) immediately lift the hold without waiting for an admin action.
  useEffect(() => {
    const activeTerm = getActiveTerm();
    const keyOf = (a) => a.firestoreId || a.scholarId || String(a.id);
    const toReactivate = applicants.filter((a) => {
      if (a.status !== 'on-hold') return false;
      const termGrades = activeTerm
        ? (a.grades || []).filter((g) => g.schoolYear === activeTerm.schoolYear && g.semester === activeTerm.semester)
        : [];
      return termGrades.length > 0 && !hasFailingOrIncGrades(termGrades);
    });
    if (toReactivate.length === 0) return;

    const reactivateKeys = new Set(toReactivate.map(keyOf));
    setApplicants((prev) =>
      prev.map((a) => {
        if (!reactivateKeys.has(keyOf(a))) return a;
        const restoredGrant = resolvePerSemGrant(a, catalogProgramsRef.current);
        const active = { ...a, status: 'active', amountGranted: restoredGrant };
        syncApplicantToFirestore(active);
        return active;
      })
    );
  }, [applicants, schoolYears]);

  // Ticks periodically so the auto-absence sweep below re-evaluates against
  // the current time even if nothing else changes (e.g. an admin leaves the
  // Attendance page open past an event's end time with no new scan coming in).
  const [absenceCheckTick, setAbsenceCheckTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAbsenceCheckTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Auto-absence sweep: once a scheduled event's end time has passed, any
  // active/approved scholar (not exempt) with no attendance record for it is
  // recorded absent — they didn't scan in time. Mirrors handleMarkAttendance's
  // manual "mark absent" in Attendance.jsx, but runs automatically as events
  // end rather than requiring the admin to mark each scholar, and auto-
  // terminates past the absence limit the same way.
  useEffect(() => {
    const activeSy = schoolYears.find((s) => s.isActive);
    const activeSem = activeSy?.semesters?.find((s) => s.isActive);
    if (!activeSy || !activeSem) return;

    const termEvents = events.filter(
      (e) => e.schoolYear === activeSy.label && e.semester === activeSem.name && hasEventEnded(e)
    );
    if (termEvents.length === 0) return;

    const keyOf = (a) => a.firestoreId || a.scholarId || String(a.id);
    const missingByScholar = new Map();
    applicants.forEach((a) => {
      if (a.status !== 'active' && a.status !== 'approved') return;
      if (a.isStAugustine) return;
      const attendance = Array.isArray(a.attendance) ? a.attendance : [];
      const missing = termEvents.filter((e) => !attendance.some((r) => r.activity === e.name));
      if (missing.length > 0) missingByScholar.set(keyOf(a), missing);
    });
    if (missingByScholar.size === 0) return;

    setApplicants((prev) =>
      prev.map((a) => {
        const missing = missingByScholar.get(keyOf(a));
        if (!missing) return a;
        const newRecords = missing.map((e) => ({
          activity: e.name,
          date: e.date,
          present: false,
          timeLogged: todayISO(),
          loggedVia: 'Auto (no scan by end time)',
        }));
        const nextAttendance = [...(a.attendance || []), ...newRecords];

        const totalAbsences = termEvents.filter((e) => {
          const rec = nextAttendance.find((r) => r.activity === e.name);
          return !rec || !rec.present;
        }).length;

        const next = {
          ...a,
          attendance: nextAttendance,
          ...(totalAbsences > 2 && {
            status: 'terminated',
            terminationReason: `Exceeded absence limit (${totalAbsences} absences)`,
          }),
        };
        syncApplicantToFirestore(next);
        return next;
      })
    );
  }, [applicants, events, schoolYears, absenceCheckTick]);

  // Manually archive a scholar to Scholar History immediately (admin override).
  const archiveScholar = (id, status = 'graduated') => {
    const target = applicants.find((a) => a.id === id);
    if (!target) return;
    const nextStatus = status === 'graduated' ? 'graduated' : 'terminated';
    setApplicants((prev) => prev.filter((a) => a.id !== id));
    writeRecordToHistory({ ...target, status: nextStatus });
  };

  // End-of-semester cleanup: runs when the admin switches the active term.
  // 1. Archives graduated/terminated scholars to Scholar History.
  // 2. Reactivates on-hold scholars who have cleared all failing grades —
  //    on-hold lasts for the semester it was applied; the new term is a fresh start.
  // 3. Resets every remaining scholar's enrollment verification — it was a
  //    confirmation for the term that just ended, not the one starting now.
  const endOfSemesterScholarsCleanup = () => {
    // Read before the caller flips the active term, so this reflects the
    // term that's ending, not the one about to start.
    const outgoingTerm = getActiveTerm();
    const allApplicants = applicantsRef.current;
    const keyOf = (a) => a.firestoreId || a.scholarId || String(a.id);

    const toArchive = allApplicants.filter(
      (a) => a.status === 'terminated' || a.status === 'graduated'
    );
    toArchive.forEach((a) => writeRecordToHistory(a));

    // On-hold scholars with no remaining failing grades in the outgoing term
    // get a clean slate — a failing grade from an even earlier, already-closed
    // semester shouldn't keep blocking reactivation.
    const toReactivate = allApplicants.filter(
      (a) => a.status === 'on-hold' && !hasFailingOrIncGrades(a.grades, outgoingTerm)
    );
    const reactivateKeys = new Set(toReactivate.map(keyOf));

    setApplicants((prev) =>
      prev
        .filter((a) => a.status !== 'terminated' && a.status !== 'graduated')
        .map((a) => {
          const needsReactivate = reactivateKeys.has(keyOf(a));
          const needsEnrollmentReset = !!a.enrollmentStatus;
          if (!needsReactivate && !needsEnrollmentReset) return a;

          const next = {
            ...a,
            ...(needsReactivate && {
              status: 'active',
              amountGranted: resolvePerSemGrant(a, catalogProgramsRef.current),
            }),
            enrollmentStatus: null,
            enrollmentNotEnrolledReason: null,
          };
          syncApplicantToFirestore(next);
          return next;
        })
    );

    if (toArchive.length > 0) {
      logAudit({
        action: 'ARCHIVE',
        collection: 'scholar_history',
        documentId: 'multiple',
        details: `End-of-semester cleanup: archived ${toArchive.length} graduated/terminated scholar(s) to Scholar History`,
      });
    }

    return { archived: toArchive.length, reactivated: toReactivate.length };
  };

  // Restore an applicant from Applicant History back into the active list.
  const restoreFromHistory = async (historyEntry) => {
    if (!historyEntry) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;

    // Reactivate the source user doc (clear the archived flag).
    // If the snapshot shows a scholarId, this was a scholar incorrectly archived
    // (e.g. by the old carryOver bug) — restore as active scholar so the auto
    // on-hold sweep immediately re-applies on-hold if they have failing grades.
    if (historyEntry.applicantId) {
      try {
        const snapshot = historyEntry.snapshot || {};
        const wasScholar = !!(snapshot.scholarId);
        await setDoc(
          doc(db, 'users', historyEntry.applicantId),
          wasScholar
            ? {
                archived: false,
                archivedDate: null,
                archiveType: null,
                archiveReason: null,
                adminStatus: 'active',
                applicationStatus: 'approved',
                studentType: 'scholar',
                scholarshipStatus: 'Active',
              }
            : { archived: false, archivedDate: null, applicationStatus: 'pending', adminStatus: 'pending' },
          { merge: true }
        );
      } catch (_) { /* keep UI responsive */ }
    }

    // Remove the history record so it leaves the History page.
    if (historyEntry.historyId) {
      try {
        await deleteDoc(doc(db, 'applicant_history', historyEntry.historyId));
      } catch (_) { /* ignore */ }
    }

    logAudit({
      action: 'RESTORE',
      collection: 'users',
      documentId: historyEntry.applicantId || historyEntry.historyId,
      details: `Restored applicant ${historyEntry.fullName || ''} from Applicant History`,
    });
  };

  // Restore a scholar from Scholar History back into the active Scholars list,
  // regardless of how they were archived (graduated OR terminated). The source
  // user doc is reactivated as an active scholar and flagged `gradExempt` so the
  // 8-semester auto-graduation does not immediately re-archive a restored grad.
  const restoreScholarFromHistory = async (historyEntry) => {
    if (!historyEntry) return;
    const userId = historyEntry.applicantId || historyEntry.historyId;
    const { db, isReady } = initializeFirebase();
    if (isReady && db && userId) {
      try {
        await setDoc(
          doc(db, 'users', userId),
          {
            archived: false,
            archivedDate: null,
            archiveType: null,
            archiveReason: null,
            adminStatus: 'active',
            applicationStatus: 'approved',
            studentType: 'scholar',
            scholarshipStatus: 'Active',
            gradExempt: true,
            // A restored scholar hasn't been confirmed enrolled in whatever
            // term is active now — without this they'd show as already
            // "Enrolled" from the term they were terminated in, skipping
            // verification entirely (see verifyScholarEnrollment).
            enrollmentStatus: null,
            enrollmentNotEnrolledReason: null,
          },
          { merge: true }
        );
      } catch (_) { /* keep UI responsive */ }
    }

    // Clear any in-memory graduation guard for this scholar; `gradExempt` keeps
    // the auto-graduation effect from re-archiving them after restore.
    graduatedSweepRef.current.delete(userId);
    if (historyEntry.scholarId) graduatedSweepRef.current.delete(historyEntry.scholarId);

    logAudit({
      action: 'RESTORE',
      collection: 'users',
      documentId: userId,
      details: `Restored scholar ${historyEntry.fullName || ''} from Scholar History (was ${historyEntry.status || 'archived'})`,
    });
  };

  const deleteApplicant = (id) => {
    const target = applicants.find(a => a.id === id);
    if (target) {
      logAudit({
        action: 'DELETE',
        collection: 'users',
        documentId: target.firestoreId || target.scholarId || String(target.id),
        details: `Removed record for ${target.name || 'applicant'}`,
      });
    }
    if (target?.firestoreId) {
      const { db, isReady } = initializeFirebase();
      if (isReady && db) {
        // Mark as removed in Firestore (don't hard-delete the user's account).
        setDoc(
          doc(db, 'users', target.firestoreId),
          { adminStatus: 'removed', applicationStatus: 'rejected' },
          { merge: true }
        ).catch(() => {});
      }
    }
    setApplicants(applicants.filter(a => a.id !== id));
  };

  const bulkDeleteApplicants = (ids) => {
    setApplicants(applicants.filter(a => !ids.includes(a.id)));
  };

  const bulkImportApplicants = (newApplicants) => {
    const maxId = Math.max(0, ...applicants.map(a => a.id));
    const importedApplicants = newApplicants.map((a, index) =>
      normalizeApplicantFinancialFields({
        ...a,
        id: maxId + index + 1,
        createdAt: new Date().toISOString().split('T')[0],
        status: 'pending',
        ranking: null,
        attendance: [],
        grades: [],
      }, catalogProgramsRef.current)
    );
    setApplicants([...applicants, ...importedApplicants]);
  };

  // Imports legacy scholar records (the client's pre-system Excel) into Scholar
  // History. Each row becomes an archived `users` doc (archiveType: 'scholar'),
  // so the existing users listener surfaces it on the Scholar History page with
  // no new collection or security-rule changes. Dedupes by Scholar ID against
  // both active scholars and existing history. Returns an import summary.
  const importLegacyScholars = async (rows) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) {
      return { imported: 0, skipped: 0, invalid: 0, total: rows.length, offline: true };
    }

    // Case-insensitive column lookup so minor header variations still map.
    const pick = (row, ...keys) => {
      for (const k of keys) {
        const hit = Object.keys(row).find(
          (rk) => rk.trim().toLowerCase() === k.toLowerCase()
        );
        if (hit && row[hit] != null && String(row[hit]).trim() !== '') {
          return String(row[hit]).trim();
        }
      }
      return '';
    };

    // Best-effort split of a single "Full Name" cell into parts so the History
    // page (which rebuilds the name from first/middle/last) displays correctly.
    // Trailing token(s) are the surname, extended backwards over connector
    // particles so compound surnames (Dela Cruz, De Los Santos) stay intact.
    const splitName = (full) => {
      const s = String(full).trim();
      if (s.includes(',')) {
        const [last, rest = ''] = s.split(',');
        const parts = rest.trim().split(/\s+/).filter(Boolean);
        return { firstName: parts[0] || '', middleName: parts.slice(1).join(' '), lastName: last.trim() };
      }
      const parts = s.split(/\s+/).filter(Boolean);
      if (parts.length <= 1) return { firstName: parts[0] || '', middleName: '', lastName: '' };
      let i = parts.length - 1;
      while (i - 1 >= 1 && SURNAME_PARTICLES.has(parts[i - 1].toLowerCase())) i--;
      return {
        firstName: parts[0],
        middleName: parts.slice(1, i).join(' '),
        lastName: parts.slice(i).join(' '),
      };
    };

    const existingIds = new Set(
      [
        ...applicantsRef.current.map((a) => a.scholarId),
        ...scholarHistory.map((h) => h.scholarId),
      ]
        .filter(Boolean)
        .map((id) => String(id).trim())
    );

    let imported = 0;
    let skipped = 0;
    let invalid = 0;
    let legacyCounter = 0;
    const docsToWrite = [];

    for (const row of rows) {
      const fullName = pick(row, 'Full Name', 'Name', 'Scholar Name');
      if (!fullName) { invalid++; continue; }

      let scholarId = pick(row, 'Scholar ID', 'ScholarID', 'ID');
      if (scholarId && existingIds.has(scholarId)) { skipped++; continue; }
      // Rows with no Scholar ID get a stable, unique LEGACY-#### id so they
      // never collide with each other or with generated system ids.
      if (!scholarId) scholarId = `LEGACY-${String(++legacyCounter).padStart(4, '0')}`;
      if (existingIds.has(scholarId)) { skipped++; continue; }

      const status = pick(row, 'Status').toLowerCase().startsWith('term')
        ? 'terminated'
        : 'graduated';
      const { firstName, middleName, lastName } = splitName(fullName);

      const record = {
        name: fullName,
        firstName,
        middleName,
        lastName,
        scholarId,
        school: pick(row, 'School', 'HEI', 'School Name'),
        program: pick(row, 'Course', 'Program', 'Academic Program'),
        schoolYear: pick(row, 'School Year', 'Academic Year', 'SY'),
        yearAwarded: pick(row, 'Scholarship Start', 'Start', 'Year Awarded', 'Start Date') || null,
        status,
      };

      docsToWrite.push({
        ...buildUserDocFromApplicant(record),
        studentType: 'scholar',
        archived: true,
        archiveType: 'scholar',
        archiveReason: status,
        archivedDate: todayISO(),
        scholarshipEndDate: pick(row, 'Scholarship End', 'End', 'End Date'),
        source: 'legacyImport',
        legacyImport: true,
        createdAt: todayISO(),
      });
      existingIds.add(scholarId);
      imported++;
    }

    // Commit in chunks (Firestore caps a batch at 500 writes).
    let batch = writeBatch(db);
    let ops = 0;
    for (const data of docsToWrite) {
      batch.set(doc(collection(db, 'users')), data);
      if (++ops >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    if (imported > 0) {
      logAudit({
        action: 'IMPORT',
        collection: 'users',
        documentId: 'legacy-scholar-import',
        details: `Imported ${imported} legacy scholar record(s) into Scholar History`,
      });
    }

    return { imported, skipped, invalid, total: rows.length };
  };

  // Re-pushes the full data (names included) for records that already live in
  // Firestore, so other browsers/devices see the latest. MERGE-ONLY: it never
  // creates new documents — records reach Firestore when they're first added
  // (addApplicant) — which keeps this safe to run repeatedly with no duplicates.
  const syncAllToFirestore = async () => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) {
      return { synced: 0, failed: 0, total: applicantsRef.current.length, offline: true };
    }

    const list = applicantsRef.current.filter((a) => a.firestoreId);
    let synced = 0;
    let failed = 0;

    for (const a of list) {
      try {
        await setDoc(doc(db, 'users', a.firestoreId), buildUserDocFromApplicant(a), { merge: true });
        synced += 1;
      } catch (_) {
        failed += 1;
      }
    }

    return { synced, failed, total: list.length };
  };

  // One-time cleanup for blank/duplicate scholar & applicant records (e.g. junk
  // left by an earlier bad sync). Marks every nameless scholar/applicant doc as
  // removed so it disappears from the lists; real (named) records and staff/admin
  // accounts are left untouched. Delete isn't permitted for the anonymous session,
  // so "removed" is the soft-delete the listener already filters out.
  const cleanupBlankRecords = async () => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return { removed: 0, offline: true };

    const snap = await getDocs(collection(db, 'users'));
    let removed = 0;
    let batch = writeBatch(db);
    let ops = 0;

    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      if (['admin', 'staff', 'viewer', 'super_admin'].includes(d.role)) continue;
      if (d.adminStatus === 'removed') continue;
      const hasName =
        (d.firstName && String(d.firstName).trim()) ||
        (d.lastName && String(d.lastName).trim()) ||
        (d.displayName && String(d.displayName).trim());
      if (hasName) continue;

      batch.update(docSnap.ref, { adminStatus: 'removed', applicationStatus: 'rejected' });
      ops += 1;
      removed += 1;
      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    // Drop blank rows from local state too (covers local-only junk and gives
    // instant feedback; localStorage is rewritten without them).
    setApplicants((prev) =>
      prev.filter((a) => {
        const hasName =
          (a.name && String(a.name).trim()) ||
          (a.firstName && String(a.firstName).trim()) ||
          (a.lastName && String(a.lastName).trim());
        return hasName;
      })
    );

    return { removed, total: snap.size };
  };

  // Calculate ranking score - based on exam score only
  const calculateCombinedScore = (applicant) => {
    // Ranking is based on exam score only (100%)
    return applicant.examScore || 0;
  };

  // Generate rankings
  const generateRankings = (filters = {}) => {
    let filtered = applicants.filter(a => {
      // Only include applicants with complete requirements and exam scores
      const hasRequiredDocs = Object.values(a.requirements || {}).every(v => v);
      const hasExamScore = a.examScore !== null && a.examScore !== undefined;
      if (!hasRequiredDocs || !hasExamScore) return false;
      
      if (filters.school && a.school !== filters.school) return false;
      if (filters.gender && a.gender !== filters.gender) return false;
      if (a.city !== 'Calapan') return false;
      
      return true;
    });

    const ranked = filtered
      .map(a => ({ ...a, combinedScore: calculateCombinedScore(a) }))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .map((a, index) => ({ ...a, suggestedRanking: index + 1 }));

    return ranked;
  };

  // School CRUD
  const addSchool = (school) => {
    const newSchool = {
      ...school,
      id: Math.max(0, ...schools.map(s => s.id)) + 1,
    };
    setSchools([...schools, newSchool]);
  };

  const updateSchool = (id, updates) => {
    setSchools(schools.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSchool = (id) => {
    setSchools(schools.filter(s => s.id !== id));
  };

  // Eligible schools/programs catalog CRUD — backed by Firestore so an edit in
  // one browser reaches every device and the scholar app. `col` is 'schools' or
  // 'programs'. The next `order` keeps new entries appended.
  const addCatalogItem = async (col, data) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const list = col === 'schools' ? catalogSchools : catalogPrograms;
    const nextOrder = list.reduce((m, x) => Math.max(m, x.order ?? 0), -1) + 1;
    const { id, ...fields } = data;
    void id;
    const payload = { ...fields, order: nextOrder, active: data.active !== false };
    if (data.tuitionCap != null) payload.tuitionCap = Number(data.tuitionCap) || 0;
    await addDoc(collection(db, col), payload);
  };

  const updateCatalogItem = async (col, id, data) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !id) return;
    const { id: _omit, ...fields } = data;
    void _omit;
    const payload = { ...fields };
    if (data.tuitionCap != null) payload.tuitionCap = Number(data.tuitionCap) || 0;
    await setDoc(doc(db, col, id), payload, { merge: true });
  };

  const deleteCatalogItem = async (col, id) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !id) return;
    await deleteDoc(doc(db, col, id));
  };

  // Replaces the entire catalog with the official defaults (used by "Reset to
  // Defaults"). Writes straight to Firestore so every reader updates.
  const resetCatalogToDefaults = async () => {
    await syncCatalogToFirestore(DEFAULT_SCHOOLS, DEFAULT_PROGRAMS);
  };

  // School Year / Semester CRUD — backed by Firestore `school_years` so the
  // active term and "Set Active" archiving stay consistent across every open
  // tab/device instead of living in one browser's localStorage.
  const makeSubId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const addSchoolYear = async ({ startYear, endYear, semesters = [] }) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const now = new Date().toISOString();
    await addDoc(collection(db, 'school_years'), {
      startYear,
      endYear,
      label: `${startYear}-${endYear}`,
      isActive: !schoolYearsRef.current.some(s => s.isActive),
      createdAt: now,
      semesters: semesters.map((sem, i) => ({
        id: makeSubId(),
        name: sem.name,
        order: sem.order,
        isActive: i === 0,
        createdAt: now,
      })),
    });
  };

  const updateSchoolYear = async (id, { startYear, endYear }) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    await updateDoc(doc(db, 'school_years', id), {
      startYear,
      endYear,
      label: `${startYear}-${endYear}`,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteSchoolYear = async (id) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    await deleteDoc(doc(db, 'school_years', id));
  };

  const setActiveSchoolYear = async (id) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const batch = writeBatch(db);
    schoolYearsRef.current.forEach(sy => {
      batch.update(doc(db, 'school_years', sy.id), { isActive: sy.id === id });
    });
    await batch.commit();
  };

  const addSemester = async (yearId, { name, order }) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const year = schoolYearsRef.current.find(s => s.id === yearId);
    if (!year) return;
    const sem = {
      id: makeSubId(), name, order,
      isActive: (year.semesters || []).length === 0,
      createdAt: new Date().toISOString(),
    };
    await updateDoc(doc(db, 'school_years', yearId), { semesters: [...(year.semesters || []), sem] });
  };

  const updateSemester = async (yearId, semId, { name, order }) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const year = schoolYearsRef.current.find(s => s.id === yearId);
    if (!year) return;
    const semesters = (year.semesters || []).map(sem =>
      sem.id === semId ? { ...sem, name, order, updatedAt: new Date().toISOString() } : sem
    );
    await updateDoc(doc(db, 'school_years', yearId), { semesters });
  };

  const deleteSemester = async (yearId, semId) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const year = schoolYearsRef.current.find(s => s.id === yearId);
    if (!year) return;
    const semesters = (year.semesters || []).filter(sem => sem.id !== semId);
    await updateDoc(doc(db, 'school_years', yearId), { semesters });
  };

  const setActiveSemester = async (yearId, semId) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    const year = schoolYearsRef.current.find(s => s.id === yearId);
    if (!year) return;
    const semesters = (year.semesters || []).map(sem => ({ ...sem, isActive: sem.id === semId }));
    await updateDoc(doc(db, 'school_years', yearId), { semesters });
  };

  // Stats calculation
  const getStats = () => {
    const total = applicants.length;
    const active = applicants.filter(a => a.status === 'active' || a.status === 'approved').length;
    const terminated = applicants.filter(a => a.status === 'terminated').length;
    const graduated = applicants.filter(a => a.status === 'graduated').length;
    const pending = applicants.filter(a => a.status === 'pending').length;
    const approved = applicants.filter(a => a.status === 'approved').length;
    const interviewed = applicants.filter(a => a.interviewStatus === 'completed').length;
    const maleCount = applicants.filter(a => a.gender === 'Male').length;
    const femaleCount = applicants.filter(a => a.gender === 'Female').length;

    // School names: the eligible-schools catalog (managed in System Settings,
    // Firestore-backed) PLUS any school name that actually appears on a
    // scholar record. Scholar records store the full catalog name (e.g.
    // "Luna Goco Colleges, Inc."), not the old hardcoded short names ("Luna
    // Colleges") that used to live here — using those meant "Scholars per
    // HEI" always counted zero. Mirrors the same fix already applied to the
    // Applications/Attendance/Reports/Scholars pages.
    const schoolNames = Array.from(new Set([
      ...(catalogSchools || []).map(s => s?.name).filter(Boolean),
      ...applicants.map(a => a?.school).filter(Boolean),
    ])).sort((a, b) => a.localeCompare(b));

    // "Scholars per HEI" — pending applicants aren't scholars yet (they still
    // need a decision), so they're excluded here even though they're still in
    // `applicants`. Everyone else (approved/active/on-hold/terminated/graduated)
    // counts, same as the rest of this function's status buckets above.
    const bySchool = schoolNames.map(name => ({
      name,
      count: applicants.filter(a => matchesExact(a.school, name) && a.status !== 'pending').length,
    }));

    const totalGranted = applicants.reduce((sum, a) => sum + (a.amountGranted || 0), 0);

    return {
      total,
      active,
      terminated,
      graduated,
      pending,
      approved,
      interviewed,
      maleCount,
      femaleCount,
      bySchool,
      totalGranted,
    };
  };

  // Check termination conditions
  const checkTerminationStatus = (applicant) => {
    const reasons = [];
    
    // Check if failed (GWA > 3.0 is failing)
    if (applicant.gwa && applicant.gwa > 3.0) {
      reasons.push('Failed academic requirements (GWA > 3.0)');
    }

    // Check semester limit (8 semesters = 4 years)
    const semMax = systemSettings.numberOfSemesters || 8;
    if (applicant.semestersUsed >= semMax) {
      reasons.push(`Exceeded maximum scholarship duration (${semMax} semesters)`);
    }

    // Check attendance (more than 2 absences). Counted only against events that
    // still exist — a deleted event's records linger on the scholar document,
    // and counting those could recommend terminating someone for absences from
    // events the admin has since removed.
    if (!applicant.isStAugustine) {
      const scheduledNames = new Set(events.map((e) => e.name));
      const absences = (applicant.attendance || []).filter(
        (a) => !a.present && scheduledNames.has(a.activity)
      ).length;
      if (absences > 2) {
        reasons.push(`Excessive absences (${absences} absences)`);
      }
    }

    return {
      shouldTerminate: reasons.length > 0,
      reasons,
    };
  };

  const value = {
    applicants,
    setApplicants,
    addApplicant,
    updateApplicant,
    deleteApplicant,
    bulkDeleteApplicants,
    bulkImportApplicants,
    importLegacyScholars,
    syncAllToFirestore,
    cleanupBlankRecords,
    applicantHistory,
    scholarHistory,
    archiveApplicant,
    archiveScholar,
    endOfSemesterScholarsCleanup,
    enrollActiveScholarsInSemester,
    verifyScholarEnrollment,
    setGradesEvaluation,
    restoreFromHistory,
    restoreScholarFromHistory,
    generateRankings,
    calculateCombinedScore,
    generateScholarId,
    schools,
    addSchool,
    updateSchool,
    deleteSchool,
    schoolYears,
    addSchoolYear,
    updateSchoolYear,
    deleteSchoolYear,
    setActiveSchoolYear,
    addSemester,
    updateSemester,
    deleteSemester,
    setActiveSemester,
    catalogSchools,
    catalogPrograms,
    addCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    resetCatalogToDefaults,
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    announcements,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    messages,
    sendDirectMessage,
    groupChats,
    createGroupChat,
    sendGroupMessage,
    addGroupMembers,
    deleteGroupChat,
    sidebarCollapsed,
    setSidebarCollapsed,
    getStats,
    checkTerminationStatus,
    theme,
    toggleTheme,
    systemSettings,
    updateSystemSettings,
    resetSystemSettings,
    idCardTemplate,
    saveIdCardTemplate,
    deactivateIdCardTemplate,
    evaluationRubric,
    updateEvaluationRubric,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
