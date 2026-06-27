import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/core/models/group_chat_model.dart';
import 'package:iskonnectttt/core/models/message_model.dart';
import 'package:iskonnectttt/core/services/scholar_firestore_service.dart';
import 'package:uuid/uuid.dart';

class MessagingNotifier extends StateNotifier<List<MessageModel>> {
  MessagingNotifier() : super(const []) {
    _loadFromFirestore();
  }

  Future<void> _loadFromFirestore() async {
    try {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) return;

      final records = await ScholarFirestoreService.fetchMessages(studentId);
      if (records.isEmpty) return;

      state = records.map((record) {
        final fromUserId = record['fromUserId']?.toString();
        return MessageModel(
          id: record['id']?.toString() ?? const Uuid().v4(),
          content: record['body']?.toString() ?? record['content']?.toString() ?? '',
          timestamp: ScholarFirestoreService.parseDateTime(record['createdAt'] ?? record['timestamp']),
          isFromStudent: fromUserId == studentId,
          status: record['status']?.toString() ?? (fromUserId == studentId ? 'Sent' : 'Seen'),
          attachmentUrl: record['attachmentUrl']?.toString(),
          attachmentName: record['attachmentName']?.toString(),
        );
      }).toList();
    } catch (_) {}
  }

  void sendMessage(String content, {String? attachmentUrl, String? attachmentName}) {
    final message = MessageModel(
      id: const Uuid().v4(),
      content: content,
      timestamp: DateTime.now(),
      isFromStudent: true,
      status: 'Sent',
      attachmentUrl: attachmentUrl,
      attachmentName: attachmentName,
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
      );
    } catch (_) {
      // Local state already has the message.
    }
  }

  void markAsRead(String id) {
    state = state.map((message) {
      if (message.id == id && !message.isFromStudent) {
        return message.copyWith(status: 'Seen');
      }
      return message;
    }).toList();
  }

  bool get hasUnreadMessages {
    return state.any((message) => !message.isFromStudent && message.status == 'Sent');
  }
}

final messagingProvider = StateNotifierProvider<MessagingNotifier, List<MessageModel>>((ref) {
  return MessagingNotifier();
});

final messagesProvider = messagingProvider;

final hasUnreadMessagesProvider = Provider<bool>((ref) {
  return ref.watch(messagingProvider.notifier).hasUnreadMessages;
});

final unreadMessagesCountProvider = Provider<int>((ref) {
  final messages = ref.watch(messagingProvider);
  return messages.where((message) => !message.isFromStudent && message.status == 'Sent').length;
});

class GroupChatsNotifier extends StateNotifier<List<GroupChat>> {
  GroupChatsNotifier() : super(const []) {
    _init();
  }

  String? _myId;
  String _myName = 'You';
  StreamSubscription<List<Map<String, dynamic>>>? _subscription;

  // Resolved member display data, keyed by user id, cached across emissions so
  // each `users` lookup happens at most once per member.
  final Map<String, GroupChatMember> _memberCache = {};

  String get currentUserId => _myId ?? '';

  Future<void> _init() async {
    _myId = await ScholarFirestoreService.currentStudentId();
    final myId = _myId;
    if (myId != null) {
      final users = await ScholarFirestoreService.fetchUsersByIds([myId]);
      final me = users[myId];
      if (me != null) _myName = _displayName(me);
    }
    _subscription = ScholarFirestoreService.groupChatsStream().listen(_handleRecords);
  }

  Future<void> _handleRecords(List<Map<String, dynamic>> records) async {
    final myId = _myId;
    if (myId == null) {
      state = const [];
      return;
    }

    // Only groups this scholar is a member of.
    final mine = records.where((record) {
      final ids = _memberIdsOf(record);
      return ids.contains(myId);
    }).toList();

    // Resolve any member ids we haven't cached yet.
    final needed = <String>{};
    for (final record in mine) {
      for (final id in _memberIdsOf(record)) {
        if (!_memberCache.containsKey(id)) needed.add(id);
      }
    }
    if (needed.isNotEmpty) {
      final users = await ScholarFirestoreService.fetchUsersByIds(needed.toList());
      for (final id in needed) {
        final data = users[id];
        _memberCache[id] = GroupChatMember(
          id: id,
          name: data != null ? _displayName(data) : 'Scholar',
          school: data?['schoolName']?.toString() ?? '',
          program: data?['academicProgram']?.toString() ?? '',
        );
      }
    }

    final groups = mine.map(_toGroupChat).toList();
    groups.sort((a, b) {
      final aTime = a.lastMessage?.timestamp ?? a.createdAt;
      final bTime = b.lastMessage?.timestamp ?? b.createdAt;
      return bTime.compareTo(aTime);
    });
    if (mounted) state = groups;
  }

  List<String> _memberIdsOf(Map<String, dynamic> record) =>
      (record['memberIds'] as List?)?.map((e) => e.toString()).toList() ?? const [];

  GroupChat _toGroupChat(Map<String, dynamic> record) {
    final memberIds = _memberIdsOf(record);
    final members = memberIds
        .map((id) =>
            _memberCache[id] ??
            GroupChatMember(id: id, name: 'Scholar', school: '', program: ''))
        .toList();

    final messages = ((record['messages'] as List?) ?? const [])
        .map((m) => Map<String, dynamic>.from(m as Map))
        .map((map) => GroupChatMessage(
              id: map['id']?.toString(),
              senderId: map['senderId']?.toString() ?? '',
              senderName: map['sender']?.toString() ?? 'Unknown',
              content: map['text']?.toString() ?? '',
              timestamp: ScholarFirestoreService.parseDateTime(map['timestamp']),
            ))
        .toList()
      ..sort((a, b) => a.timestamp.compareTo(b.timestamp));

    return GroupChat(
      id: record['id']?.toString(),
      name: record['name']?.toString() ?? 'Group Chat',
      description: record['description']?.toString(),
      avatarUrl: record['avatarUrl']?.toString(),
      members: members,
      messages: messages,
      createdAt: ScholarFirestoreService.parseDateTime(record['createdAt']),
      createdBy: record['createdBy']?.toString() ?? 'admin',
      isSchoolGroup: record['isSchoolGroup'] ?? true,
    );
  }

  String _displayName(Map<String, dynamic> data) {
    final parts = <String>[];
    for (final key in ['firstName', 'middleName', 'lastName']) {
      final value = data[key]?.toString().trim() ?? '';
      if (value.isNotEmpty) parts.add(value);
    }
    final name = parts.join(' ').trim();
    return name.isEmpty ? 'Scholar' : name;
  }

  void sendGroupMessage(String groupId, String content,
      {String? attachmentUrl, String? attachmentName}) {
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
        attachmentUrl: attachmentUrl,
        attachmentName: attachmentName,
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
    );
  }

  GroupChat? getGroupById(String id) {
    try {
      return state.firstWhere((group) => group.id == id);
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

final groupChatsProvider = StateNotifierProvider<GroupChatsNotifier, List<GroupChat>>((ref) {
  return GroupChatsNotifier();
});

final isScholarForMessagingProvider = StateProvider<bool>((ref) => false);

/// The current scholar's id, used by the UI to tell apart messages/members that
/// belong to "me". Resolves once from the logged-in session.
final currentScholarIdProvider = FutureProvider<String?>((ref) async {
  return ScholarFirestoreService.currentStudentId();
});

/// Group chats the current scholar can see. The notifier already filters to
/// groups the scholar is a member of, so this returns them as-is.
final filteredGroupChatsProvider = Provider<List<GroupChat>>((ref) {
  return ref.watch(groupChatsProvider);
});

final groupChatProvider = Provider.family<GroupChat?, String>((ref, groupId) {
  final groups = ref.watch(groupChatsProvider);
  try {
    return groups.firstWhere((group) => group.id == groupId);
  } catch (_) {
    return null;
  }
});

final selectedChatTypeProvider = StateProvider<ChatType>((ref) => ChatType.direct);
final selectedGroupChatIdProvider = StateProvider<String?>((ref) => null);

final allConversationsProvider = Provider<List<ChatConversation>>((ref) {
  final directMessages = ref.watch(messagingProvider);
  final groupChats = ref.watch(filteredGroupChatsProvider);

  final conversations = <ChatConversation>[];

  conversations.add(
    ChatConversation(
      id: 'direct_ced',
      type: ChatType.direct,
      name: 'City Education Department',
      subtitle: 'CED Staff',
      lastActivity: directMessages.isNotEmpty ? directMessages.last.timestamp : DateTime.now(),
      unreadCount: directMessages.where((message) => !message.isFromStudent && message.status == 'Sent').length,
      lastMessagePreview: directMessages.isNotEmpty ? directMessages.last.content : 'Start a conversation',
    ),
  );

  for (final group in groupChats) {
    conversations.add(
      ChatConversation(
        id: group.id,
        type: ChatType.group,
        name: group.name,
        subtitle: '${group.memberCount} members',
        lastActivity: group.lastMessage?.timestamp ?? group.createdAt,
        unreadCount: 0,
        lastMessagePreview: group.lastMessagePreview,
      ),
    );
  }

  conversations.sort((a, b) => b.lastActivity.compareTo(a.lastActivity));
  return conversations;
});
