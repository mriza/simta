import { useState } from 'react'
import type { Mahasiswa, Dosen, Bimbingan, UserRole } from '../types'
import { babProgress, statusBadgeClass, truncate } from '../utils'
import DetailModal from './DetailModal'
import { api } from '../api'

interface Props {
  mahasiswa: Mahasiswa[]
  dosen: Dosen[]
  bimbingan: Bimbingan[]
  role: UserRole
}

export default function Project({ mahasiswa, dosen, bimbingan, role }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [detailItem, setDetailItem] = useState<Mahasiswa | null>(null)

  const filtered = mahasiswa.filter(m => {
    const q = search.toLowerCase()
    const matchQ = !q || m.nama.toLowerCase().includes(q) || (m.fitur || '').toLowerCase().includes(q)
    const matchSt = !filterStatus || m.status_alat === filterStatus
    return matchQ && matchSt
  })

  const canExport = role === 'prodi' || role === 'dosen'

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Project Tugas Akhir</h2>
          <p>Detail project dan progres pengembangan</p>
        </div>
        <div className="actions">
          {canExport && <button className="btn" onClick={() => api.exportCSV('project')}>Ekspor CSV</button>}
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-controls">
          <input
            className="search-input"
            placeholder="Cari judul atau mahasiswa…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Semua Status</option>
            <option>Perancangan (Design)</option>
            <option>Pengembangan (Coding/Pembuatan)</option>
            <option>Pengujian</option>
            <option>Selesai</option>
          </select>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr>
                <th>Mahasiswa</th>
                <th>Judul/Fitur Utama</th>
                <th>Status Pengembangan</th>
                <th>Progres</th>
                <th>Kendala</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty"><div className="empty-ico">ø</div>Tidak ada data</div></td></tr>
              ) : filtered.map(m => (
                <tr key={m.id}>
                  <td>
                    <div className="name-cell">{m.nama}</div>
                    <div className="nim-cell">{m.nim}</div>
                  </td>
                  <td className="max-w-340">{truncate(m.fitur, 180) || '—'}</td>
                  <td><span className={`badge ${statusBadgeClass(m.status_alat)}`}>{m.status_alat || '—'}</span></td>
                  <td>
                    <div className="mini-progress">
                      <div className="track"><div className="fill" style={{ width: `${babProgress(m.bab)}%` }} /></div>
                      <div className="pct">{babProgress(m.bab)}%</div>
                    </div>
                    <div className="nim-cell mt-2">{m.bab}</div>
                  </td>
                  <td className="max-w-260 fs-11 text-ink-2">{truncate(m.kendala_alat, 120) || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => setDetailItem(m)}>Detail</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailItem && (
        <DetailModal mhs={detailItem} dosen={dosen} bimbingan={bimbingan} onClose={() => setDetailItem(null)} role={role} />
      )}
    </>
  )
}
