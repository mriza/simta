import { useState, useEffect } from 'react'
import { api } from '../api'
import type { Mahasiswa, AppConfig } from '../types'
import { getErrorMessage } from '../utils'

interface Props {
  token: string
}

export default function PublicVerification({ token }: Props) {
  const [data, setData] = useState<{ mahasiswa: Mahasiswa; config: AppConfig } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function verify() {
      try {
        const res = await api.mahasiswa.verifySidangToken(token)
        setData(res)
      } catch (e) {
        setError(getErrorMessage(e, 'Gagal memverifikasi token'))
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [token])

  if (loading) return <div className="pub-verify-layout"><div className="loading">Memverifikasi keaslian dokumen…</div></div>
  if (error) return <div className="pub-verify-layout"><div className="error-banner">{error}</div></div>

  if (!data) return null

  const { mahasiswa, config } = data

  return (
    <div className="pub-verify-layout">
      <div className="pub-verify-card">
        <header className="pub-verify-header">
           {config.inst_logo && <img src="/api/logo" alt="Logo" className="pub-logo" />}
           <div>
              <h2>Verifikasi Dokumen Elektronik</h2>
              <p>{config.inst_name} · {config.dept_name}</p>
           </div>
        </header>

        <div className="pub-verify-status success">
           <div className="status-icon">✓</div>
           <div className="status-text">
              <h3>DOKUMEN VALID & TERCATAT</h3>
              <p>Surat Rekomendasi Pendaftaran Sidang ini asli diterbitkan oleh sistem SIMTA.</p>
           </div>
        </div>

        <section className="pub-verify-details">
           <h4>Informasi Mahasiswa</h4>
           <div className="verify-grid">
              <div className="row">
                 <span className="label">Nama</span>
                 <span className="val">{mahasiswa.nama}</span>
              </div>
              <div className="row">
                 <span className="label">NIM</span>
                 <span className="val">{mahasiswa.nim}</span>
              </div>
              <div className="row">
                 <span className="label">Program Studi</span>
                 <span className="val">{config.prog_name}</span>
              </div>
              <div className="row">
                 <span className="label">Tahun Akademik</span>
                 <span className="val">{config.academic_year}</span>
              </div>
           </div>

           <h4>Informasi Tugas Akhir</h4>
           <div className="verify-grid">
              <div className="row">
                 <span className="label">Judul/Topik</span>
                 <span className="val">{mahasiswa.fitur || '—'}</span>
              </div>
              <div className="row">
                 <span className="label">Status</span>
                 <span className="val badge info">Diizinkan Mendaftar Sidang</span>
              </div>
              <div className="row">
                 <span className="label">Pembimbing 1</span>
                 <span className="val">
                   {mahasiswa.nama_pembimbing1 || '—'} 
                   {mahasiswa.setuju_pembimbing1 === 1 && <span className="text-success ml-4">✓ Disetujui</span>}
                 </span>
              </div>
              <div className="row">
                 <span className="label">Pembimbing 2</span>
                 <span className="val">
                   {mahasiswa.nama_pembimbing2 || '—'}
                   {mahasiswa.setuju_pembimbing2 === 1 && <span className="text-success ml-4">✓ Disetujui</span>}
                 </span>
              </div>
           </div>
        </section>

        <footer className="pub-verify-footer">
           <p>Diverifikasi pada: {new Date().toLocaleString('id-ID')}</p>
           <p className="token-id">ID Token: {token}</p>
        </footer>
      </div>
      
      <div className="pub-verify-back">
         <a href="/" className="btn btn-ghost">Kembali ke Beranda SIMTA</a>
      </div>
    </div>
  )
}
