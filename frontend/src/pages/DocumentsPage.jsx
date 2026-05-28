import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import Card from '../components/ui/Card';
import Icon from '../components/ui/Icon';
import { useToast } from '../contexts/ToastContext';
import { getDocuments, uploadDocument, deleteDocument, rebuildIndex } from '../services/api';

export default function DocumentsPage() {
  const { admin } = useAuth();
  const role      = admin?.role ?? 'admin';
  const name      = admin?.username ?? 'Admin';
  const initials  = name.slice(0, 2).toUpperCase();

  const toast = useToast();

  const [docs,       setDocs]       = useState([]);
  const [uploading,  setUploading]  = useState(false);
  const [uploadPct,  setUploadPct]  = useState(0);
  const [uploadName, setUploadName] = useState('');
  const [rebuilding, setRebuilding] = useState(false);
  const [lastRebuild, setLastRebuild] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { loadDocs(); }, []);

  async function loadDocs() {
    try {
      const data = await getDocuments();
      setDocs(data || []);
    } catch { /* noop */ }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadName(file.name);
    setUploading(true);
    setUploadPct(0);

    const interval = setInterval(() => setUploadPct(p => Math.min(p + 12, 90)), 300);
    try {
      await uploadDocument(file);
      setUploadPct(100);
      await loadDocs();
      toast.success(`${file.name} ingested successfully.`);
      setTimeout(() => { setUploading(false); setUploadName(''); }, 1200);
    } catch (err) {
      toast.error(err.message || 'Upload failed. Try again.');
      setUploading(false);
    } finally {
      clearInterval(interval);
      e.target.value = '';
    }
  }

  async function handleDelete(docId, filename) {
    if (!confirm(`Delete "${filename}"? This will remove it from the knowledge base.`)) return;
    try {
      await deleteDocument(docId);
      await loadDocs();
      toast.success(`"${filename}" removed from knowledge base.`);
    } catch (err) {
      toast.error(err.message || 'Delete failed. Try again.');
    }
  }

  async function handleRebuild() {
    setRebuilding(true);
    try {
      await rebuildIndex();
      setLastRebuild(new Date());
      toast.success('FAISS index rebuilt successfully.');
    } catch (err) {
      toast.error(err.message || 'Rebuild failed.');
    } finally {
      setRebuilding(false);
    }
  }

  const totalChunks = docs.reduce((s, d) => s + (d.chunk_count ?? 0), 0);

  return (
    <div className="pc-app" style={{ height: '100vh' }}>
      <div className="pc-shell">
        <Sidebar active="docs" role={role} name={name} initials={initials} />

        <main className="pc-main">
          <TopBar
            title="Documents"
            sub={`${docs.length} PDF${docs.length !== 1 ? 's' : ''} · ${totalChunks} chunks indexed in FAISS`}
            actions={
              <>
                <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={handleRebuild} disabled={rebuilding}>
                  <Icon name="refresh" size={12} />
                  {rebuilding ? 'Rebuilding…' : lastRebuild ? `Last rebuild: ${lastRebuild.toLocaleTimeString()}` : 'Rebuild index'}
                </button>
              </>
            }
          />

          <div className="pc-content" style={{ overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

              {/* Documents table */}
              <Card
                title="Knowledge base"
                sub="PDFs ingested for retrieval"
                padded={false}
                action={
                  <div style={{ position: 'relative' }}>
                    <input className="pc-input" style={{ width: 200, height: 32, paddingLeft: 32, fontSize: 12.5 }} placeholder="Search documents…" />
                    <div style={{ position: 'absolute', left: 10, top: 8, color: 'var(--pc-text-3)' }}><Icon name="search" size={14} /></div>
                  </div>
                }
              >
                {docs.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--pc-text-3)', fontSize: 13 }}>
                    No documents yet. Upload a PDF to get started.
                  </div>
                ) : (
                  <table className="pc-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Pages</th>
                        <th>Size</th>
                        <th>Uploaded</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map(d => (
                        <tr key={d.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 30, height: 36, borderRadius: 4, background: 'var(--pc-danger-soft)', color: 'var(--pc-danger)', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>PDF</div>
                              <div style={{ fontWeight: 550 }}>{d.filename}</div>
                            </div>
                          </td>
                          <td className="pc-mono">{d.page_count ?? '—'}</td>
                          <td className="pc-mono" style={{ color: 'var(--pc-text-2)' }}>
                            {d.file_size ? `${Math.round(d.file_size / 1024)} KB` : '—'}
                          </td>
                          <td style={{ color: 'var(--pc-text-3)', fontSize: 12 }}>
                            {d.created_at ? new Date(d.created_at).toLocaleString() : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="pc-btn pc-btn-ghost pc-btn-icon" onClick={() => handleDelete(d.id, d.filename)}>
                              <Icon name="trash" size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Upload card */}
                <Card title="Add to knowledge base">
                  <div
                    className="pc-upload-zone"
                    onClick={() => fileRef.current?.click()}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="pc-upload-icon"><Icon name="upload" size={20} /></div>
                    <div style={{ fontSize: 14, fontWeight: 550 }}>Drop a PDF or click to browse</div>
                    <div style={{ fontSize: 12, color: 'var(--pc-text-3)' }}>PDF only · max 20MB</div>
                    <button
                      className="pc-btn pc-btn-primary pc-btn-sm"
                      style={{ marginTop: 4 }}
                      onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                    >
                      Choose file
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />

                  {uploading && (
                    <div style={{ marginTop: 14, padding: 12, background: 'var(--pc-surface-2)', borderRadius: 10, border: '1px solid var(--pc-divider)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 26, height: 32, borderRadius: 4, background: 'var(--pc-danger-soft)', color: 'var(--pc-danger)', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 700 }}>PDF</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--pc-text-3)' }}>{uploadPct < 100 ? 'embedding…' : 'done'}</div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--pc-primary)', fontWeight: 600 }} className="pc-mono">{uploadPct}%</div>
                      </div>
                      <div style={{ height: 4, background: 'var(--pc-divider)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${uploadPct}%`, height: '100%', background: 'var(--pc-primary)', transition: 'width .3s' }} />
                      </div>
                    </div>
                  )}
                </Card>

                {/* Pipeline status */}
                <Card title="Ingestion pipeline">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                    {[
                      'PyPDF2 text extraction',
                      'Chunking (1000 / 200 overlap)',
                      'ada-002 embeddings (1536-d)',
                      'FAISS rebuild (IndexFlatIP)',
                    ].map(t => (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--pc-success-soft)', color: 'var(--pc-success)', display: 'grid', placeItems: 'center' }}>
                          <Icon name="check" size={11} stroke={2.4} />
                        </div>
                        <div>{t}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
