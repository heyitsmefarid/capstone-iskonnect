// Local-first settings store — persists to localStorage.
// When Firebase is connected, swap these calls to Firestore reads/writes.

const KEY = 'bfcsp_settings';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Config ──────────────────────────────────────────────────────────────────

export function getConfig() {
  return load().config || {};
}

export function setConfig(config) {
  const store = load();
  store.config = { ...store.config, ...config };
  save(store);
}

// ── Collections ─────────────────────────────────────────────────────────────

export function getCollection(col) {
  return load()[col] || [];
}

export function addItem(col, data) {
  const store = load();
  const items = store[col] || [];
  const item = { ...data, id: makeId(), active: data.active !== false, createdAt: new Date().toISOString() };
  store[col] = [...items, item];
  save(store);
  return item;
}

export function updateItem(col, id, data) {
  const store = load();
  store[col] = (store[col] || []).map(i => i.id === id ? { ...i, ...data, updatedAt: new Date().toISOString() } : i);
  save(store);
}

export function deleteItem(col, id) {
  const store = load();
  store[col] = (store[col] || []).filter(i => i.id !== id);
  save(store);
}

// ── Seed defaults (called once on first load) ────────────────────────────────

export const DEFAULT_SCHOOLS = [
  { name: 'Divine Word College of Calapan' },
  { name: 'Luna Goco Colleges, Inc.' },
  { name: 'Southwestern College of Maritime, Business, and Technology' },
  { name: 'St. Anthony College Calapan City, Inc.' },
  { name: 'ACLC College of Calapan' },
  { name: 'St. Mark Arts and Training Institute Inc.' },
  { name: 'St. Augustine Seminary' },
];

const DWCC = 'Divine Word College of Calapan';
const LGC  = 'Luna Goco Colleges, Inc.';
const SCMBT = 'Southwestern College of Maritime, Business, and Technology';
const SACC = 'St. Anthony College Calapan City, Inc.';
const ACLC = 'ACLC College of Calapan';
const SMATI = 'St. Mark Arts and Training Institute Inc.';
const SAS  = 'St. Augustine Seminary';

export const DEFAULT_PROGRAMS = [
  // Divine Word College of Calapan
  { name: 'Bachelor of Science in Psychology',                                       school: DWCC,  tuitionCap: 25000 },
  { name: 'Bachelor of Secondary Education Major in Values Education',               school: DWCC,  tuitionCap: 25000 },
  { name: 'Bachelor of Physical Education',                                          school: DWCC,  tuitionCap: 25000 },
  { name: 'Bachelor of Science in Accountancy',                                      school: DWCC,  tuitionCap: 25000 },
  { name: 'Bachelor of Science in Management Accounting',                            school: DWCC,  tuitionCap: 25000 },
  { name: 'Bachelor of Science in Civil Engineering',                                school: DWCC,  tuitionCap: 25000 },
  { name: 'Bachelor of Science in Computer Engineering',                             school: DWCC,  tuitionCap: 25000 },
  { name: 'Bachelor of Science in Electrical Engineering',                           school: DWCC,  tuitionCap: 25000 },
  { name: 'Bachelor of Science in Electronics Engineering',                          school: DWCC,  tuitionCap: 25000 },
  { name: 'Bachelor of Fine Arts',                                                   school: DWCC,  tuitionCap: 25000 },
  { name: 'Bachelor of Science in Architecture',                                     school: DWCC,  tuitionCap: 25000 },
  // Luna Goco Colleges, Inc.
  { name: 'Bachelor of Science in Nursing',                                          school: LGC,   tuitionCap: 25000 },
  { name: 'Bachelor of Science in Medical Technology',                               school: LGC,   tuitionCap: 25000 },
  { name: 'Bachelor of Science in Pharmacy',                                         school: LGC,   tuitionCap: 25000 },
  { name: 'Bachelor of Science in Radiologic Technology',                            school: LGC,   tuitionCap: 25000 },
  { name: 'Bachelor of Science in Social Work',                                      school: LGC,   tuitionCap: 25000 },
  { name: 'Bachelor of Science in Midwifery',                                        school: LGC,   tuitionCap: 25000 },
  { name: 'Bachelor of Physical Therapy',                                            school: LGC,   tuitionCap: 25000 },
  // Southwestern College of Maritime, Business, and Technology
  { name: 'Bachelor of Science in Multimedia Arts',                                  school: SCMBT, tuitionCap: 25000 },
  { name: 'Bachelor of Science in Entrepreneurship',                                 school: SCMBT, tuitionCap: 25000 },
  { name: 'Bachelor of Science in Marine Transportation',                            school: SCMBT, tuitionCap: 25000 },
  { name: 'Bachelor of Science in Marine Engineering',                               school: SCMBT, tuitionCap: 25000 },
  // St. Anthony College Calapan City, Inc.
  { name: 'Bachelor of Science in Business Administration Major in Marketing Management',  school: SACC, tuitionCap: 25000 },
  { name: 'Bachelor of Science in Business Administration Major in Financial Management',  school: SACC, tuitionCap: 25000 },
  // ACLC College of Calapan
  { name: 'Bachelor of Science in Business Administration Major in Marketing Management',  school: ACLC, tuitionCap: 25000 },
  // St. Mark Arts and Training Institute Inc.
  { name: 'Tourism Leading to Maritime',                                             school: SMATI, tuitionCap: 25000 },
  // St. Augustine Seminary
  { name: 'Bachelor of Arts in Philosophy',                                          school: SAS,   tuitionCap: 25000 },
];

const DEFAULT_STATUSES = [
  { name: 'Pending',         code: 'pending',        color: '#f59e0b' },
  { name: 'Under Review',    code: 'under_review',   color: '#3b82f6' },
  { name: 'Approved',        code: 'approved',       color: '#10b981' },
  { name: 'Active Scholar',  code: 'active_scholar', color: '#2d9596' },
  { name: 'On Hold',         code: 'probation',      color: '#f97316' },
  { name: 'Graduated',       code: 'graduated',      color: '#8b5cf6' },
  { name: 'Terminated',      code: 'terminated',     color: '#ef4444' },
  { name: 'Rejected',        code: 'rejected',       color: '#dc2626' },
];

const DEFAULT_STAGES = [
  { name: 'Applicant',    code: 'applicant',    color: '#3b82f6', order: 1 },
  { name: 'Scholar',      code: 'scholar',      color: '#10b981', order: 2 },
  { name: 'Graduated',    code: 'graduated',    color: '#f59e0b', order: 3 },
  { name: 'Board Passer', code: 'board_passer', color: '#8b5cf6', order: 4 },
  { name: 'Employed',     code: 'employed',     color: '#ec4899', order: 5 },
];

const DEFAULTS_MAP = {
  schools:  DEFAULT_SCHOOLS,
  programs: DEFAULT_PROGRAMS,
  statuses: DEFAULT_STATUSES,
  stages:   DEFAULT_STAGES,
};

// Bump this when the eligible schools/programs list changes so existing browsers
// refresh their cached catalog to the latest official list.
const CATALOG_SEED_VERSION = 2;

export function seedIfEmpty() {
  const store = load();
  const now = new Date().toISOString();
  const seed = (items) => items.map(d => ({ ...d, id: makeId(), active: true, createdAt: now }));

  if (!store._seeded) {
    store.schools  = seed(DEFAULT_SCHOOLS);
    store.programs = seed(DEFAULT_PROGRAMS);
    store.statuses = seed(DEFAULT_STATUSES);
    store.stages   = seed(DEFAULT_STAGES);
    store._seeded  = true;
    store._catalogVersion = CATALOG_SEED_VERSION;
    save(store);
    return;
  }

  // Refresh only the eligible schools/programs catalog (leaving statuses, stages,
  // config and school years untouched) when the official list has been updated.
  if (store._catalogVersion !== CATALOG_SEED_VERSION) {
    store.schools  = seed(DEFAULT_SCHOOLS);
    store.programs = seed(DEFAULT_PROGRAMS);
    store._catalogVersion = CATALOG_SEED_VERSION;
    save(store);
  }
}

export function resetCollection(col) {
  const defaults = DEFAULTS_MAP[col];
  if (!defaults) return;
  const store = load();
  const now = new Date().toISOString();
  store[col] = defaults.map(d => ({ ...d, id: makeId(), active: true, createdAt: now }));
  save(store);
}

// ── School Years (local, no backend needed) ──────────────────────────────────

export function getSchoolYears() {
  return load().schoolYears || [];
}

export function addSchoolYear({ startYear, endYear, semesters = [] }) {
  const store = load();
  const now = new Date().toISOString();
  const syId = makeId();
  const newSY = {
    id: syId,
    startYear,
    endYear,
    label: `${startYear}-${endYear}`,
    isActive: !(store.schoolYears || []).some(s => s.isActive),
    createdAt: now,
    semesters: semesters.map((sem, i) => ({
      id: makeId(),
      name: sem.name,
      order: sem.order,
      isActive: i === 0,
      createdAt: now,
    })),
  };
  store.schoolYears = [...(store.schoolYears || []), newSY];
  save(store);
  return newSY;
}

export function updateSchoolYear(id, { startYear, endYear }) {
  const store = load();
  store.schoolYears = (store.schoolYears || []).map(sy =>
    sy.id === id
      ? { ...sy, startYear, endYear, label: `${startYear}-${endYear}`, updatedAt: new Date().toISOString() }
      : sy
  );
  save(store);
}

export function deleteSchoolYear(id) {
  const store = load();
  store.schoolYears = (store.schoolYears || []).filter(sy => sy.id !== id);
  save(store);
}

export function setActiveSchoolYear(id) {
  const store = load();
  store.schoolYears = (store.schoolYears || []).map(sy => ({ ...sy, isActive: sy.id === id }));
  save(store);
}

export function addSemester(yearId, { name, order }) {
  const store = load();
  store.schoolYears = (store.schoolYears || []).map(sy => {
    if (sy.id !== yearId) return sy;
    const sem = { id: makeId(), name, order, isActive: sy.semesters.length === 0, createdAt: new Date().toISOString() };
    return { ...sy, semesters: [...(sy.semesters || []), sem] };
  });
  save(store);
}

export function updateSemester(yearId, semId, { name, order }) {
  const store = load();
  store.schoolYears = (store.schoolYears || []).map(sy => {
    if (sy.id !== yearId) return sy;
    return {
      ...sy,
      semesters: (sy.semesters || []).map(sem =>
        sem.id === semId ? { ...sem, name, order, updatedAt: new Date().toISOString() } : sem
      ),
    };
  });
  save(store);
}

export function deleteSemester(yearId, semId) {
  const store = load();
  store.schoolYears = (store.schoolYears || []).map(sy => {
    if (sy.id !== yearId) return sy;
    return { ...sy, semesters: (sy.semesters || []).filter(sem => sem.id !== semId) };
  });
  save(store);
}

export function setActiveSemester(yearId, semId) {
  const store = load();
  store.schoolYears = (store.schoolYears || []).map(sy => {
    if (sy.id !== yearId) return sy;
    return {
      ...sy,
      semesters: (sy.semesters || []).map(sem => ({ ...sem, isActive: sem.id === semId })),
    };
  });
  save(store);
}
