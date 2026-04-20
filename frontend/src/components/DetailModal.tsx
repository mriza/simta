import { useState } from 'react'
import { fmtDate, babProgress, babBadgeClass, statusBadgeClass } from '../utils'
import type { Mahasiswa, Dosen, Bimbingan, UserRole } from '../types'
import { api } from '../api'

interface Props {
  mhs: Mahasiswa
  dosen: Dosen[]
  bimbingan: Bimbingan[]
  onClose: () => void
  role: UserRole
  userId?: string
  onPrintSidang?: (mhs: Mahasiswa, token: string) => void
}

export default function DetailModal({ mhs, dosen, bimbingan, onClose, role, userId, onPrintSidang }: Props) {
  const [loadingToken, setLoadingToken] = useState(false)
  async function handlePermitSidang() {
    if (!confirm(`Izinkan ${mhs.nama} untuk mendaftar Sidang TA?`)) return
    try {
      await api.mahasiswa.permitSidang(mhs.id, 1)
    } catch (e) { alert('Gagal: ' + e) }
  }

  async function handlePrint() {
    if (!onPrintSidang) return
    setLoadingToken(true)
    try {
      const res = await api.mahasiswa.getSidangToken()
      onPrintSidang(mhs, res.token)
      onClose()
    } catch (e) {
      alert('Gagal mengambil token verifikasi: ' + e)
    } finally {
      setLoadingToken(false)
    }
  }
  const pb1 = dosen.find(d => d.id === mhs.pembimbing1_id)
  const pb2 = dosen.find(d => d.id === mhs.pembimbing2_id)

  const myLogs = bimbingan
    .filter(b => b.mhs_id === mhs.id)
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())

  const latestLog = myLogs[0] || {}
  const isPublic = role === 'umum'
  
  const canApprovePB1 = role === 'prodi' || (role === 'dosen' && userId === mhs.pembimbing1_id)
  const canApprovePB2 = role === 'prodi' || (role === 'dosen' && userId === mhs.pembimbing2_id)
  const isAuthorized = role === 'prodi' || role === 'dosen'

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal wide">
        <div className="modal-head">
          <h3>Detail Progress Mahasiswa</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="detail-head">
            <div>
              <h3>{isPublic ? 'Mahasiswa TA' : mhs.nama}</h3>
              <div className="detail-nim">NIM · {isPublic ? '*******' : mhs.nim}</div>
            </div>
            <span className={`badge ${babBadgeClass(mhs.bab)}`}>{mhs.bab}</span>
          </div>

          <div className="detail-grid">
            <div className="detail-row">
              <span className="k">Pembimbing 1</span>
              <span className="v">{pb1 ? pb1.nama : '—'} <span className="detail-muted">({mhs.jml_bimbingan1}×)</span></span>
            </div>
            <div className="detail-row">
              <span className="k">Pembimbing 2</span>
              <span className="v">{pb2 ? pb2.nama : '—'} <span className="detail-muted">({mhs.jml_bimbingan2}×)</span></span>
            </div>
            <div className="detail-row">
              <span className="k">Bimbingan Terakhir</span>
              <span className="v">{fmtDate(mhs.terakhir)}</span>
            </div>
            <div className="detail-row">
              <span className="k">Status Alat/Aplikasi</span>
              <span className="v"><span className={`badge ${statusBadgeClass(mhs.status_alat)}`}>{mhs.status_alat || '—'}</span></span>
            </div>
            <div className="detail-row">
              <span className="k">Progres Penulisan</span>
              <span className="v">{babProgress(mhs.bab)}%</span>
            </div>
            {mhs.nilai_akhir && (
               <div className="detail-row">
                 <span className="k">Nilai Akhir TA</span>
                 <span className="v"><span className="badge success">{mhs.nilai_akhir}</span></span>
               </div>
            )}
          </div>
          
          {(mhs.status_sidang !== 'Belum Sidang' || mhs.hasil_sidang) && (
            <div className="detail-grid detail-section-separator bg-slate-50 p-16 br-8">
              <div className="detail-row">
                <span className="k">Status Sidang</span>
                <span className="v">{mhs.status_sidang}</span>
              </div>
              <div className="detail-row">
                <span className="k">Hasil Sidang</span>
                <span className="v">{mhs.hasil_sidang || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="k">Tanggal Lulus/Ujian</span>
                <span className="v">{fmtDate(mhs.tanggal_sidang)}</span>
              </div>
              <div className="detail-row-4">
                 <div><div className="k">Nilai Proses</div><div className="v">{mhs.nilai_bimbingan || '—'}</div></div>
                 <div><div className="k">Nilai Laporan</div><div className="v">{mhs.nilai_laporan || '—'}</div></div>
                 <div><div className="k">Nilai Sidang</div><div className="v">{mhs.nilai_sidang || '—'}</div></div>
                 <div><div className="k">Nilai Akhir</div><div className="v">{mhs.nilai_akhir || '—'}</div></div>
              </div>
              {mhs.file_laporan_final && (
                <div className="full-col mt-12">
                   <a href={`/api/mahasiswa/${mhs.id}/download-final`} className="btn btn-sm btn-ghost" target="_blank" rel="noreferrer">
                     📄 Download Laporan Akhir (PDF)
                   </a>
                </div>
              )}
            </div>
          )}

          <div className="detail-grid detail-section-separator">
            {!isPublic && (
              <>
                <div className="detail-row">
                  <span className="k">Nomor HP</span>
                  <span className="v">{isAuthorized ? (mhs.hp || '—') : '••••••••'}</span>
                </div>
                <div className="detail-row">
                  <span className="k">HP Orang Tua</span>
                  <span className="v">{isAuthorized ? (mhs.hp_ortu || '—') : '••••••••'}</span>
                </div>
              </>
            )}
            <div className="detail-row full">
              <span className="k">Alamat</span>
              <span className="v">{isAuthorized ? (mhs.alamat || '—') : (isPublic ? 'Informasi privat' : 'Data hanya tersedia untuk Dosen/Koordinator Prodi')}</span>
            </div>
          </div>

          {!isPublic && (
            <div className="detail-grid detail-grid-split">
               <div className="dt-card">
                  <label>Persetujuan PB1 ({mhs.nama_pembimbing1 || '—'})</label>
                  <div>
                    {mhs.setuju_pembimbing1 === 1 ? (
                       <span className="badge success">✓ DISETUJUI</span>
                    ) : (
                       <span className="badge">BELUM DISETUJUI</span>
                    )}
                  </div>
               </div>
               <div className="dt-card">
                  <label>Persetujuan PB2 ({mhs.nama_pembimbing2 || '—'})</label>
                  <div>
                    {mhs.setuju_pembimbing2 === 1 ? (
                       <span className="badge success">✓ DISETUJUI</span>
                    ) : (
                       <span className="badge">BELUM DISETUJUI</span>
                    )}
                  </div>
               </div>
            </div>
          )}

          <div className={isPublic ? 'detail-stack' : 'detail-grid detail-grid-split'}>
            {(!isPublic || latestLog.kendala_mhs) && (
              <div className="dt-card">
                <label>Kendala Menurut Mahasiswa</label>
                <p>{latestLog.kendala_mhs || '—'}</p>
              </div>
            )}
          </div>

          {!isPublic && (
            <div className="detail-grid detail-grid-split">
              <div className="dt-card accent">
                <label>Feedback Dosen</label>
                <p>{latestLog.feedback_dosen || '—'}</p>
              </div>
            </div>
          )}

          <div className="detail-long">
            <h4>Riwayat Bimbingan</h4>
            {!isPublic ? (
              <div className="timeline">
                {myLogs.length === 0 ? <p className="empty-sm">Belum ada riwayat bimbingan.</p> : myLogs.map(log => (
                  <div key={log.id} className="timeline-item">
                    <div className="tl-date">{fmtDate(log.tanggal)} (PB{log.peran})</div>
                    <div className="tl-topic"><strong>{log.topik}</strong></div>
                    {(log.kendala_mhs || log.feedback_dosen) && (
                       <div className="tl-kendala">
                          {log.kendala_mhs && <div className="m">Mhs: {log.kendala_mhs}</div>}
                          {log.feedback_dosen && <div className="f">Feedback: {log.feedback_dosen}</div>}
                       </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-sm">Detail riwayat tidak tersedia untuk publik.</p>
            )}
          </div>

          <div className="detail-long">
            <h4>Judul / Fitur Utama Aplikasi/Alat</h4>
            <p>{mhs.fitur || '—'}</p>
          </div>
        </div>
        <div className="modal-foot">
          {canApprovePB1 && mhs.setuju_pembimbing1 === 0 && (
            <button className="btn btn-primary mr-auto" onClick={handlePermitSidang}>
              🚀 Setujui Sidang (sebagai PB1)
            </button>
          )}
          {canApprovePB2 && mhs.setuju_pembimbing2 === 0 && (
            <button className="btn btn-primary mr-auto" onClick={handlePermitSidang}>
              🚀 Setujui Sidang (sebagai PB2)
            </button>
          )}
          {role === 'prodi' && mhs.ijinkan_sidang === 0 && (
            <button className="btn btn-primary mr-auto" onClick={handlePermitSidang}>
              ⚖️ Otorisasi Sidang (Prodi)
            </button>
          )}
          {mhs.ijinkan_sidang === 1 && !mhs.hasil_sidang && (
            <>
              <span className="badge success mr-auto">✓ Sudah Diizinkan Sidang</span>
              {onPrintSidang && role === 'mhs' && (
                <button className="btn btn-primary" onClick={handlePrint} disabled={loadingToken || mhs.ijinkan_sidang !== 1}>
                  {loadingToken ? 'Menyiapkan…' : (mhs.ijinkan_sidang === 1 ? '📄 Cetak Surat Rekomendasi' : '🔒 Cetak (Persetujuan Belum Lengkap)')}
                </button>
              )}
            </>
          )}
          <button className="btn" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}

