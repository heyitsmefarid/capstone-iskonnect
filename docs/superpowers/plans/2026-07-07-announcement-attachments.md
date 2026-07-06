# Announcement File Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up real file/image attachments for Announcements — admin can attach files when creating or editing an announcement, and scholars see image attachments displayed inline plus a real Download action for every attachment.

**Architecture:** Reuse everything already built for the messaging attachments feature: the `MessageAttachment{url,name}` model, both apps' existing `uploadFile()` Cloudinary services, and the same image-thumbnail + explicit-download UI pattern. `AnnouncementModel.attachments` changes type from `List<String>` to `List<MessageAttachment>`; the scholar-ui11 detail screen's already-built (but dead) Attachments section gets wired to real data; the admin-ui form gains an attach button with edit-time add/remove support.

**Tech Stack:** Flutter/Dart (scholar-ui11, `flutter_test`), React/JS (admin-ui), Firestore, Cloudinary (unsigned uploads, existing account).

## Global Constraints

- Reuse the existing Cloudinary account: cloud name `c42z63hb`, unsigned upload preset `capstone`. No new upload service on either side.
- 10 MB max file size per file, enforced client-side via the existing `isFileSizeAllowed` in both `storage_service.dart` and `cloudinaryUpload.js` — unchanged, reused as-is.
- Any file type accepted. Multiple attachments per announcement.
- On edit, existing attachments are viewable/removable and new ones can be added (per the approved spec decision) — the final attachments array replaces the Firestore field wholesale on save, it is not merged/appended server-side.
- The unused `imageUrl` field on `AnnouncementModel` is left untouched — do not remove or repurpose it.
- No Firestore security rule changes — `announcements` already allows `signedIn()` create/update/delete (`firestore.rules:112-117`).
- No new test framework for admin-ui. No migration of old announcements (none have ever had real attachment data — the field was always dead).

---

### Task 1: `AnnouncementModel` attachments type + provider parsing

**Files:**
- Modify: `scholar-ui11/lib/core/models/announcement_model.dart`
- Modify: `scholar-ui11/lib/features/announcements/providers/announcements_provider.dart:1-10,57-58`
- Test: `scholar-ui11/test/core/models/announcement_model_test.dart` (new)

**Interfaces:**
- Consumes: `MessageAttachment` (existing, `scholar-ui11/lib/core/models/message_attachment_model.dart`) — `MessageAttachment({required url, required name})`, `.toJson()`, `MessageAttachment.fromJson(Map)`, `MessageAttachment.listFromJson(List?)`, `MessageAttachment.listToJson(List<MessageAttachment>)`.
- Produces: `AnnouncementModel.attachments` is now typed `List<MessageAttachment>` (was `List<String>`) — every other task in this plan that touches `announcement.attachments` relies on this type.

- [ ] **Step 1: Write the failing test**

Create `scholar-ui11/test/core/models/announcement_model_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/announcement_model.dart';
import 'package:iskonnectttt/core/models/message_attachment_model.dart';

void main() {
  group('AnnouncementModel attachments', () {
    test('toJson/fromJson round-trips a list of attachments', () {
      final announcement = AnnouncementModel(
        id: 'a1',
        title: 'Test',
        description: 'Body text',
        date: DateTime.utc(2026, 1, 1),
        attachments: const [
          MessageAttachment(url: 'https://example.com/a.png', name: 'a.png'),
          MessageAttachment(url: 'https://example.com/b.pdf', name: 'b.pdf'),
        ],
      );

      final json = announcement.toJson();
      final restored = AnnouncementModel.fromJson(json);

      expect(restored.attachments, hasLength(2));
      expect(restored.attachments[0].name, 'a.png');
      expect(restored.attachments[1].url, 'https://example.com/b.pdf');
    });

    test('fromJson defaults to an empty attachments list when missing', () {
      final restored = AnnouncementModel.fromJson({
        'id': 'a2',
        'title': 'Test',
        'description': 'Body',
        'date': DateTime.utc(2026, 1, 1).toIso8601String(),
      });

      expect(restored.attachments, isEmpty);
    });

    test('copyWith replaces the attachments list', () {
      final announcement = AnnouncementModel(
        id: 'a3',
        title: 'Test',
        description: 'Body',
        date: DateTime.utc(2026, 1, 1),
      );

      final updated = announcement.copyWith(
        attachments: const [
          MessageAttachment(url: 'https://example.com/c.docx', name: 'c.docx'),
        ],
      );

      expect(announcement.attachments, isEmpty);
      expect(updated.attachments, hasLength(1));
      expect(updated.attachments.single.name, 'c.docx');
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `scholar-ui11/`): `flutter test test/core/models/announcement_model_test.dart`
Expected: FAIL — compile error, because `AnnouncementModel`'s `attachments` parameter is currently typed `List<String>` and the test passes `List<MessageAttachment>`.

- [ ] **Step 3: Update `AnnouncementModel` to use `MessageAttachment`**

Replace the full contents of `scholar-ui11/lib/core/models/announcement_model.dart`:

```dart
import 'package:iskonnectttt/core/models/message_attachment_model.dart';

/// Enum to define announcement visibility
enum AnnouncementVisibility {
  all, // Visible to both scholars and applicants
  scholarsOnly, // Only visible to approved scholars
  applicantsOnly, // Only visible to applicants (scholarship exam schedules, etc.)
}

class AnnouncementModel {
  final String id;
  final String title;
  final String description;
  final DateTime date;
  final String? imageUrl;
  final List<MessageAttachment> attachments;
  final bool isImportant;
  final bool isRead;
  final AnnouncementVisibility visibility;
  // The school year/semester active when this was posted — used to reset
  // the announcement list once a new term starts. Empty for announcements
  // posted before this field existed.
  final String schoolYear;
  final String semester;

  // Alias for description
  String get content => description;

  AnnouncementModel({
    required this.id,
    required this.title,
    required this.description,
    required this.date,
    this.imageUrl,
    this.attachments = const [],
    this.isImportant = false,
    this.isRead = false,
    this.visibility = AnnouncementVisibility.all,
    this.schoolYear = '',
    this.semester = '',
  });

  AnnouncementModel copyWith({
    String? id,
    String? title,
    String? description,
    DateTime? date,
    String? imageUrl,
    List<MessageAttachment>? attachments,
    bool? isImportant,
    bool? isRead,
    AnnouncementVisibility? visibility,
    String? schoolYear,
    String? semester,
  }) {
    return AnnouncementModel(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      date: date ?? this.date,
      imageUrl: imageUrl ?? this.imageUrl,
      attachments: attachments ?? this.attachments,
      isImportant: isImportant ?? this.isImportant,
      isRead: isRead ?? this.isRead,
      visibility: visibility ?? this.visibility,
      schoolYear: schoolYear ?? this.schoolYear,
      semester: semester ?? this.semester,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'date': date.toIso8601String(),
      'imageUrl': imageUrl,
      'attachments': MessageAttachment.listToJson(attachments),
      'isImportant': isImportant,
      'isRead': isRead,
      'visibility': visibility.name,
    };
  }

  factory AnnouncementModel.fromJson(Map<String, dynamic> json) {
    return AnnouncementModel(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      date: DateTime.parse(json['date']),
      imageUrl: json['imageUrl'],
      attachments: MessageAttachment.listFromJson(json['attachments'] as List?),
      isImportant: json['isImportant'] ?? false,
      isRead: json['isRead'] ?? false,
      visibility: AnnouncementVisibility.values.firstWhere(
        (e) => e.name == json['visibility'],
        orElse: () => AnnouncementVisibility.all,
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/core/models/announcement_model_test.dart`
Expected: PASS (3/3 tests)

- [ ] **Step 5: Update the provider's Firestore parsing**

In `scholar-ui11/lib/features/announcements/providers/announcements_provider.dart`, add this import alongside the existing ones at the top of the file:

```dart
import 'package:iskonnectttt/core/models/message_attachment_model.dart';
```

Then in `_mapRecord`, replace this line:

```dart
      attachments: List<String>.from(record['attachments'] ?? const []),
```

with:

```dart
      attachments: MessageAttachment.listFromJson(record['attachments'] as List?),
```

- [ ] **Step 6: Run the full test suite and analyzer**

Run (from `scholar-ui11/`):
```bash
flutter test
flutter analyze lib/core/models/announcement_model.dart lib/features/announcements/providers/announcements_provider.dart
```
Expected: all tests pass (existing suite plus the 3 new ones), analyzer reports no issues. If any other file fails to compile because it still expects `List<String>` from `announcement.attachments`, that is expected and resolved by Task 2 — note it in your report but do not fix it in this task.

- [ ] **Step 7: Commit**

```bash
git add scholar-ui11/lib/core/models/announcement_model.dart scholar-ui11/lib/features/announcements/providers/announcements_provider.dart scholar-ui11/test/core/models/announcement_model_test.dart
git commit -m "feat: model announcement attachments as MessageAttachment list"
```

---

### Task 2: Wire up the scholar-ui11 detail screen's Attachments UI

**Files:**
- Modify: `scholar-ui11/lib/features/announcements/screens/announcement_detail_screen.dart`

**Interfaces:**
- Consumes: `AnnouncementModel.attachments` as `List<MessageAttachment>` (Task 1). `MessageAttachment.name`, `MessageAttachment.url`.
- Produces: nothing consumed by later tasks — this is the final read-side surface for Announcements.

This screen already renders an "Attachments" section, but it is fully disconnected: `attachment` is currently treated as a raw `String`, there's no image preview, and the download button only shows a "coming soon" SnackBar. This task wires it to real data, matching the pattern already shipped in `scholar-ui11/lib/features/messaging/screens/messaging_screen.dart`'s `_AttachmentLink` widget.

- [ ] **Step 1: Add the `url_launcher` import**

In `scholar-ui11/lib/features/announcements/screens/announcement_detail_screen.dart`, add this import alongside the existing ones at the top of the file:

```dart
import 'package:url_launcher/url_launcher.dart';
```

(`url_launcher` is already a dependency — it's used the same way in `messaging_screen.dart`.)

- [ ] **Step 2: Add `_isImageAttachment` and `_downloadAttachment` helper methods**

In the same file, inside the `AnnouncementDetailScreen` class, add these two methods right after the existing `_getFileIcon` method (which starts at line 511):

```dart
  bool _isImageAttachment(String fileName) {
    final ext =
        fileName.contains('.') ? fileName.split('.').last.toLowerCase() : '';
    return ['jpg', 'jpeg', 'png', 'gif'].contains(ext);
  }

  Future<void> _downloadAttachment(
    BuildContext context,
    MessageAttachment attachment,
  ) async {
    final ok = await launchUrl(
      Uri.parse(attachment.url),
      mode: LaunchMode.externalApplication,
    );
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open the file.')),
      );
    }
  }
```

Also add this import (needed for the `MessageAttachment` type in the method signature above):

```dart
import 'package:iskonnectttt/core/models/message_attachment_model.dart';
```

- [ ] **Step 3: Replace the attachment row rendering**

Replace this exact block (currently lines 297-392 — the `...announcement.attachments.map((attachment) { ... })` closure):

```dart
                    ...announcement.attachments.map((attachment) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.cardBackground,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(
                                0xFFF59E0B,
                              ).withValues(alpha: 0.08),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 46,
                              height: 46,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [
                                    Color(0xFFF59E0B),
                                    Color(0xFFD97706),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(
                                _getFileIcon(attachment),
                                size: 22,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    attachment,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textPrimary,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Tap to download',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textTertiary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: const Color(
                                  0xFFF59E0B,
                                ).withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: IconButton(
                                icon: const Icon(
                                  Icons.download_rounded,
                                  color: Color(0xFFF59E0B),
                                  size: 20,
                                ),
                                onPressed: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Download feature will be available soon',
                                      ),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
```

with:

```dart
                    ...announcement.attachments.map((attachment) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (_isImageAttachment(attachment.name))
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: GestureDetector(
                                  onTap: () =>
                                      _downloadAttachment(context, attachment),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(16),
                                    child: Image.network(
                                      attachment.url,
                                      width: double.infinity,
                                      height: 180,
                                      fit: BoxFit.cover,
                                      loadingBuilder: (c, child, progress) =>
                                          progress == null
                                          ? child
                                          : Container(
                                              width: double.infinity,
                                              height: 180,
                                              color: AppColors.cardBackground,
                                              child: const Center(
                                                child: CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                ),
                                              ),
                                            ),
                                      errorBuilder: (c, e, s) => Container(
                                        width: double.infinity,
                                        height: 180,
                                        color: AppColors.cardBackground,
                                        child: const Icon(
                                          Icons.broken_image_outlined,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.cardBackground,
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(
                                      0xFFF59E0B,
                                    ).withValues(alpha: 0.08),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 46,
                                    height: 46,
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                        colors: [
                                          Color(0xFFF59E0B),
                                          Color(0xFFD97706),
                                        ],
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                      ),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Icon(
                                      _getFileIcon(attachment.name),
                                      size: 22,
                                      color: Colors.white,
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          attachment.name,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textPrimary,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Tap to download',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: AppColors.textTertiary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFFF59E0B,
                                      ).withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: IconButton(
                                      icon: const Icon(
                                        Icons.download_rounded,
                                        color: Color(0xFFF59E0B),
                                        size: 20,
                                      ),
                                      onPressed: () => _downloadAttachment(
                                        context,
                                        attachment,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
```

- [ ] **Step 4: Run the analyzer and full test suite**

Run (from `scholar-ui11/`):
```bash
flutter analyze lib/features/announcements/screens/announcement_detail_screen.dart
flutter test
```
Expected: no analyzer issues, all tests pass (this screen has no existing widget tests — verification here is analyzer + full regression suite, consistent with how `messaging_screen.dart`'s rewrite was verified in the messaging sub-project).

- [ ] **Step 5: Commit**

```bash
git add scholar-ui11/lib/features/announcements/screens/announcement_detail_screen.dart
git commit -m "feat: display real image thumbnails and downloads for announcement attachments"
```

---

### Task 3: Thread `attachments` through admin-ui `addAnnouncement`/`updateAnnouncement`

**Files:**
- Modify: `admin-ui/src/context/AppContext.jsx:633-666`

**Interfaces:**
- Consumes: nothing new — `data.attachments` is read off the same `data` object both functions already accept.
- Produces: `addAnnouncement(data)` and `updateAnnouncement(firestoreId, data)` now persist `data.attachments || []` to Firestore. Task 4 relies on being able to pass `attachments` as a field on the object it hands to these two functions.

**Important — this file has a large amount of unrelated, pre-existing uncommitted work sitting in it** (scholarship grant calc fixes, birth date handling, etc. — on the order of hundreds of lines). Before touching anything, run `git diff --stat admin-ui/src/context/AppContext.jsx` and confirm this. Your commit must contain **only** the two small edits below — nothing else from that pre-existing diff.

**Do not use a broad `git add`.** Use one of:
- `git add -p admin-ui/src/context/AppContext.jsx` and carefully select only the hunks matching the two edits below (reject everything else), or
- hand-build a minimal unified diff covering just these two edits and apply it with `git apply --cached --check` (dry run) then `git apply --cached`.

Verify with `git diff --cached admin-ui/src/context/AppContext.jsx` before committing — it must show only the two lines described below (plus surrounding context), and `git diff --cached --shortstat` should report a tiny number of insertions (2) and 0 deletions. If `git add -p` selects anything else on the first pass, run `git reset admin-ui/src/context/AppContext.jsx` (safe — only unstages, does not touch the working tree) and try again.

- [ ] **Step 1: Add `attachments` to the `addAnnouncement` Firestore write**

Find this block (around line 640):

```js
    await addDoc(collection(db, 'announcements'), {
      title: data.title,
      message: data.message,
      target: data.target,
      isImportant: !!data.isImportant,
      author: 'Admin',
      date: new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
      schoolYear: activeTerm?.schoolYear || '',
      semester: activeTerm?.semester || '',
    });
```

Change it to:

```js
    await addDoc(collection(db, 'announcements'), {
      title: data.title,
      message: data.message,
      target: data.target,
      isImportant: !!data.isImportant,
      attachments: data.attachments || [],
      author: 'Admin',
      date: new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
      schoolYear: activeTerm?.schoolYear || '',
      semester: activeTerm?.semester || '',
    });
```

(One line added: `attachments: data.attachments || [],`.)

- [ ] **Step 2: Add `attachments` to the `updateAnnouncement` Firestore write**

Find this block (around line 656):

```js
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
```

Change it to:

```js
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
```

(One line added: `attachments: data.attachments || [],`. Because Firestore's `setDoc(..., {merge: true})` replaces whole field values — not array elements — this fully replaces the `attachments` array with whatever `data.attachments` is, which is exactly the "replace wholesale" behavior required by the spec.)

- [ ] **Step 3: Lint check**

Run (from `admin-ui/`): `npx eslint src/context/AppContext.jsx`
Expected: only pre-existing, unrelated warnings/errors (if any) — nothing referencing `addAnnouncement`, `updateAnnouncement`, or `attachments`.

- [ ] **Step 4: Commit**

Stage only the two edited hunks as described above, then:

```bash
git commit -m "feat: persist attachments field on addAnnouncement/updateAnnouncement"
```

---

### Task 4: Admin-ui `Announcements.jsx` — attach UI (create + edit) and list rendering

**Files:**
- Modify: `admin-ui/src/pages/Announcements.jsx`

**Interfaces:**
- Consumes: `addAnnouncement(data)` / `updateAnnouncement(firestoreId, data)` — both now read `data.attachments` (Task 3). `uploadFile(file)` / `isFileSizeAllowed(bytes)` from `admin-ui/src/services/cloudinaryUpload.js` (existing, unmodified) — `uploadFile` returns `Promise<string|null>` (the Cloudinary `secure_url`, or `null` on failure/oversize).
- Produces: nothing consumed by later tasks (this is the last task in the plan).

- [ ] **Step 1: Add new imports**

At the top of `admin-ui/src/pages/Announcements.jsx`, change:

```js
import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import { SearchInput, EmptyState } from '../components/common';
import Swal from 'sweetalert2';
import { Plus, Send, Trash2, Bell, Edit2, AlertTriangle, Search, Filter } from 'lucide-react';
```

to:

```js
import { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import { SearchInput, EmptyState } from '../components/common';
import Swal from 'sweetalert2';
import { uploadFile, isFileSizeAllowed } from '../services/cloudinaryUpload';
import { Plus, Send, Trash2, Bell, Edit2, AlertTriangle, Search, Filter, Paperclip, X, Download } from 'lucide-react';

// fl_attachment was tried for downloads elsewhere in this codebase and caused
// ERR_INVALID_RESPONSE against this Cloudinary account's delivery settings —
// this uses the plain secure_url, same as Messages.jsx.
const isImageAttachment = (name) => {
  const ext = name?.includes('.') ? name.split('.').pop().toLowerCase() : '';
  return ['jpg', 'jpeg', 'png', 'gif'].includes(ext);
};

const SCHOLAR_STATUSES = ['approved', 'active', 'on-hold', 'graduated', 'terminated'];
const APPLICANT_STATUSES = ['pending'];
```

- [ ] **Step 2: Add attachment state**

Inside `export default function Announcements() {`, right after the existing:

```js
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTarget, setFilterTarget] = useState('');
```

add:

```js
  // Newly picked files for this form session, not yet uploaded: File objects.
  const [pendingAttachments, setPendingAttachments] = useState([]);
  // Attachments already saved on the announcement being edited: {url, name}.
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
```

- [ ] **Step 3: Update `resetForm` and the "New Announcement" button handler**

Change:

```js
  const resetForm = () => {
    setAnnouncementForm({ title: '', message: '', target: 'everyone', isImportant: false });
    setEditingId(null);
    setShowForm(false);
  };
```

to:

```js
  const resetForm = () => {
    setAnnouncementForm({ title: '', message: '', target: 'everyone', isImportant: false });
    setEditingId(null);
    setShowForm(false);
    setPendingAttachments([]);
    setExistingAttachments([]);
  };
```

Then find the "New Announcement" button in the JSX:

```jsx
          <button
            className="btn btn-primary"
            onClick={() => {
              if (showForm && !editingId) {
                resetForm();
              } else {
                setEditingId(null);
                setAnnouncementForm({ title: '', message: '', target: 'everyone', isImportant: false });
                setShowForm(true);
              }
            }}
          >
```

and change its `onClick` to:

```jsx
          <button
            className="btn btn-primary"
            onClick={() => {
              if (showForm && !editingId) {
                resetForm();
              } else {
                setEditingId(null);
                setAnnouncementForm({ title: '', message: '', target: 'everyone', isImportant: false });
                setPendingAttachments([]);
                setExistingAttachments([]);
                setShowForm(true);
              }
            }}
          >
```

- [ ] **Step 4: Update `handleEdit` to pre-load existing attachments**

Change:

```js
  const handleEdit = (announcement) => {
    setEditingId(announcement.firestoreId);
    setAnnouncementForm({
      title: announcement.title,
      message: announcement.message,
      target: announcement.target,
      isImportant: announcement.isImportant || false,
    });
    setShowForm(true);
  };
```

to:

```js
  const handleEdit = (announcement) => {
    setEditingId(announcement.firestoreId);
    setAnnouncementForm({
      title: announcement.title,
      message: announcement.message,
      target: announcement.target,
      isImportant: announcement.isImportant || false,
    });
    setExistingAttachments(announcement.attachments || []);
    setPendingAttachments([]);
    setShowForm(true);
  };
```

- [ ] **Step 5: Add file-selection and removal handlers**

Right after `handleEdit`, add:

```js
  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file later

    const accepted = [];
    for (const file of files) {
      if (!isFileSizeAllowed(file.size)) {
        Swal.fire({
          icon: 'warning',
          title: 'File too large',
          text: `"${file.name}" is over the 10 MB limit.`,
        });
        continue;
      }
      accepted.push(file);
    }
    setPendingAttachments((prev) => [...prev, ...accepted]);
  };

  const handleRemovePendingAttachment = (index) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingAttachment = (index) => {
    setExistingAttachments((prev) => prev.filter((_, i) => i !== index));
  };
```

- [ ] **Step 6: Update `handleSubmit` to upload and attach files**

Change:

```js
  const handleSubmit = async (e) => {
    e.preventDefault();

    const recipients = getRecipientsByTarget(announcementForm.target);

    if (recipients.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Recipients',
        text: 'There are no students in the selected target group.',
      });
      return;
    }

    try {
      if (editingId) {
        await updateAnnouncement(editingId, announcementForm);
        Swal.fire({
          title: 'Updated!',
          text: 'Announcement has been updated.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await addAnnouncement(announcementForm);
        Swal.fire({
          title: 'Posted!',
          text: `Announcement sent to ${recipients.length} student(s).`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
      }
      resetForm();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: 'Could not save the announcement. Please try again.',
      });
    }
  };
```

to:

```js
  const handleSubmit = async (e) => {
    e.preventDefault();

    const recipients = getRecipientsByTarget(announcementForm.target);

    if (recipients.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Recipients',
        text: 'There are no students in the selected target group.',
      });
      return;
    }

    setIsSaving(true);
    const uploaded = [];
    for (const file of pendingAttachments) {
      const url = await uploadFile(file);
      if (url) {
        uploaded.push({ url, name: file.name });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Upload Failed',
          text: `"${file.name}" could not be uploaded. It was not attached.`,
        });
      }
    }
    const attachments = [...existingAttachments, ...uploaded];

    try {
      if (editingId) {
        await updateAnnouncement(editingId, { ...announcementForm, attachments });
        Swal.fire({
          title: 'Updated!',
          text: 'Announcement has been updated.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await addAnnouncement({ ...announcementForm, attachments });
        Swal.fire({
          title: 'Posted!',
          text: `Announcement sent to ${recipients.length} student(s).`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
      }
      resetForm();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: 'Could not save the announcement. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };
```

- [ ] **Step 7: Add the attach UI to the form**

Find the "Mark as Important" `form-group` block:

```jsx
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={announcementForm.isImportant}
                    onChange={(e) =>
                      setAnnouncementForm({ ...announcementForm, isImportant: e.target.checked })
                    }
                  />
                  <AlertTriangle size={14} />
                  Mark as Important
                </label>
              </div>
              <div className="form-actions">
```

and insert a new `form-group` between them, and update the submit button, so it reads:

```jsx
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={announcementForm.isImportant}
                    onChange={(e) =>
                      setAnnouncementForm({ ...announcementForm, isImportant: e.target.checked })
                    }
                  />
                  <AlertTriangle size={14} />
                  Mark as Important
                </label>
              </div>
              <div className="form-group">
                <label>Attachments</label>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFilesSelected}
                />
                <button
                  type="button"
                  className="btn btn-secondary attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={16} />
                  Attach Files
                </button>
                {(existingAttachments.length > 0 || pendingAttachments.length > 0) && (
                  <div className="pending-attachments">
                    {existingAttachments.map((a, i) => (
                      <span key={`existing-${i}`} className="attachment-chip">
                        {a.name}
                        <button type="button" onClick={() => handleRemoveExistingAttachment(i)}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {pendingAttachments.map((file, i) => (
                      <span key={`pending-${i}`} className="attachment-chip">
                        {file.name}
                        <button type="button" onClick={() => handleRemovePendingAttachment(i)}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  <Send size={18} />
                  {isSaving ? 'Saving...' : editingId ? 'Update Announcement' : 'Post Announcement'}
                </button>
              </div>
```

(Only the new "Attachments" `form-group` and the submit button's `disabled`/label are new; the Cancel button and surrounding structure are unchanged.)

- [ ] **Step 8: Render attachments on each announcement card**

Find:

```jsx
                <p className="announcement-message">{announcement.message}</p>
              </div>
            ))
          )}
```

and change it to:

```jsx
                <p className="announcement-message">{announcement.message}</p>
                {(announcement.attachments || []).length > 0 && (
                  <div className="announcement-attachments">
                    {announcement.attachments.map((a, i) => (
                      <div key={i}>
                        {isImageAttachment(a.name) && (
                          <a href={a.url} target="_blank" rel="noopener noreferrer">
                            <img src={a.url} alt={a.name} className="attachment-thumb" />
                          </a>
                        )}
                        <a href={a.url} download={a.name} className="attachment-link">
                          <Download size={12} /> {a.name}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
```

- [ ] **Step 9: Add CSS**

In the `<style jsx>` block, right after the existing `.form-actions .btn { ... }` rule:

```css
        .form-actions .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
```

add:

```css
        .attach-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          width: auto;
        }

        .pending-attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .attachment-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          font-size: 0.78rem;
          color: var(--text-primary);
        }

        .attachment-chip button {
          display: flex;
          align-items: center;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-secondary);
          padding: 0;
        }

        .announcement-attachments {
          margin-top: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .attachment-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8rem;
          color: var(--primary-light, var(--primary-color));
          text-decoration: underline;
        }

        .attachment-thumb {
          display: block;
          max-width: 200px;
          max-height: 200px;
          border-radius: 8px;
          margin-bottom: 4px;
          object-fit: cover;
        }
```

- [ ] **Step 10: Lint check**

Run (from `admin-ui/`): `npx eslint src/pages/Announcements.jsx`
Expected: no new errors/warnings introduced by this change (pre-existing unrelated issues, if any, are fine).

- [ ] **Step 11: Commit**

```bash
git add admin-ui/src/pages/Announcements.jsx
git commit -m "feat: add attach/edit UI and attachment rendering to Announcements"
```

---

## Manual Verification (after all tasks complete)

No automated E2E coverage exists for this flow (consistent with the messaging sub-project). After Task 4 lands, manually verify:

1. As admin: create a new announcement with one image and one PDF attached. Confirm it posts successfully and both files show up on the announcement card (image as a thumbnail, both with a working Download link).
2. As a scholar: open that announcement's detail screen. Confirm the image renders as an inline thumbnail, and tapping Download on each attachment actually opens/downloads the file (not the old "coming soon" message).
3. As admin: edit that announcement, remove one attachment, add a different one, save. Confirm the scholar app reflects the updated attachment set after the change syncs.
