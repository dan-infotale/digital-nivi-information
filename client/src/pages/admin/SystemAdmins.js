import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/Layout';
import Modal from '../../components/Modal';
import api from '../../api';
import { useLanguage } from '../../context/LanguageContext';

export default function SystemAdmins() {
  const { t } = useLanguage();
  const [admins, setAdmins] = useState([]);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/admin/admins');
    setAdmins(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setSelected(null);
    setForm({ name: '', email: '', password: '' });
    setError('');
    setModal(true);
  }

  function openEdit(a) {
    setSelected(a);
    setForm({ name: a.name, email: a.email, password: '' });
    setError('');
    setModal(true);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = { name: form.name, email: form.email };
      if (form.password) payload.password = form.password;
      if (selected) {
        await api.put(`/admin/admins/${selected._id}`, payload);
      } else {
        await api.post('/admin/admins', payload);
      }
      setModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  }

  async function remove(id) {
    if (!window.confirm('Remove this system admin?')) return;
    await api.delete(`/admin/admins/${id}`);
    load();
  }

  return (
    <AdminLayout title={t('system_admins')}>
      <div className="page-header">
        <h2>{t('system_admins')}</h2>
        <button className="btn-primary" onClick={openNew}>+ {t('new_admin')}</button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>Entra</th><th>Created</th><th>{t('actions')}</th></tr></thead>
          <tbody>
            {admins.map(a => (
              <tr key={a._id}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>{a.entraOid ? '✓' : '—'}</td>
                <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                <td className="actions">
                  <button onClick={() => openEdit(a)}>{t('edit')}</button>
                  <button className="btn-danger" onClick={() => remove(a._id)}>{t('delete')}</button>
                </td>
              </tr>
            ))}
            {admins.length === 0 && <tr><td colSpan={5} className="empty">{t('no_admins')}</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={selected ? t('edit_admin') : t('new_admin')} onClose={() => setModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={save} className="form-grid">
            <label>{t('name')}<input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
            <label>{t('email')}<input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></label>
            <label>{t('password')} {selected && '(leave blank to keep current)'}
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </label>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(false)}>{t('cancel')}</button>
              <button type="submit" className="btn-primary">{t('save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
}
