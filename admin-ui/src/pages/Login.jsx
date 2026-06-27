import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock } from 'lucide-react';
import { setSession } from '../utils/auth';
import { verifyLogin } from '../services/staffAccounts';

// Built-in demo accounts for this build. Admin has full access; staff sees the
// same panel minus Staff Management and Audit Logs. Staff/admin accounts created
// from Staff Management sign in with their email + password (verified below).
const ACCOUNTS = {
  admin: { password: 'admin123', role: 'admin' },
  staff: { password: 'staff123', role: 'staff' },
};

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const name = username.trim();

    // 1) Built-in demo accounts (instant, always available).
    const account = ACCOUNTS[name.toLowerCase()];
    if (account && account.password === password) {
      setSession({ username: name, role: account.role });
      onLogin(account.role);
      navigate('/dashboard', { replace: true });
      return;
    }

    // 2) Firebase-backed staff/admin accounts (email + password).
    setSubmitting(true);
    try {
      const result = await verifyLogin({ email: name, password });
      setSession({ username: result.displayName || name, role: result.role });
      onLogin(result.role);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-icon">
              <ShieldCheck size={26} />
            </div>
            <div>
            <h1 className="login-title">CED Admin Portal</h1>
            <p className="login-subtitle">Sign in to continue</p>
            </div>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="username">Username or Email</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Enter username or email"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="login-btn" disabled={submitting}>
              <Lock size={16} />
              <span>{submitting ? 'Signing in…' : 'Sign In'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
