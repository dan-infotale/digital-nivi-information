import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/Layout';
import Modal from '../../components/Modal';
import Icon from '../../components/Icons';
import api from '../../api';
import { useLanguage } from '../../context/LanguageContext';

const EMPTY_PROVIDER = {
  name: '', type: 'openai', baseUrl: '', apiKey: '', model: 'gpt-4o',
  region: '', awsAccessKeyId: '', awsSecretAccessKey: '',
};

export default function SystemSettings() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState({ embeddingConfig: { baseUrl: '', apiKey: '', model: 'text-embedding-3-small' }, llmProviders: [] });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [providerModal, setProviderModal] = useState(null); // null | { mode: 'add'|'edit', index?: number }
  const [providerForm, setProviderForm] = useState(EMPTY_PROVIDER);
  const [testing, setTesting] = useState({}); // { [providerId]: 'pending' | { ok, message|error } }

  const load = useCallback(async () => {
    const { data } = await api.get('/admin/settings');
    setSettings(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const ec = (k) => ({
    value: settings.embeddingConfig[k] ?? '',
    onChange: e => setSettings(s => ({ ...s, embeddingConfig: { ...s.embeddingConfig, [k]: e.target.value } })),
  });

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/admin/settings', settings);
      setSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function openAddProvider() {
    setProviderForm(EMPTY_PROVIDER);
    setProviderModal({ mode: 'add' });
  }

  function openEditProvider(index) {
    // Providers saved before the Type field existed are OpenAI-compatible
    setProviderForm({ ...EMPTY_PROVIDER, ...settings.llmProviders[index], type: settings.llmProviders[index].type || 'openai' });
    setProviderModal({ mode: 'edit', index });
  }

  function saveProvider() {
    if (!providerForm.name.trim()) return;
    const updated = [...settings.llmProviders];
    if (providerModal.mode === 'add') {
      updated.push(providerForm);
    } else {
      updated[providerModal.index] = providerForm;
    }
    setSettings(s => ({ ...s, llmProviders: updated }));
    setProviderModal(null);
  }

  function removeProvider(index) {
    if (!window.confirm('Delete this provider?')) return;
    setSettings(s => ({ ...s, llmProviders: s.llmProviders.filter((_, i) => i !== index) }));
  }

  async function testProvider(providerId) {
    if (!providerId) {
      setTesting(t => ({ ...t, _new: { ok: false, error: 'Save the provider before testing' } }));
      return;
    }
    setTesting(t => ({ ...t, [providerId]: 'pending' }));
    try {
      const { data } = await api.post('/admin/settings/test-llm', { providerId });
      setTesting(t => ({ ...t, [providerId]: data }));
    } catch (err) {
      setTesting(t => ({ ...t, [providerId]: { ok: false, error: err.response?.data?.error || err.message } }));
    }
  }

  const pf = (k) => ({
    value: providerForm[k] ?? '',
    onChange: e => setProviderForm(f => ({ ...f, [k]: e.target.value })),
  });

  return (
    <AdminLayout title={t('system_settings')}>
      <div className="page-header">
        <h2>{t('system_settings')}</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Embedding Config ── */}
        <div className="card">
          <div className="card-section">
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg-0)', marginBottom: 16 }}>
              {t('embedding_config')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>
                {t('base_url')}
                <input {...ec('baseUrl')} placeholder="https://api.openai.com/v1" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>
                {t('api_key')}
                <input type="password" {...ec('apiKey')} placeholder="sk-..." />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>
                {t('model')}
                <input {...ec('model')} placeholder="text-embedding-3-small" />
              </label>
            </div>
          </div>
        </div>

        {/* ── LLM Providers ── */}
        <div className="card">
          <div className="card-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg-0)' }}>{t('llm_providers')}</div>
            <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={openAddProvider}>
              <Icon name="plus" size={13} />
              {t('add_provider')}
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('base_url')}</th>
                <th>{t('model')}</th>
                <th>{t('api_key')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {settings.llmProviders.map((p, i) => {
                const result = testing[p._id];
                const pending = result === 'pending';
                return (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td><code style={{ fontSize: 11 }}>{p.type === 'bedrock' ? `AWS Bedrock (${p.region || 'no region'})` : (p.baseUrl || '—')}</code></td>
                    <td><code style={{ fontSize: 11 }}>{p.model || '—'}</code></td>
                    <td>{
                      p.type === 'bedrock'
                        ? (p.awsAccessKeyId ? 'AWS access key' : p.apiKey ? 'Bedrock API key' : <span style={{ color: 'var(--fg-4)' }}>server AWS credentials</span>)
                        : (p.apiKey ? '●●●●●●' : <span style={{ color: 'var(--fg-4)' }}>not set</span>)
                    }</td>
                    <td className="actions">
                      <button type="button" onClick={() => testProvider(p._id)} disabled={pending}>
                        {pending ? 'Testing…' : 'Test'}
                      </button>
                      <button type="button" onClick={() => openEditProvider(i)}>{t('edit')}</button>
                      <button type="button" className="btn-danger" onClick={() => removeProvider(i)}>{t('delete')}</button>
                      {result && result !== 'pending' && (
                        <div style={{ fontSize: 11, marginTop: 4, color: result.ok ? 'var(--ok, #2a8a3a)' : 'var(--err, #c0392b)' }}>
                          {result.ok ? `✓ ${result.message}` : `✗ ${result.error}`}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {settings.llmProviders.length === 0 && (
                <tr><td colSpan={5} className="empty">{t('no_providers')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saved ? <><Icon name="check" size={14} /> {t('saved')}</> : saving ? t('saving') : t('save_settings')}
          </button>
        </div>
      </form>

      {providerModal && (
        <Modal
          title={providerModal.mode === 'add' ? t('add_provider') : t('edit_provider')}
          onClose={() => setProviderModal(null)}
        >
          <div className="form-grid">
            <label>{t('name')}
              <input {...pf('name')} placeholder="e.g. OpenAI, Azure Foundry, Bedrock Claude" required />
            </label>
            <label>Type
              <select {...pf('type')}>
                <option value="openai">OpenAI-compatible (OpenAI, Azure AI Foundry, OpenRouter, Ollama…)</option>
                <option value="bedrock">AWS Bedrock</option>
              </select>
            </label>
            {providerForm.type === 'bedrock' ? (
              <>
                <label>Region
                  <input {...pf('region')} placeholder="us-east-1" required />
                </label>
                <label>Model ID / inference profile
                  <input {...pf('model')} placeholder="us.anthropic.claude-sonnet-4-5-20250929-v1:0" />
                </label>
                <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                  Credentials: fill in an AWS access key pair, <b>or</b> a Bedrock API key,
                  or leave all empty to use the server's own AWS credentials (env vars / IAM role).
                </div>
                <label>AWS access key ID
                  <input {...pf('awsAccessKeyId')} placeholder="AKIA..." autoComplete="off" />
                </label>
                <label>AWS secret access key
                  <input type="password" {...pf('awsSecretAccessKey')} autoComplete="new-password" />
                </label>
                <label>Bedrock API key
                  <input type="password" {...pf('apiKey')} autoComplete="new-password" />
                </label>
              </>
            ) : (
              <>
                <label>{t('base_url')}
                  <input {...pf('baseUrl')} placeholder="https://api.openai.com/v1 or https://<resource>.services.ai.azure.com/openai/v1" />
                </label>
                <label>{t('api_key')}
                  <input type="password" {...pf('apiKey')} placeholder="sk-..." />
                </label>
                <label>Default {t('model')}
                  <input {...pf('model')} placeholder="gpt-4o (Azure: your deployment name)" />
                </label>
              </>
            )}
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setProviderModal(null)}>{t('cancel')}</button>
              <button type="button" className="btn-primary" onClick={saveProvider}>
                {providerModal.mode === 'add' ? t('add_provider') : t('save')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
