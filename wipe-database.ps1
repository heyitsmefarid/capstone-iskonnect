# =============================================================================
#  Wipe all scholar / applicant data from Firestore (project: iskonnect-15238)
# =============================================================================
#  Deletes every record + account + log collection, but KEEPS app configuration
#  (schools, programs, school_years, system_config, evaluation_rubrics,
#  announcements). After this runs, the admin dashboard shows 0 everywhere.
#
#  HOW TO RUN (from this folder, in PowerShell):
#     powershell -ExecutionPolicy Bypass -File .\wipe-database.ps1
# =============================================================================

$project = 'iskonnect-15238'

$collections = @(
  'users',              # scholar/applicant + account docs
  'profiles',
  'applications',
  'scholarships',
  'academic_records',
  'attendance_events',
  'attendance_logs',
  'timeline_entries',
  'evaluation_scores',
  'audit_logs',
  'notifications',
  'reports_cache',
  'activity_summaries',
  'messages',
  'group_chats'
)

Write-Host ""
Write-Host "Step 1/2  Re-authenticating with Firebase (a browser window will open)..." -ForegroundColor Cyan
firebase login --reauth
if ($LASTEXITCODE -ne 0) {
  Write-Host "Re-auth failed. Fix that first, then re-run this script." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Step 2/2  Deleting $($collections.Count) collections from '$project'..." -ForegroundColor Cyan
foreach ($c in $collections) {
  Write-Host ("  -> deleting {0} ..." -f $c) -ForegroundColor Yellow
  firebase firestore:delete $c --recursive --force --project $project
}

Write-Host ""
Write-Host "DONE. All scholar/applicant data, accounts and logs were deleted." -ForegroundColor Green
Write-Host "Now hard-refresh the admin (Ctrl+Shift+R) - every count should be 0." -ForegroundColor Green
