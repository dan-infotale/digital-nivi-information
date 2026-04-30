import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const type = params.get('type');
    if (!token) return navigate('/login?error=auth_failed');

    // Fetch user details using the token
    localStorage.setItem('token', token);
    const endpoint = type === 'admin' ? '/auth/me/admin' : '/auth/me';
    api.get(endpoint)
      .then(({ data }) => {
        login(token, data);
        navigate(data.type === 'system_admin' ? '/admin/tenants' : '/conversations');
      })
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/login?error=auth_failed');
      });
  }, []); // eslint-disable-line

  return <div style={{ padding: 40, textAlign: 'center' }}>Signing in...</div>;
}
