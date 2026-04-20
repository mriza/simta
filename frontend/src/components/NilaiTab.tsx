import type { Mahasiswa } from '../types'
import { getGrade } from '../utils'

interface Props {
  me: Mahasiswa | null
}

export default function NilaiTab({ me }: Props) {
  if (!me) return <div className="loading">Memuat data nilai…</div>

  return (
    <div className="mhs-dashboard">
      <section className="mhs-module">
        <div className="section-head sub">
          <div>
            <h2>Nilai Tugas Akhir</h2>
            <p>Rekapitulasi capaian nilai akhir dan kelulusan</p>
          </div>
          {me.file_laporan_final && (
            <a href={`/api/mahasiswa/${me.id}/download-final`} className="btn btn-ghost" target="_blank" rel="noreferrer">
              📄 Download Laporan Final
            </a>
          )}
        </div>

        <div className="grad-grades">
           <div className="grade-box">
              <label>Nilai Proses</label>
              <div className="gv">{me.nilai_bimbingan || '—'}</div>
           </div>
           <div className="grade-box">
              <label>Nilai Laporan</label>
              <div className="gv">{me.nilai_laporan || '—'}</div>
           </div>
           <div className="grade-box">
              <label>Nilai Sidang</label>
              <div className="gv">{me.nilai_sidang || '—'}</div>
           </div>
           <div className="grade-box final">
              <label>NILAI AKHIR TA</label>
              <div className="gv">
                 {me.file_laporan_final ? (
                   <>
                      {me.nilai_akhir || '—'} 
                      {me.nilai_akhir && <span className="fs-14 ml-8 text-ink-3">({getGrade(me.nilai_akhir)})</span>}
                   </>
                 ) : '🔒 (Upload Laporan)'}
              </div>
           </div>
        </div>
      </section>
    </div>
  )
}
