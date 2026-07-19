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

export default function Announcements() {
  const {
    applicants,
    announcements,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
  } = useApp();
  const { onMenuClick } = useOutletContext() || {};

  const scholarsOnly = useMemo(
    () => applicants.filter((s) => SCHOLAR_STATUSES.includes(s.status)),
    [applicants]
  );

  const applicantsOnly = useMemo(
    () => applicants.filter((s) => APPLICANT_STATUSES.includes(s.status)),
    [applicants]
  );

  const getRecipientsByTarget = (target) => {
    if (target === 'applicants') return applicantsOnly;
    if (target === 'scholars') return scholarsOnly;
    return applicants;
  };

  const getTargetLabel = (target) => {
    if (target === 'applicants') return 'Applicants Only';
    if (target === 'scholars') return 'Scholars Only';
    return 'Everyone';
  };

  /* ─── State ─── */

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    target: 'everyone',
    isImportant: false,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTarget, setFilterTarget] = useState('');

  // Newly picked files for this form session, not yet uploaded: File objects.
  const [pendingAttachments, setPendingAttachments] = useState([]);
  // Attachments already saved on the announcement being edited: {url, name}.
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  /* ─── Filtered announcements ─── */

  const filteredAnnouncements = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return announcements.filter((a) => {
      const matchesSearch =
        !searchTerm ||
        (a.title || '').toLowerCase().includes(term) ||
        (a.message || '').toLowerCase().includes(term);
      const matchesTarget = !filterTarget || a.target === filterTarget;
      return matchesSearch && matchesTarget;
    });
  }, [announcements, searchTerm, filterTarget]);

  // Safe date label — Firestore docs may lack a valid `date`.
  const formatAnnouncementDate = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  };

  /* ─── Handlers ─── */

  const resetForm = () => {
    setAnnouncementForm({ title: '', message: '', target: 'everyone', isImportant: false });
    setEditingId(null);
    setShowForm(false);
    setPendingAttachments([]);
    setExistingAttachments([]);
  };

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

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Announcement?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
    });

    if (result.isConfirmed) {
      await deleteAnnouncement(id);
      Swal.fire({
        title: 'Deleted!',
        text: 'Announcement has been deleted.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  return (
    <div className="page announcements-page">
      <Header
        title="Announcements"
        subtitle="Create and manage announcements for applicants, scholars, or everyone"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        <div className="section-header">
          <h2>Announcement Board</h2>
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
            <Plus size={18} />
            New Announcement
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="announcement-filters">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search announcements..."
          />
          <select
            className="form-input"
            value={filterTarget}
            onChange={(e) => setFilterTarget(e.target.value)}
            style={{ width: 'auto', minWidth: '160px' }}
          >
            <option value="">All Targets</option>
            <option value="applicants">Applicants Only</option>
            <option value="scholars">Scholars Only</option>
            <option value="everyone">Everyone</option>
          </select>
        </div>

        {showForm && (
          <div className="card announcement-form">
            <h3>{editingId ? 'Edit Announcement' : 'Create Announcement'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={announcementForm.title}
                  onChange={(e) =>
                    setAnnouncementForm({ ...announcementForm, title: e.target.value })
                  }
                  required
                  placeholder="Enter announcement title"
                />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea
                  className="form-input"
                  rows="5"
                  value={announcementForm.message}
                  onChange={(e) =>
                    setAnnouncementForm({ ...announcementForm, message: e.target.value })
                  }
                  required
                  placeholder="Enter announcement message"
                />
              </div>
              <div className="form-group">
                <label>Send To</label>
                <select
                  className="form-input"
                  value={announcementForm.target}
                  onChange={(e) =>
                    setAnnouncementForm({ ...announcementForm, target: e.target.value })
                  }
                >
                  <option value="applicants">Applicants Only</option>
                  <option value="scholars">Scholars Only</option>
                  <option value="everyone">Everyone</option>
                </select>
                <p className="inline-meta">
                  Recipients: {getRecipientsByTarget(announcementForm.target).length}
                </p>
              </div>
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
            </form>
          </div>
        )}

        <div className="announcements-list">
          {filteredAnnouncements.length === 0 ? (
            <EmptyState icon={Bell} title="No announcements" message="No announcements match your search or filters." />
          ) : (
            filteredAnnouncements.map((announcement) => (
              <div key={announcement.firestoreId} className={`announcement-card ${announcement.isImportant ? 'important' : ''}`}>
                <div className="announcement-header">
                  <div className="announcement-icon">
                    {announcement.isImportant ? <AlertTriangle size={20} /> : <Bell size={20} />}
                  </div>
                  <div className="announcement-meta">
                    <h3>
                      {announcement.title}
                      {announcement.isImportant && (
                        <span className="important-badge">Important</span>
                      )}
                    </h3>
                    <p className="announcement-date">
                      {formatAnnouncementDate(announcement.date)} • {announcement.author || 'Admin'} →{' '}
                      {getTargetLabel(announcement.target)} • {getRecipientsByTarget(announcement.target).length} recipients
                    </p>
                  </div>
                  <div className="announcement-actions">
                    <button className="btn-icon" onClick={() => handleEdit(announcement)} title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button className="btn-icon btn-danger" onClick={() => handleDelete(announcement.firestoreId)} title="Delete">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
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
        </div>
      </div>

      <style jsx>{`
        .announcements-page {
          background: var(--bg-secondary);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .section-header h2 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .section-header .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .announcement-filters {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .announcement-form {
          margin-bottom: 1rem;
        }

        .announcement-form h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          color: var(--text-secondary);
        }

        .checkbox-label {
          display: flex !important;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .checkbox-label input[type="checkbox"] {
          width: auto;
          accent-color: var(--warning);
        }

        .form-input {
          width: 100%;
          padding: 0.625rem;
          border: 1px solid var(--border-color);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background-color: var(--bg-secondary);
          color: var(--text-primary);
        }

        .form-input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(45, 149, 150, 0.1);
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .form-actions .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

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

        .inline-meta {
          margin-top: 0.35rem;
          margin-bottom: 0;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .announcements-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .announcement-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          padding: 1rem;
          transition: border-color 0.2s ease;
        }

        .announcement-card.important {
          border-left: 3px solid var(--warning);
        }

        .announcement-header {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.7rem;
        }

        .announcement-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .announcement-card.important .announcement-icon {
          background: linear-gradient(135deg, var(--warning) 0%, #d97706 100%);
        }

        .announcement-meta {
          flex: 1;
        }

        .announcement-meta h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .important-badge {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .announcement-date {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .announcement-actions {
          display: flex;
          gap: 0.25rem;
          align-items: flex-start;
        }

        .announcement-message {
          font-size: 0.9375rem;
          line-height: 1.6;
          color: var(--text-primary);
        }

        .btn-icon {
          padding: 0.5rem;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 0.375rem;
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .btn-icon.btn-danger:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        @media (max-width: 640px) {
          .announcement-filters {
            flex-direction: column;
          }

          .announcement-filters select {
            width: 100% !important;
            min-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
