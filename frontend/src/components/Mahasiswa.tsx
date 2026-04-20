import { useState } from 'react'
import type { Mahasiswa as MahasiswaType, Dosen, Bimbingan, UserRole } from '../types'
import { fmtDate, babProgress, babBadgeClass, rutinBadgeClass, getErrorMessage } from '../utils'
import MahasiswaModal from './MahasiswaModal'
import DetailModal from './DetailModal'
import { api } from '../api'

interface Props {
  mahasiswa: MahasiswaType[]
  dosen: Dosen[]
  bimbingan: Bimbingan[]
  onRefresh: () => void
  role: UserRole
  userId?: string
  onPrintSidang: (mhs: MahasiswaType, token: string) => void
}

export default function Mahasiswa({ mahasiswa, dosen, bimbingan, onRefresh, role, userId, onPrintSidang }: Props) {
  const [saving, setSaving] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterBab, setFilterBab] = useState('')
  const [filterRutin, setFilterRutin] = useState('')
  const [editItem, setEditItem] = useState<Partial<MahasiswaType> | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<MahasiswaType | null>(null)
  const [sortBy, setSortBy] = useState<keyof MahasiswaType | 'nama'>('nama')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const toggleOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleAll = () => {
    setSelectedIds(prev => prev.length === filtered.length ? [] : filtered.map(m => m.id))
  }

  const handleBatchStatus = async (status: string) => {
    if (!selectedIds.length) return
    if (!confirm(`Ubah status ${selectedIds.length} mahasiswa menjadi "${status}"?`)) return
    setSaving(true)
    try {
      await api.mahasiswa.updateBatchStatus(selectedIds, status)
      setSelectedIds([])
      onRefresh()
    } catch (error) {
      setBatchError(getErrorMessage(error, 'Gagal update status'))
    } finally {
      setSaving(false)
    }
  }

  const filtered = mahasiswa
    .filter(m => {
      const q = search.toLowerCase()
      const matchQ = !q || m.nim.toLowerCase().includes(q) || m.nama.toLowerCase().includes(q)
      const matchBab = !filterBab || m.bab === filterBab
      const matchRutin = !filterRutin || m.rutin === filterRutin
      const matchSelf = role !== 'mhs' || m.id === userId
      return matchQ && matchBab && matchRutin && matchSelf
    })
    .sort((a, b) => {
      const fieldA = a[sortBy] || ''
      const fieldB = b[sortBy] || ''
      
      let comparison = 0
      if (typeof fieldA === 'string' && typeof fieldB === 'string') {
        comparison = fieldA.localeCompare(fieldB)
      } else {
        comparison = (fieldA as number) - (fieldB as number)
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

  function toggleSort(field: keyof MahasiswaType) {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const sortIcon = (field: keyof MahasiswaType) => {
    if (sortBy !== field) return <span className="sort-icon">⇅</span>
    return sortOrder === 'asc' ? <span className="sort-icon">↑</span> : <span className="sort-icon">↓</span>
  }

  function openAdd() {
    setEditItem(null)
    setModalOpen(true)
  }

  function openEdit(m: MahasiswaType) {
    setEditItem(m)
    setModalOpen(true)
  }

  async function handleDelete(m: MahasiswaType) {
    if (!confirm(`Hapus mahasiswa "${m.nama}"?`)) return
    await api.mahasiswa.delete(m.id)
    onRefresh()
  }

  async function handleSave(data: Omit<MahasiswaType, 'id' | 'nama_pembimbing1' | 'nama_pembimbing2'>) {
    if (editItem?.id) {
      await api.mahasiswa.update(editItem.id, data)
    } else {
      await api.mahasiswa.create(data)
    }
    onRefresh()
  }

  function shortName(full: string) {
    return full.split(',')[0]
  }

  return (
    <>
      {batchError && <div className="error-banner" onClick={() => setBatchError('')}>{batchError}</div>}
      <div className="section-head">
        <div>
          <h2>Mahasiswa</h2>
          <p>Data mahasiswa peserta tugas akhir</p>
        </div>
        <div className="actions">
          {(role === 'prodi' || role === 'dosen') && <button className="btn" onClick={() => api.exportCSV('mahasiswa')}>Ekspor CSV</button>}
          {role === 'prodi' && <button className="btn btn-primary" onClick={openAdd}>+ Tambah Mahasiswa</button>}
        </div>
      </div>

      {role === 'prodi' && selectedIds.length > 0 && (
        <div className="batch-actions">
           <span>{selectedIds.length} mahasiswa terpilih</span>
           <div className="btns">
              <button disabled={saving} onClick={() => handleBatchStatus('Lulus')}>Lulus</button>
              <button disabled={saving} onClick={() => handleBatchStatus('Lanjut')}>Lanjut (Semester Depan)</button>
              <button disabled={saving} onClick={() => handleBatchStatus('Berhenti')}>Berhenti/Drop</button>
              <button disabled={saving} onClick={() => handleBatchStatus('Bimbingan')}>Aktif Bimbingan</button>
           </div>
        </div>
      )}

      <div className="table-wrap">
        <div className="table-controls">
          <input
            className="search-input"
            placeholder="Cari NIM atau nama…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="filter-select" value={filterBab} onChange={e => setFilterBab(e.target.value)}>
            <option value="">Semua Bab</option>
            {['Bab 1', 'Bab 2', 'Bab 3', 'Bab 4', 'Bab 5'].map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="filter-select" value={filterRutin} onChange={e => setFilterRutin(e.target.value)}>
            <option value="">Semua Status Bimbingan</option>
            <option>Ya (1 kali /Minggu)</option>
            <option>Ya (Tidak Rutin)</option>
            <option>Tidak</option>
          </select>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr>
                {role === 'prodi' && <th className="w-40"><input type="checkbox" onChange={toggleAll} checked={selectedIds.length === filtered.length && filtered.length > 0} /></th>}
                <th onClick={() => toggleSort('nim')} className="cursor-pointer">NIM {sortIcon('nim')}</th>
                <th onClick={() => toggleSort('nama')} className="cursor-pointer">Nama {sortIcon('nama')}</th>
                <th onClick={() => toggleSort('bab')} className="cursor-pointer">Progres {sortIcon('bab')}</th>
                <th>Pembimbing 1</th>
                <th>Pembimbing 2</th>
                <th onClick={() => toggleSort('rutin')} className="cursor-pointer">Status Bimbingan {sortIcon('rutin')}</th>
                <th onClick={() => toggleSort('terakhir')} className="cursor-pointer">Terakhir {sortIcon('terakhir')}</th>
                <th>Status Alat</th>
                <th>Status Proses</th>
                <th>Sidang</th>
                <th>Nilai Akhir</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="empty">
                      <div className="empty-ico">ø</div>
                      Tidak ada data
                    </div>
                  </td>
                </tr>
              ) : filtered.map(m => {
                const pb1 = dosen.find(d => d.id === m.pembimbing1_id)
                const pb2 = dosen.find(d => d.id === m.pembimbing2_id)
                const isSelected = selectedIds.includes(m.id)
                return (
                  <tr key={m.id} className={isSelected ? 'selected-row' : ''}>
                    {role === 'prodi' && (
                      <td><input type="checkbox" checked={isSelected} onChange={() => toggleOne(m.id)} /></td>
                    )}
                    <td className="nim-cell">{role === 'umum' ? '*******' : m.nim}</td>
                    <td className="name-cell cursor-pointer text-accent" onClick={() => setDetailItem(m)}>
                      {role === 'umum' ? 'Mahasiswa TA' : m.nama}
                    </td>
                    <td>
                      <span className={`badge ${babBadgeClass(m.bab)}`}>{m.bab}</span>
                      <div className="mini-progress mt-4">
                        <div className="track"><div className="fill" style={{ width: `${babProgress(m.bab)}%` }} /></div>
                        <div className="pct">{babProgress(m.bab)}%</div>
                      </div>
                    </td>
                    <td>
                      {pb1 ? shortName(pb1.nama) : '—'}
                      <div className="nim-cell">{m.jml_bimbingan1}× bimbingan</div>
                    </td>
                    <td>
                      {pb2 ? shortName(pb2.nama) : '—'}
                      <div className="nim-cell">{m.jml_bimbingan2}× bimbingan</div>
                    </td>
                    <td><span className={`badge ${rutinBadgeClass(m.rutin)}`}>{m.rutin}</span></td>
                    <td className="nim-cell">{fmtDate(m.terakhir)}</td>
                    <td><span className="nim-cell">{m.status_alat || '-'}</span></td>
                    <td><span className={`badge ${m.status_proses === 'Lanjut' ? 'normal' : 'important'}`}>{m.status_proses}</span></td>
                    <td>
                      {m.status_sidang === 'Sudah Sidang' ? (
                        <span className={`badge ${m.hasil_sidang === 'Lulus' ? 'success' : 'important'}`}>{m.hasil_sidang || 'Selesai Sidang'}</span>
                      ) : (
                        m.ijinkan_sidang ? <span className="badge info">Siap Sidang</span> : <span className="badge secondary">Tunggu Sesi</span>
                      )}
                    </td>
                    <td><strong>{m.nilai_akhir || '—'}</strong></td>
                    <td className="text-right">
                      <div className="row-actions">
                        <button onClick={() => setDetailItem(m)}>Detail</button>
                        {role === 'prodi' && (
                          <>
                            <button onClick={() => openEdit(m)}>Edit</button>
                            <button className="del" onClick={() => handleDelete(m)}>Hapus</button>
                          </>
                        )}
                        {role === 'mhs' && m.id === userId && (
                           <button onClick={() => openEdit(m)}>Update Info Saya</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <MahasiswaModal
          initial={editItem}
          dosen={dosen}
          role={role}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      {detailItem && (
        <DetailModal
          mhs={detailItem}
          dosen={dosen}
          bimbingan={bimbingan}
          onClose={() => setDetailItem(null)}
          role={role}
          userId={userId}
          onPrintSidang={onPrintSidang}
        />
      )}
    </>
  )
}
