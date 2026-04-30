import React, { useState, useEffect, useCallback } from 'react';
import { TenantLayout } from '../../components/Layout';
import Modal from '../../components/Modal';
import Icon from '../../components/Icons';
import api from '../../api';

export default function Connectors() {
  const [items, setItems] = useState([]);
  const [connections, setConnections] = useState([]);
  const [bots, setBots] = useState([]);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', metaConnectionId: '', botBackendId: '', active: true });
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  const webhookBase = window.location.origin;

  const load = useCallback(async () => {
    const [c, m, b] = await Promise.all([
      api.get('/connectors'),
      api.get('/meta-connections'),
      api.get('/bot-backends'),
    ]);
    setItems(c.data);
    setConnections(m.data);
    setBots(b.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setSelected(null);
    setForm({ name: '', metaConnectionId: connections[0]?._id || '', botBackendId: bots[0]?._id || '', active: true });
    setError('');
    setModal(true);
  }

  function openEdit(item) {
    setSelected(item);
    setForm({
      name: item.name,
      metaConnectionId: item.metaConnectionId?._id || item.metaConnectionId,
      botBackendId: item.botBackendId?._id || item.botBackendId,
      active: item.active,
    });
    setError('');
    setModal(true);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      if (selected) {
        await api.put(`/connectors/${selected._id}`, form);
      } else {
        await api.post('/connectors', form);
      }
      setModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this connector?')) return;
    await api.delete(`/connectors/${id}`);
    load();
  }

  async function toggleActive(item) {
    await api.put(`/connectors/${item._id}`, { ...item, active: !item.active });
    load();
  }

  function copy(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <TenantLayout title="Connectors">
      <div className="page-header">
        <h2>Connectors</h2>
        <button className="btn-primary" onClick={openNew}>
          <Icon name="plus" size={14} />
          New Connector
        </button>
      </div>

      <div className="topology-grid">
        {items.length === 0 && (
          <div className="empty" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
            No connectors yet — create one to link a WhatsApp number to a bot.
          </div>
        )}
        {items.map(item => {
          const webhookUrl = `${webhookBase}/webhook/${item._id}`;
          const meta = item.metaConnectionId;
          const bot = item.botBackendId;
          return (
            <div key={item._id} className={`topology-card ${item.active ? '' : 'inactive'}`}>
              <div className="topo-main">
                <div className="topo-node">
                  <div className="topo-icon whatsapp">
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--whatsapp)', width: 22, height: 22 }}>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2.003C6.495 2.003 2 6.498 2 12.05c0 1.77.465 3.479 1.348 4.99L2 22l5.11-1.34a10.013 10.013 0 004.94 1.293h.004c5.553 0 10.05-4.495 10.05-10.05 0-5.554-4.497-10.047-10.054-10.05z" />
                    </svg>
                  </div>
                  <div className="topo-label">
                    <div className="topo-name">{meta?.name || 'META Connection'}</div>
                    <div className="topo-sub">{meta?.phoneNumberId || '—'}</div>
                  </div>
                </div>

                <div className="topo-arrow">
                  <Icon name="arrow_right" size={18} />
                </div>

                <div className="topo-node">
                  <div className="topo-icon connector">
                    <Icon name="connector" size={22} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="topo-label">
                    <div className="topo-name">{item.name}</div>
                    <div className="topo-sub">Connector</div>
                  </div>
                </div>

                <div className="topo-arrow">
                  <Icon name="arrow_right" size={18} />
                </div>

                <div className="topo-node">
                  <div className="topo-icon bot">
                    <Icon name="bot" size={22} style={{ color: 'var(--success)' }} />
                  </div>
                  <div className="topo-label">
                    <div className="topo-name">{bot?.name || 'Bot Backend'}</div>
                    <div className="topo-sub">{bot?.type || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="topo-footer">
                <div className="webhook-row">
                  <span className="webhook-label">Webhook</span>
                  <span className="webhook-url">{webhookUrl}</span>
                  <button
                    className={`btn-copy ${copied === item._id ? 'copied' : ''}`}
                    onClick={() => copy(webhookUrl, item._id)}
                  >
                    {copied === item._id ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div className="topo-controls">
                  <div className="toggle-wrap">
                    <button
                      className={`toggle ${item.active ? 'on' : ''}`}
                      onClick={() => toggleActive(item)}
                      title={item.active ? 'Deactivate' : 'Activate'}
                    />
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{item.active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => openEdit(item)}>Edit</button>
                  <button className="btn-danger" onClick={() => remove(item._id)}>Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal title={selected ? 'Edit Connector' : 'New Connector'} onClose={() => setModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={save} className="form-grid">
            <label>Name
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </label>
            <label>META Connection
              <select value={form.metaConnectionId} onChange={e => setForm(f => ({ ...f, metaConnectionId: e.target.value }))} required>
                <option value="">Select...</option>
                {connections.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </label>
            <label>Bot Backend
              <select value={form.botBackendId} onChange={e => setForm(f => ({ ...f, botBackendId: e.target.value }))} required>
                <option value="">Select...</option>
                {bots.map(b => <option key={b._id} value={b._id}>{b.name} ({b.type})</option>)}
              </select>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Active
            </label>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </TenantLayout>
  );
}
