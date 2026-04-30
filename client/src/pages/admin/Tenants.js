import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/Layout';
import Modal from '../../components/Modal';
import api from '../../api';

export default function Tenants() {
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
    if (!window.confirm('Delete tenant? This does not delete associated data.')) return;
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

  function openEdit(t) {
    setSelected(t);
    setForm({ name: t.name, slug: t.slug });
    setError('');
    setModal('tenant');
  }

  return (
    <AdminLayout title="Tenants">
      <div className="page-header">
        <h2>Tenants</h2>
        <button className="btn-primary" onClick={openNew}>+ New Tenant</button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Slug</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t._id}>
                <td>{t.name}</td>
                <td><code>{t.slug}</code></td>
                <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="actions">
                  <button onClick={() => openUsers(t)}>Users</button>
                  <button onClick={() => openEdit(t)}>Edit</button>
                  <button className="btn-danger" onClick={() => deleteTenant(t._id)}>Delete</button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && <tr><td colSpan={4} className="empty">No tenants yet</td></tr>}
          </tbody>
        </table>
      </div>

      {modal === 'tenant' && (
        <Modal title={selected ? 'Edit Tenant' : 'New Tenant'} onClose={() => setModal(null)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={saveTenant} className="form-grid">
            <label>Name<input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></label>
            <label>Slug<input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} required /></label>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'users' && selected && (
        <Modal title={`Users — ${selected.name}`} onClose={() => setModal(null)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={addUser} className="inline-form">
            <input placeholder="Name" value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
            <input type="email" placeholder="Email *" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} required />
            <input type="password" placeholder="Password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
            <button type="submit" className="btn-primary">Add</button>
          </form>
          <table className="data-table mt">
            <thead><tr><th>Name</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><button className="btn-danger" onClick={() => deleteUser(u._id)}>Remove</button></td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={3} className="empty">No users</td></tr>}
            </tbody>
          </table>
        </Modal>
      )}
    </AdminLayout>
  );
}
