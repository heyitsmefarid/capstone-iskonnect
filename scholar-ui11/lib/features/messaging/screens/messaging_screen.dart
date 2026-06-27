import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/formatters.dart';
import 'package:iskonnectttt/core/models/group_chat_model.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/messaging/providers/messaging_provider.dart';
import 'package:iskonnectttt/shared/widgets/loading_widget.dart';

class MessagingScreen extends ConsumerStatefulWidget {
  const MessagingScreen({super.key});

  @override
  ConsumerState<MessagingScreen> createState() => _MessagingScreenState();
}

class _MessagingScreenState extends ConsumerState<MessagingScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String? _selectedGroupId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    // Initialize scholar status after the first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final student = ref.read(currentStudentProvider);
      if (student != null) {
        ref.read(isScholarForMessagingProvider.notifier).state =
            student.isScholar;
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(messagesProvider);
    final groupChats = ref.watch(filteredGroupChatsProvider);
    ref.watch(unreadMessagesCountProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Modern Header - Compact
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _ModernBackButton(
                    onTap: () {
                      if (_selectedGroupId != null) {
                        setState(() => _selectedGroupId = null);
                      } else {
                        context.go('/dashboard');
                      }
                    },
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _selectedGroupId != null
                              ? groupChats
                                    .firstWhere((g) => g.id == _selectedGroupId)
                                    .name
                              : 'Messages',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.3,
                          ),
                        ),
                        Text(
                          _selectedGroupId != null
                              ? '${groupChats.firstWhere((g) => g.id == _selectedGroupId).memberCount} members'
                              : 'Chat with CED & Scholars',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_selectedGroupId != null)
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: AppColors.cardBackground,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.divider),
                      ),
                      child: IconButton(
                        icon: const Icon(Icons.info_outline_rounded, size: 16),
                        onPressed: () => _showGroupInfo(
                          context,
                          groupChats.firstWhere(
                            (g) => g.id == _selectedGroupId,
                          ),
                        ),
                        color: AppColors.textPrimary,
                        padding: EdgeInsets.zero,
                      ),
                    ),
                ],
              ).animate().fadeIn(duration: 400.ms).slideX(begin: -0.1),
            ),

            // Show either conversations list or chat view
            if (_selectedGroupId == null) ...[
              // Modern Tab Bar - Compact
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicator: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.mint, AppColors.teal],
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  labelColor: Colors.white,
                  unselectedLabelColor: AppColors.textSecondary,
                  labelStyle: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  dividerColor: Colors.transparent,
                  indicatorSize: TabBarIndicatorSize.tab,
                  tabs: const [
                    Tab(text: 'Direct'),
                    Tab(text: 'Groups'),
                  ],
                ),
              ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
              const SizedBox(height: 16),

              // Tab Content
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    // Direct Messages Tab
                    _buildDirectMessagesTab(messages),
                    // Group Chats Tab
                    _buildGroupChatsTab(groupChats),
                  ],
                ),
              ),
            ] else ...[
              // Group Chat View
              Expanded(
                child: _GroupChatView(
                  groupId: _selectedGroupId!,
                  onBack: () => setState(() => _selectedGroupId = null),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDirectMessagesTab(List messages) {
    return Column(
      children: [
        // Modern CED Contact Card - Compact
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.mint, AppColors.teal],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.primary, width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: AppColors.mint.withValues(alpha: 0.2),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.support_agent_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'City Education Dept.',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        'Calapan City',
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.white.withValues(alpha: 0.8),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4ADE80).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: Color(0xFF4ADE80),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Text(
                        'Online',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF4ADE80),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),

        // Messages List
        Expanded(
          child: messages.isEmpty
              ? const EmptyStateWidget(
                  icon: Icons.chat_bubble_outline_rounded,
                  title: 'No Messages Yet',
                  message: 'Start a conversation with CED staff.',
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  reverse: true,
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final message = messages[messages.length - 1 - index];
                    final bool isFromUser = message.isFromStudent;

                    return _MessageBubble(
                      message: message.content,
                      time: message.timestamp,
                      isFromUser: isFromUser,
                      status: message.status,
                    );
                  },
                ),
        ),

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
            onSend: (message, {String? attachmentUrl, String? attachmentName}) {
              ref
                  .read(messagesProvider.notifier)
                  .sendMessage(
                    message,
                    attachmentUrl: attachmentUrl,
                    attachmentName: attachmentName,
                  );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildGroupChatsTab(List<GroupChat> groupChats) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      itemCount: groupChats.length,
      itemBuilder: (context, index) {
        final group = groupChats[index];
        return _GroupChatTile(
          group: group,
          onTap: () => setState(() => _selectedGroupId = group.id),
        );
      },
    );
  }

  void _showGroupInfo(BuildContext context, GroupChat group) {
    final myId = ref.read(currentScholarIdProvider).value;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        minChildSize: 0.5,
        builder: (context, scrollController) => Container(
          decoration: const BoxDecoration(
            color: AppColors.cardBackground,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.divider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              // Group Avatar
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: group.isSchoolGroup
                      ? AppColors.primaryGradient
                      : AppColors.accentGradient,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Icon(
                  group.isSchoolGroup ? Icons.school : Icons.groups,
                  color: Colors.white,
                  size: 40,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                group.name,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${group.memberCount} members',
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
              if (group.description != null) ...[
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Text(
                    group.description!,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
              const SizedBox(height: 24),
              const Divider(),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(
                      Icons.people_outline,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Members',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${group.memberCount}',
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: group.members.length,
                  itemBuilder: (context, index) {
                    final member = group.members[index];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: member.isAdmin
                            ? AppColors.primary
                            : AppColors.surfaceVariant,
                        child: Text(
                          member.initials,
                          style: TextStyle(
                            color: member.isAdmin
                                ? Colors.white
                                : AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      title: Row(
                        children: [
                          Flexible(
                            child: Text(
                              member.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w500,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (member.isAdmin) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Text(
                                'Admin',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                          ],
                          if (member.id == myId) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.success.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Text(
                                'You',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.success,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      subtitle: Text(
                        '${member.program} • ${member.school}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textTertiary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final String message;
  final DateTime time;
  final bool isFromUser;
  final String status;

  const _MessageBubble({
    required this.message,
    required this.time,
    required this.isFromUser,
    required this.status,
  });

  IconData _getStatusIcon() {
    switch (status.toLowerCase()) {
      case 'sent':
        return Icons.check;
      case 'seen':
        return Icons.done_all;
      case 'replied':
        return Icons.done_all;
      default:
        return Icons.schedule;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: isFromUser
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isFromUser) ...[
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.support_agent,
                color: Colors.white,
                size: 18,
              ),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isFromUser
                    ? AppColors.primary
                    : AppColors.cardBackground,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(20),
                  topRight: const Radius.circular(20),
                  bottomLeft: Radius.circular(isFromUser ? 20 : 4),
                  bottomRight: Radius.circular(isFromUser ? 4 : 20),
                ),
                border: isFromUser
                    ? null
                    : Border.all(color: AppColors.divider),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.cardShadow.withValues(alpha: 0.05),
                    blurRadius: 5,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: isFromUser
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  Text(
                    message,
                    style: TextStyle(
                      fontSize: 14,
                      color: isFromUser ? Colors.white : AppColors.textPrimary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        Formatters.formatTime(time),
                        style: TextStyle(
                          fontSize: 10,
                          color: isFromUser
                              ? Colors.white.withValues(alpha: 0.7)
                              : AppColors.textTertiary,
                        ),
                      ),
                      if (isFromUser) ...[
                        const SizedBox(width: 4),
                        Icon(
                          _getStatusIcon(),
                          size: 14,
                          color:
                              status.toLowerCase() == 'seen' ||
                                  status.toLowerCase() == 'replied'
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.7),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (isFromUser) const SizedBox(width: 40),
        ],
      ),
    );
  }
}

class _MessageInput extends StatefulWidget {
  final Function(String, {String? attachmentUrl, String? attachmentName})
  onSend;

  const _MessageInput({required this.onSend});

  @override
  State<_MessageInput> createState() => _MessageInputState();
}

class _MessageInputState extends State<_MessageInput> {
  final _controller = TextEditingController();
  bool _canSend = false;
  String? _attachmentPath;
  String? _attachmentName;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_updateSendState);
  }

  void _updateSendState() {
    setState(() {
      _canSend = _controller.text.trim().isNotEmpty || _attachmentPath != null;
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleSend() {
    final message = _controller.text.trim();
    if (message.isNotEmpty || _attachmentPath != null) {
      widget.onSend(
        message.isEmpty ? '📎 Sent an attachment' : message,
        attachmentUrl: _attachmentPath,
        attachmentName: _attachmentName,
      );
      _controller.clear();
      setState(() {
        _attachmentPath = null;
        _attachmentName = null;
      });
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _attachmentPath = image.path;
        _attachmentName = image.name;
      });
      _updateSendState();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Image selected: ${image.name}'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles();
    if (result != null && result.files.isNotEmpty) {
      final file = result.files.first;
      setState(() {
        _attachmentPath = file.path;
        _attachmentName = file.name;
      });
      _updateSendState();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('File selected: ${file.name}'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
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
                    _pickImage();
                  },
                ),
                _AttachmentOption(
                  icon: Icons.insert_drive_file,
                  label: 'Document',
                  color: AppColors.secondary,
                  onTap: () {
                    Navigator.pop(context);
                    _pickFile();
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

  void _clearAttachment() {
    setState(() {
      _attachmentPath = null;
      _attachmentName = null;
    });
    _updateSendState();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Attachment Preview
          if (_attachmentPath != null)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    _attachmentName?.contains('.') == true &&
                            ['jpg', 'jpeg', 'png', 'gif'].contains(
                              _attachmentName!.split('.').last.toLowerCase(),
                            )
                        ? Icons.image
                        : Icons.insert_drive_file,
                    color: AppColors.primary,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _attachmentName ?? 'Attachment',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textPrimary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: _clearAttachment,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    color: AppColors.textSecondary,
                  ),
                ],
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
                    icon: Icon(
                      Icons.send_rounded,
                      color: _canSend ? Colors.white : AppColors.textTertiary,
                    ),
                    onPressed: _canSend ? _handleSend : null,
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

// Attachment Option Widget
class _AttachmentOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _AttachmentOption({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

// Group Chat Tile Widget
class _GroupChatTile extends StatelessWidget {
  final GroupChat group;
  final VoidCallback onTap;

  const _GroupChatTile({required this.group, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.cardShadow.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: group.isSchoolGroup
                        ? AppColors.primaryGradient
                        : AppColors.accentGradient,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    group.isSchoolGroup ? Icons.school : Icons.groups,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              group.name,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            group.lastMessage != null
                                ? Formatters.formatRelativeTime(
                                    group.lastMessage!.timestamp,
                                  )
                                : '',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textTertiary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${group.memberCount} members',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        group.lastMessagePreview,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textTertiary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Group Chat View Widget
class _GroupChatView extends ConsumerStatefulWidget {
  final String groupId;
  final VoidCallback onBack;

  const _GroupChatView({required this.groupId, required this.onBack});

  @override
  ConsumerState<_GroupChatView> createState() => _GroupChatViewState();
}

class _GroupChatViewState extends ConsumerState<_GroupChatView> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  bool _canSend = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      setState(() {
        _canSend = _controller.text.trim().isNotEmpty;
      });
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _sendMessage() {
    final message = _controller.text.trim();
    if (message.isNotEmpty) {
      ref
          .read(groupChatsProvider.notifier)
          .sendGroupMessage(widget.groupId, message);
      _controller.clear();
      // Scroll to bottom after sending
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
  }

  @override
  Widget build(BuildContext context) {
    final group = ref.watch(groupChatProvider(widget.groupId));
    final myId = ref.watch(currentScholarIdProvider).value;

    if (group == null) {
      return const Center(child: Text('Group not found'));
    }

    return Column(
      children: [
        // Messages List
        Expanded(
          child: group.messages.isEmpty
              ? const EmptyStateWidget(
                  icon: Icons.chat_bubble_outline,
                  title: 'No Messages Yet',
                  message: 'Start the conversation!',
                )
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 10,
                  ),
                  itemCount: group.messages.length,
                  itemBuilder: (context, index) {
                    final message = group.messages[index];
                    final bool isFromUser =
                        myId != null && message.senderId == myId;
                    final showSenderName =
                        !isFromUser &&
                        (index == 0 ||
                            group.messages[index - 1].senderId !=
                                message.senderId);

                    return _GroupMessageBubble(
                      message: message,
                      isFromUser: isFromUser,
                      showSenderName: showSenderName,
                    );
                  },
                ),
        ),

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
          child: SafeArea(
            child: Row(
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
                              hintText: 'Type a message...',
                              hintStyle: TextStyle(
                                color: AppColors.textTertiary,
                                fontSize: 14,
                              ),
                              border: InputBorder.none,
                              contentPadding: EdgeInsets.symmetric(
                                vertical: 12,
                              ),
                            ),
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 4,
                            minLines: 1,
                            textCapitalization: TextCapitalization.sentences,
                            onSubmitted: (_) => _sendMessage(),
                          ),
                        ),
                        const SizedBox(width: 8),
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
                      icon: Icon(
                        Icons.send_rounded,
                        color: _canSend ? Colors.white : AppColors.textTertiary,
                      ),
                      onPressed: _canSend ? _sendMessage : null,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// Group Message Bubble Widget
class _GroupMessageBubble extends StatelessWidget {
  final GroupChatMessage message;
  final bool isFromUser;
  final bool showSenderName;

  const _GroupMessageBubble({
    required this.message,
    required this.isFromUser,
    required this.showSenderName,
  });

  Color _getSenderColor(String senderId) {
    // Generate consistent color based on sender ID
    final colors = [
      const Color(0xFF6366F1), // Indigo
      const Color(0xFF8B5CF6), // Violet
      const Color(0xFFEC4899), // Pink
      const Color(0xFF14B8A6), // Teal
      const Color(0xFFF97316), // Orange
      const Color(0xFF22C55E), // Green
      const Color(0xFF3B82F6), // Blue
    ];
    final index = senderId.hashCode.abs() % colors.length;
    return colors[index];
  }

  @override
  Widget build(BuildContext context) {
    if (message.isSystemMessage) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 12),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              message.content,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final senderColor = _getSenderColor(message.senderId);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: isFromUser
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isFromUser) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: senderColor,
              child: Text(
                message.senderInitials,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.7,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isFromUser
                    ? AppColors.primary
                    : AppColors.cardBackground,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(18),
                  topRight: const Radius.circular(18),
                  bottomLeft: Radius.circular(isFromUser ? 18 : 4),
                  bottomRight: Radius.circular(isFromUser ? 4 : 18),
                ),
                border: isFromUser
                    ? null
                    : Border.all(color: AppColors.divider),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.cardShadow.withValues(alpha: 0.05),
                    blurRadius: 5,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: isFromUser
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  if (showSenderName && !isFromUser)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        message.senderName.split(' ').first,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: senderColor,
                        ),
                      ),
                    ),
                  Text(
                    message.content,
                    style: TextStyle(
                      fontSize: 14,
                      color: isFromUser ? Colors.white : AppColors.textPrimary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    Formatters.formatTime(message.timestamp),
                    style: TextStyle(
                      fontSize: 10,
                      color: isFromUser
                          ? Colors.white.withValues(alpha: 0.7)
                          : AppColors.textTertiary,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isFromUser) const SizedBox(width: 32),
        ],
      ),
    );
  }
}

// Modern Back Button Widget
class _ModernBackButton extends StatelessWidget {
  final VoidCallback onTap;

  const _ModernBackButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: const Center(
            child: Icon(
              Icons.arrow_back_ios_new_rounded,
              size: 18,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
