import { QRCodeSVG } from 'qrcode.react'
import type { Mahasiswa, AppConfig } from '../types'

interface Props {
  mhs: Mahasiswa
  config: AppConfig | null
  token: string
}

export default function SidangLetter({ mhs, config, token }: Props) {
  const verifyUrl = `${window.location.origin}${window.location.pathname}?verify=${token}`
  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="sidang-letter-container">
      <div className="sidang-letter">
        {/* Header Institusi */}
        <div className="letter-header">
          {config?.inst_logo && (
            <img src="/api/logo" alt="Logo" className="letter-logo" />
          )}
          <div className="header-text">
            <h2>{config?.inst_name || 'POLITEKNIK NEGERI'}</h2>
            <h3>{config?.dept_name || 'JURUSAN TEKNIK'}</h3>
            <h4>{config?.prog_name || 'PROGRAM STUDI'}</h4>
            <p className="header-sub">Tahun Akademik {config?.academic_year || '—'} · Semester {config?.semester || '—'}</p>
          </div>
        </div>
        
        <div className="letter-divider"></div>

        {/* Judul Surat */}
        <div className="letter-title">
          <h3>SURAT REKOMENDASI PENDAFTARAN SIDANG TUGAS AKHIR</h3>
          <p>Nomor: {new Date().getFullYear()}/REK-TA/{mhs.nim}</p>
        </div>

        {/* Isi Surat */}
        <div className="letter-content">
          <p>Diberikan kepada mahasiswa di bawah ini:</p>
          
          <table className="letter-table">
            <tbody>
              <tr>
                <td className="label">Nama Mahasiswa</td>
                <td className="val">: <strong>{mhs.nama}</strong></td>
              </tr>
              <tr>
                <td className="label">NIM</td>
                <td className="val">: {mhs.nim}</td>
              </tr>
              <tr>
                <td className="label">Status Progres</td>
                <td className="val">: {mhs.bab} selesai (100% bimbingan)</td>
              </tr>
              <tr>
                <td className="label">Judul/Fitur Tugas Akhir</td>
                <td className="val">: {mhs.fitur || '—'}</td>
              </tr>
              <tr>
                <td className="label">Pembimbing 1</td>
                <td className="val">: {mhs.nama_pembimbing1 || '—'}</td>
              </tr>
              <tr>
                <td className="label">Pembimbing 2</td>
                <td className="val">: {mhs.nama_pembimbing2 || '—'}</td>
              </tr>
            </tbody>
          </table>

          <div className="letter-statement">
            <p>
              Berdasarkan hasil monitoring sistem bimbingan online (SIMTA), mahasiswa tersebut di atas 
              dinyatakan <strong>DISETUJUI/DIREKOMENDASIKAN</strong> untuk mendaftarkan diri pada kegiatan 
              Sidang Akhir Tugas Akhir periode Semester {config?.semester} Tahun Akademik {config?.academic_year}.
            </p>
            <p>
              Demikian surat rekomendasi ini dibuat untuk dapat dipergunakan sebagaimana mestinya.
            </p>
          </div>
        </div>

        {/* Tanda Tangan / QR */}
        <div className="letter-footer">
          <div className="footer-left">
             <div className="qr-box">
                <QRCodeSVG value={verifyUrl} size={100} includeMargin={true} />
                <div className="qr-help">Scan untuk verifikasi keaslian dokumen</div>
             </div>
          </div>
          <div className="footer-right">
            <p className="date-place">{config?.inst_name.split(' ')[1] || 'Kota'}, {today}</p>
            <p className="signature-role">Koordinator Tugas Akhir,</p>
            <div className="signature-space">
               {/* Digital Signature Placeholder */}
               <div className="digital-sign-stamp">SIGNED DIGITALLY</div>
            </div>
            <p className="signature-name"><strong>Sistem SIMTA Online</strong></p>
            <p className="signature-id">NIP. ——————</p>
          </div>
        </div>

        <div className="letter-note">
           <p>Dokumen ini diterbitkan secara elektronik melalui SIMTA dan sah tanpa tanda tangan basah.</p>
           <p className="verify-link">URL Verifikasi: {verifyUrl}</p>
        </div>
      </div>
    </div>
  )
}
