import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import Swal from 'sweetalert2';
import {
  Plus, Edit, Trash2, UserCog, Mail, Key, Eye, EyeOff, Info,
} from 'lucide-react';
import Header from '../components/layout/Header';
import { initializeFirebase } from '../services/firebase';
import { createStaffAccount, setStaffStatus, resetStaffPassword } from '../services/staffAccounts';

const ROLES = [
  { value: 'staff', label: 'Staff', description: 'Can encode and edit records (tracked in Audit Trail)' },
  { value: 'admin', label: 'Administrator', description: 'Full access; manage staff, approve/reject, audit logs' },
];

export default function StaffManagement() {
  const { onMenuClick } = useOutletContext() || {};
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', position: '', role: 'staff', status: 'Active', password: '',
  });
  const [saving, setSaving] = useState(false);

  // Live staff & administrators from the Firestore `users` collection.
  useEffect(() => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const rows = [];
        snapshot.docs.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.role !== 'admin' && d.role !== 'staff') return;
          rows.push({
            id: docSnap.id,
            name: d.displayName || d.name || d.email || 'Unknown',
            email: d.email || '',
            position: d.position || '',
            role: d.role,
            status: d.status === 'inactive' ? 'Inactive' : 'Active',
          });
        });
        setStaffList(rows);
        setLoading(false);
      },
      (error) => {
        console.error('Staff users listener error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({ name: '', email: '', position: '', role: 'staff', status: 'Active', password: '' });
    setEditingStaff(null);
    setShowForm(false);
    setShowPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingStaff) {
        // Local update only for existing records (Firebase user was already created)
        setStaffList(prev =>
          prev.map(item => item.id === editingStaff.id ? { ...item, ...formData } : item)
        );
        Swal.fire({ title: 'Updated', text: 'Staff profile updated.', icon: 'success', timer: 1500, showConfirmButton: false });
      } else {
        if (!formData.password) {
          Swal.fire({ title: 'Password required', text: 'Please set a password for the new account.', icon: 'warning' });
          setSaving(false);
          return;
        }
        // Create a real Firebase Auth account + Firestore profile (client-side,
        // via a secondary app so the admin's own session is untouched). The
        // live `users` listener picks it up and adds it to the table.
        await createStaffAccount({
          email: formData.email,
          password: formData.password,
          displayName: formData.name,
          role: formData.role,
          position: formData.position,
        });
        Swal.fire({ title: 'Account Created', text: `${formData.name} can now sign in with their email and password as ${formData.role}.`, icon: 'success', timer: 2500, showConfirmButton: false });
      }
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message, icon: 'error' });
      setSaving(false);
      return;
    }

    resetForm();
    setSaving(false);
  };

  const handleEdit = (staff) => {
    setEditingStaff(staff);
    setFormData({ name: staff.name, email: staff.email, position: staff.position, role: staff.role, status: staff.status, password: '' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Remove staff?',
      text: 'This will deactivate their account.',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: 'var(--danger)', confirmButtonText: 'Remove',
    });
    if (!result.isConfirmed) return;

    try {
      await setStaffStatus(id, 'inactive');
      Swal.fire({ title: 'Deactivated', text: 'The account can no longer sign in.', icon: 'success', timer: 1600, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message, icon: 'error' });
    }
  };

  const handlePasswordReset = async (staff) => {
    const { value: newPw } = await Swal.fire({
      title: `Reset Password`,
      html: `<p style="margin-bottom:0.5rem">Set new password for <strong>${staff.name}</strong></p>
             <input id="new-pw" type="password" class="swal2-input" placeholder="New password (min 8 chars)">`,
      showCancelButton: true,
      confirmButtonText: 'Reset',
      preConfirm: () => {
        const val = document.getElementById('new-pw')?.value;
        if (!val || val.length < 6) {
          Swal.showValidationMessage('Password must be at least 6 characters');
        }
        return val;
      },
    });
    if (!newPw) return;

    try {
      await resetStaffPassword(staff.id, newPw);
      Swal.fire({ title: 'Password Reset', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message, icon: 'error' });
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') return <span className="role-badge admin">Administrator</span>;
    return <span className="role-badge staff">Staff</span>;
  };

  return (
    <div className="page staff-page">
      <Header
        title="Staff Management"
        subtitle="Manage staff and administrator accounts with role-based permissions"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        {/* Permissions reference */}
        <div className="permissions-banner">
          <Info size={16} />
          <span>
            <strong>Staff</strong> can encode, view, and edit records — every change is recorded in the Audit Trail.&nbsp;
            <strong>Administrators</strong> additionally approve applications and manage staff, users, audit logs, and system settings.
          </span>
        </div>

        <div className="section-header">
          <h2>Staff & Administrators</h2>
          {!showForm && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={16} /> Add Account
            </button>
          )}
        </div>

        {/* Add/Edit form */}
        {showForm && (
          <div className="form-card">
            <h3>{editingStaff ? 'Edit Staff' : 'New Account'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Maria Santos" />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="email@cityeducation.gov" disabled={!!editingStaff} />
                </div>
                <div className="form-group">
                  <label>Position / Designation</label>
                  <input value={formData.position} onChange={e => setFormData(p => ({ ...p, position: e.target.value }))} placeholder="e.g. Records Officer" />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}>
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
                    ))}
                  </select>
                </div>
                {!editingStaff && (
                  <div className="form-group">
                    <label>Password * (min 6 characters)</label>
                    <div className="pw-input">
                      <input
                        required
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                        placeholder="Strong password"
                      />
                      <button type="button" className="pw-toggle" onClick={() => setShowPassword(p => !p)}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingStaff ? 'Update' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Staff table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Position</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    Loading staff accounts…
                  </td>
                </tr>
              )}
              {!loading && staffList.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No staff accounts yet.
                  </td>
                </tr>
              )}
              {staffList.map(staff => (
                <tr key={staff.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar">{staff.name.charAt(0)}</div>
                      <strong>{staff.name}</strong>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                      <Mail size={13} />{staff.email}
                    </div>
                  </td>
                  <td>{staff.position || '—'}</td>
                  <td>{getRoleBadge(staff.role)}</td>
                  <td>
                    <span className={`status-badge ${staff.status === 'Active' ? 'approved' : 'rejected'}`}>
                      {staff.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(staff)}>
                        <Edit size={13} />
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handlePasswordReset(staff)}
                        title="Reset password"
                      >
                        <Key size={13} />
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(staff.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .permissions-banner {
          display: flex; align-items: flex-start; gap: 0.75rem;
          background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
          border-radius: var(--radius-sm); padding: 0.75rem 1rem;
          font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.5rem;
        }
        .permissions-banner svg { color: var(--primary); flex-shrink: 0; margin-top: 2px; }
        .form-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 1.5rem; margin-bottom: 1.5rem; }
        .form-card h3 { margin: 0 0 1.25rem; font-size: 1rem; color: var(--text-primary); }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
        .pw-input { position: relative; }
        .pw-input input { width: 100%; padding-right: 2.5rem; }
        .pw-toggle { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-secondary); }
        .role-preview { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1.25rem; }
        .role-preview-title { margin: 0 0 0.75rem; font-size: 0.85rem; color: var(--text-secondary); }
        .permissions-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.4rem; }
        .perm-row { display: flex; align-items: center; gap: 6px; }
        .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
        .role-badge { padding: 3px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 700; }
        .role-badge.admin { background: rgba(99,102,241,0.15); color: var(--primary); }
        .role-badge.staff { background: rgba(245,158,11,0.15); color: #d97706; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; flex-shrink: 0; }
        .table-container { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius); overflow-x: auto; }
        .inline-perms { margin-top: 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
        .btn-danger { background: var(--danger); color: #fff; border: none; }
        .btn-danger:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
