import { useState } from 'react'
import type { Mahasiswa } from '../types'
import { api } from '../api'
import { getErrorMessage } from '../utils'

interface Props {
  me: Mahasiswa | null
  onPrintSidang?: (mhs: Mahasiswa, token: string) => void
  onRefresh: () => void
}

export default function PersiapanSidang({ me, onPrintSidang, onRefresh }: Props) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [loadingToken, setLoadingToken] = useState(false)

  async function handleUploadFinal(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMessage('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.mahasiswa.uploadFinal(fd)
      setMessage('Laporan akhir berhasil diunggah.')
      onRefresh()
    } catch (err) {
      setMessage('Gagal: ' + getErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  async function handlePrint() {
    if (!onPrintSidang || !me) return
    setLoadingToken(true)
    try {
      const res = await api.mahasiswa.getSidangToken()
      onPrintSidang(me, res.token)
    } catch (e) {
      alert('Gagal mengambil token verifikasi: ' + e)
    } finally {
      setLoadingToken(false)
    }
  }

  if (!me) return <div className="loading">Memuat data mahasiswa…</div>

  return (
    <div className="mhs-dashboard">
      <section className="mhs-module">
        <div className="section-head sub">
          <div>
            <h2>Persiapan Sidang</h2>
            <p>Status persyaratan dan kelengkapan administrasi sidang TA</p>
          </div>
        </div>
        
        <div className="grad-card">
          {me.status_proses === 'Lulus' ? (
            <div className="grad-success-hero">
              <div className="confetti">✨🎉🎊</div>
              <h3>Selamat, {me.nama}!</h3>
              <p>Anda telah resmi dinyatakan <strong>LULUS</strong> Tugas Akhir pada semester ini.</p>
              <div className="cert-info">
                <span className="fs-11 text-success fw-800 uppercase">Terverifikasi</span>
                <div className="fs-14 mt-4">Seluruh proses akademik bimbingan dan pelaporan telah selesai disetujui.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="grad-info">
                <h3>🏁 Penyelesaian Tugas Akhir</h3>
                <p>Tahapan akhir setelah menyelesaikan seluruh proses bimbingan.</p>
                
                <div className="grad-steps">
                  <div className={`step-item ${me.ijinkan_sidang ? 'done' : 'active'}`}>
                    <div className="s-ico">{me.ijinkan_sidang ? '✓' : '1'}</div>
                    <div className="s-label">Izin Sidang TA</div>
                  </div>
                  <div className={`step-item ${me.nilai_sidang ? 'done' : (me.ijinkan_sidang ? 'active' : 'lock')}`}>
                    <div className="s-ico">{me.nilai_sidang ? '✓' : '2'}</div>
                    <div className="s-label">Pelaksanaan Sidang</div>
                  </div>
                  <div className={`step-item ${me.file_laporan_final ? 'done' : (me.ijinkan_sidang ? 'active' : 'lock')}`}>
                    <div className="s-ico">{me.file_laporan_final ? '✓' : '3'}</div>
                    <div className="s-label">Upload Laporan Final (PDF)</div>
                  </div>
                </div>
              </div>
              
              <div className="grad-actions">
                {/* Approval Status Notice */}
                {me.ijinkan_sidang !== 1 && (
                  <div className="grad-notice-box mb-20 bg-amber-50 border-amber p-16 br-8">
                     <span className="badge warn mb-10">PENDING APPROVAL</span>
                     <p className="fs-13 text-ink-1 mb-0">
                        {me.setuju_pembimbing1 === 0 && me.setuju_pembimbing2 === 0 && (
                          <>Akses cetak surat rekomendasi akan aktif setelah disetujui oleh <strong>kedua Pembimbing</strong>.</>
                        )}
                        {me.setuju_pembimbing1 === 1 && me.setuju_pembimbing2 === 0 && (
                          <>Menunggu persetujuan dari Pembimbing 2: <strong>{me.nama_pembimbing2}</strong>.</>
                        )}
                        {me.setuju_pembimbing1 === 0 && me.setuju_pembimbing2 === 1 && (
                          <>Menunggu persetujuan dari Pembimbing 1: <strong>{me.nama_pembimbing1}</strong>.</>
                        )}
                     </p>
                  </div>
                )}

                <div className="grad-print-box">
                   {onPrintSidang && (
                     <button className="btn btn-primary w-full" onClick={handlePrint} disabled={loadingToken || me.ijinkan_sidang !== 1}>
                       {loadingToken ? 'Menyiapkan…' : (me.ijinkan_sidang === 1 ? '📄 Cetak Surat Rekomendasi Sidang' : '🔒 Cetak (Menunggu Persetujuan)')}
                     </button>
                   )}
                   {me.ijinkan_sidang === 1 && !me.file_laporan_final && (
                     <div className="upload-box mt-16">
                       <label className="btn btn-ghost cursor-pointer w-full">
                         {uploading ? 'Mengunggah...' : '📤 Upload Laporan Akhir Disahkan'}
                         <input type="file" accept=".pdf" onChange={handleUploadFinal} className="hidden" disabled={uploading} />
                       </label>
                       <p className="fs-11 mt-8 text-ink-3">Wajib format PDF yang sudah disahkan resmi.</p>
                     </div>
                   )}
                </div>
                
                {me.file_laporan_final && (
                  <div className="success-box">
                    <span className="badge success">✓ Laporan Akhir Terverifikasi</span>
                    <p className="fs-11 mt-8">Terima kasih, proses TA Anda telah selesai.</p>
                  </div>
                )}
                {message && <div className={`mt-10 fs-12 ${message.startsWith('Gagal') ? 'text-danger' : 'text-success'}`}>{message}</div>}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
