/* eslint-disable no-console */
const admin = require('firebase-admin');

const DEFAULT_PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-capstone';
const DEFAULT_FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const args = new Set(process.argv.slice(2));
const shouldReset = args.has('--reset');
const isDryRun = args.has('--dry-run');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = DEFAULT_FIRESTORE_HOST;
}
if (!process.env.GCLOUD_PROJECT) {
  process.env.GCLOUD_PROJECT = DEFAULT_PROJECT_ID;
}
if (!process.env.GOOGLE_CLOUD_PROJECT) {
  process.env.GOOGLE_CLOUD_PROJECT = DEFAULT_PROJECT_ID;
}

const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (!usingEmulator) {
  console.error('Refusing to seed: FIRESTORE_EMULATOR_HOST is not set.');
  process.exit(1);
}

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!firestoreHost.includes('127.0.0.1') && !firestoreHost.includes('localhost')) {
  console.error(`Refusing to seed non-local Firestore host: ${firestoreHost}`);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: DEFAULT_PROJECT_ID });
}

const db = admin.firestore();

const now = new Date().toISOString();

const users = [
  {
    id: 'admin_1',
    firstName: 'CED',
    middleName: '',
    lastName: 'Administrator',
    suffix: '',
    email: 'admin@test.com',
    password: 'admin123',
    contactNumber: '09170000001',
    dateOfBirth: '1990-01-01T00:00:00.000Z',
    gender: 'Female',
    houseNo: '1',
    street: 'City Hall',
    barangay: 'Poblacion',
    city: 'Calapan City',
    province: 'Oriental Mindoro',
    schoolName: 'City Education Department',
    academicProgram: 'Administration',
    yearLevel: 'N/A',
    academicYear: '2025-2026',
    semester: '1st Semester',
    scholarshipStatus: 'N/A',
    semestersCompleted: 0,
    studentType: 'admin',
    role: 'admin',
    applicationStatus: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'scholar-student-001',
    firstName: 'Maria',
    middleName: 'Santos',
    lastName: 'Dela Cruz',
    suffix: '',
    email: 'scholar@test.com',
    password: 'scholar123',
    contactNumber: '09171234567',
    dateOfBirth: '2001-03-15T00:00:00.000Z',
    gender: 'Female',
    houseNo: '456',
    street: 'Rizal Avenue',
    barangay: 'Poblacion',
    city: 'Calapan City',
    province: 'Oriental Mindoro',
    schoolName: 'Divine Word College Of Calapan',
    academicProgram: 'Bachelor of Science in Computer Science',
    yearLevel: '3rd Year',
    academicYear: '2025-2026',
    semester: '1st Semester',
    scholarshipStatus: 'Active',
    semestersCompleted: 4,
    studentType: 'scholar',
    role: 'scholar',
    applicationStatus: 'approved',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'applicant-student-001',
    firstName: 'Juan',
    middleName: 'Dela',
    lastName: 'Cruz',
    suffix: '',
    email: 'juan@test.com',
    password: '12345678',
    contactNumber: '09123456789',
    dateOfBirth: '2000-01-15T00:00:00.000Z',
    gender: 'Male',
    houseNo: '123',
    street: 'Bonifacio Street',
    barangay: 'Poblacion',
    city: 'Calapan City',
    province: 'Oriental Mindoro',
    schoolName: 'Divine Word College Of Calapan',
    academicProgram: 'Bachelor of Science in Information Technology',
    yearLevel: '3rd Year',
    academicYear: '2025-2026',
    semester: '1st Semester',
    scholarshipStatus: 'Pending',
    semestersCompleted: 0,
    studentType: 'applicant',
    role: 'applicant',
    applicationStatus: 'under_review',
    createdAt: now,
    updatedAt: now,
  },
];

const applications = [
  {
    id: 'APP-2026-0001',
    userId: 'applicant-student-001',
    status: 'under_review',
    createdBy: 'applicant-student-001',
    createdAt: now,
    updatedAt: now,
    schoolName: 'Divine Word College Of Calapan',
    academicProgram: 'Bachelor of Science in Information Technology',
    academicYear: '2025-2026',
    semester: '1st Semester',
  },
];

const applicationRequirements = [
  {
    id: 'application_form',
    applicationId: 'APP-2026-0001',
    userId: 'applicant-student-001',
    requirementType: 'applicationForm',
    fileName: 'Application_Form.pdf',
    fileType: 'application/pdf',
    fileUrl: 'https://example.invalid/files/application_form.pdf',
    status: 'submitted',
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'birth_certificate',
    applicationId: 'APP-2026-0001',
    userId: 'applicant-student-001',
    requirementType: 'birthCertificate',
    fileName: 'Birth_Certificate.pdf',
    fileType: 'application/pdf',
    fileUrl: 'https://example.invalid/files/birth_certificate.pdf',
    status: 'under_review',
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  },
];

const scholarships = [
  {
    id: 'SCH-0001',
    userId: 'scholar-student-001',
    status: 'active_scholar',
    createdAt: now,
    updatedAt: now,
  },
];

const attendanceLogs = [
  {
    id: 'ATT-0001',
    userId: 'scholar-student-001',
    eventName: 'Scholarship Orientation',
    status: 'present',
    attendedAt: now,
    createdAt: now,
  },
  {
    id: 'ATT-0002',
    userId: 'scholar-student-001',
    eventName: 'General Assembly',
    status: 'present',
    attendedAt: now,
    createdAt: now,
  },
];

const academicRecords = [
  {
    id: 'ACAD-0001',
    userId: 'scholar-student-001',
    semester: '1st Semester',
    academicYear: '2025-2026',
    status: 'disbursed',
    amountGranted: 17500,
    amount: 17500,
    disbursedDate: now,
    grades: [
      {
        id: 'IT501',
        subjectName: 'Capstone Project 1',
        subjectCode: 'IT501',
        units: 3,
        grade: 1.75,
      },
      {
        id: 'IT502',
        subjectName: 'Information Assurance and Security',
        subjectCode: 'IT502',
        units: 3,
        grade: 1.5,
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
];

const announcements = [
  {
    id: 'ANN-0001',
    title: 'Scholarship Renewal Open',
    description: 'Renewal period is now open for all active scholars.',
    date: now,
    isImportant: true,
    visibility: 'scholarsOnly',
    createdAt: now,
  },
  {
    id: 'ANN-0002',
    title: 'Interview Schedule Released',
    description: 'Applicants can now check interview schedules in the portal.',
    date: now,
    isImportant: true,
    visibility: 'applicantsOnly',
    createdAt: now,
  },
];

const messages = [
  {
    id: 'MSG-0001',
    fromUserId: 'applicant-student-001',
    toUserId: 'admin_1',
    subject: 'Application Follow-up',
    body: 'Good day, may I ask for an update on my scholarship application?',
    status: 'sent',
    createdAt: now,
    readBy: ['applicant-student-001'],
  },
  {
    id: 'MSG-0002',
    fromUserId: 'admin_1',
    toUserId: 'applicant-student-001',
    subject: 'Re: Application Follow-up',
    body: 'Your requirements are under review. Please wait for final evaluation.',
    status: 'seen',
    createdAt: now,
    readBy: ['admin_1', 'applicant-student-001'],
  },
];

const timelineEntries = [
  {
    id: 'TLINE-0001',
    applicationId: 'APP-2026-0001',
    userId: 'applicant-student-001',
    stage: 'application',
    action: 'submitted',
    fromStatus: 'draft',
    toStatus: 'submitted',
    createdBy: 'applicant-student-001',
    createdAt: now,
  },
  {
    id: 'TLINE-0002',
    applicationId: 'APP-2026-0001',
    userId: 'applicant-student-001',
    stage: 'requirements',
    action: 'reviewed',
    fromStatus: 'submitted',
    toStatus: 'under_review',
    createdBy: 'admin_1',
    createdAt: now,
  },
];

const groupChats = [
  {
    id: 'applicants_ay_2026',
    name: 'Applicants A.Y. 2026',
    description: 'Group chat for scholarship applicants',
    createdBy: 'admin_1',
    isSchoolGroup: false,
    createdAt: now,
    members: [
      {
        id: 'admin_1',
        name: 'CED Admin',
        school: 'City Education Department',
        program: 'Administration',
        isAdmin: true,
        joinedAt: now,
      },
      {
        id: 'applicant-student-001',
        name: 'Juan Dela Cruz',
        school: 'Divine Word College Of Calapan',
        program: 'BS Information Technology',
        isAdmin: false,
        joinedAt: now,
      },
    ],
    messages: [
      {
        id: 'GMSG-0001',
        senderId: 'admin_1',
        senderName: 'CED Admin',
        content: 'Welcome applicants. Updates will be posted here.',
        timestamp: now,
        readBy: ['admin_1', 'applicant-student-001'],
        isSystemMessage: true,
      },
    ],
  },
];

const reportsCache = [
  {
    id: 'latest',
    applications: 1,
    activeScholars: 1,
    attendanceLogs: 2,
    announcements: 2,
    generatedAt: now,
    cachedAt: now,
  },
];

const collectionPlan = [
  { name: 'users', docs: users },
  { name: 'applications', docs: applications },
  { name: 'scholarships', docs: scholarships },
  { name: 'attendance_logs', docs: attendanceLogs },
  { name: 'academic_records', docs: academicRecords },
  { name: 'announcements', docs: announcements },
  { name: 'messages', docs: messages },
  { name: 'timeline_entries', docs: timelineEntries },
  { name: 'group_chats', docs: groupChats },
  { name: 'reports_cache', docs: reportsCache },
];

async function clearCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function clearApplicationRequirements() {
  const applicationsSnapshot = await db.collection('applications').get();
  for (const appDoc of applicationsSnapshot.docs) {
    const requirementsSnapshot = await appDoc.ref.collection('requirements').get();
    if (requirementsSnapshot.empty) continue;
    const batch = db.batch();
    requirementsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function seedCollection(name, docs) {
  for (const doc of docs) {
    if (!doc.id) {
      throw new Error(`Document in ${name} is missing id`);
    }
    await db.collection(name).doc(doc.id).set(doc, { merge: true });
  }
}

async function seedRequirementsSubcollection() {
  for (const item of applicationRequirements) {
    await db
      .collection('applications')
      .doc(item.applicationId)
      .collection('requirements')
      .doc(item.id)
      .set(item, { merge: true });
  }
}

async function main() {
  console.log(`Seeding Firestore emulator at ${firestoreHost}`);
  console.log(`Project: ${DEFAULT_PROJECT_ID}`);
  console.log(`Mode: ${isDryRun ? 'dry-run' : shouldReset ? 'reset+seed' : 'seed'}`);

  if (isDryRun) {
    console.log('Collections to seed:');
    collectionPlan.forEach((entry) => {
      console.log(`- ${entry.name}: ${entry.docs.length} docs`);
    });
    console.log(`- applications/{id}/requirements: ${applicationRequirements.length} docs`);
    return;
  }

  if (shouldReset) {
    await clearApplicationRequirements();
    for (const entry of collectionPlan) {
      await clearCollection(entry.name);
    }
    console.log('Reset complete.');
  }

  for (const entry of collectionPlan) {
    await seedCollection(entry.name, entry.docs);
  }
  await seedRequirementsSubcollection();

  console.log('Seed complete.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exit(1);
  });
