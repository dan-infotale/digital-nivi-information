import React, { useState, useEffect, useCallback } from 'react';
import { TenantLayout } from '../../components/Layout';
import { Drawer } from '../../components/Modal';
import Icon from '../../components/Icons';
import api from '../../api';
import { useLanguage } from '../../context/LanguageContext';

const NIVI_DEFAULTS = { baseUrl: '', apiKey: '', piiFilter: false };
const AGENT_DEFAULTS = { providerId: '', systemPrompt: 'You are a helpful assistant.', temperature: 0.7, topK: 5, piiFilter: false };

export default function BotBackends() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [kbs, setKbs] = useState([]);
  const [providers, setProviders] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [selected, setSelected] = useState(null);
  const [type, setType] = useState('custom_agent');
  const [form, setForm] = useState({ name: '', knowledgeBaseId: '' });
  const [config, setConfig] = useState(AGENT_DEFAULTS);
  const [error, setError] = useState('');
  const [testResults, setTestResults] = useState({});

  const load = useCallback(async () => {
    const [b, k, p] = await Promise.all([
      api.get('/bot-backends'),
      api.get('/knowledge-bases'),
      api.get('/providers'),
    ]);
    setItems(b.data);
    setKbs(k.data);
    setProviders(p.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setSelected(null);
    setType('custom_agent');
    setForm({ name: '', knowledgeBaseId: '' });
    setConfig(AGENT_DEFAULTS);
    setError('');
    setDrawer(true);
  }

  function openEdit(item) {
    setSelected(item);
    setType(item.type);
    setForm({ name: item.name, knowledgeBaseId: item.knowledgeBaseId || '' });
    setConfig(item.config || (item.type === 'nivi' ? NIVI_DEFAULTS : AGENT_DEFAULTS));
    setError('');
    setDrawer(true);
  }

  function onTypeChange(t) {
    setType(t);
    setConfig(t === 'nivi' ? NIVI_DEFAULTS : AGENT_DEFAULTS);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = { name: form.name, type, config, knowledgeBaseId: form.knowledgeBaseId || null };
      if (selected) {
        await api.put(`/bot-backends/${selected._id}`, payload);
      } else {
        await api.post('/bot-backends', payload);
      }
      setDrawer(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error');
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this bot backend?')) return;
    await api.delete(`/bot-backends/${id}`);
    load();
  }

  async function testConnection(id) {
    setTestResults(r => ({ ...r, [id]: 'loading' }));
    try {
      const { data } = await api.post(`/bot-backends/${id}/test`);
      setTestResults(r => ({ ...r, [id]: data }));
    } catch {
      setTestResults(r => ({ ...r, [id]: { ok: false, error: 'Request failed' } }));
    }
  }

  const cfg = (k, type_ = 'text') => ({
    value: config[k] ?? '',
    onChange: e => setConfig(c => ({ ...c, [k]: type_ === 'number' ? parseFloat(e.target.value) : e.target.value })),
  });

  function providerName(providerId) {
    return providers.find(p => p._id === providerId)?.name || providerId || '—';
  }

  return (
    <TenantLayout title="Custom Agents">
      <div className="page-header">
        <h2>Custom Agents</h2>
        <button className="btn-primary" onClick={openNew}>
          <Icon name="plus" size={14} />
          {t('new_agent')}
        </button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>{t('type')}</th>
              <th>{t('knowledge_base')}</th>
              <th>{t('provider_url')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item._id}>
                <td>{item.name}</td>
                <td>
                  <span className={`badge badge-${item.type}`}>
                    {item.type === 'nivi' ? 'Nivi' : 'Custom Agent'}
                  </span>
                </td>
                <td>{kbs.find(k => k._id === item.knowledgeBaseId)?.name || <span style={{ color: 'var(--fg-4)' }}>—</span>}</td>
                <td>
                  <code style={{ fontSize: 11 }}>
                    {item.type === 'custom_agent'
                      ? providerName(item.config?.providerId)
                      : (item.config?.baseUrl || '—')}
                  </code>
                </td>
                <td className="actions">
                  <button
                    onClick={() => testConnection(item._id)}
                    disabled={testResults[item._id] === 'loading'}
                  >
                    {testResults[item._id] === 'loading' ? '...' : t('test')}
                  </button>
                  {testResults[item._id] && testResults[item._id] !== 'loading' && (
                    <span className={`conn-badge ${testResults[item._id].ok ? 'conn-ok' : 'conn-err'}`}>
                      {testResults[item._id].ok
                        ? `✓ ${testResults[item._id].name || 'Connected'}`
                        : `✗ ${testResults[item._id].error}`}
                    </span>
                  )}
                  <button onClick={() => openEdit(item)}>{t('edit')}</button>
                  <button className="btn-danger" onClick={() => remove(item._id)}>{t('delete')}</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="empty">{t('no_agents')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {drawer && (
        <Drawer title={selected ? t('edit_agent') : t('new_agent')} onClose={() => setDrawer(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={save} className="form-grid">
            <label>{t('name')}
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </label>

            <label>{t('type')}</label>
            <div className="segmented" style={{ marginTop: -8 }}>
              <button
                type="button"
                className={type === 'custom_agent' ? 'active' : ''}
                onClick={() => !selected && onTypeChange('custom_agent')}
                disabled={!!selected}
              >
                Custom Agent
              </button>
              <button
                type="button"
                className={type === 'nivi' ? 'active' : ''}
                onClick={() => !selected && onTypeChange('nivi')}
                disabled={!!selected}
              >
                Nivi
              </button>
            </div>

            {type === 'nivi' && (<>
              <label>{t('base_url')}
                <input {...cfg('baseUrl')} placeholder="https://nivi.digital.gov.il/..." required />
              </label>
              <label>{t('api_key')}
                <input type="password" {...cfg('apiKey')} placeholder="Bearer token" />
              </label>
            </>)}

            {type === 'custom_agent' && (<>
              <label>{t('llm_provider')}
                <select
                  value={config.providerId ?? ''}
                  onChange={e => setConfig(c => ({ ...c, providerId: e.target.value }))}
                  required
                >
                  <option value="">{t('select_provider')}</option>
                  {providers.map(p => (
                    <option key={p._id} value={p._id}>{p.name} {p.model ? `(${p.model})` : ''}</option>
                  ))}
                </select>
              </label>
              {providers.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--warn)', padding: '6px 10px', background: 'rgba(217,119,6,0.08)', borderRadius: 'var(--r-md)' }}>
                  {t('no_providers_warn')}
                </div>
              )}
              <label>{t('system_prompt')}
                <textarea
                  rows={4}
                  value={config.systemPrompt ?? ''}
                  onChange={e => setConfig(c => ({ ...c, systemPrompt: e.target.value }))}
                  placeholder="You are a helpful assistant."
                />
              </label>
              <label>{t('temperature')}
                <input type="number" step="0.1" min="0" max="2" {...cfg('temperature', 'number')} />
              </label>

              <fieldset>
                <legend>{t('rag_optional')}</legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <label>{t('top_k')}
                    <input type="number" min="1" max="20" {...cfg('topK', 'number')} />
                  </label>
                  <label>{t('knowledge_base')}
                    <select value={form.knowledgeBaseId} onChange={e => setForm(f => ({ ...f, knowledgeBaseId: e.target.value }))}>
                      <option value="">{t('no_kb')}</option>
                      {kbs.map(k => <option key={k._id} value={k._id}>{k.name}</option>)}
                    </select>
                  </label>
                </div>
              </fieldset>
            </>)}

            <label className="checkbox-label" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={!!config.piiFilter}
                onChange={e => setConfig(c => ({ ...c, piiFilter: e.target.checked }))}
              />
              סינון מידע רגיש
            </label>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setDrawer(false)}>{t('cancel')}</button>
              <button type="submit" className="btn-primary">{t('save')}</button>
            </div>
          </form>
        </Drawer>
      )}
    </TenantLayout>
  );
}
