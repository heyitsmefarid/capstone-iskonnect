# Firebase Backend Checklist (No UI Changes)

Purpose: Implement backend services only for the existing apps and screens.
Scope: Keep current UI intact; replace mock/local data flows with Firebase-backed services.

## Current Project Readiness Snapshot

- [x] Admin web UI modules already exist (applications, scholars, attendance, academic records, announcements, messages, reports, timeline).
- [x] Scholar mobile UI flows already exist (auth, application, requirements, tracking, announcements, academic progress).
- [x] Offline QR scanner exists with local storage and sync workflow.
- [x] Shared backend scaffold is now initialized in Firebase config/rules files.
- [ ] Data currently relies on mock/local state in key areas.
- [x] QR scanner bootstrap moved from Supabase config to Firebase config.

## 0) Foundation Setup (Do First)

- [ ] Create Firebase projects: `dev` and `prod`.
- [ ] Enable Authentication (Email/Password first).
- [ ] Create Firestore database (Native mode).
- [ ] Enable Firebase Storage.
- [ ] Enable Cloud Functions (Node.js 20+).
- [x] Add Firebase config to all apps (admin-ui, scholar-ui11, qr_scanner).
- [x] Set environment configuration per app (dev/prod keys, not hard-coded).
- [x] Define role model: `super_admin`, `admin`, `scholar`, `applicant`, `scanner_device`.
- [x] Implement Firebase security rules baseline for Firestore and Storage.
- [x] Add App Check for web/mobile where applicable.

## 1) Objective: Centralized Scholar Data Platform

- [ ] Design unified Firestore schema for personal, academic, scholarship records.
- [ ] Create core collections:
  - [ ] `users`
  - [ ] `profiles`
  - [ ] `applications`
  - [ ] `scholarships`
  - [ ] `academic_records`
  - [ ] `attendance_events`
  - [ ] `attendance_logs`
  - [ ] `announcements`
  - [ ] `messages`
  - [ ] `reports_cache`
- [ ] Build repository/service layer in each app to read/write Firestore.
- [ ] Replace mock context/state calls with backend service calls (no UI redesign).
- [ ] Add server timestamps and audit fields (`createdBy`, `createdAt`, `updatedAt`).
- [x] Add soft-delete/archive fields for compliance (`isArchived`, `archivedAt`).

## 2) Objective: Online Application + Requirements + Status Tracking

- [ ] Implement applicant account registration/login via Firebase Auth.
- [ ] Store application form payload in `applications` collection.
- [x] Store requirements files in Storage under deterministic paths.
- [x] Save requirement metadata in Firestore (`fileUrl`, `fileType`, `submittedAt`, `verifiedAt`).
- [ ] Implement status pipeline fields: `draft`, `submitted`, `under_review`, `approved`, `rejected`, `waitlisted`.
- [x] Add Cloud Function trigger to update timeline/status history entries.
- [ ] Add validation rules to block incomplete submissions.

## 3) Objective: Performance + Attendance + Academic Monitoring

- [ ] Persist semester grades and subject-level records in `academic_records`.
- [ ] Add computed metrics (GWA, failed subjects, probation flags).
- [ ] Implement attendance event definitions in `attendance_events`.
- [ ] Write attendance logs to `attendance_logs` linked by scholar and event.
- [x] Build Cloud Functions for automated evaluation flags (low attendance, low grades, missing docs).
- [ ] Add admin-facing query indexes for term, school, status, and risk levels.
- [x] Add admin-facing query indexes for term, school, status, and risk levels.

## 4) Objective: Communication Platform

- [x] Implement announcements in Firestore with audience targeting.
- [ ] Implement one-to-one or thread-based messaging collection model.
- [ ] Add read/unread status tracking per user.
- [x] Add Cloud Messaging (FCM) for push notifications (announcement + message events).
- [ ] Add role-based posting permissions (admins can broadcast; scholars receive and reply by policy).

## 5) Objective: Offline QR Attendance

- [ ] Keep offline local capture in QR scanner app.
- [x] Replace Supabase/HTTP sync target with Firebase endpoint strategy:
  - [ ] Option A: Direct Firestore writes with queued sync worker.
  - [x] Option B: Cloud Function HTTPS endpoint for validated batch ingestion.
- [ ] Add deduplication keys per scan (`eventId + scholarId + date`).
- [x] Add signature/validation logic for QR payload authenticity.
- [x] Add conflict handling for late sync and duplicate uploads.
- [x] Store scanner device identity and logs for traceability.

## 6) Objective: Progress Tracking (Application to Completion)

- [ ] Implement lifecycle state machine in Firestore:
  - [ ] `applied`
  - [ ] `screened`
  - [ ] `interviewed`
  - [ ] `approved`
  - [ ] `active_scholar`
  - [ ] `probation`
  - [ ] `graduated`
  - [ ] `terminated`
- [x] Write timeline entries automatically on every state transition.
- [x] Enforce transition rules in Cloud Functions (prevent invalid jumps).
- [x] Add completion metadata (graduation date, completion remarks, exit reason).

## 7) Objective: Reports Generation

- [ ] Define report datasets in Firestore queries (performance, attendance, scholarship status).
- [x] Add Cloud Functions for heavy aggregations and scheduled rollups.
- [x] Cache report snapshots in `reports_cache` for faster admin loading.
- [x] Add export-ready structures for PDF/Excel generators already present in UI.
- [x] Add monthly/semester scheduled generation jobs.

## Security and Governance Checklist

- [x] Firestore rules enforce role-based access per collection.
- [x] Storage rules enforce ownership and admin review permissions.
- [x] Cloud Functions verify auth token and role claims.
- [x] Implement custom claims management for admin roles.
- [x] Add audit logging for approvals, rejections, and status changes.
- [ ] Add data retention and archival policy.

## Data Migration Checklist (Mock/Local to Firebase)

- [ ] Map existing mock structures to Firestore schema.
- [x] Create migration scripts for seed data (admin test data, scholars, events).
- [x] Preserve existing IDs where possible to avoid UI logic breakage.
- [ ] Backfill timestamps and status history.
- [ ] Validate sample records in admin and scholar apps after migration.

## Testing and Release Checklist

- [x] Set up Firebase Emulator Suite for local testing.
- [ ] Add integration tests for auth, application flow, attendance sync, and reports.
- [ ] Perform rule tests for forbidden access scenarios.
- [ ] Run end-to-end smoke tests across all three apps.
- [ ] Prepare rollback plan and backups before production cutover.

## Suggested Implementation Order (Backend-Only)

- [ ] Phase 1: Firebase project setup, auth, rules baseline.
- [ ] Phase 2: Centralized scholar/application data and storage.
- [ ] Phase 3: Attendance + QR offline sync integration.
- [ ] Phase 4: Communication modules + notifications.
- [ ] Phase 5: Reporting, scheduled jobs, hardening, and migration cleanup.
