# Group Chat — Make It Functional (Scholar ↔ Admin)

Date: 2026-06-23
Status: Approved (design)

## Goal

Make group chat fully functional across the **scholar app** and **admin UI**,
using the existing direct-Firestore model the admin already runs. The admin side
already works; this work fixes the scholar app so scholars can see the groups
they belong to, read live messages, and post messages that reach the admin and
other members in real time. Member lists show real names resolved from the
`users` collection.

## Decisions

- **Architecture: Path A — direct Firestore.** Messages are stored as an array
  field on the group doc; both apps read/write the same shape via the Firebase
  SDK with a live `onSnapshot` listener. The Cloud Functions in
  `backend/functions/src/http/groupChat.js` (subcollection model) remain unused
  dead code and are out of scope.
- **Membership: members-only.** A scholar sees and can post only in groups whose
  `memberIds` contains their id.
- **Member names: resolved from `users`.** The member info sheet shows each
  member's real name, school, and program by looking up `users/{memberId}`.

## Shared data contract — `group_chats/{id}`

The admin already writes this; the scholar app must read and write it exactly.

```
group_chats/{id} = {
  name:       string,
  createdBy:  string,        // 'admin'
  createdAt:  number,        // ms epoch (admin) — parse defensively
  memberIds:  [ <firestoreUserId>, ... ],
  messages:   [
    { id, sender, senderId, text, timestamp }   // timestamp = ISO8601 string
  ],
}
```

- A scholar's own id is `SharedPreferences['logged_in_student_id']`, which equals
  their `users` doc id and the value the admin stores in `memberIds`. Membership
  and "is this message mine?" both key off this id.
- Admin-authored messages use `senderId: 'admin'`, `sender: 'Admin'`. `'admin'`
  is not in `memberIds`, so it never appears in the member list — message bubbles
  use the stored `sender` name directly, not a member lookup.

## Changes — scholar app only (no admin/backend changes)

### 1. `scholar-ui11/lib/core/services/scholar_firestore_service.dart`
- **`groupChatsStream()`** — replace one-shot `fetchGroupChats()` with a live
  stream mirroring `announcementsStream()`, mapping `{'id': doc.id, ...d.data()}`
  so the doc id is preserved (the current bug: `doc.data()` drops the id, leaving
  every `group.id` null and silently emptying the list).
- **`sendGroupMessage({groupId, id, sender, senderId, text, timestamp})`** — append
  to the doc's `messages` field via `FieldValue.arrayUnion`, in the exact shape
  above so the admin and other members render it.
- **`fetchUsersByIds(List<String> ids)`** — batch-resolve member display data from
  `users/{id}` (chunked `whereIn` on document id, ≤10 per query), returning
  id → `{firstName, middleName, lastName, schoolName, academicProgram}`.

### 2. `scholar-ui11/lib/features/messaging/providers/messaging_provider.dart` — `GroupChatsNotifier`
- Capture the scholar's id and display name (`StudentModel.fullName`) on init.
- Subscribe to `groupChatsStream()`; on each emission:
  - Filter to groups whose `memberIds` contains my id.
  - Resolve member names via `fetchUsersByIds` (cached across emissions) and build
    `GroupChatMember`s (`memberCount` becomes correct; the current scholar is
    flagged so the UI can show a "You" badge). Fallback name `'Scholar'` if a user
    doc is missing.
  - Parse messages: `GroupChatMessage(id, senderId, senderName: sender,
    content: text, timestamp: parse(timestamp))`.
- `sendGroupMessage(groupId, content)` — write to Firestore (real id + name) with
  an optimistic local update, replacing the current local-only `'current_user'`
  stub that never persisted.
- Dispose the stream subscription with the notifier.

### 3. Providers in the same file
- `filteredGroupChatsProvider` — drop the `id.contains('applicant')` heuristic;
  the notifier already returns membership-filtered groups, so this returns them
  as-is.
- Add `currentScholarIdProvider` exposing the scholar id for the UI's "is mine"
  and "You" checks.

### 4. `scholar-ui11/lib/features/messaging/screens/messaging_screen.dart`
- Replace the two hardcoded `'current_user'` comparisons — `senderId == 'current_user'`
  (line ~1201) and `member.id == 'current_user'` (line ~518) — with comparisons
  against the real scholar id from `currentScholarIdProvider`.

## Data flow (after changes)

1. Admin creates a group / sends a message → writes `group_chats/{id}` (already works).
2. Scholar app's `groupChatsStream()` emits live → notifier filters to my groups,
   resolves member names, parses messages → UI updates with no restart.
3. Scholar sends → `arrayUnion` on `messages` in the admin-compatible shape →
   admin's `onSnapshot` and other members' streams update live.
4. Own messages render right-aligned (senderId == my id); admin/others left-aligned
   with sender name + avatar initials.

## Out of scope (known limitations)

- Group-message **attachments** (the group composer has no attach button today).
- Per-group **unread counts** (stay at 0).
- The unused **Cloud Functions** group-chat implementation.
- Scholars **creating** groups or managing membership (admin-only, unchanged).

## Testing / verification

- Static: `flutter analyze` on `scholar-ui11` is clean for the changed files.
- Manual (the real check):
  1. Admin creates a group including a known scholar id; admin sends a message.
  2. Scholar app (logged in as that scholar) shows the group under **Groups**,
     opens it, and sees the admin message live.
  3. Scholar sends a message; it appears right-aligned for the scholar and shows
     up live in the admin thread and for other members.
  4. Member info sheet lists members by real name/school/program with a "You"
     badge on the current scholar.
  5. A scholar NOT in a group does not see it.
