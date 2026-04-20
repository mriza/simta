import { useState, useEffect, useRef } from 'react'
import type { Bimbingan as BimbinganType, Mahasiswa, UserRole, Berkas } from '../types'
import { fmtDate, getErrorMessage, todayISO } from '../utils'
import { api } from '../api'
import { renderAsync } from 'docx-preview'

interface Props {
  bimbingan: BimbinganType[]
  mahasiswa: Mahasiswa[]
  onRefresh: () => void
  role: UserRole
  userId: string
}

const BAB_OPTIONS = ['Bab 1', 'Bab 2', 'Bab 3', 'Bab 4', 'Bab 5']
const STATUS_OPTIONS = ['Perancangan (Design)', 'Pengembangan (Coding/Pembuatan)', 'Pengujian', 'Selesai']

const BERKAS_KINDS = [
  'Laporan TA',
  'Source code / program',
  'Desain PCB',
  'Desain sistem',
  'Presentasi',
  'Dokumentasi teknis',
  'Video dokumentasi',
  'Artefak proyek lain'
]

export default function Bimbingan({ bimbingan, mahasiswa, onRefresh, role, userId }: Props) {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [activeBimb, setActiveBimb] = useState<BimbinganType | null>(null)
  const [berkasList, setBerkasList] = useState<Berkas[]>([])
  const [form, setForm] = useState({ 
    mhs_id: '', tanggal: todayISO(), peran: '1', topik: '',
    bab: 'Bab 1', kendala_mhs: '', feedback_dosen: '', status_alat: 'Perancangan (Design)'
  })
  const [uploadRows, setUploadRows] = useState<{ id: string, kind: string, file: File | null, url: string, mode: 'file' | 'youtube' | 'external' }[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewingBerkas, setViewingBerkas] = useState<Berkas | null>(null)
  const [showOfflineForm, setShowOfflineForm] = useState(false)
  const [offlineSchedule, setOfflineSchedule] = useState({ date: '', place: '' })
  const docxRef = useRef<HTMLDivElement>(null)

  const isDosen = role === 'dosen'
  const isMhs = role === 'mhs'

  useEffect(() => {
     if (activeBimb) {
        loadBerkas(activeBimb.id)
        setOfflineSchedule({ date: activeBimb.offline_date || '', place: activeBimb.offline_place || '' })
     }
  }, [activeBimb])

  async function loadBerkas(id: string) {
     try {
        const all = await api.berkas.list()
        setBerkasList(all.filter(b => b.bimbingan_id === id))
      } catch(e) { 
         console.error('Gagal memuat berkas:', e) 
      }
  }

  function handleStartBimbingan() {
    api.bimbingan.create({
      mhs_id: isMhs ? userId : '', 
      tanggal: todayISO(), 
      peran: '1', 
      topik: 'Permohonan Bimbingan TA',
      bab: 'Bab 1', 
      kendala_mhs: '', 
      feedback_dosen: '', 
      status_alat: 'Perancangan (Design)'
    }).then(b => {
       if (!b || !b.id) throw new Error('Format respons server tidak valid')
       setActiveBimb(b)
       setForm({
          mhs_id: b.mhs_id || userId || '', 
          tanggal: b.tanggal || todayISO(), 
          peran: b.peran || '1', 
          topik: b.topik || 'Sesi Bimbingan Baru',
          bab: b.bab || 'Bab 1', 
          kendala_mhs: b.kendala_mhs || '', 
          feedback_dosen: b.feedback_dosen || '', 
          status_alat: b.status_alat || 'Perancangan (Design)'
       })
       setUploadRows([])
       setError('')
       setModalOpen(true)
       onRefresh()
    }).catch(e => {
       console.error('Bimb fail:', e)
       setError('Gagal memulai bimbingan: ' + getErrorMessage(e))
    })
  }

  function openEdit(b: BimbinganType) {
    setActiveBimb(b)
    setForm({
      mhs_id: b.mhs_id, tanggal: b.tanggal, peran: b.peran, topik: b.topik,
      bab: b.bab || 'Bab 1',
      kendala_mhs: b.kendala_mhs || '',
      feedback_dosen: b.feedback_dosen || '',
      status_alat: b.status_alat || 'Perancangan (Design)'
    })
    setUploadRows([])
    setModalOpen(true)
  }

  const filtered = bimbingan.filter(b => {
    const q = search.toLowerCase()
    if (!q) return true
    return (b.nama_mhs || '').toLowerCase().includes(q) || (b.topik || '').toLowerCase().includes(q)
  })

  async function handleUploadFiles(bimbId: string) {
     for (const row of uploadRows) {
        const fd = new FormData()
        fd.append('bimbingan_id', bimbId)
        fd.append('kind', row.kind)
        fd.append('storage_mode', row.mode)
        if (row.mode === 'file' && row.file) fd.append('file', row.file)
        else fd.append('external_url', row.url)
        await api.berkas.upload(fd)
     }
  }

  async function handleSave() {
    if (!activeBimb) return
    setSaving(true)
    try {
      await api.bimbingan.update(activeBimb.id, form)
      await handleUploadFiles(activeBimb.id)
      onRefresh()
      setModalOpen(false)
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  async function handleSubmit() {
    if (!activeBimb) return
    setSaving(true)
    try {
       await api.bimbingan.update(activeBimb.id, form)
       await handleUploadFiles(activeBimb.id)
       await api.bimbingan.submit(activeBimb.id)
       onRefresh()
       setModalOpen(false)
    } catch(e) { setError(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  async function handleDeleteDraft() {
    if (!activeBimb) return
    if (!confirm('Hapus/Batalkan draf bimbingan ini?')) return
    setSaving(true)
    try {
      await api.bimbingan.delete(activeBimb.id)
      onRefresh()
      setModalOpen(false)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleScheduleOffline() {
    if (!activeBimb) return
    setSaving(true)
    try {
      await api.bimbingan.scheduleOffline(activeBimb.id, offlineSchedule.date, offlineSchedule.place)
      onRefresh()
      setShowOfflineForm(false)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const canEdit = activeBimb && (
     (isMhs && activeBimb.status === 'Draft') || 
     (isDosen && activeBimb.status !== 'Completed' && activeBimb.status !== 'Draft')
  )

  const hasActiveBimbingan = bimbingan.some(b => b.status !== 'Completed')

  return (
    <div className="bimbingan-tab">
      <div className="section-head">
        <div>
          <h2>Bimbingan TA</h2>
          <p>Proses bimbingan dan peninjauan berkas</p>
        </div>
        <div className="actions">
          {isMhs && mahasiswa[0]?.status_proses !== 'Lulus' && !hasActiveBimbingan && (
            <button className="btn btn-primary" onClick={handleStartBimbingan}>🚀 Memulai Bimbingan</button>
          )}
        </div>
      </div>

      {error && <div className="error-banner mb-20">{error}</div>}
      
      <div className="table-wrap">
        <div className="table-controls">
          <input className="search-input" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Mahasiswa</th>
                <th>Pembimbing</th>
                <th>Status Bimbingan</th>
                <th>Catatan</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td>{fmtDate(b.tanggal)}</td>
                  <td>
                    <div className="name-cell">{b.nama_mhs}</div>
                    <div className="nim-cell">{b.nim_mhs}</div>
                  </td>
                  <td>
                    <div className="name-cell">{b.nama_dosen || (b.peran === '1' ? 'Pembimbing 1' : 'Pembimbing 2')}</div>
                  </td>
                  <td>
                     <StatusBadge status={b.status} offline={b.offline_status} />
                  </td>
                  <td className="max-w-300 overflow-ellipsis">{b.topik}</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => openEdit(b)}>Detail / Review</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && activeBimb && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
               <div>
                  <h3>Sesi Bimbingan</h3>
                  <div className="nim-cell">ID: {activeBimb.id} · <StatusBadge status={activeBimb.status} offline={activeBimb.offline_status} /></div>
               </div>
               <button className="modal-close" onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body bimb-modal-body">
               {error && <div className="error-banner">{error}</div>}
               <div className={`bimb-grid ${role === 'prodi' ? 'prodi' : ''}`}>
                  <div className="bimb-form-col">
                     {isMhs && (
                        <div className="field">
                           <label>Ditujukan Kepada</label>
                            <div className="flex-gap-20 mt-4">
                              <label className={`fs-13 flex flex-gap-8 ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}>
                                 <input type="radio" value="1" checked={form.peran === '1'} onChange={() => setForm({...form, peran: '1'})} disabled={!canEdit} />
                                 <span>PB 1: <strong>{mahasiswa[0]?.nama_pembimbing1 || '—'}</strong></span>
                              </label>
                              <label className={`fs-13 flex flex-gap-8 ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}>
                                 <input type="radio" value="2" checked={form.peran === '1' ? false : form.peran === '2'} onChange={() => setForm({...form, peran: '2'})} disabled={!canEdit} />
                                 <span>PB 2: <strong>{mahasiswa[0]?.nama_pembimbing2 || '—'}</strong></span>
                              </label>
                           </div>
                        </div>
                     )}
                     <div className="field full">
                           <label>Judul Singkat / Fokus Bimbingan</label>
                           <input value={form.topik} onChange={e => setForm({...form, topik: e.target.value})} disabled={!canEdit} />
                        </div>
                        {isDosen && (
                        <div className="form-grid">
                           <div className="field">
                              <label>Bab</label>
                              <select value={form.bab} onChange={e => setForm({...form, bab: e.target.value})} disabled={!canEdit}>
                                 {BAB_OPTIONS.map(o => <option key={o}>{o}</option>)}
                              </select>
                           </div>
                           <div className="field">
                              <label>Progres Alat</label>
                              <select value={form.status_alat} onChange={e => setForm({...form, status_alat: e.target.value})} disabled={!canEdit}>
                                 {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                              </select>
                           </div>
                        </div>
                        )}
                     <div className="field full">
                        <label>Kendala Mahasiswa</label>
                        <textarea rows={2} value={form.kendala_mhs} onChange={e => setForm({...form, kendala_mhs: e.target.value})} disabled={!canEdit} />
                     </div>
                     {!isDosen && activeBimb.feedback_dosen && (
                        <div className="feedback-view">
                           <div><strong>Feedback:</strong> <p>{activeBimb.feedback_dosen}</p></div>
                        </div>
                     )}
                     {activeBimb.offline_status === 'Scheduled' && (
                        <div className="offline-summary">
                           <strong>Jadwal Offline:</strong>
                           <p>{activeBimb.offline_date} • {activeBimb.offline_place}</p>
                        </div>
                     )}
                     {isDosen && showOfflineForm && (
                        <div className="offline-schedule-form">
                           <div className="field">
                              <label>Tanggal Offline</label>
                              <input type="date" value={offlineSchedule.date} onChange={e => setOfflineSchedule({ ...offlineSchedule, date: e.target.value })} />
                           </div>
                           <div className="field">
                              <label>Tempat Offline</label>
                              <input value={offlineSchedule.place} onChange={e => setOfflineSchedule({ ...offlineSchedule, place: e.target.value })} placeholder="Ruang / lokasi" />
                           </div>
                           <div className="offline-input-actions">
                              <button className="btn btn-primary" onClick={handleScheduleOffline} disabled={saving || !offlineSchedule.date || !offlineSchedule.place}>Simpan Jadwal Offline</button>
                              <button className="btn btn-ghost ml-8" onClick={() => setShowOfflineForm(false)}>Batal</button>
                           </div>
                        </div>
                     )}
                  </div>

                  {role !== 'prodi' && (
                  <div className="bimb-berkas-col">
                     <label className="section-label">Berkas Terlampir</label>
                     <div className="berkas-mini-list">
                        {berkasList.map(bk => (
                           <div key={bk.id} className="bk-item">
                              <div className="bk-info">
                                 <strong>{bk.bab}</strong>
                                 <span>{bk.file_name}</span>
                              </div>
                              <button className="btn-ghost" onClick={() => setViewingBerkas(bk)}>Buka</button>
                           </div>
                        ))}
                        {berkasList.length === 0 && <div className="empty-mini">Belum ada berkas.</div>}
                     </div>

                     {isMhs && activeBimb.status === 'Draft' && (
                        <div className="add-berkas-box">
                           <label>Tambah Berkas</label>
                           {uploadRows.map((row, i) => (
                              <div key={row.id} className="upload-mini-row">
                                 <select value={row.kind} onChange={e => {
                                    const r = [...uploadRows]; r[i].kind = e.target.value; 
                                    r[i].mode = e.target.value === 'Video YouTube' ? 'youtube' : 'file';
                                    setUploadRows(r);
                                 }}>
                                    {BERKAS_KINDS.map(o => <option key={o}>{o}</option>)}
                                 </select>
                                 {row.mode === 'youtube' ? (
                                    <input placeholder="Link YouTube" value={row.url} onChange={e => {const r = [...uploadRows]; r[i].url = e.target.value; setUploadRows(r)}} />
                                 ) : (
                                    <input type="file" onChange={e => {const r = [...uploadRows]; r[i].file = e.target.files?.[0] || null; setUploadRows(r)}} />
                                 )}
                                 <button onClick={() => setUploadRows(uploadRows.filter(x => x.id !== row.id))}>&times;</button>
                              </div>
                           ))}
                           <button className="btn-ghost" onClick={() => setUploadRows([...uploadRows, { id: Math.random().toString(), kind: BERKAS_KINDS[0], file: null, url: '', mode: 'file' }])}>+ Berkas</button>
                        </div>
                     )}
                  </div>
                  )}
               </div>
            </div>
            <div className="modal-foot">
               <div className="flex-auto">
                  {isDosen && activeBimb.status === 'Proposed' && (
                     <button className="btn btn-primary" onClick={() => { api.bimbingan.accept(activeBimb.id).then(() => { onRefresh(); setModalOpen(false) }).catch(e => console.error(e)) }}>Terima Bimbingan</button>
                  )}
                  {isDosen && activeBimb.status === 'InReview' && (
                     <>
                        {activeBimb.offline_status !== 'Scheduled' && (
                           <button className="btn" onClick={() => setShowOfflineForm(true)}>Jadwalkan Offline</button>
                        )}
                        <button className="btn btn-primary ml-8" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Review'}</button>
                        <button className="btn btn-success ml-8" onClick={() => { api.bimbingan.complete(activeBimb.id).then(() => { onRefresh(); setModalOpen(false) }).catch(e => setError(getErrorMessage(e))) }}>Selesai Bimbingan</button>
                     </>
                  )}
                  {isDosen && activeBimb.status === 'OfflineScheduled' && (
                     <>
                        <button className="btn" onClick={() => { api.bimbingan.updateOfflineStatus(activeBimb.id, 'Finished').then(() => { onRefresh(); setModalOpen(false) }).catch(e => console.error(e)) }}>Offline Selesai</button>
                        <button className="btn ml-8" onClick={() => { api.bimbingan.updateOfflineStatus(activeBimb.id, 'Cancelled').then(() => { onRefresh(); setModalOpen(false) }).catch(e => console.error(e)) }}>Offline Batal</button>
                     </>
                  )}
                  {isDosen && activeBimb.status === 'Completed' && (
                     <button className="btn btn-ghost" onClick={() => { api.bimbingan.reopen(activeBimb.id).then(() => { onRefresh(); setModalOpen(false) }).catch(e => console.error(e)) }}>Buka Kembali Sesi</button>
                  )}
               </div>
               
               <button className="btn" onClick={() => setModalOpen(false)}>Tutup</button>
               {isMhs && activeBimb.status === 'Draft' && (
                  <>
                     <button className="btn btn-ghost" onClick={handleDeleteDraft} disabled={saving} style={{color: 'var(--danger)'}}>Batalkan Draft</button>
                     <button className="btn btn-ghost" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Draft'}</button>
                     <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Mengirim...' : 'Ajukan Bimbingan'}</button>
                  </>
               )}
            </div>
          </div>
        </div>
      )}

      {viewingBerkas && (
         <BerkasViewer berkas={viewingBerkas} onClose={() => setViewingBerkas(null)} docxRef={docxRef} />
      )}

    </div>
  )
}

function StatusBadge({ status, offline }: { status: string, offline: string }) {
   let cls = 'badge-design'
   let text = status
   if (status === 'Proposed') { cls = 'badge-bab3'; text = 'Menunggu Review' }
   if (status === 'InReview') { cls = 'badge-dev'; text = 'Sedang Review' }
   if (status === 'OfflineScheduled') { cls = 'badge-bab3'; text = 'Terjadwal Offline' }
   if (status === 'Completed') { cls = 'badge-selesai'; text = 'Bimbingan Selesai' }
   if (status === 'Draft') { cls = 'badge-bab12'; text = 'Draft' }

   return (
     <div className="flex flex-gap-4">
        <span className={`badge ${cls}`}>{text}</span>
        {offline === 'Scheduled' && <span className="badge badge-danger">Offline!</span>}
        {offline === 'Finished' && <span className="badge badge-selesai">✓ Offline</span>}
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
    } catch (err) {
      console.warn('URL parsing failed', err)
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
