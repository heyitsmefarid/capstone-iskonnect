const COLLECTIONS = {
  USERS: 'users',
  PROFILES: 'profiles',
  APPLICATIONS: 'applications',
  SCHOLARSHIPS: 'scholarships',
  ACADEMIC_RECORDS: 'academic_records',
  ATTENDANCE_EVENTS: 'attendance_events',
  ATTENDANCE_LOGS: 'attendance_logs',
  ANNOUNCEMENTS: 'announcements',
  MESSAGES: 'messages',
  GROUP_CHATS: 'group_chats',
  GROUP_MESSAGES: 'group_messages',
  TIMELINE_ENTRIES: 'timeline_entries',
  AUDIT_LOGS: 'audit_logs',
  REPORTS_CACHE: 'reports_cache',
  NOTIFICATIONS: 'notifications',
  ACTIVITY_SUMMARIES: 'activity_summaries',
  // System settings collections
  SCHOOLS: 'schools',
  PROGRAMS: 'programs',
  SCHOLARSHIP_CATEGORIES: 'scholarship_categories',
  TUITION_FEES: 'tuition_fees',
  SCHOLARSHIP_STATUSES: 'scholarship_statuses',
  TIMELINE_STAGES: 'timeline_stages',
  SYSTEM_CONFIG: 'system_config',
  // School year/semester management
  SCHOOL_YEARS: 'school_years',
  SEMESTERS: 'semesters',
  // Evaluation
  EVALUATION_RUBRICS: 'evaluation_rubrics',
  EVALUATION_SCORES: 'evaluation_scores',
  // Auth / security
  LOGIN_ATTEMPTS: 'login_attempts',
  EMAIL_OTPS: 'email_otps',
  PASSWORD_RESET_OTPS: 'password_reset_otps',
};

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STAFF: 'staff',
  SCHOLAR: 'scholar',
  APPLICANT: 'applicant',
  SCANNER_DEVICE: 'scanner_device',
};

const APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'waitlisted',
];

const SCHOLARSHIP_STATUSES = [
  'applied',
  'screened',
  'interviewed',
  'approved',
  'active_scholar',
  'probation',
  'graduated',
  'terminated',
];

const TIMELINE_STAGES = [
  'applicant',
  'scholar',
  'graduated',
  'board_passer',
  'employed',
];

const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  STATUS_CHANGE: 'STATUS_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',
  EXPORT: 'EXPORT',
};

module.exports = {
  COLLECTIONS,
  ROLES,
  APPLICATION_STATUSES,
  SCHOLARSHIP_STATUSES,
  TIMELINE_STAGES,
  AUDIT_ACTIONS,
};
