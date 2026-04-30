import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/Layout';
import Modal from '../../components/Modal';
import api from '../../api';
import { useLanguage } from '../../context/LanguageContext';

export default function Tenants() {
  const { t } = useLanguage();
  const [tenants, setTenants] = useState([]);
  const [modal, setModal] = useState(null); // null | 'tenant' | 'users'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', slug: '' });
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/admin/tenants');
    setTenants(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveTenant(e) {
    e.preventDefault();
    setError('');
    try {
      if (selected) {
        await api.put(`/admin/tenants/${selected._id}`, form);
      } else {
        await api.post('/admin/tenants', form);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  }

  async function deleteTenant(id) {
    if (!window.confirm(t('delete_tenant_confirm'))) return;
    await api.delete(`/admin/tenants/${id}`);
    load();
  }

  async function openUsers(tenant) {
    setSelected(tenant);
    const { data } = await api.get(`/admin/tenants/${tenant._id}/users`);
    setUsers(data);
    setUserForm({ name: '', email: '', password: '' });
    setModal('users');
  }

  async function addUser(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/admin/tenants/${selected._id}/users`, userForm);
      const { data } = await api.get(`/admin/tenants/${selected._id}/users`);
      setUsers(data);
      setUserForm({ name: '', email: '', password: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  }

  async function deleteUser(userId) {
    await api.delete(`/admin/tenants/${selected._id}/users/${userId}`);
    setUsers(u => u.filter(x => x._id !== userId));
  }

  function openNew() {
    setSelected(null);
    setForm({ name: '', slug: '' });
    setError('');
    setModal('tenant');
  }

  function openEdit(tenant) {
    setSelected(tenant);
    setForm({ name: tenant.name, slug: tenant.slug });
    setError('');
    setModal('tenant');
  }

  return (
    <AdminLayout title={t('tenants')}>
      <div className="page-header">
        <h2>{t('tenants')}</h2>
        <button className="btn-primary" onClick={openNew}>+ {t('new_tenant')}</button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead><tr><th>{t('name')}</th><th>{t('slug')}</th><th>Created</th><th>{t('actions')}</th></tr></thead>
          <tbody>
            {tenants.map(tenant => (
              <tr key={tenant._id}>
                <td>{tenant.name}</td>
                <td><code>{tenant.slug}</code></td>
                <td>{new Date(tenant.createdAt).toLocaleDateString()}</td>
                <td className="actions">
                  <button onClick={() => openUsers(tenant)}>{t('users')}</button>
                  <button onClick={() => openEdit(tenant)}>{t('edit')}</button>
                  <button className="btn-danger" onClick={() => deleteTenant(tenant._id)}>{t('delete')}</button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && <tr><td colSpan={4} className="empty">{t('no_tenants')}</td></tr>}
          </tbody>
        </table>
      </div>

      {modal === 'tenant' && (
        <Modal title={selected ? t('edit_tenant') : t('new_tenant')} onClose={() => setModal(null)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={saveTenant} className="form-grid">
            <label>{t('name')}<input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></label>
            <label>{t('slug')}<input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} required /></label>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button type="submit" className="btn-primary">{t('save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'users' && selected && (
        <Modal title={`${t('manage_users')} — ${selected.name}`} onClose={() => setModal(null)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={addUser} className="inline-form">
            <input placeholder={t('name')} value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
            <input type="email" placeholder={`${t('email')} *`} value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} required />
            <input type="password" placeholder={t('password')} value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
            <button type="submit" className="btn-primary">{t('add_user')}</button>
          </form>
          <table className="data-table mt">
            <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><button className="btn-danger" onClick={() => deleteUser(u._id)}>{t('delete')}</button></td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={3} className="empty">{t('no_users')}</td></tr>}
            </tbody>
          </table>
        </Modal>
      )}
    </AdminLayout>
  );
}
