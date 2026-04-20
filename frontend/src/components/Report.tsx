import type { Mahasiswa, Dosen, UserRole } from '../types'
import { fmtDate, daysSince } from '../utils'

interface Props {
  mahasiswa: Mahasiswa[]
  dosen: Dosen[]
  role: UserRole
  onTabChange?: (tab: string) => void
}

export default function Report({ mahasiswa, dosen, role, onTabChange }: Props) {
  const total = mahasiswa.length
  const byBab: Record<string, number> = { 'Bab 1': 0, 'Bab 2': 0, 'Bab 3': 0, 'Bab 4': 0, 'Bab 5': 0 }
  const byStatus: Record<string, number> = {}
  let rutin = 0, tdkRutin = 0, tidak = 0
  let sumBimb1 = 0, sumBimb2 = 0

  mahasiswa.forEach(m => {
    byBab[m.bab] = (byBab[m.bab] || 0) + 1
    byStatus[m.status_alat || '—'] = (byStatus[m.status_alat || '—'] || 0) + 1
    if (m.rutin === 'Ya (1 kali /Minggu)') rutin++
    else if (m.rutin === 'Ya (Tidak Rutin)') tdkRutin++
    else tidak++
    sumBimb1 += m.jml_bimbingan1 || 0
    sumBimb2 += m.jml_bimbingan2 || 0
  })

  const avgBimb1 = total ? (sumBimb1 / total).toFixed(1) : '0'
  const avgBimb2 = total ? (sumBimb2 / total).toFixed(1) : '0'
  const bab4Plus = (byBab['Bab 4'] || 0) + (byBab['Bab 5'] || 0)

  const perluIntervensi = mahasiswa.filter(m => {
    const d = daysSince(m.terakhir)
    return m.rutin === 'Tidak' || (d !== null && d > 30)
  })

  const now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const nowFull = new Date().toLocaleString('id-ID')

  function pct(n: number) { return total ? Math.round(n / total * 100) : 0 }

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Laporan Ketercapaian</h2>
          <p>Rekapitulasi untuk diarsipkan atau dicetak</p>
        </div>
        <div className="actions">
          {role !== 'umum' && <button className="btn" onClick={() => window.print()}>🖨 Cetak / PDF</button>}
          {onTabChange && <button className="btn btn-primary" onClick={() => onTabChange('ta_titles')}>📚 Buku Besar Judul TA</button>}
        </div>
      </div>

      <div className="report-header">
        <div className="report-overline">Laporan Ketercapaian · Penyusunan Tugas Akhir</div>
        <h2>Rekapitulasi Progres Skripsi</h2>
        <div className="report-subtitle">Program Studi Teknologi Rekayasa Komputer · {now}</div>
      </div>

      <div className="report-summary">
        <div><div className="report-sum-k">Total Mahasiswa</div><div className="report-sum-v">{total}</div></div>
        <div><div className="report-sum-k">Progres Bab 4+</div><div className="report-sum-v">{bab4Plus}</div></div>
        <div><div className="report-sum-k">Rata-rata Bimb. PB1</div><div className="report-sum-v">{avgBimb1}×</div></div>
        <div><div className="report-sum-k">Rata-rata Bimb. PB2</div><div className="report-sum-v">{avgBimb2}×</div></div>
      </div>

      <div className="report-section">
        <h3>1. Distribusi Progres Penulisan Skripsi</h3>
        <table className="report-table">
          <thead><tr><th>Tahap</th><th>Jumlah Mahasiswa</th><th>Persentase</th></tr></thead>
          <tbody>
            {Object.entries(byBab).map(([k, v]) => (
              <tr key={k}><td>{k}</td><td>{v}</td><td>{pct(v)}%</td></tr>
            ))}
            <tr className="fw-600 bg-paper-2">
              <td>Total</td><td>{total}</td><td>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="report-section">
        <h3>2. Status Pengembangan Aplikasi/Alat</h3>
        <table className="report-table">
          <thead><tr><th>Tahapan</th><th>Jumlah</th><th>Persentase</th></tr></thead>
          <tbody>
            {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <tr key={k}><td>{k}</td><td>{v}</td><td>{pct(v)}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="report-section">
        <h3>3. Rutinitas Bimbingan</h3>
        <table className="report-table">
          <thead><tr><th>Kategori</th><th>Jumlah</th><th>Persentase</th></tr></thead>
          <tbody>
            <tr><td>Rutin (1×/minggu)</td><td>{rutin}</td><td>{pct(rutin)}%</td></tr>
            <tr><td>Tidak Rutin</td><td>{tdkRutin}</td><td>{pct(tdkRutin)}%</td></tr>
            <tr><td>Tidak Bimbingan</td><td>{tidak}</td><td>{pct(tidak)}%</td></tr>
          </tbody>
        </table>
      </div>

      <div className="report-section">
        <h3>4. Rekap Mahasiswa per Pembimbing</h3>
        <table className="report-table">
          <thead><tr><th>Dosen</th><th>Sebagai PB1</th><th>Sebagai PB2</th><th>Total</th></tr></thead>
          <tbody>
            {dosen.map(d => {
              const c1 = mahasiswa.filter(m => m.pembimbing1_id === d.id).length
              const c2 = mahasiswa.filter(m => m.pembimbing2_id === d.id).length
              return <tr key={d.id}><td>{d.nama}</td><td>{c1}</td><td>{c2}</td><td>{c1 + c2}</td></tr>
            })}
          </tbody>
        </table>
      </div>

      <div className="report-section">
        <h3>5. Daftar Mahasiswa yang Memerlukan Intervensi</h3>
        {perluIntervensi.length === 0 ? (
          <p className="fs-italic text-ink-3">Tidak ada mahasiswa yang memerlukan intervensi.</p>
        ) : (
          <table className="report-table">
            <thead><tr><th>NIM</th><th>Nama</th><th>Progres</th><th>Rutinitas</th><th>Bimbingan Terakhir</th><th>Catatan</th></tr></thead>
            <tbody>
              {perluIntervensi.map(m => {
                const d = daysSince(m.terakhir)
                const catatan = m.rutin === 'Tidak' ? 'Tidak bimbingan' : `${d} hari sejak bimbingan terakhir`
                return (
                  <tr key={m.id}>
                    <td className="nim-cell">{m.nim}</td>
                    <td>{m.nama}</td>
                    <td>{m.bab}</td>
                    <td>{m.rutin}</td>
                    <td>{fmtDate(m.terakhir)}</td>
                    <td>{catatan}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="report-section">
        <h3>6. Rekap Lengkap Seluruh Mahasiswa</h3>
        <table className="report-table">
          <thead>
            <tr><th>No</th><th>NIM</th><th>Nama</th><th>Bab</th><th>PB1 (×)</th><th>PB2 (×)</th><th>Status Alat</th><th>Rutinitas</th></tr>
          </thead>
          <tbody>
            {mahasiswa.map((m, i) => (
              <tr key={m.id}>
                <td>{i + 1}</td>
                <td className="nim-cell">{m.nim}</td>
                <td>{m.nama}</td>
                <td>{m.bab}</td>
                <td>{m.jml_bimbingan1 || 0}</td>
                <td>{m.jml_bimbingan2 || 0}</td>
                <td>{m.status_alat || '—'}</td>
                <td>{m.rutin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="report-footer">
        <div>SIMTA · Sistem Monitoring Tugas Akhir</div>
        <div>Dicetak: {nowFull}</div>
      </div>
    </>
  )
}
