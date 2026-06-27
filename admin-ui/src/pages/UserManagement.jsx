import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import Header from '../components/layout/Header';
import Swal from 'sweetalert2';
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { initializeFirebase } from '../services/firebase';

const ADMIN_ROLES = ['admin', 'staff', 'super_admin'];

export default function UserManagement() {
  const { onMenuClick } = useOutletContext() || {};
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Admin',
  });

  const roles = [
    { value: 'Admin', label: 'Admin', description: 'Manage scholars and reports' },
    { value: 'Student', label: 'Student', description: 'Student portal access' },
  ];

  // Live users from the Firestore `users` collection.
  useEffect(() => {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const rows = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const fullName =
            d.displayName ||
            [d.firstName, d.middleName, d.lastName, d.suffix].filter(Boolean).join(' ') ||
            d.email ||
            'Unknown';
          return {
            id: docSnap.id,
            name: fullName,
            email: d.email || '',
            role: ADMIN_ROLES.includes(d.role) ? 'Admin' : 'Student',
            status: d.status === 'inactive' ? 'Inactive' : 'Active',
            lastLogin: d.lastLogin || d.lastLoginAt || '—',
          };
        });
        setUsers(rows);
        setLoading(false);
      },
      (error) => {
        console.error('Users listener error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingUser) {
      setUsers(users.map(u => {
        if (u.id !== editingUser.id) return u;

        const updatedUser = {
          ...u,
          name: formData.name,
          email: formData.email,
          role: formData.role,
        };

        if (formData.password.trim()) {
          updatedUser.password = formData.password;
        }

        return updatedUser;
      }));
      Swal.fire({
        title: 'Updated!',
        text: 'User has been updated successfully.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });
    } else {
      const newUser = {
        id: `local-${Date.now()}`,
        ...formData,
        status: 'Active',
        lastLogin: 'Never',
      };
      setUsers([...users, newUser]);
      Swal.fire({
        title: 'Added!',
        text: 'New user has been added successfully.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });
    }

    setFormData({ name: '', email: '', password: '', role: 'Admin' });
    setEditingUser(null);
    setShowForm(false);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete User?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
    });

    if (result.isConfirmed) {
      setUsers(users.filter(u => u.id !== id));
      Swal.fire({
        title: 'Deleted!',
        text: 'User has been deleted.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  return (
    <div className="page user-management-page">
      <Header
        title="User Management"
        subtitle="Manage student and admin accounts"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        <div className="section-header">
          <div>
            <h2>Users</h2>
            <p>Manage student and admin accounts</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} />
            Add User
          </button>
        </div>

        {showForm && (
          <div className="card user-form">
            <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name</label>
                  <div className="input-with-icon">
                    <User size={18} />
                    <input
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Enter full name"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} />
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      placeholder="Enter email address"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Password {editingUser && '(leave blank to keep current)'}</label>
                  <div className="input-with-icon">
                    <Lock size={18} />
                    <input
                      type="password"
                      className="form-input"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingUser}
                      placeholder="Enter password"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <div className="input-with-icon">
                    <Shield size={18} />
                    <select
                      className="form-input"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      {roles.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.label} - {role.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingUser(null);
                    setFormData({ name: '', email: '', password: '', role: 'Admin' });
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Update User' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Roles Info */}
        <div className="roles-grid">
          {roles.map(role => (
            <div key={role.value} className="role-card">
              <div className="role-icon">
                <Shield size={24} />
              </div>
              <h4>{role.label}</h4>
              <p>{role.description}</p>
              <div className="role-count">
                {users.filter(u => u.role === role.value).length} users
              </div>
            </div>
          ))}
        </div>

        {/* Users Table */}
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      Loading users…
                    </td>
                  </tr>
                )}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      No users found.
                    </td>
                  </tr>
                )}
                {users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span>{user.name}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className="role-badge">{user.role}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${user.status.toLowerCase()}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>{user.lastLogin}</td>
                    <td>
                      {user.role === 'Student' ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <div className="action-buttons">
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(user.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        .user-management-page {
          background: var(--bg-secondary);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }

        .section-header h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .section-header p {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .section-header .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .user-form {
          margin-bottom: 2rem;
        }

        .user-form h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          color: var(--text-secondary);
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-icon svg {
          position: absolute;
          left: 0.75rem;
          color: var(--text-secondary);
        }

        .input-with-icon .form-input {
          padding-left: 2.75rem;
        }

        .form-input {
          width: 100%;
          padding: 0.625rem;
          border: 1px solid var(--border-color);
          border-radius: 0.375rem;
          font-size: 0.875rem;
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

        .roles-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .role-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          padding: 1.5rem;
          text-align: center;
        }

        .role-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
        }

        .role-card h4 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .role-card p {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .role-count {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary-color);
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .role-badge {
          padding: 0.375rem 0.75rem;
          background: var(--bg-secondary);
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--primary-color);
        }

        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .action-buttons .btn {
          padding: 0.5rem;
        }
      `}</style>
    </div>
  );
}
