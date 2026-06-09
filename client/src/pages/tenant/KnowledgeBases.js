import React, { useState, useEffect, useCallback } from 'react';
import { TenantLayout } from '../../components/Layout';
import { useLanguage } from '../../context/LanguageContext';
import Modal from '../../components/Modal';
import { Drawer } from '../../components/Modal';
import Icon from '../../components/Icons';
import api from '../../api';

export default function KnowledgeBases() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/knowledge-bases');
    setItems(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setSelected(null); setForm({ name: '' }); setError(''); setModal('kb'); }
  function openEdit(item) { setSelected(item); setForm({ name: item.name }); setError(''); setModal('kb'); }
  function openDocs(item) { setSelected(item); setError(''); setModal('docs'); }

  async function save(e) {
    e.preventDefault(); setError('');
    try {
      if (selected) await api.put(`/knowledge-bases/${selected._id}`, form);
      else await api.post('/knowledge-bases', form);
      setModal(null); load();
    } catch (err) { setError(err.response?.data?.error || 'Error'); }
  }

  async function remove(id) {
    if (!window.confirm(t('delete_kb'))) return;
    await api.delete(`/knowledge-bases/${id}`); load();
  }

  async function uploadFile(e) {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = ''; setUploading(true); setError('');
    try {
      const fd = new FormData(); fd.append('file', file);
      await api.post(`/knowledge-bases/${selected._id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { data } = await api.get('/knowledge-bases');
      setItems(data); setSelected(data.find(k => k._id === selected._id));
    } catch (err) { setError(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  }

  async function deleteDoc(docId) {
    if (!window.confirm(t('delete_doc'))) return;
    setError('');
    try {
      await api.delete(`/knowledge-bases/${selected._id}/documents/${docId}`);
      const { data } = await api.get('/knowledge-bases');
      setItems(data); setSelected(data.find(k => k._id === selected._id) || null);
    } catch (err) { setError(err.response?.data?.error || 'Delete failed'); }
  }

  return (
    <TenantLayout title={t('knowledge_bases')}>
      <div className="page-header">
        <h2>{t('knowledge_bases')}</h2>
        <button className="btn-primary" onClick={openNew}>
          <Icon name="plus" size={14} /> {t('new_kb')}
        </button>
      </div>

      <div className="kb-grid">
        {items.length === 0 && (
          <div className="empty" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', gridColumn: '1/-1' }}>
            {t('no_kbs')}
          </div>
        )}
        {items.map(item => (
          <div key={item._id} className="kb-card">
            <div className="kb-card-header">
              <div className="kb-name">{item.name}</div>
            </div>
            <div className="kb-stats">
              <div className="kb-stat">
                <span className="kb-stat-num">{item.documentCount ?? 0}</span>
                <span className="kb-stat-label">{t('docs')}</span>
              </div>
            </div>
            <div className="kb-actions">
              <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => openDocs(item)}>
                <Icon name="upload" size={12} style={{ marginInlineEnd: 5 }} /> {t('documents')}
              </button>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => openEdit(item)}>{t('edit')}</button>
              <button className="btn-danger" onClick={() => remove(item._id)}>{t('delete')}</button>
            </div>
          </div>
        ))}
      </div>

      {modal === 'kb' && (
        <Modal title={selected ? t('edit_kb') : t('new_kb')} onClose={() => setModal(null)}>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={save} className="form-grid">
            <label>{t('name')}<input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></label>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button type="submit" className="btn-primary">{t('save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'docs' && selected && (
        <Drawer title={`${t('documents')} — ${selected.name}`} onClose={() => setModal(null)}>
          {error && <div className="error-banner">{error}</div>}
          <label className="dropzone">
            <Icon name="upload" size={24} style={{ marginBottom: 8, color: 'var(--fg-4)' }} />
            <div>{uploading ? t('uploading') : t('click_to_upload')}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>{t('file_types')}</div>
            <input type="file" accept=".txt,.pdf" onChange={uploadFile} disabled={uploading} style={{ display: 'none' }} />
          </label>
          <table className="data-table">
            <thead><tr><th>{t('filename')}</th><th>{t('chunks')}</th><th>{t('uploaded')}</th><th></th></tr></thead>
            <tbody>
              {(selected.documents || []).map(doc => (
                <tr key={doc._id}>
                  <td>{doc.filename}</td>
                  <td>{doc.chunkCount}</td>
                  <td>{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                  <td><button className="btn-danger" onClick={() => deleteDoc(doc._id)}>{t('delete')}</button></td>
                </tr>
              ))}
              {(!selected.documents || selected.documents.length === 0) && (
                <tr><td colSpan={4} className="empty">{t('no_docs')}</td></tr>
              )}
            </tbody>
          </table>
        </Drawer>
      )}
    </TenantLayout>
  );
}
