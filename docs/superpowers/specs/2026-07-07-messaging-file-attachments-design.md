# Real File Attachments for Direct + Group Messaging — Design

## Problem

Both scholar-ui11's Direct Messages and Group Chat have an attachment picker
UI (image/file picker, preview chip, "Send") that looks functional but isn't:

- The picker stores the file's **local device path** (or a `blob:` URL on
  web) as `attachmentUrl` — a value only valid on the sender's own device.
  Nothing ever uploads the file anywhere.
- For Group Chat specifically, it's worse: `ScholarFirestoreService
  .sendGroupMessage` doesn't even accept an attachment parameter. The
  attachment only ever exists in the sender's own optimistic local state and
  disappears the moment the real-time Firestore listener reconciles state
  from the server (which never received it).
- admin-ui's `Messages.jsx` (the unified Direct + Group reply composer used
  by CED staff) has no attachment UI at all — not even a broken stub.

This spec covers making attachments **actually work**, bidirectionally,
across Direct Messages and Group Chat. A companion spec/sub-project will
separately cover Announcement attachments (admin-ui creates, scholar app
displays) — that surface shares no code with messaging and is scoped out
here.

## Scope

**In scope:**
- Real file upload (Cloudinary, reusing the existing free-tier account) for
  attachments sent from scholar-ui11 (Direct + Group) and from admin-ui's
  Messages page (Direct + Group).
- Multiple attachments per message.
- Rendering received attachments (as open/download links) in both apps.

**Out of scope:**
- Announcement attachments (separate sub-project/spec).
- Any change to the requirements/COR/COG upload flow (already working,
  reused here only for its Cloudinary upload mechanism).
- Automated end-to-end test tooling — neither app has an existing test
  suite for messaging; this spec adds a couple of focused unit tests for
  new pure logic and relies on manually driving the app to verify the real
  upload → fetch round trip (see Testing below).

## Architecture

Reuse the existing Cloudinary account already used for requirement uploads
(unsigned upload preset `capstone` on cloud `c42z63hb`, no signature/secret
needed, 10 MB per-file cap, `auto` resource type accepts any file type) —
no new credentials, no backend/Cloud Function changes, no Firebase Storage
or Blaze plan.

- **scholar-ui11**: generalize `StorageService.uploadRequirementFile` into
  `StorageService.uploadFile({required String fileName, required
  Uint8List bytes})`. The existing method's body only ever uses `fileName`
  and `bytes` — `studentId`/`requirementId` are unused inside it today, so
  this is a pure extraction. `uploadRequirementFile` becomes a thin wrapper
  calling `uploadFile`, so no existing call site changes.
- **admin-ui**: new `src/services/cloudinaryUpload.js` exporting
  `uploadFile(file)` (a browser `File` object), doing the same unsigned
  multipart POST via `fetch` to
  `https://api.cloudinary.com/v1_1/c42z63hb/auto/upload` with
  `upload_preset=capstone`. Same 10 MB cap enforced client-side before the
  request is attempted.

## Data Model

`MessageModel` and `GroupChatMessage` (scholar-ui11) currently have
singular `attachmentUrl`/`attachmentName` fields. Since neither ever
actually reached Firestore in a usable form (confirmed above — Direct
Messages stored a dead local path; Group Chat never sent the field to
Firestore at all), there is no real data to migrate. Both models change to:

```dart
class MessageAttachment {
  final String url;
  final String name;

  const MessageAttachment({required this.url, required this.name});

  Map<String, dynamic> toJson() => {'url': url, 'name': name};

  factory MessageAttachment.fromJson(Map<String, dynamic> json) =>
      MessageAttachment(
        url: json['url']?.toString() ?? '',
        name: json['name']?.toString() ?? 'Attachment',
      );
}
```

- `MessageModel.attachments: List<MessageAttachment>` (replaces
  `attachmentUrl`/`attachmentName`). `hasAttachment => attachments
  .isNotEmpty`.
- `GroupChatMessage.attachments: List<MessageAttachment>` (same change).
- Both `copyWith`/`toJson`/`fromJson` updated accordingly. `fromJson` reads
  the new `attachments` list (`(json['attachments'] as List? ?? [])
  .map(...)`); no fallback to the old singular fields is needed since they
  were never functional.

**Firestore schema additions:**
- `messages` collection docs (Direct Messages): new `attachments: [{url,
  name}, ...]` field (defaults to `[]`).
- `group_chats/{id}.messages[]` array entries (Group Chat): new
  `attachments: [{url, name}, ...]` field (defaults to `[]`).

Both `ScholarFirestoreService.sendMessage` and `.sendGroupMessage`
(scholar-ui11) gain an `attachments` parameter (`List<MessageAttachment>`,
defaulting to `const []`) that's serialized into the Firestore write. Both
admin-ui's `sendDirectMessage` and `sendGroupMessage` (`AppContext.jsx`)
gain the equivalent `attachments` parameter (array of `{url, name}` plain
objects), written the same way.

## UI / Components

### scholar-ui11 — `_MessageInput` (shared by Direct + Group tabs)

- Internal state changes from a single nullable `_attachmentPath`/
  `_attachmentName` pair to `List<_PendingAttachment>` (local `bytes` +
  `name` + per-item upload/error status).
- The existing "Send Attachment" bottom sheet keeps its Image/Document
  options; file picking uses `FilePicker.platform.pickFiles(allowMultiple:
  true)` for documents and `ImagePicker().pickMultiImage()` for images
  (the app's `image_picker: ^1.0.7` supports multi-select natively), both
  appending to the same pending-attachments list.
- Each pending file renders as a small removable chip in a horizontal row
  above the input (extends the existing single-attachment preview into a
  list of the same chip style).
- On Send: upload every pending file to Cloudinary (send button shows a
  brief uploading/spinner state), then call `onSend(text, attachments:
  [MessageAttachment, ...])` with the resulting URLs. A per-file upload
  failure marks just that chip as errored (with a retry tap) and does not
  block sending the message with whichever files succeeded, plus the text.
- Message bubbles (both Direct and Group) render each `attachments` entry
  as a tappable row below the message text — file-type icon (derived from
  the name's extension, matching the existing image-vs-document icon
  logic) + name + tap-to-open via `url_launcher`, matching the existing
  file-open pattern used elsewhere in the app.

### admin-ui — `Messages.jsx` (shared composer for Direct + Group threads)

- Add a paperclip icon button next to the existing text `<input>`,
  triggering a hidden `<input type="file" multiple>`.
- Selected files render as small removable chips above the composer
  (mirrors the scholar-ui11 treatment).
- `handleSendMessage` uploads all pending files via `cloudinaryUpload.js`
  before calling `sendGroupMessage`/`sendDirectMessage` with the resulting
  `attachments` array; the send button shows a brief busy state during
  upload.
- Each message bubble renders its `attachments` as small clickable links
  (file name, opens in a new tab) alongside the existing text/meta line.

## Error Handling

- Client-side file-size validation (reusing the existing 10 MB constant,
  mirrored as a JS constant in `cloudinaryUpload.js`) rejects oversized
  files immediately, before attempting any network request, with a clear
  inline message.
- A failed upload only affects its own file/chip — shows an inline
  error/retry affordance; other pending files and the message text are
  unaffected and can still be sent.
- If the Firestore write itself fails after uploads already succeeded
  (rare — e.g. a dropped connection), the composer keeps its text and
  pending attachments rather than clearing them, and shows an error
  matching each app's existing pattern (`Swal.fire` on admin-ui, a
  `SnackBar` on scholar-ui11) so nothing is silently lost.

## Testing

Neither app has an existing automated test suite covering messaging or the
storage service, so this spec doesn't introduce new test scaffolding.
Instead:

- A handful of focused Dart unit tests for the new pure logic:
  `MessageAttachment.toJson`/`fromJson` round-trip, and the file-size
  validation helper's accept/reject boundary.
- The real, load-bearing verification is driving the actual app: send an
  attachment from one account/session and confirm a *different*
  account/session can open it (proving the file actually left the
  sender's device and is fetchable from Cloudinary) — for both Direct
  Messages and Group Chat, from both the scholar app and admin-ui.
