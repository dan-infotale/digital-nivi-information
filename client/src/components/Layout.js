import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from './Icons';

function NavItem({ to, icon, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      {icon && <Icon name={icon} size={15} className="nav-icon" />}
      {children}
    </NavLink>
  );
}

function UserChip({ user, onLogout }) {
  const initials = (user?.name || user?.email || '?')
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="sidebar-footer">
      <div className="user-chip">
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <div className="user-name">{user?.name || 'User'}</div>
          <div className="user-email">{user?.email}</div>
        </div>
      </div>
      <button className="btn-ghost" onClick={onLogout} style={{ width: '100%', justifyContent: 'center', display: 'flex' }}>
        <Icon name="logout" size={13} style={{ marginRight: 6 }} />
        Logout
      </button>
    </div>
  );
}

export function AdminLayout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Icon name="bot" size={16} />
          </div>
          <div>
            <div className="brand-name">Bot Platform</div>
            <div className="brand-sub">System Admin</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-group-label">Management</div>
            <NavItem to="/admin/tenants" icon="tenant">Tenants</NavItem>
            <NavItem to="/admin/admins" icon="admin">System Admins</NavItem>
          </div>
          <div className="nav-group">
            <div className="nav-group-label">Configuration</div>
            <NavItem to="/admin/settings" icon="settings">System Settings</NavItem>
          </div>
        </nav>
        <UserChip user={user} onLogout={handleLogout} />
      </aside>
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">{title || 'Admin'}</span>
          <div className="topbar-actions">
            <button className="icon-btn" title="Refresh" onClick={() => window.location.reload()}>
              <Icon name="refresh" size={15} />
            </button>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

export function TenantLayout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Icon name="bot" size={16} />
          </div>
          <div>
            <div className="brand-name">Bot Platform</div>
            <div className="brand-sub" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.tenantName || 'Workspace'}
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-group-label">Monitoring</div>
            <NavItem to="/conversations" icon="chat">Conversations</NavItem>
          </div>
          <div className="nav-group">
            <div className="nav-group-label">Configuration</div>
            <NavItem to="/connectors" icon="connector">Connectors</NavItem>
            <NavItem to="/connections" icon="whatsapp">META Connections</NavItem>
            <NavItem to="/bots" icon="bot">Custom Agents</NavItem>
            <NavItem to="/knowledge" icon="knowledge">Knowledge Bases</NavItem>
          </div>
        </nav>
        <UserChip user={user} onLogout={handleLogout} />
      </aside>
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">{title || 'Dashboard'}</span>
          <div className="topbar-actions">
            <button className="icon-btn" title="Refresh" onClick={() => window.location.reload()}>
              <Icon name="refresh" size={15} />
            </button>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
