import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import SystemLogin from './pages/SystemLogin';
import AuthCallback from './pages/AuthCallback';
import Tenants from './pages/admin/Tenants';
import SystemAdmins from './pages/admin/SystemAdmins';
import SystemSettings from './pages/admin/SystemSettings';
import MetaConnections from './pages/tenant/MetaConnections';
import BotBackends from './pages/tenant/BotBackends';
import Connectors from './pages/tenant/Connectors';
import Conversations from './pages/tenant/Conversations';
import KnowledgeBases from './pages/tenant/KnowledgeBases';
import './App.css';

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.type !== 'system_admin') return <Navigate to="/conversations" replace />;
  return children;
}

function RequireTenant({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.type !== 'tenant_user') return <Navigate to="/admin/tenants" replace />;
  return children;
}

function Root() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.type === 'system_admin' ? '/admin/tenants' : '/conversations'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/system" element={<SystemLogin />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route path="/admin/tenants" element={<RequireAdmin><Tenants /></RequireAdmin>} />
          <Route path="/admin/admins" element={<RequireAdmin><SystemAdmins /></RequireAdmin>} />
          <Route path="/admin/settings" element={<RequireAdmin><SystemSettings /></RequireAdmin>} />

          <Route path="/conversations" element={<RequireTenant><Conversations /></RequireTenant>} />
          <Route path="/connectors" element={<RequireTenant><Connectors /></RequireTenant>} />
          <Route path="/connections" element={<RequireTenant><MetaConnections /></RequireTenant>} />
          <Route path="/bots" element={<RequireTenant><BotBackends /></RequireTenant>} />
          <Route path="/knowledge" element={<RequireTenant><KnowledgeBases /></RequireTenant>} />

          <Route path="*" element={<Root />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
