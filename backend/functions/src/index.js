// Existing HTTP endpoints
const { health } = require('./http/health');
const { ingestOfflineAttendance } = require('./http/offlineAttendance');
const { submitRequirement, listRequirements, reviewRequirement } = require('./http/requirements');
const { getReportSummary } = require('./http/reports');
const { sendAnnouncementNotification } = require('./http/notifications');
const { generateApplicationForm } = require('./http/applicationForm');

// System settings
const {
  getSystemSettings,
  updateSystemConfig,
  manageSettingsItem,
  seedDefaultSettings,
} = require('./http/systemSettings');

// School year & semester management
const {
  getSchoolYears,
  getActiveSchoolYear,
  manageSchoolYear,
  manageSemester,
} = require('./http/schoolYears');

// Applicant evaluation with BFCSP rubric
const {
  getRubric,
  updateRubric,
  submitEvaluationScore,
  finalizeEvaluation,
  getEvaluationRankings,
} = require('./http/evaluation');

// Group chat
const {
  manageGroupChat,
  sendGroupMessage,
  getGroupMessages,
} = require('./http/groupChat');

// User management, security, audit
const {
  createManagedUser,
  resetUserPassword,
  updateUserRole,
  deactivateUser,
  getAuditLogs,
} = require('./http/userManagement');

// Bulk scholar account creation (Excel import of current scholars)
const { bulkCreateScholars } = require('./http/scholarImport');

// Email verification
const {
  sendEmailOTP,
  verifyEmailOTP,
  emailVerificationStatus,
} = require('./http/emailVerification');

// Password reset (OTP via SMTP)
const {
  requestPasswordResetOTP,
  resetPasswordWithOTP,
} = require('./http/passwordReset');

// Login security
const {
  checkLoginStatus,
  recordLoginFailure,
  recordLoginSuccess,
} = require('./http/loginSecurity');

// Firestore triggers
const { applicationTimeline } = require('./triggers/applicationTimeline');
const { scholarshipLifecycle } = require('./triggers/scholarshipLifecycle');
const { academicMonitoring } = require('./triggers/academicMonitoring');
const { attendanceMonitoring } = require('./triggers/attendanceMonitoring');
const { announcementNotifications } = require('./triggers/announcementNotifications');
const { messageNotifications } = require('./triggers/messageNotifications');
const { userRoleSync } = require('./triggers/userRoleSync');

// Scheduled jobs
const { rollupReports } = require('./schedules/rollupReports');

// ── Exports ────────────────────────────────────────────────────────────────

// Existing
exports.health = health;
exports.ingestOfflineAttendance = ingestOfflineAttendance;
exports.submitRequirement = submitRequirement;
exports.listRequirements = listRequirements;
exports.reviewRequirement = reviewRequirement;
exports.getReportSummary = getReportSummary;
exports.sendAnnouncementNotification = sendAnnouncementNotification;
exports.generateApplicationForm = generateApplicationForm;

// System settings
exports.getSystemSettings = getSystemSettings;
exports.updateSystemConfig = updateSystemConfig;
exports.manageSettingsItem = manageSettingsItem;
exports.seedDefaultSettings = seedDefaultSettings;

// School years
exports.getSchoolYears = getSchoolYears;
exports.getActiveSchoolYear = getActiveSchoolYear;
exports.manageSchoolYear = manageSchoolYear;
exports.manageSemester = manageSemester;

// Evaluation
exports.getRubric = getRubric;
exports.updateRubric = updateRubric;
exports.submitEvaluationScore = submitEvaluationScore;
exports.finalizeEvaluation = finalizeEvaluation;
exports.getEvaluationRankings = getEvaluationRankings;

// Group chat
exports.manageGroupChat = manageGroupChat;
exports.sendGroupMessage = sendGroupMessage;
exports.getGroupMessages = getGroupMessages;

// User management & security
exports.createManagedUser = createManagedUser;
exports.resetUserPassword = resetUserPassword;
exports.updateUserRole = updateUserRole;
exports.deactivateUser = deactivateUser;
exports.getAuditLogs = getAuditLogs;
exports.bulkCreateScholars = bulkCreateScholars;

// Email verification
exports.sendEmailOTP = sendEmailOTP;
exports.verifyEmailOTP = verifyEmailOTP;
exports.emailVerificationStatus = emailVerificationStatus;

// Password reset (OTP via SMTP)
exports.requestPasswordResetOTP = requestPasswordResetOTP;
exports.resetPasswordWithOTP = resetPasswordWithOTP;

// Login security
exports.checkLoginStatus = checkLoginStatus;
exports.recordLoginFailure = recordLoginFailure;
exports.recordLoginSuccess = recordLoginSuccess;

// Triggers
exports.applicationTimeline = applicationTimeline;
exports.scholarshipLifecycle = scholarshipLifecycle;
exports.academicMonitoring = academicMonitoring;
exports.attendanceMonitoring = attendanceMonitoring;
exports.announcementNotifications = announcementNotifications;
exports.messageNotifications = messageNotifications;
exports.userRoleSync = userRoleSync;

// Scheduled
exports.rollupReports = rollupReports;
