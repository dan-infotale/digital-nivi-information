import React, { useState, useEffect, useCallback } from 'react';
import { TenantLayout } from '../../components/Layout';
import { useLanguage } from '../../context/LanguageContext';
import Modal from '../../components/Modal';
import Icon from '../../components/Icons';
import api from '../../api';

const EMPTY = { name: '', apiUrl: '', token: '', phoneNumberId: '', verifyToken: '' };

export default function MetaConnections() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [sendTestModal, setSendTestModal] = useState(null); // connection id or null
  const [sendTestForm, setSendTestForm] = useState({ to: '', text: 'הודעת בדיקה מהמערכת 🔍' });
  const [sendTestResult, setSendTestResult] = useState(null);
  const [sendTestLoading, setSendTestLoading] = useState(false);

  const webhookBase = window.location.origin;

  const load = useCallback(async () => {
    const [m, c] = await Promise.all([api.get('/meta-connections'), api.get('/connectors')]);
    setItems(m.data); setConnectors(c.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  function copy(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function testConnection(id) {
    setTestResults(r => ({ ...r, [id]: 'loading' }));
    try {
      const { data } = await api.post(`/meta-connections/${id}/test`);
      setTestResults(r => ({ ...r, [id]: data }));
    } catch {
      setTestResults(r => ({ ...r, [id]: { ok: false, error: 'Request failed' } }));
    }
  }

  function openSendTest(id) {
    setSendTestModal(id);
    setSendTestForm({ to: '', text: 'הודעת בדיקה מהמערכת 🔍' });
    setSendTestResult(null);
  }

  async function doSendTest(e) {
    e.preventDefault();
    setSendTestLoading(true);
    setSendTestResult(null);
    try {
      const { data } = await api.post(`/meta-connections/${sendTestModal}/send-test`, sendTestForm);
      setSendTestResult(data);
    } catch {
      setSendTestResult({ ok: false, error: 'Request failed' });
    } finally {
      setSendTestLoading(false);
    }
  }

  function openNew() { setSelected(null); setForm(EMPTY); setError(''); setModal(true); }
  function openEdit(item) { setSelected(item); setForm({ ...EMPTY, ...item, token: '' }); setError(''); setModal(true); }

  async function save(e) {
    e.preventDefault(); setError('');
    try {
      if (selected) await api.put(`/meta-connections/${selected._id}`, form);
      else await api.post('/meta-connections', form);
      setModal(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
  }

  async function remove(id) {
    if (!window.confirm(t('delete') + '?')) return;
    await api.delete(`/meta-connections/${id}`); load();
  }

  const f = (k) => ({ value: form[k], onChange: e => setForm(x => ({ ...x, [k]: e.target.value })) });

  return (
    <TenantLayout title={t('meta_connections')}>
      <div className="page-header">
        <h2>{t('meta_connections')}</h2>
        <button className="btn-primary" onClick={openNew}>
          <Icon name="plus" size={14} /> {t('new_connection')}
        </button>
      </div>

      <div className="meta-cards">
        {items.length === 0 && (
          <div className="empty" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
            {t('no_meta')}
          </div>
        )}
        {items.map(item => {
          const linked = connectors.filter(c => (c.metaConnectionId?._id || c.metaConnectionId) === item._id);
          return (
            <div key={item._id} className="meta-card">
              <div className="meta-card-header">
                <div className="meta-card-left">
                  <div className="meta-wa-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--whatsapp)', width: 20, height: 20 }}>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2.003C6.495 2.003 2 6.498 2 12.05c0 1.77.465 3.479 1.348 4.99L2 22l5.11-1.34a10.013 10.013 0 004.94 1.293h.004c5.553 0 10.05-4.495 10.05-10.05 0-5.554-4.497-10.047-10.054-10.05z" />
                    </svg>
                  </div>
                  <div>
                    <div className="meta-name">{item.name}</div>
                    <div className="meta-phone-id">ID: {item.phoneNumberId}</div>
                  </div>
                </div>
                <div className="meta-actions">
                  <button className="btn-ghost" onClick={() => testConnection(item._id)} disabled={testResults[item._id] === 'loading'}>
                    {testResults[item._id] === 'loading' ? '...' : t('test')}
                  </button>
                  {testResults[item._id] && testResults[item._id] !== 'loading' && (
                    <span className={`conn-badge ${testResults[item._id].ok ? 'conn-ok' : 'conn-err'}`}>
                      {testResults[item._id].ok ? `✓ ${testResults[item._id].name || ''}` : `✗ ${testResults[item._id].error}`}
                    </span>
                  )}
                  <button className="btn-ghost" onClick={() => openSendTest(item._id)}>שלח בדיקה</button>
                  <button className="btn-ghost" onClick={() => openEdit(item)}>{t('edit')}</button>
                  <button className="btn-danger" onClick={() => remove(item._id)}>{t('delete')}</button>
                </div>
              </div>
              {linked.length === 0 ? (
                <div className="no-webhooks">{t('no_connectors_linked')}</div>
              ) : (
                <div className="meta-webhook-list">
                  {linked.map(c => {
                    const url = `${webhookBase}/webhook/${c._id}`;
                    const copyId = `${item._id}-${c._id}`;
                    return (
                      <div key={c._id} className="meta-webhook-item">
                        <span className="meta-webhook-name">{c.name}</span>
                        <span className="meta-webhook-url">{url}</span>
                        <button className={`btn-copy ${copied === copyId ? 'copied' : ''}`} onClick={() => copy(url, copyId)}>
                          {copied === copyId ? t('copied') : t('copy')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sendTestModal && (
        <Modal title="שלח הודעת בדיקה" onClose={() => setSendTestModal(null)}>
          <form onSubmit={doSendTest} className="form-grid">
            <label>מספר טלפון (עם קידומת מדינה)
              <input
                placeholder="972501234567"
                value={sendTestForm.to}
                onChange={e => setSendTestForm(f => ({ ...f, to: e.target.value }))}
                required
              />
            </label>
            <label>הודעה
              <textarea
                rows={5}
                value={sendTestForm.text}
                onChange={e => setSendTestForm(f => ({ ...f, text: e.target.value }))}
                required
                style={{ resize: 'vertical' }}
              />
            </label>
            {sendTestResult && (
              <div className={sendTestResult.ok ? 'success-banner' : 'error-banner'}>
                {sendTestResult.ok ? '✓ ההודעה נשלחה בהצלחה' : `✗ ${sendTestResult.error}`}
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setSendTestModal(null)}>{t('cancel')}</button>
              <button type="submit" className="btn-primary" disabled={sendTestLoading}>
                {sendTestLoading ? '...' : 'שלח'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal && (
        <Modal title={selected ? t('edit_connection') : t('new_meta')} onClose={() => setModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={save} className="form-grid">
            <label>{t('name')}<input {...f('name')} required /></label>
            <label>{t('api_url')}<input {...f('apiUrl')} placeholder="https://graph.facebook.com/v19.0/.../messages" required={!selected} /></label>
            <label>
              {t('token')} {selected && <span style={{ fontWeight: 400, color: 'var(--fg-4)' }}>{t('token_keep')}</span>}
              <input type="password" {...f('token')} required={!selected} />
            </label>
            <label>{t('phone_number_id')}<input {...f('phoneNumberId')} required /></label>
            <label>{t('verify_token')}<input {...f('verifyToken')} required /></label>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(false)}>{t('cancel')}</button>
              <button type="submit" className="btn-primary">{t('save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </TenantLayout>
  );
}
