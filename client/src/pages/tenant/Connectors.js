import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TenantLayout } from '../../components/Layout';
import Modal from '../../components/Modal';
import Icon from '../../components/Icons';
import api from '../../api';
import { useLanguage } from '../../context/LanguageContext';

const EMPTY_FORM = {
  name: '', metaConnectionId: '', botBackendId: '', active: true,
  welcomeMessage: '', unsupportedMessage: '',
  autoCloseMinutes: 15, autoCloseMessage: '',
  suppressBotGreeting: false, greetingClassifierProvider: '',
  retention: { enabled: false, days: 90, deleteMode: 'full' },
};

function WhatsAppEditor({ label, value, onChange, placeholder, rows = 3 }) {
  const ref = useRef(null);

  function wrap(before, after) {
    const el = ref.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }

  function insertLink() {
    let url = prompt('הכנס URL:');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const el = ref.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = value.slice(start, end) || 'טקסט';
    const next = value.slice(0, start) + `[${text}](${url})` + value.slice(end);
    onChange(next);
  }

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span>{label}</span>
      <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
        {[
          { title: 'Bold', display: <b>B</b>, action: () => wrap('**', '**') },
          { title: 'Italic', display: <i>I</i>, action: () => wrap('*', '*') },
          { title: 'Strikethrough', display: <s>S</s>, action: () => wrap('~~', '~~') },
          { title: 'Link', display: '🔗', action: insertLink },
        ].map(btn => (
          <button
            key={btn.title}
            type="button"
            title={btn.title}
            onClick={btn.action}
            style={{
              padding: '2px 8px', fontSize: 13, cursor: 'pointer',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 4, color: 'var(--fg-1)',
            }}
          >
            {btn.display}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
      />
    </label>
  );
}

export default function Connectors() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [connections, setConnections] = useState([]);
  const [bots, setBots] = useState([]);
  const [llmProviders, setLlmProviders] = useState([]);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const [testResults, setTestResults] = useState({});

  const webhookBase = window.location.origin;

  const load = useCallback(async () => {
    const [c, m, b, p] = await Promise.all([
      api.get('/connectors'),
      api.get('/meta-connections'),
      api.get('/bot-backends'),
      api.get('/providers').catch(() => ({ data: [] })),
    ]);
    setItems(c.data);
    setConnections(m.data);
    setBots(b.data);
    setLlmProviders(p.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setSelected(null);
    setForm({ ...EMPTY_FORM, metaConnectionId: connections[0]?._id || '', botBackendId: bots[0]?._id || '' });
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
      welcomeMessage: item.welcomeMessage || '',
      unsupportedMessage: item.unsupportedMessage || '',
      autoCloseMinutes: item.autoCloseMinutes ?? 15,
      autoCloseMessage: item.autoCloseMessage || '',
      suppressBotGreeting: !!item.suppressBotGreeting,
      greetingClassifierProvider: item.greetingClassifierProvider || '',
      retention: item.retention || { enabled: false, days: 90, deleteMode: 'full' },
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

  async function testConnection(item) {
    const id = item._id;
    const metaId = item.metaConnectionId?._id || item.metaConnectionId;
    const botId = item.botBackendId?._id || item.botBackendId;
    setTestResults(r => ({ ...r, [id]: 'loading' }));
    try {
      const [metaRes, botRes] = await Promise.all([
        api.post(`/meta-connections/${metaId}/test`).then(r => r.data),
        api.post(`/bot-backends/${botId}/test`).then(r => r.data),
      ]);
      const ok = metaRes.ok && botRes.ok;
      const name = ok
        ? `WhatsApp: ${metaRes.name || '✓'} · Bot: ${botRes.name || '✓'}`
        : [!metaRes.ok && `WhatsApp: ${metaRes.error}`, !botRes.ok && `Bot: ${botRes.error}`].filter(Boolean).join(' · ');
      setTestResults(r => ({ ...r, [id]: { ok, name: ok ? name : undefined, error: ok ? undefined : name } }));
    } catch {
      setTestResults(r => ({ ...r, [id]: { ok: false, error: 'Request failed' } }));
    }
  }

  function copy(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const setRetention = (patch) => setForm(f => ({ ...f, retention: { ...f.retention, ...patch } }));

  return (
    <TenantLayout title={t('connectors')}>
      <div className="page-header">
        <h2>{t('connectors')}</h2>
        <button className="btn-primary" onClick={openNew}>
          <Icon name="plus" size={14} />
          {t('new_connector')}
        </button>
      </div>

      <div className="topology-grid">
        {items.length === 0 && (
          <div className="empty" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
            {t('no_connectors')}
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
                    <div className="topo-name">{meta?.name || t('meta_connection')}</div>
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
                    <div className="topo-name">{bot?.name || t('bot_backend')}</div>
                    <div className="topo-sub">{bot?.type || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="topo-footer">
                <div className="webhook-row">
                  <span className="webhook-label">{t('webhook')}</span>
                  <span className="webhook-url">{webhookUrl}</span>
                  <button
                    className={`btn-copy ${copied === item._id ? 'copied' : ''}`}
                    onClick={() => copy(webhookUrl, item._id)}
                  >
                    {copied === item._id ? t('copied') : t('copy')}
                  </button>
                </div>
                <div className="topo-controls">
                  <div className="toggle-wrap">
                    <button
                      className={`toggle ${item.active ? 'on' : ''}`}
                      onClick={() => toggleActive(item)}
                      title={item.active ? 'Deactivate' : 'Activate'}
                    />
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{item.active ? t('active') : t('inactive')}</span>
                  </div>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => testConnection(item)}
                    disabled={testResults[item._id] === 'loading'}
                  >
                    {testResults[item._id] === 'loading' ? '...' : t('test')}
                  </button>
                  {testResults[item._id] && testResults[item._id] !== 'loading' && (
                    <span className={`conn-badge ${testResults[item._id].ok ? 'conn-ok' : 'conn-err'}`} style={{ maxWidth: 280 }}>
                      {testResults[item._id].ok
                        ? `✓ ${testResults[item._id].name}`
                        : `✗ ${testResults[item._id].error}`}
                    </span>
                  )}
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => openEdit(item)}>{t('edit')}</button>
                  <button className="btn-danger" onClick={() => remove(item._id)}>{t('delete')}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal title={selected ? t('edit_connector') : t('new_connector')} onClose={() => setModal(false)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={save} className="form-grid">
            <label>{t('name')}
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </label>
            <label>{t('meta_connection')}
              <select value={form.metaConnectionId} onChange={e => setForm(f => ({ ...f, metaConnectionId: e.target.value }))} required>
                <option value="">Select...</option>
                {connections.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </label>
            <label>{t('bot_backend')}
              <select value={form.botBackendId} onChange={e => setForm(f => ({ ...f, botBackendId: e.target.value }))} required>
                <option value="">Select...</option>
                {bots.map(b => <option key={b._id} value={b._id}>{b.name} ({b.type})</option>)}
              </select>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              {t('active')}
            </label>

            <fieldset style={{ marginTop: 8 }}>
              <legend style={{ fontWeight: 600, fontSize: 13 }}>הודעות אוטומטיות</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                <WhatsAppEditor
                  label="הודעת פתיחה"
                  value={form.welcomeMessage}
                  onChange={v => setForm(f => ({ ...f, welcomeMessage: v }))}
                  placeholder="תוכן ישלח אוטומטית בתחילת כל שיחה חדשה..."
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!form.suppressBotGreeting}
                    onChange={e => setForm(f => ({ ...f, suppressBotGreeting: e.target.checked }))}
                  />
                  דכא הודעת ברכה חוזרת מהבוט
                </label>
                {form.suppressBotGreeting && (
                  <label>ספק LLM לסיווג
                    <select
                      value={form.greetingClassifierProvider}
                      onChange={e => setForm(f => ({ ...f, greetingClassifierProvider: e.target.value }))}
                    >
                      <option value="">ברירת מחדל (ראשון ברשימה)</option>
                      {llmProviders.map(p => (
                        <option key={p._id || p.name} value={p.name}>{p.name} ({p.model})</option>
                      ))}
                    </select>
                  </label>
                )}
                <WhatsAppEditor
                  label="הודעה לתוכן לא נתמך (תמונות, קבצים וכו')"
                  value={form.unsupportedMessage}
                  onChange={v => setForm(f => ({ ...f, unsupportedMessage: v }))}
                  placeholder="לא ניתן לצרף תוכן זה בשלב זה. אשמח להמשיך לסייע בהודעות כתובות."
                />
              </div>
            </fieldset>

            <fieldset style={{ marginTop: 8 }}>
              <legend style={{ fontWeight: 600, fontSize: 13 }}>סגירה אוטומטית</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                <label>סגור שיחה לאחר
                  <input
                    type="number"
                    min="1"
                    style={{ width: 70, marginInline: 6 }}
                    value={form.autoCloseMinutes}
                    onChange={e => setForm(f => ({ ...f, autoCloseMinutes: parseInt(e.target.value) || 15 }))}
                  />
                  דקות ללא פעילות
                </label>
                <WhatsAppEditor
                  label="הודעת סגירה אוטומטית"
                  value={form.autoCloseMessage}
                  onChange={v => setForm(f => ({ ...f, autoCloseMessage: v }))}
                  placeholder="תודה על פנייתך, הפניה נסגרה, נשמח לעמוד לשירותך בכל זמן"
                />
              </div>
            </fieldset>

            <fieldset style={{ marginTop: 8 }}>
              <legend style={{ fontWeight: 600, fontSize: 13 }}>מדיניות שמירת שיחות</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={!!form.retention?.enabled} onChange={e => setRetention({ enabled: e.target.checked })} />
                  מחק שיחות ישנות אוטומטית
                </label>
                {form.retention?.enabled && (
                  <>
                    <label>מחק לאחר
                      <input
                        type="number"
                        min="1"
                        style={{ width: 70, marginInline: 6 }}
                        value={form.retention.days}
                        onChange={e => setRetention({ days: parseInt(e.target.value) || 90 })}
                      />
                      ימים
                    </label>
                    <label>מה למחוק
                      <select value={form.retention.deleteMode} onChange={e => setRetention({ deleteMode: e.target.value })}>
                        <option value="full">כל השיחה (כולל מטאדאטה)</option>
                        <option value="messages">הודעות בלבד (שמור מטאדאטה)</option>
                      </select>
                    </label>
                  </>
                )}
              </div>
            </fieldset>

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
