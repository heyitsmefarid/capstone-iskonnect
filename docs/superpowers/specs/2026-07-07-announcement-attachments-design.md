# Announcement File Attachments — Design

**Sub-project 2/2** of the file-attachments initiative. Sub-project 1/2 (Direct Messages + Group Chat attachments) is complete and in production. This spec covers the second surface: **Announcements**.

## Context

`AnnouncementModel` already has `attachments: List<String>` and an `imageUrl` field, and `scholar-ui11`'s `announcement_detail_screen.dart` already renders an "Attachments" section with per-file download buttons. None of it is wired up:

- `AppContext.jsx`'s `addAnnouncement`/`updateAnnouncement` never write `attachments` or `imageUrl` to Firestore.
- The admin-ui `Announcements.jsx` form has no attach/upload UI at all.
- The scholar-ui11 detail screen's download button shows a SnackBar reading "Download feature will be available soon" — it does not download anything.
- `imageUrl` is not read or displayed anywhere in the codebase; it is dead.

This spec wires the existing scaffolding up to real Cloudinary-backed uploads and downloads, reusing everything built for messaging.

## Data Model

- `AnnouncementModel.attachments` changes type from `List<String>` to `List<MessageAttachment>` (the `{url, name}` model already defined in `scholar-ui11/lib/core/models/message_attachment_model.dart` for messaging — reused unchanged, no new type).
- `AnnouncementModel.imageUrl` is left untouched. It is unused everywhere except its own getter/setter/copyWith — out of scope for this feature, not to be removed or repurposed here.
- Firestore schema: `announcements/{id}.attachments` becomes an array of `{url, name}` maps, identical in shape to the existing `messages.attachments` and `group_chats/{id}.messages[].attachments` fields already in production. No Firestore rule changes needed — `announcements` already allows `signedIn()` create/update/delete (`firestore.rules:112-117`).

## Admin-ui (`admin-ui/src/pages/Announcements.jsx` + `AppContext.jsx`)

- The announcement form (used for both create and edit) gains an attach button and a hidden `<input type="file" multiple>`, matching the pattern already shipped in `Messages.jsx`: `pendingAttachments` state (`{name, file, error}`), with per-file remove.
- **Create:** on submit, all pending files upload via the existing `uploadFile()` from `admin-ui/src/services/cloudinaryUpload.js` (no new upload service — reused as-is). Uploaded `{url, name}` results are passed to `addAnnouncement(formData, attachments)`.
- **Edit:** `handleEdit` pre-loads the announcement's existing `attachments` into the form as removable chips, displayed alongside any newly-added pending files. On submit, the final attachments array (existing minus removed, plus newly uploaded) is passed to `updateAnnouncement(id, formData, attachments)`, which replaces the Firestore array wholesale — not a merge/append.
- `addAnnouncement`/`updateAnnouncement` in `AppContext.jsx` each gain an `attachments = []` parameter, written into the Firestore doc alongside the existing fields.
- Announcement cards in the list gain the same attachment rendering already shipped in `Messages.jsx`: image attachments (by extension) render as an inline `<img>` thumbnail; every attachment also gets a `<a download>` Download link. The admin list currently renders nothing for attachments — this is new.
- No empty-send guard is needed here (unlike Messages.jsx) — `title` and `message` are already `required` fields on this form, so there's no path to submitting an attachments-only announcement with blank text.

## Scholar-ui11 (read-only side)

- `announcements_provider.dart`'s `_mapRecord` parses `record['attachments']` via `MessageAttachment.listFromJson(...)` instead of `List<String>.from(...)`.
- `announcement_detail_screen.dart`'s existing Attachments section is wired to real data instead of being dead code:
  - Image attachments (checked by file extension, same `['jpg','jpeg','png','gif']` list used in messaging) render an inline `Image.network` thumbnail above the existing name+icon row, matching messaging's `_AttachmentLink` pattern.
  - The download `IconButton`'s `onPressed` switches from the placeholder SnackBar to a real `url_launcher` call (`launchUrl(Uri.parse(attachment.url), mode: LaunchMode.externalApplication)`), identical to messaging's `_AttachmentLink._download()`, including the same "Could not open the file" fallback SnackBar on failure.
  - Each attachment's display name changes from the raw stored string to `attachment.name` (the model's display name field).
- `announcements_screen.dart`'s list card already computes `hasAttachments: announcement.attachments.isNotEmpty` — no change needed, `List<MessageAttachment>` still supports `.isNotEmpty`.
- No changes to `scholar_firestore_service.dart`'s `announcementsStream()` — it already streams raw Firestore documents; only the provider's parsing of the `attachments` field changes.

## Global Constraints

(Inherited unchanged from the messaging sub-project)

- Reuse the existing Cloudinary account: cloud name `c42z63hb`, unsigned upload preset `capstone`.
- 10 MB max file size, enforced client-side before upload (existing `isFileSizeAllowed` in both `storage_service.dart` and `cloudinaryUpload.js` — unchanged, reused as-is).
- Any file type accepted (images, PDFs, docs, etc.).
- Multiple attachments per announcement.
- No new upload service on either side — both apps' existing `uploadFile()` functions are reused without modification.
- No migration of old announcements: any announcement created before this feature simply has an empty `attachments` array going forward (its stray pre-existing `attachments: List<String>` — if any ever existed in Firestore — was never actually populated by any code path, so there is nothing real to migrate).

## Testing

- Dart unit tests for the changed parsing logic: `AnnouncementsNotifier._mapRecord` (or equivalent testable seam) correctly parses an `attachments` array of `{url, name}` maps into `List<MessageAttachment>`, and defaults to `[]` when the field is missing — mirroring the existing `message_attachment_model_test.dart` coverage from the messaging sub-project.
- No new test framework introduced for admin-ui, consistent with the messaging sub-project's decision.
- Manual end-to-end verification (admin posts an announcement with an image and a PDF attached, scholar views it, both display/download correctly; admin edits the announcement to remove one attachment and add another, scholar sees the updated set) is handed off to the user — no test credentials are available in this environment, matching the precedent set by the messaging sub-project.

## Out of Scope

- The dead `imageUrl` field (untouched, not removed).
- Any change to who can create announcements (admin-only, unchanged).
- Any change to Firestore security rules (already sufficient).
- Retrofitting old announcements with attachments (none exist with real data in that field).
