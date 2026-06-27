import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import Swal from 'sweetalert2';
import { formatPersonName } from '../utils/nameFormat';
import {
  MessageCircle,
  Search,
  Send,
  Users,
  Plus,
  UserPlus,
  PencilLine,
} from 'lucide-react';

const MESSAGE_NOTIFICATION_KEY = 'ced_unread_messages';

// Statuses that qualify as "scholars" (not applicants)
const SCHOLAR_STATUSES = ['approved', 'active', 'on-hold', 'graduated', 'terminated'];

export default function Messages() {
  const {
    applicants,
    messages: firestoreMessages,
    sendDirectMessage,
    groupChats,
    createGroupChat,
    sendGroupMessage,
    addGroupMembers,
  } = useApp();
  const { onMenuClick } = useOutletContext() || {};

  // Messaging is restricted to scholars only (applicants/pending are excluded).
  // Only scholars synced to Firestore (with a firestoreId) can send/receive.
  const allStudents = useMemo(
    () => applicants.filter((s) => SCHOLAR_STATUSES.includes(s.status) && s.firestoreId),
    [applicants]
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [composerText, setComposerText] = useState('');

  // A thread is either { type: 'group', id: <group firestoreId> } or
  // { type: 'direct', id: <student.id> }. Null until one is auto-selected.
  const [selectedThread, setSelectedThread] = useState(null);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', members: [] });
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatForm, setNewChatForm] = useState({ receiverId: '', message: '' });

  const [showAddMembers, setShowAddMembers] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState([]);

  useEffect(() => {
    window.localStorage.setItem(MESSAGE_NOTIFICATION_KEY, '0');
    window.dispatchEvent(new Event('message-notifications-updated'));
  }, []);

  const getStudentById = (id) => applicants.find((student) => student.id === id);
  const getStudentByFirestoreId = (fid) => applicants.find((student) => student.firestoreId === fid);
  const formatStudentName = (student) => formatPersonName(student);

  // Direct messages derived from the shared Firestore `messages` collection.
  const directMessages = useMemo(() => {
    return (firestoreMessages || [])
      .filter((m) => m.fromUserId === 'admin' || m.toUserId === 'admin')
      .map((m) => {
        const studentFid = m.fromUserId === 'admin' ? m.toUserId : m.fromUserId;
        const student = applicants.find((s) => s.firestoreId === studentFid);
        if (!student) return null;
        return {
          id: m.firestoreId,
          toId: student.id,
          studentFirestoreId: studentFid,
          sender: m.fromUserId === 'admin' ? 'Admin' : formatPersonName(student),
          text: m.body || m.text || '',
          timestamp: m.createdAt || new Date().toISOString(),
        };
      })
      .filter(Boolean);
  }, [firestoreMessages, applicants]);

  const directConversations = useMemo(() => {
    const grouped = directMessages.reduce((acc, message) => {
      if (!acc[message.toId]) {
        acc[message.toId] = [];
      }
      acc[message.toId].push(message);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([studentId, messages]) => {
        const student = getStudentById(Number(studentId));
        if (!student) return null;

        const sorted = [...messages].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        const lastMessage = sorted[sorted.length - 1];

        return {
          id: student.id,
          type: 'direct',
          name: formatStudentName(student),
          subtitle: student.school,
          lastText: lastMessage?.text || 'No messages yet',
          lastTime: lastMessage?.timestamp || student.createdAt || new Date().toISOString(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
  }, [directMessages, allStudents]);

  const groupConversations = useMemo(() => {
    return groupChats.map((group) => {
      const msgs = group.messages || [];
      const lastMessage = msgs[msgs.length - 1];
      const memberCount = (group.memberIds || []).length;
      return {
        id: group.firestoreId,
        type: 'group',
        name: group.name,
        subtitle: `${memberCount} member(s)`,
        lastText: lastMessage?.text || 'No messages yet',
        lastTime: lastMessage?.timestamp || new Date(group.createdAt || Date.now()).toISOString(),
      };
    });
  }, [groupChats]);

  const filteredThreads = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch = (thread) => {
      if (!search) return true;
      return (
        thread.name.toLowerCase().includes(search) ||
        thread.subtitle.toLowerCase().includes(search) ||
        thread.lastText.toLowerCase().includes(search)
      );
    };

    return {
      groups: groupConversations.filter(matchesSearch),
      directs: directConversations.filter(matchesSearch),
    };
  }, [groupConversations, directConversations, searchTerm]);

  // Auto-select the first available thread once data loads (none selected yet).
  useEffect(() => {
    if (selectedThread) return;
    if (groupConversations.length > 0) {
      setSelectedThread({ type: 'group', id: groupConversations[0].id });
    } else if (directConversations.length > 0) {
      setSelectedThread({ type: 'direct', id: directConversations[0].id });
    }
  }, [selectedThread, groupConversations, directConversations]);

  const selectedGroup =
    selectedThread?.type === 'group'
      ? groupChats.find((group) => group.firestoreId === selectedThread.id)
      : null;

  const threadMessages = useMemo(() => {
    if (!selectedThread) return [];
    if (selectedThread.type === 'group') {
      return [...(selectedGroup?.messages || [])].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
    }

    return directMessages
      .filter((msg) => msg.toId === selectedThread.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [selectedThread, selectedGroup, directMessages]);

  const selectedDirectStudent =
    selectedThread?.type === 'direct' ? getStudentById(selectedThread.id) : null;

  const selectedTitle = !selectedThread
    ? 'No conversation selected'
    : selectedThread.type === 'group'
      ? selectedGroup?.name || 'Group Chat'
      : selectedDirectStudent
        ? formatStudentName(selectedDirectStudent)
        : 'Student';

  const selectedSubtitle = !selectedThread
    ? 'Pick a chat or start a new one'
    : selectedThread.type === 'group'
      ? `${(selectedGroup?.memberIds || []).length} member(s)`
      : selectedDirectStudent?.school || '';

  const studentsWithoutConversation = useMemo(
    () =>
      allStudents.filter(
        (student) => !directConversations.some((thread) => thread.id === student.id)
      ),
    [allStudents, directConversations]
  );

  const selectedGroupMembers = useMemo(
    () =>
      groupForm.members
        .map((fid) => getStudentByFirestoreId(fid))
        .filter(Boolean),
    [groupForm.members, allStudents]
  );

  const availableMembersForSelectedGroup = useMemo(
    () =>
      selectedGroup
        ? allStudents.filter((student) => !(selectedGroup.memberIds || []).includes(student.firestoreId))
        : [],
    [allStudents, selectedGroup]
  );

  const toggleGroupMember = (firestoreId) => {
    setGroupForm((prev) => {
      const exists = prev.members.includes(firestoreId);
      return {
        ...prev,
        members: exists
          ? prev.members.filter((id) => id !== firestoreId)
          : [...prev.members, firestoreId],
      };
    });
  };

  const handleToggleNewChat = () => {
    setShowNewChat((prev) => !prev);
    setShowCreateGroup(false);
  };

  const handleToggleCreateGroup = () => {
    setShowCreateGroup((prev) => !prev);
    setShowNewChat(false);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();

    const cleanName = groupForm.name.trim();
    if (!cleanName || groupForm.members.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Group Data',
        text: 'Enter a group name and add at least one member.',
      });
      return;
    }

    try {
      const newGroupId = await createGroupChat({
        name: cleanName,
        memberIds: groupForm.members,
      });
      if (newGroupId) {
        setSelectedThread({ type: 'group', id: newGroupId });
      }
      setGroupForm({ name: '', members: [] });
      setShowCreateGroup(false);

      Swal.fire({
        icon: 'success',
        title: 'Group Created',
        text: `${cleanName} is ready for messaging.`,
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Could Not Create Group',
        text: 'Please try again.',
      });
    }
  };

  const toggleMemberToAdd = (firestoreId) => {
    setMembersToAdd((prev) =>
      prev.includes(firestoreId)
        ? prev.filter((id) => id !== firestoreId)
        : [...prev, firestoreId]
    );
  };

  const handleAddMembersToSelectedGroup = async () => {
    if (!selectedGroup || membersToAdd.length === 0) return;

    try {
      await addGroupMembers(selectedGroup.firestoreId, membersToAdd);
      setMembersToAdd([]);
      setShowAddMembers(false);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Could Not Add Members',
        text: 'Please try again.',
      });
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    const text = composerText.trim();
    if (!text || !selectedThread) return;

    if (selectedThread.type === 'group') {
      if (!selectedGroup) return;
      try {
        await sendGroupMessage(selectedGroup.firestoreId, text);
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Cannot Send',
          text: 'Message could not be sent to the group.',
        });
        return;
      }
    } else {
      const student = getStudentById(selectedThread.id);
      if (student?.firestoreId) {
        sendDirectMessage(student.firestoreId, text);
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Cannot Send',
          text: 'This student is not linked to a synced account yet.',
        });
        return;
      }
    }

    setComposerText('');
  };

  const handleStartNewConversation = (e) => {
    e.preventDefault();

    const receiverId = Number(newChatForm.receiverId);
    const text = newChatForm.message.trim();

    if (!receiverId || !text) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Select a student and enter a message.',
      });
      return;
    }

    const receiver = getStudentById(receiverId);
    if (!receiver) return;

    if (receiver.firestoreId) {
      sendDirectMessage(receiver.firestoreId, text);
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot Send',
        text: 'This student is not linked to a synced account yet.',
      });
      return;
    }

    setSelectedThread({ type: 'direct', id: receiverId });
    setShowNewChat(false);
    setNewChatForm({ receiverId: '', message: '' });
  };

  return (
    <div className="page messages-page">
      <Header
        title="Messages"
        subtitle="Communicate with scholars — direct and group messaging"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        <div className="messenger-shell">
          <aside className="conversation-panel card">
            <div className="conversation-top">
              <h3>Chats</h3>
              <div className="top-actions">
                <button className={`mini-btn ${showNewChat ? 'active' : ''}`} onClick={handleToggleNewChat}>
                  <PencilLine size={14} />
                  New Chat
                </button>
                <button className={`mini-btn ${showCreateGroup ? 'active' : ''}`} onClick={handleToggleCreateGroup}>
                  <Plus size={14} />
                  Group
                </button>
              </div>
            </div>

            <div className="search-wrap">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search conversations"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="floating-panel-zone">
              {showNewChat && (
              <form className="panel-form" onSubmit={handleStartNewConversation}>
                <div className="panel-form-head">
                  <div className="panel-form-title">Start New Conversation</div>
                  <span className="panel-badge">{studentsWithoutConversation.length} available</span>
                </div>
                <select
                  className="form-input"
                  value={newChatForm.receiverId}
                  onChange={(e) =>
                    setNewChatForm((prev) => ({ ...prev, receiverId: e.target.value }))
                  }
                  required
                >
                  <option value="">Select student</option>
                  {studentsWithoutConversation.map((student) => (
                      <option key={student.id} value={student.id}>
                        {formatStudentName(student)} • {student.school}
                      </option>
                    ))}
                </select>
                {studentsWithoutConversation.length === 0 && (
                  <p className="panel-note">All students already have existing conversations.</p>
                )}
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Type first message"
                  value={newChatForm.message}
                  onChange={(e) =>
                    setNewChatForm((prev) => ({ ...prev, message: e.target.value }))
                  }
                  required
                />
                <div className="panel-actions">
                  <button type="button" className="action-btn compact ghost" onClick={() => setShowNewChat(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="action-btn compact primary" disabled={studentsWithoutConversation.length === 0}>
                    <Send size={14} />
                    Start Chat
                  </button>
                </div>
              </form>
              )}

              {showCreateGroup && (
              <form className="panel-form" onSubmit={handleCreateGroup}>
                <div className="panel-form-head">
                  <div className="panel-form-title">Create Group Chat</div>
                  <span className="panel-badge">{groupForm.members.length} selected</span>
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Group name"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  required
                />
                <p className="panel-note">Select scholars to include in this chat group (applicants excluded).</p>
                <div className="member-picker">
                  {allStudents.length === 0 && (
                    <p className="panel-note">No synced scholars available yet.</p>
                  )}
                  {allStudents.slice(0, 12).map((student) => (
                    <label key={student.firestoreId} className="member-option">
                      <input
                        type="checkbox"
                        checked={groupForm.members.includes(student.firestoreId)}
                        onChange={() => toggleGroupMember(student.firestoreId)}
                      />
                      <span>{formatStudentName(student)}</span>
                    </label>
                  ))}
                </div>
                {selectedGroupMembers.length > 0 && (
                  <div className="member-preview-tags">
                    {selectedGroupMembers.slice(0, 5).map((member) => (
                      <span key={member.id} className="mini-tag">{formatStudentName(member)}</span>
                    ))}
                    {selectedGroupMembers.length > 5 && (
                      <span className="mini-tag muted">+{selectedGroupMembers.length - 5} more</span>
                    )}
                  </div>
                )}
                <div className="panel-actions">
                  <button type="button" className="action-btn compact ghost" onClick={() => setShowCreateGroup(false)}>
                    Close
                  </button>
                  <button type="submit" className="action-btn compact primary">
                    <Users size={14} />
                    Create Group
                  </button>
                </div>
              </form>
              )}
            </div>

            <div className="conversation-list">
              <p className="section-label">Group Chats ({filteredThreads.groups.length})</p>
              {filteredThreads.groups.map((thread) => {
                const isActive =
                  selectedThread?.id === thread.id && selectedThread?.type === thread.type;
                return (
                  <button
                    key={`${thread.type}-${thread.id}`}
                    className={`thread-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedThread({ type: thread.type, id: thread.id })}
                  >
                    <div className="thread-avatar">
                      <Users size={14} />
                    </div>
                    <div className="thread-content">
                      <div className="thread-head">
                        <strong>{thread.name}</strong>
                        <span>{new Date(thread.lastTime).toLocaleDateString()}</span>
                      </div>
                      <p>{thread.lastText}</p>
                      <small>{thread.subtitle}</small>
                    </div>
                  </button>
                );
              })}

              <p className="section-label">Student Conversations ({filteredThreads.directs.length})</p>
              {filteredThreads.directs.map((thread) => {
                const isActive =
                  selectedThread?.id === thread.id && selectedThread?.type === thread.type;
                return (
                  <button
                    key={`${thread.type}-${thread.id}`}
                    className={`thread-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedThread({ type: thread.type, id: thread.id })}
                  >
                    <div className="thread-avatar">
                      <MessageCircle size={14} />
                    </div>
                    <div className="thread-content">
                      <div className="thread-head">
                        <strong>{thread.name}</strong>
                        <span>{new Date(thread.lastTime).toLocaleDateString()}</span>
                      </div>
                      <p>{thread.lastText}</p>
                      <small>{thread.subtitle}</small>
                    </div>
                  </button>
                );
              })}

              {filteredThreads.groups.length === 0 && filteredThreads.directs.length === 0 && (
                <p className="empty-list">No conversations found.</p>
              )}
            </div>
          </aside>

          <section className="chat-panel card">
            <div className="chat-header">
              <div>
                <h3>{selectedTitle}</h3>
                <p>{selectedSubtitle}</p>
              </div>
              {selectedThread?.type === 'group' && (
                <button className="mini-btn" onClick={() => setShowAddMembers((prev) => !prev)}>
                  <UserPlus size={14} />
                  Add Members
                </button>
              )}
            </div>

            {selectedThread?.type === 'group' && showAddMembers && selectedGroup && (
              <div className="panel-form panel-form-wide">
                <div className="panel-form-head">
                  <div className="panel-form-title">Add Members to {selectedGroup.name}</div>
                  <span className="panel-badge">{membersToAdd.length} selected</span>
                </div>
                <p className="panel-note">Choose students to add to this group chat.</p>
                <div className="member-picker compact">
                  {availableMembersForSelectedGroup.slice(0, 10).map((student) => (
                      <label key={student.firestoreId} className="member-option">
                        <input
                          type="checkbox"
                          checked={membersToAdd.includes(student.firestoreId)}
                          onChange={() => toggleMemberToAdd(student.firestoreId)}
                        />
                        <span>{formatStudentName(student)}</span>
                      </label>
                    ))}
                </div>
                {availableMembersForSelectedGroup.length === 0 && (
                  <p className="panel-note">All students are already in this group.</p>
                )}
                <div className="panel-actions">
                  <button type="button" className="action-btn compact ghost" onClick={() => setShowAddMembers(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="action-btn compact primary"
                    onClick={handleAddMembersToSelectedGroup}
                    disabled={membersToAdd.length === 0}
                  >
                    <UserPlus size={14} />
                    Save Members
                  </button>
                </div>
              </div>
            )}

            <div className="messages-view">
              {threadMessages.length === 0 && <p className="empty-state">No messages yet.</p>}
              {threadMessages.map((msg) => (
                <div key={msg.id} className={`bubble-row ${msg.sender === 'Admin' ? 'mine' : ''}`}>
                  <div className="bubble">
                    <div className="bubble-text">{msg.text}</div>
                    <div className="bubble-meta">
                      {msg.sender} • {new Date(msg.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form className="composer" onSubmit={handleSendMessage}>
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
                required
              />
              <button type="submit" className="send-btn">
                <Send size={16} />
              </button>
            </form>
          </section>
        </div>
      </div>

      <style jsx>{`
        .messages-page {
          background: var(--bg-primary);
        }

        .messenger-shell {
          display: grid;
          grid-template-columns: minmax(340px, 390px) minmax(0, 1fr);
          gap: 10px;
          min-height: calc(100vh - 170px);
        }

        .conversation-panel,
        .chat-panel {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-lg);
          border-radius: var(--radius);
        }

        .conversation-panel {
          background: var(--card-bg);
          position: relative;
          overflow: hidden;
        }

        .chat-panel {
          background: var(--card-bg);
          overflow: hidden;
        }

        .conversation-top,
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        h3 {
          margin: 0;
          font-size: 1rem;
          color: var(--text-primary);
        }

        .chat-header p {
          margin: 2px 0 0;
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .mini-btn {
          border: 1px solid var(--border-color);
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mini-btn:hover {
          border-color: var(--primary);
          background-color: var(--hover-bg);
        }

        .mini-btn.active {
          background: rgba(45, 149, 150, 0.18);
          border-color: var(--primary);
          color: var(--primary-light);
        }

        .search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--input-bg);
          padding: 8px 10px;
        }

        .search-wrap input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.83rem;
        }

        .floating-panel-zone {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .panel-form {
          border: 1px solid rgba(45, 149, 150, 0.3);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: var(--bg-secondary);
          box-shadow: var(--shadow-md);
        }

        .panel-form-wide {
          margin-bottom: 4px;
        }

        .panel-form-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0;
        }

        .panel-form-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .panel-badge {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--primary-light);
          background: rgba(45, 149, 150, 0.15);
          border: 1px solid rgba(45, 149, 150, 0.3);
          border-radius: 999px;
          padding: 3px 8px;
        }

        .panel-note {
          margin: -2px 0 0;
          font-size: 0.74rem;
          color: var(--text-secondary);
        }

        .panel-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .form-input {
          width: 100%;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background-color: var(--input-bg);
          color: var(--text-primary);
          padding: 8px 10px;
          font-size: 0.83rem;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 2px var(--focus-ring);
        }

        .member-picker {
          max-height: 120px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .member-picker.compact {
          max-height: 110px;
        }

        .member-option {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          font-size: 0.78rem;
          padding: 6px;
          border-radius: 6px;
          border: 1px solid transparent;
          cursor: pointer;
        }

        .member-option:hover {
          background: var(--hover-bg);
          border-color: rgba(45, 149, 150, 0.3);
        }

        .action-btn.compact {
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-radius: 8px;
          padding: 7px 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          font-size: 0.78rem;
          transition: all 0.2s ease;
        }

        .action-btn.compact.ghost {
          background: transparent;
        }

        .action-btn.compact.primary {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          border-color: transparent;
          color: #fff;
        }

        .action-btn.compact:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .member-preview-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .mini-tag {
          font-size: 0.7rem;
          color: var(--primary-light);
          background: rgba(45, 149, 150, 0.15);
          border: 1px solid rgba(45, 149, 150, 0.3);
          border-radius: 999px;
          padding: 3px 8px;
          line-height: 1;
        }

        .mini-tag.muted {
          color: var(--text-secondary);
          background: transparent;
          border-color: var(--border-color);
        }

        .conversation-list {
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-right: 2px;
          flex: 1;
        }

        .section-label {
          margin: 8px 2px 2px;
          font-size: 0.72rem;
          color: var(--primary-light);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }

        .empty-list {
          margin: 8px 2px;
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .thread-item {
          width: 100%;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          border-radius: 10px;
          padding: 9px;
          display: flex;
          gap: 8px;
          text-align: left;
          cursor: pointer;
          color: var(--text-primary);
          transition: all 0.2s ease;
        }

        .thread-item:hover {
          border-color: var(--primary);
          background: var(--hover-bg);
        }

        .thread-item.active {
          border-color: var(--primary);
          background: rgba(45, 149, 150, 0.12);
          box-shadow: inset 0 0 0 1px rgba(45, 149, 150, 0.2);
        }

        .thread-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: var(--text-muted);
        }

        .thread-content {
          width: 100%;
          min-width: 0;
        }

        .thread-head {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .thread-head strong {
          font-size: 0.82rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .thread-head span {
          font-size: 0.68rem;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .thread-content p {
          margin: 3px 0;
          font-size: 0.78rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .thread-content small {
          font-size: 0.68rem;
          color: var(--text-secondary);
        }

        .messages-view {
          flex: 1;
          overflow-y: auto;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .bubble-row {
          display: flex;
          justify-content: flex-start;
        }

        .bubble-row.mine {
          justify-content: flex-end;
        }

        .bubble {
          max-width: 72%;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 10px;
          color: var(--text-primary);
        }

        .bubble-row.mine .bubble {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          border-color: transparent;
          color: white;
        }

        .bubble-text {
          font-size: 0.85rem;
          line-height: 1.35;
        }

        .bubble-meta {
          margin-top: 5px;
          font-size: 0.68rem;
          opacity: 0.7;
        }

        .composer {
          display: grid;
          grid-template-columns: 1fr 44px;
          gap: 8px;
          padding-top: 2px;
        }

        .composer input {
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background-color: var(--input-bg);
          color: var(--text-primary);
          padding: 10px;
          font-size: 0.86rem;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .composer input:focus {
          border-color: var(--primary);
        }

        .send-btn {
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(45, 149, 150, 0.3);
          transition: box-shadow 0.2s ease;
        }

        .send-btn:hover {
          box-shadow: 0 6px 16px rgba(45, 149, 150, 0.45);
        }

        .empty-state {
          margin: auto;
          font-size: 0.82rem;
          color: var(--text-secondary);
        }

        @media (max-width: 1024px) {
          .messenger-shell {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
