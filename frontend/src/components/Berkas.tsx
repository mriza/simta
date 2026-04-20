import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import type { Berkas, Mahasiswa, UserRole } from '../types'
import { fmtDate, getErrorMessage } from '../utils'
import { renderAsync } from 'docx-preview'

interface Props {
  role: UserRole
  mahasiswa: Mahasiswa[]
}

export default function BerkasTab({ mahasiswa }: Props) {
  const [berkasList, setBerkasList] = useState<Berkas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewingBerkas, setViewingBerkas] = useState<Berkas | null>(null)
  const docxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadBerkas()
  }, [])

  async function loadBerkas() {
    setLoading(true)
    try {
      const data = await api.berkas.list()
      setBerkasList(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memuat berkas'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="berkas-tab">
      <div className="section-head">
        <div>
          <h2>Repositori Berkas</h2>
          <p>Kumpulan dokumen, video progress, dan feedback dosen dari bimbingan</p>
        </div>
      </div>

      {error && <div className="error-banner" onClick={() => setError('')}>{error}</div>}

      <div className="berkas-list-section">
        {loading ? (
          <div className="loading">Memuat berkas...</div>
        ) : berkasList.length === 0 ? (
          <div className="empty">Belum ada berkas yang diunggah. Berkas diunggah melalui sesi bimbingan.</div>
        ) : (
          <div className="artifact-grid">
            {berkasList.map(b => (
              <div key={b.id} className="art-card">
                <div className="art-head">
                  <span className="art-tag">{b.bab}</span>
                  <span className="art-date">{fmtDate(b.uploaded_at)}</span>
                </div>
                <div className="art-info">
                  <h4>{b.file_name}</h4>
                  <p className="art-mhs">Oleh: {mahasiswa.find(m => m.id === b.mhs_id)?.nama || 'Mahasiswa'}</p>
                </div>
                {b.kendala && (
                  <div className="art-kendala">
                    <label>Kendala:</label>
                    <p>{b.kendala}</p>
                  </div>
                )}
                <div className="art-actions">
                  <button className="btn btn-ghost" onClick={() => setViewingBerkas(b)}>Buka / Preview</button>
                  <button className="btn btn-ghost" onClick={() => api.berkas.download(b.id)}>Unduh</button>
                </div>
                {b.feedback && (
                   <div className="art-feedback">
                      <label>Feedback Dosen:</label>
                      <p>{b.feedback}</p>
                   </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingBerkas && (
        <BerkasViewer 
          berkas={viewingBerkas} 
          onClose={() => setViewingBerkas(null)} 
          docxRef={docxRef}
        />
      )}

    </div>
  )
}

function BerkasViewer({ berkas, onClose, docxRef }: { berkas: Berkas, onClose: () => void, docxRef: React.RefObject<HTMLDivElement | null> }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (berkas.storage_mode === 'file' && berkas.file_name.endsWith('.docx')) {
      renderDocx()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berkas])

  async function renderDocx() {
    try {
      const res = await fetch(api.berkas.viewUrl(berkas.id))
      const blob = await res.blob()
      if (docxRef.current) {
        docxRef.current.innerHTML = ''
        await renderAsync(blob, docxRef.current)
      }
    } catch (err) {
      console.error('Docx preview failed', err)
    } finally {
      setLoading(false)
    }
  }

  function getYoutubeEmbed(url: string) {
    let vid: string | null = null
    try {
      const u = new URL(url)
      if (u.hostname.includes('youtu.be')) {
        vid = u.pathname.slice(1)
      } else {
        vid = u.searchParams.get('v')
      }
    } catch (error) {
      // Invalid URL format, vid will remain null
      console.warn('Invalid YouTube URL format:', error)
    }

    if (!vid) return <p>Link YouTube tidak valid.</p>
    return (
      <iframe
        width="100%"
        height="450"
        src={`https://www.youtube.com/embed/${vid}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Preview: {berkas.file_name}</h3>
          <div className="flex flex-gap-8">
             <button className="btn btn-ghost" onClick={() => api.berkas.download(berkas.id)}>Unduh</button>
             <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
        </div>
        <div className={`modal-body flex-grow overflow-y-auto ${berkas.file_type.includes('image') ? 'bg-dark' : 'bg-white'}`}>
          {loading && <div className="loading">Menyiapkan preview...</div>}
          
          <div className={loading ? 'hidden' : 'block'}>
            {berkas.storage_mode === 'youtube' ? (
              getYoutubeEmbed(berkas.external_url)
            ) : berkas.file_type.includes('image') ? (
              <img src={api.berkas.viewUrl(berkas.id)} className="img-preview" alt={berkas.file_name} />
            ) : berkas.file_name.endsWith('.docx') ? (
              <div ref={docxRef} className="docx-container" />
            ) : berkas.storage_mode === 'external' ? (
              <div className="text-center p-40">
                <p>Berkas ini berupa link eksternal.</p>
                <a href={berkas.external_url} target="_blank" rel="noreferrer" className="btn btn-primary">Buka di Tab Baru</a>
              </div>
            ) : (
              <div className="text-center p-40">
                <p>Preview tidak tersedia untuk format file ini.</p>
                <button className="btn btn-primary" onClick={() => api.berkas.download(berkas.id)}>Unduh File</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
