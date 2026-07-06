# Messaging File Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make file attachments actually work (upload + persist + display + download) in scholar-ui11's Direct Messages and Group Chat, and add the same capability to admin-ui's Messages page, so CED staff and scholars can send/receive real files in both directions.

**Architecture:** Reuse the existing Cloudinary account (unsigned upload preset, already used for requirement uploads) as the single storage backend for both apps — scholar-ui11 gets a generalized `StorageService.uploadFile`, admin-ui gets a new equivalent JS module. Both `MessageModel`/`GroupChatMessage` (Dart) move from a singular nullable attachment to `attachments: List<MessageAttachment>`, threaded through Firestore reads/writes on both sides, with matching UI (multi-file picker, removable chips, explicit Download action) on both apps.

**Tech Stack:** Flutter/Dart (scholar-ui11), React/JS (admin-ui), Firebase Firestore, Cloudinary (unsigned client uploads), `file_picker`/`image_picker`/`url_launcher` (already dependencies).

## Global Constraints

- File size cap: 10 MB per file (matches the existing Cloudinary free-tier cap already enforced by `StorageService.maxFileBytes`).
- Any file type is accepted (Cloudinary's `auto` resource type) — no type restriction.
- Multiple attachments per message/send are allowed.
- Attachments must have an explicit **Download** action in the UI, not just tap-to-open.
- No new upload backend/credentials — reuse the existing Cloudinary account (cloud name `c42z63hb`, unsigned preset `capstone`).
- No new automated test framework — add only a few focused Dart unit tests for new pure logic (`MessageAttachment` json round-trip, file-size validation); everything else is verified by driving the real app.
- Old singular `attachmentUrl`/`attachmentName` data is not migrated — it was never functional (Direct: dead local device path; Group: never even reached Firestore), so there is nothing real to preserve.

---

### Task 1: `MessageAttachment` model + generalized `StorageService.uploadFile`

**Files:**
- Create: `scholar-ui11/lib/core/models/message_attachment_model.dart`
- Test: `scholar-ui11/test/core/models/message_attachment_model_test.dart`
- Modify: `scholar-ui11/lib/core/services/storage_service.dart`
- Test: `scholar-ui11/test/core/services/storage_service_test.dart`

**Interfaces:**
- Produces: `MessageAttachment({required String url, required String name})` with `.toJson()`, `MessageAttachment.fromJson(Map<String, dynamic>)`, `MessageAttachment.listFromJson(List?)` → `List<MessageAttachment>`, `MessageAttachment.listToJson(List<MessageAttachment>)` → `List<Map<String, dynamic>>`.
- Produces: `StorageService.uploadFile({required String fileName, required Uint8List bytes})` → `Future<String?>` (the public URL, or `null` on failure/empty/too-large).
- Produces: `StorageService.isFileSizeAllowed(int bytes)` → `bool`.
- Consumes: nothing from other tasks (this is the foundational task).

- [ ] **Step 1: Write the failing test for `MessageAttachment`**

Create `scholar-ui11/test/core/models/message_attachment_model_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/message_attachment_model.dart';

void main() {
  group('MessageAttachment', () {
    test('round-trips through toJson/fromJson', () {
      const attachment = MessageAttachment(
        url: 'https://res.cloudinary.com/c42z63hb/raw/upload/v1/report.pdf',
        name: 'report.pdf',
      );

      final json = attachment.toJson();
      final restored = MessageAttachment.fromJson(json);

      expect(restored.url, attachment.url);
      expect(restored.name, attachment.name);
    });

    test('fromJson falls back to a default name when missing', () {
      final restored =
          MessageAttachment.fromJson({'url': 'https://example.com/f'});
      expect(restored.name, 'Attachment');
    });

    test('listFromJson handles null and empty input', () {
      expect(MessageAttachment.listFromJson(null), isEmpty);
      expect(MessageAttachment.listFromJson([]), isEmpty);
    });

    test('listFromJson parses a list of maps', () {
      final list = MessageAttachment.listFromJson([
        {'url': 'https://example.com/a.png', 'name': 'a.png'},
        {'url': 'https://example.com/b.pdf', 'name': 'b.pdf'},
      ]);
      expect(list, hasLength(2));
      expect(list[0].name, 'a.png');
      expect(list[1].url, 'https://example.com/b.pdf');
    });

    test('listToJson maps back to plain maps', () {
      const list = [
        MessageAttachment(url: 'https://example.com/a.png', name: 'a.png'),
      ];
      expect(MessageAttachment.listToJson(list), [
        {'url': 'https://example.com/a.png', 'name': 'a.png'},
      ]);
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scholar-ui11 && flutter test test/core/models/message_attachment_model_test.dart`
Expected: FAIL — `message_attachment_model.dart` doesn't exist yet (import error).

- [ ] **Step 3: Create the `MessageAttachment` model**

Create `scholar-ui11/lib/core/models/message_attachment_model.dart`:

```dart
/// A single uploaded file attached to a chat message (Direct or Group).
class MessageAttachment {
  final String url;
  final String name;

  const MessageAttachment({required this.url, required this.name});

  Map<String, dynamic> toJson() => {'url': url, 'name': name};

  factory MessageAttachment.fromJson(Map<String, dynamic> json) {
    return MessageAttachment(
      url: json['url']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Attachment',
    );
  }

  static List<MessageAttachment> listFromJson(List? json) {
    if (json == null) return const [];
    return json
        .map((e) =>
            MessageAttachment.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  static List<Map<String, dynamic>> listToJson(
      List<MessageAttachment> attachments) {
    return attachments.map((a) => a.toJson()).toList();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scholar-ui11 && flutter test test/core/models/message_attachment_model_test.dart`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing test for the file-size helper**

Create `scholar-ui11/test/core/services/storage_service_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/services/storage_service.dart';

void main() {
  group('StorageService.isFileSizeAllowed', () {
    test('allows a file at exactly the 10 MB cap', () {
      expect(StorageService.isFileSizeAllowed(10 * 1024 * 1024), isTrue);
    });

    test('rejects a file over the 10 MB cap', () {
      expect(
          StorageService.isFileSizeAllowed(10 * 1024 * 1024 + 1), isFalse);
    });

    test('rejects an empty file', () {
      expect(StorageService.isFileSizeAllowed(0), isFalse);
    });

    test('allows a small file', () {
      expect(StorageService.isFileSizeAllowed(1024), isTrue);
    });
  });
}
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd scholar-ui11 && flutter test test/core/services/storage_service_test.dart`
Expected: FAIL — `isFileSizeAllowed` is not a member of `StorageService`.

- [ ] **Step 7: Generalize `StorageService`**

Modify `scholar-ui11/lib/core/services/storage_service.dart` — replace the entire file with:

```dart
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

/// Uploads files to **Cloudinary** (free tier, no backend / no Blaze plan
/// needed) and returns a public delivery URL. Used for applicant/scholar
/// requirement files (COR/COG/ID pictures) and for chat/message attachments.
///
/// Uses an *unsigned* upload preset, so the file is sent straight from the app
/// with no signature/secret — the preset (`capstone`) defines what's allowed.
/// The `auto` resource type handles any file type: images, PDFs, Word/Excel.
class StorageService {
  const StorageService._();

  // Cloudinary account (unsigned client uploads).
  static const String _cloudName = 'c42z63hb';
  static const String _uploadPreset = 'capstone';
  static const Duration _timeout = Duration(seconds: 60);

  /// Maximum accepted file size (10 MB) — Cloudinary's free tier allows up to
  /// 10 MB per file, and this keeps uploads quick on mobile data.
  static const int maxFileBytes = 10 * 1024 * 1024;

  /// Whether a file of this size can be uploaded (non-empty, at or under the
  /// cap). Checked client-side before attempting a network call.
  static bool isFileSizeAllowed(int bytes) {
    return bytes > 0 && bytes <= maxFileBytes;
  }

  /// Uploads [bytes] under [fileName] and returns the public URL, or null if
  /// the file is empty / too large / the upload fails. Accepts any file type.
  static Future<String?> uploadFile({
    required String fileName,
    required Uint8List bytes,
  }) async {
    if (!isFileSizeAllowed(bytes.lengthInBytes)) {
      return null;
    }

    try {
      final safeName = fileName.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
      final uri = Uri.parse(
        'https://api.cloudinary.com/v1_1/$_cloudName/auto/upload',
      );

      final request = http.MultipartRequest('POST', uri)
        ..fields['upload_preset'] = _uploadPreset
        ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: safeName));

      final streamed = await request.send().timeout(_timeout);
      final res = await http.Response.fromStream(streamed);

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final url = data['secure_url'] ?? data['url'];
        return url is String ? url : null;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Thin wrapper kept for the existing requirement-upload call sites —
  /// `studentId`/`requirementId` aren't used in the upload itself (Cloudinary
  /// doesn't need them), they're just caller-side context.
  static Future<String?> uploadRequirementFile({
    required String studentId,
    required String requirementId,
    required String fileName,
    required Uint8List bytes,
  }) {
    return uploadFile(fileName: fileName, bytes: bytes);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd scholar-ui11 && flutter test test/core/services/storage_service_test.dart`
Expected: PASS (4 tests)

- [ ] **Step 9: Run the full test suite to confirm no regressions**

Run: `cd scholar-ui11 && flutter test`
Expected: All tests pass (existing requirement-upload call sites are unaffected — `uploadRequirementFile`'s signature is unchanged).

- [ ] **Step 10: Commit**

```bash
cd scholar-ui11
git add lib/core/models/message_attachment_model.dart test/core/models/message_attachment_model_test.dart lib/core/services/storage_service.dart test/core/services/storage_service_test.dart
git commit -m "feat: add MessageAttachment model and generalize StorageService for chat uploads"
```

---

### Task 2: Thread `attachments` through Firestore send/fetch (scholar-ui11)

**Files:**
- Modify: `scholar-ui11/lib/core/models/message_model.dart`
- Modify: `scholar-ui11/lib/core/models/group_chat_model.dart`
- Modify: `scholar-ui11/lib/core/services/scholar_firestore_service.dart:231-324`
- Modify: `scholar-ui11/lib/features/messaging/providers/messaging_provider.dart`

**Interfaces:**
- Consumes: `MessageAttachment` from Task 1 (`lib/core/models/message_attachment_model.dart`).
- Produces: `MessageModel.attachments: List<MessageAttachment>` (replaces `attachmentUrl`/`attachmentName`), `GroupChatMessage.attachments: List<MessageAttachment>` (same replacement).
- Produces: `ScholarFirestoreService.sendMessage({..., List<MessageAttachment> attachments = const []})`, `ScholarFirestoreService.sendGroupMessage({..., List<MessageAttachment> attachments = const []})`.
- Produces: `MessagingNotifier.sendMessage(String content, {List<MessageAttachment> attachments = const []})`, `GroupChatsNotifier.sendGroupMessage(String groupId, String content, {List<MessageAttachment> attachments = const []})`.

This task has no meaningful unit-test surface of its own (it's Firestore wiring + model field renames covered structurally by the compiler) — correctness is verified by Task 3/4's end-to-end UI flow. Proceed directly with the implementation.

- [ ] **Step 1: Update `MessageModel`**

Modify `scholar-ui11/lib/core/models/message_model.dart` — replace the whole file:

```dart
import 'message_attachment_model.dart';

class MessageModel {
  final String id;
  final String content;
  final DateTime timestamp;
  final bool isFromStudent;
  final String status; // Sent, Seen, Replied
  final List<MessageAttachment> attachments;

  MessageModel({
    required this.id,
    required this.content,
    required this.timestamp,
    required this.isFromStudent,
    this.status = 'Sent',
    this.attachments = const [],
  });

  bool get isSent => status == 'Sent';
  bool get isSeen => status == 'Seen';
  bool get isReplied => status == 'Replied';
  bool get hasAttachment => attachments.isNotEmpty;

  MessageModel copyWith({
    String? id,
    String? content,
    DateTime? timestamp,
    bool? isFromStudent,
    String? status,
    List<MessageAttachment>? attachments,
  }) {
    return MessageModel(
      id: id ?? this.id,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      isFromStudent: isFromStudent ?? this.isFromStudent,
      status: status ?? this.status,
      attachments: attachments ?? this.attachments,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
      'isFromStudent': isFromStudent,
      'status': status,
      'attachments': MessageAttachment.listToJson(attachments),
    };
  }

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id'],
      content: json['content'],
      timestamp: DateTime.parse(json['timestamp']),
      isFromStudent: json['isFromStudent'],
      status: json['status'] ?? 'Sent',
      attachments: MessageAttachment.listFromJson(json['attachments'] as List?),
    );
  }
}

class ConversationModel {
  final String id;
  final String subject;
  final List<MessageModel> messages;
  final DateTime lastMessageAt;
  final bool hasUnread;

  ConversationModel({
    required this.id,
    required this.subject,
    required this.messages,
    required this.lastMessageAt,
    this.hasUnread = false,
  });

  String get lastMessagePreview {
    if (messages.isEmpty) return '';
    return messages.last.content.length > 50
        ? '${messages.last.content.substring(0, 50)}...'
        : messages.last.content;
  }

  ConversationModel copyWith({
    String? id,
    String? subject,
    List<MessageModel>? messages,
    DateTime? lastMessageAt,
    bool? hasUnread,
  }) {
    return ConversationModel(
      id: id ?? this.id,
      subject: subject ?? this.subject,
      messages: messages ?? this.messages,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      hasUnread: hasUnread ?? this.hasUnread,
    );
  }
}
```

- [ ] **Step 2: Update `GroupChatMessage`**

Modify `scholar-ui11/lib/core/models/group_chat_model.dart` — add the import at the top and replace the `GroupChatMessage` class (lines 78-164):

```dart
import 'package:uuid/uuid.dart';

import 'package:iskonnectttt/core/models/message_attachment_model.dart';
```

Replace the `GroupChatMessage` class body:

```dart
/// Represents a message in a group chat
class GroupChatMessage {
  final String id;
  final String senderId;
  final String senderName;
  final String content;
  final DateTime timestamp;
  final List<MessageAttachment> attachments;
  final List<String> readBy;
  final bool isSystemMessage;

  GroupChatMessage({
    String? id,
    required this.senderId,
    required this.senderName,
    required this.content,
    DateTime? timestamp,
    this.attachments = const [],
    this.readBy = const [],
    this.isSystemMessage = false,
  }) : id = id ?? const Uuid().v4(),
       timestamp = timestamp ?? DateTime.now();

  bool get hasAttachment => attachments.isNotEmpty;

  String get senderInitials {
    final parts = senderName.split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return senderName.isNotEmpty ? senderName[0].toUpperCase() : '?';
  }

  GroupChatMessage copyWith({
    String? id,
    String? senderId,
    String? senderName,
    String? content,
    DateTime? timestamp,
    List<MessageAttachment>? attachments,
    List<String>? readBy,
    bool? isSystemMessage,
  }) {
    return GroupChatMessage(
      id: id ?? this.id,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      attachments: attachments ?? this.attachments,
      readBy: readBy ?? this.readBy,
      isSystemMessage: isSystemMessage ?? this.isSystemMessage,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'senderId': senderId,
      'senderName': senderName,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
      'attachments': MessageAttachment.listToJson(attachments),
      'readBy': readBy,
      'isSystemMessage': isSystemMessage,
    };
  }

  factory GroupChatMessage.fromJson(Map<String, dynamic> json) {
    return GroupChatMessage(
      id: json['id'],
      senderId: json['senderId'],
      senderName: json['senderName'],
      content: json['content'],
      timestamp: DateTime.parse(json['timestamp']),
      attachments: MessageAttachment.listFromJson(json['attachments'] as List?),
      readBy: List<String>.from(json['readBy'] ?? []),
      isSystemMessage: json['isSystemMessage'] ?? false,
    );
  }
}
```

Leave `GroupChatMember`, `GroupChat`, `ChatType`, `ChatConversation` untouched.

- [ ] **Step 3: Update `ScholarFirestoreService.sendMessage` and `.sendGroupMessage`**

Modify `scholar-ui11/lib/core/services/scholar_firestore_service.dart` — add the import near the top (alongside the other model imports already there) and replace lines 260-324:

```dart
import 'package:iskonnectttt/core/models/message_attachment_model.dart';
```

```dart
  static Future<void> sendMessage({
    required String fromUserId,
    required String toUserId,
    required String body,
    String? subject,
    List<MessageAttachment> attachments = const [],
  }) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return;
    try {
      await firestore.collection('messages').add({
        'fromUserId': fromUserId,
        'toUserId': toUserId,
        'subject': subject ?? 'New Message',
        'body': body,
        'createdAt': DateTime.now().toIso8601String(),
        'readBy': [fromUserId],
        'attachments': MessageAttachment.listToJson(attachments),
      }).timeout(const Duration(seconds: 10));
    } catch (_) {}
  }

  /// Live stream of group chats (admin writes, scholar app reads/writes) so new
  /// groups and messages appear without restarting the app. Each record carries
  /// the Firestore doc `id`; previously this was dropped, leaving every group's
  /// id null and silently emptying the scholar's list.
  static Stream<List<Map<String, dynamic>>> groupChatsStream() async* {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) {
      yield const [];
      return;
    }
    yield* firestore
        .collection('group_chats')
        .snapshots()
        .map((snap) => snap.docs.map((d) => {'id': d.id, ...d.data()}).toList());
  }

  /// Appends a message to a group's `messages` array field, matching the exact
  /// shape the admin UI writes and reads: { id, sender, senderId, text,
  /// timestamp, attachments }.
  static Future<void> sendGroupMessage({
    required String groupId,
    required String messageId,
    required String sender,
    required String senderId,
    required String text,
    required String timestamp,
    List<MessageAttachment> attachments = const [],
  }) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return;
    try {
      await firestore.collection('group_chats').doc(groupId).update({
        'messages': FieldValue.arrayUnion([
          {
            'id': messageId,
            'sender': sender,
            'senderId': senderId,
            'text': text,
            'timestamp': timestamp,
            'attachments': MessageAttachment.listToJson(attachments),
          },
        ]),
      }).timeout(const Duration(seconds: 10));
    } catch (_) {}
  }
```

- [ ] **Step 4: Parse `attachments` when fetching Direct Messages**

Modify `scholar-ui11/lib/features/messaging/providers/messaging_provider.dart` — add the import and update `_loadFromFirestore`, `sendMessage`, `_sendToFirestore`:

```dart
import 'package:iskonnectttt/core/models/message_attachment_model.dart';
```

Replace the `_loadFromFirestore` method body's `MessageModel` construction:

```dart
      state = records.map((record) {
        final fromUserId = record['fromUserId']?.toString();
        return MessageModel(
          id: record['id']?.toString() ?? const Uuid().v4(),
          content: record['body']?.toString() ?? record['content']?.toString() ?? '',
          timestamp: ScholarFirestoreService.parseDateTime(record['createdAt'] ?? record['timestamp']),
          isFromStudent: fromUserId == studentId,
          status: record['status']?.toString() ?? (fromUserId == studentId ? 'Sent' : 'Seen'),
          attachments: MessageAttachment.listFromJson(record['attachments'] as List?),
        );
      }).toList();
```

Replace `sendMessage` and `_sendToFirestore`:

```dart
  void sendMessage(String content, {List<MessageAttachment> attachments = const []}) {
    final message = MessageModel(
      id: const Uuid().v4(),
      content: content,
      timestamp: DateTime.now(),
      isFromStudent: true,
      status: 'Sent',
      attachments: attachments,
    );

    state = [...state, message];
    _sendToFirestore(message);

    Future.delayed(const Duration(seconds: 2), () {
      state = state
          .map((item) => item.id == message.id ? item.copyWith(status: 'Seen') : item)
          .toList();
    });
  }

  Future<void> _sendToFirestore(MessageModel message) async {
    try {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) return;

      await ScholarFirestoreService.sendMessage(
        fromUserId: studentId,
        toUserId: 'admin',
        body: message.content,
        subject: 'Scholar Inquiry',
        attachments: message.attachments,
      );
    } catch (_) {
      // Local state already has the message.
    }
  }
```

- [ ] **Step 5: Parse `attachments` when fetching Group Chat messages, and pass through on send**

Still in `messaging_provider.dart`, update `_toGroupChat`'s message-mapping and `sendGroupMessage`:

```dart
    final messages = ((record['messages'] as List?) ?? const [])
        .map((m) => Map<String, dynamic>.from(m as Map))
        .map((map) => GroupChatMessage(
              id: map['id']?.toString(),
              senderId: map['senderId']?.toString() ?? '',
              senderName: map['sender']?.toString() ?? 'Unknown',
              content: map['text']?.toString() ?? '',
              timestamp: ScholarFirestoreService.parseDateTime(map['timestamp']),
              attachments: MessageAttachment.listFromJson(map['attachments'] as List?),
            ))
        .toList()
      ..sort((a, b) => a.timestamp.compareTo(b.timestamp));
```

```dart
  void sendGroupMessage(String groupId, String content,
      {List<MessageAttachment> attachments = const []}) {
    final myId = _myId;
    if (myId == null) return;

    final messageId = const Uuid().v4();
    final timestamp = DateTime.now();

    // Optimistic local update so the message appears immediately; the stream
    // will reconcile to the canonical Firestore copy on the next emission.
    state = state.map((group) {
      if (group.id != groupId) return group;
      final newMessage = GroupChatMessage(
        id: messageId,
        senderId: myId,
        senderName: _myName,
        content: content,
        timestamp: timestamp,
        attachments: attachments,
      );
      return group.copyWith(messages: [...group.messages, newMessage]);
    }).toList();

    ScholarFirestoreService.sendGroupMessage(
      groupId: groupId,
      messageId: messageId,
      sender: _myName,
      senderId: myId,
      text: content,
      timestamp: timestamp.toIso8601String(),
      attachments: attachments,
    );
  }
```

- [ ] **Step 6: Run analyzer to confirm no broken references**

Run: `cd scholar-ui11 && flutter analyze lib/core/models/message_model.dart lib/core/models/group_chat_model.dart lib/core/services/scholar_firestore_service.dart lib/features/messaging/providers/messaging_provider.dart`
Expected: Errors pointing at `lib/features/messaging/screens/messaging_screen.dart` (still using the old `attachmentUrl`/`attachmentName` fields/params — that's Task 3). No errors in the four files just listed themselves.

- [ ] **Step 7: Commit**

```bash
cd scholar-ui11
git add lib/core/models/message_model.dart lib/core/models/group_chat_model.dart lib/core/services/scholar_firestore_service.dart lib/features/messaging/providers/messaging_provider.dart
git commit -m "feat: thread multi-file attachments through Direct Message and Group Chat Firestore read/write"
```

(`flutter analyze` will still show errors in `messaging_screen.dart` at this point — that's expected and resolved in Task 3. Do not attempt to fix `messaging_screen.dart` in this task.)

---

### Task 3: scholar-ui11 UI — multi-file picker, unified composer, attachment rendering

**Files:**
- Modify: `scholar-ui11/lib/features/messaging/screens/messaging_screen.dart` (imports; `_MessageBubble`; `_MessageInput`/`_MessageInputState`; `_buildDirectMessagesTab`'s `onSend` wiring; `_GroupChatViewState`; `_GroupMessageBubble`)

**Interfaces:**
- Consumes: `MessageAttachment` (Task 1), `MessageModel.attachments`/`GroupChatMessage.attachments`, `MessagingNotifier.sendMessage(..., {attachments})`, `GroupChatsNotifier.sendGroupMessage(..., {attachments})` (Task 2), `StorageService.uploadFile`/`isFileSizeAllowed` (Task 1).
- Produces: a reusable `_MessageInput` widget used by *both* the Direct tab and the Group Chat view, with `onSend: Future<void> Function(String message, {required List<MessageAttachment> attachments})`.

This task is UI-only; verification is manual (drive the app) per the spec's Testing section — there is no meaningful unit-test surface for widget state machines this shaped without a UI test harness this codebase doesn't otherwise use.

- [ ] **Step 1: Add the new import**

Modify `scholar-ui11/lib/features/messaging/screens/messaging_screen.dart` — add to the imports at the top of the file (after the existing `iskonnectttt/core/models/group_chat_model.dart` import):

```dart
import 'dart:typed_data';
import 'package:url_launcher/url_launcher.dart';
import 'package:iskonnectttt/core/models/message_attachment_model.dart';
import 'package:iskonnectttt/core/services/storage_service.dart';
```

- [ ] **Step 2: Add a shared `_AttachmentLink` widget for rendering received attachments**

Add this new class anywhere at file scope (e.g. directly above the existing `_MessageBubble` class, around line 562):

```dart
/// A received attachment shown inside a message bubble: name + an explicit
/// Download action (not just tap-to-open) via url_launcher.
class _AttachmentLink extends StatelessWidget {
  final MessageAttachment attachment;
  final bool isFromUser;

  const _AttachmentLink({required this.attachment, required this.isFromUser});

  bool get _isImage {
    final ext = attachment.name.contains('.')
        ? attachment.name.split('.').last.toLowerCase()
        : '';
    return ['jpg', 'jpeg', 'png', 'gif'].contains(ext);
  }

  Future<void> _download(BuildContext context) async {
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

  @override
  Widget build(BuildContext context) {
    final textColor = isFromUser ? Colors.white : AppColors.textPrimary;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: InkWell(
        onTap: () => _download(context),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _isImage ? Icons.image : Icons.insert_drive_file,
              size: 14,
              color: textColor,
            ),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                attachment.name,
                style: TextStyle(
                  fontSize: 12,
                  color: textColor,
                  decoration: TextDecoration.underline,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 4),
            Icon(Icons.download_rounded, size: 14, color: textColor),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 3: Render attachments in `_MessageBubble` (Direct Messages)**

Modify the `_MessageBubble` class (currently lines 562-690): add an `attachments` field and render them.

```dart
class _MessageBubble extends StatelessWidget {
  final String message;
  final DateTime time;
  final bool isFromUser;
  final String status;
  final List<MessageAttachment> attachments;

  const _MessageBubble({
    required this.message,
    required this.time,
    required this.isFromUser,
    required this.status,
    this.attachments = const [],
  });
```

Inside `build()`, in the bubble's inner `Column`, insert the attachments list right after the message `Text` widget and before the `SizedBox(height: 6)` that precedes the timestamp row:

```dart
                  Text(
                    message,
                    style: TextStyle(
                      fontSize: 14,
                      color: isFromUser ? Colors.white : AppColors.textPrimary,
                      height: 1.4,
                    ),
                  ),
                  ...attachments.map(
                    (a) => _AttachmentLink(attachment: a, isFromUser: isFromUser),
                  ),
                  const SizedBox(height: 6),
```

- [ ] **Step 4: Pass `attachments` into `_MessageBubble` from the Direct Messages list**

Find the `_buildDirectMessagesTab` method's `ListView.builder` (`itemBuilder`, around where `_MessageBubble(...)` is constructed) and add the new field:

```dart
                    return _MessageBubble(
                      message: message.content,
                      time: message.timestamp,
                      isFromUser: isFromUser,
                      status: message.status,
                      attachments: message.attachments,
                    );
```

- [ ] **Step 5: Rewrite `_MessageInput` for multi-file pending attachments + real upload**

Replace the entire `_MessageInput`/`_MessageInputState` class pair (currently lines 692-969) with:

```dart
class _MessageInput extends StatefulWidget {
  final Future<void> Function(String message,
      {required List<MessageAttachment> attachments}) onSend;

  const _MessageInput({required this.onSend});

  @override
  State<_MessageInput> createState() => _MessageInputState();
}

class _PendingAttachment {
  final String name;
  final Uint8List bytes;
  String? error;

  _PendingAttachment({required this.name, required this.bytes, this.error});
}

class _MessageInputState extends State<_MessageInput> {
  final _controller = TextEditingController();
  bool _canSend = false;
  bool _isSending = false;
  final List<_PendingAttachment> _pending = [];

  @override
  void initState() {
    super.initState();
    _controller.addListener(_updateSendState);
  }

  void _updateSendState() {
    setState(() {
      _canSend = _controller.text.trim().isNotEmpty || _pending.isNotEmpty;
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleSend() async {
    if (_isSending) return;
    final message = _controller.text.trim();
    if (message.isEmpty && _pending.isEmpty) return;

    setState(() => _isSending = true);

    final uploaded = <MessageAttachment>[];
    final stillPending = <_PendingAttachment>[];

    for (final item in _pending) {
      if (!StorageService.isFileSizeAllowed(item.bytes.lengthInBytes)) {
        item.error = 'Too large (max 10 MB)';
        stillPending.add(item);
        continue;
      }
      final url =
          await StorageService.uploadFile(fileName: item.name, bytes: item.bytes);
      if (url != null) {
        uploaded.add(MessageAttachment(url: url, name: item.name));
      } else {
        item.error = 'Upload failed — tap to retry';
        stillPending.add(item);
      }
    }

    if (message.isNotEmpty || uploaded.isNotEmpty) {
      await widget.onSend(
        message.isEmpty ? '📎 Sent an attachment' : message,
        attachments: uploaded,
      );
      _controller.clear();
    }

    if (!mounted) return;
    setState(() {
      _pending
        ..clear()
        ..addAll(stillPending);
      _isSending = false;
    });
    _updateSendState();
  }

  void _removeAttachment(_PendingAttachment item) {
    setState(() => _pending.remove(item));
    _updateSendState();
  }

  Future<void> _retryAttachment(_PendingAttachment item) async {
    setState(() => item.error = null);
    final url =
        await StorageService.uploadFile(fileName: item.name, bytes: item.bytes);
    if (!mounted) return;
    if (url != null) {
      await widget.onSend('📎 Sent an attachment',
          attachments: [MessageAttachment(url: url, name: item.name)]);
      if (!mounted) return;
      setState(() => _pending.remove(item));
    } else {
      setState(() => item.error = 'Upload failed — tap to retry');
    }
    _updateSendState();
  }

  Future<void> _pickImages() async {
    final picker = ImagePicker();
    final images = await picker.pickMultiImage();
    if (images.isEmpty) return;
    for (final image in images) {
      final bytes = await image.readAsBytes();
      _pending.add(_PendingAttachment(name: image.name, bytes: bytes));
    }
    setState(() {});
    _updateSendState();
  }

  Future<void> _pickFiles() async {
    final result =
        await FilePicker.platform.pickFiles(allowMultiple: true, withData: true);
    if (result == null) return;
    for (final file in result.files) {
      final bytes = file.bytes;
      if (bytes == null) continue;
      _pending.add(_PendingAttachment(name: file.name, bytes: bytes));
    }
    setState(() {});
    _updateSendState();
  }

  void _showAttachmentOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: AppColors.cardBackground,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Send Attachment',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _AttachmentOption(
                  icon: Icons.image,
                  label: 'Image',
                  color: AppColors.primary,
                  onTap: () {
                    Navigator.pop(context);
                    _pickImages();
                  },
                ),
                _AttachmentOption(
                  icon: Icons.insert_drive_file,
                  label: 'Document',
                  color: AppColors.secondary,
                  onTap: () {
                    Navigator.pop(context);
                    _pickFiles();
                  },
                ),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_pending.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _pending.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final item = _pending[index];
                  return _AttachmentChip(
                    name: item.name,
                    error: item.error,
                    onRemove: () => _removeAttachment(item),
                    onRetry:
                        item.error != null ? () => _retryAttachment(item) : null,
                  );
                },
              ),
            ),
          Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Row(
                    children: [
                      const SizedBox(width: 16),
                      Expanded(
                        child: TextField(
                          controller: _controller,
                          decoration: const InputDecoration(
                            hintText: 'Type your message...',
                            hintStyle: TextStyle(
                              color: AppColors.textTertiary,
                              fontSize: 14,
                            ),
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(vertical: 12),
                          ),
                          style: const TextStyle(
                            fontSize: 14,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 4,
                          minLines: 1,
                          textCapitalization: TextCapitalization.sentences,
                          onSubmitted: (_) => _handleSend(),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(
                          Icons.attach_file,
                          color: AppColors.textTertiary,
                        ),
                        onPressed: _showAttachmentOptions,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                child: Container(
                  decoration: BoxDecoration(
                    gradient: _canSend ? AppColors.primaryGradient : null,
                    color: _canSend ? null : AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: IconButton(
                    icon: _isSending
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Icon(
                            Icons.send_rounded,
                            color: _canSend ? Colors.white : AppColors.textTertiary,
                          ),
                    onPressed:
                        (_canSend && !_isSending) ? _handleSend : null,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A pending (not-yet-sent) attachment chip — removable, and retryable if its
/// upload failed.
class _AttachmentChip extends StatelessWidget {
  final String name;
  final String? error;
  final VoidCallback onRemove;
  final VoidCallback? onRetry;

  const _AttachmentChip({
    required this.name,
    required this.onRemove,
    this.error,
    this.onRetry,
  });

  bool get _isImage {
    final ext = name.contains('.') ? name.split('.').last.toLowerCase() : '';
    return ['jpg', 'jpeg', 'png', 'gif'].contains(ext);
  }

  @override
  Widget build(BuildContext context) {
    final hasError = error != null;
    return GestureDetector(
      onTap: onRetry,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: hasError
              ? AppColors.errorLight
              : AppColors.primaryLight.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              hasError
                  ? Icons.error_outline
                  : (_isImage ? Icons.image : Icons.insert_drive_file),
              size: 16,
              color: hasError ? AppColors.error : AppColors.primary,
            ),
            const SizedBox(width: 6),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 100),
              child: Text(
                hasError ? error! : name,
                style: TextStyle(
                  fontSize: 12,
                  color: hasError ? AppColors.error : AppColors.textPrimary,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
              ),
            ),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: onRemove,
              child: const Icon(Icons.close, size: 14, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 6: Update the Direct Messages tab's `onSend` wiring**

In `_buildDirectMessagesTab`, find the `_MessageInput(onSend: ...)` call and replace it:

```dart
          child: _MessageInput(
            onSend: (message, {required attachments}) async {
              ref
                  .read(messagesProvider.notifier)
                  .sendMessage(message, attachments: attachments);
            },
          ),
```

- [ ] **Step 7: Replace `_GroupChatViewState`'s bespoke composer with `_MessageInput`**

In `_GroupChatViewState` (currently starting at line 1133): remove the now-unused `_controller`/`_canSend` state and the `initState`/`dispose`/`_sendMessage` members, keeping only `_scrollController`:

```dart
class _GroupChatViewState extends ConsumerState<_GroupChatView> {
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }
```

Then replace the entire "Message Input" `Container` block (the plain `TextField` + send `IconButton`, currently the last child of the outer `Column` in `build()`) with:

```dart
        // Message Input
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.cardBackground,
            boxShadow: [
              BoxShadow(
                color: AppColors.cardShadow.withValues(alpha: 0.1),
                blurRadius: 10,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: _MessageInput(
            onSend: (message, {required attachments}) async {
              ref
                  .read(groupChatsProvider.notifier)
                  .sendGroupMessage(widget.groupId, message, attachments: attachments);
              _scrollToBottom();
            },
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 8: Render attachments in `_GroupMessageBubble`**

In `_GroupMessageBubble.build()` (currently around line 1328), insert the attachments list right after the `message.content` `Text` widget and before the timestamp `Text`:

```dart
                  Text(
                    message.content,
                    style: TextStyle(
                      fontSize: 14,
                      color: isFromUser ? Colors.white : AppColors.textPrimary,
                      height: 1.4,
                    ),
                  ),
                  ...message.attachments.map(
                    (a) => _AttachmentLink(attachment: a, isFromUser: isFromUser),
                  ),
                  const SizedBox(height: 4),
```

- [ ] **Step 9: Run analyzer**

Run: `cd scholar-ui11 && flutter analyze lib/features/messaging/screens/messaging_screen.dart`
Expected: `No issues found!`

- [ ] **Step 10: Run the full test suite**

Run: `cd scholar-ui11 && flutter test`
Expected: All tests pass (this task adds no new tests; it must not break the ones from Task 1).

- [ ] **Step 11: Manually verify the real upload/download round trip**

This is the load-bearing check per the spec — a passing analyzer does not prove the feature works:

1. Run the app: `cd scholar-ui11 && flutter run -d chrome`
2. Open Direct Messages, attach an image AND a document in one send, confirm both upload (chips disappear, no error) and the message sends.
3. Reload the page (fresh Firestore fetch, not local state) and confirm the sent message still shows both attachments with working Download links.
4. Repeat inside a Group Chat.
5. Confirm a message with only attachments (no text) sends and displays correctly (the "📎 Sent an attachment" fallback text).

- [ ] **Step 12: Commit**

```bash
cd scholar-ui11
git add lib/features/messaging/screens/messaging_screen.dart
git commit -m "feat: real multi-file attachment upload/download for Direct Messages and Group Chat"
```

---

### Task 4: admin-ui Cloudinary upload service

**Files:**
- Create: `admin-ui/src/services/cloudinaryUpload.js`

**Interfaces:**
- Produces: `uploadFile(file: File): Promise<string | null>` (public URL or `null` on failure/too-large), `isFileSizeAllowed(bytes: number): boolean`, `MAX_FILE_BYTES` constant.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Create the upload service**

Create `admin-ui/src/services/cloudinaryUpload.js`:

```javascript
// Uploads files to the same Cloudinary account already used by the scholar
// app for requirement/COR/COG uploads (unsigned preset, no backend needed).
// See scholar-ui11/lib/core/services/storage_service.dart for the Dart
// equivalent — keep the cloud name/preset/cap in sync with that file.

const CLOUD_NAME = 'c42z63hb';
const UPLOAD_PRESET = 'capstone';

// Cloudinary's free tier allows up to 10 MB per file.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function isFileSizeAllowed(bytes) {
  return bytes > 0 && bytes <= MAX_FILE_BYTES;
}

/**
 * Uploads a browser File to Cloudinary and returns its public URL, or null
 * if the file is empty/too large or the upload fails.
 * @param {File} file
 * @returns {Promise<string | null>}
 */
export async function uploadFile(file) {
  if (!file || !isFileSizeAllowed(file.size)) {
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      { method: 'POST', body: formData }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data.secure_url || data.url || null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd admin-ui
git add src/services/cloudinaryUpload.js
git commit -m "feat: add Cloudinary upload service for admin-ui message attachments"
```

---

### Task 5: admin-ui `AppContext.jsx` — thread `attachments` through send functions

**Files:**
- Modify: `admin-ui/src/context/AppContext.jsx:783-846` (`sendGroupMessage`, `sendDirectMessage`)

**Interfaces:**
- Consumes: nothing new (plain JS objects `{url, name}` — no shared type needed on the JS side).
- Produces: `sendGroupMessage(groupFirestoreId, text, attachments = [])`, `sendDirectMessage(toUserId, body, subject = 'Message from CED', attachments = [])`.

Reading already works with no changes needed: both `messages` and `group_chats` Firestore listeners spread the raw doc data (`...d.data()`), so a newly-written `attachments` field is automatically available on `msg.attachments` once written — confirmed by reading `AppContext.jsx:741` and the `group_chats` listener at `AppContext.jsx:759-761`.

- [ ] **Step 1: Update `sendGroupMessage`**

Modify `admin-ui/src/context/AppContext.jsx` — replace the `sendGroupMessage` function (currently lines 783-795):

```javascript
  const sendGroupMessage = async (groupFirestoreId, text, attachments = []) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !groupFirestoreId || !text) return;
    await updateDoc(doc(db, 'group_chats', groupFirestoreId), {
      messages: arrayUnion({
        id: Date.now(),
        sender: 'Admin',
        senderId: 'admin',
        text,
        timestamp: new Date().toISOString(),
        attachments,
      }),
    });
  };
```

- [ ] **Step 2: Update `sendDirectMessage`**

Replace `sendDirectMessage` (currently lines 835-846):

```javascript
  // Sends a message from the admin to a student (the scholar app reads it).
  const sendDirectMessage = async (toUserId, body, subject = 'Message from CED', attachments = []) => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db || !toUserId || !body) return;
    await addDoc(collection(db, 'messages'), {
      fromUserId: 'admin',
      toUserId,
      subject,
      body,
      createdAt: new Date().toISOString(),
      readBy: ['admin'],
      attachments,
    });
  };
```

- [ ] **Step 3: Run lint**

Run: `cd admin-ui && npx eslint src/context/AppContext.jsx`
Expected: No new errors (pre-existing unrelated warnings in this file are fine — confirm nothing new mentions `sendGroupMessage`/`sendDirectMessage`/`attachments`).

- [ ] **Step 4: Commit**

```bash
cd admin-ui
git add src/context/AppContext.jsx
git commit -m "feat: thread attachments through admin-ui sendDirectMessage/sendGroupMessage"
```

---

### Task 6: admin-ui `Messages.jsx` UI — attach, upload, send, download

**Files:**
- Modify: `admin-ui/src/pages/Messages.jsx`

**Interfaces:**
- Consumes: `uploadFile`, `isFileSizeAllowed`, `MAX_FILE_BYTES` (Task 4); `sendGroupMessage(groupFirestoreId, text, attachments)`, `sendDirectMessage(toUserId, body, subject, attachments)` (Task 5); `directMessages`/`threadMessages` already carry `attachments` once Task 5 writes them (no mapping change needed there since both derive from the raw spread Firestore data — confirmed above).

This task is UI-only; verification is manual (drive the app), matching Task 3's approach.

- [ ] **Step 1: Import the upload service and add `Paperclip`/`X` icons**

Modify `admin-ui/src/pages/Messages.jsx` — update the top imports:

```javascript
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import Swal from 'sweetalert2';
import { formatPersonName } from '../utils/nameFormat';
import { uploadFile, isFileSizeAllowed } from '../services/cloudinaryUpload';
import {
  MessageCircle,
  Search,
  Send,
  Users,
  Plus,
  UserPlus,
  PencilLine,
  Paperclip,
  X,
  Download,
} from 'lucide-react';
```

- [ ] **Step 2: Add pending-attachments state and a file input ref**

Near the existing `const [composerText, setComposerText] = useState('');` (line 42), add:

```javascript
  const [composerText, setComposerText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);
```

Add `useRef` to the React import at the top of the file:

```javascript
import { useEffect, useMemo, useRef, useState } from 'react';
```

- [ ] **Step 3: Add file-select and remove handlers**

Add these handlers near `handleSendMessage` (before it, around line 300-305):

```javascript
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

  const handleRemoveAttachment = (index) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };
```

- [ ] **Step 4: Update `handleSendMessage` to upload pending attachments first**

Replace `handleSendMessage` (currently exactly lines 305-338, ending with `setComposerText('');` before the closing brace):

```javascript
  const handleSendMessage = async (e) => {
    e.preventDefault();

    const text = composerText.trim();
    if ((!text && pendingAttachments.length === 0) || !selectedThread) return;

    setIsSending(true);
    const uploaded = [];
    for (const file of pendingAttachments) {
      const url = await uploadFile(file);
      if (url) {
        uploaded.push({ url, name: file.name });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Upload Failed',
          text: `"${file.name}" could not be uploaded. It was not sent.`,
        });
      }
    }

    const messageText = text || '📎 Sent an attachment';

    if (selectedThread.type === 'group') {
      if (!selectedGroup) {
        setIsSending(false);
        return;
      }
      try {
        await sendGroupMessage(selectedGroup.firestoreId, messageText, uploaded);
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Cannot Send',
          text: 'Message could not be sent to the group.',
        });
        setIsSending(false);
        return;
      }
    } else {
      const student = getStudentById(selectedThread.id);
      if (!student?.firestoreId) {
        Swal.fire({
          icon: 'warning',
          title: 'Cannot Send',
          text: 'This student is not linked to a synced account yet.',
        });
        setIsSending(false);
        return;
      }
      try {
        await sendDirectMessage(student.firestoreId, messageText, 'Message from CED', uploaded);
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Cannot Send',
          text: 'Message could not be sent to the student.',
        });
        setIsSending(false);
        return;
      }
    }

    setComposerText('');
    setPendingAttachments([]);
    setIsSending(false);
  };
```

- [ ] **Step 5: Render pending-attachment chips and the message bubbles' attachments**

Replace the messages-view + composer block (currently lines 619-649):

```javascript
            <div className="messages-view">
              {threadMessages.length === 0 && <p className="empty-state">No messages yet.</p>}
              {threadMessages.map((msg) => (
                <div key={msg.id} className={`bubble-row ${msg.sender === 'Admin' ? 'mine' : ''}`}>
                  <div className="bubble">
                    <div className="bubble-text">{msg.text}</div>
                    {(msg.attachments || []).map((a, i) => (
                      <a
                        key={i}
                        href={a.url}
                        download={a.name}
                        className="attachment-link"
                      >
                        <Download size={12} /> {a.name}
                      </a>
                    ))}
                    <div className="bubble-meta">
                      {msg.sender} • {new Date(msg.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pendingAttachments.length > 0 && (
              <div className="pending-attachments">
                {pendingAttachments.map((file, i) => (
                  <span key={i} className="attachment-chip">
                    {file.name}
                    <button type="button" onClick={() => handleRemoveAttachment(i)}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <form className="composer" onSubmit={handleSendMessage}>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFilesSelected}
              />
              <button
                type="button"
                className="mini-btn attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedThread}
              >
                <Paperclip size={16} />
              </button>
              <input
                type="text"
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder={
                  selectedThread?.type === 'group'
                    ? 'Message group chat...'
                    : 'Message student directly...'
                }
                disabled={!selectedThread}
              />
              <button type="submit" className="send-btn" disabled={isSending || !selectedThread}>
                <Send size={16} />
              </button>
            </form>
```

Note: the `<input type="text">`'s `required` attribute is removed since a message can now be attachment-only with no text.

- [ ] **Step 6: Add CSS for the new elements**

In the `<style jsx>` block at the bottom of the file, find the existing `.composer` rules (around line 1057-1075) and add these rules alongside them:

```css
        .attachment-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          font-size: 0.78rem;
          color: inherit;
          text-decoration: underline;
        }

        .pending-attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 0 4px 8px;
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

        .attach-btn {
          flex-shrink: 0;
        }
```

- [ ] **Step 7: Run lint**

Run: `cd admin-ui && npx eslint src/pages/Messages.jsx`
Expected: No new errors introduced by this change (check specifically for `no-undef`/`is not defined` around `uploadFile`, `isFileSizeAllowed`, `Paperclip`, `X`, `Download`, `fileInputRef`, `pendingAttachments`, `isSending`).

- [ ] **Step 8: Manually verify the real upload/download round trip**

1. Run `cd admin-ui && npm run dev`, open the Messages page.
2. Select a Direct thread, attach a file via the paperclip button, confirm the chip appears, send.
3. Confirm the sent message shows a Download link, and that reloading the page still shows it (proves it's really in Firestore, not just local state).
4. Repeat for a Group thread.
5. Confirm a scholar (in scholar-ui11, from Task 3) can see and download an attachment sent from admin-ui, and vice versa — this is the real cross-app proof the spec calls for.

- [ ] **Step 9: Commit**

```bash
cd admin-ui
git add src/pages/Messages.jsx
git commit -m "feat: add file attachment support to admin-ui Messages composer"
```

---

## Final Verification

- [ ] Run `cd scholar-ui11 && flutter analyze` — no new issues beyond whatever pre-existing ones were already in the codebase before this plan.
- [ ] Run `cd scholar-ui11 && flutter test` — all tests pass.
- [ ] Run `cd admin-ui && npx eslint src/pages/Messages.jsx src/context/AppContext.jsx src/services/cloudinaryUpload.js` — no new errors.
- [ ] Cross-app manual check: send an attachment from scholar-ui11 to admin-ui (Direct), confirm admin-ui can download it. Send one from admin-ui to scholar-ui11 (Group), confirm the scholar app can download it.
