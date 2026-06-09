import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icons';

function NavItem({ to, icon, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      {icon && <Icon name={icon} size={15} className="nav-icon" />}
      {children}
    </NavLink>
  );
}

function LangToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <button
      className="lang-toggle"
      onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
      title={lang === 'he' ? 'Switch to English' : 'עבור לעברית'}
    >
      {lang === 'he' ? 'EN' : 'עב'}
    </button>
  );
}

function UserChip({ user, onLogout, t }) {
  const initials = (user?.name || user?.email || '?')
    .split(/[\s@]/).filter(Boolean).slice(0, 2)
    .map(w => w[0]).join('').toUpperCase();

  return (
    <div className="sidebar-footer">
      <div className="user-chip">
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <div className="user-name">{user?.name || 'User'}</div>
          <div className="user-email">{user?.email}</div>
        </div>
        <LangToggle />
      </div>
      <button className="btn-ghost" onClick={onLogout} style={{ width: '100%', justifyContent: 'center', display: 'flex' }}>
        <Icon name="logout" size={13} style={{ marginInlineEnd: 6 }} />
        {t('logout')}
      </button>
    </div>
  );
}

export function AdminLayout({ children, title }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon"><img src="/Picture1.png" alt="logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} /></div>
          <div>
            <div className="brand-name">Bot Platform</div>
            <div className="brand-sub">{t('system_admin')}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-group-label">{t('management')}</div>
            <NavItem to="/admin/tenants" icon="tenant">{t('tenants')}</NavItem>
            <NavItem to="/admin/admins" icon="admin">{t('system_admins')}</NavItem>
          </div>
          <div className="nav-group">
            <div className="nav-group-label">{t('configuration')}</div>
            <NavItem to="/admin/settings" icon="settings">{t('system_settings')}</NavItem>
          </div>
        </nav>
        <UserChip user={user} onLogout={handleLogout} t={t} />
      </aside>
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => window.location.reload()}><Icon name="refresh" size={15} /></button>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

export function TenantLayout({ children, title }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon"><img src="/Picture1.png" alt="logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} /></div>
          <div>
            <div className="brand-name">Bot Platform</div>
            <div className="brand-sub" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.tenantName || 'Workspace'}
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-group-label">{t('monitoring')}</div>
            <NavItem to="/conversations" icon="chat">{t('conversations')}</NavItem>
          </div>
          <div className="nav-group">
            <div className="nav-group-label">{t('configuration')}</div>
            <NavItem to="/connectors" icon="connector">{t('connectors')}</NavItem>
            <NavItem to="/connections" icon="whatsapp">{t('meta_connections')}</NavItem>
            <NavItem to="/bots" icon="bot">{t('custom_agents')}</NavItem>
            <NavItem to="/knowledge" icon="knowledge">{t('knowledge_bases')}</NavItem>
          </div>
        </nav>
        <UserChip user={user} onLogout={handleLogout} t={t} />
      </aside>
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => window.location.reload()}><Icon name="refresh" size={15} /></button>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
