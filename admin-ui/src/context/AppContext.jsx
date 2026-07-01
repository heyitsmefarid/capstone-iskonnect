import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, updateDoc, arrayUnion, getDocs, writeBatch } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { initializeFirebase } from '../services/firebase';
import { logAudit } from '../services/auditLog';
import { DEFAULT_SCHOOLS, DEFAULT_PROGRAMS } from '../services/localSettingsStore';
import { syncCatalogToFirestore } from '../services/seedFirestoreCatalog';

const AppContext = createContext();
const SCHOLARSHIP_CAP = 25000;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const computeReflectedAmount = (tuitionFee) => {
  const normalizedTuition = Math.max(0, toNumber(tuitionFee));
  return Math.min(normalizedTuition, SCHOLARSHIP_CAP);
};

const normalizeApplicantFinancialFields = (applicant) => {
  const tuitionFee = Math.max(0, toNumber(applicant?.tuitionFee));
  return {
    ...applicant,
    tuitionFee,
    amountGranted: computeReflectedAmount(tuitionFee),
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
    ranking: student.ranking ?? null,
    attendance: Array.isArray(student.attendance) ? student.attendance : [],
    grades: Array.isArray(student.grades) ? student.grades : [],
    certificatesOfEnrollment: Array.isArray(student.certificatesOfEnrollment) ? student.certificatesOfEnrollment : [],
    // Semesters the scholar has been enrolled into as the admin advanced the
    // active term. Drives Semester Records and Granted-per-Semester.
    enrolledSemesters: Array.isArray(student.enrolledSemesters) ? student.enrolledSemesters : [],
    requirements: mapRequirements(student),
    examScore: student.examScore ?? null,
    interviewStatus: student.interviewStatus ?? null,
    gwa: student.gwa ?? null,
    semestersUsed: student.semestersUsed ?? 0,
    disbursementStatus: student.disbursementStatus ?? null,
    tuitionFee: student.tuitionFee ?? 0,
    amountGranted: student.amountGranted ?? 0,
    yearAwarded: student.yearAwarded ?? new Date().getFullYear(),
    // Set when an admin restores a scholar from history — exempts them from the
    // 8-semester auto-graduation so a restored graduate stays active.
    gradExempt: student.gradExempt === true,
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
    interviewStatus: applicant.interviewStatus ?? null,
    ranking: applicant.ranking ?? null,
    gwa: applicant.gwa ?? null,
    semestersUsed: applicant.semestersUsed ?? 0,
    // The scholar app reads `semestersCompleted` for its "x/8 sem" badge, so
    // keep it in lockstep with the admin's semestersUsed.
    semestersCompleted: applicant.semestersUsed ?? 0,
    disbursementStatus: applicant.disbursementStatus ?? null,
    tuitionFee: applicant.tuitionFee ?? 0,
    amountGranted: applicant.amountGranted ?? 0,
    yearAwarded: applicant.yearAwarded ?? null,
    yearLevel: applicant.yearLevel ?? 1,
    semester: applicant.semester ?? '1st Semester',
    attendance: Array.isArray(applicant.attendance) ? applicant.attendance : [],
    grades: Array.isArray(applicant.grades) ? applicant.grades : [],
    enrolledSemesters: Array.isArray(applicant.enrolledSemesters) ? applicant.enrolledSemesters : [],
    gradExempt: applicant.gradExempt ?? false,
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
// Statuses that move a record out of the active lists and into the History
// module. Rejected applicants go to Applicant History; graduated/terminated
// scholars go to Scholar History.
const ARCHIVE_STATUSES = ['rejected', 'graduated', 'terminated'];

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

// No seeded sample activities — real activities come from admin-created events
// and QR-scanned attendance records.
const initialActivities = [];

const SYSTEM_SETTINGS_STORAGE_KEY = 'ced-system-settings';
const defaultSystemSettings = {
  organizationName: 'City Education Department',
  contactEmail: 'ced@calapancity.gov.ph',
  defaultAcademicYear: '2026-2027',
  defaultSemester: '1st Semester',
  tuitionFeeDefault: 25000,
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
  const [activities, setActivities] = useState(initialActivities);
  const [announcements, setAnnouncements] = useState([]);
  const [systemSettings, setSystemSettings] = useState(parseSystemSettings);

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
    await addDoc(collection(db, 'announcements'), {
      title: data.title,
      message: data.message,
      target: data.target,
      isImportant: !!data.isImportant,
      author: 'Admin',
      date: new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
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
      },
      { merge: true }
    );
  };

  const deleteAnnouncement = async (firestoreId) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !firestoreId) return;
    await deleteDoc(doc(db, 'announcements', firestoreId));
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

  const sendGroupMessage = async (groupFirestoreId, text) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !groupFirestoreId || !text) return;
    await updateDoc(doc(db, 'group_chats', groupFirestoreId), {
      messages: arrayUnion({
        id: Date.now(),
        sender: 'Admin',
        senderId: 'admin',
        text,
        timestamp: new Date().toISOString(),
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

  // Publish the active academic year + semester so the scholar app can
  // auto-assign grades/COR to the current period.
  useEffect(() => {
    if (!authReady) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    setDoc(
      doc(db, 'system_config', 'academic'),
      {
        activeSchoolYear: systemSettings.defaultAcademicYear,
        activeSemester: systemSettings.defaultSemester,
      },
      { merge: true }
    ).catch(() => {});
  }, [authReady, systemSettings.defaultAcademicYear, systemSettings.defaultSemester]);

  // Sends a message from the admin to a student (the scholar app reads it).
  const sendDirectMessage = async (toUserId, body, subject = 'Message from CED') => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !toUserId || !body) return;
    await addDoc(collection(db, 'messages'), {
      fromUserId: 'admin',
      toUserId,
      subject,
      body,
      createdAt: new Date().toISOString(),
      readBy: ['admin'],
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
            // Staff/admin accounts live in this same collection — exclude them
            // so they never leak into the Scholars/Applications lists.
            if (d.role === 'admin' || d.role === 'staff' || d.role === 'super_admin') return;
            const type = d.studentType;
            if (type && type !== 'applicant' && type !== 'scholar') return;
            if (d.adminStatus === 'removed') return;
            // Archived records live in the History module — keep them out of the
            // active Applicants/Scholars lists so those pages stay clean, and
            // build the History lists straight from the (already-readable) user
            // docs so History works without a separate collection/rules deploy.
            if (d.archived === true) {
              const record = normalizeApplicantFinancialFields(
                mapStudentToApplicant({ ...d, id: docSnap.id })
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
            fromFirestore.push(normalizeApplicantFinancialFields(mapStudentToApplicant({ ...d, id: docSnap.id })));
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
      return toNumber(a?.amountGranted) !== computeReflectedAmount(normalizedTuition);
    });

    if (needsMigration || needsFinancialSync) {
      const migratedApplicants = applicants.map(applicant => {
        const wasBlank = !applicant.schoolYear;
        const migrated = {
          ...normalizeApplicantFinancialFields(applicant),
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

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const updateSystemSettings = (updates) => {
    setSystemSettings(prev => ({
      ...prev,
      ...updates,
    }));
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
    });

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

      const updated = normalizeApplicantFinancialFields({ ...a, ...updates });
      edited = updated;

      // Auto-archive on a transition into an archive status (rejected →
      // Applicant History; graduated/terminated → Scholar History). The record
      // is dropped from the active list instead of staying behind.
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

  // Advances the active term: enrolls every active scholar into (schoolYear,
  // semester). Adds the term to the scholar's record (idempotently, so toggling
  // the active term back and forth never double-counts), bumps Semesters Used
  // (capped at 8), and persists to Firestore so Semester Records and Total
  // Granted update. Returns how many scholars were enrolled.
  const enrollActiveScholarsInSemester = (schoolYear, semester) => {
    if (!schoolYear || !semester) return { enrolled: 0 };
    let count = 0;
    const updated = applicantsRef.current.map((a) => {
      const isActiveScholar = a.status === 'approved' || a.status === 'active';
      if (!isActiveScholar) return a;

      const existing = Array.isArray(a.enrolledSemesters) ? a.enrolledSemesters : [];
      const already = existing.some((e) => e.schoolYear === schoolYear && e.semester === semester);
      if (already || existing.length >= 8) return a;

      // The grant released for this term (program cap when not set explicitly).
      const perSemGrant = resolvePerSemGrant(a, catalogProgramsRef.current);
      const nextSemesters = [
        ...existing,
        { schoolYear, semester, grantedAmount: perSemGrant, status: 'disbursed', enrolledAt: todayISO() },
      ];
      const next = {
        ...a,
        enrolledSemesters: nextSemesters,
        semestersUsed: Math.min(8, (a.semestersUsed || 0) + 1),
        // Persist the resolved per-sem grant so the scholar app can total it.
        amountGranted: perSemGrant,
      };
      count += 1;
      syncApplicantToFirestore(next);
      return next;
    });

    if (count > 0) {
      setApplicants(updated);
      logAudit({
        action: 'UPDATE',
        collection: 'users',
        documentId: 'multiple',
        details: `Enrolled ${count} active scholar(s) into ${semester} (${schoolYear})`,
      });
    }
    // Scholars who now reach 8 completed semesters are graduated by the
    // auto-graduation effect below (single source of truth for graduation).
    return { enrolled: count };
  };

  // Auto-graduation: the scholarship covers a maximum of 8 semesters (4 years).
  // Any active scholar who has completed all 8 is moved to Scholar History as
  // Graduated — no matter how they reached 8 (term enrollment, a manual edit,
  // or imported/seeded data). A processed-id guard avoids archiving the same
  // scholar twice while the Firestore listener catches up.
  const graduatedSweepRef = useRef(new Set());
  useEffect(() => {
    const keyOf = (a) => a.firestoreId || a.scholarId || String(a.id);
    const completed = applicants.filter(
      (a) =>
        (a.status === 'active' || a.status === 'approved') &&
        (a.semestersUsed || 0) >= 8 &&
        a.gradExempt !== true &&
        !graduatedSweepRef.current.has(keyOf(a))
    );
    if (completed.length === 0) return;
    completed.forEach((a) => graduatedSweepRef.current.add(keyOf(a)));
    const completedKeys = new Set(completed.map(keyOf));
    setApplicants((prev) => prev.filter((a) => !completedKeys.has(keyOf(a))));
    completed.forEach((a) => writeRecordToHistory({ ...a, status: 'graduated' }));
  }, [applicants]);

  // Manually archive a scholar to Scholar History (Graduated / Terminated).
  const archiveScholar = (id, status = 'graduated') => {
    const target = applicants.find((a) => a.id === id);
    if (!target) return;
    const nextStatus = status === 'graduated' ? 'graduated' : 'terminated';
    setApplicants((prev) => prev.filter((a) => a.id !== id));
    writeRecordToHistory({ ...target, status: nextStatus });
  };

  // Restore an applicant from Applicant History back into the active list.
  const restoreFromHistory = async (historyEntry) => {
    if (!historyEntry) return;
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;

    // Reactivate the source user doc (clear the archived flag, reset to pending).
    if (historyEntry.applicantId) {
      try {
        await setDoc(
          doc(db, 'users', historyEntry.applicantId),
          { archived: false, archivedDate: null, applicationStatus: 'pending', adminStatus: 'pending' },
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
      })
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
      if (d.role === 'admin' || d.role === 'staff' || d.role === 'super_admin') continue;
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

  // Activity CRUD
  const addActivity = (activity) => {
    const newActivity = {
      ...activity,
      id: Math.max(0, ...activities.map(a => a.id)) + 1,
    };
    setActivities([...activities, newActivity]);
  };

  const updateActivity = (id, updates) => {
    setActivities(activities.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteActivity = (id) => {
    setActivities(activities.filter(a => a.id !== id));
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

    const bySchool = schools.map(school => ({
      name: school.name,
      count: applicants.filter(a => a.school === school.name).length,
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
    if (applicant.semestersUsed >= 8) {
      reasons.push('Exceeded maximum scholarship duration (8 semesters)');
    }

    // Check attendance (more than 2 absences)
    if (!applicant.isStAugustine) {
      const absences = (applicant.attendance || []).filter(a => !a.present).length;
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
    enrollActiveScholarsInSemester,
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
    activities,
    addActivity,
    updateActivity,
    deleteActivity,
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
