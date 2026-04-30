import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Login() {
  const { user, loginWithPassword } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(params.get('error') || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate(user.type === 'system_admin' ? '/admin/tenants' : '/conversations');
  }, [user, navigate]);

  useEffect(() => {
    api.get('/auth/tenants').then(r => setTenants(r.data)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithPassword(email, password, false);
      navigate('/conversations');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  if (!selectedTenant) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Bot Platform</h1>
          <p className="login-subtitle">Select your organization to continue</p>

          {tenants.length === 0 && (
            <div className="tenant-empty">No organizations found</div>
          )}

          <div className="tenant-list">
            {tenants.map(t => (
              <button key={t._id} className="tenant-item" onClick={() => setSelectedTenant(t)}>
                <div className="tenant-avatar">{t.name.charAt(0).toUpperCase()}</div>
                <span className="tenant-name">{t.name}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>

          <div className="divider">system admin</div>
          <button className="btn-ghost" style={{ width: '100%' }} onClick={() => navigate('/system-login')}>
            Sign in as system admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <button className="back-btn" onClick={() => { setSelectedTenant(null); setError(''); }}>
          ← Back
        </button>

        <div className="tenant-badge-lg">
          <div className="tenant-avatar lg">{selectedTenant.name.charAt(0).toUpperCase()}</div>
          <div>
            <div className="tenant-badge-name">{selectedTenant.name}</div>
            <div className="tenant-badge-sub">Sign in to continue</div>
          </div>
        </div>

        {error && <div className="error-banner">{errorMessages[error] || error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </label>
          <label>Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="divider">or</div>

        <button className="btn-entra" onClick={() => window.location.href = '/api/auth/entra/login?type=user'}>
          <MicrosoftIcon /> Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}

const errorMessages = {
  not_registered: 'Your Microsoft account is not registered in this system. Contact your administrator.',
  auth_failed: 'Microsoft authentication failed. Please try again.',
};

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}
