import { useState, useEffect } from 'react'
import { api } from '../api'
import type { AppConfig, Event, UserRole, Semester, Mahasiswa } from '../types'
import { fmtDate, getErrorMessage } from '../utils'

interface Props {
  role: UserRole
  onRefresh: () => void
}

function getEventIcon(cat?: string) {
  switch (cat) {
    case 'sidang': return '🎤'
    case 'bimbingan': return '📝'
    case 'yudisium': return '🎓'
    case 'update': return '🔄'
    case 'proposal': return '📄'
    default: return '📁'
  }
}

export default function Settings({ role, onRefresh }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [newSem, setNewSem] = useState({ name: '', academic_year: '', term: 'Ganjil' })
  const [mahasiswa, setMahasiswa] = useState<Mahasiswa[]>([])
  const [archiveReviewMhs, setArchiveReviewMhs] = useState<Mahasiswa[] | null>(null)
  const [openSemStep, setOpenSemStep] = useState(1)
  const [selectedMigrateIds, setSelectedMigrateIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [eventModal, setEventModal] = useState(false)
  const [activeEvent, setActiveEvent] = useState<Partial<Event> | null>(null)

  async function loadData() {
    try {
      const [c, e, s, m] = await Promise.all([
        api.config.get(), 
        api.events.list(),
        api.semesters.list(),
        api.mahasiswa.list(),
      ])
      setConfig(c)
      setEvents(e)
      setSemesters(s)
      setMahasiswa(m)
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function handleSaveConfig() {
    if (!config) return
    setSaving(true)
    try {
      await api.config.update(config)
      setError('')
      onRefresh()
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('logo', e.target.files[0])
      const res = await api.config.uploadLogo(formData)
      if (res.inst_logo && config) {
        setConfig({ ...config, inst_logo: res.inst_logo })
      }
      onRefresh()
    } catch (error) {
      setError(getErrorMessage(error, 'Gagal upload logo'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm('Hapus kegiatan ini?')) return
    try {
      await api.events.delete(id)
      loadData()
    } catch (e) { setError(getErrorMessage(e)) }
  }

  async function handleSaveEvent() {
    if (!activeEvent || !activeEvent.title || !activeEvent.start_date) return
    setSaving(true)
    try {
      if (activeEvent.id) {
        await api.events.update(activeEvent.id, activeEvent)
      } else {
        await api.events.create(activeEvent as Omit<Event, 'id'>)
      }
      setEventModal(false)
      loadData()
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  async function handleCloseSemesterExec(id: string) {
    setSaving(true)
    try {
      await api.semesters.close(id)
      setArchiveReviewMhs(null)
      loadData()
    } catch (error) { setError(getErrorMessage(error)) }
    finally { setSaving(false) }
  }

  async function handleStartSemester() {
    if (!newSem.name || !newSem.academic_year) {
       setError('Lengkapi data semester baru.')
       return
    }
    setSaving(true)
    try {
      await api.semesters.start({ ...newSem, student_ids: selectedMigrateIds })
      setOpenSemStep(1)
      setNewSem({ name: '', academic_year: '', term: 'Ganjil' })
      loadData()
      onRefresh()
    } catch (e) { setError(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading">Memuat pengaturan…</div>

  return (
    <div className="settings-container">
      <div className="section-head">
        <div>
          <h2>Pengaturan Sistem</h2>
          <p>Konfigurasi institusi dan kalender akademik</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="settings-grid">
        <div className="settings-card">
          <h3>Identitas Institusi</h3>
          <div className="form-grid">
            <div className="field full">
              <label>Nama Institusi</label>
              <input 
                value={config?.inst_name || ''} 
                onChange={e => setConfig(prev => prev ? { ...prev, inst_name: e.target.value } : null)} 
              />
            </div>
            <div className="field">
              <label>Jurusan</label>
              <input 
                value={config?.dept_name || ''} 
                onChange={e => setConfig(prev => prev ? { ...prev, dept_name: e.target.value } : null)} 
              />
            </div>
            <div className="field">
              <label>Program Studi</label>
              <input 
                value={config?.prog_name || ''} 
                onChange={e => setConfig(prev => prev ? { ...prev, prog_name: e.target.value } : null)} 
              />
            </div>
            <div className="field full mt-12">
              <label>Logo Institusi Pilihan</label>
              <div className="flex flex-gap-16 items-center">
                <input type="file" accept=".png,.jpg,.jpeg,.svg" onChange={handleUploadLogo} disabled={saving} />
                {saving && <span className="text-ink-3 fs-13">Mengunggah...</span>}
              </div>
              <p className="fs-12 text-ink-3 mt-4">Pilih gambar rasio kotak untuk hasil header terbaik.</p>
            </div>
          </div>
          <div className="mt-24">
            <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan Profil Institusi'}
            </button>
          </div>
        </div>

        <div className="settings-card">
          <h3>Kalender Akademik</h3>
          <div className="table-wrap mt-16">
            <table>
              <thead>
                <tr>
                  <th>Kegiatan</th>
                  <th>Mulai</th>
                  <th>Selesai</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id}>
                    <td>
                      <div className="event-title-row">
                        <span className="event-icon-cell">{getEventIcon(ev.category)}</span>
                        <strong>{ev.title}</strong>
                      </div>
                    </td>
                    <td><span className="nim-cell">{fmtDate(ev.start_date)}</span></td>
                    <td><span className="nim-cell">{ev.end_date ? fmtDate(ev.end_date) : '—'}</span></td>
                    <td className="text-right">
                      <button className="btn-icon" onClick={() => { setActiveEvent(ev); setEventModal(true) }}>✎</button>
                      {!ev.is_mandatory && (
                        <button className="btn-icon del ml-8" onClick={() => handleDeleteEvent(ev.id)}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-16">
             <button className="btn btn-ghost" onClick={() => { setActiveEvent({ title: '', start_date: '', end_date: '', type: 'normal', category: 'lainnya', is_mandatory: 0 }); setEventModal(true) }}>+ Tambah Kegiatan</button>
          </div>
        </div>

        {role === 'prodi' && (
          <div className="settings-card full-row">
            <h3>Manajemen Siklus Semester</h3>
            <p className="fs-14 text-ink-2 mb-20">
              Kelola siklus akademik. Semester yang telah berakhir dapat diarsipkan (Freeze) dan mahasiswa dapat ditandai untuk lanjut atau lulus.
            </p>
            
            <div className="semester-manager">
               <div className="sem-list">
                  <h4>Daftar Semester</h4>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Nama Semester</th>
                          <th>Tahun</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {semesters.map(s => (
                          <tr key={s.id}>
                            <td><strong>{s.name}</strong></td>
                            <td className="nim-cell">{s.academic_year}</td>
                            <td><span className={`badge ${s.status === 'active' ? 'important' : 'normal'}`}>{s.status}</span></td>
                            <td>
                               {s.status === 'active' && (
                                 <button className="btn btn-sm" onClick={() => setArchiveReviewMhs(mahasiswa.filter(m => m.semester_id === s.id))}>
                                   Arsipkan
                                 </button>
                               )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="sem-actions">
                  <h4>Mulai Semester Baru</h4>
                  <div className="sem-opening-box">
                    {openSemStep === 1 ? (
                      <div className="form-grid sem-opening-form">
                        <div className="field">
                          <label>Nama Semester</label>
                          <input placeholder="Contoh: Semester Ganjil 2026/2027" value={newSem.name} onChange={e => setNewSem({...newSem, name: e.target.value})} />
                        </div>
                        <div className="field">
                          <label>Tahun Akademik</label>
                          <input placeholder="Contoh: 2026/2027" value={newSem.academic_year} onChange={e => setNewSem({...newSem, academic_year: e.target.value})} />
                        </div>
                        <div className="field">
                          <label>Term</label>
                          <select value={newSem.term} onChange={e => setNewSem({...newSem, term: e.target.value})}>
                            <option value="Ganjil">Ganjil</option>
                            <option value="Genap">Genap</option>
                          </select>
                        </div>
                        <button className="btn btn-primary mt-24" onClick={() => {
                          const candidates = mahasiswa.filter(m => m.hasil_sidang !== 'Lulus').map(m => m.id)
                          setSelectedMigrateIds(candidates)
                          setOpenSemStep(2)
                        }}>
                          Lanjut ke Review Mahasiswa &gt;
                        </button>
                      </div>
                    ) : (
                      <div className="candidate-review">
                        <p className="fs-13 mb-12">Pilih mahasiswa yang akan dimigrasikan:</p>
                        <div className="candidate-list">
                           {mahasiswa.filter(m => m.hasil_sidang !== 'Lulus').map(m => (
                             <label key={m.id} className="candidate-item">
                               <input type="checkbox" checked={selectedMigrateIds.includes(m.id)} onChange={e => {
                                 if (e.target.checked) setSelectedMigrateIds([...selectedMigrateIds, m.id])
                                 else setSelectedMigrateIds(selectedMigrateIds.filter(id => id !== m.id))
                               }} />
                               <div className="fs-13">
                                 <strong className="mr-8">{m.nim}</strong> {m.nama}
                               </div>
                             </label>
                           ))}
                        </div>
                        <div className="btns mt-16 flex flex-gap-12">
                           <button className="btn btn-ghost" onClick={() => setOpenSemStep(1)}>Kembali</button>
                           <button className="btn btn-primary" onClick={handleStartSemester} disabled={saving}>
                             {saving ? 'Memproses...' : `Buka Semester & Migrasi ${selectedMigrateIds.length} Siswa`}
                           </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {eventModal && activeEvent && (
        <div className="modal-backdrop" onClick={() => setEventModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
               <h3>{activeEvent.id ? 'Edit Kegiatan' : 'Kegiatan Baru'}</h3>
               <button className="modal-close" onClick={() => setEventModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
               <div className="form-grid">
                  <div className="field full">
                     <label>Nama Kegiatan</label>
                     <input value={activeEvent.title} onChange={e => setActiveEvent({...activeEvent, title: e.target.value})} placeholder="Contoh: Sidang Skripsi Gelombang 1" />
                  </div>
                  <div className="field">
                     <label>Kategori (Icon)</label>
                     <select value={activeEvent.category} onChange={e => setActiveEvent({...activeEvent, category: e.target.value as Event['category']})}>
                        <option value="sidang">🎤 Seminar / Sidang</option>
                        <option value="bimbingan">📝 Bimbingan TA</option>
                        <option value="yudisium">🎓 Yudisium</option>
                        <option value="update">🔄 Data Update</option>
                        <option value="proposal">📄 Pengiriman Proposal</option>
                        <option value="lainnya">📁 Lainnya</option>
                     </select>
                  </div>
                  <div className="field">
                     <label>Prioritas</label>
                     <select value={activeEvent.type} onChange={e => setActiveEvent({...activeEvent, type: e.target.value as Event['type']})}>
                        <option value="normal">Normal (Biru)</option>
                        <option value="important">Penting (Kuning)</option>
                        <option value="critical">Kritis (Merah)</option>
                     </select>
                  </div>
                  <div className="form-grid full">
                    <div className="field">
                       <label>Tanggal Mulai</label>
                       <input type="date" value={activeEvent.start_date} onChange={e => setActiveEvent({...activeEvent, start_date: e.target.value})} />
                    </div>
                    <div className="field">
                       <label>Tanggal Selesai (Opsional)</label>
                       <input type="date" value={activeEvent.end_date} onChange={e => setActiveEvent({...activeEvent, end_date: e.target.value})} />
                    </div>
                  </div>
               </div>
            </div>
            <div className="modal-foot">
               <button className="btn" onClick={() => setEventModal(false)}>Batal</button>
               <button className="btn btn-primary" onClick={handleSaveEvent} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Kegiatan'}</button>
            </div>
          </div>
        </div>
      )}

      {archiveReviewMhs && (
        <div className="modal-backdrop" onClick={() => setArchiveReviewMhs(null)}>
           <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                 <h3>Review Akhir Semester</h3>
                 <button className="modal-close" onClick={() => setArchiveReviewMhs(null)}>&times;</button>
              </div>
              <div className="modal-body overflow">
                 <p className="fs-14 mb-16">Review status kelulusan sebelum menutup semester. Data bimbingan akan dibekukan setelah arsip.</p>
                 <div className="table-wrap">
                    <table>
                       <thead>
                          <tr>
                             <th>NIM</th>
                             <th>Nama</th>
                             <th>Sidang Permit</th>
                             <th>Hasil Sidang</th>
                             <th>Nilai Akhir TA</th>
                          </tr>
                       </thead>
                       <tbody>
                          {archiveReviewMhs.map(m => (
                            <tr key={m.id}>
                               <td className="nim-cell">{m.nim}</td>
                               <td className="name-cell">{m.nama}</td>
                               <td>
                                  {m.ijinkan_sidang ? <span className="badge success">DIIZINKAN</span> : <span className="badge normal">PENDING</span>}
                               </td>
                               <td><span className={`badge ${m.hasil_sidang === 'Lulus' ? 'success' : 'important'}`}>{m.hasil_sidang || 'Belum Sidang'}</span></td>
                               <td><strong>{m.nilai_akhir || '—'}</strong></td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
              <div className="modal-foot">
                 <button className="btn" onClick={() => setArchiveReviewMhs(null)}>Batal</button>
                 <button className="btn btn-primary" onClick={() => {
                    const activeSem = semesters.find(s => s.status === 'active')
                    if (activeSem) handleCloseSemesterExec(activeSem.id)
                 }}>Konfirmasi & Arsipkan Semester</button>
              </div>
           </div>
        </div>
      )}

    </div>
  )
}
